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

import {SshHandshake} from '../../nuclide-remote-connection';
import {validateFormInputs} from '../lib/form-validation-utils';

describe('validateFormInputs', () => {
  let validProfileName;
  let defaultServerCommand;
  let connectionProfileBase;
  let minimumValidParamsWithPrivateKey;
  let minimumValidParamsWithPassword;
  let minimumValidParamsWithSshAgent;

  beforeEach(() => {
    validProfileName = 'MyProfile';
    defaultServerCommand = 'defaultcommand';
    connectionProfileBase = {
      displayTitle: 'testProfile',
      username: 'testuser',
      password: '',
      server: 'test@test.com',
      cwd: '/Test',
      sshPort: '22',
      pathToPrivateKey: '',
      remoteServerCommand: defaultServerCommand,
    };
    minimumValidParamsWithPrivateKey = {
      ...connectionProfileBase,
      authMethod: SshHandshake.SupportedMethods.PRIVATE_KEY,
      pathToPrivateKey: '/Test',
    };
    minimumValidParamsWithPassword = {
      ...connectionProfileBase,
      authMethod: SshHandshake.SupportedMethods.PASSWORD,
    };
    minimumValidParamsWithSshAgent = {
      ...connectionProfileBase,
      authMethod: SshHandshake.SupportedMethods.SSL_AGENT,
    };
  });

  /**
   * Section: Valid Profiles
   */
  it('accepts a valid profile with the Private Key authentication method', () => {
    const resultFromProfileWithPrivateKey: any = validateFormInputs(
      validProfileName,
      minimumValidParamsWithPrivateKey,
      defaultServerCommand,
    );
    expect(resultFromProfileWithPrivateKey.validatedProfile).toBeDefined();
    expect(resultFromProfileWithPrivateKey.warningMessage).not.toBeDefined();
  });

  it('accepts a valid profile with the Password authentication method', () => {
    const resultFromProfileWithPassword: any = validateFormInputs(
      validProfileName,
      minimumValidParamsWithPassword,
      defaultServerCommand,
    );
    expect(resultFromProfileWithPassword.validatedProfile).toBeDefined();
    expect(resultFromProfileWithPassword.warningMessage).not.toBeDefined();
  });

  it('accepts a valid profile with the SSH Agent authentication method', () => {
    const resultFromProfileWithSshAgent: any = validateFormInputs(
      validProfileName,
      minimumValidParamsWithSshAgent,
      defaultServerCommand,
    );
    expect(resultFromProfileWithSshAgent.validatedProfile).toBeDefined();
    expect(resultFromProfileWithSshAgent.warningMessage).not.toBeDefined();
  });

  /**
   * Section: Invalid Profiles
   */
  it('rejects a profile if a Profile Name is missing.', () => {
    const resultFromNullProfileName: any = validateFormInputs(
      // $FlowIgnore
      null,
      minimumValidParamsWithPrivateKey,
      defaultServerCommand,
    );
    expect(resultFromNullProfileName.errorMessage).not.toBeNull();

    const resultFromEmptyProfileName: any = validateFormInputs(
      '',
      minimumValidParamsWithPrivateKey,
      defaultServerCommand,
    );
    expect(resultFromEmptyProfileName.errorMessage).not.toBeNull();
  });

  it('rejects a profile if a Username is missing.', () => {
    minimumValidParamsWithPrivateKey.username = '';
    const resultFromNullUsername: any = validateFormInputs(
      validProfileName,
      minimumValidParamsWithPrivateKey,
      defaultServerCommand,
    );
    expect(resultFromNullUsername.errorMessage).not.toBeNull();

    minimumValidParamsWithPrivateKey.username = '';
    const resultFromEmptyUsername: any = validateFormInputs(
      validProfileName,
      minimumValidParamsWithPrivateKey,
      defaultServerCommand,
    );
    expect(resultFromEmptyUsername.errorMessage).not.toBeNull();
  });

  it('rejects a profile if a Server is missing.', () => {
    minimumValidParamsWithPrivateKey.server = '';
    const resultFromNullServer: any = validateFormInputs(
      validProfileName,
      minimumValidParamsWithPrivateKey,
      defaultServerCommand,
    );
    expect(resultFromNullServer.errorMessage).not.toBeNull();

    minimumValidParamsWithPrivateKey.server = '';
    const resultFromEmptyServer: any = validateFormInputs(
      validProfileName,
      minimumValidParamsWithPrivateKey,
      defaultServerCommand,
    );
    expect(resultFromEmptyServer.errorMessage).not.toBeNull();
  });

  it('rejects a profile if an Initial Directory is missing.', () => {
    minimumValidParamsWithPrivateKey.cwd = '';
    const resultFromNullCwd: any = validateFormInputs(
      validProfileName,
      minimumValidParamsWithPrivateKey,
      defaultServerCommand,
    );
    expect(resultFromNullCwd.errorMessage).not.toBeNull();

    minimumValidParamsWithPrivateKey.cwd = '';
    const resultFromEmptyCwd: any = validateFormInputs(
      validProfileName,
      minimumValidParamsWithPrivateKey,
      defaultServerCommand,
    );
    expect(resultFromEmptyCwd.errorMessage).not.toBeNull();
  });

  it('rejects a profile if an SSH Port is missing.', () => {
    minimumValidParamsWithPrivateKey.sshPort = '';
    const resultFromNullSshPort: any = validateFormInputs(
      validProfileName,
      minimumValidParamsWithPrivateKey,
      defaultServerCommand,
    );
    expect(resultFromNullSshPort.errorMessage).not.toBeNull();

    minimumValidParamsWithPrivateKey.sshPort = '';
    const resultFromEmptySshPort: any = validateFormInputs(
      validProfileName,
      minimumValidParamsWithPrivateKey,
      defaultServerCommand,
    );
    expect(resultFromEmptySshPort.errorMessage).not.toBeNull();
  });

  it('rejects a profile if an Authentication Method is missing.', () => {
    minimumValidParamsWithPrivateKey.authMethod = null;
    const resultFromNullAuthMethod: any = validateFormInputs(
      validProfileName,
      minimumValidParamsWithPrivateKey,
      defaultServerCommand,
    );
    expect(resultFromNullAuthMethod.errorMessage).not.toBeNull();

    minimumValidParamsWithPrivateKey.authMethod = '';
    const resultFromEmptyAuthMethod: any = validateFormInputs(
      validProfileName,
      minimumValidParamsWithPrivateKey,
      defaultServerCommand,
    );
    expect(resultFromEmptyAuthMethod.errorMessage).not.toBeNull();
  });

  // eslint-disable-next-line max-len
  it('rejects a profile if the Authentication Method selected is "Private Key", and a Private Key File is missing', () => {
    minimumValidParamsWithPrivateKey.pathToPrivateKey = '';
    const resultFromEmptyPathToPrivateKey: any = validateFormInputs(
      validProfileName,
      minimumValidParamsWithPrivateKey,
      defaultServerCommand,
    );
    expect(resultFromEmptyPathToPrivateKey.errorMessage).not.toBeNull();
  });

  // eslint-disable-next-line max-len
  it('does not reject a profile if the Private Key File is missing, but the Authentication Method selected is not "Private Key"', () => {
    const passwordAuthMethodProfile: any = validateFormInputs(
      validProfileName,
      minimumValidParamsWithPassword,
      defaultServerCommand,
    );
    expect(passwordAuthMethodProfile.validatedProfile).toBeDefined();

    const sshAgentAuthMethodProfile: any = validateFormInputs(
      validProfileName,
      minimumValidParamsWithSshAgent,
      defaultServerCommand,
    );
    expect(sshAgentAuthMethodProfile.validatedProfile).toBeDefined();
  });

  /**
   * Section: Special Cases
   */
  // eslint-disable-next-line max-len
  it('strips a password, if it is provided and the "Password" Authentication Method is chosen, and provides a warning message.', () => {
    minimumValidParamsWithPassword.password = 'secretpassword';
    const resultFromProfileWithPassword: any = validateFormInputs(
      validProfileName,
      minimumValidParamsWithPassword,
      defaultServerCommand,
    );
    expect(resultFromProfileWithPassword.validatedProfile).toBeDefined();
    expect(
      resultFromProfileWithPassword.validatedProfile.params.password,
    ).not.toBeDefined();
    expect(resultFromProfileWithPassword.warningMessage).toBeDefined();
  });

  it('only saves the remote server command if it is different than the "default".', () => {
    const resultFromProfileWithDefaultRSC: any = validateFormInputs(
      validProfileName,
      minimumValidParamsWithPassword,
      defaultServerCommand,
    );
    expect(
      resultFromProfileWithDefaultRSC.validatedProfile.params
        .remoteServerCommand,
    ).toBe('');

    minimumValidParamsWithPassword.remoteServerCommand = 'differentCommand';
    const resultFromProfileWithDifferentRSC: any = validateFormInputs(
      validProfileName,
      minimumValidParamsWithPassword,
      defaultServerCommand,
    );
    expect(
      resultFromProfileWithDifferentRSC.validatedProfile.params
        .remoteServerCommand,
    ).toBe('differentCommand');
  });
});
