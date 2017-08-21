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

import type {DbgpBreakpoint, FileLineBreakpointInfo} from './DbgpSocket';
import type {Connection} from './Connection';

import invariant from 'assert';
import logger from './utils';
import {ConnectionStatus} from './DbgpSocket';
import {Observable} from 'rxjs';
import {observableFromSubscribeFunction} from 'nuclide-commons/event';

type XDebugBreakpointId = string;

export type BreakpointId = string;
export type Breakpoint = {
  connectionId?: number,
  chromeId: BreakpointId,
  breakpointInfo: FileLineBreakpointInfo,
  resolved: boolean,
  hitCount: number,
};

export type ExceptionState = 'none' | 'uncaught' | 'all';

const PAUSE_ALL_EXCEPTION_NAME = '*';
const EXCEPTION_PAUSE_STATE_ALL = 'all';

function isConnectionClosed(status: string): boolean {
  switch (status) {
    case ConnectionStatus.Stopping:
    case ConnectionStatus.Stopped:
    case ConnectionStatus.Error:
    case ConnectionStatus.End:
      return true;
    default:
      return false;
  }
}

function doWhileConnectionOpen<T>(
  connection: Connection,
  ayncFn: () => Promise<T>,
): Promise<?T> {
  return (
    Observable.fromPromise(ayncFn())
      // Avoid waiting indefintely if the connection went away while applying an operaton.
      .takeUntil(
        observableFromSubscribeFunction(
          connection.onStatus.bind(connection),
        ).filter(isConnectionClosed),
      )
      .catch((error, stream) => {
        const isClosed = isConnectionClosed(connection.getStatus());
        logger.error('connection operation error:', error, isClosed);
        if (isClosed) {
          return Observable.of(null);
        } else {
          return stream;
        }
      })
      .toPromise()
  );
}

// Stores breakpoints and connections.
//
// Added breakpoints are given a unique id and are added to all available connections.
//
// Breakpoints may be added before any connections.
//
// Care is taken to ensure that operations are atomic in the face of async turns.
// Specifically, removing a breakpoint removes it from all connection's maps
// before returning.
export class BreakpointStore {
  _breakpointCount: number;
  // For each connection a map from the chrome's breakpoint id to
  // the Connection's xdebug breakpoint id.
  _connections: Map<Connection, Map<BreakpointId, XDebugBreakpointId>>;
  // Client visible breakpoint map from
  // chrome breakpoint id to Breakpoint object.
  _breakpoints: Map<BreakpointId, Breakpoint>;
  _pauseAllExceptionBreakpointId: ?BreakpointId;

  constructor() {
    this._breakpointCount = 0;
    this._connections = new Map();
    this._breakpoints = new Map();
    this._pauseAllExceptionBreakpointId = null;
  }

  async setFileLineBreakpoint(
    chromeId: BreakpointId,
    filename: string,
    lineNumber: number,
    conditionExpression: ?string,
  ): Promise<BreakpointId> {
    const breakpointInfo = {filename, lineNumber, conditionExpression};
    this._breakpoints.set(chromeId, {
      chromeId,
      breakpointInfo,
      resolved: false,
      hitCount: 0,
    });
    let updatedBreakpointInfo = false;
    const connectionEntries = Array.from(this._connections.entries());
    const breakpointPromises = connectionEntries.map(([connection, map]) => {
      return doWhileConnectionOpen(connection, async () => {
        const xdebugBreakpointId = await connection.setFileLineBreakpoint(
          breakpointInfo,
        );
        map.set(chromeId, xdebugBreakpointId);
        if (
          updatedBreakpointInfo ||
          isConnectionClosed(connection.getStatus())
        ) {
          return;
        }
        const xdebugBreakpoint = await connection.getBreakpoint(
          xdebugBreakpointId,
        );
        if (!updatedBreakpointInfo) {
          this.updateBreakpoint(chromeId, xdebugBreakpoint);
          updatedBreakpointInfo = true;
        }
      });
    });
    await Promise.all(breakpointPromises);

    return chromeId;
  }

  async setFileLineBreakpointForConnection(
    connection: Connection,
    chromeId: BreakpointId,
    filename: string,
    lineNumber: number,
    conditionExpression: ?string,
  ): Promise<BreakpointId> {
    const breakpointInfo = {filename, lineNumber, conditionExpression};
    this._breakpoints.set(chromeId, {
      connectionId: connection.getId(),
      chromeId,
      breakpointInfo,
      resolved: false,
      hitCount: 0,
    });
    const breakpoints = this._connections.get(connection);
    invariant(breakpoints != null);
    await doWhileConnectionOpen(connection, async () => {
      const xdebugBreakpointId = await connection.setFileLineBreakpoint(
        breakpointInfo,
      );
      breakpoints.set(chromeId, xdebugBreakpointId);
      if (isConnectionClosed(connection.getStatus())) {
        return;
      }
      const xdebugBreakpoint = await connection.getBreakpoint(
        xdebugBreakpointId,
      );
      this.updateBreakpoint(chromeId, xdebugBreakpoint);
    });
    return chromeId;
  }

  getBreakpoint(breakpointId: BreakpointId): ?Breakpoint {
    return this._breakpoints.get(breakpointId);
  }

  getBreakpointIdFromConnection(
    connection: Connection,
    xdebugBreakpoint: DbgpBreakpoint,
  ): ?BreakpointId {
    const map = this._connections.get(connection);
    if (map == null) {
      return null;
    }

    for (const [key, value] of map) {
      if (value === xdebugBreakpoint.id) {
        return key;
      }
    }
    return null;
  }

