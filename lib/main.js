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

/**
 *                  _  _ _  _ ____ _    _ ___  ____
 *                  |\ | |  | |    |    | |  \ |___
 *                  | \| |__| |___ |___ | |__/ |___
 * _  _ _  _ _ ____ _ ____ ___     ___  ____ ____ _  _ ____ ____ ____
 * |  | |\ | | |___ | |___ |  \    |__] |__| |    |_/  |__| | __ |___
 * |__| | \| | |    | |___ |__/    |    |  | |___ | \_ |  | |__] |___
 *
 */

import type {Feature} from 'nuclide-commons-atom/FeatureLoader';

import './preload-dependencies';

import FeatureLoader from 'nuclide-commons-atom/FeatureLoader';
import featureConfig from 'nuclide-commons-atom/feature-config';
import fs from 'fs';
import invariant from 'assert';
import electron from 'electron';
// eslint-disable-next-line rulesdir/prefer-nuclide-uri
import path from 'path';
import {install as atomPackageDepsInstall} from 'atom-package-deps';
import nullthrows from 'nullthrows';
import semver from 'semver';

import patchCommands from './patchCommands';
import installErrorReporter from './installErrorReporter';
import installDevTools from './installDevTools';
import nuclidePackageJson from '../package.json';
import {initializeLogging} from '../pkg/nuclide-logging';
import {setUseLocalRpc} from '../pkg/nuclide-remote-connection/lib/service-manager';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';

// The minimum version of Atom required to run Nuclide. Anything less than this and users will get
// a redbox and Nuclide will not activate.
const MINIMUM_SUPPORTED_ATOM_VERSION = '1.19.0';

// Install the error reporting even before Nuclide is activated.
let errorReporterDisposable = installErrorReporter();
// Install the logger config before Nuclide is activated.
initializeLogging();

const {remote} = electron;
invariant(remote != null);

const baseConfig = {
  installRecommendedPackages: {
    default: false,
    description:
      'On start up, check for and install Atom packages recommended for use with Nuclide. The' +
      " list of packages can be found in the <code>package-deps</code> setting in this package's" +
      ' "package.json" file. Disabling this setting will not uninstall packages it previously' +
      ' installed. Restart Atom after changing this setting for it to take effect.',
    title: 'Install Recommended Packages on Startup',
    type: 'boolean',
  },
  useLocalRpc: {
    default: false,
    description:
      'Use RPC marshalling for local services. This ensures better compatibility between the local' +
      ' and remote case. Useful for internal Nuclide development. Requires restart to take' +
      ' effect.',
    title: 'Use RPC for local Services.',
    type: 'boolean',
  },
};

// `setUseLocalRpc` can only be called once, so it's set out here during load.
const _useLocalRpc = atom.config.get('nuclide.useLocalRpc');
const _shouldUseLocalRpc =
  typeof _useLocalRpc !== 'boolean'
    ? baseConfig.useLocalRpc.default
    : _useLocalRpc;
setUseLocalRpc(_shouldUseLocalRpc);

// Nuclide packages for Atom are called "features"
const FEATURES_DIR = path.join(__dirname, '../pkg');
const features: Array<Feature> = [];

/**
 * Get the "package.json" of all the features.
 */
fs.readdirSync(FEATURES_DIR).forEach(item => {
  // Optimization: Our directories don't have periods - this must be a file
  if (item.indexOf('.') !== -1) {
    return;
  }
  const dirname = path.join(FEATURES_DIR, item);
  const filename = path.join(dirname, 'package.json');
  try {
    const stat = fs.statSync(filename);
    invariant(stat.isFile());
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      return;
    }
  }
  const src = fs.readFileSync(filename, 'utf8');
  // Optimization: Avoid JSON parsing if it can't reasonably be an Atom package
  if (src.indexOf('"Atom"') === -1) {
    return;
  }
  const pkg = JSON.parse(src);
  if (pkg.nuclide && pkg.nuclide.packageType === 'Atom') {
    invariant(pkg.name);
    features.push({
      pkg,
      dirname,
    });
  }
});

