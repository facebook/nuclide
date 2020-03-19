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

import invariant from 'assert';
import {getLogger} from 'log4js';
import {Emitter} from 'event-kit';
import type {ServiceRegistry} from './ServiceRegistry';
import type {RpcContext} from './main';
import type {RemoteObject, ObjectRegistryInterface} from './types';

const logger = getLogger('nuclide-rpc');

type ObjectRegistration = {
  interface: string,
  remoteId: number,
  object: RemoteObject,
};

type RegistryKind = 'server' | 'client';

// Handles lifetimes of marshalling wrappers remote objects.
//
// Object passed by reference over RPC are assigned an ID.
// Positive IDs represent objects which live on the server,
// negative IDs represent objects which live on the client.
export class ObjectRegistry implements ObjectRegistryInterface {
  // These members handle local objects which have been marshalled remotely.
  _registrationsById: Map<number, ObjectRegistration>;
  _registrationsByObject: Map<RemoteObject, ObjectRegistration>;
  _nextObjectId: number;
  _subscriptions: Map<number, rxjs$ISubscription>;
  _delta: number;
  // These members handle remote objects.
  _proxiesById: Map<number, ObjectRegistration>;
  // null means the proxy has been disposed.
  _idsByProxy: Map<Object, ?number>;
  // Maps service name to proxy
  _serviceRegistry: ServiceRegistry;
  _services: Map<string, Object>;
  _context: RpcContext;
  _emitter: Emitter;

  constructor(
    kind: RegistryKind,
    serviceRegistry: ServiceRegistry,
    context: RpcContext,
  ) {
    this._delta = kind === 'server' ? 1 : -1;
    this._nextObjectId = this._delta;
    this._registrationsById = new Map();
    this._registrationsByObject = new Map();
    this._subscriptions = new Map();
    this._proxiesById = new Map();
    this._idsByProxy = new Map();
    this._serviceRegistry = serviceRegistry;
    this._services = new Map();
    this._context = context;
    this._emitter = new Emitter();
  }

  onRegisterLocal(callback: number => void): IDisposable {
    return this._emitter.on('register-local', callback);
  }

  onUnregisterLocal(callback: number => void): IDisposable {
    return this._emitter.on('unregister-local', callback);
  }

  onRegisterRemote(callback: number => void): IDisposable {
    return this._emitter.on('register-remote', callback);
  }

  getService(serviceName: string): Object {
    let service = this._services.get(serviceName);
    if (service == null) {
      service = this._serviceRegistry
        .getService(serviceName)
        .factory(this._context);
      this._services.set(serviceName, service);
    }
    return service;
  }

  unmarshal(
    id: number,
    interfaceName?: string,
    proxyClass?: Function,
  ): RemoteObject {
    if (this._isLocalId(id)) {
      return this._unmarshalLocalObject(id);
    } else {
      invariant(proxyClass != null);
      invariant(interfaceName != null);
      return this._unmarshalRemoteObject(id, interfaceName, proxyClass);
    }
  }

  _unmarshalLocalObject(id: number): RemoteObject {
    return this._getRegistration(id).object;
  }

  _unmarshalRemoteObject(
    remoteId: number,
    interfaceName: string,
    proxyClass: Function,
  ): RemoteObject {
    const existingProxy = this._proxiesById.get(remoteId);
    if (existingProxy != null) {
      return existingProxy.object;
    }
    invariant(proxyClass != null);

    // Generate the proxy by manually setting the prototype of the proxy to be the
    // prototype of the remote proxy constructor.
    const newProxy = Object.create(proxyClass.prototype);
    this._addProxy(newProxy, interfaceName, remoteId);
    return newProxy;
  }

  _getRegistration(id: number): ObjectRegistration {
    const result = this._isLocalId(id)
      ? this._registrationsById.get(id)
      : this._proxiesById.get(id);
    invariant(result != null, `Unknown registration ${id}`);
    return result;
  }

  getInterface(id: number): string {
    return this._getRegistration(id).interface;
  }

  async disposeObject(remoteId: number): Promise<void> {
    this._emitter.emit('unregister-local', remoteId);
    const registration = this._getRegistration(remoteId);
    const object = registration.object;

    this._registrationsById.delete(remoteId);
    this._registrationsByObject.delete(object);

    // Call the object's local dispose function.
    await object.dispose();
  }

  disposeSubscription(id: number): void {
    const subscription = this.removeSubscription(id);
    if (subscription != null) {
      subscription.unsubscribe();
    }
  }

  // Put the object in the registry.
  marshal(interfaceName: string, object: Object): number {
    if (this._isRemoteObject(object)) {
      return this._marshalRemoteObject(object);
    } else {
      return this._marshalLocalObject(interfaceName, object);
    }
  }

  _marshalRemoteObject(proxy: Object): number {
    const result = this._idsByProxy.get(proxy);
    invariant(result != null);
    return result;
  }

  _marshalLocalObject(interfaceName: string, object: Object): number {
    const existingRegistration = this._registrationsByObject.get(object);
    if (existingRegistration != null) {
      invariant(existingRegistration.interface === interfaceName);
      return existingRegistration.remoteId;
    }

    const objectId = this._nextObjectId;
    this._nextObjectId += this._delta;

    const registration = {
      interface: interfaceName,
      remoteId: objectId,
      object,
    };

    this._emitter.emit('register-local', objectId);
    this._registrationsById.set(objectId, registration);
    this._registrationsByObject.set(object, registration);

    return objectId;
  }

  addSubscription(id: number, subscription: rxjs$ISubscription): void {
    this._subscriptions.set(id, subscription);
  }

  removeSubscription(id: number): ?rxjs$ISubscription {
    const subscription = this._subscriptions.get(id);
    if (subscription != null) {
      this._subscriptions.delete(id);
    }
    return subscription;
  }

  // Disposes all object in the registry
  async dispose(): Promise<void> {
    const ids = Array.from(this._registrationsById.keys());
    logger.info(`Disposing ${ids.length} registrations`);

    await Promise.all(
      ids.map(async id => {
        try {
          await this.disposeObject(id);
        } catch (e) {
          logger.error('Error disposing marshalled object.', e);
        }
      }),
    );

    const subscriptions = Array.from(this._subscriptions.keys());
    logger.info(`Disposing ${subscriptions.length} subscriptions`);
    for (const id of subscriptions) {
      try {
        this.disposeSubscription(id);
      } catch (e) {
        logger.error('Error disposing subscription', e);
      }
    }
  }

  // Returns null if the object is already disposed.
  disposeProxy(proxy: Object): ?number {
    const objectId = this._idsByProxy.get(proxy);
    if (objectId != null) {
      this._idsByProxy.set(proxy, null);
      return objectId;
    } else {
      return null;
    }
  }

  _addProxy(proxy: Object, interfaceName: string, id: number): void {
    invariant(!this._idsByProxy.has(proxy));
    this._idsByProxy.set(proxy, id);

    invariant(!this._proxiesById.has(id));
    this._emitter.emit('register-remote', id);
    this._proxiesById.set(id, {
      interface: interfaceName,
      remoteId: id,
      object: proxy,
    });
  }

  isRegistered(object: Object): boolean {
    return this._registrationsByObject.has(object);
  }

  _isRemoteObject(object: Object): boolean {
    return this._idsByProxy.has(object);
  }

  _isLocalId(id: number): boolean {
    return id * this._delta > 0;
  }
}
