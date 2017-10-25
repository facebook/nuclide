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

import {ROOT_ARCHIVE_FS} from '../../nuclide-fs-atom';
import {RemoteFile} from './RemoteFile';
import {ServerConnection} from './ServerConnection';

const TEXT_BUFFER_PARAMS = {
  shouldDestroyOnFileDelete: () => atom.config.get('core.closeDeletedFileTabs'),
};

export async function loadBufferForUri(
  uri: NuclideUri,
): Promise<atom$TextBuffer> {
  const buffer = existingBufferForUri(uri);
  if (buffer == null) {
    return loadBufferForUriStatic(uri).then(loadedBuffer => {
      atom.project.addBuffer(loadedBuffer);
      return loadedBuffer;
    });
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
    if (nuclideUri.isInArchive(uri)) {
      return TextBuffer.load(
        ROOT_ARCHIVE_FS.newArchiveFile(uri),
        TEXT_BUFFER_PARAMS,
      );
    } else {
      return TextBuffer.load(uri, TEXT_BUFFER_PARAMS);
    }
  }
  const connection = ServerConnection.getForUri(uri);
  if (connection == null) {
    throw new Error(`ServerConnection cannot be found for uri: ${uri}`);
  }
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
    if (nuclideUri.isInArchive(uri)) {
      buffer.setFile(ROOT_ARCHIVE_FS.newArchiveFile(uri));
    }
  } else {
    const connection = ServerConnection.getForUri(uri);
    if (connection == null) {
      throw new Error(`ServerConnection cannot be found for uri: ${uri}`);
    }
    buffer = new TextBuffer(params);
    buffer.setFile(new RemoteFile(connection, uri));
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
