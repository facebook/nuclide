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

import type {ConfigEntry, Transport} from './index';
import type {ReturnType, Type, Parameter} from './types';
import type {TypeRegistry} from './TypeRegistry';
import type {
  ResponseMessage,
  RequestMessage,
  CallMessage,
  CallObjectMessage,
  NewObjectMessage,
} from './messages';
import type {ClassDefinition, FunctionImplementation} from './ServiceRegistry';
import type {PredefinedTransformer} from './index';

import invariant from 'assert';
import {Observable, ConnectableObservable} from 'rxjs';
import {ServiceRegistry} from './ServiceRegistry';
import {ObjectRegistry} from './ObjectRegistry';
import {
  createCallMessage,
  createCallObjectMessage,
  createNewObjectMessage,
  createDisposeMessage,
  createUnsubscribeMessage,
  createPromiseMessage,
  createErrorResponseMessage,
  createNextMessage,
  createCompleteMessage,
  createObserveErrorMessage,
  decodeError,
} from './messages';
import {builtinLocation, voidType} from './builtin-types';
import {track, trackTiming} from '../../nuclide-analytics';
import {SERVICE_FRAMEWORK3_PROTOCOL} from './config';
import {shorten} from 'nuclide-commons/string';
import {getLogger} from 'log4js';

const logger = getLogger('nuclide-rpc');

const SERVICE_FRAMEWORK_RPC_TIMEOUT_MS = 60 * 1000;
const LARGE_RESPONSE_SIZE = 100000;

type RpcConnectionKind = 'server' | 'client';

class Subscription {
  _message: RequestMessage;
  _observer: rxjs$Observer<any>;

  // Track the total number of received bytes to track large subscriptions.
  // Reset the count every minute so frequent offenders fire repeatedly.
  _totalBytes: number;
  _firstByteTime: number;

  constructor(message: RequestMessage, observer: rxjs$Observer<any>) {
    this._message = message;
    this._observer = observer;
    this._totalBytes = 0;
    this._firstByteTime = 0;
  }

  error(error): void {
    try {
      this._observer.error(decodeError(this._message, error));
    } catch (e) {
      logger.error(`Caught exception in Subscription.error: ${e.toString()}`);
    }
  }

  next(data: any, bytes: number): void {
    try {
      this._observer.next(data);
      // TODO: consider implementing a rate limit
      this._totalBytes += bytes;
    } catch (e) {
      logger.error(`Caught exception in Subscription.next: ${e.toString()}`);
    }
  }

  complete(): void {
    try {
      this._observer.complete();
    } catch (e) {
      logger.error(
        `Caught exception in Subscription.complete: ${e.toString()}`,
      );
    }
  }

  getBytes(): number {
    if (Date.now() - this._firstByteTime > 60000) {
      this._totalBytes = 0;
      this._firstByteTime = Date.now();
    }
    return this._totalBytes;
  }
}

// Special marker error for RPC timeouts.
export class RpcTimeoutError extends Error {
  name: string = 'RpcTimeoutError';
}

class Call {
  _message: RequestMessage;
  _timeoutMessage: string;
  _reject: (error: any) => void;
  _resolve: (result: any) => void;
  _cleanup: () => void;
  _complete: boolean;
  _timerId: ?number;

  constructor(
    message: RequestMessage,
    timeoutMessage: string,
    resolve: (result: any) => void,
    reject: (error: any) => void,
    cleanup: () => void,
  ) {
    this._message = message;
    this._timeoutMessage = timeoutMessage;
    this._resolve = resolve;
    this._reject = reject;
    this._cleanup = cleanup;
    this._complete = false;
    this._timerId = setTimeout(() => {
      this._timeout();
    }, SERVICE_FRAMEWORK_RPC_TIMEOUT_MS);
  }

  reject(error): void {
    if (!this._complete) {
      this.cleanup();
      this._reject(decodeError(this._message, error));
    }
  }

  resolve(result): void {
    if (!this._complete) {
      this.cleanup();
      this._resolve(result);
    }
  }

