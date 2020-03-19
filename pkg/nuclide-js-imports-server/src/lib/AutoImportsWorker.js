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

import crypto from 'crypto';
import {memoize} from 'lodash';
import log4js from 'log4js';
import os from 'os';
import fsPromise from 'nuclide-commons/fsPromise';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {compact} from 'nuclide-commons/observable';
import {arrayCompact, arrayFlatten} from 'nuclide-commons/collection';
import ExportCache from './ExportCache';
import {getExportsFromAst, idFromFileName} from './ExportManager';
import {Observable} from 'rxjs';
import {parseFile} from './AutoImportsManager';
import {initializeLoggerForWorker} from '../../logging/initializeLogging';
import {getConfigFromFlow} from '../Config';
import {niceSafeSpawn} from 'nuclide-commons/nice';
import invariant from 'assert';
import {getHasteName, hasteReduceName} from './HasteUtils';
import {watchDirectory, getFileIndex} from './file-index';
import {getComponentDefinitionFromAst} from '../../../nuclide-ui-component-tools-common';

import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {ComponentDefinition} from '../../../nuclide-ui-component-tools-common/lib/types';
import type {HasteSettings} from '../Config';
import type {JSExport} from './types';
import type {FileChange} from 'nuclide-watchman-helpers';
import type {FileIndex} from './file-index';

initializeLoggerForWorker();
const logger = log4js.getLogger('js-imports-worker');

const CONCURRENCY = 1;

// A bug in Node <= 7.4.0 makes IPC communication O(N^2).
// For this reason, it's very important to send updates in smaller batches.
const BATCH_SIZE = 500;

const cpus = os.cpus();
const MAX_WORKERS = cpus ? Math.max(1, Math.round(cpus.length / 2)) : 1;
const MIN_FILES_PER_WORKER = 100;

export type ExportUpdateForFile = {
  updateType: 'setExports' | 'deleteExports',
  file: NuclideUri,
  sha1?: string,
  exports: Array<JSExport>,
  componentDefinition?: ComponentDefinition,
};

async function main() {
  if (process.argv.length > 2 && process.argv[2] === '--child') {
    return runChild();
  }

  setupDisconnectedParentHandler();
  if (process.argv.length !== 3) {
    logger.warn('Incorrect number of arguments');
    return;
  }
  const root = process.argv[2];
  const configFromFlow = getConfigFromFlow(root);
  const {hasteSettings} = configFromFlow;

  // Listen for open files that should be indexed immediately
  setupParentMessagesHandler(root, hasteSettings);

  // Listen for file changes with Watchman that should update the index.
  watchDirectoryRecursively(root, hasteSettings);

  // Build up the initial index with all files recursively from the root.
  const index = await getFileIndex(root, configFromFlow);
  const newCache = new ExportCache({root, configFromFlow});

  // eslint-disable-next-line nuclide-internal/unused-subscription
  Observable.merge(
    indexDirectory(index, hasteSettings),
    indexNodeModules(index),
  ).subscribe(
    message => {
      sendUpdatesBatched(message);
      message.forEach(update => {
        if (update.sha1 != null) {
          const key = {filePath: update.file, sha1: update.sha1};
          const value = {exports: update.exports};
          if (update.componentDefinition != null) {
            newCache.set(key, {
              ...value,
              componentDefinition: update.componentDefinition,
            });
          } else {
            newCache.set(key, value);
          }
        }
      });
    },
    error => {
      logger.error('Received error while indexing files', error);
    },
    () => {
      newCache.save().then(success => {
        if (success) {
          logger.info(`Saved cache of size ${newCache.getByteSize()}`);
        } else {
          logger.warn(`Failed to save cache to ${newCache.getPath()}`);
        }
        disposeForGC(index, newCache);
      });
    },
  );
}

// It appears that the index/cache objects are retained by RxJS.
// To enable garbage collection after indexing, manually clear out the objects.
function disposeForGC(index: FileIndex, cache: ExportCache) {
  index.jsFiles.length = 0;
  index.nodeModulesPackageJsonFiles.length = 0;
  index.mainFiles.clear();
  index.exportCache._cache = (null: any);
  cache._cache = (null: any);
}

