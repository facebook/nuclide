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

import idx from 'idx';
import featureConfig from 'nuclide-commons-atom/feature-config';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';

export const DisabledReason = Object.freeze({
  INCOMPATIBLE: 'incompatible',
  REIMPLEMENTED: 'reimplemented',
});
type DisabledReasonType = $Values<typeof DisabledReason>;

function deactivateAndUnloadPackage(
  name: string,
  options: {|warn: boolean, reason: DisabledReasonType|},
): void {
  if (atom.packages.initialPackagesActivated === true) {
    if (options.warn) {
      const packageName = featureConfig.getPackageName();
      atom.notifications.addWarning(`Incompatible Package: ${name}`, {
        description: getWarningMessage(name, packageName, options.reason),
        dismissable: true,
      });
    }
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

export default function disablePackage(
  name: string,
  options?: {|reason?: DisabledReasonType|},
): IDisposable {
  const initiallyDisabled = atom.packages.isPackageDisabled(name);
  const reason = idx(options, _ => _.reason) || DisabledReason.INCOMPATIBLE;
  if (!initiallyDisabled) {
    // If it wasn't activated yet, maybe we can prevent the activation altogether
    atom.packages.disablePackage(name);
  }

  if (atom.packages.isPackageActive(name)) {
    deactivateAndUnloadPackage(name, {warn: false, reason});
  }

  const activationMonitor = atom.packages.onDidActivatePackage(pack => {
    if (pack.name === name) {
      deactivateAndUnloadPackage(name, {warn: true, reason});
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
}

function getWarningMessage(
  disabledFeature: string,
  packageName: string,
  reason: DisabledReasonType,
): string {
  switch (reason) {
    case 'incompatible':
      return (
        `${disabledFeature} can't be enabled because it's incompatible with ${packageName}.` +
        ` If you need to use this package, you must first disable ${packageName}.`
      );
    case 'reimplemented':
      return (
        `${disabledFeature} can't be enabled because it's incompatible with ${packageName},` +
        ` however ${packageName} provides similar functionality. If you need to use` +
        ` ${disabledFeature} anyway, you must first disable ${packageName}.`
      );
    default:
      (reason: empty);
      throw new Error(`Invalid reason: ${reason}`);
  }
}
