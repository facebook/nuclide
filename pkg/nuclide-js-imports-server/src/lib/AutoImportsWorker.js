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

import os from 'os';
import fs from 'fs';
import fsPromise from 'nuclide-commons/fsPromise';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {compact} from 'nuclide-commons/observable';
import {getExportsFromAst, idFromFileName} from './ExportManager';
import {Observable} from 'rxjs';
import {parseFile} from './AutoImportsManager';
import {initializeLoggerForWorker} from '../../logging/initializeLogging';
import {WatchmanClient} from '../../../nuclide-watchman-helpers/lib/main';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {getConfigFromFlow} from '../getConfig';
import {niceSafeSpawn} from 'nuclide-commons/nice';
import invariant from 'assert';
import {getHasteName, hasteReduceName} from './HasteUtils';

import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {HasteSettings} from '../getConfig';
import type {JSExport} from './types';
import type {FileChange} from '../../../nuclide-watchman-helpers/lib/WatchmanClient';
import type {WatchmanSubscriptionOptions} from '../../../nuclide-watchman-helpers/lib/WatchmanSubscription';

// TODO(seansegal) Change 'DEBUG' to 'WARN' when development is complete
const logger = initializeLoggerForWorker('DEBUG');

// TODO: index the entry points of node_modules
const TO_IGNORE = ['**/node_modules/**', '**/VendorLib/**', '**/flow-typed/**'];

const CONCURRENCY = 1;

const BATCH_SIZE = 500;

const MIN_FILES_PER_WORKER = 100;

const disposables = new UniversalDisposable();

// Directory ==> Main File. Null indicates no package.json file.
const mainFilesCache: Map<NuclideUri, ?NuclideUri> = new Map();

export type ExportUpdateForFile = {
  updateType: 'setExports' | 'deleteExports',
  file: NuclideUri,
  exports: Array<JSExport>,
};

function main() {
  if (process.argv.length > 2 && process.argv[2] === '--child') {
    return runChild();
  }

  setupDisconnectedParentHandler();
  if (process.argv.length !== 3) {
    logger.warn('Incorrect number of arguments');
    return;
  }
  const root = process.argv[2];
  const {hasteSettings} = getConfigFromFlow(root);

  // Listen for open files that should be indexed immediately
  setupParentMessagesHandler(hasteSettings);

  // Listen for file changes with Watchman that should update the index.
  watchDirectoryRecursively(root, hasteSettings);

  // Build up the initial index with all files recursively from the root.
  indexDirectoryAndSendExportsToParent(root, hasteSettings);

  indexNodeModulesAndSendToParent(root);
}

// Function should be called once when the server is initialized.
function indexDirectoryAndSendExportsToParent(
  root: NuclideUri,
  hasteSettings: HasteSettings,
): Promise<void> {
  return new Promise((resolve, reject) => {
    indexDirectory(root, hasteSettings).subscribe({
      next: exportForFile => {
        sendExportUpdateToParent(exportForFile);
      },
      error: err => {
        logger.error('Encountered error in AutoImportsWorker', err);
        return reject(err);
      },
      complete: () => {
        logger.info(`Finished indexing ${root}`);
        return resolve();
      },
    });
  });
}

// Watches a directory for changes and reindexes files as needed.
function watchDirectoryRecursively(
  root: NuclideUri,
  hasteSettings: HasteSettings,
) {
  logger.debug('Watching the directory', root);
  const watchmanClient = new WatchmanClient();
  disposables.add(watchmanClient);
  watchmanClient
    .watchDirectoryRecursive(
      root,
      'js-imports-subscription',
      getWatchmanSubscriptionOptions(root),
    )
    .then(watchmanSubscription => {
      disposables.add(watchmanSubscription);
      const watchmanRoot = watchmanSubscription.root;
      Observable.fromEvent(watchmanSubscription, 'change')
        .switchMap(x => Observable.from(x)) // convert to Observable<FileChange>
        .mergeMap(
          (fileChange: FileChange) =>
            handleFileChange(watchmanRoot, fileChange, hasteSettings),
          CONCURRENCY,
        )
        .subscribe(() => {});
    })
    .catch(error => {
      logger.error(error);
    });
}

