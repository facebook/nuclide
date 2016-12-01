'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import {Point} from 'atom';
import invariant from 'assert';

import nuclideUri from '../../commons-node/nuclideUri';

import FlowAutocompleteProvider, {
  groupParamNames,
} from '../lib/FlowAutocompleteProvider';

const FIXTURE_PATH = nuclideUri.join(__dirname, 'fixtures/fixture.js');

describe('FlowAutocompleteProvider', () => {
  let flowAutocompleteProvider: FlowAutocompleteProvider = (null: any);

  beforeEach(() => {
    flowAutocompleteProvider = new FlowAutocompleteProvider();
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

  describe('flowGetAutocompleteSuggestions', () => {
    let prefix: string = (null: any);
    let optionNames: Array<string> = (null: any);
    let options: any;
    let activatedManually: boolean = (undefined: any);

    let editor: atom$TextEditor = (null: any);

    beforeEach(() => {
      waitsForPromise(async () => {
        prefix = '';
        activatedManually = false;
        optionNames = [
          'Foo',
          'foo',
          'Bar',
          'BigLongNameOne',
          'BigLongNameTwo',
        ];
        options = optionNames.map(name => ({name, type: 'foo'}));

        // The contents don't matter since we are mocking the results returned from Flow, but
        // autocomplete is disabled on files without a path, so we need to use some path.
        editor = await atom.workspace.open(FIXTURE_PATH);
        spyOn(require('../lib/FlowServiceFactory'), 'getFlowServiceByNuclideUri').andCallFake(
          () => {
            return {
              flowGetAutocompleteSuggestions: () => Promise.resolve(options),
            };
          },
        );
      });
    });

    afterEach(() => {
      jasmine.unspy(require('../lib/FlowServiceFactory'), 'getFlowServiceByNuclideUri');
    });
    function run(_: void) {
      return flowAutocompleteProvider.getSuggestions({
        editor,
        bufferPosition: new Point(0, 0),
        prefix,
        activatedManually,
        scopeDescriptor: '.source.js',
      });
    }

    async function getNameArray(): Promise<Array<?string>> {
      const suggestions = await run();
      if (suggestions == null) {
        return [];
      }
      return suggestions.map(item => item.text);
    }

    async function getNameSet(): Promise<Set<string>> {
      return new Set(await getNameArray());
    }

    function hasEqualElements(set1: Set<string>, set2: Set<string>): boolean {
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
        expect(hasEqualElements(await getNameSet(options), new Set())).toBe(true);
      });
    });

    it('should always provide suggestions when activated manually', () => {
      activatedManually = true;
      waitsForPromise(async () => {
        expect(hasEqualElements(await getNameSet(options), new Set(optionNames))).toBe(true);
      });
    });

    it('should always provide suggestions when the prefix contains .', () => {
      prefix = '   .   ';
      waitsForPromise(async () => {
        expect(hasEqualElements(await getNameSet(options), new Set(optionNames))).toBe(true);
      });
    });

    it('should not filter suggestions if the prefix is a .', () => {
      waitsForPromise(async () => {
        prefix = '.';
        expect(hasEqualElements(await getNameSet(options), new Set(optionNames))).toBe(true);
      });
    });

    it('should filter suggestions by the prefix', () => {
      waitsForPromise(async () => {
        prefix = 'bln';
        expect(
          hasEqualElements(
            await getNameSet(options),
            new Set(['BigLongNameOne', 'BigLongNameTwo']),
          ),
        ).toBe(true);
      });
    });

    it('should rank better matches higher', () => {
      waitsForPromise(async () => {
        prefix = 'one';
        const nameArray = await getNameArray(options);
        expect(nameArray[0]).toEqual('BigLongNameOne');
      });
    });

    it('should expose extra information about a function', () => {
      prefix = 'f';
      waitsForPromise(async () => {
        options = [
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
        const result = await run();
        invariant(result != null);
        const fooResult = result[0];
        expect(fooResult.displayText).toEqual('foo');
        expect(fooResult.snippet).toEqual('foo(${1:param1}, ${2:param2})');
        expect(fooResult.type).toEqual('function');
        expect(fooResult.leftLabel).toEqual('ret');
        expect(fooResult.rightLabel).toEqual('(param1: type1, param2: type2)');
      });
    });
  });
});
