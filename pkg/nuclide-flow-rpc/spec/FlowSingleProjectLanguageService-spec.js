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

import type {FileDiagnosticMessages} from 'atom-ide-ui';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';

import type {
  FlowSingleProjectLanguageService as FlowSingleProjectLanguageServiceType,
  DiagnosticsState,
} from '../lib/FlowSingleProjectLanguageService';
import type {PushDiagnosticsMessage} from '../lib/FlowIDEConnection';
import type {FlowStatusOutput, FlowStatusError} from '../lib/flowOutputTypes';

import SimpleTextBuffer, {Point, Range} from 'simple-text-buffer';
import invariant from 'assert';

import {
  FlowSingleProjectLanguageService,
  groupParamNames,
  emptyDiagnosticsState,
  updateDiagnostics,
  getDiagnosticUpdates,
} from '../lib/FlowSingleProjectLanguageService';
import {FlowExecInfoContainer} from '../lib/FlowExecInfoContainer';
import {addMatchers} from '../../nuclide-test-helpers';

describe('FlowSingleProjectLanguageService', () => {
  beforeEach(function() {
    addMatchers(this);
  });

  const file = '/path/to/test.js';
  const root = '/path/to';
  const currentContents = '/* @flow */\nvar x = "this_is_a_string"\nvar y;';

  let line = (null: any);
  let column = (null: any);
  let buffer: simpleTextBuffer$TextBuffer = (null: any);
  let flowRoot: FlowSingleProjectLanguageServiceType = (null: any);

  let fakeExecFlow: any;

  function newFlowService() {
    return new FlowSingleProjectLanguageService(
      root,
      new FlowExecInfoContainer(),
      (null: any) /* File Cache */,
    );
  }

  beforeEach(() => {
    buffer = new SimpleTextBuffer(currentContents);
    line = 2;
    column = 12;
    flowRoot = newFlowService();
    spyOn(flowRoot._process, 'execFlow').andCallFake(() => fakeExecFlow());
  });

  function mockExec(outputString) {
    fakeExecFlow = () => ({stdout: outputString, exitCode: 0});
  }

  describe('getDefinition', () => {
    function runWith(location) {
      mockExec(JSON.stringify(location));
      return flowRoot.getDefinition(file, buffer, new Point(line, column));
    }

    it('should return the location', () => {
      waitsForPromise(async () => {
        line = 2;
        column = 4;
        // Flow uses 1-based indexing, Atom uses 0-based.
        const result = await runWith({path: file, line: 5, start: 8});
        invariant(result != null);
        expect(result.definitions[0]).toEqual({
          path: file,
          position: new Point(4, 7),
          language: 'Flow',
        });
      });
    });

    it('should return null if no location is found', () => {
      waitsForPromise(async () => {
        line = 2;
        column = 4;
        expect(await runWith({})).toBe(null);
        expect(flowRoot._process.execFlow).toHaveBeenCalled();
      });
    });
  });

  describe('getDiagnostics', () => {
    function runWith(errors, filePath) {
      mockExec(JSON.stringify({errors}));
      return flowRoot.getDiagnostics(filePath, buffer);
    }

    it('should call flow status', () => {
      waitsForPromise(async () => {
        await runWith([], file);
        const flowArgs = flowRoot._process.execFlow.mostRecentCall.args[0];
        expect(flowArgs[0]).toBe('status');
      });
    });
  });

  describe('flowGetType', () => {
    function runWithString(outputString) {
      mockExec(outputString);
      return flowRoot.typeHint(file, buffer, new Point(line, column));
    }
    function runWith(
      outputType: ?string,
      startLine: number,
      startCol: number,
      endLine: number,
      endCol: number,
    ) {
      return runWithString(
        JSON.stringify({
          type: outputType,
          loc: {
            start: {
              line: startLine,
              column: startCol,
            },
            end: {
              line: endLine,
              column: endCol,
            },
          },
        }),
      );
    }

    it('should return the type on success', () => {
      waitsForPromise(async () => {
        expect(await runWith('thisIsAType', 1, 1, 1, 4)).diffJson({
          hint: 'thisIsAType',
          range: new Range([0, 0], [0, 4]),
        });
      });
    });

    it('should return null if the type is unknown', () => {
      waitsForPromise(async () => {
        expect(await runWith('(unknown)', 1, 1, 1, 4)).toBe(null);
      });
    });

    it('should return null if the type is empty', () => {
      waitsForPromise(async () => {
        expect(await runWith('', 1, 1, 1, 4)).toBe(null);
      });
    });

    it('should return null on failure', () => {
      waitsForPromise(async () => {
        expect(await runWithString('invalid json')).toBe(null);
      });
    });

    it('should return null if the flow process fails', () => {
      waitsForPromise(async () => {
        fakeExecFlow = () => {
          throw new Error('error');
        };
        // this causes some errors to get logged, but I don't think it's a big
        // deal and I don't know how to mock a module
        expect(
          await flowRoot.typeHint(file, buffer, new Point(line, column)),
        ).toBe(null);
      });
    });
  });

  describe('getAutocompleteSuggestions', () => {
    let prefix: string = (null: any);
    let resultNames: Array<string> = (null: any);
    let result: Array<Object>;
    let activatedManually: boolean = (undefined: any);

    beforeEach(() => {
      waitsForPromise(async () => {
        prefix = '';
        activatedManually = false;
        resultNames = ['Foo', 'foo', 'Bar', 'BigLongNameOne', 'BigLongNameTwo'];
        result = resultNames.map(name => ({name, type: 'foo'}));
      });
    });

    function run() {
      mockExec(JSON.stringify({result}));
      return flowRoot.getAutocompleteSuggestions(
        file,
        buffer,
        new Point(line, column),
        activatedManually,
        prefix,
      );
    }

    async function getNameArray(_: void): Promise<Array<?string>> {
      const suggestions = await run();
      if (suggestions == null) {
        return [];
      }
      return suggestions.items.map(item => item.text);
    }

    async function getNameSet(_: void): Promise<Set<?string>> {
      return new Set(await getNameArray());
    }

    function hasEqualElements(set1: Set<?string>, set2: Set<?string>): boolean {
      if (set1.size !== set2.size) {
        return false;
      }
      for (const item of set1) {
        if (!set2.has(item)) {
          return false;
        }
      }
      return true;
    }

    it('should not provide suggestions when no characters have been typed', () => {
      waitsForPromise(async () => {
        expect(hasEqualElements(await getNameSet(), new Set())).toBe(true);
      });
    });

    it('should always provide suggestions when activated manually', () => {
      activatedManually = true;
      waitsForPromise(async () => {
        expect(hasEqualElements(await getNameSet(), new Set(resultNames))).toBe(
          true,
        );
      });
    });

    it('should always provide suggestions when the prefix contains .', () => {
      prefix = '   .   ';
      waitsForPromise(async () => {
        expect(hasEqualElements(await getNameSet(), new Set(resultNames))).toBe(
          true,
        );
      });
    });

    it('should expose extra information about a function', () => {
      prefix = 'f';
      waitsForPromise(async () => {
        result = [
          {
            name: 'foo',
            type: '(param1: type1, param2: type2) => ret',
            func_details: {
              params: [
                {name: 'param1', type: 'type1'},
                {name: 'param2', type: 'type2'},
              ],
              return_type: 'ret',
            },
          },
        ];
        const results = await run();
        invariant(results != null);
        const fooResult = results.items[0];
        expect(fooResult.displayText).toEqual('foo');
        expect(fooResult.snippet).toEqual('foo(${1:param1}, ${2:param2})');
        expect(fooResult.type).toEqual('function');
        expect(fooResult.leftLabel).toEqual('ret');
        expect(fooResult.rightLabel).toEqual('(param1: type1, param2: type2)');
      });
    });
  });

  describe('groupParamNames', () => {
    it('should return a group for each argument', () => {
      const args = ['arg1', 'arg2'];
      expect(groupParamNames(args)).toEqual(args.map(arg => [arg]));
    });

    it('should group optional params', () => {
      const args = ['arg1', 'arg2?'];
      expect(groupParamNames(args)).toEqual([args]);
    });

    it('should only group optional params at the end', () => {
      // I have no idea why you are even allowed to have optional params in the middle, but I guess
      // we have to deal with it.
      const args = ['arg1', 'arg2?', 'arg3', 'arg4?'];
      const expectedGrouping = [['arg1'], ['arg2?'], ['arg3', 'arg4?']];
      expect(groupParamNames(args)).toEqual(expectedGrouping);
    });

    it('should group all params if they are all optional', () => {
      const args = ['arg1?', 'arg2?'];
      expect(groupParamNames(args)).toEqual([args]);
    });

    it('should return an empty array for no arguments', () => {
      expect(groupParamNames([])).toEqual([]);
    });
  });
});

