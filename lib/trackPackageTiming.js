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

import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {track} from 'nuclide-commons/analytics';

export default function trackPackageTiming(): IDisposable {
  const disposable = new UniversalDisposable();

  if (atom.packages.initialPackagesActivated) {
    trackPackages();
  } else {
    disposable.add(atom.packages.onDidActivateInitialPackages(trackPackages));
  }

  return disposable;
}

function trackPackages() {
  const loadedPackages = atom.packages
    .getLoadedPackages()
    .filter(pkg => pkg.getType() !== 'theme');

  for (const pkg of loadedPackages) {
    const {name, initializeTime, activateTime, loadTime} = pkg;
    // only track if there's a relevant piece of timing data
    if (initializeTime != null || activateTime != null) {
      track('package-timing', {name, initializeTime, activateTime, loadTime});
    }
  }
}
