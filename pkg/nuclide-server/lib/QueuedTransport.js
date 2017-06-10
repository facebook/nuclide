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

import type {Observable} from 'rxjs';

import invariant from 'assert';
import {Subject} from 'rxjs';
import {getLogger} from 'log4js';
const logger = getLogger('nuclide-server');
import {Emitter} from 'event-kit';

// An unreliable transport for sending JSON formatted messages
//
// onClose handlers are guaranteed to be called exactly once.
// onMessage handlers are guaranteed to not be called after onClose has been called.
// send(data) yields false if the message failed to send, true on success.
// onClose handlers will be called before close() returns.
// May not call send() after transport has closed..
export type UnreliableTransport = {
  send(message: string): Promise<boolean>,
  onClose(callback: () => mixed): IDisposable,
  onMessage(): Observable<string>,
  onError(callback: (error: Object) => mixed): IDisposable,
  close(): void,
  isClosed(): boolean,
};

// Adapter to make an UnreliableTransport a reliable Transport
// by queuing messages.
//
// Conforms to the RPC Framework's Transport type.
//
// Must be constructed with an open(not closed) transport.
// Can be in one of 3 states: open, disconnected, or closed.
// The transport starts in open state. When the current transport closes,
// goes to disconnected state.
// While disconnected, reconnect can be called to return to the open state.
// close() closes the underlying transport and transitions to closed state.
// Once closed, reconnect may not be called and no other events will be emitted.
export class QueuedTransport {
  id: string;
  _isClosed: boolean;
  _transport: ?UnreliableTransport;
  _messageQueue: Array<string>;
  _emitter: Emitter;
  _messages: Subject<string>;
  _lastStateChangeTime: number;

  constructor(clientId: string, transport: ?UnreliableTransport) {
    this.id = clientId;
    this._isClosed = false;
    this._transport = null;
    this._messageQueue = [];
    this._messages = new Subject();
    this._emitter = new Emitter();
    this._lastStateChangeTime = Date.now();

    if (transport != null) {
      this._connect(transport);
    }
  }

  getState(): 'open' | 'disconnected' | 'closed' {
    return this._isClosed
      ? 'closed'
      : this._transport == null ? 'disconnected' : 'open';
  }

  getLastStateChangeTime(): number {
    return this._lastStateChangeTime;
  }

  _connect(transport: UnreliableTransport): void {
    invariant(!transport.isClosed());
    logger.info('Client #%s connecting with a new socket!', this.id);
    invariant(this._transport == null);
    this._transport = transport;
    this._lastStateChangeTime = Date.now();
    transport.onMessage().subscribe(message => this._messages.next(message));
    transport.onClose(() => this._onClose(transport));
  }

  _onClose(transport: UnreliableTransport): void {
    invariant(transport.isClosed());

    if (this._isClosed) {
      // This happens when close() is called and we have an open transport.
      return;
    }
    if (transport !== this._transport) {
      // This should not happen...
      logger.error('Orphaned transport closed');
      return;
    }

    this._transport = null;
    this._lastStateChangeTime = Date.now();
    this._emitter.emit('disconnect', transport);
  }

  // Reconnecting, when in an open state will cause a disconnect event.
  reconnect(transport: UnreliableTransport): void {
    invariant(!transport.isClosed());
    invariant(!this._isClosed);

    if (this._transport != null) {
      // This will cause a disconnect event...
      this._transport.close();
    }
    invariant(this._transport == null);

    this._connect(transport);

    // Attempt to resend queued messages
    const queuedMessages = this._messageQueue;
    this._messageQueue = [];
    queuedMessages.forEach(message => this.send(message));
  }

  disconnect(): void {
    invariant(!this._isClosed);
    this._disconnect();
  }

  _disconnect(): void {
    const transport = this._transport;
    if (transport != null) {
      transport.close();
    }
  }

  onMessage(): Observable<string> {
    return this._messages;
  }

  onDisconnect(
    callback: (transport: UnreliableTransport) => mixed,
  ): IDisposable {
    return this._emitter.on('disconnect', callback);
  }

  send(message: string): void {
    this._send(message);
  }

  async _send(message: string): Promise<void> {
    invariant(
      !this._isClosed,
      `Attempt to send socket message after connection closed: ${message}`,
    );

    this._messageQueue.push(message);
    if (this._transport == null) {
      return;
    }

    const sent = await this._transport.send(message);
    if (!sent) {
      logger.warn(
        'Failed sending socket message to client:',
        this.id,
        JSON.parse(message),
      );
    } else {
      // This may remove a different (but equivalent) message from the Q,
      // but that's ok because we don't guarantee message ordering.
      const messageIndex = this._messageQueue.indexOf(message);
      if (messageIndex !== -1) {
        this._messageQueue.splice(messageIndex, 1);
      }
    }
  }

  close(): void {
    this._disconnect();
    if (!this._isClosed) {
      this._isClosed = true;
      this._lastStateChangeTime = Date.now();
    }
  }

  isClosed(): boolean {
    return this._isClosed;
  }
}
