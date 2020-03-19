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

export type FileOpenEvent = {
  kind: 'open',
  fileVersion: FileVersion,
  contents: string,
  languageId: string,
};

// Used in debugging to verify that the server contents match the client
export type FileSyncEvent = {
  kind: 'sync',
  fileVersion: FileVersion,
  contents: string,
  languageId: string,
};

export type FileCloseEvent = {
  kind: 'close',
  fileVersion: FileVersion,
};

export type FileEditEvent = {
  kind: 'edit',
  fileVersion: FileVersion,
  oldRange: atom$Range,
  newRange: atom$Range,
  oldText: string,
  newText: string,
};

export type FileSaveEvent = {
  kind: 'save',
  fileVersion: FileVersion,
};

// TODO: Save Events?
export type FileEvent =
  | FileOpenEvent
  | FileCloseEvent
  | FileEditEvent
  | FileSaveEvent
  | FileSyncEvent;

export type LocalFileEvent =
  | FileOpenEvent
  | FileCloseEvent
  | FileEditEvent
  | FileSaveEvent;

export interface FileNotifier {
  onFileEvent(event: FileEvent): Promise<void>;
  onDirectoriesChanged(openDirectories: Set<NuclideUri>): Promise<void>;
  dispose(): void;
}

export type FileVersion = {
  notifier: FileNotifier,
  filePath: NuclideUri,
  version: number,
};