async function handleFileChange(
  root: NuclideUri,
  fileChange: FileChange,
  hasteSettings: HasteSettings,
): Promise<void> {
  if (fileChange.exists) {
    // File created or modified
    const exportForFile = await addFileToIndex(
      root,
      fileChange.name,
      hasteSettings,
    );
    if (exportForFile) {
      sendExportUpdateToParent([exportForFile]);
    }
  } else {
    // File deleted.
    sendExportUpdateToParent([
      {
        updateType: 'deleteExports',
        file: nuclideUri.resolve(root, fileChange.name),
        exports: [],
      },
    ]);
  }
}

async function listFilesWithWatchman(root: NuclideUri): Promise<Array<string>> {
  const client = new WatchmanClient();
  try {
    return await client.listFiles(root, getWatchmanSubscriptionOptions(root));
  } finally {
    client.dispose();
  }
}

function listFilesWithGlob(root: NuclideUri): Promise<Array<string>> {
  return fsPromise.glob('**/*.js', {
    cwd: root,
    ignore: TO_IGNORE,
  });
}

function listNodeModulesWithGlob(root: NuclideUri): Promise<Array<string>> {
  return fsPromise.glob('node_modules/*/package.json', {
    cwd: root,
  });
}

// Exported for testing purposes.
export function indexDirectory(
  root: NuclideUri,
  hasteSettings: HasteSettings,
  maxWorkers?: number = Math.round(os.cpus().length / 2),
): Observable<Array<ExportUpdateForFile>> {
  return Observable.fromPromise(
    listFilesWithWatchman(root).catch(() => listFilesWithGlob(root)),
  )
    .do(files => {
      logger.info(`Indexing ${files.length} files`);
    })
    .do(files => {
      // As an optimization, we can send up the Haste reduced name as a default export.
      if (hasteSettings.isHaste && hasteSettings.useNameReducers) {
        logger.debug('Adding Haste default exports');
        addHasteNames(root, files, hasteSettings);
        logger.debug('Sent all Haste default exports');
      }
    })
    .switchMap(files => {
      // As an optimization, shuffle the files so that the work is well distributed.
      shuffle(files);
      const numWorkers = Math.min(
        Math.max(1, Math.floor(files.length / MIN_FILES_PER_WORKER)),
        maxWorkers,
      );
      const filesPerWorker = Math.floor(files.length / numWorkers);
      return Observable.range(0, numWorkers)
        .mergeMap(workerId => {
          return niceSafeSpawn(
            process.execPath,
            [
              nuclideUri.join(__dirname, 'AutoImportsWorker-entry.js'),
              '--child',
              root,
            ],
            {
              stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
            },
          );
        })
        .mergeMap((worker, workerId) => {
          invariant(typeof workerId === 'number'); // For Flow
          const updateStream = Observable.fromEvent(worker, 'message')
            .takeUntil(
              Observable.fromEvent(worker, 'error').do(error => {
                logger.debug(`Worker ${workerId} had received ${error}`);
              }),
            )
            .takeUntil(
              Observable.fromEvent(worker, 'exit').do(() => {
                logger.debug(`Worker ${workerId} terminated.`);
              }),
            );
          return Observable.merge(
            updateStream,
            Observable.timer(0)
              .do(() => {
                worker.send({
                  files: files.slice(
                    workerId * filesPerWorker,
                    Math.min((workerId + 1) * filesPerWorker, files.length),
                  ),
                });
              })
              .ignoreElements(),
          );
        });
    });
}

async function checkIfMain(
  file: NuclideUri,
  readFileSync?: boolean,
): Promise<?NuclideUri> {
  let currDir = file;
  while (true) {
    const lastDir = currDir;
    currDir = nuclideUri.dirname(currDir);
    if (lastDir === currDir) {
      // We've reached the root '/'
      return null;
    }
    const cachedMain = mainFilesCache.get(currDir);
    // eslint-disable-next-line eqeqeq
    if (cachedMain === null) {
      // The directory doesn't have a package.json with a main.
      continue;
    }

    if (
      // flowlint-next-line sketchy-null-string:off
      cachedMain &&
      nuclideUri.stripExtension(cachedMain) === nuclideUri.stripExtension(file)
    ) {
      return currDir;
    }
    const packageJson = nuclideUri.resolve(currDir, 'package.json');
    try {
      // Most of the time the file won't exist and the Promise should be rejected
      // quickly, so it's probably more efficient to await in this loop instead of
      // using Promise.all to queue up a promise for each directory in the file path.
      const fileContents = readFileSync
        ? fs.readFileSync(packageJson, 'utf8')
        : // eslint-disable-next-line no-await-in-loop
          await fsPromise.readFile(packageJson, 'utf8');

      const mainFile = nuclideUri.resolve(
        currDir,
        JSON.parse(fileContents).main || 'index.js',
      );
      mainFilesCache.set(currDir, mainFile);
      const isMainFile =
        nuclideUri.stripExtension(mainFile) === nuclideUri.stripExtension(file);
      return isMainFile ? currDir : null;
    } catch (error) {
      mainFilesCache.set(currDir, null);
    }
  }
}

