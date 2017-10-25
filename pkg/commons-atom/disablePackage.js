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

import featureConfig from 'nuclide-commons-atom/feature-config';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';

function deactivateAndUnloadPackage(name) {
  if (atom.packages.initialPackagesActivated === true) {
    const packageName = featureConfig.getPackageName();
    atom.notifications.addWarning(`Incompatible Package: ${name}`, {
      description:
        `${name} can't be enabled because it's incompatible with ${packageName}. ` +
        `If you need to use this package, you must first disable ${packageName}.`,
    });
  }

  const deactivationPromise =
    atom.packages.deactivatePackage(name) || Promise.resolve();
  deactivationPromise.then(() => {
    atom.packages.disablePackage(name);
    atom.packages.unloadPackage(name);
  });

  // This is a horrible hack to work around the fact that preloaded packages can sometimes be loaded
  // twice. See also atom/atom#14837
  // $FlowIgnore
  delete atom.packages.preloadedPackages[name];
}

// eslint-disable-next-line rulesdir/no-commonjs
module.exports = function(name: string) {
  const initiallyDisabled = atom.packages.isPackageDisabled(name);
  if (!initiallyDisabled) {
    // If it wasn't activated yet, maybe we can prevent the activation altogether
    atom.packages.disablePackage(name);
  }

  if (atom.packages.isPackageActive(name)) {
    deactivateAndUnloadPackage(name);
  }

  const activationMonitor = atom.packages.onDidActivatePackage(pack => {
    if (pack.name === name) {
      deactivateAndUnloadPackage(name);
    }
  });

  const stateRestorer = () => {
    // Re-enable Atom's bundled package to leave the user's environment the way
    // this package found it.
    if (!initiallyDisabled) {
      atom.packages.enablePackage(name);
    }
  };

  return new UniversalDisposable(activationMonitor, stateRestorer);
};
