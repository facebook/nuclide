# Copyright (c) 2015-present, Facebook, Inc.
# All rights reserved.
#
# This source code is licensed under the license found in the LICENSE file in
# the root directory of this source tree.

from clang import cindex

import heapq
import logging
import re
import time
from itertools import islice


OPERATOR_OVERLOAD_RE = re.compile('^operator[^\w]')

# Cache values for speed.
CURSOR_KIND_DESTRUCTOR = cindex.CursorKind.DESTRUCTOR.value
CURSOR_KIND_CXX_METHOD = cindex.CursorKind.CXX_METHOD.value
CURSOR_KIND_MACRO = cindex.CursorKind.MACRO_DEFINITION.value


logger = logging.getLogger(__name__)


# Wraps cindex.CodeCompletionResult
class CompletionResult:

    def __init__(self, completion_result):
        self._result = completion_result
        self._priority = None
        self._typed_name = None

    @property
    def priority(self):
        """
        Clang's ranking isn't very good. We downrank the following:
        - Operator overloads
        - Destructors
        - Macros
        - Methods prefixed underscores
        """
        if self._priority is not None:
            return self._priority

        priority = self._result.string.priority
        kind = self._result.cursorKind
        if kind == CURSOR_KIND_DESTRUCTOR:
            priority += 50
        elif kind == CURSOR_KIND_MACRO:
            priority += 25
        elif kind == CURSOR_KIND_CXX_METHOD:
            typed_name = self.typed_name
            if typed_name.startswith('_'):
                priority += 25
            elif OPERATOR_OVERLOAD_RE.match(typed_name):
                priority += 100
        self._priority = priority
        return priority

    @property
    def typed_name(self):
        """
        A completion results contains exactly one TypedText chunk, representing
        what autocompletion input should be matched against.
        """
        if self._typed_name is not None:
            return self._typed_name

        self._typed_name = ''
        for chunk in self._result.string:
            if chunk.isKindTypedText():
                self._typed_name = chunk.spelling
                break
        return self._typed_name

    @property
    def kind(self):
        try:
            return self._result.kind.name
        except:
            # Function argument completions return a special cursor kind:
            #   CXCursor_OverloadCandidate = 700
            # This isn't declared in the LLVM Python bindings (yet).
            # TODO(hansonw): remove when this is upstreamed
            if self._result.cursorKind == 700:
                return 'OVERLOAD_CANDIDATE'
            return 'UNKNOWN'

    @classmethod
    def _get_chunks(cls, completion_string, chunks, is_optional=False):
        """
        Concatenate all chunks contained in completion_string.
        Dives recursively into optional parameters as necessary, marking them with a flag.
        """

        result_type = ''
        for chunk in completion_string:
            # A piece of text that describes something about the result but
            # should not be inserted into the buffer. (e.g. const modifier)
            if chunk.isKindInformative():
                continue

            # There should be at most one ResultType chunk and it should tell us
            # the type of the suggested expression. For example, if a method call is
            # suggested, this chunk will be equal to the method return type.
            # Obviously, we don't want that chunk in spelling.
            if chunk.isKindResultType():
                result_type = chunk.spelling
                continue

            if chunk.isKindOptional():
                child_string = chunk.string
                if child_string:
                    cls._get_chunks(child_string, chunks, True)
                continue

            chunk_data = {
                'spelling': chunk.spelling,
                'kind': str(chunk.kind),
            }
            # Don't set these unless necessary for efficiency.
            if chunk.isKindPlaceHolder() or chunk.kind.name == 'CurrentParameter':
                chunk_data['isPlaceHolder'] = True
            if is_optional:
                chunk_data['isOptional'] = True
            chunks.append(chunk_data)

        return result_type

    def to_dict(self):
        completion_string = self._result.string
        briefComment = completion_string.briefComment
        # In newer Clang versions, briefComment is a string.
        if not isinstance(briefComment, basestring):
            briefComment = briefComment and briefComment.spelling

        chunks = []
        result_type = CompletionResult._get_chunks(completion_string, chunks)

        spelling = ''
        for chunk in chunks:
            spelling += chunk['spelling']

        return {
            'spelling': spelling,
            'chunks': chunks,
            'result_type': result_type,
            'cursor_kind': self.kind,
            'brief_comment': briefComment,
            'typed_name': self.typed_name,
        }


