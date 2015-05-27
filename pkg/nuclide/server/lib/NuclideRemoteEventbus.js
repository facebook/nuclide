'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

var {Disposable} = require('event-kit');
var {getRemoteEventName} = require('./service-manager');
var {serializeArgs} = require('./utils');
var {EventEmitter} = require('events');
var NuclideSocket = require('./NuclideSocket');
var extend = require('util')._extend;
var {SERVICE_FRAMEWORK_EVENT_CHANNEL} = require('./config');
var logger = require('nuclide-logging').getLogger();

type NuclideRemoteEventbusOptions = {
  certificateAuthorityCertificate: ?Buffer;
  clientCertificate: ?Buffer;
  clientKey: ?Buffer;
};

class NuclideRemoteEventbus {
  constructor(serverUri: string, options: ?NuclideRemoteEventbusOptions = {}) {
    this.socket = new NuclideSocket(serverUri, options);
    this.socket.on('message', (message) => this._handleSocketMessage(message));
    this.eventbus = new EventEmitter();
    this.serviceFrameworkEventEmitter = new EventEmitter();
    this._eventEmitters = {};
  }

  _handleSocketMessage(message: mixed) {
    var {channel, event} = message;

    if (channel === SERVICE_FRAMEWORK_EVENT_CHANNEL) {
      this.serviceFrameworkEventEmitter.emit.apply(this.serviceFrameworkEventEmitter,
          [event.name].concat(event.args));
      return;
    }

    if (event && event.eventEmitterId) {
      var {eventEmitterId, type, args} = event;
      var eventEmitter = this._eventEmitters[eventEmitterId];
      if (!eventEmitter) {
        return logger.error('eventEmitter not found: %d', eventEmitterId, type, args);
      }
      eventEmitter.emit.apply(eventEmitter, [type].concat(args));
    }
    this.eventbus.emit(channel, event);
  }

  _subscribeEventOnServer(serviceName: string, methodName: string, serviceOptions: mixed): Promise {
    return this.callServiceFrameworkMethod(
      'serviceFramework',
      'subscribeEvent',
      /*methodArgs*/ [this.socket.id, serviceName, methodName],
      serviceOptions
   );
  }

  _unsubscribeEventFromServer(serviceName: string, methodName: string, serviceOptions: mixed): Promise {
    return this.callServiceFrameworkMethod(
      'serviceFramework',
      'unsubscribeEvent',
      /*methodArgs*/ [this.socket.id, serviceName, methodName],
      serviceOptions
   );
  }

  registerEventListener(
    localEventName: string, 
    callback: (...args: Array<mixed>) => void, 
    serviceOptions: mixed
  ): Disposable {
    var [serviceName, eventMethodName] = localEventName.split('/');
    var remoteEventName = getRemoteEventName(serviceName, eventMethodName, serviceOptions);
    this.serviceFrameworkEventEmitter.on(remoteEventName, callback);
    var subscribePromise = this._subscribeEventOnServer(serviceName, eventMethodName, serviceOptions);
    return new Disposable(() => {
      this.serviceFrameworkEventEmitter.removeListener(remoteEventName, callback);
      return subscribePromise.then(
          () => this._unsubscribeEventFromServer(serviceName, eventMethodName, serviceOoptions));
    });
  }

  async callMethod(
      serviceName: string,
      methodName: string,
      methodArgs: ?Array<mixed>,
      extraOptions: ?mixed
    ): Promise<string|mixed> {
    var {args, argTypes} = serializeArgs(methodArgs || []);
    try {
      return await this.socket.xhrRequest(extend({
        uri: serviceName + '/' + methodName,
        qs: {
          args,
          argTypes,
        },
        method: 'GET', // default request method is 'GET'.
      }, extraOptions || {}));
    } catch (err) {
      logger.error(err);
      throw err;
    }
  }

  async callServiceFrameworkMethod(
      serviceName: string,
      methodName: string,
      methodArgs: Array<mixed>,
      serviceOptions: mixed
    ): Promise<string|mixed> {
    // Use serviceOptions as first argument of methodArgs as it is the simplest
    // way to pass serviceOptions to client without changing lots of code.
    // TODO(chenshen) make it better.
    var {args, argTypes} = serializeArgs([serviceOptions].concat(methodArgs));
    try {
      return await this.socket.xhrRequest({
        uri: serviceName + '/' + methodName,
        qs: {
          args,
          argTypes,
        },
        method: 'POST', 
        json: true,
      });
    } catch (err) {
      logger.error(err);
      throw err;
    }
  }

  async subscribeToChannel(channel: string, handler: (event: ?mixed) => void): Promise<Disposable> {
    await this._callSubscribe(channel);
    this.eventbus.on(channel, handler);
    return {
      dispose: () => this.removeListener(channel, handler),
    };
  }

  async _callSubscribe(channel: string, options: ?mixed = {}): Promise {
    // Wait for the client to connect, for the server to find a medium to send the events to.
    await this.socket.waitForConnect();
    await this.callMethod(
      /*serviceName*/ 'eventbus',
      /*methodName*/ 'subscribe',
      /*methodArgs*/ [this.socket.id, channel, options],
      /*extraOptions*/ {method: 'POST', json: true}
    );
  }

  consumeStream(streamId: number): Promise<Stream> {
    var streamEvents = ['data', 'error', 'close', 'end'];
    return this.consumeEventEmitter(streamId, streamEvents, ['end']);
  }

  /**
   * Subscribe to an event emitter or stream of events happening on the server.
   * Will mainly be used for consumption by streaming services:
   * e.g. like process tailing and watcher service.
   */
  async consumeEventEmitter(
      eventEmitterId: number,
      eventNames: Array<string>,
      disposeEventNames: ?Array<string>
    ): Promise<EventEmitter> {

    var eventEmitter = new EventEmitter();
    this._eventEmitters[eventEmitterId] = eventEmitter;
    (disposeEventNames || []).forEach((disposeEventName) =>
      eventEmitter.once(disposeEventName, () =>  delete this._eventEmitters[eventEmitterId])
    );

    await this._callSubscribe(eventEmitterChannel(eventEmitterId), {
      eventEmitterId,
      eventNames,
    });
    return eventEmitter;
  }

  close(): void {
    this.socket.close();
  }
}

function eventEmitterChannel(id: number) {
  return 'event_emitter/' + id;
}

module.exports = NuclideRemoteEventbus;
