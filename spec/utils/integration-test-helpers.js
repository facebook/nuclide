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

import typeof * as FlowService from '../../pkg/nuclide-flow-rpc';

import invariant from 'assert';

import nuclideUri from 'nuclide-commons/nuclideUri';
import {runCommand} from 'nuclide-commons/process';
import featureConfig from 'nuclide-commons-atom/feature-config';
import {jasmineAttachWorkspace} from 'nuclide-commons-atom/test-helpers';
import {
  RemoteConnection,
  getServiceByNuclideUri,
} from '../../pkg/nuclide-remote-connection';
import {getMountedReactRootNames} from '../../pkg/commons-atom/testHelpers';
import {reset} from '../../pkg/nuclide-open-files';

// TEST_NUCLIDE_SERVER_PORT can be set by the test runner to allow simultaneous remote tests.
const SERVER_PORT = parseInt(process.env.TEST_NUCLIDE_SERVER_PORT, 10) || 9091;

export function jasmineIntegrationTestSetup(): void {
  // To run remote tests, we have to star the nuclide server. It uses `nohup`, but apparently
  // `nohup` doesn't work from within tmux, so starting the server fails.
  invariant(
    process.env.TMUX == null,
    'ERROR: tmux interferes with remote integration tests -- please run the tests outside of tmux',
  );

  // This prevents zombie buck/java processes from hanging the tests
  process.env.NO_BUCKD = '1';

  jasmineAttachWorkspace();

  // Unmock timer functions.
  jasmine.useRealClock();

  // Atom will add the fixtures directory to the project during tests.
  // We'd like to have Atom start with a clean slate.
  // https://github.com/atom/atom/blob/v1.7.3/spec/spec-helper.coffee#L66
  atom.project.setPaths([]);

  // Make sure configs are consistent (before and after FeatureLoader starts).
  featureConfig.setPackageName('nuclide');
}

/**
 * Activates all nuclide and fb atom packages that do not defer their own
 * activation until a certain command or hook is executed.
 *
 * @returns A promise that resolves to an array of strings, which are the names
 * of all the packages that this function activates.
 */
export async function activateAllPackages(): Promise<Array<string>> {
  // These are packages we want to activate, including some which come bundled
  // with atom, or ones widely used in conjunction with nuclide.
  const whitelist = [
    'autocomplete-plus',
    'hyperclick',
    'status-bar',
    'tool-bar',
  ];

  // Manually call `triggerDeferredActivationHooks` since Atom doesn't call it via
  // `atom.packages.activate()` during tests. Calling this before we activate
  // Nuclide packages sets `deferredActivationHooks` to `null`, so that deferred
  // activation hooks are triggered as needed instead of batched.
  // https://github.com/atom/atom/blob/v1.8.0/src/package-manager.coffee#L467-L472
  atom.packages.triggerDeferredActivationHooks();

  const packageNames = atom.packages.getAvailablePackageNames().filter(name => {
    const pack = atom.packages.loadPackage(name);
    if (pack == null) {
      return false;
    }
    const isActivationDeferred =
      pack.hasActivationCommands() || pack.hasActivationHooks();
    const isLanguagePackage = name.startsWith('language-');
    const inWhitelist = whitelist.indexOf(name) >= 0;
    return (isLanguagePackage || inWhitelist) && !isActivationDeferred;
  });

  // Include the path to the nuclide package.
  packageNames.push(nuclideUri.dirname(require.resolve('../../package.json')));
  // Include the path to the tool-bar package
  packageNames.push(
    nuclideUri.join(String(process.env.ATOM_HOME), 'packages/tool-bar'),
  );

  await Promise.all(
    packageNames.map(pack => atom.packages.activatePackage(pack)),
  );
  atom.packages.emitter.emit('did-activate-initial-packages');
  return atom.packages.getActivePackages().map(pack => pack.name);
}

/**
 * IMPORTANT: You must wait for the returned promise to resolve before continuing! Otherwise, other
 * code may attempt to activate or deactivate packages mid-deactivation. In fact, this is extremely
 * likely because Atom itself [will call `atom.reset()`][1] which, in turn, [will call
 * `atom.packages.reset()`][2], which calls `atom.packages.deactivatePackages()`. Because of the
 * async nature of Nuclide's deactivation, this will result in Nuclide's `deactivate()` being called
 * twice, which is invalid. This fact also makes many of our calls redundant; we may wish to remove
 * them in the future or may not because it makes the cleanup of `activateAllPackages()` explicit.
 *
 * [1]: https://github.com/atom/atom/blob/495376639113a3211bc80e00328870e119a8f872/spec/spec-helper.coffee#L129-L130
 * [2]: https://github.com/atom/atom/blob/495376639113a3211bc80e00328870e119a8f872/src/atom-environment.js#L358
 */
export async function deactivateAllPackages(): Promise<void> {
  await atom.packages.deactivatePackages();
  atom.packages.unloadPackages();

  // The nuclide-open-files package is an npm package which subscribes to events on the global
  // atom objects. When a new test is started, those objects are discarded and new atom environment,
  // atom project and atom workspaces are created.
  // Reset the nuclide-open-files package so that those subscriptions are renewed for the next test.
  reset();

  const mountedReactRootNames = getMountedReactRootNames();
  mountedReactRootNames.forEach(rootDisplayName => {
    // eslint-disable-next-line no-console
    console.error(
      'Found a mounted React component. ' +
        `Did you forget to call React.unmountComponentAtNode on "${rootDisplayName}"?`,
    );
  });

  expect(mountedReactRootNames.length).toBe(0);
}

/**
 * Starts a local version of the nuclide server in insecure mode on the
 * specified port. The server is started in a separate process than the caller's.
 */
export async function startNuclideServer(): Promise<void> {
  await runCommand(
    require.resolve('../../pkg/nuclide-server/nuclide-start-server'),
    ['-k', `--port=${SERVER_PORT}`],
  )
    .toPromise()
    .catch(err => {
      // eslint-disable-next-line no-console
      console.error('Error starting test server:', String(err));
      process.exit(1);
    });
}

/**
 * Kills the nuclide server associated with `connection`, and closes the
 * connection.
 */
export async function stopNuclideServer(
  connection: RemoteConnection,
): Promise<void> {
  const path = connection.getUri();
  // Clean up the underlying Hg repository (if it exists) by removing the project.
  // Otherwise, we'll have dangling subscriptions that error when the server exits.
  atom.project.removePath(path);
  const service: ?FlowService = getServiceByNuclideUri('FlowService', path);
  invariant(service);
  service.dispose();
  // If this ever fires, either ensure that your test closes all RemoteConnections
  // or we can add a force shutdown method to ServerConnection.
  invariant(connection.getConnection().hasSingleMountPoint());
  const attemptShutdown = true;
  await connection.close(attemptShutdown);
}

/**
 * Add a remote project to nuclide.  This function bypasses the SSH
 * authentication that the server normally uses. `projectPath` is a path to a
 * local directory. This function assumes that the nuclide server has been
 * started in insecure mode, e.g. with using the
 * integration-test-helpers.startNuclideServer function.
 */
export async function addRemoteProject(
  projectPath: string,
): Promise<?RemoteConnection> {
  return RemoteConnection._createInsecureConnectionForTesting(
    projectPath,
    SERVER_PORT,
  );
}
