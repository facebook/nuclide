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
import {arrayFlatten} from 'nuclide-commons/collection';
import ExportMatcher from './ExportMatcher';

import type {JSExport} from './types';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';

export class ExportIndex {
  exportsForId: Map<string, Set<JSExport>>;
  exportsForFile: Map<NuclideUri, Set<JSExport>>;
  exportIdMatcher: ExportMatcher;

  constructor() {
    this.exportsForId = new Map();
    this.exportsForFile = new Map();
    this.exportIdMatcher = new ExportMatcher();
  }

  clearAllExports() {
    this.exportsForId = new Map();
    this.exportsForFile = new Map();
    this.exportIdMatcher = new ExportMatcher();
  }

  hasExport(id: string) {
    return this.exportsForId.has(id);
  }

  clearExportsFromFile(file: NuclideUri) {
    const toClear = this.exportsForFile.get(file);
    if (!toClear) {
      return;
    }
    this.exportsForFile.set(file, new Set());

    toClear.forEach(exp => {
      const exportsWithSameId = this.exportsForId.get(exp.id);
      if (exportsWithSameId) {
        exportsWithSameId.delete(exp);
        if (exportsWithSameId.size === 0) {
          this.exportsForId.delete(exp.id);
          this.exportIdMatcher.remove(exp.id);
        }
      }
    });
  }

  getExportsFromId(id: string): Array<JSExport> {
    const indexExports = this.exportsForId.get(id);
    if (indexExports) {
      return Array.from(indexExports);
    }
    return [];
  }

  getIdsMatching(query: string, maxResults: number): Array<string> {
    return this.exportIdMatcher
      .match(query, {
        caseSensitive: false,
        // For now only match exact matches for performance reasons. We could
        // explore chosing this dynamically based on the # of export IDs
        // ex: Array.from(this.exportsForId.keys()).length > 10000 ? 1 : 3
        maxGap: 1,
        maxResults,
      })
      .map(result => result.value);
  }

  getExportsStartingWith(query: string, maxResults: number): Array<JSExport> {
    return arrayFlatten(
      this.getIdsMatching(query, maxResults).map(id =>
        this.getExportsFromId(id),
      ),
    );
  }

  setAll(file: NuclideUri, exports: Array<JSExport>) {
    this.clearExportsFromFile(file);
    exports.forEach(exp => this._add(exp));
  }

  _add(newExport: JSExport) {
    const {id, uri} = newExport;
    const idExports = this.exportsForId.get(id);
    const fileExports = this.exportsForFile.get(uri);

    if (idExports) {
      idExports.add(newExport);
    } else {
      this.exportsForId.set(id, new Set([newExport]));
      this.exportIdMatcher.add(id);
    }

    if (fileExports) {
      fileExports.add(newExport);
    } else {
      this.exportsForFile.set(uri, new Set([newExport]));
    }
  }
}
