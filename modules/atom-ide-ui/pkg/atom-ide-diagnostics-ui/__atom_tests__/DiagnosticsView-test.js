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
import DiagnosticsView from '../lib/ui/DiagnosticsView';

describe('DiagnosticsView', () => {
  it('focuses the filter when "/" is pressed', () => {
    const diagnosticsView: DiagnosticsView = (TestUtils.renderIntoDocument(
      <DiagnosticsView
        autoVisibility={true}
        diagnostics={[]}
        filterByActiveTextEditor={false}
        gotoMessageLocation={() => {}}
        hiddenGroups={new Set()}
        onFilterByActiveTextEditorChange={() => {}}
        isVisible={true}
        onShowTracesChange={() => {}}
        onTextFilterChange={() => {}}
        onTypeFilterChange={() => {}}
        selectMessage={() => {}}
        selectedMessage={null}
        showDirectoryColumn={false}
        showTraces={true}
        supportedMessageKinds={new Set()}
        textFilter={{text: 'test', isRegExp: true, invalid: false}}
        uiConfig={[]}
      />,
    ): any);

    const workspaceEl = atom.views.getView(atom.workspace);
    const diagnosticsViewNode = ReactDom.findDOMNode(diagnosticsView);
    invariant(diagnosticsViewNode != null);
    workspaceEl.appendChild(diagnosticsViewNode);

    const filterComponent = diagnosticsView._filterComponent;
    invariant(filterComponent != null);
    const filterFocusSpy = jest.spyOn(filterComponent, 'focus');

    const diagnosticsTableTarget = workspaceEl.querySelector(
      '.atom-ide-filterable',
    );
    invariant(diagnosticsTableTarget != null);
    atom.commands.dispatch(diagnosticsTableTarget, 'atom-ide:filter');

    expect(filterFocusSpy).toHaveBeenCalled();
    workspaceEl.removeChild(diagnosticsViewNode);
  });
});