// Watches a directory for changes and reindexes files as needed.
function watchDirectoryRecursively(
  root: NuclideUri,
  hasteSettings: HasteSettings,
) {
  // eslint-disable-next-line nuclide-internal/unused-subscription
  watchDirectory(root)
    .mergeMap(
      (fileChange: FileChange) =>
        handleFileChange(root, fileChange, hasteSettings),
      CONCURRENCY,
    )
    .subscribe(
      () => {},
      error => {
        logger.error(`Failed to watch ${root}`, error);
      },
    );
}

async function handleFileChange(
  root: NuclideUri,
  fileChange: FileChange,
  hasteSettings: HasteSettings,
): Promise<void> {
  if (fileChange.exists) {
    // File created or modified
    const exportForFile = await getExportsForFileWithMain(
      fileChange.name,
      hasteSettings,
    );
    if (exportForFile) {
      sendUpdatesBatched([exportForFile]);
    }
  } else {
    // File deleted.
    sendUpdatesBatched([
      {
        updateType: 'deleteExports',
        file: fileChange.name,
        exports: [],
      },
    ]);
  }
}

// Exported for testing purposes.
export function indexDirectory(
  {root, exportCache, jsFiles, mainFiles}: FileIndex,
  hasteSettings: HasteSettings,
  maxWorkers?: number = MAX_WORKERS,
): Observable<Array<ExportUpdateForFile>> {
  let cachedUpdates = [];
  const files = [];
  jsFiles.forEach(({name, sha1}) => {
    const filePath = nuclideUri.join(root, name);
    if (sha1 != null) {
      const cached = exportCache.get({filePath, sha1});
      if (cached != null) {
        cachedUpdates.push({
          updateType: 'setExports',
          file: filePath,
          sha1,
          exports: cached.exports,
          componentDefinition: cached.componentDefinition,
        });
        return;
      }
    }
    files.push(name);
  });
  // To get faster results, we can send up the Haste reduced names as a default export.
  if (hasteSettings.isHaste && hasteSettings.useNameReducers) {
    cachedUpdates = cachedUpdates.concat(
      getHasteNames(root, files, hasteSettings),
    );
  }
  logger.info(`Indexing ${files.length} files`);
  // As an optimization, shuffle the files so that the work is well distributed.
  shuffle(files);
  const numWorkers = Math.min(
    Math.max(1, Math.floor(files.length / MIN_FILES_PER_WORKER)),
    maxWorkers,
  );
  const filesPerWorker = Math.ceil(files.length / numWorkers);
  const workerMessages = Observable.range(0, numWorkers)
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
            logger.warn(`Worker ${workerId} had received`, error);
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

  return Observable.of([cachedUpdates])
    .concat(workerMessages)
    .map(message => {
      // Inject the main files at this point, since we have a list of all map files.
      // This could be pure but it's just not worth the cost.
      const msg = arrayFlatten(arrayCompact(message));
      msg.forEach(update => {
        const mainDir = mainFiles.get(update.file);
        if (mainDir != null) {
          decorateExportUpdateWithMainDirectory(update, mainDir);
        }
      });
      return msg;
    });
}

const getPackageJson = memoize(async (dir: NuclideUri) => {
  // Bail out at the FS root.
  const parent = nuclideUri.dirname(dir);
  if (parent === dir) {
    return null;
  }

  const packageJson = nuclideUri.join(dir, 'package.json');
  let fileContents;
  try {
    fileContents = await fsPromise.readFile(packageJson, 'utf8');
  } catch (err) {
    return getPackageJson(parent);
  }
  try {
    return {
      dirname: dir,
      main: nuclideUri.resolve(
        dir,
        JSON.parse(fileContents).main || 'index.js',
      ),
    };
  } catch (err) {
    return null;
  }
});

