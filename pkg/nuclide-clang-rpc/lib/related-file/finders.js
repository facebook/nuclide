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

import {findSubArrayIndex} from 'nuclide-commons/collection';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {SimpleCache} from 'nuclide-commons/SimpleCache';
import {getFileBasename, isHeaderFile, isSourceFile} from '../utils';
import {searchFileWithBasename} from './common';
import {
  getRelatedHeaderForSourceFromFramework,
  getRelatedSourceForHeaderFromFramework,
} from './objc-framework';
import {findIncludingSourceFile} from './grep-finder';

// If the source for a header is null, recheck after 10 minutes.
const SOURCE_FOR_HEADER_RECHECK_INTERVAL = 10 * 60 * 1000;

export class RelatedFileFinder {
  // Finding the source file that relates to header may be very expensive
  // because we grep for '#include' directives, so cache the results.
  _sourceForHeaderCache: SimpleCache<
    {header: string, projectRoot: ?string},
    Promise<{source: ?string, time: number}>,
  > = new SimpleCache({keyFactory: key => JSON.stringify(key)});

  async getRelatedHeaderForSource(src: string): Promise<?string> {
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

  async getRelatedSourceForHeader(
    header: string,
    projectRoot: ?string,
  ): Promise<?string> {
    const {source, time} = await this._sourceForHeaderCache.getOrCreate(
      {header, projectRoot},
      () =>
        this._getRelatedSourceForHeaderImpl(header, projectRoot).then(src => ({
          source: src,
          time: Date.now(),
        })),
    );
    const now = Date.now();
    if (source == null && now > time + SOURCE_FOR_HEADER_RECHECK_INTERVAL) {
      this._sourceForHeaderCache.delete({header, projectRoot});
      return this.getRelatedHeaderForSource(header);
    }
    return source;
  }

  async _getRelatedSourceForHeaderImpl(
    header: string,
    projectRoot: ?string,
  ): Promise<?string> {
    // search in folder
    let source = await searchFileWithBasename(
      nuclideUri.dirname(header),
      getFileBasename(header),
      isSourceFile,
    );
    if (source != null) {
      return source;
    }
    // special case for obj-c frameworks
    source = await getRelatedSourceForHeaderFromFramework(header);
    if (source != null) {
      return source;
    }

    if (projectRoot != null) {
      source = await findIncludingSourceFile(header, projectRoot).toPromise();
      if (source != null) {
        return source;
      }
    }

    source = await findIncludingSourceFile(
      header,
      this._inferProjectRoot(header),
    ).toPromise();

    if (source != null) {
      return source;
    }

    try {
      // $FlowFB
      return require('./fb/fallback-finder').findIncludingSourceFile(header);
    } catch (e) {
      return null;
    }
  }

  _getFBProjectRoots(): string[] {
    try {
      // $FlowFB
      return require('./fb/project-roots').getFBProjectRoots();
    } catch (e) {}
    return [];
  }

  /**
   * Given a file path, find out from the list of registered hardcoded project
   * roots which one is part of it and use it as project root. Otherwise, this
   * uses the file's parent dir as fallback.
   */
  _inferProjectRoot(file: string): string {
    const pathParts = nuclideUri.split(file);
    for (const root of this._getFBProjectRoots()) {
      const offset = findSubArrayIndex(pathParts, nuclideUri.split(root));
      if (offset !== -1) {
        return nuclideUri.join(...pathParts.slice(0, offset), root);
      }
    }
    return nuclideUri.dirname(file);
  }
}
