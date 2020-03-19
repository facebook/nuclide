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

/**
 * NOTE: Keep this file free of runtime dependencies!
 * Dependencies should be injected into createProxyGenerator below.
 * This allows us to easily cache the result of this function during development
 * to minimize the impact on reload times.
 */

import typeof * as babelTypes from '@babel/types';
// This is in devDependencies. This file is only reachable in dev mode.
// eslint-disable-next-line nuclide-internal/no-unresolved
import typeof * as babelGenerator from '@babel/generator';

import type {
  Definitions,
  FunctionType,
  NamedType,
  Type,
  InterfaceDefinition,
} from './types';

export default function createProxyGenerator(
  t: babelTypes,
  generate: babelGenerator,
) {
  const thenIdent = t.identifier('then');

  const moduleDotExportsExpression = t.memberExpression(
    t.identifier('module'),
    t.identifier('exports'),
  );
  const clientIdentifier = t.identifier('_client');

  // Functions that are implemented at the connection layer.
  const callRemoteFunctionExpression = t.memberExpression(
    clientIdentifier,
    t.identifier('callRemoteFunction'),
  );
  const callRemoteMethodExpression = t.memberExpression(
    clientIdentifier,
    t.identifier('callRemoteMethod'),
  );
  const disposeRemoteObjectExpression = t.memberExpression(
    clientIdentifier,
    t.identifier('disposeRemoteObject'),
  );

  const remoteModule = t.identifier('remoteModule');
  const emptyObject = t.objectExpression([]);

  const clientDotMarshalExpression = t.memberExpression(
    clientIdentifier,
    t.identifier('marshal'),
  );
  const clientDotUnmarshalExpression = t.memberExpression(
    clientIdentifier,
    t.identifier('unmarshal'),
  );
  const marshalCall = (...args) =>
    t.callExpression(clientDotMarshalExpression, args);
  const unmarshalCall = (...args) =>
    t.callExpression(clientDotUnmarshalExpression, args);

  const clientDotMarshalArgsExpression = t.memberExpression(
    clientIdentifier,
    t.identifier('marshalArguments'),
  );
  // const clientDotUnmarshalArgsExpression
  //   = t.memberExpression(clientIdentifier, t.identifier('unmarshalArguments'));

  /**
   * Helper function that generates statments that can be used to marshal all of the
   * arguments to a function.
   * @param argumentTypes - An array of the types of the function's arguments.
   * @returns An expression representing a promise that resolves to an array of the arguments.
   */
  const marshalArgsCall = params =>
    t.callExpression(clientDotMarshalArgsExpression, [
      t.callExpression(
        t.memberExpression(t.identifier('Array'), t.identifier('from')),
        [t.identifier('arguments')],
      ),
      objectToLiteral(params),
    ]);

  // const unmarshalArgsCall = params => t.callExpression(clientDotUnmarshalArgsExpression, [
  //   t.arguments,
  //   objectToLiteral(params),
  // ]);

  // Generates `Object.defineProperty(module.exports, name, {value: …})`
  const objectDefinePropertyCall = (name, value) =>
    t.callExpression(
      t.memberExpression(
        t.identifier('Object'),
        t.identifier('defineProperty'),
      ),
      [
        moduleDotExportsExpression,
        t.stringLiteral(name),
        t.objectExpression([t.objectProperty(t.identifier('value'), value)]),
      ],
    );

  /**
   * Given the parsed result of a definition file, generate a remote proxy module
   * that exports the definition's API, but internally calls RPC functions. The function
   * does not return the proxy module directly, but rather returns a 'factory' method
   * that should be called with a RpcConnection object. This factory method returns the
   * remote module with the client object 'closed over,' and used to make the RPC calls.
   * @param defs - The result of parsing the definition file.
   * @returns The proxy factory method.
   */
  function generateProxy(
    serviceName: string,
    preserveFunctionNames: boolean,
    defs: Definitions,
  ): string {
    const statements = [];

    // Declare remoteModule as empty object.
    statements.push(
      t.variableDeclaration('const', [
        t.variableDeclarator(t.identifier('remoteModule'), emptyObject),
      ]),
    );

    Object.keys(defs).forEach(defName => {
      const definition = defs[defName];
      const name = definition.name;
      switch (definition.kind) {
        case 'function':
          const functionName = preserveFunctionNames
            ? name
            : `${serviceName}/${name}`;
          // Generate a remote proxy for each module-level function.
          statements.push(
            t.expressionStatement(
              t.assignmentExpression(
                '=',
                t.memberExpression(remoteModule, t.identifier(name)),
                generateFunctionProxy(functionName, definition.type),
              ),
            ),
          );
          break;
        case 'interface':
          // Generate a remote proxy for each remotable interface.
          statements.push(
            t.expressionStatement(
              t.assignmentExpression(
                '=',
                t.memberExpression(remoteModule, t.identifier(name)),
                generateInterfaceProxy(definition),
              ),
            ),
          );
          break;
        case 'alias':
          // nothing
          break;
      }
    });

    // Return the remote module.
    statements.push(t.returnStatement(remoteModule));

    // Wrap the remoteModule construction in a function that takes a RpcConnection
    // object as an argument.
    const func = t.arrowFunctionExpression(
      [clientIdentifier],
      t.blockStatement(statements),
    );
    const assignment = t.assignmentExpression(
      '=',
      moduleDotExportsExpression,
      func,
    );
    const program = t.program([
      // !!!This module is not transpiled!!!
      t.expressionStatement(t.stringLiteral('use strict')),
      t.expressionStatement(assignment),
      t.expressionStatement(
        objectDefinePropertyCall('defs', objectToLiteral(defs)),
      ),
    ]);

    // Use Babel to generate code from the AST.
    return generate(program).code;
  }

  /**
   * Generate a remote proxy for a module-level function.
   * @param func - The FunctionDefinition object that represents the functions API.
   * @returns The proxy function (as an arrow function) that should be assigned to
   *   a property of the remote module.
   */
  function generateFunctionProxy(name: string, funcType: FunctionType): any {
    // _client.callRemoteFunction(name, kind, args)
    const callExpression = t.callExpression(callRemoteFunctionExpression, [
      t.stringLiteral(name),
      t.stringLiteral(funcType.returnType.kind),
      marshalArgsCall(funcType.argumentTypes),
    ]);

    const result = generateUnmarshalResult(funcType.returnType, callExpression);

    // function(arg0, ... argN) { return ... }
    const args = funcType.argumentTypes.map((arg, i) =>
      t.identifier(`arg${i}`),
    );
    return t.functionExpression(
      null,
      args,
      t.blockStatement([t.returnStatement(result)]),
    );
  }

  /**
   * Generate a remote proxy for an interface.
   * @param def - The InterfaceDefinition object that encodes all if the interface's operations.
   * @returns An anonymous ClassExpression node that can be assigned to a module property.
   */
  function generateInterfaceProxy(def: InterfaceDefinition): any {
    const methodDefinitions = [];

    // Generate proxies for static methods.
    Object.keys(def.staticMethods).forEach(methodName => {
      const funcType = def.staticMethods[methodName];
      const funcProxy = generateFunctionProxy(
        `${def.name}/${methodName}`,
        funcType,
      );
      methodDefinitions.push(
        t.classMethod(
          'method',
          t.identifier(methodName),
          funcProxy.params,
          funcProxy.body,
          /* computed: */ false,
          /* static: */ true,
        ),
      );
    });

    // Generate a constructor stub.
    methodDefinitions.push(generateRemoteConstructor());

    // Generate proxies for instance methods.
    const thisType: NamedType = {
      kind: 'named',
      location: def.location,
      name: def.name,
    };
    Object.keys(def.instanceMethods).forEach(methodName => {
      const funcType = def.instanceMethods[methodName];
      // dispose method is generated custom at the end
      if (methodName === 'dispose') {
        return;
      }
      const methodDefinition = generateRemoteDispatch(
        methodName,
        thisType,
        funcType,
      );
      methodDefinitions.push(methodDefinition);
    });

    // Generate the dispose method.
    methodDefinitions.push(generateDisposeMethod());

    return t.classExpression(null, null, t.classBody(methodDefinitions), []);
  }

  /**
   * Helper function that generates a remote constructor stub.
   * Remote constructors are not supported, so this just throws.
   * @returns A MethodDefinition node that can be added to a ClassBody.
   */
  function generateRemoteConstructor() {
    // throw Error(...)
    const throwStatement = t.throwStatement(
      t.callExpression(t.identifier('Error'), [
        t.stringLiteral('constructors are not supported for remote objects'),
      ]),
    );

    // constructor() { ... }
    return t.classMethod(
      'constructor',
      t.identifier('constructor'),
      [],
      t.blockStatement([throwStatement]),
    );
  }

  /**
   * Helper function that generates a proxy for an instance method of an interface.
   * @param methodName - The name of the method.
   * @param funcType - The type information for the function.
   * @returns A MethodDefinition node that can be added to a ClassBody
   */
  function generateRemoteDispatch(
    methodName: string,
    thisType: NamedType,
    funcType: FunctionType,
  ) {
    // _client.callRemoteMethod(id, methodName, returnType, args)
    const callRemoteMethod = t.callExpression(callRemoteMethodExpression, [
      generateTransformStatement(t.thisExpression(), thisType, true),
      t.stringLiteral(methodName),
      t.stringLiteral(funcType.returnType.kind),
      marshalArgsCall(funcType.argumentTypes),
    ]);

    // ... .then(value => _client.unmarshal(...))
    const result = generateUnmarshalResult(
      funcType.returnType,
      callRemoteMethod,
    );

    // methodName(arg0, ... argN) { return ... }
    const funcTypeArgs = funcType.argumentTypes.map((arg, i) =>
      t.identifier(`arg${i}`),
    );
    return t.classMethod(
      'method',
      t.identifier(methodName),
      funcTypeArgs,
      t.blockStatement([t.returnStatement(result)]),
    );
  }

  function generateUnmarshalResult(returnType: Type, valueExpression) {
    switch (returnType.kind) {
      case 'void':
        return valueExpression;
      case 'promise':
        const promiseTransformer = generateValueTransformer(returnType.type);
        return thenPromise(valueExpression, promiseTransformer);
      case 'observable':
        // Map the events through the appropriate marshaller.
        // ... .map(value => _client.unmarshal(value, returnType))
        const observableTransformer = generateValueTransformer(returnType.type);
        const unmarshalledObservable = t.callExpression(
          t.memberExpression(valueExpression, t.identifier('map')),
          [observableTransformer],
        );

        // And finally, convert to a ConnectableObservable with publish.
        return t.callExpression(
          t.memberExpression(unmarshalledObservable, t.identifier('publish')),
          [],
        );
      default:
        throw new Error(`Unknown return type ${returnType.kind}.`);
    }
  }

  // value => _client.unmarshal(value, type)
  function generateValueTransformer(type: Type) {
    const value = t.identifier('value');
    return t.arrowFunctionExpression(
      [value],
      t.blockStatement([
        t.returnStatement(generateTransformStatement(value, type, false)),
      ]),
    );
  }

  /**
   * Helper method that generates the dispose method for a class. The dispose method
   * calls `_client.disposeRemoteObject` with the object's id as a parameter.
   * @returns A MethodDefinition node that can be attached to a class body.
   */
  function generateDisposeMethod() {
    // return _client.disposeRemoteObject(this);
    const returnStatement = t.returnStatement(
      t.callExpression(disposeRemoteObjectExpression, [t.thisExpression()]),
    );

    // dispose() { ... }
    return t.classMethod(
      'method',
      t.identifier('dispose'),
      [],
      t.blockStatement([returnStatement]),
    );
  }

  /**
   * Helper function that generates a transformation statement for an object. This ammounts to
   * a call either to _client.marshal or _client.unmarshal.
   * @param id {Identifier} The identifier of the value to convert.
   * @param type {Type} The type of the value to convert.
   * @param marshal {boolean} - If true, then we are trying to marshal the value. If false, then
   *   we are trying to unmarshal.
   */
  function generateTransformStatement(
    id: any,
    type: Type,
    marshal: boolean,
  ): any {
    // The first argument is the value to be marshalled or unmarshalled.
    // The second argument is the type object, which encodes all of the information required
    // to marshal / unmarshal the value.
    const convertArgs = [id, objectToLiteral(type)];

    // If the type is parameterized, we send the parameters as an optional fourth argument.
    // $FlowFixMe(>=0.68.0) Flow suppress (T27187857)
    if (type.param) {
      convertArgs.push(objectToLiteral(type.param));
    }

    // Return the appropriate call.
    return (marshal ? marshalCall : unmarshalCall).apply(this, convertArgs);
  }

  /**
   * Takes an object, and recursively converts it to a Babel AST literal node. This handles strings,
   * numbers, booleans, basic objects, and Arrays. This cannot handle circular references.
   * @param obj - The object to convert.
   * @returns A babel AST node.
   */
  function objectToLiteral(obj: any): any {
    if (typeof obj === 'string') {
      return t.stringLiteral(obj);
    } else if (typeof obj === 'number') {
      return t.numericLiteral(obj);
    } else if (typeof obj === 'boolean') {
      return t.booleanLiteral(obj);
      // eslint-disable-next-line eqeqeq
    } else if (obj === null) {
      return t.nullLiteral();
    } else if (obj === undefined) {
      // undefined
      return t.identifier('undefined');
    } else if (Array.isArray(obj)) {
      // [...]
      return t.arrayExpression(obj.map(elem => objectToLiteral(elem)));
    } else if (obj instanceof Map) {
      return t.newExpression(
        t.identifier('Map'),
        obj.size
          ? // new Map([...])
            [objectToLiteral(Array.from(obj.entries()))]
          : // new Map()
            [],
      );
    } else if (typeof obj === 'object') {
      // {a: 1, b: 2}
      return t.objectExpression(
        Object.keys(obj).map(key =>
          t.objectProperty(
            t.isValidIdentifier(key) ? t.identifier(key) : t.stringLiteral(key),
            objectToLiteral(obj[key]),
          ),
        ),
      );
    }

    throw new Error(`Cannot convert unknown type ${typeof obj} to literal.`);
  }

  /**
   * Helper function that `.then`s on a promise.
   * @param promiseExpression - An expression that will evaluate to a promise.
   * @param functionExpression - A function to pass as an argument to `.then`
   * @returns A CallExpression node that `.then`s on the provided promise.
   */
  function thenPromise(promiseExpression, functionExpression): any {
    return t.callExpression(t.memberExpression(promiseExpression, thenIdent), [
      functionExpression,
    ]);
  }

  return {
    generateProxy,
    /** Export private functions for unit-testing. */
    __test__: {
      generateTransformStatement,
      objectToLiteral,
    },
  };
}