  updateBreakpoint(
    chromeId: BreakpointId,
    xdebugBreakpoint: DbgpBreakpoint,
  ): void {
    const breakpoint = this._breakpoints.get(chromeId);
    invariant(breakpoint != null);
    const {breakpointInfo} = breakpoint;
    breakpointInfo.lineNumber = Number(
      // flowlint-next-line sketchy-null-number:off
      xdebugBreakpoint.lineno || breakpointInfo.lineNumber,
    );
    breakpointInfo.filename =
      // flowlint-next-line sketchy-null-string:off
      xdebugBreakpoint.filename || breakpointInfo.filename;
    if (xdebugBreakpoint.resolved != null) {
      breakpoint.resolved = xdebugBreakpoint.resolved === 'resolved';
    } else {
      breakpoint.resolved = true;
    }
  }

  removeBreakpoint(breakpointId: BreakpointId): Promise<void> {
    this._breakpoints.delete(breakpointId);
    return this._removeBreakpointFromConnections(breakpointId);
  }

  /**
   * TODO[jeffreytan]: look into unhandled exception support.
   * Dbgp protocol does not seem to support uncaught exception handling
   * so we only support 'all' and treat all other states as 'none'.
   */
  async setPauseOnExceptions(
    chromeId: BreakpointId,
    state: ExceptionState,
  ): Promise<void> {
    if (state !== EXCEPTION_PAUSE_STATE_ALL) {
      // Try to remove any existing exception breakpoint.
      return this._removePauseAllExceptionBreakpointIfNeeded();
    }
    this._pauseAllExceptionBreakpointId = chromeId;

    const breakpointPromises = Array.from(
      this._connections.entries(),
    ).map(([connection, map]) => {
      return doWhileConnectionOpen(connection, async () => {
        const xdebugBreakpointId = await connection.setExceptionBreakpoint(
          PAUSE_ALL_EXCEPTION_NAME,
        );
        map.set(chromeId, xdebugBreakpointId);
      });
    });
    await Promise.all(breakpointPromises);
  }

  getPauseOnExceptions(): boolean {
    return this._pauseAllExceptionBreakpointId != null;
  }

  async _removePauseAllExceptionBreakpointIfNeeded(): Promise<void> {
    const breakpointId = this._pauseAllExceptionBreakpointId;
    // flowlint-next-line sketchy-null-string:off
    if (breakpointId) {
      this._pauseAllExceptionBreakpointId = null;
      return this._removeBreakpointFromConnections(breakpointId);
    } else {
      // This can happen if users switch between 'none' and 'uncaught' states.
      logger.debug('No exception breakpoint to remove.');
      return Promise.resolve();
    }
  }

  async _removeBreakpointFromConnections(
    breakpointId: BreakpointId,
  ): Promise<void> {
    await Promise.all(
      Array.from(this._connections.entries()).map(([connection, map]) => {
        return doWhileConnectionOpen(connection, async () => {
          const xdebugBreakpointId = map.get(breakpointId);
          if (xdebugBreakpointId == null) {
            return;
          }
          map.delete(breakpointId);
          await connection.removeBreakpoint(xdebugBreakpointId);
        });
      }),
    );
  }

  findBreakpoint(filename: string, lineNumber: number): ?Breakpoint {
    // Check all known breakpoints to see if one matches the current file + line.
    for (const key of this._breakpoints.keys()) {
      const bp = this._breakpoints.get(key);
      if (bp == null) {
        continue;
      }

      const locationInfo = bp.breakpointInfo;
      if (
        locationInfo.filename === filename &&
        locationInfo.lineNumber === lineNumber
      ) {
        // Found a matching bp.
        return bp;
      }
    }

    // Not found.
    return null;
  }

  breakpointExists(filename: string, lineNumber: number) {
    if (filename == null || isNaN(lineNumber) || lineNumber < 0) {
      // Invalid bp info. Assume the breakpoint exists otherwise we might erroneously resume
      // the target. This is expected if the target hits a stop condition that doesn't provide
      // file location info. At the very least, this happens for exceptions, async-breaks, and
      // breaks in evaluated code, but there may be additional cases where HHVM doesn't provide
      // this data in the xdebug status message.
      return true;
    }

    return this.findBreakpoint(filename, lineNumber) != null;
  }

  async addConnection(connection: Connection): Promise<void> {
    const map: Map<BreakpointId, XDebugBreakpointId> = new Map();
    const breakpointPromises = Array.from(
      this._breakpoints.values(),
    ).map(async breakpoint => {
      const {chromeId, breakpointInfo, connectionId} = breakpoint;
      if (connectionId != null) {
        // That breakpoint is set for a sepecific connection (doesn't apply to all connections).
        return;
      }
      const xdebugBreakpointId = await connection.setFileLineBreakpoint(
        breakpointInfo,
      );
      map.set(chromeId, xdebugBreakpointId);
    });
    this._connections.set(connection, map);
    await Promise.all(breakpointPromises);
    // flowlint-next-line sketchy-null-string:off
    if (this._pauseAllExceptionBreakpointId) {
      const breakpoitnId = await connection.setExceptionBreakpoint(
        PAUSE_ALL_EXCEPTION_NAME,
      );
      invariant(this._pauseAllExceptionBreakpointId != null);
      map.set(this._pauseAllExceptionBreakpointId, breakpoitnId);
    }
    connection.onStatus(status => {
      if (isConnectionClosed(status)) {
        this._removeConnection(connection);
      }
    });
  }

  _removeConnection(connection: Connection): void {
    if (this._connections.has(connection)) {
      this._connections.delete(connection);
    }
  }
}
