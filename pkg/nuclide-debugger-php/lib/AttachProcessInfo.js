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

import type {
  PhpDebuggerService as PhpDebuggerServiceType,
} from '../../nuclide-debugger-php-rpc/lib/PhpDebuggerService';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {
  ControlButtonSpecification,
} from '../../nuclide-debugger/lib/types';
import type {ThreadColumn} from '../../nuclide-debugger-base/lib/types';

import {DebuggerProcessInfo} from '../../nuclide-debugger-base';
import {PhpDebuggerInstance} from './PhpDebuggerInstance';
import {
  getPhpDebuggerServiceByNuclideUri,
} from '../../nuclide-remote-connection';
import nuclideUri from 'nuclide-commons/nuclideUri';

import logger from './utils';
import {getSessionConfig} from './utils';

export class AttachProcessInfo extends DebuggerProcessInfo {
  constructor(targetUri: NuclideUri) {
    super('hhvm', targetUri);
  }

  clone(): AttachProcessInfo {
    return new AttachProcessInfo(this._targetUri);
  }

  async preAttachActions(): Promise<void> {
    try {
      // TODO(t18124539) @nmote This should require FlowFB but when used flow
      // complains that it is an unused supression.
      const services = require('./fb/services');
      services.startSlog();
    } catch (_) {}
  }

  async debug(): Promise<PhpDebuggerInstance> {
    logger.info('Connecting to: ' + this.getTargetUri());
    await this.preAttachActions();

    const rpcService = this._getRpcService();
    const sessionConfig = getSessionConfig(
      nuclideUri.getPath(this.getTargetUri()),
      false,
    );
    logger.info(`Connection session config: ${JSON.stringify(sessionConfig)}`);
    const result = await rpcService.debug(sessionConfig);
    logger.info(`Launch process result: ${result}`);

    return new PhpDebuggerInstance(this, rpcService);
  }

  _getRpcService(): PhpDebuggerServiceType {
    const service = getPhpDebuggerServiceByNuclideUri(this.getTargetUri());
    return new service.PhpDebuggerService();
  }

  supportThreads(): boolean {
    return true;
  }

  getThreadsComponentTitle(): string {
    return 'Requests';
  }

  getThreadColumns(): ?Array<ThreadColumn> {
    return [
      {
        key: 'id',
        title: 'ID',
        width: 0.15,
      },
      {
        key: 'address',
        title: 'Location',
        width: 0.55,
      },
      {
        key: 'stopReason',
        title: 'Stop Reason',
        width: 0.25,
      },
    ];
  }

  supportSingleThreadStepping(): boolean {
    return true;
  }

  singleThreadSteppingEnabled(): boolean {
    return true;
  }

  supportContinueToLocation(): boolean {
    return true;
  }

  customControlButtons(): Array<ControlButtonSpecification> {
    const customControlButtons = [
      {
        icon: 'link-external',
        title: 'Toggle HTTP Request Sender',
        onClick: () =>
          atom.commands.dispatch(
            atom.views.getView(atom.workspace),
            'nuclide-http-request-sender:toggle-http-request-edit-dialog',
          ),
      },
    ];
    try {
      return customControlButtons.concat(
        // $FlowFB
        require('./fb/services').customControlButtons,
      );
    } catch (_) {
      return customControlButtons;
    }
  }
}