  cleanup(): void {
    if (!this._complete) {
      this._complete = true;
      clearTimeout(this._timerId);
      this._timerId = null;
      this._cleanup();
    }
  }

  _timeout(): void {
    if (!this._complete) {
      this.cleanup();
      this._reject(
        new RpcTimeoutError(
          `Timeout after ${SERVICE_FRAMEWORK_RPC_TIMEOUT_MS} for id: ` +
            `${this._message.id}, ${this._timeoutMessage}.`,
        ),
      );
    }
  }
}

export type RpcConnectionOptions = {
  // Enables timing tracking for function/method calls (with the given sample rate).
  // Must be a positive integer; e.g. trackSampling = 10 means a 1/10 sample rate.
  trackSampleRate?: number,
};

export class RpcConnection<TransportType: Transport> {
  _rpcRequestId: number;
  _transport: TransportType;
  _serviceRegistry: ServiceRegistry;
  _objectRegistry: ObjectRegistry;
  _subscriptions: Map<number, Subscription>;
  _calls: Map<number, Call>;
  _options: RpcConnectionOptions;

  // Do not call this directly, use factory methods below.
  constructor(
    kind: RpcConnectionKind,
    serviceRegistry: ServiceRegistry,
    transport: TransportType,
    options: RpcConnectionOptions = {},
  ) {
    this._transport = transport;
    this._options = options;
    this._rpcRequestId = 1;
    this._serviceRegistry = serviceRegistry;
    this._objectRegistry = new ObjectRegistry(
      kind,
      this._serviceRegistry,
      this,
    );
    this._transport.onMessage().subscribe(message => {
      this._handleMessage(message);
    });
    this._subscriptions = new Map();
    this._calls = new Map();
  }

  // Creates a connection on the server side.
  static createServer(
    serviceRegistry: ServiceRegistry,
    transport: TransportType,
  ): RpcConnection<TransportType> {
    return new RpcConnection('server', serviceRegistry, transport);
  }

  // Creates a client side connection to a server on another machine.
  static createRemote(
    transport: TransportType,
    predefinedTypes: Array<PredefinedTransformer>,
    services: Array<ConfigEntry>,
    options: RpcConnectionOptions = {},
    protocol: string = SERVICE_FRAMEWORK3_PROTOCOL,
  ): RpcConnection<TransportType> {
    return new RpcConnection(
      'client',
      new ServiceRegistry(predefinedTypes, services, protocol),
      transport,
      options,
    );
  }

  // Creates a client side connection to a server on the same machine.
  static createLocal(
    transport: TransportType,
    predefinedTypes: Array<PredefinedTransformer>,
    services: Array<ConfigEntry>,
    protocol: string = SERVICE_FRAMEWORK3_PROTOCOL,
  ): RpcConnection<TransportType> {
    return new RpcConnection(
      'client',
      new ServiceRegistry(predefinedTypes, services, protocol),
      transport,
    );
  }

  getService(serviceName: string): Object {
    const service = this._objectRegistry.getService(serviceName);
    invariant(service != null, `No config found for service ${serviceName}`);
    return service;
  }

  addServices(services: Array<ConfigEntry>): void {
    services.forEach(this.addService, this);
  }

  addService(service: ConfigEntry): void {
    this._serviceRegistry.addService(service);
  }

  // Delegate marshalling to the type registry.
  marshal(value: any, type: Type): any {
    return this._getTypeRegistry().marshal(this._objectRegistry, value, type);
  }
  unmarshal(value: any, type: Type): any {
    return this._getTypeRegistry().unmarshal(this._objectRegistry, value, type);
  }

  marshalArguments(
    args: Array<any>,
    argTypes: Array<Parameter>,
  ): Promise<Object> {
    return this._getTypeRegistry().marshalArguments(
      this._objectRegistry,
      args,
      argTypes,
    );
  }

  unmarshalArguments(
    args: Object,
    argTypes: Array<Parameter>,
  ): Promise<Array<any>> {
    return this._getTypeRegistry().unmarshalArguments(
      this._objectRegistry,
      args,
      argTypes,
    );
  }

