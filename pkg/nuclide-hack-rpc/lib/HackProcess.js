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

import typeof * as HackConnectionService from './HackConnectionService';
import type {FileEditEvent} from '../../nuclide-open-files-rpc/lib/rpc-types';
import type {TextEdit} from './HackConnectionService';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {FileVersion} from '../../nuclide-open-files-rpc/lib/rpc-types';
import type {HackCompletionsResult} from './rpc-types';
import type {AutocompleteResult} from '../../nuclide-language-service/lib/LanguageService';

import nuclideUri from 'nuclide-commons/nuclideUri';
import {runCommand, spawn} from 'nuclide-commons/process';
import {maybeToString} from 'nuclide-commons/string';
import {RpcProcess} from '../../nuclide-rpc';
import {getHackCommand, findHackConfigDir} from './hack-config';
import {ServiceRegistry, loadServicesConfig} from '../../nuclide-rpc';
import {localNuclideUriMarshalers} from '../../nuclide-marshalers-common';
import invariant from 'assert';
import {
  FileCache,
  FileVersionNotifier,
  FileEventKind,
} from '../../nuclide-open-files-rpc';
import {Cache, DISPOSE_VALUE} from 'nuclide-commons/cache';
import {Observable} from 'rxjs';
import {getBufferAtVersion} from '../../nuclide-open-files-rpc';
import {hasPrefix, convertCompletions} from './Completions';
import {HACK_FILE_EXTENSIONS} from '../../nuclide-hack-common/lib/constants';
import {findHackPrefix} from '../../nuclide-hack-common/lib/autocomplete';

// From hphp/hack/src/utils/exit_status.ml
const HACK_SERVER_ALREADY_EXISTS_EXIT_CODE = 77;
const HACK_IDE_NEW_CLIENT_CONNECTED_EXIT_CODE = 207;

// This isn't truly correct, but this will be deprecated with the LSP anyway.
const MAX_HACK_AUTOCOMPLETE_ITEMS = 50;

import {logger} from './hack-config';

let serviceRegistry: ?ServiceRegistry = null;

function getServiceRegistry(): ServiceRegistry {
  if (serviceRegistry == null) {
    serviceRegistry = new ServiceRegistry(
      [localNuclideUriMarshalers],
      loadServicesConfig(nuclideUri.join(__dirname, '..')),
    );
  }
  return serviceRegistry;
}

function logMessage(direction: string, message: string): void {
  logger.trace(`Hack Connection message ${direction}: '${message}'`);
}

class HackProcess {
  _hhconfigPath: string;
  _fileCache: FileCache;
  _fileSubscription: rxjs$ISubscription;
  _fileVersionNotifier: FileVersionNotifier;
  _process: RpcProcess;

  constructor(
    fileCache: FileCache,
    name: string,
    processStream: Observable<child_process$ChildProcess>,
    hhconfigPath: string,
  ) {
    this._process = new RpcProcess(
      name,
      getServiceRegistry(),
      processStream,
      logMessage,
    );
    this._fileCache = fileCache;
    this._fileVersionNotifier = new FileVersionNotifier();
    this._hhconfigPath = hhconfigPath;

    this._fileSubscription = fileCache
      .observeFileEvents()
      // TODO: Filter on hhconfigPath
      .filter(fileEvent => {
        const fileExtension = nuclideUri.extname(
          fileEvent.fileVersion.filePath,
        );
        return HACK_FILE_EXTENSIONS.indexOf(fileExtension) !== -1;
      })
      .combineLatest(Observable.fromPromise(this.getConnectionService()))
      .subscribe(([fileEvent, service]) => {
        const filePath = fileEvent.fileVersion.filePath;
        const version = fileEvent.fileVersion.version;
        switch (fileEvent.kind) {
          case FileEventKind.OPEN:
            service.didOpenFile(filePath, version, fileEvent.contents);
            // TODO: Remove this once hack handles the initial contents in the open message.
            service.didChangeFile(filePath, version, [
              {
                text: fileEvent.contents,
              },
            ]);
            break;
          case FileEventKind.CLOSE:
            service.didCloseFile(filePath);
            break;
          case FileEventKind.EDIT:
            service.didChangeFile(filePath, version, [
              editToHackEdit(fileEvent),
            ]);
            break;
          case FileEventKind.SAVE:
            break;
          default:
            (fileEvent.kind: empty);
            throw new Error(`Unexpected FileEvent kind: ${fileEvent.kind}`);
        }
        this._fileVersionNotifier.onEvent(fileEvent);
      });
  }

