/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 * @format
 * @emails oncall+nuclide
 */
import invariant from 'assert';
import * as React from 'react';
import ReactDom from 'react-dom';
import TestUtils from 'react-dom/test-utils';
import ConsoleView from '../lib/ui/ConsoleView';

describe('ConsoleView', () => {
  it('focuses the filter when "/" is pressed inside the console-scroll-pane-wrapper div', () => {
    const consoleView: ConsoleView = (TestUtils.renderIntoDocument(
      <ConsoleView
        clearRecords={() => {}}
        createPaste={null}
        currentExecutor={null}
        records={[]}
        enableRegExpFilter={true}
        execute={() => {}}
        executors={new Map()}
        filterText={''}
        filteredRecordCount={0}
        fontSize={12}
        getProvider={() => {}}
        history={[]}
        invalidFilterInput={false}
        resetAllFilters={() => {}}
        selectExecutor={() => {}}
        selectSources={() => {}}
        selectedSourceIds={[]}
        sources={[]}
        updateFilter={() => {}}
        watchEditor={null}
        selectedSeverities={new Set(['error', 'warning', 'info'])}
        toggleSeverity={() => {}}
      />,
    ): any);

    const workspaceEl = atom.views.getView(atom.workspace);
    const consoleViewNode = ReactDom.findDOMNode(consoleView);
    invariant(consoleViewNode != null);
    workspaceEl.appendChild(consoleViewNode);

    const consoleHeaderComponent = consoleView._consoleHeaderComponent;
    invariant(consoleHeaderComponent != null);
    const filterFocusSpy = jest.spyOn(consoleHeaderComponent, 'focusFilter');

    const consoleScrollPaneTarget = workspaceEl.querySelector(
      '.console-scroll-pane-wrapper',
    );
    invariant(consoleScrollPaneTarget != null);
    atom.commands.dispatch(consoleScrollPaneTarget, 'atom-ide:filter');

    expect(filterFocusSpy).toHaveBeenCalled();
    workspaceEl.removeChild(consoleViewNode);
  });
});
