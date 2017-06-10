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

import type {NuclideUri} from 'nuclide-commons/nuclideUri';

import React from 'react';
import {Checkbox} from 'nuclide-commons-ui/Checkbox';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';

type Props = {
  targetUri: NuclideUri,
  configIsValidChanged: (valid: boolean) => void,
};

// TODO: All this needs to be serialized by the package, so we're going to need to hoist it and use
//   actions.
type State = {
  startPackager: boolean,
  tailIosLogs: boolean,
  tailAdbLogs: boolean,
};

export class DebugUiComponent extends React.Component {
  props: Props;
  state: State;
  _disposables: UniversalDisposable;

  constructor(props: Props) {
    super(props);
    (this: any)._handleDebugButtonClick = this._handleDebugButtonClick.bind(
      this,
    );

    this._disposables = new UniversalDisposable();
    this.state = {
      startPackager: false,
      tailIosLogs: false,
      tailAdbLogs: false,
    };
  }

  componentDidMount(): void {
    this._disposables.add(
      atom.commands.add('atom-workspace', {
        'core:confirm': () => {
          if (this._debugButtonShouldEnable()) {
            this._handleDebugButtonClick();
          }
        },
      }),
    );
  }

  componentWillUnmount() {
    this._disposables.dispose();
  }

  setState(newState: Object): void {
    super.setState(newState);
    this.props.configIsValidChanged(this._debugButtonShouldEnable());
  }

  _debugButtonShouldEnable(): boolean {
    return true;
  }

  render(): React.Element<any> {
    return (
      <div className="block">
        <div className="block">
          <Checkbox
            checked={this.state.startPackager}
            label="Start Packager"
            onChange={startPackager => this.setState({startPackager})}
          />
        </div>
        <div className="block">
          <Checkbox
            checked={this.state.tailIosLogs}
            label="Tail iOS Simulator Logs"
            onChange={tailIosLogs => this.setState({tailIosLogs})}
          />
        </div>
        <div className="block">
          <Checkbox
            checked={this.state.tailAdbLogs}
            label="Tail adb Logcat Logs"
            onChange={tailAdbLogs => this.setState({tailAdbLogs})}
          />
        </div>
        <div className="text-left text-smaller text-subtle">
          After starting the debugger, enable JS debugging from the developer menu of your React
          Native app
        </div>
      </div>
    );
  }

  _handleDebugButtonClick(): void {
    if (this.state.startPackager) {
      callWorkspaceCommand('nuclide-react-native:start-packager');
    }
    if (this.state.tailIosLogs) {
      callWorkspaceCommand('nuclide-ios-simulator-logs:start');
    }
    if (this.state.tailAdbLogs) {
      callWorkspaceCommand('nuclide-adb-logcat:start');
    }
    callWorkspaceCommand('nuclide-react-native:start-debugging');
  }
}

function callWorkspaceCommand(command: string): void {
  atom.commands.dispatch(atom.views.getView(atom.workspace), command);
}