  getRoot(): string {
    return this._hhconfigPath;
  }

  getConnectionService(): Promise<HackConnectionService> {
    invariant(
      !this._process.isDisposed(),
      'getService called on disposed hackProcess',
    );
    return this._process.getService('HackConnectionService');
  }

  observeExitMessage() {
    return this._process.observeExitMessage();
  }

  async getBufferAtVersion(
    fileVersion: FileVersion,
  ): Promise<?simpleTextBuffer$TextBuffer> {
    const buffer = await getBufferAtVersion(fileVersion);
    // Must also wait for edits to be sent to Hack
    if (!await this._fileVersionNotifier.waitForBufferAtVersion(fileVersion)) {
      return null;
    }
    return buffer != null && buffer.changeCount === fileVersion.version
      ? buffer
      : null;
  }

  async getAutocompleteSuggestions(
    fileVersion: FileVersion,
    position: atom$Point,
    activatedManually: boolean,
  ): Promise<?AutocompleteResult> {
    const filePath = fileVersion.filePath;
    logger.debug(
      `Attempting Hack Autocomplete: ${filePath}, ${position.toString()}`,
    );
    const buffer = await this.getBufferAtVersion(fileVersion);
    if (buffer == null) {
      return {isIncomplete: false, items: []};
    }
    const contents = buffer.getText();
    const offset = buffer.characterIndexForPosition(position);

    const replacementPrefix = findHackPrefix(buffer, position);
    if (replacementPrefix === '' && !hasPrefix(buffer, position)) {
      return null;
    }

    const line = position.row + 1;
    const column = position.column + 1;
    const service = this.getConnectionService();

    logger.debug('Got Hack Service');
    // TODO: Include version number to ensure agreement on file version.
    const unfilteredItems: ?HackCompletionsResult = await (await service).getCompletions(
      filePath,
      {line, column},
    );
    if (unfilteredItems == null) {
      return null;
    }
    const isIncomplete = unfilteredItems.length >= MAX_HACK_AUTOCOMPLETE_ITEMS;

    const items = convertCompletions(
      contents,
      offset,
      replacementPrefix,
      unfilteredItems,
    );

    return {isIncomplete, items};
  }

  async _disconnect(): Promise<void> {
    // Attempt to send disconnect message before shutting down connection
    try {
      logger.debug('Attempting to disconnect cleanly from HackProcess');
      (await this.getConnectionService()).disconnect();
    } catch (e) {
      // Failing to send the shutdown is not fatal...
      // ... continue with shutdown.
      logger.error('Hack Process died before disconnect() could be sent.');
    }
  }

  dispose(): void {
    this._disconnect();
    this._process.dispose();
    this._fileVersionNotifier.dispose();
    this._fileSubscription.unsubscribe();
  }
}

// Maps FileCache => hack config dir => HackProcess
const processes: Cache<
  FileCache,
  Cache<NuclideUri, Promise<HackProcess>>,
> = new Cache(
  fileCache =>
    new Cache(
      hackRoot => retryCreateHackProcess(fileCache, hackRoot),
      value => {
        value.then(DISPOSE_VALUE);
      },
    ),
  DISPOSE_VALUE,
);

// TODO: Is there any situation where these can be disposed before the
//       remote connection is terminated?
// Remove fileCache when the remote connection shuts down
processes.observeKeys().subscribe(fileCache => {
  fileCache
    .observeFileEvents()
    .ignoreElements()
    .subscribe(
      undefined, // next
      undefined, // error
      () => {
        logger.info('fileCache shutting down.');
        closeProcesses(fileCache);
      },
    );
});

export async function getHackProcess(
  fileCache: FileCache,
  filePath: string,
): Promise<HackProcess> {
  const configDir = await findHackConfigDir(filePath);
  if (configDir == null) {
    throw new Error('Failed to find Hack config directory');
  }
  return processes.get(fileCache).get(configDir);
}

// Ensures that the only attached HackProcesses are those for the given configPaths.
// Closes all HackProcesses not in configPaths, and starts new HackProcesses for any
// paths in configPaths.
export function ensureProcesses(
  fileCache: FileCache,
  configPaths: Set<NuclideUri>,
): void {
  logger.info(`Hack ensureProcesses. ${Array.from(configPaths).join(', ')}`);
  processes.get(fileCache).setKeys(configPaths);
}

