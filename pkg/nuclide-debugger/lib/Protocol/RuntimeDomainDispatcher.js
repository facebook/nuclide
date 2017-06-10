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
  RemoteObjectId,
  ExecutionContextCreatedEvent,
} from '../../../nuclide-debugger-base/lib/protocol-types';
import type {ObjectGroup} from '../types';

/**
 * Responsible for sending and receiving runtime domain protocols from
 * debug engine.
 */
class RuntimeDomainDispatcher {
  _agent: Object; // runtime agent from chrome protocol.

  constructor(agent: Object) {
    this._agent = agent;
  }

  enable(): void {
    this._agent.enable();
  }

  evaluate(
    expression: string,
    objectGroup: ObjectGroup,
    callback: Function,
  ): void {
    this._agent.evaluate(
      expression,
      objectGroup,
      undefined, // includeCommandLineAPI
      undefined, // doNotPauseOnExceptionsAndMuteConsole
      undefined, // contextId
      undefined, // returnByValue
      undefined, // generatePreview
      callback,
    );
  }

  getProperties(objectId: RemoteObjectId, callback: Function): void {
    this._agent.getProperties(
      objectId,
      false, // ownProperties
      false, // accessorPropertiesOnly
      false, // generatePreview
      callback,
    );
  }

  executionContextCreated(params: ExecutionContextCreatedEvent): void {
    // Engine may fire ExecutionContextCreatedEvent event because of RuntimeDomain.enable() call.
    // But we do not need it. Do nothing.
  }
}

// Use old school export to allow legacy code to import it.
module.exports = RuntimeDomainDispatcher;
