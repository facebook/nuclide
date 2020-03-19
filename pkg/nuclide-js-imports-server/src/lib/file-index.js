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

import type {FileChange} from 'nuclide-watchman-helpers';
import type {ConfigFromFlow} from '../Config';

import {getLogger} from 'log4js';
import {arrayFlatten} from 'nuclide-commons/collection';
import fsPromise from 'nuclide-commons/fsPromise';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {getOutputStream, spawn} from 'nuclide-commons/process';
import {asyncLimit} from 'nuclide-commons/promise';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import os from 'os';
import {Observable} from 'rxjs';
import {WatchmanClient} from 'nuclide-watchman-helpers';
import ExportCache from './ExportCache';

// prettier-ignore
const TO_IGNORE = [
  '**/node_modules/**',
  '**/VendorLib/**',
  '**/flow-typed/**',
  // @fb-only: '**/*react.proton.js',
  // @fb-only: '**/html/shared/react/*-dev.js',
  // @fb-only: '**/html/shared/react/*-prod.js',
];

export type FileWithHash = {
  // All files in the index will be relative to the given root.
  name: string,
  // Watchman supports retrieving the SHA1 of files from list-files.
  sha1: ?string,
};

export type FileIndex = {
  root: string,
  exportCache: ExportCache,
  // All non-ignored *.js files.
  jsFiles: Array<FileWithHash>,
  // All node_modules/*/package.json files.
  nodeModulesPackageJsonFiles: Array<string>,
  // A map of main files to their directories (as defined in package.json).
  mainFiles: Map<string, string>,
};

export async function getFileIndex(
  root: string,
  configFromFlow: ConfigFromFlow,
): Promise<FileIndex> {
  const client = new WatchmanClient();
  const exportCache = new ExportCache({root, configFromFlow});
  const loadPromise = exportCache.load().then(success => {
    const logger = getLogger('js-imports-server');
    if (success) {
      logger.info(`Restored exports cache: ${exportCache.getByteSize()} bytes`);
    } else {
      logger.warn(`Could not find cached exports at ${exportCache.getPath()}`);
    }
  });

  // This is easier and performant enough to express as a glob.
  const nodeModulesPackageJsonFilesPromise = globListFiles(
    root,
    'node_modules/*/package.json',
  );
  const [jsFiles, nodeModulesPackageJsonFiles, mainFiles] = await Promise.all([
    watchmanListFiles(client, root, '*.js').catch(err => {
      getLogger('js-imports-server').warn(
        'Failed to get files with Watchman: falling back to glob',
        err,
      );
      return hgListFiles(root, '**.js', TO_IGNORE)
        .catch(() => findListFiles(root, '*.js', TO_IGNORE))
        .catch(() => globListFiles(root, '**/*.js', TO_IGNORE))
        .catch(() => [])
        .then(filesWithoutHash);
    }),
    nodeModulesPackageJsonFilesPromise,
    watchmanListFiles(client, root, 'package.json')
      .then(files => getMainFiles(root, files.map(file => file.name)))
      .catch(() => {
        return hgListFiles(root, '**/package.json', TO_IGNORE)
          .catch(() => findListFiles(root, 'package.json', TO_IGNORE))
          .catch(() => globListFiles(root, '**/package.json', TO_IGNORE))
          .catch(() => [])
          .then(files => getMainFiles(root, files));
      }),
    loadPromise,
  ]);
  client.dispose();
  return {root, exportCache, jsFiles, nodeModulesPackageJsonFiles, mainFiles};
}

function getOutputLines(command, args, opts) {
  return spawn(command, args, opts).switchMap(proc => {
    return getOutputStream(proc).reduce((acc, result) => {
      if (result.kind === 'stdout') {
        acc.push(result.data.trimRight());
      }
      return acc;
    }, []);
  });
}

function hgListFiles(
  root: string,
  pattern: string,
  ignore: Array<string>,
): Promise<Array<string>> {
  const ignorePatterns = arrayFlatten(ignore.map(x => ['-X', x]));
  return getOutputLines('hg', ['files', '-I', pattern, ...ignorePatterns], {
    cwd: root,
  }).toPromise();
}

