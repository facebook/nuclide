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

import type {RevisionFileChanges} from './HgService';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {ConnectableObservable} from 'rxjs';

import {hgRunCommand} from './hg-utils';
import nuclideUri from 'nuclide-commons/nuclideUri';
import invariant from 'assert';

const ALL_FILES_LABEL = 'files:';
const FILE_ADDS_LABEL = 'file-adds:';
const FILE_DELETES_LABEL = 'file-dels:';
const FILE_COPIES_LABEL = 'file-copies:';
const FILE_MODS_LABEL = 'file-mods:';
const REVISION_FILE_CHANGES_TEMPLATE = `${ALL_FILES_LABEL} {files}
${FILE_ADDS_LABEL} {file_adds}
${FILE_DELETES_LABEL} {file_dels}
${FILE_COPIES_LABEL} {file_copies}
${FILE_MODS_LABEL} {file_mods}`;
// Regex for: "new_file (previous_file", with two capture groups, one for each file.
const COPIED_FILE_PAIR_REGEX = /(.+) \((.+)/;

/**
 * @param filePath An absolute path to a file.
 * @param revision A string representation of the revision desired. See
 * Mercurial documentation for ways to specify a revision.
 * @param The working directory (aka root directory) of the Hg repository.
 * @return The content of the filePath at the given revision. Returns null
 * if the operation fails for whatever reason, including invalid input (e.g. if
 * you pass a filePath that does not exist at the given revision).
 */
export function fetchFileContentAtRevision(
  filePath: NuclideUri,
  revision: string,
  workingDirectory: string,
): ConnectableObservable<string> {
  const args = ['cat', '--rev', revision, filePath];
  const execOptions = {
    cwd: workingDirectory,
  };
  return hgRunCommand(args, execOptions).publish();
}

/**
 * @param revision A string representation of the revision desired. See
 * Mercurial documentation for ways to specify a revision.
 * @return The content of the filePath at the given revision. Returns null
 * if the operation fails for whatever reason, including invalid input (e.g. if
 * you pass an invalid revision).
 */
export function fetchFilesChangedAtRevision(
  revision: string,
  workingDirectory: string,
): ConnectableObservable<RevisionFileChanges> {
  const args = [
    'log',
    '--template',
    REVISION_FILE_CHANGES_TEMPLATE,
    '--rev',
    revision,
    '--limit',
    '1',
  ];
  const execOptions = {
    cwd: workingDirectory,
  };
  return hgRunCommand(args, execOptions)
    .map(stdout => parseRevisionFileChangeOutput(stdout, workingDirectory))
    .publish();
}

/**
 * @param revision A string representation of the revision desired. See
 * Mercurial documentation for ways to specify a revision.
 * @return The content of the filePath at the given revision. Returns null
 * if the operation fails for whatever reason, including invalid input (e.g. if
 * you pass an invalid revision).
 */
export function fetchFilesChangedSinceRevision(
  revision: string,
  workingDirectory: string,
): ConnectableObservable<Array<string>> {
  const args = ['status', '--rev', revision, '-Tjson'];
  const execOptions = {
    cwd: workingDirectory,
  };
  return hgRunCommand(args, execOptions)
    .map(stdout => {
      const statuses = JSON.parse(stdout);
      return absolutizeAll(
        statuses.map(status => status.path),
        workingDirectory,
      );
    })
    .publish();
}

/**
 * Exported for testing.
 *
 * @param output Raw output string from 'hg log' call in `fetchFilesChangedAtRevision`.
 * @param workingDirectory The absolute path to the working directory of the hg repository.
 * @return A RevisionFileChanges object where the paths are all absolute paths.
 */
export function parseRevisionFileChangeOutput(
  output: string,
  workingDirectory: string,
): RevisionFileChanges {
  const lines = output.trim().split('\n');
  let allFiles = lines[0].slice(ALL_FILES_LABEL.length + 1).trim();
  allFiles = allFiles.length ? allFiles.split(' ') : [];
  allFiles = absolutizeAll(allFiles, workingDirectory);

  let addedFiles = lines[1].slice(FILE_ADDS_LABEL.length + 1).trim();
  addedFiles = addedFiles.length ? addedFiles.split(' ') : [];
  addedFiles = absolutizeAll(addedFiles, workingDirectory);

  let deletedFiles = lines[2].slice(FILE_DELETES_LABEL.length + 1).trim();
  deletedFiles = deletedFiles.length ? deletedFiles.split(' ') : [];
  deletedFiles = absolutizeAll(deletedFiles, workingDirectory);

  // Copied files are in the form: new_file (previous_file)new_file2 (previous_file2)[...]
  // There is no space between entries.
  let copiedFiles = lines[3].slice(FILE_COPIES_LABEL.length + 1).trim();
  copiedFiles = copiedFiles.length ? copiedFiles.split(')') : [];
  // We expect the string to end with a ')', so the last entry in copiedFiles will
  // be an empty string. Remove this.
  copiedFiles.pop();
  // Parse the lines, now in the form: new_file (previous_file)
  copiedFiles = copiedFiles.map(filePathPair => {
    const fileNameMatches = filePathPair.match(COPIED_FILE_PAIR_REGEX);
    invariant(fileNameMatches);
    return {
      from: absolutize(fileNameMatches[2], workingDirectory),
      to: absolutize(fileNameMatches[1], workingDirectory),
    };
  });

  let modifiedFiles = lines[4].slice(FILE_MODS_LABEL.length + 1).trim();
  modifiedFiles = modifiedFiles.length ? modifiedFiles.split(' ') : [];
  modifiedFiles = absolutizeAll(modifiedFiles, workingDirectory);

  return {
    all: allFiles,
    added: addedFiles,
    deleted: deletedFiles,
    copied: copiedFiles,
    modified: modifiedFiles,
  };
}

function absolutize(filePath: string, workingDirectory: string): string {
  return nuclideUri.join(workingDirectory, filePath);
}

function absolutizeAll(filePaths: Array<string>, workingDirectory: string) {
  return filePaths.map(filePath => absolutize(filePath, workingDirectory));
}