  /**
   * Call a remote function, through the service framework.
   * @param functionName - The name of the remote function to invoke.
   * @param returnType - The type of object that this function returns, so the the transport
   *   layer can register the appropriate listeners.
   * @param args - The serialized arguments to invoke the remote function with.
   */
  callRemoteFunction(
    functionName: string,
    returnType: ReturnType,
    args: Object,
  ): any {
    return this._sendMessageAndListenForResult(
      createCallMessage(
        this._getProtocol(),
        functionName,
        this._generateRequestId(),
        args,
      ),
      returnType,
      `Calling function ${functionName}`,
    );
  }

  /**
   * Call a method of a remote object, through the service framework.
   * @param objectId - The id of the remote object.
   * @param methodName - The name of the method to invoke.
   * @param returnType - The type of object that this function returns, so the the transport
   *   layer can register the appropriate listeners.
   * @param args - The serialized arguments to invoke the remote method with.
   */
  callRemoteMethod(
    objectId: number,
    methodName: string,
    returnType: ReturnType,
    args: Object,
  ): any {
    return this._sendMessageAndListenForResult(
      createCallObjectMessage(
        this._getProtocol(),
        methodName,
        objectId,
        this._generateRequestId(),
        args,
      ),
      returnType,
      `Calling remote method ${methodName}.`,
    );
  }

  /**
   * Call a remote constructor, returning an id that eventually resolves to a unique identifier
   * for the object.
   * @param interfaceName - The name of the remote class for which to construct an object.
   * @param thisArg - The newly created proxy object.
   * @param unmarshalledArgs - Unmarshalled arguments to pass to the remote constructor.
   * @param argTypes - Types of arguments.
   */
  createRemoteObject(
    interfaceName: string,
    thisArg: Object,
    unmarshalledArgs: Array<any>,
    argTypes: Array<Parameter>,
  ): void {
    const idPromise = (async () => {
      const marshalledArgs = await this._getTypeRegistry().marshalArguments(
        this._objectRegistry,
        unmarshalledArgs,
        argTypes,
      );
      return this._sendMessageAndListenForResult(
        createNewObjectMessage(
          this._getProtocol(),
          interfaceName,
          this._generateRequestId(),
          marshalledArgs,
        ),
        'promise',
        `Creating instance of ${interfaceName}`,
      );
    })();
    this._objectRegistry.addProxy(thisArg, interfaceName, idPromise);
  }

  /**
   * Dispose a remote object. This makes it's proxies unsuable, and calls the `dispose` method on
   * the remote object.
   * @param object - The remote object.
   * @returns A Promise that resolves when the object disposal has completed.
   */
  async disposeRemoteObject(object: Object): Promise<void> {
    const objectId = await this._objectRegistry.disposeProxy(object);
    if (objectId == null) {
      logger.info('Duplicate dispose call on remote proxy');
    } else if (this._transport.isClosed()) {
      logger.info('Dispose call on remote proxy after connection closed');
    } else {
      return this._sendMessageAndListenForResult(
        createDisposeMessage(
          this._getProtocol(),
          this._generateRequestId(),
          objectId,
        ),
        'promise',
        `Disposing object ${objectId}`,
      );
    }
  }

