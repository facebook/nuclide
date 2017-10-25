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
import type {UnreliableTransport} from '../../nuclide-rpc';

import invariant from 'assert';
import {Subject} from 'rxjs';
import {getLogger} from 'log4js';
import Dequeue from 'dequeue';
const logger = getLogger('nuclide-server');
import {Emitter} from 'event-kit';
import {track} from '../../nuclide-analytics';

type QueueItem = {id: number, message: string};

// Adapter to make an UnreliableTransport a reliable Transport
// by queuing messages and removing from the queue only after
// receiving an ack that the recipient has received it.
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
export class QueuedAckTransport {
  id: string;
  _isClosed: boolean;
  _transport: ?UnreliableTransport;
  _messageQueue: Dequeue; // elements are of type QueueItem
  _emitter: Emitter;
  _messages: Subject<string>;
  _lastStateChangeTime: number;
  _id: number = 1;
  _lastIdHandled: number = -1;
  _retryTimerId: ?number;

  constructor(clientId: string, transport: ?UnreliableTransport) {
    this.id = clientId;
    this._isClosed = false;
    this._transport = null;
    this._messageQueue = new Dequeue();
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
    transport.onMessage().subscribe(this._handleMessage.bind(this));
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

    this._sendFirstQueueMessageIfAny();
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
    invariant(
      !this._isClosed,
      `Attempt to send socket message after connection closed: ${message}`,
    );
    const id = this._id++;
    const newItem: QueueItem = {id, message};
    this._messageQueue.push(newItem);
    this._sendFirstQueueMessageIfAny();
  }

  _sendFirstQueueMessageIfAny(): void {
    if (this._retryTimerId != null) {
      clearTimeout(this._retryTimerId);
      this._retryTimerId = null;
    }
    const transport = this._transport;
    if (this._messageQueue.length === 0 || transport == null) {
      return;
    }

    const {id, message} = (this._messageQueue.first(): QueueItem);
    const rawMessage = `>${id}:${message}`;

    transport.send(rawMessage);
    this._retryTimerId = setTimeout(
      this._sendFirstQueueMessageIfAny.bind(this),
      150,
    );
    // We've scheduled an automatic retry of sending the message.
    // We won't remove the message from the queue until we get an ack.
  }

  _dump(): void {
    const d = new Dequeue();
    while (this._messageQueue.length > 0) {
      const {id, message} = (this._messageQueue.shift(): QueueItem);
      d.push({id, message});
      logger.error(` * ${id}:${message}`);
    }
  }

  _handleMessage(rawMessage: string): void {
    const iColon = rawMessage.indexOf(':');
    invariant(iColon !== -1);
    const mode = rawMessage[0];
    invariant(mode === '>' || mode === '<');
    const id = Number(rawMessage.substring(1, iColon));
    const message = rawMessage.substring(iColon + 1);

    if (mode === '>') {
      // '>id:msg' means the other party has sent us this message
      // We only *handle* a message id the first time we receive it
      if (id > this._lastIdHandled) {
        this._messages.next(message);
      }
      if (id > this._lastIdHandled + 1 && this._lastIdHandled !== -1) {
        logger.error(
          `QueuedAckTransport message id mismatch - received ${id}, last handled ${this
            ._lastIdHandled}`,
        );
        track('transport.message-id-mismatch', {
          receivedMessageId: id,
          lastHandledMessageId: this._lastIdHandled,
          rawMessage,
        });
      }
      this._lastIdHandled = id;
      // But we always send a receipt (which needn't be reliably delivered).
      const ackMessage = `<${id}:${message}`;
      if (this._transport != null) {
        this._transport.send(ackMessage);
      }
    } else {
      // '<id:msg' means the other party has acknowledged receipt
      // It's fine to receive old acknowledgements from now-gone messages
      if (this._messageQueue.length > 0) {
        const qId: number = (this._messageQueue.first(): QueueItem).id;
        if (id > qId) {
          logger.error(
            `QueuedAckTransport ack id mismatch - received ack ${id}, last sent ${qId}`,
          );
          track('transport.ack-id-mismatch', {
            receivedAckId: id,
            lastSentMessageId: qId,
            rawMessage,
          });
        }
        if (id === qId) {
          this._messageQueue.shift();
          this._sendFirstQueueMessageIfAny();
        }
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