// FYI, the order of the expected messages within the nested array is arbitrary, but deterministic.
// However, using arrays makes it easy to compare output using diffJson. It would make sense to
// switch to Sets as long as diffJson (or similar) is extended to compare Sets structurally.
describe('push diagnostics collation', () => {
  beforeEach(function() {
    addMatchers(this);
  });

  it('should clear all previous errors upon each message if we are not in a recheck', () => {
    waitsForPromise(async () => {
      const messages = [
        {
          kind: 'errors',
          errors: makeFakeFlowOutput(
            makeFakeFlowError('bar', '/path1'),
            makeFakeFlowError('foo', '/path1'),
          ),
        },
        {
          kind: 'errors',
          errors: makeFakeFlowOutput(),
        },
      ];
      const expected: Array<Array<AbbreviatedResult>> = [
        [],
        [
          {
            filePath: '/path1',
            messages: [['bar', false], ['foo', false]],
          },
        ],
        [{filePath: '/path1', messages: []}],
      ];
      const results = await getAbbreviatedResults(messages);
      expect(results).diffJson(expected);
    });
  });

  it('should accumulate errors during a recheck', () => {
    waitsForPromise(async () => {
      const messages = [
        {
          kind: 'errors',
          errors: makeFakeFlowOutput(
            makeFakeFlowError('foo', '/path1'),
            makeFakeFlowError('bar', '/path2'),
          ),
        },
        {kind: 'start-recheck'},
        {
          kind: 'errors',
          errors: makeFakeFlowOutput(makeFakeFlowError('new', '/path1')),
        },
        {
          kind: 'errors',
          errors: makeFakeFlowOutput(makeFakeFlowError('asdf', '/path3')),
        },
        {kind: 'end-recheck'},
        {
          kind: 'errors',
          errors: makeFakeFlowOutput(
            makeFakeFlowError('another new', '/path2'),
            makeFakeFlowError('asdf', '/path3'),
          ),
        },
      ];
      const expected: Array<Array<AbbreviatedResult>> = [
        [],
        [
          {filePath: '/path1', messages: [['foo', false]]},
          {filePath: '/path2', messages: [['bar', false]]},
        ],
        [
          {filePath: '/path1', messages: [['foo', true]]},
          {filePath: '/path2', messages: [['bar', true]]},
        ],
        [{filePath: '/path1', messages: [['foo', true], ['new', false]]}],
        [{filePath: '/path3', messages: [['asdf', false]]}],
        [
          {filePath: '/path1', messages: [['new', false]]},
          {filePath: '/path2', messages: []},
        ],
        [
          // 'new' is not included here since this message came after the 'end-recheck' message.
          // Because of that, it is considered to be a complete set of errors.
          {filePath: '/path2', messages: [['another new', false]]},
          {filePath: '/path3', messages: [['asdf', false]]},
          {filePath: '/path1', messages: []},
        ],
      ];
      const results = await getAbbreviatedResults(messages);
      expect(results).diffJson(expected);
    });
  });

  it('should remove all diagnostics when the IDE connection is lost outside of a recheck', () => {
    waitsForPromise(async () => {
      const messages = [
        {
          kind: 'errors',
          errors: makeFakeFlowOutput(
            makeFakeFlowError('foo', '/path1'),
            makeFakeFlowError('bar', '/path2'),
          ),
        },
        null,
      ];
      const expected: Array<Array<AbbreviatedResult>> = [
        [],
        [
          {filePath: '/path1', messages: [['foo', false]]},
          {filePath: '/path2', messages: [['bar', false]]},
        ],
        [
          {filePath: '/path1', messages: []},
          {filePath: '/path2', messages: []},
        ],
      ];
      const results = await getAbbreviatedResults(messages);
      expect(results).diffJson(expected);
    });
  });

  it('should remove all diagnostics when the IDE connection is lost during a recheck', () => {
    waitsForPromise(async () => {
      const messages = [
        {
          kind: 'errors',
          errors: makeFakeFlowOutput(
            makeFakeFlowError('foo', '/path1'),
            makeFakeFlowError('bar', '/path2'),
          ),
        },
        {kind: 'start-recheck'},
        {
          kind: 'errors',
          errors: makeFakeFlowOutput(
            makeFakeFlowError('baz', '/path1'),
            makeFakeFlowError('asdf', '/path3'),
          ),
        },
        null,
      ];
      const expected: Array<Array<AbbreviatedResult>> = [
        [],
        [
          {filePath: '/path1', messages: [['foo', false]]},
          {filePath: '/path2', messages: [['bar', false]]},
        ],
        [
          {filePath: '/path1', messages: [['foo', true]]},
          {filePath: '/path2', messages: [['bar', true]]},
        ],
        [
          {filePath: '/path1', messages: [['foo', true], ['baz', false]]},
          {filePath: '/path3', messages: [['asdf', false]]},
        ],
        [
          {filePath: '/path1', messages: []},
          {filePath: '/path2', messages: []},
          {filePath: '/path3', messages: []},
        ],
      ];
      const results = await getAbbreviatedResults(messages);
      expect(results).diffJson(expected);
    });
  });
});

