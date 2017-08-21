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
import {getExportsFromAst, idFromFileName} from './ExportManager';
import {Observable} from 'rxjs';
import {parseFile} from './AutoImportsManager';
import {initializeLoggerForWorker} from '../../logging/initializeLogging';
import {WatchmanClient} from '../../../../nuclide-watchman-helpers/lib/main';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {getConfigFromFlow} from '../getConfig';
import {Settings} from '../Settings';
import {niceSafeSpawn} from 'nuclide-commons/nice';
import invariant from 'assert';

import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {JSExport} from './types';
import type {FileChange} from '../../../../nuclide-watchman-helpers/lib/WatchmanClient';
import type {WatchmanSubscriptionOptions} from '../../../../nuclide-watchman-helpers/lib/WatchmanSubscription';

// TODO(seansegal) Change 'DEBUG' to 'WARN' when development is complete
const logger = initializeLoggerForWorker('DEBUG');

// TODO: index the entry points of node_modules
const TO_IGNORE = ['**/node_modules/**', '**/VendorLib/**', '**/flow-typed/**'];
let toIgnoreRegex = '';

const CONCURRENCY = 1;

const BATCH_SIZE = 500;

const MAX_WORKERS = Math.round(os.cpus().length / 2);
const MIN_FILES_PER_WORKER = 100;

const disposables = new UniversalDisposable();
const updatedFiles: Set<NuclideUri> = new Set();

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
  const shouldIndexDefaultExportForEachFile =
    hasteSettings.isHaste &&
    Settings.hasteSettings.shouldAddAllFilesAsDefaultExport;

  toIgnoreRegex = hasteSettings.blacklistedDirs.join('|');

  // Listen for open files that should be indexed immediately
  setupParentMessagesHandler();

  // Listen for file changes with Watchman that should update the index.
  watchDirectoryRecursively(root);

  // Build up the initial index with all files recursively from the root.
  indexDirectoryAndSendExportsToParent(
    root,
    shouldIndexDefaultExportForEachFile,
  ).then(() => {
    if (Settings.indexNodeModulesWhiteList.find(regex => regex.test(root))) {
      logger.debug('Indexing node modules.');
      return indexNodeModulesAndSendToParent(root);
    }
  });
}

