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
import type {RelatedFilesProvider} from './types';

import {Disposable} from 'atom';
import {
  getFileSystemServiceByNuclideUri,
} from '../../nuclide-remote-connection';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {timeoutPromise} from 'nuclide-commons/promise';

const relatedFilesProviders: Set<RelatedFilesProvider> = new Set();

/**
 * Finds related files, to be used in `JumpToRelatedFile`.
 *
 * Files are related if they have the same filename but different extension,
 * or if the filename is appended with `Internal` or `-inl`. For example, these files
 * would all be related: `Foo.h`, `Foo.m`, `FooInternal.h`, `Foo-inl.h`
 *
 * For now, we only search in the given path's directory for related files.
 */
export default class RelatedFileFinder {
  static registerRelatedFilesProvider(
    provider: RelatedFilesProvider,
  ): Disposable {
    relatedFilesProviders.add(provider);
    return new Disposable(() => relatedFilesProviders.delete(provider));
  }

  static getRelatedFilesProvidersDisposable(): Disposable {
    return new Disposable(() => relatedFilesProviders.clear());
  }

  static async _findRelatedFilesFromProviders(
    path: NuclideUri,
  ): Promise<Array<string>> {
    const relatedLists = await Promise.all(
      Array.from(relatedFilesProviders.values()).map(provider =>
        timeoutPromise(provider.getRelatedFiles(path), 2000),
      ),
    );
    const relatedFiles = new Set();
    for (const relatedList of relatedLists) {
      for (const relatedFile of relatedList) {
        relatedFiles.add(relatedFile);
      }
    }
    return Array.from(relatedFiles.values());
  }

  /**
   * Returns the related files and the given file's index in that array.
   * The given file must be in the related files array.
   * @param filePath The filepath for which to get related files.
   * @param fileTypeWhiteList the set of file types that we are looking for;
   *      If this set is empty, all file types will be listed; the original
   *      filePath should always be in the result
   * @return The related files and the given path's index into it.
   */
  static async find(
    filePath: NuclideUri,
    fileTypeWhitelist?: Set<string> = new Set(),
  ): Promise<{relatedFiles: Array<string>, index: number}> {
    const dirName = nuclideUri.dirname(filePath);
    const prefix = getPrefix(filePath);
    const service = getFileSystemServiceByNuclideUri(filePath);
    const listing = await service.readdir(dirName);
    // Here the filtering logic:
    // first get all files with the same prefix -> filelist,
    // add the related files from external providers
    // get all the files that matches the whitelist -> wlFilelist;
    // check the wlFilelist: if empty, use filelist
    const filelist = listing
      .filter(entry => {
        const [name, isFile] = entry;
        return isFile && !name.endsWith('~') && getPrefix(name) === prefix;
      })
      .map(entry => nuclideUri.join(dirName, entry[0]))
      .concat(await RelatedFileFinder._findRelatedFilesFromProviders(filePath));

    let wlFilelist = fileTypeWhitelist.size <= 0
      ? filelist
      : filelist.filter(otherFilePath => {
          return fileTypeWhitelist.has(nuclideUri.extname(otherFilePath));
        });
    if (wlFilelist.length <= 0) {
      // no files in white list
      wlFilelist = filelist;
    }

    const relatedFiles = Array.from(new Set(wlFilelist));

    if (relatedFiles.indexOf(filePath) < 0) {
      relatedFiles.push(filePath);
    }
    relatedFiles.sort();

    return {
      relatedFiles,
      index: relatedFiles.indexOf(filePath),
    };
  }
}

function getPrefix(filePath: NuclideUri): string {
  let base = nuclideUri.basename(filePath);
  // Strip off the extension.
  const pos = base.lastIndexOf('.');
  if (pos !== -1) {
    base = base.substring(0, pos);
  }
  // In Objective-C we often have the X + XInternal.h for implementation methods.
  // Similarly, C++ users often use X.h + X-inl.h.
  return base.replace(/(Internal|-inl)$/, '');
}
