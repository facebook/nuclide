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

import child_process from 'child_process';
import split from 'split';
import {WatchmanClient} from 'nuclide-watchman-helpers';
import fsPromise from 'nuclide-commons/fsPromise';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {runCommand} from 'nuclide-commons/process';
import {asyncLimit} from 'nuclide-commons/promise';

function getFilesFromCommand(
  command: string,
  args: Array<string>,
  localDirectory: string,
  transform?: (path: string) => string,
): Promise<Array<string>> {
  return new Promise((resolve, reject) => {
    // Use `spawn` here to process the, possibly huge, output of the file listing.

    const proc = child_process.spawn(command, args, {cwd: localDirectory});

    proc.on('error', reject);

    const filePaths = [];
    proc.stdout.pipe(split()).on('data', filePath_ => {
      let filePath = filePath_;
      if (transform) {
        filePath = transform(filePath);
      }

      if (filePath !== '') {
        filePaths.push(filePath);
      }
    });

    let errorString = '';
    proc.stderr.on('data', data => {
      errorString += data;
    });

    proc.on('close', code => {
      if (code === 0) {
        resolve(filePaths);
      } else {
        reject(errorString);
      }
    });
  });
}

function getTrackedHgFiles(localDirectory: string): Promise<Array<string>> {
  return fsPromise
    .exists(nuclideUri.join(localDirectory, '.hg'))
    .then(isRoot => {
      if (isRoot) {
        return getFilesFromCommand('hg', ['locate'], localDirectory);
      } else {
        return getFilesFromCommand(
          'hg',
          ['locate', '--fullpath', '--include', '.'],
          localDirectory,
          filePath => filePath.slice(localDirectory.length + 1),
        );
      }
    });
}

/**
 * 'Untracked' files are files that haven't been added to the repo, but haven't
 * been explicitly hg-ignored.
 */
function getUntrackedHgFiles(localDirectory: string): Promise<Array<string>> {
  return getFilesFromCommand(
    'hg',
    // Calling 'hg status' with a path has two side-effects:
    // 1. It returns the status of only files under the given path. In this case,
    //    we only want the untracked files under the given localDirectory.
    // 2. It returns the paths relative to the directory in which this command is
    //    run. This is hard-coded to 'localDirectory' in `getFilesFromCommand`,
    //    which is what we want.
    [
      'status',
      '--unknown',
      '--no-status' /* No status code. */,
      localDirectory,
    ],
    localDirectory,
  );
}

/**
 * @param localDirectory The full path to a directory.
 * @return If localDirectory is within an Hg repo, returns an Object where the
 *   keys are file paths (relative to the 'localDirectory') of tracked and untracked
 *   files within that directory, but not including ignored files. All values
 *   are 'true'. If localDirectory is not within an Hg repo, the Promise rejects.
 */
function getFilesFromHg(localDirectory: string): Promise<Array<string>> {
  return Promise.all([
    getTrackedHgFiles(localDirectory),
    // It's not a dealbreaker if untracked files fail to show up.
    getUntrackedHgFiles(localDirectory).catch(() => []),
  ]).then(returnedFiles => {
    const [trackedFiles, untrackedFiles] = returnedFiles;
    return trackedFiles.concat(untrackedFiles);
  });
}

function getTrackedGitFiles(localDirectory: string): Promise<Array<string>> {
  return getFilesFromCommand('git', ['ls-files'], localDirectory);
}

/**
 * 'Untracked' files are files that haven't been added to the repo, but haven't
 * been explicitly git-ignored.
 */
function getUntrackedGitFiles(localDirectory: string): Promise<Array<string>> {
  // '--others' means untracked files, and '--exclude-standard' excludes ignored files.
  return getFilesFromCommand(
    'git',
    ['ls-files', '--exclude-standard', '--others'],
    localDirectory,
  );
}

/**
 * @param localDirectory The full path to a directory.
 * @return If localDirectory is within a Git repo, returns an Object where the
 *   keys are file paths (relative to the 'localDirectory') of tracked and untracked
 *   files within that directory, but not including ignored files. All values
 *   are 'true'. If localDirectory is not within a Git repo, the Promise rejects.
 */
function getFilesFromGit(localDirectory: string): Promise<Array<string>> {
  return Promise.all([
    getTrackedGitFiles(localDirectory),
    getUntrackedGitFiles(localDirectory),
  ]).then(returnedFiles => {
    const [trackedFiles, untrackedFiles] = returnedFiles;
    return trackedFiles.concat(untrackedFiles);
  });
}

async function getFilesFromRepo(
  localDirectory: string,
): Promise<Array<string>> {
  if (!(await fsPromise.exists(nuclideUri.join(localDirectory, '.repo')))) {
    throw new Error(`${localDirectory} is not a repo root`);
  }
  const subRoots = (await runCommand('repo', ['list', '-p'], {
    cwd: localDirectory,
  }).toPromise())
    .split(/\n/)
    .filter(s => s.length > 0);

  const fileLists = await asyncLimit(subRoots, 20, subRoot => {
    return getFilesFromGit(nuclideUri.join(localDirectory, subRoot))
      .catch(() => [])
      .then(files => files.map(file => nuclideUri.join(subRoot, file)));
  });

  return [].concat(...fileLists);
}

function getAllFiles(localDirectory: string): Promise<Array<string>> {
  return getFilesFromCommand(
    'find',
    ['.', '-type', 'f'],
    localDirectory,
    // Slice off the leading `./` that find will add on here.
    filePath => filePath.substring(2),
  );
}

function getAllFilesFromWatchman( // eslint-disable-line no-unused-vars
  localDirectory: string,
): Promise<Array<string>> {
  const client = new WatchmanClient();
  try {
    return client.listFiles(localDirectory);
  } finally {
    client.dispose();
  }
}

export function getPaths(localDirectory: string): Promise<Array<string>> {
  // Attempts to get a list of files relative to `localDirectory`, hopefully from
  // a fast source control index.
  // TODO (williamsc) once ``{HG|Git}Repository` is working in nuclide-server,
  // use those instead to determine VCS.
  return (
    getFilesFromHg(localDirectory)
      .catch(() => getFilesFromGit(localDirectory))
      // .catch(() => getAllFilesFromWatchman(localDirectory))
      .catch(() => getFilesFromRepo(localDirectory))
      .catch(() => getAllFiles(localDirectory))
      .catch(() => {
        throw new Error(`Failed to populate FileSearch for ${localDirectory}`);
      })
  );
}

export const __test__ = {
  getFilesFromGit,
  getFilesFromHg,
};
