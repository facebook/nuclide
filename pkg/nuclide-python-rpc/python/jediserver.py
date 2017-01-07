# Copyright (c) 2015-present, Facebook, Inc.
# All rights reserved.
#
# This source code is licensed under the license found in the LICENSE file in
# the root directory of this source tree.

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
from jedi.evaluate.representation import InstanceElement
from jedi.parser.tree import ImportFrom
import outline

LOGGING_DIR = 'nuclide-%s-logs/python' % getpass.getuser()
LIB_DIR = os.path.abspath('../VendorLib')
WORKING_DIR = os.getcwd()


class JediServer:

    def __init__(self, src, paths):
        self.src = src
        self.sys_path = self.get_filtered_sys_path() + paths
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

    def get_filtered_sys_path(self):
        # Retrieves the sys.path with VendorLib filtered out, so symbols from
        # jedi don't appear in user's autocompletions or hyperclicks.
        # Don't filter out VendorLib if we're working in the jediserver's dir. :)
        return [path for path in sys.path
                if (path != LIB_DIR and path != WORKING_DIR) or
                self.src.startswith(WORKING_DIR)]

    def generate_log_name(self, value):
        hash = hashlib.md5(value.encode('utf-8')).hexdigest()[:10]
        return os.path.basename(value) + '-' + hash + '.log'

    def init_logging(self):
        # Be consistent with the main Nuclide logs.
        log_dir = os.path.join(tempfile.gettempdir(), LOGGING_DIR)
        if not os.path.exists(log_dir):
            os.makedirs(log_dir)
        handler = FileHandler(os.path.join(log_dir, self.generate_log_name(self.src)))
        handler.setFormatter(logging.Formatter(
            'nuclide-jedi-py %(asctime)s: [%(name)s] %(message)s'
        ))
        self.logger.addHandler(handler)
        self.logger.setLevel(logging.INFO)
        self.logger.info('starting for ' + self.src)

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
                res['result'] = outline.get_outline(self.src, data['contents'])
            # Allow deferred injection of additional paths
            elif method == 'add_paths':
                self.sys_path = self.sys_path + data['paths']
                res['result'] = self.sys_path
            else:
                res['type'] = 'error-response'
                res['error'] = 'Unknown method to jediserver.py: %s.' % method
        # Catch and ignore KeyErrors from jedi
        # See https://github.com/davidhalter/jedi/issues/590
        except KeyError:
            res['result'] = []
        except:
            res['type'] = 'error-response'
            res['error'] = traceback.format_exc()

        self.logger.info('Finished %s request in %.2lf seconds.',
                         method, time.time() - start_time)
        return res

    def make_script(self, req_data):
        return jedi.api.Script(
            source=req_data['contents'], line=req_data['line'] + 1,
            column=req_data['column'], path=self.src,
            sys_path=self.sys_path)

    def is_func_or_class(self, completion):
        return completion.type == 'function' or completion.type == 'class'

    def get_description(self, completion):
        description = completion.docstring()
        # If docstring is not available, attempt to generate a function signature
        # with params.
        if description == '' and self.is_func_or_class(completion):
            description = '%s(%s)' % (
                completion.name,
                ', '.join(p.description for p in completion.params)
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
            if self.is_func_or_class(completion) and not isinstance(
                    script._parser.user_stmt(), ImportFrom):
                result['params'] = [p.description for p in completion.params]

            # Check for decorators on functions.
            if completion.type == 'function' and not completion.in_builtin_module():
                definition = completion._name.get_definition()
                if isinstance(definition, InstanceElement):
                    for decorator in definition.base_func.get_decorators():
                        if str(decorator.children[1]) == 'property':
                            del result['params']
                            result['type'] = 'property'
                            break
            results.append(result)
        return results

    def follow_imports(self, definition):
        # Iteratively follow a definition until a non-import definition is found.
        result = definition
        while result.type == 'import':
            for assignment in definition.goto_assignments():
                if assignment != result and assignment.module_path:
                    result = assignment
                    break
            # Break out of while if no new result was found.
            else:
                break

        return result

    def get_definitions(self, script):
        results = []
        definitions = script.goto_assignments()

        for definition in definitions:
            if not definition.module_path:
                continue
            result = self.serialize_definition(self.follow_imports(definition))
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
    parser.add_argument('-s', '--source', dest='src', default='', type=str)
    parser.add_argument('-p', '--paths', dest='paths', default=[], type=str, nargs='+')
    args = parser.parse_args()

    JediServer(args.src, args.paths).run()