  /**
   * Helper function that listens for a result for the given id.
   * @param returnType - Determines the type of messages we should subscribe to, and what this
   *   function should return.
   * @param id - The id of the request who's result we are listening for.
   * @returns Depending on the expected return type, this function either returns undefined, a
   *   Promise, or an Observable.
   */
  _sendMessageAndListenForResult(
    message: RequestMessage,
    returnType: ReturnType,
    timeoutMessage: string,
  ): any {
    switch (returnType) {
      case 'void':
        this._transport.send(JSON.stringify(message));
        return; // No values to return.
      case 'promise':
        // Listen for a single message, and resolve or reject a promise on that message.
        const promise = new Promise((resolve, reject) => {
          this._transport.send(JSON.stringify(message));
          this._calls.set(
            message.id,
            new Call(message, timeoutMessage, resolve, reject, () => {
              this._calls.delete(message.id);
            }),
          );
        });
        const {trackSampleRate} = this._options;
        if (trackSampleRate && Math.random() * trackSampleRate <= 1) {
          return trackTiming(
            trackingIdOfMessageAndNetwork(this._objectRegistry, message),
            () => promise,
          );
        }
        return promise;
      case 'observable': {
        const id = message.id;
        invariant(!this._subscriptions.has(id));

        const sendSubscribe = () => {
          this._transport.send(JSON.stringify(message));
        };
        const sendUnsubscribe = () => {
          if (!this._transport.isClosed()) {
            this._transport.send(
              JSON.stringify(createUnsubscribeMessage(this._getProtocol(), id)),
            );
          }
        };
        let hadSubscription = false;
        const observable = Observable.create(observer => {
          // Only allow a single subscription. This will be the common case,
          // and adding this restriction allows disposing of the observable
          // on the remote side after the initial subscription is complete.
          if (hadSubscription) {
            throw new Error('Attempt to re-connect with a remote Observable.');
          }
          hadSubscription = true;

          const subscription = new Subscription(message, observer);
          this._subscriptions.set(id, subscription);
          sendSubscribe();

          // Observable dispose function, which is called on subscription dispose, on stream
          // completion, and on stream error.
          return {
            unsubscribe: () => {
              if (!this._subscriptions.has(id)) {
                // guard against multiple unsubscribe calls
                return;
              }
              this._subscriptions.delete(id);

              sendUnsubscribe();
            },
          };
        });

        // Conversion to ConnectableObservable happens in the generated
        // proxies.
        return observable;
      }
      default:
        throw new Error(`Unkown return type: ${returnType}.`);
    }
  }

  _returnPromise(id: number, candidate: any, type: Type): void {
    let returnVal = candidate;
    // Ensure that the return value is a promise.
    if (!isThenable(returnVal)) {
      returnVal = Promise.reject(
        new Error(
          'Expected a Promise, but the function returned something else.',
        ),
      );
    }

    // Marshal the result, to send over the network.
    invariant(returnVal != null);
    returnVal = returnVal.then(value =>
      this._getTypeRegistry().marshal(this._objectRegistry, value, type),
    );

    // Send the result of the promise across the socket.
    returnVal.then(
      result => {
        this._transport.send(
          JSON.stringify(createPromiseMessage(this._getProtocol(), id, result)),
        );
      },
      error => {
        this._transport.send(
          JSON.stringify(
            createErrorResponseMessage(this._getProtocol(), id, error),
          ),
        );
      },
    );
  }

  _returnObservable(id: number, returnVal: any, elementType: Type): void {
    let result: ConnectableObservable<any>;
    // Ensure that the return value is an observable.
    if (!isConnectableObservable(returnVal)) {
      result = Observable.throw(
        new Error(
          'Expected an Observable, but the function returned something else.',
        ),
      ).publish();
    } else {
      result = returnVal;
    }

    // Marshal the result, to send over the network.
    result
      .concatMap(value =>
        this._getTypeRegistry().marshal(
          this._objectRegistry,
          value,
          elementType,
        ),
      )
      // Send the next, error, and completion events of the observable across the socket.
      .subscribe(
        data => {
          this._transport.send(
            JSON.stringify(createNextMessage(this._getProtocol(), id, data)),
          );
        },
        error => {
          this._transport.send(
            JSON.stringify(
              createObserveErrorMessage(this._getProtocol(), id, error),
            ),
          );
          this._objectRegistry.removeSubscription(id);
        },
        completed => {
          this._transport.send(
            JSON.stringify(createCompleteMessage(this._getProtocol(), id)),
          );
          this._objectRegistry.removeSubscription(id);
        },
      );

    this._objectRegistry.addSubscription(id, result.connect());
  }

  // Returns true if a promise was returned.
  _returnValue(id: number, value: any, type: Type): void {
    switch (type.kind) {
      case 'void':
        break; // No need to send anything back to the user.
      case 'promise':
        this._returnPromise(id, value, type.type);
        break;
      case 'observable':
        this._returnObservable(id, value, type.type);
        break;
      default:
        throw new Error(`Unknown return type ${type.kind}.`);
    }
  }

