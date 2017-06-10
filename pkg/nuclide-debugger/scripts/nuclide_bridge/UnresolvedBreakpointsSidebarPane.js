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

import NuclideBridge from './NuclideBridge';
import React from 'react';
import ReactDOM from 'react-dom';
import nuclideUri from 'nuclide-commons/nuclideUri';
import url from 'url';
import invariant from 'assert';
import WebInspector from '../../lib/WebInspector';

type Props = {};

type State = {
  breakpoints: Array<{url: string, line: number}>,
};

class UnresolvedBreakpointsComponent extends React.Component {
  props: Props;
  state: State;

  _changeHandler: ?IDisposable;

  constructor(props: Props) {
    super(props);

    this._changeHandler = null;
    this.state = this._getState();

    (this: any)._updateState = this._updateState.bind(this);
    (this: any)._getState = this._getState.bind(this);
  }

  componentWillMount() {
    this._changeHandler = NuclideBridge.onUnresolvedBreakpointsChanged(
      this._updateState,
    );
  }

  componentWillUnmount() {
    invariant(this._changeHandler != null);
    this._changeHandler.dispose();
  }

  render() {
    const children = this.state.breakpoints.map(breakpoint => {
      const {pathname} = url.parse(breakpoint.url);
      invariant(pathname);
      const longRep = `${pathname}:${breakpoint.line + 1}`;
      const shortRep = `${nuclideUri.basename(pathname)}:${breakpoint.line + 1}`;
      return (
        <li
          key={longRep}
          className="cursor-pointer source-text"
          onClick={this._onBreakpointClick.bind(this, breakpoint)}
          title={longRep}>
          {shortRep}
        </li>
      );
    });
    return (
      <ol className="breakpoint-list">
        {this.state.breakpoints.length > 0
          ? children
          : <div className="info">None</div>}
      </ol>
    );
  }

  _onBreakpointClick(breakpoint: {url: string, line: number}) {
    NuclideBridge.sendOpenSourceLocation(breakpoint.url, breakpoint.line);
  }

  _updateState() {
    this.setState(this._getState());
  }

  _getState() {
    return {
      breakpoints: NuclideBridge.getUnresolvedBreakpointsList(),
    };
  }
}

export default class UnresolvedBreakpointsSidebarPane
  extends WebInspector.SidebarPane {
  constructor() {
    // WebInspector classes are not es6 classes, but babel forces a super call.
    super();
    // Actual super call.
    WebInspector.SidebarPane.call(this, 'Unresolved Breakpoints');

    this.registerRequiredCSS('components/breakpointsList.css');

    ReactDOM.render(<UnresolvedBreakpointsComponent />, this.bodyElement);

    this.expand();
  }

  // This is implemented by various UI views, but is not declared anywhere as
  // an official interface. There's callers to various `reset` functions, so
  // it's probably safer to have this.
  reset() {}
}
