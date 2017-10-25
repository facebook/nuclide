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

import {Disposable, TextBuffer} from 'atom';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {NUCLIDE_PROTOCOL_PREFIX, NUCLIDE_PROTOCOL_PREFIX_WIN} from './utils';

/**
 * On Windows, normalizing nuclide://a/b/c results in nuclide:\a\b\c.
 * This causes an EINVAL on Atom startup when Atom attempts to read the path;
 * presumably because nuclide:\ is an invalid drive marker. This actually blocks initialization!
 *
 * Instead, we'll override the buffer serializer to normalize nuclide_\/a/b/c instead,
 * which becomes nuclide_\a\b\c. At the very least, this is enough to allow Atom to start up.
 *
 * Atom startup shouldn't be blocked by such errors, and we should fix that.
 * Until then, this is enough to unblock Windows users.
 */
export default function windowsBufferSerializeHack(): IDisposable {
  if (process.platform !== 'win32') {
    return new Disposable();
  }
  let enabled = true;
  // $FlowIgnore: hacks
  const realSerialize = TextBuffer.prototype.serialize;
  // $FlowIgnore: hacks
  TextBuffer.prototype.serialize = function() {
    const state = realSerialize.call(this);
    if (enabled) {
      const {filePath} = state;
      if (filePath != null && nuclideUri.isRemote(filePath)) {
        state.filePath =
          NUCLIDE_PROTOCOL_PREFIX_WIN +
          filePath.substr(NUCLIDE_PROTOCOL_PREFIX.length);
      }
    }
    return state;
  };
  return new Disposable(() => {
    enabled = false;
  });
}
