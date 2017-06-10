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
import type {
  RemoteConnectionConfiguration,
} from '../../nuclide-remote-connection/lib/RemoteConnection';

import invariant from 'assert';
import nuclideUri from 'nuclide-commons/nuclideUri';

const NUCLIDE_PROTOCOL_PREFIX = 'nuclide:/';
const NUCLIDE_PROTOCOL_PREFIX_WIN = 'nuclide:\\';
const NUCLIDE_PROTOCOL_PREFIX_LENGTH = NUCLIDE_PROTOCOL_PREFIX.length;

export type OpenFileEditorInstance = {
  pane: atom$Pane,
  editor: atom$TextEditor,
  uri: NuclideUri,
  filePath: string,
};

/**
 * Clean a nuclide URI from the prepended absolute path prefixes and fix
 * the broken uri, in the sense that it's nuclide:/server/path/to/dir instead of
 * nuclide://server/path/to/dir because Atom called path.normalize() on the directory uri.
 */
export function sanitizeNuclideUri(uri_: string): string {
  let uri = uri_;
  // Remove the leading absolute path prepended to the file paths
  // between atom reloads.
  const protocolIndex = uri.indexOf(NUCLIDE_PROTOCOL_PREFIX);
  if (protocolIndex > 0) {
    uri = uri.substring(protocolIndex);
  }
  // Add the missing slash, if removed through a path.normalize() call.
  if (
    uri.startsWith(NUCLIDE_PROTOCOL_PREFIX) &&
    uri[NUCLIDE_PROTOCOL_PREFIX_LENGTH] !==
      '/' /* protocol missing last slash */
  ) {
    uri =
      uri.substring(0, NUCLIDE_PROTOCOL_PREFIX_LENGTH) +
      '/' +
      uri.substring(NUCLIDE_PROTOCOL_PREFIX_LENGTH);
  }

  // On Windows path normalization converts all of the '/' chars to '\'
  // we need to revert that
  if (uri.startsWith(NUCLIDE_PROTOCOL_PREFIX_WIN)) {
    uri =
      NUCLIDE_PROTOCOL_PREFIX +
      '/' +
      uri.substring(NUCLIDE_PROTOCOL_PREFIX_LENGTH).replace(/\\/g, '/');
  }
  return uri;
}

export function* getOpenFileEditorForRemoteProject(
  connectionConfig: RemoteConnectionConfiguration,
): Iterator<OpenFileEditorInstance> {
  for (const pane of atom.workspace.getPanes()) {
    const paneItems = pane.getItems();
    for (const paneItem of paneItems) {
      // Here, we're explicitly looking for broken nuclide:/ editors.
      // eslint-disable-next-line nuclide-internal/atom-apis
      if (!atom.workspace.isTextEditor(paneItem) || !paneItem.getURI()) {
        // Ignore non-text editors and new editors with empty uris / paths.
        continue;
      }
      const uri = sanitizeNuclideUri(paneItem.getURI());
      const {hostname: fileHostname, path: filePath} = nuclideUri.parse(uri);
      if (fileHostname === connectionConfig.host) {
        invariant(fileHostname);
        yield {
          pane,
          editor: paneItem,
          uri,
          filePath,
        };
      }
    }
  }
}
