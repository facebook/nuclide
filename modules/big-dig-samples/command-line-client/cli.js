/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 * @format
 */

import type {BigDigClient} from 'big-dig/src/client/BigDigClient';
import type {
  SshHandshakeErrorType,
  SshConnectionConfiguration,
} from 'big-dig/src/client/SshHandshake';

import invariant from 'assert';
import {getLogger} from 'log4js';
import yargs from 'yargs';

import {question} from 'big-dig/src/common/readline';
import {getUsername} from 'big-dig/src/common/username';
import {SshHandshake} from 'big-dig/src/client/SshHandshake';
import {setupDefaultLogging} from './logging';

setupDefaultLogging('big-dig-server-cli.log');

const DEFAULT_SSH_PORT = 22;

function parseArgsAndRunMain(): Promise<void> {
  const {version} = require('../package.json');
  const {argv} = yargs
    .usage(`Big Dig sample command line client, version ${version} `)
    .help('h')
    .alias('h', 'help')
    .option('host', {
      describe: 'The host to connect to',
      type: 'string',
    })
    .option('private-key', {
      describe: 'Path to file that contains your private key',
      type: 'string',
    })
    .option('remote-server-command', {
      describe: 'Command to launch the server on the host',
      type: 'string',
    });

  const {host, privateKey, remoteServerCommand} = argv;

  return new Promise((resolve, reject) => {
    const sshHandshake = new SshHandshake({
      onKeyboardInteractive(
        name,
        instructions,
        instructionsLang,
        prompts: Array<{echo: boolean, prompt: string}>,
        finish: (answers: Array<string>) => void,
      ) {
        invariant(prompts.length > 0);
        const {prompt, echo} = prompts[0];
        question(prompt, !echo).then(answer => {
          finish([answer]);
        });
      },

      onWillConnect() {
        getLogger().info('Connecting...');
      },

      async onDidConnect(
        connection: BigDigClient,
        config: SshConnectionConfiguration,
      ) {
        getLogger().info(`Connected to server at: ${connection.getAddress()}`);
        // TODO(mbolin): Do this in a better way that does not interleave
        // with logging output. Maybe a simpler send/response would be a better
        // first sample and there could be a more complex example that uses more
        // of the Observable API.
        connection.onMessage('raw-data').subscribe(x => getLogger().info(x));

        // Once the connection is established, the common pattern is to pass
        // the WebSocketTransport to the business logic that needs to
        // communicate with the server.
        const client = new QuestionClient(connection, resolve);
        client.run();
      },

      onError(
        errorType: SshHandshakeErrorType,
        error: Error,
        config: SshConnectionConfiguration,
      ) {
        getLogger().error('CONNECTION FAILED');

        reject(error);
      },
    });
    sshHandshake.connect({
      host,
      sshPort: DEFAULT_SSH_PORT,
      username: getUsername(),
      pathToPrivateKey: privateKey,
      authMethod: 'PRIVATE_KEY',
      remoteServerCommand,
      remoteServerCustomParams: {},
      password: '', // Should probably be nullable because of the authMethod.
    });
  });
}

class QuestionClient {
  connection_: BigDigClient;
  exit_: () => void;

  constructor(connection: BigDigClient, exit: () => void) {
    this.connection_ = connection;
    this.exit_ = exit;
  }

  async run() {
    const data = await question(
      'Input to send to server or "exit" to exit: ',
      /* hideInput */ false,
    );

    if (data !== 'exit') {
      this.connection_.sendMessage('raw-data', data);
      await this.run();
    } else {
      this.exit_();
      this.connection_.dispose();
    }
  }
}

parseArgsAndRunMain();
