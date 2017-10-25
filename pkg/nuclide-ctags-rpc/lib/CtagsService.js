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

import nuclideUri from 'nuclide-commons/nuclideUri';
import fsPromise from 'nuclide-commons/fsPromise';
import {arrayCompact} from 'nuclide-commons/collection';
import {getLogger} from 'log4js';

const TAGS_FILENAME = 'tags';

export type CtagsResult = {
  name: string,
  file: NuclideUri,
  // As specified in the tags file; defaults to 0 if not specified.
  lineNumber: number,
  // As specified in the tags file; defaults to empty if not specified.
  kind: string,
  pattern?: string,
  fields?: Map<string, string>,
};

export class CtagsService {
  _tagsPath: NuclideUri;

  constructor(tagsPath: NuclideUri) {
    this._tagsPath = tagsPath;
  }

  getTagsPath(): Promise<NuclideUri> {
    return Promise.resolve(this._tagsPath);
  }

  findTags(
    query: string,
    options?: {
      caseInsensitive?: boolean,
      partialMatch?: boolean,
      limit?: number,
    },
  ): Promise<Array<CtagsResult>> {
    let ctags;
    try {
      ctags = require('nuclide-prebuilt-libs/ctags');
    } catch (e) {
      getLogger('nuclide-ctags-rpc').error(
        'Could not load the ctags package:',
        e,
      );
      return Promise.resolve([]);
    }

    const dir = nuclideUri.dirname(this._tagsPath);
    return new Promise((resolve, reject) => {
      ctags.findTags(
        this._tagsPath,
        query,
        options,
        async (error, tags: Array<Object>) => {
          if (error != null) {
            reject(error);
          } else {
            const processed = await Promise.all(
              tags.map(async tag => {
                // Convert relative paths to absolute ones.
                tag.file = nuclideUri.join(dir, tag.file);
                // Tag files are often not perfectly in sync - filter out missing files.
                if (await fsPromise.exists(tag.file)) {
                  if (tag.fields != null) {
                    const map = new Map();
                    for (const key in tag.fields) {
                      map.set(key, tag.fields[key]);
                    }
                    tag.fields = map;
                  }
                  return tag;
                }
                return null;
              }),
            );
            // $FlowFixMe(>=0.55.0) Flow suppress
            resolve(arrayCompact(processed));
          }
        },
      );
    });
  }

  dispose(): void {
    // nothing here
  }
}

export async function getCtagsService(uri: NuclideUri): Promise<?CtagsService> {
  const dir = await fsPromise.findNearestFile(
    TAGS_FILENAME,
    nuclideUri.dirname(uri),
  );
  if (dir == null) {
    return null;
  }
  return new CtagsService(nuclideUri.join(dir, TAGS_FILENAME));
}
