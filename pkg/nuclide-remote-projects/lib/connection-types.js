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

import type {SshHandshakeAuthMethodsType} from './ConnectionDetailsForm';

export type NuclideRemoteConnectionParams = {
  username: string,
  server: string,
  cwd: string,
  remoteServerCommand: string,
  sshPort: string,
  pathToPrivateKey: string,
  authMethod: SshHandshakeAuthMethodsType,
  displayTitle: string,
};

// The same as NuclideRemoteConnectionParams with optional `remoteServerCommand`.
export type NuclideNewConnectionProfileInitialFields = {
  username: string,
  server: string,
  cwd: string,
  remoteServerCommand?: string,
  sshPort: string,
  pathToPrivateKey: string,
  authMethod: SshHandshakeAuthMethodsType,
  displayTitle: string,
};

export type NuclideRemoteConnectionProfile = {
  deletable: boolean,
  displayTitle: string,
  params: NuclideRemoteConnectionParams,
  saveable: boolean,
};

export type NuclideSavedConnectionDialogConfig = {
  lastOfficialRemoteServerCommand?: string,
  updatedConfig?: NuclideRemoteConnectionParams,
};

// This type should not be saved -- it contains the user's password.
export type NuclideRemoteConnectionParamsWithPassword = {
  username: string,
  server: string,
  cwd: string,
  remoteServerCommand: string,
  sshPort: string,
  pathToPrivateKey: string,
  authMethod: SshHandshakeAuthMethodsType,
  password: string,
  displayTitle: string,
};
