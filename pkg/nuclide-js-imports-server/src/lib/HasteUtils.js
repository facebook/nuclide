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
import type {HasteSettings} from '../getConfig';

import nuclideUri from 'nuclide-commons/nuclideUri';

export function hasteReduceName(
  file: NuclideUri,
  hasteSettings: HasteSettings,
): ?string {
  if (!hasteSettings.useNameReducers) {
    return null;
  }
  const {
    nameReducers,
    nameReducerWhitelist,
    nameReducerBlacklist,
  } = hasteSettings;
  if (
    (nameReducerWhitelist.length === 0 ||
      nameReducerWhitelist.some(r => r.test(file))) &&
    !nameReducerBlacklist.some(r => r.test(file))
  ) {
    if (nameReducers.length === 0) {
      // The default name reducer.
      return nuclideUri.stripExtension(nuclideUri.basename(file));
    }
    return nameReducers.reduce(
      (hasteName, reducer) =>
        hasteName.replace(reducer.regexp, reducer.replacement),
      file,
    );
  }
}

export function getHasteName(
  file: NuclideUri,
  ast: Object,
  hasteSettings: HasteSettings,
): ?string {
  if (!hasteSettings.isHaste) {
    return null;
  }
  // Try to use a name reducer, as long as this isn't blacklisted.
  const nameReducerResult = hasteReduceName(file, hasteSettings);
  if (nameReducerResult != null) {
    return nameReducerResult;
  }
  // Otherwise, if there's a @providesModule comment, this is always OK.
  for (const comment of ast.comments) {
    if (comment.type === 'CommentBlock') {
      const providesModule = comment.value.match(/@providesModule\s+(\S+)/);
      if (providesModule != null) {
        return providesModule[1];
      }
    }
  }
  return null;
}
