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

import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {PhpDebuggerService as PhpDebuggerServiceType} from '../../nuclide-debugger-php-rpc/lib/PhpDebuggerService';
import type {
  DebuggerCapabilities,
  DebuggerProperties,
} from '../../nuclide-debugger-base';

import {DebuggerProcessInfo} from '../../nuclide-debugger-base';
import {PhpDebuggerInstance} from './PhpDebuggerInstance';
import {getPhpDebuggerServiceByNuclideUri} from '../../nuclide-remote-connection';
import nuclideUri from 'nuclide-commons/nuclideUri';

import logger from './utils';
import {getSessionConfig} from './utils';

export class LaunchProcessInfo extends DebuggerProcessInfo {
  _launchTarget: string;
  _launchWrapperCommand: ?string;

  constructor(
    targetUri: NuclideUri,
    launchTarget: string,
    launchWrapperCommand: ?string,
  ) {
    super('hhvm', targetUri);
    this._launchTarget = launchTarget;
    this._launchWrapperCommand = launchWrapperCommand;
  }

  clone(): LaunchProcessInfo {
    return new LaunchProcessInfo(
      this._targetUri,
      this._launchTarget,
      this._launchWrapperCommand,
    );
  }

  getDebuggerCapabilities(): DebuggerCapabilities {
    return {
      ...super.getDebuggerCapabilities(),
      conditionalBreakpoints: true,
      continueToLocation: true,
      threads: true,
    };
  }

  getDebuggerProps(): DebuggerProperties {
    return super.getDebuggerProps();
  }

  async debug(): Promise<PhpDebuggerInstance> {
    const rpcService = this._getRpcService();
    const sessionConfig = getSessionConfig(
      nuclideUri.getPath(this.getTargetUri()),
      true,
    );

    // Set config related to script launching.
    sessionConfig.endDebugWhenNoRequests = true;
    sessionConfig.launchScriptPath = this._launchTarget;

    if (this._launchWrapperCommand != null) {
      sessionConfig.launchWrapperCommand = this._launchWrapperCommand;
    }

    logger.info(`Connection session config: ${JSON.stringify(sessionConfig)}`);

    const result = await rpcService.debug(sessionConfig);
    logger.info(`Launch process result: ${result}`);
    return new PhpDebuggerInstance(this, rpcService);
  }

  _getRpcService(): PhpDebuggerServiceType {
    const service = getPhpDebuggerServiceByNuclideUri(this.getTargetUri());
    return new service.PhpDebuggerService();
  }
}
