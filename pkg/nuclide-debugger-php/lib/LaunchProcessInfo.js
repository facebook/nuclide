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
import consumeFirstProvider from '../../commons-atom/consumeFirstProvider';

import logger from './utils';
import {getSessionConfig} from './utils';
import invariant from 'assert';
import {shellParse} from 'nuclide-commons/string';

export class LaunchProcessInfo extends DebuggerProcessInfo {
  _launchTarget: string;
  _launchWrapperCommand: ?string;
  _useTerminal: boolean;
  _scriptArguments: string;

  constructor(
    targetUri: NuclideUri,
    launchTarget: string,
    launchWrapperCommand: ?string,
    useTerminal: boolean,
    scriptArguments: ?string,
  ) {
    super('hhvm', targetUri);
    this._launchTarget = launchTarget;
    this._launchWrapperCommand = launchWrapperCommand;
    this._useTerminal = useTerminal;
    this._scriptArguments = scriptArguments != null ? scriptArguments : '';
  }

  clone(): LaunchProcessInfo {
    return new LaunchProcessInfo(
      this._targetUri,
      this._launchTarget,
      this._launchWrapperCommand,
      this._useTerminal,
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

    if (this._scriptArguments !== '') {
      sessionConfig.scriptArguments = shellParse(this._scriptArguments);
    }

    if (this._launchWrapperCommand != null) {
      sessionConfig.launchWrapperCommand = this._launchWrapperCommand;
    }

    const remoteService = await consumeFirstProvider('nuclide-debugger.remote');
    const deferLaunch = (sessionConfig.deferLaunch =
      this._useTerminal && remoteService.getTerminal() != null);

    logger.info(`Connection session config: ${JSON.stringify(sessionConfig)}`);

    const result = await rpcService.debug(sessionConfig);
    logger.info(`Launch process result: ${result}`);

    if (deferLaunch) {
      const hostname = nuclideUri.getHostname(this.getTargetUri());
      const launchUri = nuclideUri.createRemoteUri(
        hostname,
        this._launchTarget,
      );
      const runtimeArgs = shellParse(sessionConfig.phpRuntimeArgs);
      const scriptArgs = shellParse(this._launchTarget);

      invariant(remoteService != null);
      await remoteService.launchDebugTargetInTerminal(
        launchUri,
        sessionConfig.launchWrapperCommand != null
          ? sessionConfig.launchWrapperCommand
          : sessionConfig.phpRuntimePath,
        [...runtimeArgs, ...scriptArgs, ...sessionConfig.scriptArguments],
        nuclideUri.dirname(launchUri),
        new Map(),
      );
    }

    return new PhpDebuggerInstance(this, rpcService);
  }

  _getRpcService(): PhpDebuggerServiceType {
    const service = getPhpDebuggerServiceByNuclideUri(this.getTargetUri());
    return new service.PhpDebuggerService();
  }
}
