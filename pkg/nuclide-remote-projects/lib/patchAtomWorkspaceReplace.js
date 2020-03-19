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

import {setDifference} from 'nuclide-commons/collection';
import nuclideUri from 'nuclide-commons/nuclideUri';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {getGrepServiceByNuclideUri} from '../../nuclide-remote-connection';

/**
 *           |\___/|
 *          (,\  /,)\
 *          /     /  \
 *         (@_^_@)/   \
 *          W//W_/     \
 *        (//) |        \
 *      (/ /) _|_ /   )  \
 *    (// /) '/,_ _ _/  (~^-.
 *  (( // )) ,-{        _    `.
 * (( /// ))  '/\      /      |
 * (( ///))     `.   {       }
 *  ((/ ))    .----~-.\   \-'
 *           ///.----..>   \
 *            ///-._ _  _ _}
 *
 * Here be dragons! We should try to avoid monkey-patching when humanly possible.
 * This patches `atom.workspace.replace` with a remote-compatible version.
 * The right fix is probably to have Atom call `Directory.replace` or similar,
 * which we can then override in our custom `RemoteDirectory` implementation.
 */
export default function patchAtomWorkspaceReplace(): UniversalDisposable {
  const workspace = (atom.workspace: any);
  const originalReplace = workspace.replace;

  workspace.replace = (
    regex: RegExp,
    replacementText: string,
    filePaths: Array<string>,
    iterator: Function,
  ) => {
    // Atom can handle local paths and opened buffers, so filter those out.
    const filePathSet = new Set(filePaths);
    const openBuffers = new Set(
      atom.project
        .getBuffers()
        .map(buf => buf.getPath())
        .filter(Boolean),
    );
    const unopenedRemotePaths = new Set(
      filePaths.filter(
        path => nuclideUri.isRemote(path) && !openBuffers.has(path),
      ),
    );
    const regularReplace =
      unopenedRemotePaths.size === filePathSet.size
        ? Promise.resolve(null)
        : originalReplace.call(
            atom.workspace,
            regex,
            replacementText,
            Array.from(setDifference(filePathSet, unopenedRemotePaths)),
            iterator,
          );
    const remotePaths = new Map();
    for (const path of unopenedRemotePaths) {
      const service = getGrepServiceByNuclideUri(path);
      let list = remotePaths.get(service);
      if (list == null) {
        list = [];
        remotePaths.set(service, list);
      }
      list.push(path);
    }
    const promises = [regularReplace];
    remotePaths.forEach((paths, service) => {
      promises.push(
        service
          .grepReplace(paths, regex, replacementText)
          .refCount()
          .do(result => {
            if (result.type === 'error') {
              iterator(
                null,
                new Error(`${result.filePath}: ${result.message}`),
              );
            } else {
              iterator(result);
            }
          })
          .toPromise()
          .catch(err => {
            iterator(null, err);
          }),
      );
    });
    return Promise.all(promises);
  };

  return new UniversalDisposable(() => {
    workspace.replace = originalReplace;
  });
}
