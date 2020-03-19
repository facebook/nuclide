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
import type {LRUCache} from 'lru-cache';

import {getLogger} from 'log4js';
import nuclideUri from 'nuclide-commons/nuclideUri';
import LRU from 'lru-cache';
import {runCommand} from 'nuclide-commons/process';
import fsPromise from 'nuclide-commons/fsPromise';
import {config} from './config';

// assumes that filenames do not contain ':'
const GREP_PARSE_PATTERN = /^([^:]*):(.*)$/;

export type GeneratedFileType = 'manual' | 'partial' | 'generated';

export async function getGeneratedFileType(
  filePath: NuclideUri,
  forceUpdate: boolean = false,
): Promise<GeneratedFileType> {
  if (!forceUpdate) {
    const cachedType = cache.get(filePath);

    if (cachedType != null) {
      return cachedType;
    }
  }

  if (matchesGeneratedPaths(filePath)) {
    cache.set(filePath, 'generated');
    return 'generated';
  }

  const dirPath = nuclideUri.dirname(filePath);
  const filename = nuclideUri.basename(filePath);
  const fileTags = await findTaggedFiles(dirPath, [filename]);

  let tag = fileTags.get(filename);
  if (tag == null) {
    tag = 'manual';
  }

  cache.set(filePath, tag);
  return tag;
}

export async function invalidateFileTypeCache(
  filePath: NuclideUri,
): Promise<void> {
  cache.del(filePath);
}

export async function getGeneratedFileTypes(
  dirPath: NuclideUri,
): Promise<Map<NuclideUri, GeneratedFileType>> {
  const fileTypes: Map<NuclideUri, GeneratedFileType> = new Map();
  const uncheckedFiles = [];
  if (
    !nuclideUri.isInArchive(dirPath) &&
    !nuclideUri.hasKnownArchiveExtension(dirPath)
  ) {
    const files = await fsPromise.readdir(dirPath);
    for (const file of files) {
      const filePath = nuclideUri.join(dirPath, file);
      const cachedType = cache.get(filePath);
      if (cachedType != null) {
        fileTypes.set(filePath, cachedType);
      } else {
        uncheckedFiles.push(file);
      }
    }
  }

  if (uncheckedFiles.length === 0) {
    return fileTypes;
  }

  const fileTags = await findTaggedFiles(dirPath, uncheckedFiles);

  for (const file of uncheckedFiles) {
    const filePath = nuclideUri.join(dirPath, file);
    let tag = fileTags.get(file);
    if (tag != null) {
      fileTypes.set(filePath, tag);
    } else {
      if (matchesGeneratedPaths(filePath)) {
        tag = 'generated';
        fileTypes.set(filePath, tag);
      } else {
        tag = 'manual';
        // don't send this across the wire; receiver should assume that if it gets
        // a response, any files in the directory that aren't specified are manual
      }
    }
    cache.set(filePath, tag);
  }

  return fileTypes;
}

// 1000 entries should allow for a good number of open directories
const cache: LRUCache<NuclideUri, GeneratedFileType> = new LRU({max: 1000});

function getTagPattern(forWindows: boolean): ?string {
  if (config.generatedTag == null) {
    return config.partialGeneratedTag;
  }
  if (config.partialGeneratedTag == null) {
    return config.generatedTag;
  }
  const separator = forWindows ? ' ' : '\\|';
  return config.generatedTag + separator + config.partialGeneratedTag;
}

// If calling grep/findstr fails because they aren't available, we don't want to waste time trying
// again, so we use this variable to keep track.
let trySpawningToFindTaggedFiles = true;

async function findTaggedFiles(
  dirPath: NuclideUri,
  filenames: Array<string>,
): Promise<Map<string, GeneratedFileType>> {
  if (!trySpawningToFindTaggedFiles) {
    return new Map();
  }

  let command: string;
  let baseArgs: Array<string>;
  let pattern: ?string;
  if (process.platform === 'win32' && nuclideUri.isLocal(dirPath)) {
    command = 'findstr';
    // ignore "files with nonprintable characters"
    baseArgs = ['-p'];
    pattern = getTagPattern(true);
  } else {
    command = 'grep';
    // print with filename, ignore binary files and skip directories
    baseArgs = ['-HId', 'skip'];
    pattern = getTagPattern(false);
  }
  if (pattern == null) {
    return new Map();
  }
  const filesToGrep = filenames.length === 0 ? ['*'] : filenames;
  const args = [...baseArgs, pattern, ...filesToGrep];
  const options = {
    cwd: dirPath,
    isExitError: ({exitCode, signal}) => {
      return signal != null && (exitCode == null || exitCode > 1);
    },
  };

  let stdout;
  try {
    stdout = await runCommand(command, args, options).toPromise();
  } catch (err) {
    if (err.code === 'ENOENT') {
      getLogger('nuclide-generated-files-rpc').error(err);
      trySpawningToFindTaggedFiles = false;
      return new Map();
    }
    throw err;
  }

  const fileTags: Map<string, GeneratedFileType> = new Map();
  for (const line of stdout.split('\n')) {
    const match = line.match(GREP_PARSE_PATTERN);
    if (match != null && match.length === 3) {
      const filename = match[1];
      const matchedLine = match[2].trim();
      if (matchedLine.includes(config.generatedTag)) {
        fileTags.set(filename, 'generated');
      } else if (
        matchedLine.includes(config.partialGeneratedTag) &&
        fileTags.get(filename) !== 'generated'
      ) {
        fileTags.set(filename, 'partial');
      }
    }
  }
  return fileTags;
}

function matchesGeneratedPaths(filePath: NuclideUri): boolean {
  return config.generatedPathRegexes.some(regexp => regexp.test(filePath));
}
