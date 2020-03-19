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
import {memoize} from 'lodash';
import nuclideUri from 'nuclide-commons/nuclideUri';
import invariant from 'assert';
import Module from 'module';
import os from 'os';

import memoizeWithDisk from '../../commons-node/memoizeWithDisk';
import {parseServiceDefinition} from './service-parser';

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
  disposeRemoteObject(object: Object): Promise<void>,
  marshal(value: any, type: Type): any,
  unmarshal(value: any, type: Type): any,
  marshalArguments(args: Array<any>, argTypes: Array<Parameter>): Object,
  unmarshalArguments(args: Object, argTypes: Array<Parameter>): Array<any>,
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
      code = memoizedGenerateProxy(serviceName, preserveFunctionNames, defs);
    }

    const m = loadCodeAsModule(code, filename);
    proxiesCache.set(definitionPath, m.exports);
  }

  const factory = proxiesCache.get(definitionPath);
  invariant(factory != null);

  return factory;
}

const memoizedReadFile = memoize(
  (filename: string): string => {
    return fs.readFileSync(filename, 'utf8');
  },
);

const memoizedGenerateProxy = memoizeWithDisk(
  function generateProxy(serviceName, preserveFunctionNames, defs) {
    // External dependencies: ensure that they're included in the key below.
    const createProxyGenerator = require('./proxy-generator').default;
    const generate = require('@babel/generator').default;
    const t = require('@babel/types');
    return createProxyGenerator(t, generate).generateProxy(
      serviceName,
      preserveFunctionNames,
      defs,
    );
  },
  (serviceName, preserveFunctionNames, defs) => [
    serviceName,
    preserveFunctionNames,
    defs,
    memoizedReadFile(require.resolve('./proxy-generator')),
    require('@babel/generator/package.json').version,
    require('@babel/types/package.json').version,
  ],
  nuclideUri.join(os.tmpdir(), 'nuclide-rpc-cache'),
);

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
