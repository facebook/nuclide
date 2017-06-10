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
  PropertyDescriptor,
  RemoteObjectId,
} from '../../nuclide-debugger-base/lib/protocol-types';
import {DbgpSocket} from './DbgpSocket';
import {DataCache} from './DataCache';
import {ConnectionStatus} from './DbgpSocket';

import {CompositeDisposable} from 'event-kit';

import type {Socket} from 'net';
import type {DbgpBreakpoint, FileLineBreakpointInfo} from './DbgpSocket';

let connectionCount = 1;

type StatusCallback = (
  connection: Connection,
  status: string,
  ...args: Array<string>
) => void;

type NotificationCallback = (
  connection: Connection,
  notifyName: string,
  notify: Object,
) => void;

export const ASYNC_BREAK = 'async_break';
export const BREAKPOINT = 'breakpoint';
export const EXCEPTION = 'exception';

export class Connection {
  _socket: DbgpSocket;
  _dataCache: DataCache;
  _id: number;
  _disposables: CompositeDisposable;
  _status: string;
  _stopReason: ?string;
  _stopBreakpointLocation: ?FileLineBreakpointInfo;
  _isDummyConnection: boolean;
  _isDummyViewable: boolean;
  _breakCount: number;

  constructor(
    socket: Socket,
    onStatusCallback: StatusCallback,
    onNotificationCallback: NotificationCallback,
    isDummyConnection: boolean,
  ) {
    const dbgpSocket = new DbgpSocket(socket);
    this._socket = dbgpSocket;
    this._dataCache = new DataCache(dbgpSocket);
    this._id = connectionCount++;
    this._status = ConnectionStatus.Starting;
    this._isDummyConnection = isDummyConnection;
    this._isDummyViewable = false;
    this._disposables = new CompositeDisposable();
    this._breakCount = 0;

    if (onStatusCallback != null) {
      this._disposables.add(
        this.onStatus((status, ...args) =>
          onStatusCallback(this, status, ...args),
        ),
      );
    }
    if (onNotificationCallback != null) {
      this._disposables.add(
        this.onNotification((notifyName, notify) =>
          onNotificationCallback(this, notifyName, notify),
        ),
      );
    }
    this._stopReason = null;
    this._stopBreakpointLocation = null;
  }

  isDummyConnection(): boolean {
    return this._isDummyConnection;
  }

  getId(): number {
    return this._id;
  }

  onStatus(
    callback: (status: string, ...args: Array<string>) => mixed,
  ): IDisposable {
    return this._socket.onStatus(this._handleStatus.bind(this, callback));
  }

  _handleStatus(
    callback: (newStatus: string, ...args: Array<string>) => mixed,
    newStatus: string,
    ...args: Array<string>
  ): mixed {
    const prevStatus = this._status;
    switch (newStatus) {
      case ConnectionStatus.Running:
        this._stopReason = null;
        this._stopBreakpointLocation = null;
        break;
      case ConnectionStatus.Break:
        if (prevStatus === ConnectionStatus.BreakMessageReceived) {
          this._stopReason = ASYNC_BREAK;
          this._stopBreakpointLocation = null;
        } else if (prevStatus !== ConnectionStatus.Break) {
          // TODO(dbonafilia): investigate why we sometimes receive two BREAK_MESSAGES
          const [file, line, exception] = args;
          this._stopReason = exception == null ? BREAKPOINT : EXCEPTION;
          if (file != null && line != null) {
            this._stopBreakpointLocation = {
              filename: file,
              lineNumber: Number(line),
              conditionExpression: null,
            };
          } else {
            // Unknown stop location.
            this._stopBreakpointLocation = null;
          }
        }
        this._breakCount++;
        break;
      case ConnectionStatus.DummyIsViewable:
        this._isDummyViewable = true;
        return;
      case ConnectionStatus.DummyIsHidden:
        this._isDummyViewable = false;
        return;
    }
    if (
      newStatus === ConnectionStatus.BreakMessageReceived &&
      prevStatus !== ConnectionStatus.BreakMessageSent
    ) {
      return;
    }
    this._status = newStatus;
    if (!this._isInternalStatus(newStatus)) {
      // Don't bubble up irrelevant statuses to the multiplexer
      // TODO(dbonafilia): Add Enums to make status association clearer
      return callback(newStatus, ...args);
    }
  }

  _isInternalStatus(status: string) {
    return [
      ConnectionStatus.BreakMessageReceived,
      ConnectionStatus.BreakMessageSent,
      ConnectionStatus.DummyIsHidden,
      ConnectionStatus.DummyIsViewable,
    ].some(internalStatus => internalStatus === status);
  }

  /**
   * We only want to show the dummy connection's IP to the user when it is outside the entry-point
   * specified by the user in the Debugger config.
   */
  isViewable(): boolean {
    if (this._isDummyConnection) {
      return this._status === ConnectionStatus.Break && this._isDummyViewable;
    } else {
      return this._status === ConnectionStatus.Break;
    }
  }

  getBreakCount(): number {
    return this._breakCount;
  }

  onNotification(
    callback: (notifyName: string, notify: Object) => mixed,
  ): IDisposable {
    return this._socket.onNotification(callback);
  }

  evaluateOnCallFrame(frameIndex: number, expression: string): Promise<Object> {
    return this._dataCache.evaluateOnCallFrame(frameIndex, expression);
  }

  runtimeEvaluate(frameIndex: number, expression: string): Promise<Object> {
    return this._dataCache.runtimeEvaluate(frameIndex, expression);
  }

  setExceptionBreakpoint(exceptionName: string): Promise<string> {
    return this._socket.setExceptionBreakpoint(exceptionName);
  }

  setFileLineBreakpoint(
    breakpointInfo: FileLineBreakpointInfo,
  ): Promise<string> {
    return this._socket.setFileLineBreakpoint(breakpointInfo);
  }

  getBreakpoint(breakpointId: string): Promise<DbgpBreakpoint> {
    return this._socket.getBreakpoint(breakpointId);
  }

  removeBreakpoint(breakpointId: string): Promise<any> {
    return this._socket.removeBreakpoint(breakpointId);
  }

  getStackFrames(): Promise<Object> {
    return this._socket.getStackFrames();
  }

  getScopesForFrame(frameIndex: number): Promise<Array<Scope>> {
    return this._dataCache.getScopesForFrame(frameIndex);
  }

  getStatus(): string {
    return this._status;
  }

  sendContinuationCommand(command: string): Promise<string> {
    return this._socket.sendContinuationCommand(command);
  }

  sendStdoutRequest(): Promise<boolean> {
    return this._socket.sendStdoutRequest();
  }

  sendStderrRequest(): Promise<boolean> {
    return this._socket.sendStderrRequest();
  }

  sendBreakCommand(): Promise<boolean> {
    this._status = ConnectionStatus.BreakMessageSent;
    return this._socket.sendBreakCommand();
  }

  setFeature(name: string, value: string): Promise<boolean> {
    return this._socket.setFeature(name, value);
  }

  getProperties(remoteId: RemoteObjectId): Promise<Array<PropertyDescriptor>> {
    return this._dataCache.getProperties(remoteId);
  }

  getStopReason(): ?string {
    return this._stopReason;
  }

  // Returns the location this connection is stopped at if it is stopped at a file+line breakpoint.
  // Otherwise, returns null.
  getStopBreakpointLocation(): ?FileLineBreakpointInfo {
    return this._stopBreakpointLocation;
  }

  dispose(): void {
    this._disposables.dispose();
    this._socket.dispose();
  }
}
