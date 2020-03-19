/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 */

import {
  RemoteConnection,
  RemoteDirectoryPlaceholder,
} from '../../nuclide-remote-connection';

/**
 * The prefix a URI must have for `RemoteDirectoryProvider` to try to produce a
 * `RemoteDirectory` for it. This should also be the path prefix checked by the
 * handler we register with `atom.project.registerOpener()` to open remote files.
 */
const REMOTE_PATH_URI_PREFIX = 'nuclide://';

export default class RemoteDirectoryProvider {
  directoryForURISync(uri: string): mixed {
    if (!uri.startsWith(REMOTE_PATH_URI_PREFIX)) {
      return null;
    }
    const connection = RemoteConnection.getForUri(uri);
    if (connection) {
      return connection.createDirectory(uri);
    } else {
      // Return a placeholder that always return true for existsSync.
      // This is to prevent Atom from displaying an error at startup.
      // We remove all remote projects in Nuclide's main.js file, and then
      // later reload them manually in the remote-projects main file.
      return new RemoteDirectoryPlaceholder(uri);
    }
  }

  directoryForURI(uri: string): Promise<mixed> {
    return Promise.resolve(this.directoryForURISync(uri));
  }
}