// atom-ide-ui packages are a lot more consistent.
const ATOM_IDE_DIR = path.join(__dirname, '../modules/atom-ide-ui/pkg');
fs.readdirSync(ATOM_IDE_DIR).forEach(item => {
  const dirname = path.join(ATOM_IDE_DIR, item);
  const filename = path.join(dirname, 'package.json');
  try {
    const src = fs.readFileSync(filename, 'utf8');
    const pkg = JSON.parse(src);
    invariant(pkg.name);
    features.push({
      pkg,
      dirname,
    });
  } catch (err) {
    if (err.code !== 'ENOENT') {
      throw err;
    }
  }
});

const shouldInitialize = ensureAtomVersion();

let featureLoader;

if (shouldInitialize) {
  featureLoader = new FeatureLoader({
    features,
    pkgName: 'nuclide',
  });
  featureLoader.load();
}

export const config = shouldInitialize
  ? {...baseConfig, ...nullthrows(featureLoader).getConfig()}
  : undefined;

let disposables;
function _activate() {
  if (errorReporterDisposable == null) {
    errorReporterDisposable = installErrorReporter();
  }

  if (atom.inDevMode() && process.env.SANDCASTLE == null) {
    installDevTools();
  }

  disposables = new UniversalDisposable();
  disposables.add(patchCommands());

  // Add the "Nuclide" menu, if it's not there already.
  disposables.add(
    atom.menu.add([
      {
        // On Windows, menu labels have an & before a letter to indicate which
        // ALT key combination maps to that menu. In our case, Alt+N should open
        // the Nuclide menu.
        label: process.platform === 'win32' ? '&Nuclide' : 'Nuclide',
        submenu: [
          {
            label: `Version ${nuclidePackageJson.version}`,
            enabled: false,
          },
        ],
      },
    ]),
  );

  // Manually manipulate the menu template order.
  const insertIndex = atom.menu.template.findIndex(
    item => item.role === 'window' || item.role === 'help',
  );
  if (insertIndex !== -1) {
    const nuclideIndex = atom.menu.template.findIndex(
      item => item.label === 'Nuclide',
    );
    const menuItem = atom.menu.template.splice(nuclideIndex, 1)[0];
    const newIndex = insertIndex > nuclideIndex ? insertIndex - 1 : insertIndex;
    atom.menu.template.splice(newIndex, 0, menuItem);
    atom.menu.update();
  }

  // Activate all of the loaded features. Technically, this will be a no-op
  // generally because Atom [will activate all loaded packages][1]. However,
  // that won't happen, for example, with our `activateAllPackages()`
  // integration test helper.
  //
  // [1]: https://github.com/atom/atom/blob/v1.9.0/src/package-manager.coffee#L425
  featureLoader.activate();

  // Install public, 3rd-party Atom packages listed in this package's 'package-deps' setting. Run
  // this *after* other packages are activated so they can modify this setting if desired before
  // installation is attempted.
  if (featureConfig.get('installRecommendedPackages')) {
    // Workaround for restoring multiple Atom windows. This prevents having all
    // the windows trying to install the deps at the same time - often clobbering
    // each other's install.
    const firstWindowId = remote.BrowserWindow.getAllWindows()[0].id;
    const currentWindowId = remote.getCurrentWindow().id;
    if (firstWindowId === currentWindowId) {
      atomPackageDepsInstall('nuclide', /* promptUser */ false);
    }
  }

  const menusToSort = ['Nuclide', 'View'];
  disposables.add(
    atom.packages.onDidActivateInitialPackages(() => {
      sortMenuGroups(menusToSort);
      invariant(disposables != null);
      disposables.add(
        atom.packages.onDidActivatePackage(() => {
          sortMenuGroups(menusToSort);
        }),
      );
    }),
  );
}

