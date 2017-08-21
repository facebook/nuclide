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

import escapeStringRegExp from 'escape-string-regexp';
import nuclideUri from 'nuclide-commons/nuclideUri';
import fsPromise from 'nuclide-commons/fsPromise';
import {getFileBasename, isHeaderFile, isSourceFile} from './utils';
import {Observable} from 'rxjs';
import {observeProcess} from 'nuclide-commons/process';

async function searchFileWithBasename(
  dir: string,
  basename: string,
  condition: (file: string) => boolean,
): Promise<?string> {
  const files = await fsPromise.readdir(dir).catch(() => []);
  for (const file of files) {
    if (condition(file) && getFileBasename(file) === basename) {
      return nuclideUri.join(dir, file);
    }
  }
  return null;
}

function getFrameworkStructureFromSourceDir(
  dir: string,
): ?{frameworkPath: string, frameworkName: string, frameworkSubFolder: string} {
  const paths = nuclideUri.split(dir).reverse();
  const rootIndex = paths.findIndex(folderName => folderName === 'Sources');
  if (rootIndex === -1) {
    return null;
  }
  const frameworkName = paths[rootIndex + 1];
  const frameworkPath = nuclideUri.join(
    ...paths.slice(rootIndex + 1).reverse(),
  );
  const frameworkSubPaths = paths.slice(0, rootIndex);
  const frameworkSubFolder =
    frameworkSubPaths.length === 0
      ? ''
      : nuclideUri.join(...frameworkSubPaths.reverse());
  return {
    frameworkPath,
    frameworkName,
    frameworkSubFolder,
  };
}

function getFrameworkStructureFromHeaderDir(
  dir: string,
): ?{frameworkPath: string, frameworkName: string, frameworkSubFolder: string} {
  const paths = nuclideUri.split(dir).reverse();
  const rootIndex = paths.findIndex(folderName =>
    ['Headers', 'PrivateHeaders'].includes(folderName),
  );
  if (rootIndex === -1) {
    return null;
  }
  const frameworkName = paths[rootIndex + 1];
  const frameworkPath = nuclideUri.join(
    ...paths.slice(rootIndex + 1).reverse(),
  );
  const frameworkSubPaths = paths.slice(0, rootIndex - 1);
  const frameworkSubFolder =
    frameworkSubPaths.length === 0
      ? ''
      : nuclideUri.join(...frameworkSubPaths.reverse());
  return {
    frameworkPath,
    frameworkName,
    frameworkSubFolder,
  };
}
async function getRelatedHeaderForSourceFromFramework(
  src: string,
): Promise<?string> {
  const frameworkStructure = getFrameworkStructureFromSourceDir(
    nuclideUri.dirname(src),
  );
  if (frameworkStructure == null) {
    return null;
  }
  const {frameworkPath, frameworkName, frameworkSubFolder} = frameworkStructure;
  const basename = getFileBasename(src);
  const headers = await Promise.all(
    ['Headers', 'PrivateHeaders'].map(headerFolder =>
      searchFileWithBasename(
        nuclideUri.join(
          frameworkPath,
          headerFolder,
          frameworkName,
          frameworkSubFolder,
        ),
        basename,
        isHeaderFile,
      ),
    ),
  );
  return headers.find(file => file != null);
}

async function getRelatedSourceForHeaderFromFramework(
  header: string,
): Promise<?string> {
  const frameworkStructure = getFrameworkStructureFromHeaderDir(
    nuclideUri.dirname(header),
  );
  if (frameworkStructure == null) {
    return null;
  }
  const {frameworkPath, frameworkSubFolder} = frameworkStructure;
  return searchFileWithBasename(
    nuclideUri.join(frameworkPath, 'Sources', frameworkSubFolder),
    getFileBasename(header),
    isSourceFile,
  );
}

export async function getRelatedHeaderForSource(src: string): Promise<?string> {
  // search in folder
  const header = await searchFileWithBasename(
    nuclideUri.dirname(src),
    getFileBasename(src),
    isHeaderFile,
  );
  if (header != null) {
    return header;
  }
  // special case for obj-c frameworks
  return getRelatedHeaderForSourceFromFramework(src);
}

export async function getRelatedSourceForHeader(src: string): Promise<?string> {
  // search in folder
  const source = await searchFileWithBasename(
    nuclideUri.dirname(src),
    getFileBasename(src),
    isSourceFile,
  );
  if (source != null) {
    return source;
  }
  // special case for obj-c frameworks
  return getRelatedSourceForHeaderFromFramework(src);
}

/**
 * Search all subdirectories of the header file for a source file that includes it.
 * We handle the two most common types of include statements:
 *
 * 1) Includes relative to the project root (if supplied); e.g. #include <a/b.h>
 * 2) Includes relative to the source file; e.g. #include "../../a.h"
 *
 * Note that we use an Observable here to enable cancellation.
 * The resulting Observable fires and completes as soon as a matching file is found;
 * 'null' will always be emitted if no results are found.
 */
export function findIncludingSourceFile(
  headerFile: string,
  projectRoot: string,
): Observable<?string> {
  const basename = escapeStringRegExp(nuclideUri.basename(headerFile));
  const relativePath = escapeStringRegExp(
    nuclideUri.relative(projectRoot, headerFile),
  );
  const pattern = `^\\s*#include\\s+["<](${relativePath}|(../)*${basename})[">]\\s*$`;
  const regex = new RegExp(pattern);
  // We need both the file and the match to verify relative includes.
  // Relative includes may not always be correct, so we may have to go through all the results.
  return observeProcess(
    'grep',
    [
      '-RE', // recursive, extended
      '--null', // separate file/match with \0
      pattern,
      nuclideUri.dirname(headerFile),
    ],
    {/* TODO(T17353599) */ isExitError: () => false},
  )
    .catch(error => Observable.of({kind: 'error', error})) // TODO(T17463635)
    .flatMap(message => {
      switch (message.kind) {
        case 'stdout':
          const file = processGrepResult(message.data, headerFile, regex);
          return file == null ? Observable.empty() : Observable.of(file);
        case 'error':
          throw new Error(String(message.error));
        case 'exit':
          return Observable.of(null);
        default:
          return Observable.empty();
      }
    })
    .take(1);
}

function processGrepResult(
  result: string,
  headerFile: string,
  includeRegex: RegExp,
): ?string {
  const splitIndex = result.indexOf('\0');
  if (splitIndex === -1) {
    return null;
  }
  const filename = result.substr(0, splitIndex);
  if (!isSourceFile(filename)) {
    return null;
  }
  const match = includeRegex.exec(result.substr(splitIndex + 1));
  if (match == null) {
    return null;
  }
  // Source-relative includes have to be verified.
  // Relative paths will match the (../)* rule (at index 2).
  if (match[2] != null) {
    const includePath = nuclideUri.normalize(
      nuclideUri.join(nuclideUri.dirname(filename), match[1]),
    );
    if (includePath !== headerFile) {
      return null;
    }
  }
  return filename;
}
