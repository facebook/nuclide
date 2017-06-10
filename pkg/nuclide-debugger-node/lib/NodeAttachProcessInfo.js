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

import {
  DebuggerInstance,
  DebuggerInstanceBase,
  DebuggerProcessInfo,
} from '../../nuclide-debugger-base';
import type {
  NodeAttachTargetInfo,
  NodeDebuggerService,
} from '../../nuclide-debugger-node-rpc/lib/NodeDebuggerService';
import {
  getNodeDebuggerServiceByNuclideUri,
} from '../../nuclide-remote-connection';

export class NodeAttachProcessInfo extends DebuggerProcessInfo {
  _targetInfo: NodeAttachTargetInfo;

  constructor(targetUri: NuclideUri, targetInfo: NodeAttachTargetInfo) {
    super('node', targetUri);
    this._targetInfo = targetInfo;
  }

  clone(): NodeAttachProcessInfo {
    return new NodeAttachProcessInfo(this._targetUri, this._targetInfo);
  }

  async debug(): Promise<DebuggerInstanceBase> {
    const rpcService = this._getRpcService();
    await rpcService.attach(this._targetInfo);
    return new DebuggerInstance(this, rpcService);
  }

  _getRpcService(): NodeDebuggerService {
    const service = getNodeDebuggerServiceByNuclideUri(this.getTargetUri());
    return new service.NodeDebuggerService();
  }

  supportContinueToLocation(): boolean {
    return true;
  }
}