// Function should be called once when the server is initialized.
function indexDirectoryAndSendExportsToParent(
  root: NuclideUri,
  shouldIndexDefaultExportForEachFile?: boolean,
): Promise<void> {
  return new Promise((resolve, reject) => {
    indexDirectory(root, shouldIndexDefaultExportForEachFile).subscribe({
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
function watchDirectoryRecursively(root: NuclideUri) {
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
            handleFileChange(watchmanRoot, fileChange),
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
): Promise<void> {
  updatedFiles.add(nuclideUri.resolve(root, fileChange.name));
  if (fileChange.exists) {
    // File created or modified
    const exportForFile = await addFileToIndex(root, fileChange.name);
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
  shouldIndexDefaultExportForEachFile?: boolean,
): Observable<Array<ExportUpdateForFile>> {
  return Observable.fromPromise(
    listFilesWithWatchman(root).catch(() => listFilesWithGlob(root)),
  )
    .map(files =>
      // Filter out blacklisted files
      files.filter(
        file =>
          toIgnoreRegex.length === 0 ||
          !nuclideUri.join(root, file).match(toIgnoreRegex),
      ),
    )
    .do(files => {
      logger.info(`Indexing ${files.length} files`);
    })
    .do(files => {
      if (shouldIndexDefaultExportForEachFile) {
        logger.debug('Adding all files');
        addDefaultExportForEachFile(root, files);
        logger.debug('Sent all files');
      }
    })
    .switchMap(files => {
      // As an optimization, shuffle the files so that the work is well distributed.
      shuffle(files);
      const numWorkers = Math.min(
        Math.max(1, Math.floor(files.length / MIN_FILES_PER_WORKER)),
        MAX_WORKERS,
      );
      const filesPerWorker = Math.floor(files.length / numWorkers);
      // $FlowIgnore TODO: add Observable.range to flow-typed
      return Observable.range(0, numWorkers)
        .mergeMap(workerId => {
          return niceSafeSpawn(
            process.execPath,
            [
              nuclideUri.join(__dirname, 'AutoImportsWorker-entry.js'),
              '--child',
              root,
              shouldIndexDefaultExportForEachFile ? 'true' : 'false',
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
): Promise<?ExportUpdateForFile> {
  const file = nuclideUri.join(root, fileRelative);
  return Promise.all([
    getExportsForFile(file),
    checkIfMain(file),
  ]).then(([data, directoryForMainFile]) => {
    return data
      ? decorateExportUpdateWithMainDirectory(data, directoryForMainFile)
      : null;
  });
}

async function getExportsForFile(
  file: NuclideUri,
): Promise<?ExportUpdateForFile> {
  try {
    const fileContents = await fsPromise.readFile(file, 'utf8');
    const ast = parseFile(fileContents);
    if (ast == null) {
      return null;
    }
    const exports = getExportsFromAst(file, ast);
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

function setupParentMessagesHandler(): void {
  process.on('message', async message => {
    const {fileUri, fileContents} = message;
    if (fileUri == null || fileContents == null) {
      logger.warn(
        'AutoImportsWorker received a message from parent without a fileUri or fileContents',
      );
      return;
    }
    try {
      const ast = parseFile(fileContents);
      if (ast == null) {
        return null;
      }
      updatedFiles.add(fileUri);
      sendExportUpdateToParent([
        decorateExportUpdateWithMainDirectory(
          {
            file: fileUri,
            exports: getExportsFromAst(fileUri, ast),
            updateType: 'setExports',
          },
          await checkIfMain(fileUri, /* readFileSync */ true),
        ),
      ]);
    } catch (error) {
      logger.error(`Could not index file ${fileUri}. Error: ${error}`);
    }
  });
}

function addDefaultExportForEachFile(root: NuclideUri, files: Array<string>) {
  sendExportUpdateToParent(
    files.map((file): ExportUpdateForFile => {
      return {
        file,
        updateType: 'setExports',
        exports: [
          {
            id: idFromFileName(file),
            uri: nuclideUri.join(root, file),
            isTypeExport: false,
            isDefault: true,
          },
        ],
      };
    }),
  );
}
function indexNodeModulesAndSendToParent(root: NuclideUri): Promise<void> {
  return new Promise((resolve, reject) => {
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
    const entryPoint = nuclideUri.join(
      nuclideUri.dirname(packageJsonFile),
      packageJson.main || 'index.js',
    );
    const fileName = entryPoint.endsWith('.js')
      ? entryPoint
      : `${entryPoint}.js`;

    const update = await getExportsForFile(nuclideUri.join(root, fileName));
    return update
      ? decorateExportUpdateWithMainDirectory(
          update,
          nuclideUri.join(root, nuclideUri.dirname(packageJsonFile)),
        )
      : update;
  } catch (error) {
    logger.debug(`Couldn't index ${file}`, error);
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
    return ['not', ['match', patternToIgnore, 'wholename']];
  });
}

function runChild() {
  const SEND_CONCURRENCY = 10;

  setupDisconnectedParentHandler();
  if (process.argv.length !== 5) {
    logger.debug('Child started with incorrect number of arguments');
    return;
  }
  const root: NuclideUri = process.argv[3];
  const shouldAddAllFilesAsDefaultExport = process.argv[4] === 'true';
  process.on('message', message => {
    const {files} = message;
    Observable.from(files)
      .concatMap((file, index) => {
        return addFileToIndex(root, file);
      })
      .filter(
        exportForFile =>
          exportForFile != null &&
          (!shouldAddAllFilesAsDefaultExport ||
            !isOnlyDefaultExportForFile(exportForFile.exports)),
      )
      // $FlowIgnore TODO: Add .bufferCount to rxjs flow-typed
      .bufferCount(BATCH_SIZE)
      .mergeMap(sendExportUpdateToParent, SEND_CONCURRENCY)
      .subscribe({complete: exitCleanly});
  });
}

function isOnlyDefaultExportForFile(exportsForFile: Array<JSExport>): boolean {
  return (
    exportsForFile.length === 1 &&
    exportsForFile[0].isDefault &&
    !exportsForFile[0].isTypeExport &&
    exportsForFile[0].id === idFromFileName(exportsForFile[0].uri)
  );
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