function sortLabelValue(label: ?string) {
  // Ignore the Windows accelerator key hint when sorting, the & doesn't
  // actually appear in the UX so it shouldn't affect the sort.
  return String(label).replace('&', '');
}

function sortSubmenuGroup(
  menuItems: Array<{
    label: string,
  }>,
  startIndex: number,
  itemCount: number,
) {
  // Sort a subset of the items in the menu of length itemCount beginning
  // at startIndex.
  const itemsToSort = menuItems.splice(startIndex, itemCount);
  itemsToSort.sort((a, b) => {
    // Always put the "Version" label up top.
    if (sortLabelValue(a.label).startsWith('Version')) {
      return -1;
    } else {
      return sortLabelValue(a.label).localeCompare(sortLabelValue(b.label));
    }
  });

  menuItems.splice(startIndex, 0, ...itemsToSort);
}

function sortMenuGroups(menuNames: Array<string>) {
  for (const menuName of menuNames) {
    // Sorts the items in a menu alphabetically. If the menu contains one or more
    // separators, then the items within each separator subgroup will be sorted
    // with respect to each other, but items will remain in the same groups, and
    // the separators will not be moved.
    const menu = atom.menu.template.find(
      m => sortLabelValue(m.label) === menuName,
    );
    if (menu == null) {
      continue;
    }

    // Sort each group of items (separated by a separator) individually.
    let sortStart = 0;
    for (let i = 0; i < menu.submenu.length; i++) {
      if (menu.submenu[i].type === 'separator') {
        sortSubmenuGroup(menu.submenu, sortStart, i - sortStart);
        sortStart = i + 1;
      }
    }

    // Sort any remaining items after the last separator.
    if (sortStart < menu.submenu.length) {
      sortSubmenuGroup(
        menu.submenu,
        sortStart,
        menu.submenu.length - sortStart,
      );
    }
  }

  atom.menu.update();
}

function _deactivate() {
  invariant(disposables != null);
  featureLoader.deactivate();
  disposables.dispose();
  disposables = null;
  invariant(errorReporterDisposable != null);
  errorReporterDisposable.dispose();
  errorReporterDisposable = null;
}

function _serialize() {
  featureLoader.serialize();
}

function ensureAtomVersion() {
  if (semver.lt(atom.getVersion(), MINIMUM_SUPPORTED_ATOM_VERSION)) {
    const notification = atom.notifications.addError(
      '**Atom Upgrade Required**',
      {
        description:
          `Nuclide requires Atom ${MINIMUM_SUPPORTED_ATOM_VERSION}. **All of its functionality will` +
          ' be disabled until you upgrade.**',
        dismissable: true,
        buttons: [
          {
            text: 'Quit Atom',
            className: 'icon icon-stop',
            onDidClick() {
              atom.commands.dispatch(
                atom.views.getView(atom.workspace),
                'application:quit',
              );
            },
          },
          {
            text: 'Continue without Nuclide',
            className: 'nuclide-min-atom-button',
            onDidClick() {
              notification.dismiss();
            },
          },
        ],
      },
    );
    // Hide the normal close button so that people need to use our custom button to close (and are
    // hopefully, as a result, more aware of what we're saying). Unfortunately, Atom doesn't provide
    // access to this view so we have to find it.
    const continueButton = document.querySelector('.nuclide-min-atom-button');
    const notificationEl =
      continueButton && continueButton.closest('atom-notification');
    const closeButton =
      notificationEl && notificationEl.querySelector('.close');
    if (closeButton != null) {
      closeButton.style.display = 'none';
    }
    return false;
  }
  return true;
}

export const activate = shouldInitialize ? _activate : undefined;
export const deactivate = shouldInitialize ? _deactivate : undefined;
export const serialize = shouldInitialize ? _serialize : undefined;
