'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

type DiffViewState = {
  filePath: string;
  oldText: string;
  newText: string;
};

type TextDiff = {
  addedLines: Array<number>;
  removedLines: Array<number>;
  oldLineOffsets: {[lineNumber: string]: number};
  newLineOffsets: {[lineNumber: string]: number};
};

class DiffViewModel {
  // The model will evolve with every step of the diff view to include more of the diff and source control logic.
  constructor(uri: string, filePath: string) {
    this._uri = uri;
    this._filePath = filePath;
    this._diffState = null;
  }

  async fetchDiffState(): Promise<void> {
    var {find} = require('nuclide-commons').array;
    var rootDirectory = find(atom.project.getDirectories(), directory => directory.contains(this._filePath));
    if (!rootDirectory) {
      throw new Error('Cannot find root directory for file: ' + this._filePath);
    }
    var repository = await atom.project.repositoryForDirectory(rootDirectory);
    if (!repository || repository.getType() !== 'hg') {
      throw new Error('Diff view only supports hg repositories right now: ' + (repository && repository.getType()));
    }
    var committedContents = await repository.fetchFileContentAtRevision(this._filePath);

    var {getClient} = require('nuclide-client');
    var {getPath} = require('nuclide-remote-uri');

    var client = getClient(this._filePath);
    var localFilePath = getPath(this._filePath);
    var filesystemContents = await client.readFile(localFilePath, 'utf8');

    this._diffState = {
      filePath: this._filePath,
      oldText: committedContents,
      newText: filesystemContents,
    };
  }

  getDiffState(): DiffViewState {
    if (!this._diffState) {
      throw new Error('No diff state is set!');
    }
    return this._diffState;
  }

  getURI(): string {
    return this._uri;
  }

  computeDiff(oldText: string, newText: string): TextDiff {
    var {addedLines, removedLines, chunks} = this._computeDiffChunks(oldText, newText);
    var {oldLineOffsets, newLineOffsets} = this._computeOffsets(chunks);

    return {
      addedLines,
      removedLines,
      oldLineOffsets,
      newLineOffsets,
    };
  }

  _computeDiffChunks(oldText: string, newText: string)
      :{addedLines: Array<number>; removedLines: Array<number>; chunks: Array<any>;} {

    var JsDiff = require('diff');

    // If the last line has changes, JsDiff doesn't return that.
    // Generally, content with new line ending are easier to calculate offsets for.
    if (oldText[oldText.length - 1] !== '\n' || newText[newText.length - 1] !== '\n') {
      oldText += '\n';
      newText += '\n';
    }

    var lineDiff = JsDiff.diffLines(oldText, newText);
    var chunks = [];

    var addedCount = 0;
    var removedCount = 0;
    var nextOffset = 0;
    var offset = 0;

    var addedLines = [];
    var removedLines = [];

    lineDiff.forEach(part => {
      var {added, removed, value} = part;
      var count = value.split('\n').length - 1;
      if (!added && !removed) {
        addedCount += count;
        removedCount += count;
        offset = nextOffset;
        nextOffset = 0;
      } else if (added) {
        for (var i = 0; i < count; i++) {
          addedLines.push(addedCount + i);
        }
        addedCount += count;
        nextOffset += count;
      } else {
        for (var i = 0; i < count; i++) {
          removedLines.push(removedCount + i);
        }
        removedCount += count;
        nextOffset -= count;
      }
      chunks.push({added, removed, value, count, offset});
      offset = 0;
    });
    return {addedLines, removedLines, chunks};
  }

  _computeOffsets(diffChunks: Array<any>): {oldLineOffsets: any; newLineOffsets: any;} {
    var newLineOffsets = {};
    var oldLineOffsets = {};

    var oldLineCount = 0;
    var newLineCount = 0;

    for (var chunk of diffChunks) {
      var {added, removed, offset, count} = chunk;
      if (added) {
        newLineCount += count;
      } else if (removed) {
        oldLineCount += count;
      } else {
        if (offset < 0) {
          newLineOffsets[newLineCount] = offset * -1;
        } else if (offset > 0) {
          oldLineOffsets[oldLineCount] = offset;
        }
        newLineCount += count;
        oldLineCount += count;
      }
    }

    return {
      oldLineOffsets,
      newLineOffsets,
    };
  }
};

module.exports = DiffViewModel;
