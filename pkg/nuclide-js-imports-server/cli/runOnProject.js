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

/* eslint-disable no-console */

import invariant from 'assert';
import os from 'os';
import {Observable} from 'rxjs';
import fsPromise from 'nuclide-commons/fsPromise';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {observeProcess} from 'nuclide-commons/process';
import {getEslintEnvs, getConfigFromFlow} from '../src/getConfig';
import {AutoImportsManager} from '../src/lib/AutoImportsManager';
import {indexDirectory, indexNodeModules} from '../src/lib/AutoImportsWorker';

import type {NuclideUri} from 'nuclide-commons/nuclideUri';

const DEFAULT_PROJECT_PATH = nuclideUri.join(__dirname, '..', '..', '..');

let numErrors = 0;
let numFiles = 0;

function main() {
  const root =
    process.argv.length === 3 ? toPath(process.argv[2]) : DEFAULT_PROJECT_PATH;

  const envs = getEslintEnvs(root);
  const autoImportsManager = new AutoImportsManager(envs);
  const {hasteSettings} = getConfigFromFlow(root);

  const indexDirStream = indexDirectory(
    root,
    hasteSettings,
    os.cpus().length,
  ).do({
    next: exportForFiles => {
      exportForFiles.forEach(exportForFile =>
        autoImportsManager.handleUpdateForFile(exportForFile),
      );
    },
    error: err => {
      console.error('Encountered error in AutoImportsWorker', err);
    },
    complete: () => {
      console.log(`Finished indexing source code for ${root}`);
    },
  });

  const indexModulesStream = indexNodeModules(root).do({
    next: exportForFile => {
      if (exportForFile) {
        autoImportsManager.handleUpdateForFile(exportForFile);
      }
    },
    error: err => {
      console.error('Encountered error in AutoImportsWorker', err);
    },
    complete: () => {
      console.log(`Finished indexing node modules ${root}`);
    },
  });

  console.log('Began indexing all files');

  // Check all files for missing imports
  Observable.merge(indexModulesStream, indexDirStream)
    .concat(
      // Don't bother checking non-Flow files.
      observeProcess('flow', [
        'ls',
        root,
        '--ignore',
        '.*/\\(node_modules\\|VendorLib\\|3rdParty\\)/.*',
      ])
        .filter(event => event.kind === 'stdout')
        .mergeMap(event => {
          invariant(event.kind === 'stdout');
          return checkFileForMissingImports(
            event.data.trim(),
            autoImportsManager,
          );
        }, 10),
    )
    .subscribe({
      complete: () => {
        // Report the results
        console.log(
          `Ran on ${numFiles} files. Terminated with ${numErrors} errors.`,
        );
        process.exit(numErrors > 0 ? 1 : 0);
      },
    });
}

function checkFileForMissingImports(
  file: NuclideUri,
  autoImportsManager: AutoImportsManager,
) {
  numFiles++;
  return fsPromise.readFile(file, 'utf8').then(
    fileContents => {
      const missingImports = autoImportsManager
        .findMissingImports(file, fileContents)
        .filter(missingImport => missingImport.symbol.type === 'value');
      if (missingImports.length > 0) {
        console.log(JSON.stringify({file, missingImports}, null, 2));
      }
    },
    err => {
      if (err) {
        numErrors++;
        console.log(
          'Error with checking for missing imports with file',
          file,
          'Error:',
          err,
        );
      }
    },
  );
}

function toPath(filename: NuclideUri): NuclideUri {
  if (nuclideUri.isAbsolute(filename)) {
    return filename;
  }
  return nuclideUri.normalize(nuclideUri.join(process.cwd(), filename));
}

main();
