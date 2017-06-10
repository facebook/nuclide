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

import logger from './utils';
import {getConfig} from './config';
import {launchScriptForDummyConnection, uriToPath, getMode} from './helpers';
import fsPromise from 'nuclide-commons/fsPromise';
import {maybeToString} from 'nuclide-commons/string';
import nuclideUri from 'nuclide-commons/nuclideUri';
import invariant from 'assert';
import {shellParse} from 'nuclide-commons/string';

import type {Socket} from 'net';

async function getHackRoot(filePath: string): Promise<?string> {
  return fsPromise.findNearestFile('.hhconfig', filePath);
}

export async function setRootDirectoryUri(directoryUri: string): Promise<void> {
  const hackRootDirectory = await getHackRoot(directoryUri);
  logger.debug(
    `setRootDirectoryUri: from ${directoryUri} to ${maybeToString(hackRootDirectory)}`,
  );
  // TODO: make xdebug_includes.php path configurable from hhconfig.
  const hackDummyRequestFilePath = nuclideUri.join(
    hackRootDirectory ? hackRootDirectory : '',
    '/scripts/xdebug_includes.php',
  );

  // Use hackDummyRequestFilePath if possible.
  if (await fsPromise.exists(hackDummyRequestFilePath)) {
    getConfig().dummyRequestFilePath = hackDummyRequestFilePath;
  }
}

export function sendDummyRequest(): child_process$ChildProcess {
  return launchScriptForDummyConnection(getConfig().dummyRequestFilePath);
}

export function isDummyConnection(message: Object): boolean {
  const attributes = message.init.$;
  return attributes.fileuri.endsWith(getConfig().dummyRequestFilePath);
}

export function failConnection(socket: Socket, errorMessage: string): void {
  logger.error(errorMessage);
  socket.end();
  socket.destroy();
}

export function isCorrectConnection(
  isAttachConnection: boolean,
  message: Object,
): boolean {
  const {pid, idekeyRegex, attachScriptRegex, launchScriptPath} = getConfig();
  if (!message || !message.init || !message.init.$) {
    logger.error('Incorrect init');
    return false;
  }

  const init = message.init;
  if (
    !init.engine ||
    !init.engine ||
    !init.engine[0] ||
    init.engine[0]._.toLowerCase() !== 'xdebug'
  ) {
    logger.error('Incorrect engine');
    return false;
  }

  const attributes = init.$;
  if (
    attributes.xmlns !== 'urn:debugger_protocol_v1' ||
    attributes['xmlns:xdebug'] !== 'http://xdebug.org/dbgp/xdebug' ||
    attributes.language !== 'PHP'
  ) {
    logger.error('Incorrect attributes');
    return false;
  }

  if (isDummyConnection(message)) {
    return true;
  }

  // Reject connections via the launch port when attached.
  if (getMode() === 'attach' && !isAttachConnection) {
    return false;
  }

  const requestScriptPath = uriToPath(attributes.fileuri);
  if (getMode() === 'launch') {
    // TODO: Pass arguments separately from script path so this check can be simpler.
    invariant(launchScriptPath != null, 'Null launchScriptPath in launch mode');
    return shellParse(launchScriptPath)[0] === requestScriptPath;
  }

  // The regex is only applied to connections coming in during attach mode.  We do not use the
  // regex for launching.
  return (
    (!pid || attributes.appid === String(pid)) &&
    (!idekeyRegex || new RegExp(idekeyRegex).test(attributes.idekey)) &&
    (!attachScriptRegex ||
      new RegExp(attachScriptRegex).test(requestScriptPath))
  );
}