  async _callFunction(id: number, call: CallMessage): Promise<void> {
    const {getLocalImplementation, type} = this._getFunctionImplemention(
      call.method,
    );
    const marshalledArgs = await this._getTypeRegistry().unmarshalArguments(
      this._objectRegistry,
      call.args,
      type.argumentTypes,
    );
    const localImplementation = getLocalImplementation();
    this._returnValue(
      id,
      localImplementation.apply(this, marshalledArgs),
      type.returnType,
    );
  }

  async _callMethod(id: number, call: CallObjectMessage): Promise<void> {
    const object = this._objectRegistry.unmarshal(call.objectId);
    invariant(object != null);

    const interfaceName = this._objectRegistry.getInterface(call.objectId);
    const {definition} = this._getClassDefinition(interfaceName);
    const type = definition.instanceMethods[call.method];

    const marshalledArgs = await this._getTypeRegistry().unmarshalArguments(
      this._objectRegistry,
      call.args,
      type.argumentTypes,
    );

    this._returnValue(
      id,
      object[call.method](...marshalledArgs),
      type.returnType,
    );
  }

  async _callConstructor(
    id: number,
    constructorMessage: NewObjectMessage,
  ): Promise<void> {
    const {getLocalImplementation, definition} = this._getClassDefinition(
      constructorMessage.interface,
    );
    const {constructorArgs} = definition;
    invariant(constructorArgs != null);
    const marshalledArgs = await this._getTypeRegistry().unmarshalArguments(
      this._objectRegistry,
      constructorMessage.args,
      constructorArgs,
    );
    const localImplementation = getLocalImplementation();
    // Create a new object and put it in the registry.
    const newObject = new localImplementation(...marshalledArgs);

    // Return the object, which will automatically be converted to an id through the
    // marshalling system.
    this._returnPromise(id, Promise.resolve(newObject), {
      kind: 'named',
      name: constructorMessage.interface,
      location: builtinLocation,
    });
  }

  getTransport(): TransportType {
    return this._transport;
  }

  _parseMessage(value: string): ?Object {
    try {
      const result = JSON.parse(value);
      if (result == null) {
        return null;
      }
      /* TODO: Uncomment this when the Hack service updates their protocol.
      if (result.protocol !== this._getProtocol()) {
        logger.error(`Recieved message with unexpected protocol: '${value}'`);
        return null;
      }
      */
      return result;
    } catch (e) {
      logger.error(`Recieved invalid JSON message: '${value}'`);
      return null;
    }
  }

  _getProtocol(): string {
    return this._serviceRegistry.getProtocol();
  }

  _handleMessage(value: string): void {
    const message: ?(RequestMessage | ResponseMessage) = this._parseMessage(
      value,
    );
    if (message == null) {
      return;
    }

    switch (message.type) {
      case 'response':
      case 'error-response':
      case 'next':
      case 'complete':
      case 'error':
        this._handleResponseMessage(message, value);
        break;
      case 'call':
      case 'call-object':
      case 'new':
      case 'dispose':
      case 'unsubscribe':
        this._handleRequestMessage(message);
        break;
      default:
        throw new Error('Unexpected message type');
    }
  }

  // Handles the response and returns the originating request message (if possible).
  _handleResponseMessage(message: ResponseMessage, rawMessage: string): void {
    const id = message.id;
    switch (message.type) {
      case 'response': {
        const call = this._calls.get(id);
        if (call != null) {
          const {result} = message;
          call.resolve(result);
          if (rawMessage.length >= LARGE_RESPONSE_SIZE) {
            this._trackLargeResponse(call._message, rawMessage.length);
          }
        }
        break;
      }
      case 'error-response': {
        const call = this._calls.get(id);
        if (call != null) {
          const {error} = message;
          call.reject(error);
        }
        break;
      }
      case 'next': {
        const subscription = this._subscriptions.get(id);
        if (subscription != null) {
          const {value} = message;
          const prevBytes = subscription.getBytes();
          subscription.next(value, rawMessage.length);
          if (prevBytes < LARGE_RESPONSE_SIZE) {
            const bytes = subscription.getBytes();
            if (bytes >= LARGE_RESPONSE_SIZE) {
              this._trackLargeResponse(subscription._message, bytes);
            }
          }
        }
        break;
      }
      case 'complete': {
        const subscription = this._subscriptions.get(id);
        if (subscription != null) {
          subscription.complete();
          this._subscriptions.delete(id);
        }
        break;
      }
      case 'error': {
        const subscription = this._subscriptions.get(id);
        if (subscription != null) {
          const {error} = message;
          subscription.error(error);
          this._subscriptions.delete(id);
        }
        break;
      }
      default:
        throw new Error(`Unexpected message type ${JSON.stringify(message)}`);
    }
  }

