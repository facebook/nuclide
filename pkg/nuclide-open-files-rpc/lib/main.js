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

import type {FileVersion} from './rpc-types';

import {FileCache} from './FileCache';
import {FileVersionNotifier} from './FileVersionNotifier';

export {FileCache, FileVersionNotifier};
export {FileEventKind} from './constants';
export {ConfigObserver} from './ConfigObserver';

import invariant from 'assert';

export const OPEN_FILES_SERVICE = 'OpenFilesService';

export function getBufferAtVersion(
  fileVersion: FileVersion,
): Promise<?simpleTextBuffer$TextBuffer> {
  invariant(
    fileVersion.notifier instanceof FileCache,
    "Don't call this from the Atom process",
  );
  return (fileVersion.notifier: FileCache).getBufferAtVersion(fileVersion);
}
