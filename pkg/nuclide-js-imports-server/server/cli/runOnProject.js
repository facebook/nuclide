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

import fsPromise from 'nuclide-commons/fsPromise';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {AutoImportsManager} from '../src/lib/AutoImportsManager';
import {indexDirectory, indexNodeModules} from '../src/lib/AutoImportsWorker';

import type {ImportSuggestion} from '../src/lib/types';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';

const TO_IGNORE = ['**/node_modules/**', '**/VendorLib/**', '**/flow-typed/**'];
const DEFAULT_PROJECT_PATH = nuclideUri.join(__dirname, '..', '..', '..', '..');
const ENVS = ['builtin', 'node', 'jasmine', 'browser', 'atomtest', 'es6'];
const shouldIndexNodeModules = true;

let numErrors = 0;
let numFiles = 0;

function main() {
  const autoImportsManager = new AutoImportsManager(ENVS);
  const missingImports: Map<string, Array<ImportSuggestion>> = new Map();

  const root =
    process.argv.length === 3 ? toPath(process.argv[2]) : DEFAULT_PROJECT_PATH;

  console.log('Began indexing all files');
  const indexDirPromise = new Promise((resolve, reject) => {
    indexDirectory(root).subscribe({
      next: exportForFiles => {
        exportForFiles.forEach(exportForFile =>
          autoImportsManager.handleUpdateForFile(exportForFile),
        );
      },
      error: err => {
        console.error('Encountered error in AutoImportsWorker', err);
        return reject(err);
      },
      complete: () => {
        console.log(`Finished indexing source code for ${root}`);
        return resolve();
      },
    });
  });

  const indexModulesPromise = shouldIndexNodeModules
    ? new Promise((resolve, reject) => {
        indexNodeModules(root).subscribe({
          next: exportForFile => {
            if (exportForFile) {
              autoImportsManager.handleUpdateForFile(exportForFile);
            }
          },
          error: err => {
            console.error('Encountered error in AutoImportsWorker', err);
            return reject(err);
          },
          complete: () => {
            console.log(`Finished indexing node modules ${root}`);
            return resolve();
          },
        });
      })
    : Promise.resolve();

  // Check all files for missing imports
  Promise.all([indexDirPromise, indexModulesPromise]).then(() => {
    return fsPromise
      .glob('**/*.js', {
        cwd: root,
        ignore: TO_IGNORE,
      })
      .then(files => files.map(file => nuclideUri.join(root, file)))
      .then(files => {
        console.log(
          'Finsihed indexing. Checking all files for missing imports.',
        );
        return checkFilesForMissingImports(
          files,
          autoImportsManager,
          missingImports,
        );
      })
      .then(() => {
        // Report the results
        console.log(
          `Ran on ${numFiles} files. Terminated with ${numErrors} errors.`,
        );
        console.log(`Found ${missingImports.size} files with missing imports.`);
        missingImports.forEach((missingImportsForFile, file) => {
          console.log(`Missing imports for ${file}:`);
          missingImportsForFile.forEach(missingImport => {
            console.log(missingImport.symbol);
            console.log(missingImport.filesWithExport);
          });
          console.log('\n');
        });
      });
  });
}

function checkFilesForMissingImports(
  files: Array<NuclideUri>,
  autoImportsManager: AutoImportsManager,
  missingImports: Map<string, Array<ImportSuggestion>>,
) {
  return Promise.all(
    files.map(file => {
      if (file) {
        numFiles++;
        return fsPromise.readFile(file, 'utf8').then(
          fileContents => {
            const missingImport = autoImportsManager.findMissingImports(
              file,
              fileContents,
            );
            if (missingImport.length > 0) {
              missingImports.set(file, missingImport);
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
    }),
  );
}

function toPath(filename: NuclideUri): NuclideUri {
  if (nuclideUri.isAbsolute(filename)) {
    return filename;
  }
  return nuclideUri.normalize(nuclideUri.join(process.cwd(), filename));
}

main();