// For simpler comparison in tests. Other tests make sure that messages are properly transformed,
// here we just need to make sure they are properly collated.
type AbbreviatedResult = {
  filePath: NuclideUri,
  // message, stale
  messages: Array<[?string, boolean]>,
};

async function getAbbreviatedResults(
  messages: Array<?PushDiagnosticsMessage>,
): Promise<Array<Array<AbbreviatedResult>>> {
  const results: Array<Array<FileDiagnosticMessages>> = [];
  let state: DiagnosticsState = emptyDiagnosticsState();
  results.push(await getDiagnosticUpdates(state).toPromise());
  for (const message of messages) {
    state = updateDiagnostics(state, message);
    results.push(
      await getDiagnosticUpdates(state).toPromise(), // eslint-disable-line no-await-in-loop
    );
  }
  return results.map(inner => {
    return inner.map(result => {
      return {
        filePath: result.filePath,
        messages: result.messages.map(msg => [msg.text, Boolean(msg.stale)]),
      };
    });
  });
}

function makeFakeFlowOutput(
  ...errors: Array<FlowStatusError>
): FlowStatusOutput {
  return {
    passed: errors.length === 0,
    flowVersion: '0.44.1',
    errors,
  };
}

function makeFakeFlowError(text: string, file: NuclideUri): FlowStatusError {
  return {
    level: 'error',
    kind: 'infer',
    message: [
      {
        descr: text,
        loc: {
          source: file,
          start: {
            line: 1,
            column: 1,
          },
          end: {
            line: 1,
            column: 4,
          },
        },
      },
    ],
  };
}
