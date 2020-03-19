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

import type {Prompt} from 'big-dig/src/client/SshHandshake';

import {SshHandshake} from 'big-dig/src/client/index';
import {getLogger} from 'log4js';
import {getNuclideVersion} from 'nuclide-commons/system-info';
import {ServerConnection} from '../../nuclide-remote-connection/lib/ServerConnection';

let remoteServerCommand = 'nuclide-fetch-and-start-server'; // default for open-source

try {
  // $FlowFB
  const defaults = require('./fb/config').getConnectionDialogDefaultSettings();
  remoteServerCommand = defaults.remoteServerCommand;
} catch (e) {}

const logger = getLogger('simple-connection');

/**
 * @param host the remote host
 * @param port the ssh port on the remote host
 * @param user the ssh username
 * @param password the password for the user
 * @param onPrompt once the user is prompted, the next callback should be
 *        with the response.
 * @param onConnect called when the connection is ready with the
 *        ServerConnection
 * @param onError called on an error with an Error object
 */
export type SimpleConnectConfiguration = {
  host: string,
  port: number,
  user: string,
  password: string,
  onPrompt: (prompt: Prompt, next: (response: string) => mixed) => mixed,
  onConnect: ServerConnection => mixed,
  onError: Error => mixed,
  remoteServerCommand?: string,
};

export function connectToServer(config: SimpleConnectConfiguration) {
  const simpleDelegate = {
    onKeyboardInteractive(name, instructions, instructionsLang, prompts) {
      logger.info('onKeyboardInteractive called');
      const prompt = prompts[0];
      return new Promise(resolve => {
        config.onPrompt(prompt, (response: string) => resolve([response]));
      });
    },
    onWillConnect() {
      logger.info('onWillConnect called');
    },
    onDidConnect(remoteConfig) {
      logger.info('onDidConnect called');
      ServerConnection.getOrCreate({version: 2, ...remoteConfig})
        .then(serverConnection => {
          config.onConnect(serverConnection);
        })
        .catch(error => {
          logger.error(error);
          config.onError(error);
        });
    },
    onError(errorType, error) {
      logger.error(error);
      config.onError(error);
    },
  };

  const sshHandshake = new SshHandshake(simpleDelegate);
  const version = getNuclideVersion();
  remoteServerCommand =
    config.remoteServerCommand != null
      ? config.remoteServerCommand
      : remoteServerCommand;

  remoteServerCommand += ` --big-dig --version=${version}`;
  const remoteServerPorts = '9093-9091';

  sshHandshake.connect({
    host: config.host,
    sshPort: config.port,
    username: config.user,
    password: config.password,
    pathToPrivateKey: '',
    remoteServer: {
      command: remoteServerCommand,
    },
    remoteServerPorts,
    authMethod: 'PASSWORD',
    displayTitle: '',
  });
}
