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
import type {ConnectableObservable} from 'rxjs';
import type {LegacyProcessMessage} from 'nuclide-commons/process';
import type {LRUCache} from 'lru-cache';

import invariant from 'assert';
import {Observable} from 'rxjs';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {
  exitEventToMessage,
  getOriginalEnvironment,
  observeProcess,
  runCommand,
  scriptifyCommand,
} from 'nuclide-commons/process';
import {compact} from 'nuclide-commons/observable';
import {niceObserveProcess} from 'nuclide-commons/nice';
import fsPromise from 'nuclide-commons/fsPromise';
import {fetchFilesChangedSinceRevision} from '../../nuclide-hg-rpc/lib/hg-revision-state-helpers';
import {expressionForRevisionsBeforeHead} from '../../nuclide-hg-rpc/lib/hg-revision-expression-helpers';
import {findHgRepository} from '../../nuclide-source-control-helpers';
import {getLogger} from 'log4js';
import LRU from 'lru-cache';

const ARC_CONFIG_FILE_NAME = '.arcconfig';

export type ArcDiagnostic = {
  type: 'Error' | 'Warning',
  text: string,
  filePath: NuclideUri,
  row: number,
  col: number,
  code: ?string,

  // For autofix
  original?: string,
  replacement?: string,
};

const CACHE_TIME = 30 * 1000; // 30 seconds
const arcConfigDirectoryMap: LRUCache<NuclideUri, ?NuclideUri> = LRU({
  maxAge: CACHE_TIME,
});
const arcProjectMap: LRUCache<?NuclideUri, ?Object> = LRU({maxAge: CACHE_TIME});

export async function findArcConfigDirectory(
  fileName: NuclideUri,
): Promise<?NuclideUri> {
  if (!arcConfigDirectoryMap.has(fileName)) {
    const result = await fsPromise.findNearestFile(
      ARC_CONFIG_FILE_NAME,
      fileName,
    );
    arcConfigDirectoryMap.set(fileName, result);
  }
  return arcConfigDirectoryMap.get(fileName);
}

export async function readArcConfig(fileName: NuclideUri): Promise<?any> {
  const arcConfigDirectory = await findArcConfigDirectory(fileName);
  // flowlint-next-line sketchy-null-string:off
  if (!arcConfigDirectory) {
    return null;
  }
  if (!arcProjectMap.has(arcConfigDirectory)) {
    const arcconfigFile = nuclideUri.join(
      arcConfigDirectory,
      ARC_CONFIG_FILE_NAME,
    );
    const contents = await fsPromise.readFile(arcconfigFile, 'utf8');
    invariant(typeof contents === 'string');
    const result = JSON.parse(contents);
    arcProjectMap.set(arcConfigDirectory, result);
  }
  return arcProjectMap.get(arcConfigDirectory);
}

