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

import nuclideUri from 'nuclide-commons/nuclideUri';

import type {NuclideUri} from 'nuclide-commons/nuclideUri';

export function dedupeUris(uris: Array<NuclideUri>): Array<NuclideUri> {
  const deduped = uris.map(nuclideUri.ensureTrailingSeparator);
  deduped.sort();

  let lastOKPrefix = null;

  return deduped
    .filter(pathName => {
      // Since we've sorted the paths, we know that children will be grouped directly after their
      // parent.
      if (lastOKPrefix != null && pathName.startsWith(lastOKPrefix)) {
        return false;
      }

      lastOKPrefix = pathName;
      return true;
    })
    .map(nuclideUri.trimTrailingSeparator);
}
