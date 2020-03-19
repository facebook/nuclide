/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 */

import {SshHandshake} from '../../nuclide-remote-connection';

import type {
  NuclideRemoteConnectionParamsWithPassword,
  NuclideRemoteConnectionProfile,
} from './connection-types';

export type NuclideNewConnectionProfileValidationResult =
  | {|errorMessage: string|}
  | {|
      validatedProfile: NuclideRemoteConnectionProfile,
      warningMessage?: string,
    |};

/*
 * This function checks that the required inputs to a connection profile are non-empty
 * (i.e. required strings are at least length 1). It also removes the password
 * if provided, and only retains the remote server command if it is not the default.
 * @param profileName The profile name to validate.
 * @param connectionDetails The connection details to validate.
 * @param defaultRemoteServerCommand The default remote server command. If the user's
 *   input matches this string (meaning the user hasn't changed it), the user's
 *   input will not be saved as part of the profile.
 * @return If the validation fails: an error object. If validation succeeds:
 * an object containing a valid profile to save.
 */
export function validateFormInputs(
  profileName: string,
  connectionDetails: NuclideRemoteConnectionParamsWithPassword,
  defaultRemoteServerCommand: string,
): NuclideNewConnectionProfileValidationResult {
  // Validate the form inputs. The form must be fully filled-out.
  const missingFields = [];
  const profileParams = {};

  if (!profileName) {
    missingFields.push('Profile Name');
  } else {
    profileParams.displayTitle = profileName;
  }
  if (!connectionDetails.username) {
    missingFields.push('Username');
  } else {
    profileParams.username = connectionDetails.username;
  }
  if (!connectionDetails.server) {
    missingFields.push('Server');
  } else {
    profileParams.server = connectionDetails.server;
  }
  if (!connectionDetails.cwd) {
    missingFields.push('Initial Directory');
  } else {
    profileParams.cwd = connectionDetails.cwd;
  }
  if (!connectionDetails.sshPort) {
    missingFields.push('SSH Port');
  } else {
    profileParams.sshPort = connectionDetails.sshPort;
  }

  const authMethod = connectionDetails.authMethod;
  if (!authMethod) {
    missingFields.push('Authentication Method');
  } else {
    profileParams.authMethod = authMethod;
  }
  if (
    authMethod === SshHandshake.SupportedMethods.PRIVATE_KEY &&
    !connectionDetails.pathToPrivateKey
  ) {
    missingFields.push(
      'Private Key File (required for the authentication method you selected)',
    );
  } else {
    profileParams.pathToPrivateKey = connectionDetails.pathToPrivateKey;
  }

  // Do not proceed if there are any missing fields.
  if (missingFields.length) {
    const missingFieldsString = missingFields.join(', ');
    const errorMessage = `You must fill out all fields. Currently missing:\n${missingFieldsString}`;
    return {errorMessage};
  }

  // If all the fields are filled out, there are some additional checks we
  // want to do.
  let warningMessage = '';

  // 1. If a password is provided, all parts of the profile will be save except the password.
  if (
    authMethod === SshHandshake.SupportedMethods.PASSWORD &&
    connectionDetails.password
  ) {
    warningMessage +=
      '* You provided a password for this profile. ' +
      'For security, Nuclide will save the other parts of this profile, ' +
      'but not the password.\n';
  }
  // 2. Save the remote server command only if it is changed.
  if (
    connectionDetails.remoteServerCommand &&
    connectionDetails.remoteServerCommand !== defaultRemoteServerCommand
  ) {
    profileParams.remoteServerCommand = connectionDetails.remoteServerCommand;
  } else {
    profileParams.remoteServerCommand = '';
  }
  const validatedProfile = {
    deletable: true,
    displayTitle: profileName,
    params: profileParams,
    saveable: true,
  };
  const validationResult =
    warningMessage.length > 0
      ? {
          validatedProfile,
          warningMessage,
        }
      : {validatedProfile};
  return validationResult;
}
