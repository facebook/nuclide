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

import type {
  GenericResult,
  DashProvider,
  QueryContext,
  // $FlowFB
} from '../../fb-dash/lib/types';
import fuzzAldrinPlus from 'fuzzaldrin-plus';

import highlightText from 'nuclide-commons-ui/highlightText';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';

const ELLIPSES = '\u2026';

export default class NuclidePackageReloadDashProvider
  implements DashProvider<GenericResult> {
  _reloader: string => Promise<void>;

  debounceDelay = 0;
  display = {
    title: 'Nuclide: Reload package',
    prompt: {
      verb: 'Reload',
      object: 'Nuclide packages',
    },
    action: 'nuclide-reload-package-dash-provider:toggle-provider',
  };

  includeAsFallback = true;
  prefix = 'npr';
  priority = 10;

  constructor(reloader: string => Promise<void>) {
    this._reloader = reloader;
  }

  executeQuery(
    query: string,
    queryContext: QueryContext,
    callback: (items: Array<GenericResult>) => mixed,
  ): IDisposable {
    let results;
    if (query === '') {
      results = [
        {
          type: 'generic',
          relevance: 1,
          primaryText: `Nuclide: Reload package ${ELLIPSES}`,
        },
      ];
    } else {
      results = atom.packages.getLoadedPackages().map(pkg => {
        return {
          type: 'generic',
          primaryText: highlightText`Reload ${pkg.name}`,
          secondaryText: pkg.metadata.description,
          relevance: fuzzAldrinPlus.score(pkg.name, query),

          callback: () => {
            this._reloader(pkg.name);
          },
        };
      });
    }

    callback(results);
    return new UniversalDisposable();
  }
}
