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

import url from 'url';

export function openFileInDiffView(filePath: NuclideUri): void {
  const diffOpenUrl = url.format({
    protocol: 'atom',
    host: 'nuclide',
    pathname: 'diff-view',
    slashes: true,
    query: {
      file: filePath,
      onlyDiff: true,
    },
  });
  // This is not a file URI
  // eslint-disable-next-line nuclide-internal/atom-apis
  atom.workspace.open(diffOpenUrl);
}
