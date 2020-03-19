# Copyright (c) 2015-present, Facebook, Inc.
# All rights reserved.
#
# This source code is licensed under the license found in the LICENSE file in
# the root directory of this source tree.

from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

import errno
import getpass
import hashlib
import json
import logging
import os
import sys
import tempfile
import time
import traceback
from logging import FileHandler
from argparse import ArgumentParser
import jedi
from parso.python.tree import ImportFrom
import outline

LIB_DIR = os.path.abspath('../VendorLib')
WORKING_DIR = os.getcwd()


class JediServer:

    def __init__(self, paths):
        self.additional_paths = paths
        self.logger = logging.getLogger()
        self.input_stream = sys.stdin
        self.output_stream = sys.stdout

    def run(self):
        self.init_logging()
        while True:
            line = self.input_stream.readline()
            res = self.process_request(line)
            json.dump(res, self.output_stream)
            # Use \n to signal the end of the response.
            self.output_stream.write('\n')
            self.output_stream.flush()

    def get_filtered_sys_path(self, src):
        # Retrieves the sys.path with VendorLib filtered out, so symbols from
        # jedi don't appear in user's autocompletions or hyperclicks.
        # Don't filter out VendorLib if we're working in the jediserver's dir. :)
        return [path for path in sys.path
                if (path != LIB_DIR and path != WORKING_DIR) or
                src.startswith(WORKING_DIR)]

    def generate_log_name(self, value):
        hash = hashlib.md5(value.encode('utf-8')).hexdigest()[:10]
        return os.path.basename(value) + '-' + hash + '.log'

    def init_logging(self):
        # Be consistent with the main Nuclide logs.
        log_dir = os.path.join(
            tempfile.gettempdir(),
            'nuclide-%s-logs' % getpass.getuser()
        )
        try:
            os.makedirs(log_dir)
        except OSError as e:
            if e.errno != errno.EEXIST:
                # Skip logging on any other exception.
                return
        except Exception as e:
            return
        log_path = os.path.join(log_dir, 'nuclide-jedi.log')
        handler = FileHandler(log_path)
        handler.setFormatter(logging.Formatter(
            'nuclide-jedi-py %(asctime)s: [%(name)s] %(message)s'
        ))
        self.logger.addHandler(handler)
        self.logger.setLevel(logging.INFO)

    def process_request(self, line):
        start_time = time.time()

        req = json.loads(line)
        id, data = req['id'], req['args']
        method = req['method']
        res = {'protocol': 'python_language_service', 'type': 'response', 'id': id}

        try:
            if method == 'get_completions':
                res['result'] = self.get_completions(self.make_script(data))
            elif method == 'get_definitions':
                res['result'] = self.get_definitions(self.make_script(data))
            elif method == 'get_references':
                res['result'] = self.get_references(self.make_script(data))
            elif method == 'get_outline':
                res['result'] = outline.get_outline(data['src'], data['contents'])
            elif method == 'get_hover':
                res['result'] = self.get_hover(self.make_script(data), data['word'])
            elif method == 'get_signature_help':
                res['result'] = self.get_signature_help(self.make_script(data))
            else:
                res['type'] = 'error-response'
                res['error'] = 'Unknown method to jediserver.py: %s.' % method
        # Catch and ignore KeyErrors from jedi
        # See https://github.com/davidhalter/jedi/issues/590
        except KeyError as e:
            self.logger.warn('Got KeyError exception %s', e)
            res['result'] = None
        except Exception:
            res['type'] = 'error-response'
            res['error'] = traceback.format_exc()

        self.logger.info('Finished %s request for %s in %.2lf seconds.',
                         method, data.get('src'), time.time() - start_time)
        return res

    def make_script(self, req_data):
        src = req_data['src']
        sys_path = (
            self.get_filtered_sys_path(src) +
            self.additional_paths +
            # While non-existent paths don't cause any harm,
            # paths may sometimes not exist but then be built after.
            # Doing so should invalidate Jedi's cache.
            list(filter(os.path.exists, req_data['sysPath']))
        )
        return jedi.api.Script(
            source=req_data['contents'], line=req_data['line'] + 1,
            column=req_data['column'], path=src,
            sys_path=sys_path)

    def is_func_or_class(self, completion):
        return completion.type == 'function' or completion.type == 'class'

    def get_description(self, completion):
        description = completion.docstring()
        # If docstring is not available, attempt to generate a function signature
        # with params.
        if description == '' and self.is_func_or_class(completion):
            params = self._get_params(completion)
            if params is not None:
                description = '%s(%s)' % (
                    completion.name,
                    ', '.join(self._get_params(completion))
                )
        return description

    def get_completions(self, script):
        results = []
        completions = script.completions()
        for completion in completions:
            result = {
                'type': completion.type,
                'text': completion.name,
                'description': self.get_description(completion),
            }
            # Return params if completion has params (thus is a class/function).
            # Don't autocomplete params in the middle of an import from statement.
            if self.is_func_or_class(completion):
                statement = jedi.parser_utils.get_statement_of_position(
                    script._get_module_node(), script._pos)
                if not isinstance(statement, ImportFrom):
                    result['params'] = self._get_params(completion)

            results.append(result)
        return results

    def _get_params(self, completion):
        try:
            names = [p.name for p in completion.params]
            # Ignore args/kwargs/varargs.
            return list(filter(
                lambda x: x != '...' and x != 'args' and x != 'kwargs',
                names,
            ))
        except Exception:
            # ".params" appears to be quite flaky.
            # e.g: https://github.com/davidhalter/jedi/issues/1031
            return None

    def get_definitions(self, script):
        results = []
        definitions = script.goto_assignments(True)

        for definition in definitions:
            if not definition.module_path:
                continue
            result = self.serialize_definition(definition)
            results.append(result)
        return results

    def get_references(self, script):
        results = []
        references = script.usages()

        for ref in references:
            if not ref.module_path:
                continue
            result = self.serialize_definition(ref)
            parent = self.get_significant_parent(ref)
            if parent is not None:
                result['parentName'] = parent.name
            results.append(result)
        return results

    # It'd be nice if this could return the actual types.
    # As the next best thing, displaying method/class docblocks is pretty useful.
    def get_hover(self, script, word):
        # Jedi is loose with definitions when > 1 is possible (e.g: os.path).
        # For the purposes of hovering, only allow exact matches.
        definitions = [d for d in script.goto_definitions() if d.name == word]
        if not definitions:
            return None

        docstring = definitions[0].docstring()
        # The return value will be interpreted as Markdown.
        # Make some adjustments for better Markdown formatting.
        docstring = docstring.replace('\t', ' ' * 4)
        docstring = docstring.replace('*', '\\*')
        return docstring

    def get_signature_help(self, script):
        # Loosely adapted from:
        # https://github.com/palantir/python-language-server/blob/develop/pyls/plugins/signature.py
        signatures = script.call_signatures()
        if not signatures:
            return None

        leaf = script._get_module_node().get_leaf_for_position(script._pos)
        # Don't return signatures inside string literals.
        if leaf and leaf.type == 'string':
            return None

        # Python shouldn't ever have multiple signatures
        s = signatures[0]
        docstring = s.docstring()
        raw_docstring = s.docstring(raw=True)
        # In most cases Jedi prepends the function signature to the non-raw docstring.
        # But this isn't always the case for some builtins, like isinstance.
        if docstring != raw_docstring:
            label = docstring[:len(docstring)-len(raw_docstring)].rstrip()
        else:
            params = ', '.join(map(lambda x: x.name, s.params))
            label = s.name + '(' + params + ')'
        sig = {
            # Jedi always prepends the signature to the docstring
            'label': label,
            'documentation': raw_docstring,
        }

        # If there are params, add those
        if s.params:
            sig['parameters'] = [{
                'label': p.name,
                'documentation': p.docstring(),
            } for p in s.params]

        sig_info = {'signatures': [sig], 'activeSignature': 0}
        if s.index is not None and s.params:
            sig_info['activeParameter'] = s.index
        return sig_info

    def serialize_definition(self, definition):
        return {
            'text': definition.name,
            'type': definition.type,
            'file': os.path.realpath(definition.module_path),
            'line': definition.line - 1,
            'column': definition.column
        }

    def get_significant_parent(self, definition):
        curr = definition
        while curr is not None \
                and curr.type != 'module' \
                and curr.parent() is not None:
            curr = curr.parent()
            if curr.type == 'function' or curr.type == 'class':
                return curr
        return None


if __name__ == '__main__':
    parser = ArgumentParser()
    parser.add_argument('-p', '--paths', dest='paths', default=[], type=str, nargs='+',
                        help='Additional Python module resolution paths.')
    args = parser.parse_args()

    # By default, Jedi uses ~/.cache or similar.
    # Let's use a temporary directory instead so it doesn't grow forever.
    jedi.settings.cache_directory = os.path.join(
        tempfile.gettempdir(),
        'jedi-cache-%s' % getpass.getuser(),
    )
    JediServer(args.paths).run()
