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

import type {PredefinedTransformer} from './index';

import {createProxyFactory} from './main';
import {TypeRegistry} from './TypeRegistry';
import type {FunctionType, Definitions, InterfaceDefinition} from './types';
import type {ProxyFactory} from './main';
import invariant from 'assert';
import type {ConfigEntry} from './index';
import type {ObjectRegistry} from './ObjectRegistry';
import {getLogger} from 'log4js';
import {SERVICE_FRAMEWORK3_PROTOCOL} from './config';

const logger = getLogger('nuclide-rpc');

export type FunctionImplementation = {
  getLocalImplementation: Function,
  type: FunctionType,
};
export type ClassDefinition = {
  getLocalImplementation: any,
  definition: InterfaceDefinition,
};
export type ServiceDefinition = {
  name: string,
  factory: ProxyFactory, // Maps from RpcContext to proxy
};

export class ServiceRegistry {
  _protocol: string;

  _typeRegistry: TypeRegistry;

  /**
   * Store a mapping from function name to a structure holding both the local implementation and
   * the type definition of the function.
   */
  _functionsByName: Map<string, FunctionImplementation>;

  /**
   * Store a mapping from a class name to a struct containing it's local constructor and it's
   * interface definition.
   */
  _classesByName: Map<string, ClassDefinition>;

  _predefinedTypes: Array<string>;
  _services: Map<string, ServiceDefinition>;

  constructor(
    predefinedTypes: Array<PredefinedTransformer>,
    services: Array<ConfigEntry>,
    protocol: string = SERVICE_FRAMEWORK3_PROTOCOL,
  ) {
    this._protocol = protocol;
    this._typeRegistry = new TypeRegistry(predefinedTypes);
    this._predefinedTypes = predefinedTypes.map(
      predefinedType => predefinedType.typeName,
    );
    this._functionsByName = new Map();
    this._classesByName = new Map();
    this._services = new Map();

    this.addServices(services);
  }

  getProtocol(): string {
    return this._protocol;
  }

  addServices(services: Array<ConfigEntry>): void {
    services.forEach(this.addService, this);
  }

  addService(service: ConfigEntry): void {
    const preserveFunctionNames =
      service.preserveFunctionNames != null && service.preserveFunctionNames;
    try {
      const factory = createProxyFactory(
        service.name,
        preserveFunctionNames,
        service.definition,
        this._predefinedTypes,
      );
      this._services.set(service.name, {
        name: service.name,
        factory,
      });

      // Register type aliases.
      const defs: Definitions = factory.defs;
      Object.keys(defs).forEach(defName => {
        const definition = defs[defName];
        const name = definition.name;
        switch (definition.kind) {
          case 'alias':
            if (definition.definition != null) {
              this._typeRegistry.registerAlias(
                name,
                definition.location,
                definition.definition,
              );
            }
            break;

          case 'function':
            // Register module-level functions.
            const functionName = service.preserveFunctionNames
              ? name
              : `${service.name}/${name}`;
            this._registerFunction(
              functionName,
              service.implementation,
              impl => impl[name],
              definition.type,
            );
            break;

          case 'interface':
            // Register interfaces.
            this._registerClass(
              name,
              service.implementation,
              impl => impl[name],
              definition,
            );
            this._typeRegistry.registerType(
              name,
              definition.location,
              (object, context: ObjectRegistry) =>
                context.marshal(name, object),
              (objectId, context: ObjectRegistry) =>
                context.unmarshal(
                  objectId,
                  name,
                  context.getService(service.name)[name],
                ),
            );
            // Register all of the static methods as remote functions.
            Object.keys(definition.staticMethods).forEach(methodName => {
              this._registerFunction(
                `${name}/${methodName}`,
                service.implementation,
                impl => impl[name][methodName],
                definition.staticMethods[methodName],
              );
            });
            break;
        }
      });
    } catch (e) {
      logger.error(
        `Failed to load service ${service.name}. Stack Trace:\n${e.stack}`,
      );
      throw e;
    }
  }

  _registerFunction(
    name: string,
    id: string,
    accessor: Function,
    type: FunctionType,
  ): void {
    if (this._functionsByName.has(name)) {
      throw new Error(`Duplicate RPC function: ${name}`);
    }
    let impl;
    this._functionsByName.set(name, {
      getLocalImplementation() {
        if (impl == null) {
          // $FlowIgnore
          impl = accessor(require(id));
        }
        return impl;
      },
      type,
    });
  }

  _registerClass(
    name: string,
    id: string,
    accessor: Function,
    definition: InterfaceDefinition,
  ): void {
    let impl;
    this._classesByName.set(name, {
      getLocalImplementation() {
        if (impl == null) {
          // $FlowIgnore
          impl = accessor(require(id));
        }
        return impl;
      },
      definition,
    });
  }

  getFunctionImplemention(name: string): FunctionImplementation {
    const result = this._functionsByName.get(name);
    invariant(result);
    return result;
  }

  getClassDefinition(className: string): ClassDefinition {
    const result = this._classesByName.get(className);
    invariant(result != null);
    return result;
  }

  getTypeRegistry(): TypeRegistry {
    return this._typeRegistry;
  }

  getServices(): Iterator<ServiceDefinition> {
    return this._services.values();
  }

  hasService(serviceName: string): boolean {
    return this._services.has(serviceName);
  }

  getService(serviceName: string): ServiceDefinition {
    const result = this._services.get(serviceName);
    invariant(result != null);
    return result;
  }
}
