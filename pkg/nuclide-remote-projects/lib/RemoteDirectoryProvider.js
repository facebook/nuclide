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

import {
  RemoteConnection,
  RemoteDirectory,
} from '../../nuclide-remote-connection';

/**
 * The prefix a URI must have for `RemoteDirectoryProvider` to try to produce a
 * `RemoteDirectory` for it. This should also be the path prefix checked by the
 * handler we register with `atom.project.registerOpener()` to open remote files.
 */
const REMOTE_PATH_URI_PREFIX = 'nuclide://';

export default class RemoteDirectoryProvider {
  directoryForURISync(uri: string): ?RemoteDirectory {
    if (!uri.startsWith(REMOTE_PATH_URI_PREFIX)) {
      return null;
    }
    const connection = RemoteConnection.getForUri(uri);
    if (connection) {
      return connection.createDirectory(uri);
    } else {
      // Return null here. In response, Atom will create a generic Directory for
      // this URI, and add it to the list of root project paths (atom.project.getPaths()).
      // In remote-projects/main.js, we remove these generic directories.
      return null;
    }
  }

  directoryForURI(uri: string): Promise<any> {
    return Promise.resolve(this.directoryForURISync(uri));
  }
}