# Wraps cindex.CodeCompletionResults.
# Results must be pre-sorted by typed_name.
class CompletionResults:

    def __init__(self, completion):
        # Keep reference to original results object alive.
        self._completion = completion
        self._results = map(CompletionResult, list(completion.results))
        self._last_prefix = None

    def getResults(self, prefix, limit):
        if prefix == '':
            matches = self._results
            num_matches = len(matches)
        else:
            # Since the results are sorted, binary search to find the range that matches.
            # Fetching the typed text for each result is expensive, so this requires only
            # O(log N) lookups / comparisons.
            prefix_lower = prefix.lower()
            start = self._getFirstMatch(prefix_lower)
            # ~ is the last printable character in the ASCII table.
            # Destructors should still be visible, so add two of them.
            end = self._getFirstMatch(prefix_lower + '~~')
            matches = islice(self._results, start, end)
            num_matches = end - start

            self._last_prefix = prefix_lower
            self._last_start = start
            self._last_end = end

        best_matches = heapq.nsmallest(
            limit or num_matches, matches, key=lambda x: x.priority)

        # We ignored case earlier, but use it as a final ranking basis.
        # Note that Python sort is stable.
        best_matches.sort(key=lambda x: not x.typed_name.startswith(prefix))
        return map(lambda x: x.to_dict(), best_matches)

    # Binary search for the first result comparing >= `prefix`.
    # Note that prefix should already be all lowercase.
    # Returns len(results) if no such result exists.
    def _getFirstMatch(self, prefix):
        if (self._last_prefix is not None and
                prefix.startswith(self._last_prefix)):
            low = self._last_start
            high = self._last_end
        else:
            low = 0
            high = len(self._results)

        while low < high:
            mid = (low + high) // 2
            if self._results[mid].typed_name.lower() < prefix:
                low = mid + 1
            else:
                high = mid
        return low


class CompletionCache:

    def __init__(self, absolute_path, translation_unit, clang_lib):
        self._absolute_path = absolute_path
        self._translation_unit = translation_unit
        self._clang_lib = clang_lib
        self.invalidate()

    def get_completions(self, line, column, prefix, contents=None, limit=None):
        completions = self._lookup(line, column)
        if completions is None:
            completions = _get_completions(
                self._translation_unit,
                self._clang_lib,
                self._absolute_path,
                line,
                column,
                contents
            )
            self._update(line, column, completions)
        # completions may still be None if there was a clang parsing error.
        if completions is None:
            return []
        return completions.getResults(prefix, limit)

    def invalidate(self):
        self._last_line = None
        self._last_column = None
        self._completions = None

    def _lookup(self, line, column):
        if line == self._last_line and column == self._last_column:
            return self._completions
        return None

    def _update(self, line, column, completions):
        self._last_line = line
        self._last_column = column
        self._completions = completions


def _get_completions(
    translation_unit,
    clang_lib,
    absolute_path,
    line,
    column,
    contents=None,
):
    unsaved_files = []
    if contents:
        contents_as_str = contents.encode('utf8')
        unsaved_files.append((absolute_path, contents_as_str))

    start_time = time.time()
    completion = translation_unit.codeComplete(
        absolute_path, line, column, unsaved_files,
        include_macros=True, include_brief_comments=True)
    if completion is None:
        return None
    logger.info(
        'codeComplete returned %d completions in %.3lf secs',
        len(completion.results),
        time.time() - start_time,
    )

    # Sort results for fast filtering.
    clang_lib.clang_sortCodeCompletionResults(
        # hack: retrieve underlying results pointer
        completion.results.results, len(completion.results))
    wrapper = CompletionResults(completion)
    return wrapper