  async _handleRequestMessage(message: RequestMessage): Promise<void> {
    const id = message.id;

    // Here's the main message handler ...
    try {
      switch (message.type) {
        case 'call':
          await this._callFunction(id, message);
          break;
        case 'call-object':
          await this._callMethod(id, message);
          break;
        case 'new':
          await this._callConstructor(id, message);
          break;
        case 'dispose':
          await this._objectRegistry.disposeObject(message.objectId);
          this._returnPromise(id, Promise.resolve(), voidType);
          break;
        case 'unsubscribe':
          this._objectRegistry.disposeSubscription(id);
          break;
        default:
          throw new Error(`Unknown message type ${message.type}`);
      }
    } catch (e) {
      logger.error(`Error handling RPC ${message.type} message`, e);
      this._transport.send(
        JSON.stringify(createErrorResponseMessage(this._getProtocol(), id, e)),
      );
    }
  }

  _getFunctionImplemention(name: string): FunctionImplementation {
    return this._serviceRegistry.getFunctionImplemention(name);
  }

  _getClassDefinition(className: string): ClassDefinition {
    return this._serviceRegistry.getClassDefinition(className);
  }

  _generateRequestId(): number {
    return this._rpcRequestId++;
  }

  _getTypeRegistry(): TypeRegistry {
    return this._serviceRegistry.getTypeRegistry();
  }

  _trackLargeResponse(message: RequestMessage, size: number) {
    if (!this._options.trackSampleRate) {
      return;
    }
    const eventName = trackingIdOfMessage(this._objectRegistry, message);
    const args = message.args != null
      ? shorten(JSON.stringify(message.args), 100, '...')
      : '';
    logger.warn(`${eventName}: Large response of size ${size}. Args:`, args);
    track('large-rpc-response', {
      eventName,
      size,
      args,
    });
  }

  dispose(): void {
    this._transport.close();
    this._objectRegistry.dispose();
    this._calls.forEach(call => {
      call.reject(new Error('Connection Closed'));
    });
    this._subscriptions.forEach(subscription => {
      subscription.error(new Error('Connection Closed'));
    });
    this._subscriptions.clear();
  }
}

function trackingIdOfMessage(
  registry: ObjectRegistry,
  message: RequestMessage,
): string {
  switch (message.type) {
    case 'call':
      return `service-framework:${message.method}`;
    case 'call-object':
      const callInterface = registry.getInterface(message.objectId);
      return `service-framework:${callInterface}.${message.method}`;
    case 'new':
      return `service-framework:new:${message.interface}`;
    case 'dispose':
      const interfaceName = registry.getInterface(message.objectId);
      return `service-framework:dispose:${interfaceName}`;
    case 'unsubscribe':
      return 'service-framework:disposeObservable';
    default:
      throw new Error(`Unknown message type ${message.type}`);
  }
}

function trackingIdOfMessageAndNetwork(
  registry: ObjectRegistry,
  message: RequestMessage,
): string {
  return trackingIdOfMessage(registry, message) + ':plus-network';
}

/**
 * A helper function that checks if an object is thenable (Promise-like).
 */
function isThenable(object: any): boolean {
  return Boolean(object && object.then);
}

/**
 * A helper function that checks if an object is an Observable.
 */
function isConnectableObservable(object: any): boolean {
  return Boolean(
    object && object.concatMap && object.subscribe && object.connect,
  );
}
