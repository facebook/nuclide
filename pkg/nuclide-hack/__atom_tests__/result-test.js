/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 * @emails oncall+nuclide
 */
import invariant from 'assert';
import {HackSymbolProvider} from '../lib/HackSymbolProvider';
import TestUtils from 'react-dom/test-utils';
import ReactDOM from 'react-dom';

describe('Result rendering', () => {
  it('should work', () => {
    const mockResult = {
      resultType: 'SYMBOL',
      path: '/some/arbitrary/path',
      name: 'IExampleSymbolInterface',
      icon: 'puzzle',
      hoverText: 'interface',
      column: 1,
      line: 3,
      containerName: 'scope',
    };
    invariant(HackSymbolProvider.getComponentForItem != null);
    const reactElement = HackSymbolProvider.getComponentForItem(mockResult);
    expect(reactElement.props.title).toBe('interface');
    const renderedComponent = TestUtils.renderIntoDocument(reactElement);
    const renderedNode = ReactDOM.findDOMNode(renderedComponent);

    expect(
      // $FlowFixMe
      renderedNode.querySelectorAll('.omnisearch-symbol-result-filename')
        .length,
    ).toBe(1);
    // $FlowFixMe
    expect(renderedNode.querySelectorAll('.icon-puzzle').length).toBe(1);
  });
});
