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

import type {CtagsResult} from '../../nuclide-ctags-rpc';

import invariant from 'assert';
import ReactDOM from 'react-dom';
import TestUtils from 'react-addons-test-utils';
// eslint-disable-next-line nuclide-internal/no-cross-atom-imports
import * as hackService from '../../nuclide-hack/lib/HackLanguage';
import QuickOpenHelpers from '../lib/QuickOpenHelpers';

const TEST_DIR = '/test';

describe('QuickOpenHelpers', () => {
  const mockDirectory: atom$Directory = ({
    getPath: () => TEST_DIR,
  }: any);

  beforeEach(() => {
    // eslint-disable-next-line nuclide-internal/no-cross-atom-imports
    spyOn(require('../../nuclide-hack/lib/config'), 'getConfig').andReturn({
      hhClientPath: 'hh_client',
      logLevel: 'OFF',
    });
    spyOn(
      require('../../nuclide-remote-connection'),
      'getServiceByNuclideUri',
    ).andReturn({
      async getCtagsService() {
        return {
          async findTags(path, query): Promise<Array<CtagsResult>> {
            return [
              {
                name: 'A',
                file: '/path1/a',
                lineNumber: 1,
                kind: 'c',
                pattern: '/^class A$/',
              },
              {
                name: 'test::A',
                file: '/test/a',
                lineNumber: 2,
                kind: '',
                pattern: '/^struct A$/',
              },
            ];
          },
          dispose() {},
        };
      },
    });
    spyOn(hackService, 'isFileInHackProject').andReturn(false);
  });

  it('it activates for valid directories', () => {
    waitsForPromise(async () => {
      const {isEligibleForDirectory} = QuickOpenHelpers;
      invariant(isEligibleForDirectory);
      expect(await isEligibleForDirectory(mockDirectory)).toBe(true);
    });
  });

  it('is able to return and render tag results', () => {
    waitsForPromise(async () => {
      const {executeQuery, getComponentForItem} = QuickOpenHelpers;
      let results = await executeQuery('', mockDirectory);
      expect(results).toEqual([]);

      results = await executeQuery('test', mockDirectory);
      expect(
        results.map(result => {
          // Functions can't be compared with Jasmine.
          const {callback, ...rest} = result;
          expect(callback).not.toBe(null);
          return rest;
        }),
      ).toEqual([
        {
          name: 'A',
          file: '/path1/a',
          lineNumber: 1,
          kind: 'c',
          pattern: '/^class A$/',
          path: '/path1/a',
          dir: TEST_DIR,
        },
        {
          name: 'test::A',
          file: '/test/a',
          lineNumber: 2,
          kind: '',
          pattern: '/^struct A$/',
          path: '/test/a',
          dir: TEST_DIR,
        },
      ]);

      invariant(getComponentForItem);
      const reactElement = getComponentForItem(results[0]);
      expect(reactElement.props.title).toBe('class');
      const renderedComponent = TestUtils.renderIntoDocument(reactElement);
      const renderedNode = ReactDOM.findDOMNode(renderedComponent);

      expect(
        // $FlowFixMe
        renderedNode.querySelectorAll('.omnisearch-symbol-result-filename')
          .length,
      ).toBe(1);
      // $FlowFixMe
      expect(renderedNode.querySelectorAll('.icon-code').length).toBe(1);
    });
  });
});
