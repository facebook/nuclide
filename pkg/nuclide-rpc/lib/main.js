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

import fs from 'fs';
import nuclideUri from 'nuclide-commons/nuclideUri';
import invariant from 'assert';
import Module from 'module';

import {generateProxy} from './proxy-generator';
import {parseServiceDefinition} from './service-parser';

// Proxy dependencies
import {Observable} from 'rxjs';

import type {ReturnKind, Type, Parameter} from './types';

export type RpcContext = {
  callRemoteFunction(
    functionName: string,
    returnType: ReturnKind,
    args: Object,
  ): any,
  callRemoteMethod(
    objectId: number,
    methodName: string,
    returnType: ReturnKind,
    args: Object,
  ): any,
  createRemoteObject(
    interfaceName: string,
    thisArg: Object,
    unmarshalledArgs: Array<any>,
    argTypes: Array<Parameter>,
  ): void,
  disposeRemoteObject(object: Object): Promise<void>,
  marshal(value: any, type: Type): any,
  unmarshal(value: any, type: Type): any,
  marshalArguments(
    args: Array<any>,
    argTypes: Array<Parameter>,
  ): Promise<Object>,
  unmarshalArguments(
    args: Object,
    argTypes: Array<Parameter>,
  ): Promise<Array<any>>,
};

export type ProxyFactory = (context: RpcContext) => Object;

/** Cache for remote proxies. */
const proxiesCache: Map<string, ProxyFactory> = new Map();

export function proxyFilename(definitionPath: string): string {
  invariant(
    nuclideUri.isAbsolute(definitionPath),
    `"${definitionPath}" definition path must be absolute.`,
  );
  const dir = nuclideUri.dirname(definitionPath);
  const name = nuclideUri.basename(
    definitionPath,
    nuclideUri.extname(definitionPath),
  );
  const filename = nuclideUri.join(dir, name + 'Proxy.js');
  return filename;
}

export function createProxyFactory(
  serviceName: string,
  preserveFunctionNames: boolean,
  definitionPath: string,
  predefinedTypes: Array<string>,
): ProxyFactory {
  if (!proxiesCache.has(definitionPath)) {
    const filename = proxyFilename(definitionPath);

    let code;
    if (fs.existsSync(filename)) {
      code = fs.readFileSync(filename, 'utf8');
    } else {
      const definitionSource = fs.readFileSync(definitionPath, 'utf8');
      const defs = parseServiceDefinition(
        definitionPath,
        definitionSource,
        predefinedTypes,
      );
      code = generateProxy(serviceName, preserveFunctionNames, defs);
    }

    const m = loadCodeAsModule(code, filename);
    m.exports.inject(Observable);

    proxiesCache.set(definitionPath, m.exports);
  }

  const factory = proxiesCache.get(definitionPath);
  invariant(factory != null);

  return factory;
}

function loadCodeAsModule(code: string, filename: string): Module {
  invariant(code.length > 0, 'Code must not be empty.');
  const m = new Module(filename);
  m.filename = filename;
  m.paths = []; // Disallow require resolving by removing lookup paths.
  m._compile(code, filename);
  m.loaded = true;

  return m;
}

// Export caches for testing.
export const __test__ = {
  proxiesCache,
};