/**
 * Returns the directory of the nearest package.json if `file` matches the "main" field.
 * This ensures that e.g. package/index.js can be imported as just "package".
 */
async function checkIfMain(file: NuclideUri): Promise<?NuclideUri> {
  const pkgJson = await getPackageJson(nuclideUri.dirname(file));
  return pkgJson != null &&
    nuclideUri.stripExtension(pkgJson.main) === nuclideUri.stripExtension(file)
    ? pkgJson.dirname
    : null;
}

function getExportsForFileWithMain(
  path: NuclideUri,
  hasteSettings: HasteSettings,
  fileContents?: string,
): Promise<?ExportUpdateForFile> {
  return Promise.all([
    getExportsForFile(path, hasteSettings, fileContents),
    checkIfMain(path),
  ]).then(([data, directoryForMainFile]) => {
    return data
      ? decorateExportUpdateWithMainDirectory(data, directoryForMainFile)
      : null;
  });
}

export async function getExportsForFile(
  file: NuclideUri,
  hasteSettings: HasteSettings,
  fileContents_?: string,
): Promise<?ExportUpdateForFile> {
  try {
    const fileContents =
      fileContents_ != null
        ? fileContents_
        : await fsPromise.readFile(file, 'utf8');
    const sha1 = crypto
      .createHash('sha1')
      .update(fileContents)
      .digest('hex');
    const update = {
      updateType: 'setExports',
      file,
      sha1,
      exports: [],
    };
    const ast = parseFile(fileContents);
    if (ast == null) {
      return update;
    }
    const hasteName = getHasteName(file, ast, hasteSettings);
    // TODO(hansonw): Support mixed-mode haste + non-haste imports.
    // For now, if Haste is enabled, we'll only suggest Haste imports.
    if (hasteSettings.isHaste && hasteName == null) {
      return update;
    }
    const exports = getExportsFromAst(file, ast);
    if (hasteName != null) {
      exports.forEach(jsExport => {
        jsExport.hasteName = hasteName;
      });
    }

    const updateObj: ExportUpdateForFile = {...update, exports};
    const settings = process.env.JS_IMPORTS_INITIALIZATION_SETTINGS;
    const {componentModulePathFilter} =
      settings != null ? JSON.parse(settings) : {};
    if (
      componentModulePathFilter == null ||
      file.includes(componentModulePathFilter)
    ) {
      const definition = getComponentDefinitionFromAst(file, ast);
      if (definition != null) {
        updateObj.componentDefinition = definition;
      }
    }
    return updateObj;
  } catch (err) {
    logger.error(`Unexpected error indexing ${file}`, err);
    return null;
  }
}

function setupDisconnectedParentHandler(): void {
  process.on('disconnect', () => {
    logger.debug('Parent process disconnected. AutoImportsWorker terminating.');
    process.exit(0);
  });
}

function setupParentMessagesHandler(
  root: string,
  hasteSettings: HasteSettings,
): void {
  process.on('message', async message => {
    const {fileUri, fileContents} = message;
    if (fileUri == null || fileContents == null) {
      logger.warn(
        'AutoImportsWorker received a message from parent without a fileUri or fileContents',
      );
      return;
    }
    try {
      const exportUpdate = await getExportsForFileWithMain(
        fileUri,
        hasteSettings,
        fileContents,
      );
      if (exportUpdate != null) {
        sendUpdatesBatched([exportUpdate]);
      }
    } catch (error) {
      logger.error(`Could not index file ${fileUri}. Error: ${error}`);
    }
  });
}

function getHasteNames(
  root: NuclideUri,
  files: Array<string>,
  hasteSettings: HasteSettings,
): Array<ExportUpdateForFile> {
  return files
    .map(
      (file): ?ExportUpdateForFile => {
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
              line: 1,
              hasteName,
              isTypeExport: false,
              isDefault: true,
            },
          ],
        };
      },
    )
    .filter(Boolean);
}
export function indexNodeModules({
  root,
  exportCache,
  nodeModulesPackageJsonFiles,
}: FileIndex): Observable<Array<ExportUpdateForFile>> {
  return Observable.from(nodeModulesPackageJsonFiles)
    .mergeMap(file => handleNodeModule(root, file, exportCache), MAX_WORKERS)
    .let(compact)
    .bufferCount(BATCH_SIZE);
}

