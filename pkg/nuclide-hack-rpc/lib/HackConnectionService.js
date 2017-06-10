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
import type {HackCompletion, HackDiagnostic} from './rpc-types';
import type {ConnectableObservable} from 'rxjs';

// Note that all line/column values are 1-based.
export type Position = {
  line: number,
  column: number,
};

// end is exclusive, so start == end implies a 0 length range.
// end must be >= start.
export type Range = {
  start: Position,
  end: Position,
};

// Indicates that the text at range in the file has been
// replaced by text. If range is null, then the new file contents
// is set to text.
// inserts are represented as ranges with start == end.
export type TextEdit = {
  range?: Range,
  text: string,
};

// Inidicates that the file has been opened by the IDE.
// Hack should get its source of truth for the file from
// didChangeFile notifications until didCloseFile is seen.
export function didOpenFile(
  filename: NuclideUri,
  version: number,
  contents: string,
): void {
  throw new Error('RPC stub');
}

// The version number corresponds to the contents of the file after
// all changes have been applied.
export function didChangeFile(
  filename: NuclideUri,
  version: number,
  changes: Array<TextEdit>,
): void {
  throw new Error('RPC stub');
}

// Indicates that the file has been closed by the IDE.
// Hack should get its source of truth for the file from the file system.
export function didCloseFile(filename: NuclideUri): void {
  throw new Error('RPC stub');
}

// Created indicates that a new file has been added to the Hack project.
//
// Changed indicates that the IDE has noticed that a non-open file has
// been modified. It is provided to Hack purely for informational purposes.
//
// Deleted means a file has been deleted.
//
// Saved indicates that the IDE has saved a file. This is purely informational
// as Hack should get the source of truth from didChangeFile.
export type FileEventType = 'Created' | 'Changed' | 'Deleted' | 'Saved';

export type FileEvent = {
  filename: NuclideUri,
  type: FileEventType,
};

// Indicates that the set of files in the Hack project has changed.
// Subsequent requests should not complete successfully until Hack
// accounts for the indicated change.
export function didChangeWatchedFiles(changes: Array<FileEvent>): void {
  throw new Error('RPC stub');
}

export function getCompletions(
  filename: NuclideUri,
  position: Position,
): Promise<Array<HackCompletion>> {
  throw new Error('RPC stub');
}

export type HackDiagnosticsMessage = {
  filename: NuclideUri,
  errors: Array<{
    message: HackDiagnostic,
  }>,
};

export function notifyDiagnostics(): ConnectableObservable<
  HackDiagnosticsMessage,
> {
  throw new Error('RPC stub');
}

// Gracefully terminates the connection.
export function disconnect(): void {
  throw new Error('RPC stub');
}
