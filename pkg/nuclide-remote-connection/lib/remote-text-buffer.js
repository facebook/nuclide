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
import semver from 'semver';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {observableFromSubscribeFunction} from 'nuclide-commons/event';

import NuclideTextBuffer from './NuclideTextBuffer';
import {RemoteFile} from './RemoteFile';
import {ServerConnection} from './ServerConnection';

const IS_ATOM_119 = semver.gte(atom.getVersion(), '1.19.0-beta0');

const TEXT_BUFFER_PARAMS = {
  shouldDestroyOnFileDelete: () => atom.config.get('core.closeDeletedFileTabs'),
};

export async function loadBufferForUri(
  uri: NuclideUri,
): Promise<atom$TextBuffer> {
  let buffer = existingBufferForUri(uri);
  if (buffer == null) {
    if (IS_ATOM_119) {
      return loadBufferForUriStatic(uri).then(loadedBuffer => {
        atom.project.addBuffer(loadedBuffer);
        return loadedBuffer;
      });
    } else {
      // TODO: (hansonw) T19829039 Remove after 1.19
      buffer = createBufferForUri(uri);
    }
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

function loadBufferForUriStatic(uri: NuclideUri): Promise<atom$TextBuffer> {
  if (nuclideUri.isLocal(uri)) {
    // $FlowFixMe: Add after 1.19
    return TextBuffer.load(uri, TEXT_BUFFER_PARAMS);
  }
  const connection = ServerConnection.getForUri(uri);
  if (connection == null) {
    throw new Error(`ServerConnection cannot be found for uri: ${uri}`);
  }
  // $FlowFixMe: Add after 1.19
  return TextBuffer.load(new RemoteFile(connection, uri), TEXT_BUFFER_PARAMS);
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
    ...TEXT_BUFFER_PARAMS,
    filePath: uri,
  };
  if (nuclideUri.isLocal(uri)) {
    buffer = new TextBuffer(params);
  } else {
    const connection = ServerConnection.getForUri(uri);
    if (connection == null) {
      throw new Error(`ServerConnection cannot be found for uri: ${uri}`);
    }
    if (IS_ATOM_119) {
      buffer = new TextBuffer(params);
      // $FlowIgnore: Add setFile after 1.19
      buffer.setFile(new RemoteFile(connection, uri));
    } else {
      // TODO: (hansonw) T19829039 Remove after 1.19
      buffer = new NuclideTextBuffer(connection, params);
    }
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