async function handleNodeModule(
  root: NuclideUri,
  packageJsonFile: string,
  exportCache: ExportCache,
): Promise<?ExportUpdateForFile> {
  const file = nuclideUri.join(root, packageJsonFile);
  try {
    const fileContents = await fsPromise.readFile(file, 'utf8');
    const packageJson = JSON.parse(fileContents);
    const entryPoint = require.resolve(
      nuclideUri.join(nuclideUri.dirname(file), packageJson.main || ''),
    );
    const entryContents = await fsPromise.readFile(entryPoint, 'utf8');
    const sha1 = crypto
      .createHash('sha1')
      .update(entryContents)
      .digest('hex');
    const cachedUpdate = exportCache.get({filePath: entryPoint, sha1});
    if (cachedUpdate != null) {
      return {
        updateType: 'setExports',
        file: entryPoint,
        sha1,
        exports: cachedUpdate.exports,
        componentDefinition: cachedUpdate.componentDefinition,
      };
    }
    // TODO(hansonw): How do we handle haste modules inside Node modules?
    // For now we'll just treat them as usual.
    const update = await getExportsForFile(
      entryPoint,
      {
        isHaste: false,
        useNameReducers: false,
        nameReducers: [],
        nameReducerBlacklist: [],
        nameReducerWhitelist: [],
      },
      entryContents,
    );
    return update
      ? decorateExportUpdateWithMainDirectory(
          update,
          nuclideUri.join(root, nuclideUri.dirname(packageJsonFile)),
        )
      : update;
  } catch (error) {
    // Some modules just can't be required; that's perfectly normal.
    if (error.code !== 'MODULE_NOT_FOUND') {
      logger.warn(`Couldn't index ${file}`, error);
    }
    return null;
  }
}

function decorateExportUpdateWithMainDirectory(
  update: ExportUpdateForFile,
  directoryForMainFile: ?NuclideUri,
) {
  if (
    update.exports.length > 0 &&
    directoryForMainFile !== update.exports[0].directoryForMainFile
  ) {
    update.exports = update.exports.map(exp => {
      if (directoryForMainFile == null) {
        delete exp.directoryForMainFile;
        return exp;
      } else {
        return {...exp, directoryForMainFile};
      }
    });
  }
  return update;
}

function sendUpdatesBatched(exportsForFiles: Array<ExportUpdateForFile>): void {
  for (let i = 0; i < exportsForFiles.length; i += BATCH_SIZE) {
    send(exportsForFiles.slice(i, i + BATCH_SIZE));
  }
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

function runChild() {
  const SEND_CONCURRENCY = 10;

  setupDisconnectedParentHandler();
  if (process.argv.length !== 4) {
    logger.error('Child started with incorrect number of arguments');
    return;
  }
  const root: NuclideUri = process.argv[3];
  const {hasteSettings} = getConfigFromFlow(root);
  process.on('message', message => {
    const {files} = message;
    // eslint-disable-next-line nuclide-internal/unused-subscription
    Observable.from(files)
      .concatMap((file, index) => {
        // Note that we explicitly skip the main check here.
        // The parent process has a index of main files which is more efficient!
        return getExportsForFile(nuclideUri.join(root, file), hasteSettings);
      })
      .let(compact)
      .bufferCount(BATCH_SIZE)
      .mergeMap(send, SEND_CONCURRENCY)
      .subscribe({complete: () => process.exit(0)});
  });
}

function shuffle(array) {
  for (let i = array.length; i; i--) {
    const j = Math.floor(Math.random() * i);
    const temp = array[i - 1];
    array[i - 1] = array[j];
    array[j] = temp;
  }
}

main();
