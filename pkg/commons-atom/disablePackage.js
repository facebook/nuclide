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

function disablePackage(name) {
  if (!atom.packages.isPackageDisabled(name)) {
    // Calling `disablePackage` on a package first *loads* the package. This step must come
    // before calling `unloadPackage`.
    atom.packages.disablePackage(name);
  }

  if (atom.packages.isPackageLoaded(name)) {
    if (atom.packages.isPackageActive(name)) {
      // Only *inactive* packages can be unloaded. Attempting to unload an active package is
      // considered an exception. Deactivating must come before unloading.
      atom.packages.deactivatePackage(name);
    }

    atom.packages.unloadPackage(name);
  }

  // This is a horrible hack to work around the fact that preloaded packages can sometimes be loaded
  // twice. See also atom/atom#14837
  // $FlowIgnore
  delete atom.packages.preloadedPackages[name];
}

// eslint-disable-next-line nuclide-internal/no-commonjs
module.exports = function(name: string) {
  // Disable Atom's bundled package. If this activation is happening during the
  // normal startup activation, the `onDidActivateInitialPackages` handler below must unload the
  // package because it will have been loaded during startup.
  disablePackage(name);

  // Disabling and unloading Atom's bundled package must happen after activation because this
  // package's `activate` is called during an traversal of all initial packages to activate.
  // Disabling a package during the traversal has no effect if this is a startup load because
  // `PackageManager` does not re-load the list of packages to activate after each iteration.
  const disposable = atom.packages.onDidActivateInitialPackages(() => {
    disablePackage(name);
  });

  return () => {
    // Re-enable Atom's bundled package to leave the user's environment the way
    // this package found it.
    if (atom.packages.isPackageDisabled(name)) {
      atom.packages.enablePackage(name);
    }
    disposable.dispose();
  };
};
