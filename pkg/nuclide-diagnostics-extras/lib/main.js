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

export function getHomeFragments(): HomeFragments {
  return {
    feature: {
      title: 'Diagnostics',
      icon: 'law',
      description: 'Displays diagnostics, errors, and lint warnings for your files and projects.',
      command: () => {
        atom.commands.dispatch(
          atom.views.getView(atom.workspace),
          'nuclide-diagnostics-ui:toggle-table',
          {visible: true},
        );
      },
    },
    priority: 4,
  };
}
