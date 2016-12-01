'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import type {
  PhpDebuggerService as PhpDebuggerServiceType,
} from '../../nuclide-debugger-php-rpc/lib/PhpDebuggerService';
import type {NuclideUri} from '../../commons-node/nuclideUri';
import type {ControlButtonSpecification} from '../../nuclide-debugger/lib/types';

import invariant from 'assert';
import {DebuggerProcessInfo} from '../../nuclide-debugger-base';
import {PhpDebuggerInstance} from './PhpDebuggerInstance';
import {getServiceByNuclideUri} from '../../nuclide-remote-connection';
import nuclideUri from '../../commons-node/nuclideUri';

import utils from './utils';
const {logInfo} = utils;
import {getSessionConfig} from './utils';

export class AttachProcessInfo extends DebuggerProcessInfo {
  constructor(targetUri: NuclideUri) {
    super('hhvm', targetUri);
  }

  async preAttachActions(): Promise<void> {
    try {
      // $FlowFB
      const services = require('./fb/services');
      await services.warnIfNotBuilt(this.getTargetUri());
      services.startSlog();
    } catch (_) {}
  }

  async debug(): Promise<PhpDebuggerInstance> {
    logInfo('Connecting to: ' + this.getTargetUri());
    await this.preAttachActions();

    const rpcService = this._getRpcService();
    const sessionConfig = getSessionConfig(nuclideUri.getPath(this.getTargetUri()), false);
    logInfo(`Connection session config: ${JSON.stringify(sessionConfig)}`);
    const result = await rpcService.debug(sessionConfig);
    logInfo(`Launch process result: ${result}`);

    return new PhpDebuggerInstance(this, rpcService);
  }

  _getRpcService(): PhpDebuggerServiceType {
    const service =
      getServiceByNuclideUri('PhpDebuggerService', this.getTargetUri());
    invariant(service);
    return new service.PhpDebuggerService();
  }

  supportThreads(): boolean {
    return true;
  }

  supportSingleThreadStepping(): boolean {
    return true;
  }

  singleThreadSteppingEnabled(): boolean {
    return true;
  }

  customControlButtons(): Array<ControlButtonSpecification> {
    const customControlButtons = [{
      icon: 'link-external',
      title: 'Toggle HTTP Request Sender',
      onClick: () => atom.commands.dispatch(
        atom.views.getView(atom.workspace),
        'nuclide-http-request-sender:toggle-http-request-edit-dialog',
      ),
    }];
    try {
      return customControlButtons.concat(require('./fb/services').customControlButtons);
    } catch (_) {
      return customControlButtons;
    }
  }
}
