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
import type {DeepLinkService} from '../../nuclide-deep-link/lib/types';
import type {RemoteProjectsService} from '../../nuclide-remote-projects';
import type {TaskRunnerServiceApi} from '../../nuclide-task-runner/lib/types';

import {CompositeDisposable, Disposable} from 'atom';
import createPackage from 'nuclide-commons-atom/createPackage';
import ArcBuildSystem from './ArcBuildSystem';
import {openArcDeepLink} from './openArcDeepLink';

class Activation {
  _disposables: CompositeDisposable;
  _buildSystem: ?ArcBuildSystem;
  _cwdApi: ?CwdApi;
  _remoteProjectsService: ?RemoteProjectsService;

  constructor(state: ?Object) {
    this._disposables = new CompositeDisposable();
  }

  dispose(): void {
    this._disposables.dispose();
  }

  consumeCwdApi(api: CwdApi): IDisposable {
    this._cwdApi = api;
    return new Disposable(() => {
      this._cwdApi = null;
    });
  }

  consumeTaskRunnerServiceApi(api: TaskRunnerServiceApi): void {
    this._disposables.add(api.register(this._getBuildSystem()));
  }

  /**
   * Files can be opened relative to Arcanist directories via
   *   atom://nuclide/open-arc?project=<project_id>&path=<relative_path>
   * `line` and `column` can also be optionally provided as 1-based integers.
   */
  consumeDeepLinkService(deepLink: DeepLinkService): void {
    this._disposables.add(
      deepLink.subscribeToPath('open-arc', params => {
        const maybeCwd = this._cwdApi ? this._cwdApi.getCwd() : null;
        const maybeCwdPath = maybeCwd ? maybeCwd.getPath() : null;
        openArcDeepLink(
          params,
          this._remoteProjectsService,
          deepLink,
          maybeCwdPath,
        );
      }),
    );
  }

  consumeRemoteProjectsService(service: RemoteProjectsService): IDisposable {
    this._remoteProjectsService = service;
    return new Disposable(() => {
      this._remoteProjectsService = null;
    });
  }

  _getBuildSystem(): ArcBuildSystem {
    if (this._buildSystem == null) {
      const buildSystem = new ArcBuildSystem();
      this._buildSystem = buildSystem;
    }
    return this._buildSystem;
  }
}

createPackage(module.exports, Activation);
