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

import * as babylon from 'babylon';
import {UndefinedSymbolManager} from '../src/lib/UndefinedSymbolManager';

const babylonOptions = {
  sourceType: 'module',
  plugins: ['jsx', 'flow', 'exportExtensions'],
};

describe('UndefinedSymbolManager', () => {
  /* Value Tests */
  it('Should find undefined values in a function', () => {
    const manager = new UndefinedSymbolManager([]);
    const program = 'function myFunc(){return x; };';
    const ast = babylon.parse(program, babylonOptions);
    const undefinedSymbols = manager.findUndefined(ast);
    expect(undefinedSymbols).toBeDefined();
    expect(undefinedSymbols.length).toBe(1);
    expect(undefinedSymbols[0].id).toBe('x');
    expect(undefinedSymbols[0].type).toBe('value');
  });
  it('Should not declare all globals as undefined', () => {
    const manager = new UndefinedSymbolManager([]);
    const program = 'var x = 10; function myFunc(){ return x; };';
    const ast = babylon.parse(program, babylonOptions);
    const undefinedSymbols = manager.findUndefined(ast);
    expect(undefinedSymbols).toBeDefined();
    expect(undefinedSymbols.length).toBe(0);
  });
  it('Should not declare as undefined if imported', () => {
    const manager = new UndefinedSymbolManager([]);
    const program =
      "import {x} from './someFile'; function myFunc(){ return x;}";
    const ast = babylon.parse(program, babylonOptions);
    const undefinedSymbols = manager.findUndefined(ast);
    expect(undefinedSymbols).toBeDefined();
    expect(undefinedSymbols.length).toBe(0);
  });
  it('Should find undefined object', () => {
    const manager = new UndefinedSymbolManager([]);
    const program = 'myFunc.doSomething();';
    const ast = babylon.parse(program, babylonOptions);
    const undefinedSymbols = manager.findUndefined(ast);
    expect(undefinedSymbols).toBeDefined();
    expect(undefinedSymbols.length).toBe(1);
    expect(undefinedSymbols[0].id).toBe('myFunc');
    expect(undefinedSymbols[0].type).toBe('value');
  });
  it('Should catch undefined assignment', () => {
    const manager = new UndefinedSymbolManager([]);
    const program = 'const val = iamnotdefined;';
    const ast = babylon.parse(program, babylonOptions);
    const undefinedSymbols = manager.findUndefined(ast);
    expect(undefinedSymbols).toBeDefined();
    expect(undefinedSymbols.length).toBe(1);
    expect(undefinedSymbols[0].id).toBe('iamnotdefined');
    expect(undefinedSymbols[0].type).toBe('value');
  });

  /* Type Tests */
  it('Should find undeclared types in assignment', () => {
    const manager = new UndefinedSymbolManager([]);
    const program = 'const val : MyType = 10';
    const ast = babylon.parse(program, babylonOptions);
    const undefinedSymbols = manager.findUndefined(ast);
    expect(undefinedSymbols).toBeDefined();
    expect(undefinedSymbols.length).toBe(1);
    expect(undefinedSymbols[0].id).toBe('MyType');
    expect(undefinedSymbols[0].type).toBe('type');
  });
  it('Should find undeclared types in function', () => {
    const manager = new UndefinedSymbolManager([]);
    const program = 'function myFunc(): SomeType {return 10;}';
    const ast = babylon.parse(program, babylonOptions);
    const undefinedSymbols = manager.findUndefined(ast);
    expect(undefinedSymbols).toBeDefined();
    expect(undefinedSymbols.length).toBe(1);
    expect(undefinedSymbols[0].id).toBe('SomeType');
    expect(undefinedSymbols[0].type).toBe('type');
  });
  it('Should not declare as undefined, if type is imported', () => {
    const manager = new UndefinedSymbolManager([]);
    const program =
      "import type MyType from 'module'; const val : MyType = 10;";
    const ast = babylon.parse(program, babylonOptions);
    const undefinedSymbols = manager.findUndefined(ast);
    expect(undefinedSymbols).toBeDefined();
    expect(undefinedSymbols.length).toBe(0);
  });
  it('Should store location correctly', () => {
    const manager = new UndefinedSymbolManager([]);
    const program = 'new ClassThatDoesNotExist();';
    const ast = babylon.parse(program, babylonOptions);
    const undefinedSymbols = manager.findUndefined(ast);
    expect(undefinedSymbols.length).toBe(1);
    expect(undefinedSymbols[0].id).toBe('ClassThatDoesNotExist');
    expect(undefinedSymbols[0].type).toBe('value');
    expect(undefinedSymbols[0].location.start.line).toBe(1);
    expect(undefinedSymbols[0].location.start.col).toBe(4);
    expect(undefinedSymbols[0].location.end.line).toBe(1);
    expect(undefinedSymbols[0].location.end.col).toBe(25);
  });

  /* False Positive Tests */
  it('Builtins do not trigger diagnostics', () => {
    const manager = new UndefinedSymbolManager(['builtin', 'es6']);
    const program = 'new Array();';
    const ast = babylon.parse(program, babylonOptions);
    const undefinedSymbols = manager.findUndefined(ast);
    expect(undefinedSymbols.length).toBe(0);
  });
  it('Node builtins do not trigger diagnostics', () => {
    const manager = new UndefinedSymbolManager(['builtin', 'es6', 'node']);
    const program = 'const dir = process.cwd()';
    const ast = babylon.parse(program, babylonOptions);
    const undefinedSymbols = manager.findUndefined(ast);
    expect(undefinedSymbols.length).toBe(0);
  });
  it('Type identifiers should not trigger diagnostics', () => {
    const manager = new UndefinedSymbolManager(['builtin', 'es6', 'node']);
    const program = 'type MyType = {a: number, b: string}';
    const ast = babylon.parse(program, babylonOptions);
    const undefinedSymbols = manager.findUndefined(ast);
    expect(undefinedSymbols.length).toBe(0);
  });
  it('Class imports should be treated as types', () => {
    const manager = new UndefinedSymbolManager(['builtin', 'es6', 'node']);
    const program = "import {SomeClass} from 'file'; var instance: SomeClass; ";
    const ast = babylon.parse(program, babylonOptions);
    const undefinedSymbols = manager.findUndefined(ast);
    expect(undefinedSymbols.length).toBe(0);
  });
  it('TypeAliases are not treated as undeclared types', () => {
    const manager = new UndefinedSymbolManager(['builtin', 'es6', 'node']);
    const program = "type MyType = 'string' | 'number' ";
    const ast = babylon.parse(program, babylonOptions);
    const undefinedSymbols = manager.findUndefined(ast);
    expect(undefinedSymbols.length).toBe(0);
  });
  it('Keeps track of types declared before', () => {
    const manager = new UndefinedSymbolManager(['builtin', 'es6', 'node']);
    const program =
      "type MyType = 'string' | 'number'; const val: MyType = 10; ";
    const ast = babylon.parse(program, babylonOptions);
    const undefinedSymbols = manager.findUndefined(ast);
    expect(undefinedSymbols.length).toBe(0);
  });
  it('Keeps track of types declared after', () => {
    const manager = new UndefinedSymbolManager(['builtin', 'es6', 'node']);
    const program =
      "const val: MyType = 10; type MyType = 'string' | 'number';";
    const ast = babylon.parse(program, babylonOptions);
    const undefinedSymbols = manager.findUndefined(ast);
    expect(undefinedSymbols.length).toBe(0);
  });
  it('No false positives with generics', () => {
    const manager = new UndefinedSymbolManager(['builtin', 'es6', 'node']);
    const program =
      'class GenericList<A> { returnsA(something: A): A { return something; }}';
    const ast = babylon.parse(program, babylonOptions);
    const undefinedSymbols = manager.findUndefined(ast);
    expect(undefinedSymbols.length).toBe(0);
  });
  it('No false positives from ObjectTypeIndexers', () => {
    const manager = new UndefinedSymbolManager(['builtin', 'es6', 'node']);
    const program =
      'type log4js$Config = { levels?: {[name: string]: string},}';
    const ast = babylon.parse(program, babylonOptions);
    const undefinedSymbols = manager.findUndefined(ast);
    expect(undefinedSymbols.length).toBe(0);
  });
  it('No false positives from React elements', () => {
    const manager = new UndefinedSymbolManager(['builtin', 'es6', 'node']);
    const program =
      "import React from 'react'; class Element {render(): React.Element<any> {return (<li></li>);}}";
    const ast = babylon.parse(program, babylonOptions);
    const undefinedSymbols = manager.findUndefined(ast);
    expect(undefinedSymbols.length).toBe(0);
  });
  it('Do not provide undefined symbols for declared flow modules', () => {
    const manager = new UndefinedSymbolManager(['builtin', 'es6', 'node']);
    const program =
      "import SomeModule from 'a'; const thing: SomeModule.SomeType = 5;";
    const ast = babylon.parse(program, babylonOptions);
    const undefinedSymbols = manager.findUndefined(ast);
    expect(undefinedSymbols.length).toBe(0);
  });
});
