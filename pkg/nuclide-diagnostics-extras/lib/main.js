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

import type {HomeFragments} from '../../nuclide-home/lib/types';

import {WORKSPACE_VIEW_URI} from 'atom-ide-ui/pkg/atom-ide-diagnostics-ui/lib/DiagnosticsViewModel';

export function getHomeFragments(): HomeFragments {
  return {
    feature: {
      title: 'Diagnostics',
      icon: 'law',
      description:
        'Displays diagnostics, errors, and lint warnings for your files and projects.',
      command: () => {
        // eslint-disable-next-line rulesdir/atom-apis
        atom.workspace.open(WORKSPACE_VIEW_URI, {searchAllPanes: true});
      },
    },
    priority: 4,
  };
}