export async function getArcConfigKey(
  fileName: NuclideUri,
  key: string,
): Promise<?string> {
  return _callArcGetConfig(fileName, key)
    .map(s => s.split(':')[1].trim().replace(/"/g, ''))
    .toPromise();
}

export async function findArcProjectIdOfPath(
  fileName: NuclideUri,
): Promise<?string> {
  const project = await readArcConfig(fileName);
  return project ? project.project_id || project['project.name'] : null;
}

export async function findArcProjectIdAndDirectory(
  fileName: NuclideUri,
): Promise<?{
  projectId: string,
  directory: NuclideUri,
}> {
  const directory = await findArcConfigDirectory(fileName);
  if (directory != null) {
    // This will hit the directory map cache.
    const projectId = await findArcProjectIdOfPath(fileName);
    if (projectId != null) {
      return {projectId, directory};
    }
  }
  return null;
}

export async function getProjectRelativePath(
  fileName: NuclideUri,
): Promise<?string> {
  const arcPath = await findArcConfigDirectory(fileName);
  // flowlint-next-line sketchy-null-string:off
  return arcPath && fileName ? nuclideUri.relative(arcPath, fileName) : null;
}

export function findDiagnostics(
  path: NuclideUri,
  skip: Array<string>,
): ConnectableObservable<ArcDiagnostic> {
  return Observable.fromPromise(findArcConfigDirectory(path))
    .switchMap(arcDir => {
      if (arcDir == null) {
        return Observable.empty();
      }
      return execArcLint(arcDir, [path], skip);
    })
    .publish();
}

async function getMercurialHeadCommitChanges(
  filePath: string,
): Promise<Array<string>> {
  const hgRepoDetails = findHgRepository(filePath);
  if (hgRepoDetails == null) {
    throw new Error('Cannot find source control root to diff from');
  }
  const filesChanged = await fetchFilesChangedSinceRevision(
    expressionForRevisionsBeforeHead(1),
    hgRepoDetails.workingDirectoryPath,
  )
    .refCount()
    .toPromise();
  if (filesChanged == null) {
    throw new Error('Failed to fetch commit changed files while diffing');
  }
  return filesChanged;
}

async function getCommitBasedArcConfigDirectory(
  filePath: string,
): Promise<?string> {
  // TODO Support other source control types file changes (e.g. `git`).
  const filesChanged = await getMercurialHeadCommitChanges(filePath);
  let configLookupPath = null;
  if (filesChanged.length > 0) {
    configLookupPath = fsPromise.getCommonAncestorDirectory(filesChanged);
  } else {
    configLookupPath = filePath;
  }
  return findArcConfigDirectory(configLookupPath);
}

async function getArcExecOptions(cwd: string): Promise<Object> {
  const options = {
    cwd,
    env: {
      ...(await getOriginalEnvironment()),
      // Setting the editor to a non-existant tool to prevent operations that rely
      // on the user's default editor from attempting to open up when needed.
      HGEDITOR: 'true',
    },
  };
  return options;
}

function _callArcGetConfig(
  filePath: NuclideUri,
  name: string,
): Observable<string> {
  const args = ['get-config', name];
  return Observable.fromPromise(getArcExecOptions(filePath)).switchMap(opts =>
    runCommand('arc', args, opts),
  );
}

function _callArcDiff(
  filePath: NuclideUri,
  extraArcDiffArgs: Array<string>,
): Observable<{stderr?: string, stdout?: string}> {
  const args = ['diff', '--json'].concat(extraArcDiffArgs);

  return Observable.fromPromise(getCommitBasedArcConfigDirectory(filePath))
    .flatMap((arcConfigDir: ?string) => {
      if (arcConfigDir == null) {
        return Observable.throw(
          new Error(
            'Failed to find Arcanist config.  Is this project set up for Arcanist?',
          ),
        );
      }
      return Observable.fromPromise(
        getArcExecOptions(arcConfigDir),
      ).switchMap(opts => {
        const scriptArgs = scriptifyCommand('arc', args, opts);
        return compact(
          observeProcess(...scriptArgs)
            .catch(error => Observable.of({kind: 'error', error})) // TODO(T17463635)
            .map(event => {
              switch (event.kind) {
                case 'stdout':
                  return {stdout: event.data};
                case 'stderr':
                  return {stderr: event.data};
                default:
                  return null;
              }
            }),
        );
      });
    })
    .share();
}

function getArcDiffParams(
  lintExcuse: ?string,
  isPrepareMode?: boolean = false,
): Array<string> {
  const args = [];
  if (isPrepareMode) {
    args.push('--prepare');
  }

  if (lintExcuse != null && lintExcuse !== '') {
    args.push('--nolint', '--nounit', '--excuse', lintExcuse);
  }

  return args;
}

export function createPhabricatorRevision(
  filePath: NuclideUri,
  isPrepareMode: boolean,
  lintExcuse: ?string,
): ConnectableObservable<{stderr?: string, stdout?: string}> {
  const args = ['--verbatim', ...getArcDiffParams(lintExcuse, isPrepareMode)];
  return _callArcDiff(filePath, args).publish();
}

export function updatePhabricatorRevision(
  filePath: NuclideUri,
  message: string,
  allowUntracked: boolean,
  lintExcuse: ?string,
  verbatimModeEnabled: boolean,
): ConnectableObservable<{stderr?: string, stdout?: string}> {
  const baseArgs = ['-m', message, ...getArcDiffParams(lintExcuse)];
  const args = [...(verbatimModeEnabled ? ['--verbatim'] : []), ...baseArgs];

  if (allowUntracked) {
    args.push('--allow-untracked');
  }
  return _callArcDiff(filePath, args).publish();
}

export function execArcPull(
  cwd: NuclideUri,
  fetchLatest: boolean,
  allowDirtyChanges: boolean,
): ConnectableObservable<LegacyProcessMessage> {
  // TODO(T17463635)
  const args = ['pull'];
  if (fetchLatest) {
    args.push('--latest');
  }

  if (allowDirtyChanges) {
    args.push('--allow-dirty');
  }

  return Observable.fromPromise(getArcExecOptions(cwd))
    .switchMap(
      opts =>
        observeProcess('arc', args, {
          ...opts,
          /* TODO(T17353599) */ isExitError: () => false,
        }).catch(error => Observable.of({kind: 'error', error})), // TODO(T17463635)
    )
    .publish();
}

export function execArcLand(
  cwd: NuclideUri,
): ConnectableObservable<LegacyProcessMessage> {
  // TODO(T17463635)
  const args = ['land'];
  return Observable.fromPromise(getArcExecOptions(cwd))
    .switchMap(
      opts =>
        observeProcess('arc', args, {
          ...opts,
          /* TODO(T17353599) */ isExitError: () => false,
        }).catch(error => Observable.of({kind: 'error', error})), // TODO(T17463635)
    )
    .publish();
}

export function execArcPatch(
  cwd: NuclideUri,
  differentialRevision: string,
): ConnectableObservable<LegacyProcessMessage> {
  // TODO(T17463635)
  const args = ['patch'];
  if (differentialRevision.match(/^[0-9]+$/)) {
    args.push('--nocommit', '--diff');
  }
  args.push(differentialRevision);
  return Observable.fromPromise(getArcExecOptions(cwd))
    .switchMap(
      opts =>
        observeProcess('arc', args, {
          ...opts,
          /* TODO(T17353599) */ isExitError: () => false,
        }).catch(error => Observable.of({kind: 'error', error})), // TODO(T17463635)
    )
    .publish();
}

function execArcLint(
  cwd: string,
  filePaths: Array<NuclideUri>,
  skip: Array<string>,
): Observable<ArcDiagnostic> {
  const args: Array<string> = ['lint', '--output', 'json', ...filePaths];
  if (skip.length > 0) {
    args.push('--skip', skip.join(','));
  }
  return Observable.fromPromise(getArcExecOptions(cwd))
    .switchMap(
      opts =>
        niceObserveProcess('arc', args, {
          ...opts,
          killTreeWhenDone: true,
        }).catch(error => Observable.of({kind: 'error', error})), // TODO(T17463635)
    )
    .mergeMap(event => {
      if (event.kind === 'error') {
        return Observable.throw(event.error);
      } else if (event.kind === 'exit') {
        if (event.exitCode !== 0) {
          return Observable.throw(Error(exitEventToMessage(event)));
        }
        return Observable.empty();
      } else if (event.kind === 'stderr') {
        return Observable.empty();
      }
      // Arc lint outputs multiple JSON objects on multiple lines.
      const stdout = event.data.trim();
      if (stdout === '') {
        return Observable.empty();
      }
      let json;
      try {
        json = JSON.parse(stdout);
      } catch (error) {
        getLogger('nuclide-arcanist-rpc').warn(
          'Error parsing `arc lint` JSON output',
          stdout,
        );
        return Observable.empty();
      }
      const output = new Map();
      for (const file of Object.keys(json)) {
        const errorsToAdd = json[file];
        let errors = output.get(file);
        if (errors == null) {
          errors = [];
          output.set(file, errors);
        }
        for (const error of errorsToAdd) {
          errors.push(error);
        }
      }

      const lints = [];
      for (const file of filePaths) {
        // TODO(7876450): For some reason, this does not work for particular
        // values of pathToFile. Depending on the location of .arcconfig, we may
        // get a key that is different from what `arc lint` actually returns,
        // and end up without any lints for this path.
        const key = nuclideUri.relative(cwd, file);
        const rawLints = output.get(key);
        if (rawLints) {
          for (const lint of convertLints(file, rawLints)) {
            lints.push(lint);
          }
        }
      }
      return Observable.from(lints);
    });
}

function convertLints(
  pathToFile: string,
  lints: Array<{
    severity: string,
    line: number,
    char: number,
    code: string,
    description: string,
    original?: string,
    replacement?: string,
  }>,
): Array<ArcDiagnostic> {
  return lints.map(lint => {
    // Choose an appropriate level based on lint['severity'].
    const severity = lint.severity;
    const level = severity === 'error' ? 'Error' : 'Warning';

    const line = lint.line;
    // Sometimes the linter puts in global errors on line 0, which will result
    // in a negative index. We offset those back to the first line.
    const col = Math.max(0, lint.char - 1);
    const row = Math.max(0, line - 1);

    const diagnostic: ArcDiagnostic = {
      type: level,
      text: lint.description,
      filePath: pathToFile,
      row,
      col,
      code: lint.code,
    };
    if (lint.original != null) {
      diagnostic.original = lint.original;
    }
    if (lint.replacement != null) {
      diagnostic.replacement = lint.replacement;
    }
    return diagnostic;
  });
}

export const __TEST__ = {
  arcConfigDirectoryMap,
  arcProjectMap,
  reset() {
    arcConfigDirectoryMap.reset();
    arcProjectMap.reset();
  },
};
