/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow strict-local
 * @format
 */

import {FileResults} from 'nuclide-commons/FileResults';
import type {Reference, ReferenceGroup} from './types';

type FindReferencesOptions = {
  // Lines of context to show around each preview block. Defaults to 1.
  previewContext?: number,
};

import {getFileForPath} from 'nuclide-commons-atom/projects';
import {getLogger} from 'log4js';

function compareReference(x: Reference, y: Reference): number {
  return x.range.compare(y.range);
}

async function readFileContents(uri: string): Promise<?string> {
  try {
    const file = getFileForPath(uri);
    if (file != null) {
      return await file.read();
    }
  } catch (e) {
    getLogger('atom-ide-find-references').error(
      `find-references: could not load file ${uri}`,
      e,
    );
  }
  return null;
}

function addReferenceGroup(
  groups: Array<ReferenceGroup>,
  references: Array<Reference>,
  startLine: number,
  endLine: number,
) {
  if (references.length) {
    groups.push({references, startLine, endLine});
  }
}

export default class FindReferencesModel {
  _basePath: string;
  _symbolName: string;
  _title: string;
  _references: Array<[string, Array<ReferenceGroup>]>;
  _referenceCount: number;
  _options: FindReferencesOptions;

  /**
   * @param basePath    Base path of the project. Used to display paths in a friendly way.
   * @param symbolName  The name of the symbol we're finding references for.
   * @param references  A list of references to `symbolName`.
   * @param options     See `FindReferencesOptions`.
   */
  constructor(
    basePath: string,
    symbolName: string,
    title: string,
    references: Array<Reference>,
    options?: FindReferencesOptions,
  ) {
    this._basePath = basePath;
    this._symbolName = symbolName;
    this._title = title;
    this._referenceCount = references.length;
    this._options = options || {};

    this._groupReferencesByFile(references);
  }

  /**
   * The main public entry point.
   * Returns a list of references, grouped by file (with previews),
   * according to the given offset and limit.
   * References in each file are grouped together if they're adjacent.
   */
  getFileResults(offset: number, limit: number): Promise<Array<FileResults>> {
    return Promise.all(
      this._references
        .slice(offset, offset + limit)
        .map(this._makeFileReferences.bind(this)),
    );
  }

  getBasePath(): string {
    return this._basePath;
  }

  getTitle(): string {
    return this._title;
  }

  getSymbolName(): string {
    return this._symbolName;
  }

  getReferenceCount(): number {
    return this._referenceCount;
  }

  getFileCount(): number {
    return this._references.length;
  }

  getPreviewContext(): number {
    // flowlint-next-line sketchy-null-number:off
    return this._options.previewContext || 1;
  }

  _groupReferencesByFile(references: Array<Reference>): void {
    // 1. Group references by file.
    const refsByFile = new Map();
    for (const reference of references) {
      let fileReferences = refsByFile.get(reference.uri);
      if (fileReferences == null) {
        refsByFile.set(reference.uri, (fileReferences = []));
      }
      fileReferences.push(reference);
    }

    // 2. Group references within each file.
    this._references = [];
    for (const entry of refsByFile) {
      const [fileUri, entryReferences] = entry;
      entryReferences.sort(compareReference);
      // Group references that are <= 1 line apart together.
      const groups = [];
      let curGroup = [];
      let curStartLine = -11;
      let curEndLine = -11;
      for (const ref of entryReferences) {
        const range = ref.range;
        if (range.start.row <= curEndLine + 1 + this.getPreviewContext()) {
          // Remove references with the same range (happens in C++ with templates)
          if (
            curGroup.length > 0 &&
            compareReference(curGroup[curGroup.length - 1], ref) !== 0
          ) {
            curGroup.push(ref);
            curEndLine = Math.max(curEndLine, range.end.row);
          } else {
            this._referenceCount--;
          }
        } else {
          addReferenceGroup(groups, curGroup, curStartLine, curEndLine);
          curGroup = [ref];
          curStartLine = range.start.row;
          curEndLine = range.end.row;
        }
      }
      addReferenceGroup(groups, curGroup, curStartLine, curEndLine);
      this._references.push([fileUri, groups]);
    }

    // Finally, sort by file name.
    this._references.sort((x, y) => x[0].localeCompare(y[0]));
  }

  /**
   * Fetch file previews and expand line ranges with context.
   */
  async _makeFileReferences(
    fileReferences: [string, Array<ReferenceGroup>],
  ): Promise<FileResults> {
    const uri = fileReferences[0];
    const refGroups = fileReferences[1];
    const fileContents = await readFileContents(uri);
    // flowlint-next-line sketchy-null-string:off
    if (!fileContents) {
      return new FileResults(uri, []);
    }
    const fileLines = fileContents.split('\n');
    const lineGroups = refGroups.map(group => {
      let {startLine, endLine} = group;
      // Expand start/end lines with context.
      startLine = Math.max(startLine - this.getPreviewContext(), 0);
      endLine = Math.min(
        endLine + this.getPreviewContext(),
        fileLines.length - 1,
      );
      // However, don't include blank lines.
      while (startLine < endLine && fileLines[startLine] === '') {
        startLine++;
      }
      while (startLine < endLine && fileLines[endLine] === '') {
        endLine--;
      }
      return {
        // ScrollableResults expects this line to be 1-based.
        startLine: startLine + 1,
        lines: fileLines.slice(startLine, endLine + 1),
        matches: group.references.map(ref => ref.range),
      };
    });
    return new FileResults(uri, lineGroups);
  }
}
