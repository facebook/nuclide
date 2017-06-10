/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow
 * @format
 */

import invariant from 'assert';
import fs from 'fs';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {addMatchers} from '../../nuclide-test-helpers';

import ClangServer from '../lib/ClangServer';
import findClangServerArgs from '../lib/find-clang-server-args';

const TEST_FILE = nuclideUri.join(__dirname, 'fixtures', 'outline.cpp');
const FILE_CONTENTS = fs.readFileSync(TEST_FILE, 'utf8');

describe('ClangServer', () => {
  beforeEach(function() {
    addMatchers(this);
  });

  it('can return outline data', () => {
    waitsForPromise(async () => {
      const serverArgs = findClangServerArgs();
      const server = new ClangServer(
        TEST_FILE,
        FILE_CONTENTS,
        serverArgs,
        Promise.resolve({
          flags: ['-x', 'c++'],
          usesDefaultFlags: false,
          flagsFile: null,
        }),
      );
      const service = await server.getService();
      const response = await service.get_outline(FILE_CONTENTS);
      invariant(response != null);
      expect(response).diffJson([
        {
          extent: {
            start: {
              column: 0,
              row: 0,
            },
            end: {
              column: 14,
              row: 0,
            },
          },
          cursor_kind: 'VAR_DECL',
          name: 'global_var',
          cursor_type: 'int',
        },
        {
          cursor_kind: 'NAMESPACE',
          name: 'test_namespace',
          extent: {
            start: {
              column: 0,
              row: 2,
            },
            end: {
              column: 1,
              row: 9,
            },
          },
          children: [
            {
              cursor_kind: 'NAMESPACE',
              name: '',
              extent: {
                start: {
                  column: 0,
                  row: 3,
                },
                end: {
                  column: 1,
                  row: 8,
                },
              },
              children: [
                {
                  cursor_kind: 'PRAGMA_MARK',
                  name: 'before function',
                  extent: {
                    start: {
                      column: 0,
                      row: 4,
                    },
                    end: {
                      column: 0,
                      row: 5,
                    },
                  },
                },
                {
                  cursor_kind: 'FUNCTION_DECL',
                  name: 'function',
                  extent: {
                    start: {
                      column: 0,
                      row: 5,
                    },
                    end: {
                      column: 1,
                      row: 6,
                    },
                  },
                  params: ['const int', 'param'],
                  tparams: [],
                },
                {
                  cursor_kind: 'PRAGMA_MARK',
                  name: 'after function',
                  extent: {
                    start: {
                      column: 0,
                      row: 7,
                    },
                    end: {
                      column: 0,
                      row: 8,
                    },
                  },
                },
              ],
            },
          ],
        },
        {
          cursor_kind: 'FUNCTION_TEMPLATE',
          name: 'templated_function',
          extent: {
            start: {
              column: 0,
              row: 11,
            },
            end: {
              column: 1,
              row: 14,
            },
          },
          params: ['x'],
          tparams: ['T'],
        },
        {
          cursor_kind: 'CLASS_DECL',
          name: 'TestClass',
          extent: {
            start: {
              column: 0,
              row: 16,
            },
            end: {
              column: 1,
              row: 23,
            },
          },
          children: [
            {
              cursor_kind: 'FUNCTION_TEMPLATE',
              name: 'method',
              extent: {
                start: {
                  column: 2,
                  row: 17,
                },
                end: {
                  column: 3,
                  row: 19,
                },
              },
              params: ['param'],
              tparams: ['T'],
            },
            {
              cursor_kind: 'PRAGMA_MARK',
              name: 'inside TestClass',
              extent: {
                start: {
                  column: 0,
                  row: 20,
                },
                end: {
                  column: 0,
                  row: 21,
                },
              },
            },
            {
              cursor_kind: 'CXX_METHOD',
              name: 'partialMethod',
              extent: {
                start: {
                  column: 2,
                  row: 21,
                },
                end: {
                  column: 22,
                  row: 21,
                },
              },
              params: [],
              tparams: [],
            },
            {
              extent: {
                start: {
                  column: 2,
                  row: 22,
                },
                end: {
                  column: 23,
                  row: 22,
                },
              },
              cursor_kind: 'VAR_DECL',
              name: 'partialVar',
              cursor_type: 'int',
            },
          ],
        },
        {
          extent: {
            start: {
              column: 0,
              row: 25,
            },
            end: {
              column: 25,
              row: 25,
            },
          },
          cursor_kind: 'VAR_DECL',
          name: 'TestClass::partialVar',
          cursor_type: 'int',
        },
        {
          cursor_kind: 'CXX_METHOD',
          name: 'TestClass::partialMethod',
          extent: {
            start: {
              column: 0,
              row: 27,
            },
            end: {
              column: 1,
              row: 28,
            },
          },
          params: [],
          tparams: [],
        },
        {
          cursor_kind: 'PRAGMA_MARK',
          name: 'Section 2',
          extent: {
            start: {
              column: 0,
              row: 29,
            },
            end: {
              column: 0,
              row: 30,
            },
          },
        },
        {
          cursor_kind: 'CLASS_TEMPLATE',
          name: 'TemplateClass<Ty>',
          extent: {
            start: {
              column: 0,
              row: 30,
            },
            end: {
              column: 1,
              row: 32,
            },
          },
          children: [],
        },
        {
          cursor_kind: 'ENUM_DECL',
          name: 'TestEnum',
          extent: {
            start: {
              column: 0,
              row: 34,
            },
            end: {
              column: 1,
              row: 37,
            },
          },
          children: [
            {
              cursor_kind: 'ENUM_CONSTANT_DECL',
              name: 'ENUM_VALUE_1',
              extent: {
                start: {
                  column: 2,
                  row: 35,
                },
                end: {
                  column: 14,
                  row: 35,
                },
              },
            },
            {
              cursor_kind: 'ENUM_CONSTANT_DECL',
              name: 'ENUM_VALUE_2',
              extent: {
                start: {
                  column: 2,
                  row: 36,
                },
                end: {
                  column: 14,
                  row: 36,
                },
              },
            },
          ],
        },
        {
          cursor_kind: 'MACRO_INSTANTIATION',
          extent: {
            end: {
              column: 16,
              row: 41,
            },
            start: {
              column: 0,
              row: 41,
            },
          },
          name: 'TEST_F',
          params: ['a', 'b'],
        },
        {
          cursor_kind: 'PRAGMA_MARK',
          name: 'end of file',
          extent: {
            start: {
              column: 0,
              row: 43,
            },
            end: {
              column: 0,
              row: 44,
            },
          },
        },
      ]);
    });
  });
});
