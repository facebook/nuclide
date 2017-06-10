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

import invariant from 'assert';
import {TextBuffer} from 'atom';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {observableFromSubscribeFunction} from 'nuclide-commons/event';

import NuclideTextBuffer from './NuclideTextBuffer';
import {ServerConnection} from './ServerConnection';

export async function loadBufferForUri(
  uri: NuclideUri,
): Promise<atom$TextBuffer> {
  let buffer = existingBufferForUri(uri);
  if (buffer == null) {
    buffer = createBufferForUri(uri);
  }
  if (buffer.loaded) {
    return buffer;
  }
  try {
    await buffer.load();
    return buffer;
  } catch (error) {
    atom.project.removeBuffer(buffer);
    throw error;
  }
}

/**
 * Returns an existing buffer for that uri, or create one if not existing.
 */
export function bufferForUri(uri: NuclideUri): atom$TextBuffer {
  const buffer = existingBufferForUri(uri);
  if (buffer != null) {
    return buffer;
  }
  return createBufferForUri(uri);
}

function createBufferForUri(uri: NuclideUri): atom$TextBuffer {
  let buffer;
  const params = {
    filePath: uri,
    shouldDestroyOnFileDelete: () =>
      atom.config.get('core.closeDeletedFileTabs'),
  };
  if (nuclideUri.isLocal(uri)) {
    buffer = new TextBuffer(params);
  } else {
    const connection = ServerConnection.getForUri(uri);
    if (connection == null) {
      throw new Error(`ServerConnection cannot be found for uri: ${uri}`);
    }
    buffer = new NuclideTextBuffer(connection, params);
  }
  atom.project.addBuffer(buffer);
  invariant(buffer);
  return buffer;
}

/**
 * Returns an exsting buffer for that uri, or null if not existing.
 */
export function existingBufferForUri(uri: NuclideUri): ?atom$TextBuffer {
  return atom.project.findBufferForPath(uri);
}

/**
 * Provides an asynchronous interface for saving a buffer, regardless of whether it's an Atom
 * TextBuffer or NuclideTextBuffer.
 */
export async function saveBuffer(
  buffer: atom$TextBuffer | NuclideTextBuffer,
): Promise<void> {
  const expectedPath = buffer.getPath();
  const promise = observableFromSubscribeFunction(buffer.onDidSave.bind(buffer))
    .filter(({path}) => path === expectedPath)
    .take(1)
    .ignoreElements()
    .toPromise();
  // `buffer.save` returns a promise in the case of a NuclideTextBuffer. We'll await it to make sure
  // we catch any async errors too.
  await Promise.resolve(buffer.save());
  return promise;
}
