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

import {Observable} from 'rxjs';

import nuclideUri from 'nuclide-commons/nuclideUri';
import {observableFromSubscribeFunction} from 'nuclide-commons/event';

export function observeBuffers(
  observeBuffer: (buffer: atom$TextBuffer) => mixed,
): IDisposable {
  return atom.project.observeBuffers(buffer => {
    if (!nuclideUri.isBrokenDeserializedUri(buffer.getPath())) {
      observeBuffer(buffer);
    }
  });
}

// Observes all buffer opens.
// Buffer renames are sent as an open of the new name.
export function observeBufferOpen(): Observable<atom$TextBuffer> {
  return observableFromSubscribeFunction(observeBuffers).mergeMap(buffer => {
    const end = observableFromSubscribeFunction(
      buffer.onDidDestroy.bind(buffer),
    );
    const rename = observableFromSubscribeFunction(
      buffer.onDidChangePath.bind(buffer),
    )
      .map(() => buffer)
      .takeUntil(end);
    return Observable.of(buffer).concat(rename);
  });
}

// Note that on a rename, the openedPath will be the path of the buffer when the open was sent,
// which may not match the current name of the buffer.
export type CloseBufferEvent = {
  kind: 'close',
  openedPath: ?NuclideUri,
  buffer: atom$TextBuffer,
};

// Fires a single event when the buffer is destroyed or renamed.
// Note that on a rename the buffer path will not be the same as the openedPath.
export function observeBufferCloseOrRename(
  buffer: atom$TextBuffer,
): Observable<CloseBufferEvent> {
  const openedPath: ?NuclideUri = buffer.getPath();
  const end = observableFromSubscribeFunction(buffer.onDidDestroy.bind(buffer));
  const rename = observableFromSubscribeFunction(
    buffer.onDidChangePath.bind(buffer),
  );
  return end
    .merge(rename)
    .take(1)
    .map(() => ({kind: 'close', buffer, openedPath}));
}
