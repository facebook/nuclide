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

import BreakpointStore from './BreakpointStore';
import React from 'react';
import {Button} from 'nuclide-commons-ui/Button';

type Props = {
  breakpointStore: BreakpointStore,
  openDevTools: () => void,
  stopDebugging: () => void,
};

/**
 * Wrapper for Chrome Devtools frontend view.
 */
export default class DebuggerInspector extends React.PureComponent {
  props: Props;

  constructor(props: Props) {
    super(props);
    (this: any)._handleClickClose = this._handleClickClose.bind(this);
    (this: any)._handleClickDevTools = this._handleClickDevTools.bind(this);
  }

  render(): React.Element<any> {
    return (
      <div className="inspector" style={{'text-align': 'right'}}>
        <div className="control-bar">
          <Button
            title="(Debug) Open Web Inspector for the debugger frame."
            icon="gear"
            onClick={this._handleClickDevTools}
          />
        </div>
      </div>
    );
  }

  _handleClickClose() {
    this.props.stopDebugging();
    hideDebuggerPane();
  }

  _handleClickDevTools() {
    this.props.openDevTools();
  }
}

function hideDebuggerPane(): void {
  atom.commands.dispatch(
    atom.views.getView(atom.workspace),
    'nuclide-debugger:hide',
  );
}
