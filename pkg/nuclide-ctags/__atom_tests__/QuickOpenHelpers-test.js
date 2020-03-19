/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow
 * @format
 * @emails oncall+nuclide
 */
import type {CtagsResult} from '../../nuclide-ctags-rpc';

import invariant from 'assert';
import ReactDOM from 'react-dom';
import TestUtils from 'react-dom/test-utils';
// eslint-disable-next-line nuclide-internal/no-cross-atom-imports
import * as hackService from '../../nuclide-hack/lib/HackLanguage';
import QuickOpenHelpers from '../lib/QuickOpenHelpers';

const TEST_DIR = '/test';

describe('QuickOpenHelpers', () => {
  const mockDirectory: atom$Directory = ({
    getPath: () => TEST_DIR,
  }: any);

  beforeEach(() => {
    jest
      // eslint-disable-next-line nuclide-internal/no-cross-atom-imports
      .spyOn(require('../../nuclide-hack/lib/config'), 'getConfig')
      .mockReturnValue({
        hhClientPath: 'hh_client',
        logLevel: 'OFF',
      });
    jest
      .spyOn(
        require('../../nuclide-remote-connection'),
        'getServiceByNuclideUri',
      )
      .mockReturnValue({
        async getCtagsService() {
          return {
            async findTags(path, query): Promise<Array<CtagsResult>> {
              return [
                {
                  resultType: 'FILE',
                  name: 'A',
                  file: '/path1/a',
                  lineNumber: 1,
                  kind: 'c',
                  pattern: '/^class A$/',
                },
                {
                  resultType: 'FILE',
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
    jest.spyOn(hackService, 'isFileInHackProject').mockReturnValue(false);
  });

  it('it activates for valid directories', async () => {
    const {isEligibleForDirectory} = QuickOpenHelpers;
    invariant(isEligibleForDirectory);
    expect(await isEligibleForDirectory(mockDirectory)).toBe(true);
  });

  it('is able to return and render tag results', async () => {
    await (async () => {
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
          resultType: 'FILE',
          name: 'A',
          file: '/path1/a',
          lineNumber: 1,
          kind: 'c',
          pattern: '/^class A$/',
          path: '/path1/a',
          dir: TEST_DIR,
        },
        {
          resultType: 'FILE',
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
    })();
  });
});
