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

import type {DnsLookup} from '../../nuclide-remote-connection/lib/lookup-prefer-ip-v6';
import type {
  NuclideRemoteAuthMethods,
  NuclideRemoteConnectionParamsWithPassword,
} from './connection-types';

import {getOfficialRemoteServerCommand} from './connection-profile-utils';

import addTooltip from 'nuclide-commons-ui/addTooltip';
import {AtomInput} from 'nuclide-commons-ui/AtomInput';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {getIPsForHosts} from './connection-profile-utils';
import lookupPreferIpv6 from '../../nuclide-remote-connection/lib/lookup-prefer-ip-v6';
import RadioGroup from 'nuclide-commons-ui/RadioGroup';
import * as React from 'react';
import ReactDOM from 'react-dom';
import {SshHandshake} from '../../nuclide-remote-connection';

const {SupportedMethods} = SshHandshake;
const authMethods = [
  SupportedMethods.PASSWORD,
  SupportedMethods.SSL_AGENT,
  SupportedMethods.PRIVATE_KEY,
];

type Props = {
  className?: string,
  initialUsername: string,
  initialServer: string,
  initialCwd: string,
  initialRemoteServerCommand: string,
  initialSshPort: string,
  initialPathToPrivateKey: string,
  initialAuthMethod: $Enum<typeof SupportedMethods>,
  initialDisplayTitle: string,
  onCancel: () => mixed,
  onConfirm: () => mixed,
  onDidChange: () => mixed,
  profileHosts: ?Array<string>,
};

type State = {
  cwd: string,
  displayTitle: string,
  IPs: ?Promise<Array<DnsLookup>>,
  pathToPrivateKey: string,
  remoteServerCommand: string,
  selectedAuthMethodIndex: number,
  server: string,
  shouldDisplayTooltipWarning: boolean,
  sshPort: string,
  username: string,
};

/** Component to prompt the user for connection details. */
export default class ConnectionDetailsForm extends React.Component<
  Props,
  State,
