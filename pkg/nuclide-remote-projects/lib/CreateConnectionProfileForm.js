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

import type {
  NuclideNewConnectionProfileInitialFields,
  NuclideRemoteConnectionParams,
  NuclideRemoteConnectionParamsWithPassword,
  NuclideRemoteConnectionProfile,
} from './connection-types';

import {AtomInput} from 'nuclide-commons-ui/AtomInput';
import nullthrows from 'nullthrows';
import * as React from 'react';
import ReactDOM from 'react-dom';
import invariant from 'assert';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import ConnectionDetailsForm from './ConnectionDetailsForm';
import {validateFormInputs} from './form-validation-utils';
import {Button, ButtonTypes} from 'nuclide-commons-ui/Button';
import {ButtonGroup} from 'nuclide-commons-ui/ButtonGroup';

type Props = {
  // A function called when the "Cancel" button is clicked.
  onCancel: () => mixed,
  // A function called when the "Save" button is clicked. The profile passed
  // to the function is the profile that the user has just created.
  // The CreateConnectionProfileForm will do basic validation on the inputs: It
  // checks that the fields are non-empty before calling this function.
  onSave: (profile: NuclideRemoteConnectionProfile) => mixed,
  // The inputs to pre-fill the form with.
  initialFormFields:
    | NuclideNewConnectionProfileInitialFields
    | NuclideRemoteConnectionParams,
  profileHosts: ?Array<string>,
};

const PROFILE_NAME_LABEL = 'Profile Name';
const DEFAULT_SERVER_COMMAND_PLACEHOLDER = '(DEFAULT)';

const emptyFunction = () => {};

/**
 * A form that is used to create a new connection profile.
 */
export default class CreateConnectionProfileForm extends React.Component<
  Props,
> {
  props: Props;

  _connectionDetails: ?ConnectionDetailsForm;
  disposables: UniversalDisposable;
  _profileName: ?AtomInput;

  constructor(props: Props) {
    super(props);
    this.disposables = new UniversalDisposable();
  }

  componentDidMount(): void {
    const root = ReactDOM.findDOMNode(this);
    this.disposables.add(
      // Hitting enter when this panel has focus should confirm the dialog.
      // $FlowFixMe
      atom.commands.add(root, 'core:confirm', this._clickSave),
      // Hitting escape when this panel has focus should cancel the dialog.
      // $FlowFixMe
      atom.commands.add(root, 'core:cancel', this._clickCancel),
    );
    nullthrows(this._profileName).focus();
  }

  componentWillUnmount(): void {
    this.disposables.dispose();
  }

  /**
   * Note: This form displays DEFAULT_SERVER_COMMAND_PLACEHOLDER as the prefilled
   * remote server command. The remote server command will only be saved if the
   * user changes it from this default.
   */
  render(): React.Node {
    const initialFields = this.props.initialFormFields;

    return (
      <div>
        <div className="form-group">
          <label>{PROFILE_NAME_LABEL}:</label>
          <AtomInput
            initialValue=""
            ref={input => {
              this._profileName = input;
            }}
            unstyled={true}
          />
        </div>
        <ConnectionDetailsForm
          initialUsername={initialFields.username}
          initialServer={initialFields.server}
          initialCwd={initialFields.cwd}
          initialRemoteServerCommand={
            // flowlint-next-line sketchy-null-string:off
            initialFields.remoteServerCommand ||
            DEFAULT_SERVER_COMMAND_PLACEHOLDER
          }
          initialSshPort={initialFields.sshPort}
          initialPathToPrivateKey={initialFields.pathToPrivateKey}
          initialAuthMethod={initialFields.authMethod}
          initialDisplayTitle={initialFields.displayTitle}
          profileHosts={this.props.profileHosts}
          onCancel={emptyFunction}
          onConfirm={this._clickSave}
          onDidChange={emptyFunction}
          needsPasswordValue={false}
          ref={details => {
            this._connectionDetails = details;
          }}
        />
        <div style={{display: 'flex', justifyContent: 'flex-end'}}>
          <ButtonGroup>
            <Button onClick={this._clickCancel}>Cancel</Button>
            <Button buttonType={ButtonTypes.PRIMARY} onClick={this._clickSave}>
              Save
            </Button>
          </ButtonGroup>
        </div>
      </div>
    );
  }

  _getProfileName(): string {
    return (this._profileName && this._profileName.getText().trim()) || '';
  }

  _clickSave = (): void => {
    // Validate the form inputs.
    const profileName = this._getProfileName();
    const connectionDetails: NuclideRemoteConnectionParamsWithPassword = nullthrows(
      this._connectionDetails,
    ).getFormFields();
    const validationResult = validateFormInputs(
      profileName,
      connectionDetails,
      DEFAULT_SERVER_COMMAND_PLACEHOLDER,
    );
    if (typeof validationResult.errorMessage === 'string') {
      atom.notifications.addError(validationResult.errorMessage);
      return;
    }
    invariant(
      validationResult.validatedProfile != null &&
        typeof validationResult.validatedProfile === 'object',
    );
    const newProfile = validationResult.validatedProfile;
    // Save the validated profile, and show any warning messages.
    if (typeof validationResult.warningMessage === 'string') {
      atom.notifications.addWarning(validationResult.warningMessage);
    }
    this.props.onSave(newProfile);
  };

  _clickCancel = (): void => {
    this.props.onCancel();
  };
}