function addFileToIndex(
  root: NuclideUri,
  fileRelative: NuclideUri,
  hasteSettings: HasteSettings,
): Promise<?ExportUpdateForFile> {
  const file = nuclideUri.join(root, fileRelative);
  return Promise.all([
    getExportsForFile(file, null, hasteSettings),
    checkIfMain(file),
  ]).then(([data, directoryForMainFile]) => {
    return data
      ? decorateExportUpdateWithMainDirectory(data, directoryForMainFile)
      : null;
  });
}

async function getExportsForFile(
  file: NuclideUri,
  fileContents_: ?string,
  hasteSettings: HasteSettings,
): Promise<?ExportUpdateForFile> {
  try {
    const fileContents =
      fileContents_ != null
        ? fileContents_
        : await fsPromise.readFile(file, 'utf8');
    const ast = parseFile(fileContents);
    if (ast == null) {
      return null;
    }
    const hasteName = getHasteName(file, ast, hasteSettings);
    // TODO(hansonw): Support mixed-mode haste + non-haste imports.
    // For now, if Haste is enabled, we'll only suggest Haste imports.
    if (hasteSettings.isHaste && hasteName == null) {
      return null;
    }
    const exports = getExportsFromAst(file, ast);
    if (hasteName != null) {
      exports.forEach(jsExport => {
        jsExport.hasteName = hasteName;
      });
    }
    return {file, exports, updateType: 'setExports'};
  } catch (err) {
    logger.warn(
      `Background process encountered error indexing ${file}:\n ${err}`,
    );
    return null;
  }
}

function getWatchmanSubscriptionOptions(
  root: NuclideUri,
): WatchmanSubscriptionOptions {
  return {
    expression: [
      'allof',
      ['match', '*.js'],
      ...getWatchmanMatchesFromIgnoredFiles(),
    ],
  };
}

function setupDisconnectedParentHandler(): void {
  process.on('disconnect', () => {
    logger.debug('Parent process disconnected. AutoImportsWorker terminating.');
    exitCleanly();
  });
}

function setupParentMessagesHandler(hasteSettings: HasteSettings): void {
  process.on('message', async message => {
    const {fileUri, fileContents} = message;
    if (fileUri == null || fileContents == null) {
      logger.warn(
        'AutoImportsWorker received a message from parent without a fileUri or fileContents',
      );
      return;
    }
    try {
      const exportUpdate = await getExportsForFile(
        fileUri,
        fileContents,
        hasteSettings,
      );
      if (exportUpdate != null) {
        sendExportUpdateToParent([exportUpdate]);
      }
    } catch (error) {
      logger.error(`Could not index file ${fileUri}. Error: ${error}`);
    }
  });
}

function addHasteNames(
  root: NuclideUri,
  files: Array<string>,
  hasteSettings: HasteSettings,
) {
  sendExportUpdateToParent(
    files
      .map((file): ?ExportUpdateForFile => {
        const hasteName = hasteReduceName(file, hasteSettings);
        if (hasteName == null) {
          return null;
        }
        return {
          file,
          updateType: 'setExports',
          exports: [
            {
              id: idFromFileName(hasteName),
              uri: nuclideUri.join(root, file),
              hasteName,
              isTypeExport: false,
              isDefault: true,
            },
          ],
        };
      })
      .filter(Boolean),
  );
}
function indexNodeModulesAndSendToParent(root: NuclideUri): Promise<void> {
  return new Promise((resolve, reject) => {
    logger.info('Indexing node modules.');
    indexNodeModules(root).subscribe({
      next: exportForFile => {
        if (exportForFile) {
          sendExportUpdateToParent([exportForFile]);
        }
      },
      error: err => {
        logger.error('Encountered error in AutoImportsWorker', err);
        return reject(err);
      },
      complete: () => {
        logger.debug(`Finished node modules for ${root}`);
        return resolve();
      },
    });
  });
}

