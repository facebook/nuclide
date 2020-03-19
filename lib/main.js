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

import monkeyPatchProjectConfigs from './monkeyPatchProjectConfigs';
import trackPackageTiming from './trackPackageTiming';
import './preload-dependencies';

import nuclideUri from 'nuclide-commons/nuclideUri';
import {sleep} from 'nuclide-commons/promise';
import FeatureLoader from 'nuclide-commons-atom/FeatureLoader';
import ActivateGKFeatures from './ActivateGKFeatures';
import featureConfig from 'nuclide-commons-atom/feature-config';
import fs from 'fs';
import invariant from 'assert';
import electron from 'electron';
// eslint-disable-next-line nuclide-internal/prefer-nuclide-uri
import path from 'path';
import {install as atomPackageDepsInstall} from 'atom-package-deps';
import nullthrows from 'nullthrows';
import semver from 'semver';
import log4js from 'log4js';

import installErrorReporter from './installErrorReporter';
import installDevTools from './installDevTools';
import nuclidePackageJson from '../package.json';
import {sendDeepLink} from '../pkg/commons-atom/deep-link';
import {initializeLogging, getDefaultConfig} from '../pkg/nuclide-logging';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import pubFeatureGroups from './featureGroups.json';
import createDOMPurify from 'dompurify';
import patchHighlightView from './patchHighlightView';
import {sortMenuGroups} from 'nuclide-commons/menuUtils';

// Monkeypatch project APIs into Atom. This can be removed after this functionality has been
// upstreamed, i.e. when `atom.project.replace()` and `atom.project.getSpecification()` are
// available.
monkeyPatchProjectConfigs();

let featureGroups = pubFeatureGroups;
try {
  // $eslint-disable-next-line $FlowFB
  const fbFeatureGroups = require('./fb-featureGroups.json');
  featureGroups = mergeFeatureGroups(featureGroups, fbFeatureGroups);
} catch (e) {}

const domPurify = createDOMPurify();

// The minimum version of Atom required to run Nuclide. Anything less than this and users will get
// a redbox and Nuclide will not activate.
const MINIMUM_SUPPORTED_ATOM_VERSION = '1.28.0';

// Install the error reporting even before Nuclide is activated.
// We're intentionally not disposing error reporters on nuclide
// de-activcation, see D13241807
installErrorReporter();
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
    order: 0,
  },
  useLocalRpc: {
    default: !atom.inSpecMode(),
    description:
      'Use a RPC process for local services. This ensures better compatibility between the local' +
      ' and remote case and improves local performance. Requires restart to take' +
      ' effect.',
    title: 'Use RPC for local services.',
    type: 'boolean',
    order: 0,
  },
};

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
  const featurePath = path.join(FEATURES_DIR, item);
  const filename = path.join(featurePath, 'package.json');
  let src;
  try {
    src = fs.readFileSync(filename, 'utf8');
  } catch (err) {
    if (err && (err.code === 'ENOENT' || err.code === 'ENOTDIR')) {
      return;
    }
    throw err;
  }
  // Optimization: Avoid JSON parsing if it can't reasonably be an Atom package
  if (src.indexOf('"AtomPackage"') === -1) {
    return;
  }
  const pkg = JSON.parse(src);
  if (pkg.nuclide && pkg.nuclide.packageType === 'AtomPackage') {
    invariant(pkg.name);
    features.push({
      pkg,
      path: featurePath,
    });
  }
});

// atom-ide-ui packages are a lot more consistent.
function addFeature(directory, name) {
  const featurePath = path.join(directory, name);
  const filename = path.join(featurePath, 'package.json');
  try {
    const src = fs.readFileSync(filename, 'utf8');
    const pkg = JSON.parse(src);
    invariant(pkg.name);
    features.push({
      pkg,
      path: featurePath,
    });
  } catch (err) {
    if (err.code !== 'ENOENT' && err.code !== 'ENOTDIR') {
      throw err;
    }
  }
}

const MODULES_DIR = path.join(__dirname, '../modules');
const ATOM_IDE_DIR = path.join(MODULES_DIR, 'atom-ide-ui/pkg');

fs.readdirSync(ATOM_IDE_DIR).forEach(name => addFeature(ATOM_IDE_DIR, name));
fs.readdirSync(MODULES_DIR)
  .filter(name => name.startsWith('atom-ide-debugger-'))
  .forEach(name => addFeature(MODULES_DIR, name));