// Closes all HackProcesses for the given fileCache.
export function closeProcesses(fileCache: FileCache): void {
  logger.info('Hack closeProcesses');
  if (processes.has(fileCache)) {
    logger.info(
      `Shutting down HackProcesses ${Array.from(
        processes.get(fileCache).keys(),
      ).join(',')}`,
    );
    processes.delete(fileCache);
  }
}

async function retryCreateHackProcess(
  fileCache: FileCache,
  hackRoot: string,
): Promise<HackProcess> {
  let hackProcess = null;
  let waitTimeMs = 500;
  // Disable no-await-in-loop because we do want these iterations to be serial.
  /* eslint-disable no-await-in-loop */
  while (hackProcess == null) {
    try {
      hackProcess = await createHackProcess(fileCache, hackRoot);
    } catch (e) {
      logger.error(`Couldn't create HackProcess: ${e.message}`);
      logger.error(`Waiting ${waitTimeMs}ms before retrying...`);

      await new Promise(resolve => setTimeout(resolve, waitTimeMs));
      waitTimeMs *= 2;

      const hackProcessNeeded =
        processes.has(fileCache) && processes.get(fileCache).has(hackRoot);

      // If the HackProcess is no longer needed, or we would be waiting
      // longer than a few seconds, just give up.
      if (!hackProcessNeeded || waitTimeMs > 4000) {
        logger.error(`Giving up on creating HackProcess: ${e.message}`);
        // Remove the (soon-to-be) rejected promise from our processes cache so
        // that the next time someone attempts to get this connection, we'll try
        // to create it.
        if (hackProcessNeeded) {
          processes.get(fileCache).delete(hackRoot);
        }
        throw e;
      }
    }
  }
  /* eslint-enable no-await-in-loop */
  return hackProcess;
}

async function createHackProcess(
  fileCache: FileCache,
  configDir: string,
): Promise<HackProcess> {
  const command = await getHackCommand();
  if (command === '') {
    throw new Error("Couldn't find Hack command");
  }

  logger.info(`Creating new hack connection for ${configDir}: ${command}`);
  logger.info(`Current PATH: ${maybeToString(process.env.PATH)}`);
  try {
    await runCommand(command, ['start', configDir], {
      isExitError: ({exitCode}) =>
        !(exitCode === 0 || exitCode === HACK_SERVER_ALREADY_EXISTS_EXIT_CODE),
    }).toPromise();
  } catch (err) {
    if (err.exitCode != null) {
      throw new Error(
        `Hack server start failed with code: ${String(err.exitCode)}`,
      );
    }
    throw new Error(`Hack server failed with error: ${err.message}`);
  }
  const processStream = spawn(command, ['ide', configDir]);
  const hackProcess = new HackProcess(
    fileCache,
    `HackProcess-${configDir}`,
    processStream,
    configDir,
  );

  // If the process exits unexpectedly, create a new one immediately.
  const startTime = Date.now();
  hackProcess.observeExitMessage().subscribe(message => {
    // Dispose the process by removing it from the cache.
    if (processes.has(fileCache)) {
      processes.get(fileCache).delete(configDir);
    }
    if (
      message != null &&
      message.exitCode === HACK_IDE_NEW_CLIENT_CONNECTED_EXIT_CODE
    ) {
      logger.info('Not reconnecting Hack process--another client connected');
      return;
    }
    // If the process exited too quickly (possibly due to a crash), don't get
    // stuck in a loop creating and crashing it.
    const processUptimeMs = Date.now() - startTime;
    if (processUptimeMs < 1000) {
      logger.error('Hack process exited in <1s; not reconnecting');
      return;
    }
    logger.info(`Reconnecting with new HackProcess for ${configDir}`);
    processes.get(fileCache).get(configDir);
  });

  return hackProcess;
}

function editToHackEdit(editEvent: FileEditEvent): TextEdit {
  const {start, end} = editEvent.oldRange;
  return {
    range: {
      start: {line: start.row + 1, column: start.column + 1},
      end: {line: end.row + 1, column: end.column + 1},
    },
    text: editEvent.newText,
  };
}

export function observeConnections(
  fileCache: FileCache,
): Observable<HackConnectionService> {
  logger.info('observing connections');
  return processes
    .get(fileCache)
    .observeValues()
    .switchMap(process => process)
    .filter(process => process != null)
    .switchMap(process => {
      invariant(process != null);
      logger.info(`Observing process ${process._hhconfigPath}`);
      return process.getConnectionService();
    });
}