> {
  _disposables: ?UniversalDisposable;
  _promptChanged: boolean;

  constructor(props: Props) {
    super(props);

    this._promptChanged = false;
    this.state = {
      username: props.initialUsername,
      server: props.initialServer,
      cwd: props.initialCwd,
      remoteServerCommand: props.initialRemoteServerCommand,
      sshPort: props.initialSshPort,
      pathToPrivateKey: props.initialPathToPrivateKey,
      selectedAuthMethodIndex: authMethods.indexOf(props.initialAuthMethod),
      displayTitle: props.initialDisplayTitle,
      IPs: null,
      shouldDisplayTooltipWarning: false,
    };
  }

  _onKeyPress(e: SyntheticKeyboardEvent<>): void {
    if (e.key === 'Enter') {
      this.props.onConfirm();
    }

    if (e.key === 'Escape') {
      this.props.onCancel();
    }
  }

  _handleAuthMethodChange = (newIndex: number) => {
    this.props.onDidChange();
    this.setState({
      selectedAuthMethodIndex: newIndex,
    });
  };

  _handleInputDidChange = (): void => {
    this.props.onDidChange();
  };

  _handleInputDidChangeForServer = () => {
    // If the input changed due to a higher level change in the
    // ConnectionDetailsPrompt, don't check for host collisions
    if (!this._promptChanged) {
      this._checkForHostCollisions(this._getText('server'));
      this.props.onDidChange();
    }
    this._promptChanged = false;
  };

  _handleKeyFileInputClick = (event: SyntheticEvent<>): void => {
    const privateKeyAuthMethodIndex = authMethods.indexOf(
      SupportedMethods.PRIVATE_KEY,
    );
    this.setState(
      {
        selectedAuthMethodIndex: privateKeyAuthMethodIndex,
      },
      () => {
        // when setting this immediately, Atom will unset the focus...
        setTimeout(() => {
          // $FlowFixMe
          ReactDOM.findDOMNode(this.refs.pathToPrivateKey).focus();
        }, 0);
      },
    );
  };

  _handlePasswordInputClick = (event: SyntheticEvent<>): void => {
    const passwordAuthMethodIndex = authMethods.indexOf(
      SupportedMethods.PASSWORD,
    );
    this.setState(
      {
        selectedAuthMethodIndex: passwordAuthMethodIndex,
      },
      () => {
        // $FlowFixMe
        ReactDOM.findDOMNode(this.refs.password).focus();
      },
    );
  };

  async _checkForHostCollisions(hostName: string) {
    const uniqueHosts = this.props.profileHosts;
    if (uniqueHosts == null || this.state.IPs == null) {
      return;
    }
    const IPs = await this.state.IPs;
    const ip = await lookupPreferIpv6(hostName).catch(() => {
      return;
    });
    let shouldDisplayWarning = false;
    if (ip == null) {
      if (this.state.shouldDisplayTooltipWarning) {
        this.setState({shouldDisplayTooltipWarning: false});
      }
    } else {
      for (let i = 0; i < uniqueHosts.length; i++) {
        if (hostName !== uniqueHosts[i]) {
          if (ip === IPs[i]) {
            shouldDisplayWarning = true;
          }
        }
      }
      if (this.state.shouldDisplayTooltipWarning !== shouldDisplayWarning) {
        this.setState({shouldDisplayTooltipWarning: shouldDisplayWarning});
      }
    }
  }

  render(): React.Node {
    const {className} = this.props;
    const activeAuthMethod = authMethods[this.state.selectedAuthMethodIndex];
    // We need native-key-bindings so that delete works and we need
    // _onKeyPress so that escape and enter work
    const passwordLabel = (
      <div className="nuclide-auth-method">
        <div className="nuclide-auth-method-label">Password:</div>
        <div
          className="nuclide-auth-method-input nuclide-auth-method-password"
          onClick={this._handlePasswordInputClick}>
          <input
            type="password"
            className="nuclide-password native-key-bindings"
            disabled={activeAuthMethod !== SupportedMethods.PASSWORD}
            onChange={this._handleInputDidChange}
            onKeyPress={this._onKeyPress.bind(this)}
            ref="password"
          />
        </div>
      </div>
    );
    const privateKeyLabel = (
      <div className="nuclide-auth-method">
        <div className="nuclide-auth-method-label">Private Key File:</div>
        <div className="nuclide-auth-method-input nuclide-auth-method-privatekey">
          <AtomInput
            disabled={activeAuthMethod !== SupportedMethods.PRIVATE_KEY}
            initialValue={this.state.pathToPrivateKey}
            onClick={this._handleKeyFileInputClick}
            onDidChange={this._handleInputDidChange}
            placeholder="Path to private key"
            ref="pathToPrivateKey"
            unstyled={true}
          />
        </div>
      </div>
    );
    const sshAgentLabel = (
      <div className="nuclide-auth-method">Use ssh-agent</div>
    );
    let toolTipWarning;
    if (this.state.shouldDisplayTooltipWarning) {
      toolTipWarning = (
        <span
          style={{paddingLeft: 10}}
          className={
            'icon icon-info pull-right nuclide-remote-projects-tooltip-warning'
          }
          ref={addTooltip({
            // Intentionally *not* an arrow function so the jQuery
            // Tooltip plugin can set the context to the Tooltip
            // instance.
            placement() {
              // Atom modals have z indices of 9999. This Tooltip needs
              // to stack on top of the modal; beat the modal's z-index.
              this.tip.style.zIndex = 10999;
              return 'right';
            },
            title:
              'One of your profiles uses a host name that resolves to the' +
              ' same IP as this one. Consider using the uniform host ' +
              'name to avoid potential collisions.',
          })}
        />
      );
    }

    return (
      <div className={className}>
        <div className="form-group">
          <label>Username:</label>
          <AtomInput
            initialValue={this.state.username}
            onDidChange={this._handleInputDidChange}
            ref="username"
            unstyled={true}
          />
        </div>
        <div className="form-group nuclide-auth-server-group">
          <div className="nuclide-auth-server">
            <label>
              Server:
              {toolTipWarning}
            </label>
            <AtomInput
              initialValue={this.state.server}
              onDidChange={this._handleInputDidChangeForServer}
              ref="server"
              unstyled={true}
            />
          </div>
          <div className="col-xs-3">
            <label>SSH Port:</label>
            <AtomInput
              initialValue={this.state.sshPort}
              onDidChange={this._handleInputDidChange}
              ref="sshPort"
              unstyled={true}
            />
          </div>
        </div>
        <div className="form-group">
          <label>Initial Directory:</label>
          <AtomInput
            initialValue={this.state.cwd}
            onDidChange={this._handleInputDidChange}
            ref="cwd"
            unstyled={true}
          />
        </div>
        <div className="form-group">
          <label>Authentication method:</label>
          <RadioGroup
            optionLabels={[passwordLabel, sshAgentLabel, privateKeyLabel]}
            onSelectedChange={this._handleAuthMethodChange}
            selectedIndex={this.state.selectedAuthMethodIndex}
          />
        </div>
        <div className="form-group">
          <label>Remote Server Command:</label>
          <AtomInput
            initialValue={this.state.remoteServerCommand}
            onDidChange={this._handleInputDidChange}
            ref="remoteServerCommand"
            unstyled={true}
          />
        </div>
      </div>
    );
  }

  componentDidMount() {
    const disposables = new UniversalDisposable();
    this._disposables = disposables;
    const root = ReactDOM.findDOMNode(this);

    // Hitting enter when this panel has focus should confirm the dialog.
    disposables.add(
      atom.commands.add(
        // $FlowFixMe
        root,
        'core:confirm',
        event => this.props.onConfirm(),
      ),
    );

    // Hitting escape should cancel the dialog.
    disposables.add(
      atom.commands.add('atom-workspace', 'core:cancel', event =>
        this.props.onCancel(),
      ),
    );
    if (this.props.profileHosts) {
      this.setState({IPs: getIPsForHosts(this.props.profileHosts)});
    }
  }

  componentWillUnmount() {
    if (this._disposables) {
      this._disposables.dispose();
      this._disposables = null;
    }
  }

  getFormFields(): NuclideRemoteConnectionParamsWithPassword {
    return {
      username: this._getText('username'),
      server: this._getText('server'),
      cwd: this._getText('cwd'),
      remoteServerCommand:
        this._getText('remoteServerCommand') ||
        getOfficialRemoteServerCommand(),
      sshPort: this._getText('sshPort'),
      pathToPrivateKey: this._getText('pathToPrivateKey'),
      authMethod: this._getAuthMethod(),
      password: this._getPassword(),
      displayTitle: this.state.displayTitle,
    };
  }

  focus(): void {
    this.refs.username.focus();
  }

  // Note: 'password' is not settable. The only exposed method is 'clearPassword'.
  setFormFields(fields: {
    username?: string,
    server?: string,
    cwd?: string,
    remoteServerCommand?: string,
    sshPort?: string,
    pathToPrivateKey?: string,
    authMethod?: NuclideRemoteAuthMethods,
    displayTitle?: string,
  }): void {
    this._setText('username', fields.username);
    this._setText('server', fields.server);
    this._setText('cwd', fields.cwd);
    this._setText('remoteServerCommand', fields.remoteServerCommand);
    this._setText('sshPort', fields.sshPort);
    this._setText('pathToPrivateKey', fields.pathToPrivateKey);
    this._setAuthMethod(fields.authMethod);
    // `displayTitle` is not editable and therefore has no `<atom-text-editor mini>`. Its value is
    // stored only in local state.
    this.setState({displayTitle: fields.displayTitle});
  }

  _getText(fieldName: string): string {
    return (
      (this.refs[fieldName] && this.refs[fieldName].getText().trim()) || ''
    );
  }

  _setText(fieldName: string, text: ?string): void {
    if (text == null) {
      return;
    }
    const atomInput = this.refs[fieldName];
    if (atomInput) {
      atomInput.setText(text);
    }
  }

  _getAuthMethod(): string {
    return authMethods[this.state.selectedAuthMethodIndex];
  }

  _setAuthMethod(authMethod: ?NuclideRemoteAuthMethods): void {
    if (authMethod == null) {
      return;
    }
    const newIndex = authMethods.indexOf(authMethod);
    if (newIndex >= 0) {
      this.setState({selectedAuthMethodIndex: newIndex});
    }
  }

  _getPassword(): string {
    return (
      // $FlowFixMe
      (this.refs.password && ReactDOM.findDOMNode(this.refs.password).value) ||
      ''
    );
  }

  clearPassword(): void {
    const passwordInput = this.refs.password;
    if (passwordInput) {
      passwordInput.value = '';
    }
  }

  promptChanged(): void {
    this._promptChanged = true;
    this.setState({shouldDisplayTooltipWarning: false});
  }
}
