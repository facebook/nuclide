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

import type {DebuggerProviderStore} from './DebuggerProviderStore';
import type {
  DebuggerLaunchAttachProvider,
  DebuggerConfigAction,
} from '../../nuclide-debugger-base';
import type DebuggerActions from './DebuggerActions';

import React from 'react';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {
  getLastUsedDebugger,
  setLastUsedDebugger,
} from '../../nuclide-debugger-base';
import {Button, ButtonTypes} from 'nuclide-commons-ui/Button';
import {ButtonGroup} from 'nuclide-commons-ui/ButtonGroup';
import Tabs from '../../nuclide-ui/Tabs';
import {Observable} from 'rxjs';
import invariant from 'invariant';

type PropsType = {
  dialogMode: DebuggerConfigAction,
  store: DebuggerProviderStore,
  debuggerActions: DebuggerActions,
  connection: string,
  providers: Array<DebuggerLaunchAttachProvider>,
  chooseConnection: () => void,
  dialogCloser: () => void,
};

type StateType = {
  selectedProviderTab: ?string,
  configIsValid: boolean,
  enabledProviders: Array<{
    provider: DebuggerLaunchAttachProvider,
    debuggerName: string,
  }>,
};

export class DebuggerLaunchAttachUI extends React.Component<
  void,
  PropsType,
  StateType,
> {
  props: PropsType;
  state: StateType;
  _disposables: UniversalDisposable;

  constructor(props: PropsType) {
    super(props);

    this._disposables = new UniversalDisposable();
    this._disposables.add(
      atom.commands.add('atom-workspace', {
        'core:confirm': () => {
          if (this.state.configIsValid) {
            this._rememberTab();

            // Close the dialog, but do it on the next tick so that the child
            // component gets to handle the event first (and start the debugger).
            process.nextTick(this.props.dialogCloser);
          }
        },
      }),
      atom.commands.add('atom-workspace', {
        'core:cancel': () => {
          this._rememberTab();
          this.props.dialogCloser();
        },
      }),
    );

    this.state = {
      selectedProviderTab: null,
      configIsValid: false,
      enabledProviders: [],
    };
  }

  _rememberTab(): void {
    // Remember the last tab the user used for this connection when the "launch/attach"
    // button is clicked.
    const host = nuclideUri.isRemote(this.props.connection)
      ? nuclideUri.getHostname(this.props.connection)
      : 'local';
    if (this.state.selectedProviderTab != null) {
      setLastUsedDebugger(
        host,
        this.props.dialogMode,
        this.state.selectedProviderTab || '',
      );
    }
  }

  componentWillMount() {
    const host = nuclideUri.isRemote(this.props.connection)
      ? nuclideUri.getHostname(this.props.connection)
      : 'local';

    this._filterProviders();
    this.setState({
      selectedProviderTab: getLastUsedDebugger(host, this.props.dialogMode),
    });
  }

  componentWillUnmount() {
    this._disposables.dispose();
  }

  async _getProviderIfEnabled(
    provider: DebuggerLaunchAttachProvider,
  ): Promise<?DebuggerLaunchAttachProvider> {
    const enabled = await provider
      .getCallbacksForAction(this.props.dialogMode)
      .isEnabled();
    return enabled ? provider : null;
  }

  _filterProviders(): void {
    this.setState({
      enabledProviders: [],
    });

    Observable.merge(
      ...this.props.providers.map(provider =>
        Observable.fromPromise(this._getProviderIfEnabled(provider)),
      ),
    )
      .filter(provider => provider != null)
      .subscribe(provider => {
        invariant(provider != null);
        const enabledProviders = this.state.enabledProviders.concat(
          ...provider
            .getCallbacksForAction(this.props.dialogMode)
            .getDebuggerTypeNames()
            .map(debuggerName => {
              return {
                provider,
                debuggerName,
              };
            }),
        );

        this.setState({
          enabledProviders,
        });
      });
  }

  _setConfigValid = (valid: boolean): void => {
    this.setState({
      configIsValid: valid,
    });
  };

  render(): React.Element<any> {
    const displayName = nuclideUri.isRemote(this.props.connection)
      ? nuclideUri.getHostname(this.props.connection)
      : 'localhost';

    const tabs = this.state.enabledProviders
      .map(debuggerType => ({
        name: debuggerType.debuggerName,
        tabContent: (
          <span title={debuggerType.debuggerName}>
            {debuggerType.debuggerName}
          </span>
        ),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    let providerContent = null;
    if (tabs.length > 0) {
      let selectedTab =
        this.state.selectedProviderTab != null
          ? this.state.selectedProviderTab
          : this.state.enabledProviders[0].debuggerName;
      let provider = this.state.enabledProviders.find(
        p => p.debuggerName === selectedTab,
      );
      if (provider == null) {
        provider = this.state.enabledProviders[0];
        selectedTab = provider.debuggerName;
      }

      const debuggerConfigPage = provider.provider
        .getCallbacksForAction(this.props.dialogMode)
        .getComponent(selectedTab, valid => this._setConfigValid(valid));

      providerContent = (
        <div>
          <Tabs
            className="nuclide-debugger-launch-attach-tabs"
            tabs={tabs}
            activeTabName={this.state.selectedProviderTab}
            triggeringEvent="onClick"
            onActiveTabChange={newTab => {
              this._setConfigValid(false);
              this.setState({selectedProviderTab: newTab.name});
            }}
          />
          <div className="nuclide-debugger-launch-attach-tabcontent">
            {debuggerConfigPage}
          </div>
        </div>
      );

      if (this.state.selectedProviderTab == null) {
        // Select the first tab.
        this.setState({selectedProviderTab: tabs[0].name});
      }
    } else {
      // No debugging providers available.
      providerContent = (
        <div className="nuclide-debugger-launch-attach-tabcontent">
          There are no debuggers available.
        </div>
      );
    }

    return (
      <div className="padded nuclide-debugger-launch-attach-container">
        <h1 className="nuclide-debugger-launch-attach-header">
          {this.props.dialogMode === 'attach'
            ? 'Attach debugger to '
            : 'Launch debugger on '}
          <span
            className="nuclide-debugger-launch-connection"
            title="Click to change the connection to be used for debugging."
            onClick={() => this.props.chooseConnection()}>
            {displayName}
          </span>
          <span>:</span>
        </h1>
        {providerContent}
        <div className="nuclide-debugger-launch-attach-actions">
          <ButtonGroup>
            <Button
              onClick={() =>
                atom.commands.dispatch(
                  atom.views.getView(atom.workspace),
                  'core:cancel',
                )}>
              Cancel
            </Button>
            <Button
              buttonType={ButtonTypes.PRIMARY}
              disabled={!this.state.configIsValid}
              onClick={() =>
                atom.commands.dispatch(
                  atom.views.getView(atom.workspace),
                  'core:confirm',
                )}>
              {this.props.dialogMode === 'attach' ? 'Attach' : 'Launch'}
            </Button>
          </ButtonGroup>
        </div>
      </div>
    );
  }
}