export function indexNodeModules(
  root: NuclideUri,
): Observable<?ExportUpdateForFile> {
  return Observable.fromPromise(
    // TODO: Use Watchman for better performance.
    listNodeModulesWithGlob(root),
  )
    .switchMap(x => Observable.from(x)) // convert to Observable<string>
    .mergeMap(file => handleNodeModule(root, file), CONCURRENCY);
}

async function handleNodeModule(
  root: NuclideUri,
  packageJsonFile: NuclideUri,
): Promise<?ExportUpdateForFile> {
  const file = nuclideUri.join(root, packageJsonFile);
  try {
    const fileContents = await fsPromise.readFile(file, 'utf8');
    const packageJson = JSON.parse(fileContents);
    const entryPoint = require.resolve(
      nuclideUri.join(nuclideUri.dirname(file), packageJson.main || ''),
    );
    // TODO(hansonw): How do we handle haste modules inside Node modules?
    // For now we'll just treat them as usual.
    const update = await getExportsForFile(entryPoint, null, {
      isHaste: false,
      useNameReducers: false,
      nameReducers: [],
      nameReducerBlacklist: [],
      nameReducerWhitelist: [],
    });
    return update
      ? decorateExportUpdateWithMainDirectory(
          update,
          nuclideUri.join(root, nuclideUri.dirname(packageJsonFile)),
        )
      : update;
  } catch (error) {
    // Some modules just can't be required; that's perfectly normal.
    if (error.code !== 'MODULE_NOT_FOUND') {
      logger.debug(`Couldn't index ${file}`, error);
    }
    return null;
  }
}

function decorateExportUpdateWithMainDirectory(
  update: ExportUpdateForFile,
  directoryForMainFile: ?NuclideUri,
) {
  // flowlint-next-line sketchy-null-string:off
  if (directoryForMainFile) {
    update.exports = update.exports.map(exp => {
      return {...exp, directoryForMainFile};
    });
  }
  return update;
}

async function sendExportUpdateToParent(
  exportsForFiles: Array<ExportUpdateForFile>,
): Promise<void> {
  return send(
    exportsForFiles.filter(
      exportsForFile =>
        exportsForFile.updateType !== 'setExports' ||
        exportsForFile.exports.length > 0,
    ),
  );
}

async function send(message: mixed) {
  if (typeof process.send === 'function') {
    return new Promise((resolve, reject) => {
      invariant(typeof process.send === 'function');
      return process.send(
        message,
        err => (err == null ? resolve() : reject(err)),
      );
    });
  }
}

function getWatchmanMatchesFromIgnoredFiles() {
  return TO_IGNORE.map(patternToIgnore => {
    return [
      'not',
      ['match', patternToIgnore, 'wholename', {includedotfiles: true}],
    ];
  });
}

function runChild() {
  const SEND_CONCURRENCY = 10;

  setupDisconnectedParentHandler();
  if (process.argv.length !== 4) {
    logger.debug('Child started with incorrect number of arguments');
    return;
  }
  const root: NuclideUri = process.argv[3];
  const {hasteSettings} = getConfigFromFlow(root);
  process.on('message', message => {
    const {files} = message;
    Observable.from(files)
      .concatMap((file, index) => {
        return addFileToIndex(root, file, hasteSettings);
      })
      .let(compact)
      .filter(
        // Optimization: we already added default exports for all name-reduced Haste modules.
        exportForFile => !isDefaultExportHasteName(exportForFile.exports),
      )
      .bufferCount(BATCH_SIZE)
      .mergeMap(sendExportUpdateToParent, SEND_CONCURRENCY)
      .subscribe({complete: exitCleanly});
  });
}

function isDefaultExportHasteName(exportsForFile: Array<JSExport>): boolean {
  if (exportsForFile.length !== 1) {
    return false;
  }
  const {hasteName, id, isDefault, isTypeExport} = exportsForFile[0];
  return id === hasteName && isDefault && !isTypeExport;
}

function shuffle(array) {
  for (let i = array.length; i; i--) {
    const j = Math.floor(Math.random() * i);
    const temp = array[i - 1];
    array[i - 1] = array[j];
    array[j] = temp;
  }
}

function exitCleanly() {
  disposables.dispose();
  process.exit(0);
}

main();