function findListFiles(
  root: string,
  pattern: string,
  ignore: Array<string>,
): Promise<Array<string>> {
  const ignorePatterns = arrayFlatten(ignore.map(x => ['-not', '-path', x]));
  return (
    getOutputLines('find', ['.', '-name', pattern, ...ignorePatterns], {
      cwd: root,
    })
      // Strip the leading "./".
      .map(files => files.map(f => f.substr(2)))
      .toPromise()
  );
}

function globListFiles(
  root: string,
  pattern: string,
  ignore?: Array<string>,
): Promise<Array<string>> {
  return fsPromise.glob(pattern, {cwd: root, ignore});
}

function watchmanListFiles(
  client: WatchmanClient,
  root: string,
  pattern: string,
): Promise<Array<FileWithHash>> {
  return client
    .listFiles(root, getWatchmanExpression(root, pattern))
    .then((files: Array<any>) =>
      files.map(data => {
        // content.sha1hex may be an object with an "error" property
        // if getting the sha1 of the file contents fails.
        const sha1: mixed = data['content.sha1hex'];
        return {name: data.name, sha1: typeof sha1 === 'string' ? sha1 : null};
      }),
    );
}

async function getMainFiles(
  root: string,
  packageJsons: Array<string>,
): Promise<Map<string, string>> {
  const cpus = os.cpus();
  const results = await asyncLimit(
    packageJsons,
    cpus ? Math.max(1, cpus.length) : 1,
    async packageJson => {
      try {
        const fullPath = nuclideUri.join(root, packageJson);
        const data = await fsPromise.readFile(fullPath, 'utf8');
        let main = JSON.parse(data).main || 'index.js';
        // Ignore things that go outside the scope of the package.json.
        if (main.startsWith('..')) {
          return null;
        }
        if (!main.endsWith('.js')) {
          main += '.js';
        }
        const dirname = nuclideUri.dirname(fullPath);
        // Note: the main file may not necessarily exist.
        // We don't really need to check existence here, since non-existent files
        // will never be indexed anyway.
        return [nuclideUri.resolve(dirname, main), dirname];
      } catch (err) {
        return null;
      }
    },
  );
  return new Map(results.filter(Boolean));
}

function filesWithoutHash(files: Array<string>): Array<FileWithHash> {
  return files.map(name => ({name, sha1: null}));
}

// TODO: watch node_modules and package.json files for changes.
export function watchDirectory(root: string): Observable<FileChange> {
  return Observable.defer(() => {
    const watchmanClient = new WatchmanClient();
    return Observable.using(
      () => new UniversalDisposable(watchmanClient),
      () =>
        Observable.fromPromise(
          watchmanClient.watchDirectoryRecursive(
            root,
            'js-imports-subscription',
            getWatchmanExpression(root, '*.js'),
          ),
        ).switchMap(watchmanSubscription => {
          return Observable.fromEvent(watchmanSubscription, 'change').switchMap(
            (changes: Array<FileChange>) =>
              Observable.from(
                changes
                  .map(change => {
                    const name = nuclideUri.join(
                      watchmanSubscription.root,
                      change.name,
                    );
                    if (!nuclideUri.contains(root, name)) {
                      return null;
                    }
                    return {
                      ...change,
                      name,
                    };
                  })
                  .filter(Boolean),
              ),
          );
        }),
    );
  });
}

function getWatchmanExpression(root: string, pattern: string) {
  return {
    expression: [
      'allof',
      ['match', pattern],
      ['type', 'f'],
      ...getWatchmanMatchesFromIgnoredFiles(),
    ],
    fields: ['name', 'content.sha1hex'],
  };
}

function getWatchmanMatchesFromIgnoredFiles() {
  return TO_IGNORE.map(patternToIgnore => {
    return [
      'not',
      ['match', patternToIgnore, 'wholename', {includedotfiles: true}],
    ];
  });
}