const shouldInitialize = ensureAtomVersion();

let featureLoader;

if (shouldInitialize) {
  featureLoader = new FeatureLoader({
    path: path.resolve(__dirname, '..'),
    features,
    featureGroups,
  });
  featureLoader.load();
}

export const config = shouldInitialize
  ? {...baseConfig, ...nullthrows(featureLoader).getConfig()}
  : undefined;

let disposables;
function _activate() {
  log4js.configure(getDefaultConfig());

  disposables = new UniversalDisposable(
    // Patch highlight-selected to limit the number of highlighted markers it creates
    patchHighlightView(),
    // Track initialize, activation, and load times of packages
    trackPackageTiming(),
  );

  if (process.env.SANDCASTLE == null) {
    disposables.add(installDevTools());
  }

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
      {
        label: process.platform === 'win32' ? '&Go' : 'Go',
        // an empty submenu is required to manipulate its position below
        submenu: [],
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

  const goInsertIndex = atom.menu.template.findIndex(
    item => item.label === 'Packages',
  );
  if (goInsertIndex !== -1) {
    const goIndex = atom.menu.template.findIndex(item => item.label === 'Go');
    const menuItem = atom.menu.template.splice(goIndex, 1)[0];
    const newIndex =
      goInsertIndex > goIndex ? goInsertIndex - 1 : goInsertIndex;
    atom.menu.template.splice(newIndex, 0, menuItem);
    atom.menu.update();
  }

  // Remove all remote directories up front to prevent packages from using remote URIs
  // before they are ready. The nuclide-remote-projects package manually
  // serializes/deserializes and then reloads these during the activation phase.
  atom.project.setPaths(
    atom.project.getPaths().filter(uri => !nuclideUri.isRemote(uri)),
  );

  // Activate all of the loaded features. Technically, this will be a no-op
  // generally because Atom [will activate all loaded packages][1]. However,
  // that won't happen, for example, with our `activateAllPackages()`
  // integration test helper.
  //
  // [1]: https://github.com/atom/atom/blob/v1.9.0/src/package-manager.coffee#L425
  featureLoader.activate();

  // Activate packages with GK hooks.
  disposables.add(new ActivateGKFeatures());

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

  patchNotificationManager();
}

function patchNotificationManager() {
  const {addNotification} = atom.notifications;

  // Patch the notification functions to make sure they only display cleaned
  // HTML output.
  // $FlowIgnore - property not writeable
  atom.notifications.addNotification = (notification: atom$Notification) => {
    // $FlowIgnore - internal property
    notification.message = domPurify.sanitize(notification.message, {
      FORBID_TAGS: ['style'],
    });
    return addNotification.bind(atom.notifications)(notification);
  };
}

function mergeFeatureGroups(
  firstGroup: {[string]: Array<string>},
  secondGroup: {[string]: Array<string>},
): {[string]: Array<string>} {
  const mergedObject = {};
  for (const key in firstGroup) {
    mergedObject[key] = [
      ...(firstGroup[key] || []),
      ...(secondGroup[key] || []),
    ];
  }
  for (const key in secondGroup) {
    mergedObject[key] = [
      ...(firstGroup[key] || []),
      ...(secondGroup[key] || []),
    ];
  }
  return mergedObject;
}

function _deactivate(): Promise<void> {
  invariant(disposables != null);
  featureLoader.deactivate();
  disposables.dispose();
  disposables = null;
  return Promise.race([
    // Prevent Atom from exiting until log4js shutdown completes.
    new Promise(resolve => log4js.shutdown(resolve)),
    // But guard against log4js misbehaving.
    sleep(1000),
  ]);
}

function _serialize() {
  featureLoader.serialize();
}

function _handleURI({pathname, query}: url$urlObject, uri: string): void {
  if (pathname == null || pathname === '') {
    atom.notifications.addError(`Invalid URI ${uri}: must have a path.`);
    return;
  }
  const message = pathname.substr(1);

  // Atom waits for Nuclide to initialize before sending the URI through.
  // So, at this point it should be fairly safe to delegate to nuclide-deep-link.
  sendDeepLink(remote.getCurrentWindow(), message, query || {});
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
export const handleURI = shouldInitialize ? _handleURI : undefined;
