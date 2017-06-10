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
  Scope,
  ScopeType,
  PropertyDescriptor,
  RemoteObject,
  RemoteObjectId,
} from '../../nuclide-debugger-base/lib/protocol-types';

import logger from './utils';
import {
  remoteObjectIdOfObjectId,
  createContextObjectId,
  isContextObjectId,
  isPagedObjectId,
  getWatchContextObjectId,
  isWatchContextObjectId,
} from './ObjectId';
import {convertProperties, getPagedProperties} from './properties';
import invariant from 'assert';
import {convertValue} from './values';

import type {DbgpContext, DbgpSocket} from './DbgpSocket';
import type {ObjectId} from './ObjectId';

import {ConnectionStatus} from './DbgpSocket';

const EVAL_IDENTIFIER = '$__unique_xdebug_variable_name__';

/**
 * Handles data value tracking between Chrome and Dbgp.
 *
 * Maps Dbgp properties to/from Chrome RemoteObjects.
 * RemoteObjects are only valid while the debuggee is paused.
 * Once the debuggee resumes, all RemoteObjects become invalid.
 */
export class DataCache {
  _socket: DbgpSocket;
  _enabled: boolean;
  _enableCount: number;
  _evalIdentifierId: number;

  constructor(socket: DbgpSocket) {
    this._socket = socket;
    this._enableCount = 0;
    this._enabled = false;
    this._evalIdentifierId = 0;
    socket.onStatus(this._onStatusChanged.bind(this));
  }

  _onStatusChanged(status: string): void {
    switch (status) {
      case ConnectionStatus.Break:
        this._enable();
        break;
      case ConnectionStatus.Starting:
      case ConnectionStatus.Stopping:
      case ConnectionStatus.Stopped:
      case ConnectionStatus.Running:
        this._disable();
        break;
    }
  }

  _disable(): void {
    this._enabled = false;
  }

  isEnabled(): boolean {
    return this._enabled;
  }

  _enable(): void {
    this._enableCount += 1;
    this._enabled = true;
  }

  async getScopesForFrame(frameIndex: number): Promise<Array<Scope>> {
    if (!this.isEnabled()) {
      throw new Error('Must be enabled to get scopes.');
    }
    const contexts = await this._socket.getContextsForFrame(frameIndex);
    return contexts.map(context => {
      return {
        object: this._remoteObjectOfContext(frameIndex, context),
        type: contextNameToScopeType(context.name),
      };
    });
  }

  async runtimeEvaluate(
    frameIndex: number,
    expression: string,
  ): Promise<Object> {
    // Every evaluation we perform with xdebug's eval command is saved in a unique variable
    // for later lookup.
    const newIdentifier = `${EVAL_IDENTIFIER}${++this._evalIdentifierId}`;
    const evaluatedResult = await this._socket.runtimeEvaluate(
      `${newIdentifier} = ${expression}`,
    );
    if (evaluatedResult.wasThrown) {
      return evaluatedResult;
    }
    const id = getWatchContextObjectId(this._enableCount, frameIndex);
    invariant(evaluatedResult.result != null);
    // XDebug's eval returns xml without a `fullname` attribute.  When it returns paged or otherwise
    // heirarchical data, we need a fullname to reference this data (e.g. for accessing properties),
    // so we use the `newIdentifier` constructed above, which is the name of a variable that stores
    // the value returned from eval.
    evaluatedResult.result.$.fullname = newIdentifier;
    const result = convertValue(id, evaluatedResult.result);
    return {
      result,
      wasThrown: false,
    };
  }

  async evaluateOnCallFrame(
    frameIndex: number,
    expression: string,
  ): Promise<Object> {
    if (!this.isEnabled()) {
      throw new Error('Must be enabled to evaluate expression.');
    }

    // TODO(jonaldislarry): Currently xdebug provides no way to eval at arbitrary stack depths,
    // it only supports the current stack frame.  To work around this, we special-case evaluation
    // at the current stack depth.
    if (frameIndex === 0) {
      return this.runtimeEvaluate(frameIndex, expression);
    }

    const evaluatedResult = await this._socket.evaluateOnCallFrame(
      frameIndex,
      expression,
    );
    if (evaluatedResult.wasThrown) {
      return evaluatedResult;
    }
    const id = getWatchContextObjectId(this._enableCount, frameIndex);
    invariant(evaluatedResult.result);
    const result = convertValue(id, evaluatedResult.result);
    return {
      result,
      wasThrown: false,
    };
  }

  _remoteObjectOfContext(
    frameIndex: number,
    context: DbgpContext,
  ): RemoteObject {
    return {
      description: context.name,
      type: 'object',
      objectId: remoteObjectIdOfObjectId(
        this._objectIdOfContext(frameIndex, context),
      ),
    };
  }

  _objectIdOfContext(frameIndex: number, context: DbgpContext): ObjectId {
    return createContextObjectId(this._enableCount, frameIndex, context.id);
  }

  async getProperties(
    remoteId: RemoteObjectId,
  ): Promise<Array<PropertyDescriptor>> {
    logger.debug(`DataCache.getProperties call on ID: ${remoteId}`);
    const id = JSON.parse(remoteId);
    if (id.enableCount !== this._enableCount) {
      const message = `Got request for stale RemoteObjectId ${remoteId}`;
      logger.error(message);
      throw new Error(message);
    }

    // context and single paged ids require getting children from the debuggee and converting
    // them from dbgp to chrome format.
    if (isContextObjectId(id)) {
      return this._getContextProperties(id);
    } else if (isPagedObjectId(id)) {
      // Paged id's children are constructed directly in chrome format from the contents of the
      // object id. Does not require going to the debuggee.
      return getPagedProperties(id);
    } else {
      return this._getSinglePageOfProperties(id);
    }
  }

  async _getSinglePageOfProperties(
    id: ObjectId,
  ): Promise<Array<PropertyDescriptor>> {
    let properties = null;
    const {fullname, page} = id;
    invariant(fullname != null);
    invariant(page != null);
    if (isWatchContextObjectId(id)) {
      properties = await this._socket.getPropertiesByFullnameAllConexts(
        id.frameIndex,
        fullname,
        page,
      );
    } else {
      properties = await this._socket.getPropertiesByFullname(
        id.frameIndex,
        id.contextId,
        fullname,
        page,
      );
    }
    return convertProperties(id, properties);
  }

  async _getContextProperties(
    id: ObjectId,
  ): Promise<Array<PropertyDescriptor>> {
    const properties = await this._socket.getContextProperties(
      id.frameIndex,
      id.contextId,
    );
    // Some properties in the environment are created by us for internal use, so we filter them out.
    const filteredProperties = properties.filter(property => {
      invariant(property.$.fullname != null);
      return !property.$.fullname.startsWith(EVAL_IDENTIFIER);
    });
    return convertProperties(id, filteredProperties);
  }
}

function contextNameToScopeType(name: string): ScopeType {
  switch (name) {
    case 'Locals':
      return 'local';
    case 'Superglobals':
      return 'global';
    case 'User defined constants':
      return 'global';
    // TODO: Verify this ...
    default:
      logger.debug(`Unexpected context name: ${name}`);
      return 'closure';
  }
}
