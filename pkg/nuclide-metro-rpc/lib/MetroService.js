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
import type {
  MetroEvent,
  MetroStartCommand,
} from '../../nuclide-metro-rpc/lib/types';

import invariant from 'assert';
import {
  getStartCommandFromBuck,
  getStartCommandFromNodePackage,
} from './StartCommand';
import {ConnectableObservable, Observable} from 'rxjs';
import {observeProcess} from 'nuclide-commons/process';
import {shellQuote} from 'nuclide-commons/string';
import {parseMessages} from './parseMessages';
import xfetch from '../../commons-node/xfetch';
import WS from 'ws';
import {NO_METRO_PROJECT_ERROR, METRO_PORT_BUSY_ERROR} from './types';

/**
 * Get the command that would be used if you asked to start Metro at the given URI.
 * Returns null if Metro cannot be started there.
 * TODO: We need to have a solid concept of an "active project" that's consistent across Nuclide
 *       (i.e. where we should look for commands like this) and use that here. The current behavior
 *       of everything having its own algorithm is bad.
 */
export async function getStartCommand(
  projectRoot: NuclideUri,
): Promise<?MetroStartCommand> {
  return (
    (await getStartCommandFromBuck(projectRoot)) ||
    getStartCommandFromNodePackage(projectRoot)
  );
}

/**
 * Create an observable that runs Metro and collects it output.
 * IMPORTANT: You likely want to start Metro via the Atom service provided by nuclide-metro,
 * as it sets up Console integration and correctly shares its state across all of Nuclide.
 */
export function startMetro(
  projectRoot: NuclideUri,
  editorArgs: Array<string>,
  port: number = 8081,
  extraArgs: Array<string> = [],
): ConnectableObservable<MetroEvent> {
  const output = Observable.defer(() => getStartCommand(projectRoot))
    .switchMap(
      commandInfo =>
        commandInfo == null
          ? Observable.throw(noMetroProjectError())
          : Observable.of(commandInfo),
    )
    .switchMap(commandInfo => {
      const {command, cwd} = commandInfo;
      return observeProcess(
        command,
        extraArgs.concat(commandInfo.args || []).concat([`--port=${port}`]),
        {
          cwd,
          env: {
            ...process.env,
            REACT_EDITOR: shellQuote(editorArgs),
            // We don't want to pass the NODE_PATH from this process
            NODE_PATH: null,
          },
          killTreeWhenDone: true,
        },
      ).catch(error => {
        if (error.exitCode === 22) {
          return Observable.throw(metroPortBusyError());
        } else {
          return Observable.throw(error);
        }
      });
    })
    .filter(event => event.kind === 'stdout' || event.kind === 'stderr')
    .map(event => {
      invariant(event.kind === 'stdout' || event.kind === 'stderr');
      return event.data;
    });

  return parseMessages(output).publish();
}

function noMetroProjectError(): Error {
  const error = new Error('No Metro project found');
  (error: any).code = NO_METRO_PROJECT_ERROR;
  return error;
}

function metroPortBusyError(): Error {
  const error = new Error('Cannot start Metro because the port is busy');
  (error: any).code = METRO_PORT_BUSY_ERROR;
  return error;
}

export async function reloadApp(port: number = 8081): Promise<void> {
  return new Promise((resolve, reject) => {
    const url = `ws://localhost:${port}/message?role=interface&name=Nuclide`;
    const message = {
      version: 2,
      method: 'reload',
    };

    const ws = new WS(url);
    ws.onopen = () => {
      ws.send(JSON.stringify(message));
      ws.close();
      resolve();
    };
    ws.onerror = error => {
      reject(error);
    };
  });
}

export async function buildBundle(
  bundleName: string,
  platform: 'ios' | 'android',
  port: number = 8081,
): Promise<void> {
  const url = `http://localhost:${port}/${bundleName}.bundle?platform=${platform}&dev=true&minify=false`;
  await xfetch(url, {method: 'HEAD'});
}

export async function buildSourceMaps(
  bundleName: string,
  platform: 'ios' | 'android',
  port: number = 8081,
): Promise<void> {
  const url = `http://localhost:${port}/${bundleName}.map?platform=${platform}&dev=true&minify=false`;
  await xfetch(url, {method: 'HEAD'});
}
