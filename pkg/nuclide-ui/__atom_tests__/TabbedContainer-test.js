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
import TabbedContainer from '../TabbedContainer';
import TestUtils from 'react-dom/test-utils';
import * as React from 'react';
import ReactDOM from 'react-dom';
import nullthrows from 'nullthrows';

describe('TabbedContainer', () => {
  let containerNode: HTMLElement;
  beforeEach(() => {
    containerNode = document.createElement('div');
  });

  const renderTabbedContainer = (
    tabNames: Array<string>,
    children: Array<React.Node>,
  ): TabbedContainer => {
    return (ReactDOM.render(
      <TabbedContainer tabNames={tabNames} children={children} />,
      containerNode,
    ): any);
  };

  afterEach(() => {
    if (containerNode != null) {
      containerNode.remove();
    }
  });

  it('changes active tab when removing available children', () => {
    class Child1 extends React.Component<*> {
      render() {
        return <div>hello</div>;
      }
    }
    const tabbedContainer = renderTabbedContainer(
      ['tab1', 'tab2'],
      [<Child1 key={1} />, <Child1 key={2} />],
    );
    expect(tabbedContainer.state.activeTabName).toBe('tab1');

    const renderedTabs = containerNode.getElementsByClassName('tab');
    expect(renderedTabs.length).toBe(2);

    // the second tab should have its contents hidden
    expect(containerNode.getElementsByClassName('hidden').length).toBe(1);

    // switch to second tab
    TestUtils.Simulate.click(nullthrows(renderedTabs.item(1)));
    expect(tabbedContainer.state.activeTabName).toBe('tab2');

    // now the second tab's content becomes null
    renderTabbedContainer(['tab1', 'tab2'], [<Child1 key={1} />, null]);
    // we should be put onto the first tab
    expect(tabbedContainer.state.activeTabName).toBe('tab1');

    // no content to hide now
    expect(containerNode.getElementsByClassName('hidden').length).toBe(0);
  });
});
