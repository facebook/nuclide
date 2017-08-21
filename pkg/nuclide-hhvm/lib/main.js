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

import type {CwdApi} from '../../nuclide-current-working-directory/lib/CwdApi';
import type {
  DeepLinkParams,
  DeepLinkService,
} from '../../nuclide-deep-link/lib/types';
import type {RemoteProjectsService} from '../../nuclide-remote-projects';
import type {TaskRunnerServiceApi} from '../../nuclide-task-runner/lib/types';

import {CompositeDisposable} from 'atom';
import createPackage from 'nuclide-commons-atom/createPackage';
import nuclideUri from 'nuclide-commons/nuclideUri';
import consumeFirstProvider from '../../commons-atom/consumeFirstProvider';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {goToLocation} from 'nuclide-commons-atom/go-to-location';
import {track} from '../../nuclide-analytics';
import invariant from 'invariant';

// eslint-disable-next-line nuclide-internal/no-cross-atom-imports
import {AttachProcessInfo} from '../../nuclide-debugger-php/lib/AttachProcessInfo';

import HhvmBuildSystem from './HhvmBuildSystem';

class Activation {
  _buildSystem: ?HhvmBuildSystem;
  _disposables: CompositeDisposable;
  _cwdApi: ?CwdApi;
  _remoteProjectsService: ?RemoteProjectsService;

  constructor(state: ?Object) {
    this._disposables = new CompositeDisposable();
  }

  dispose() {
    this._disposables.dispose();
  }

  consumeTaskRunnerServiceApi(api: TaskRunnerServiceApi): void {
    this._disposables.add(api.register(this._getBuildSystem()));
  }

  consumeCwdApi(api: CwdApi): IDisposable {
    this._cwdApi = api;
    return new UniversalDisposable(() => {
      this._cwdApi = null;
    });
  }

  consumeRemoteProjectsService(service: RemoteProjectsService): IDisposable {
    this._remoteProjectsService = service;
    return new UniversalDisposable(() => {
      this._remoteProjectsService = null;
    });
  }

  consumeDeepLinkService(deepLink: DeepLinkService): void {
    this._disposables.add(
      deepLink.subscribeToPath('attach-hhvm', params => {
        this._debugDeepWithHhvm(params);
      }),
    );
  }

  _getBuildSystem(): HhvmBuildSystem {
    if (this._buildSystem == null) {
      const buildSystem = new HhvmBuildSystem();
      this._disposables.add(buildSystem);
      this._buildSystem = buildSystem;
    }
    return this._buildSystem;
  }

  async _debugDeepWithHhvm(params: DeepLinkParams): Promise<void> {
    const {nuclidePath, hackRoot, line, addBreakpoint, source} = params;

    if (
      typeof nuclidePath !== 'string' ||
      !nuclideUri.isRemote(nuclidePath) ||
      typeof hackRoot !== 'string'
    ) {
      atom.notifications.addError('Invalid arguments.');
      return;
    }

    const pathString = decodeURIComponent(String(nuclidePath));
    const hackRootString = decodeURIComponent(String(hackRoot));

    track('nuclide-attach-hhvm-deeplink', {
      pathString,
      line,
      addBreakpoint,
      source,
    });

    if (this._remoteProjectsService == null) {
      atom.notifications.addError('The remote project service is unavailable.');
      return;
    } else {
      const remoteProjectsService = this._remoteProjectsService;
      await new Promise(resolve =>
        remoteProjectsService.waitForRemoteProjectReload(resolve),
      );
    }

    const host = nuclideUri.getHostname(pathString);
    const cwd = nuclideUri.createRemoteUri(host, hackRootString);
    const notification = atom.notifications.addInfo(
      `Connecting to ${host} and attaching debugger...`,
      {
        dismissable: true,
      },
    );

    invariant(this._remoteProjectsService != null);
    const remoteConnection = await this._remoteProjectsService.createRemoteConnection(
      {
        host,
        cwd: nuclideUri.getPath(cwd),
        displayTitle: host,
      },
    );

    if (remoteConnection == null) {
      atom.notifications.addError(`Could not connect to ${host}`);
      return;
    }

    // The hostname might have changed slightly from what was passed in due to
    // DNS lookup, so create a new remote URI rather than using cwd from above.
    const hackRootUri = remoteConnection.getUriOfRemotePath(hackRootString);
    const navUri = remoteConnection.getUriOfRemotePath(
      nuclideUri.getPath(pathString),
    );

    // Set the current project root.
    if (this._cwdApi != null) {
      this._cwdApi.setCwd(hackRootUri);
    }

    // Open the script path in the editor.
    const lineNumber = parseInt(line, 10);
    if (Number.isNaN(lineNumber)) {
      goToLocation(navUri);
    } else {
      // NOTE: line numbers start at 0, so subtract 1.
      goToLocation(navUri, lineNumber - 1);
    }

    // Debug the remote HHVM server!
    const debuggerService = await consumeFirstProvider(
      'nuclide-debugger.remote',
    );

    if (addBreakpoint === 'true' && !Number.isNaN(lineNumber)) {
      // Insert a breakpoint if requested.
      // NOTE: Nuclide protocol breakpoint line numbers start at 0, so subtract 1.
      debuggerService.addBreakpoint(navUri, lineNumber - 1);
    }

    await debuggerService.startDebugging(new AttachProcessInfo(hackRootUri));
    notification.dismiss();
  }
}

createPackage(module.exports, Activation);
