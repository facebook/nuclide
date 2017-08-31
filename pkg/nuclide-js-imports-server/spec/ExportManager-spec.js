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

import {ExportManager} from '../src/lib/ExportManager';
import * as babylon from 'babylon';

const babylonOptions = {
  sourceType: 'module',
  plugins: ['jsx', 'flow', 'exportExtensions', 'objectRestSpread'],
};

describe('ExportManager', () => {
  it('Should index let export', () => {
    const program = 'export let x = 3;';
    const manager = new ExportManager();
    const ast = babylon.parse(program, babylonOptions);
    manager.addFile('testFile', ast);
    const exp = manager.getExportsIndex().getExportsFromId('x');
    expect(exp).toBeDefined();
    expect(exp.length).toBe(1);
    expect(exp[0].id).toBe('x');
    expect(exp[0].isTypeExport).toBe(false);
    expect(exp[0].type).toBe('VariableDeclaration');
    expect(exp[0].uri).toBe('testFile');
    expect(exp[0].isDefault).toBe(false);
  });
  it('Should index class export', () => {
    const program = 'export class NewClass {};';
    const manager = new ExportManager();
    const ast = babylon.parse(program, babylonOptions);
    manager.addFile('testFile', ast);
    const exp = manager.getExportsIndex().getExportsFromId('NewClass');
    expect(exp).toBeDefined();
    expect(exp.length).toBe(1);
    expect(exp[0].id).toBe('NewClass');
    expect(exp[0].isTypeExport).toBe(false);
    expect(exp[0].type).toBe('ClassDeclaration');
    expect(exp[0].uri).toBe('testFile');
    expect(exp[0].isDefault).toBe(false);
  });
  it('Should index default class export', () => {
    const program = 'export default class NewClass {};';
    const manager = new ExportManager();
    const ast = babylon.parse(program, babylonOptions);
    manager.addFile('testFile', ast);
    const exp = manager.getExportsIndex().getExportsFromId('NewClass');
    expect(exp).toBeDefined();
    expect(exp.length).toBe(1);
    expect(exp[0].id).toBe('NewClass');
    expect(exp[0].isTypeExport).toBe(false);
    expect(exp[0].type).toBe('ClassDeclaration');
    expect(exp[0].uri).toBe('testFile');
    expect(exp[0].isDefault).toBe(true);
  });
  it('Should index function export', () => {
    const program = 'export function myFunc(){return 1;};';
    const manager = new ExportManager();
    const ast = babylon.parse(program, babylonOptions);
    manager.addFile('testFile', ast);
    const exp = manager.getExportsIndex().getExportsFromId('myFunc');
    expect(exp).toBeDefined();
    expect(exp.length).toBe(1);
    expect(exp[0].id).toBe('myFunc');
    expect(exp[0].isTypeExport).toBe(false);
    expect(exp[0].type).toBe('FunctionDeclaration');
    expect(exp[0].uri).toBe('testFile');
    expect(exp[0].isDefault).toBe(false);
  });
  it('Should index default function export', () => {
    const program = 'export default function myFunc(){ return 1;};';
    const manager = new ExportManager();
    const ast = babylon.parse(program, babylonOptions);
    manager.addFile('testFile', ast);
    const exp = manager.getExportsIndex().getExportsFromId('myFunc');
    expect(exp).toBeDefined();
    expect(exp.length).toBe(1);
    expect(exp[0].id).toBe('myFunc');
    expect(exp[0].isTypeExport).toBe(false);
    expect(exp[0].type).toBe('FunctionDeclaration');
    expect(exp[0].uri).toBe('testFile');
    expect(exp[0].isDefault).toBe(true);
  });
  it('Should index variable export', () => {
    const program = 'const x = 3; export {x}; ';
    const manager = new ExportManager();
    const ast = babylon.parse(program, babylonOptions);
    manager.addFile('testFile', ast);
    const exp = manager.getExportsIndex().getExportsFromId('x');
    expect(exp).toBeDefined();
    expect(exp.length).toBe(1);
    expect(exp[0].id).toBe('x');
    expect(exp[0].isTypeExport).toBe(false);
    expect(exp[0].uri).toBe('testFile');
    expect(exp[0].isDefault).toBe(false);
    // NOTE: no type information here right now.
  });
  it('Should index multiple variables export', () => {
    const program = 'const x = 3; const y = 4; export {x, y}; ';
    const manager = new ExportManager();
    const ast = babylon.parse(program, babylonOptions);
    manager.addFile('testFile', ast);
    const expX = manager.getExportsIndex().getExportsFromId('x');
    expect(expX).toBeDefined();
    expect(expX.length).toBe(1);
    expect(expX[0].id).toBe('x');
    expect(expX[0].isTypeExport).toBe(false);
    expect(expX[0].uri).toBe('testFile');
    expect(expX[0].isDefault).toBe(false);

    const expY = manager.getExportsIndex().getExportsFromId('y');
    expect(expY).toBeDefined();
    expect(expY.length).toBe(1);
    expect(expY[0].id).toBe('y');
    expect(expY[0].isTypeExport).toBe(false);
    expect(expY[0].uri).toBe('testFile');
    expect(expY[0].isDefault).toBe(false);
  });
  it('Should index variable default export', () => {
    const program = 'const x = 3; export default x;';
    const manager = new ExportManager();
    const ast = babylon.parse(program, babylonOptions);
    manager.addFile('testFile', ast);
    const exp = manager.getExportsIndex().getExportsFromId('x');
    expect(exp).toBeDefined();
    expect(exp.length).toBe(1);
    expect(exp[0].id).toBe('x');
    expect(exp[0].isTypeExport).toBe(false);
    expect(exp[0].uri).toBe('testFile');
    expect(exp[0].isDefault).toBe(true);
  });
  it('Should index type exports', () => {
    const program =
      "type Foo = 'string'; type Bar = 'number'; export type {Foo, Bar};";
    const ast = babylon.parse(program, babylonOptions);
    const manager = new ExportManager();
    manager.addFile('testFile', ast);
    const expFoo = manager.getExportsIndex().getExportsFromId('Foo');
    expect(expFoo).toBeDefined();
    expect(expFoo.length).toBe(1);
    expect(expFoo[0].id).toBe('Foo');
    expect(expFoo[0].isTypeExport).toBe(true);
    expect(expFoo[0].uri).toBe('testFile');
    expect(expFoo[0].isDefault).toBe(false);

    const expBar = manager.getExportsIndex().getExportsFromId('Bar');
    expect(expBar).toBeDefined();
    expect(expBar.length).toBe(1);
    expect(expBar[0].id).toBe('Bar');
    expect(expBar[0].isTypeExport).toBe(true);
    expect(expBar[0].uri).toBe('testFile');
    expect(expBar[0].isDefault).toBe(false);
  });
  it('Should handle empty export', () => {
    const program = 'export {}';
    const manager = new ExportManager();
    const ast = babylon.parse(program, babylonOptions);
    manager.addFile('testFile', ast);
  });
  it('Should index module.exports with named function', () => {
    const program = 'module.exports = function myFunc(){};';
    const manager = new ExportManager();
    const ast = babylon.parse(program, babylonOptions);
    manager.addFile('testFile', ast);
    const exp = manager.getExportsIndex().getExportsFromId('myFunc');
    expect(exp).toBeDefined();
    expect(exp.length).toBe(1);
    expect(exp[0].id).toBe('myFunc');
    expect(exp[0].isTypeExport).toBe(false);
    expect(exp[0].type).toBe('FunctionExpression');
    expect(exp[0].uri).toBe('testFile');
    expect(exp[0].isDefault).toBe(true);
  });
  it('Should index module.exports with object', () => {
    const program = "module.exports = {foo: 'foo', bar: 'bar'}";
    const manager = new ExportManager();
    const ast = babylon.parse(program, babylonOptions);
    manager.addFile('testFile', ast);
    const exp = manager.getExportsIndex().getExportsFromId('foo');
    expect(exp).toBeDefined();
    expect(exp.length).toBe(1);
    expect(exp[0].id).toBe('foo');
    expect(exp[0].isTypeExport).toBe(false);
    expect(exp[0].type).toBe('ObjectExpression');
    expect(exp[0].uri).toBe('testFile');
    expect(exp[0].isDefault).toBe(false);
  });
  // TODO: actually index the values of the spread.
  it('Should index module.exports with a spread', () => {
    const program =
      "const X = {}; module.exports = {...X, [foo]: 'ignore', foo: 'foo'}";
    const manager = new ExportManager();
    const ast = babylon.parse(program, babylonOptions);
    manager.addFile('testFile', ast);
    const exp = manager.getExportsIndex().getExportsFromId('foo');
    expect(exp).toBeDefined();
  });
  it('Should index module.exports with quoted key', () => {
    const program = "const val = 3; module.exports = {'SOME_KEY':  3,}";
    const manager = new ExportManager();
    const ast = babylon.parse(program, babylonOptions);
    manager.addFile('testFile', ast);
    const exp = manager.getExportsIndex().getExportsFromId('SOME_KEY');
    expect(exp.length).toBe(1);
    expect(exp[0].id).toBe('SOME_KEY');
  });
  it('Should index exports member expressions', () => {
    const program = 'exports.SOME_KEY = 3;';
    const manager = new ExportManager();
    const ast = babylon.parse(program, babylonOptions);
    manager.addFile('testFile', ast);
    const exp = manager.getExportsIndex().getExportsFromId('SOME_KEY');
    expect(exp.length).toBe(1);
    expect(exp[0].id).toBe('SOME_KEY');
    expect(exp[0].type).toBe('NumericLiteral');
  });
  it('Should index module.exports with named class', () => {
    const program = 'exports = class MyClass{};';
    const manager = new ExportManager();
    const ast = babylon.parse(program, babylonOptions);
    manager.addFile('testFile', ast);
    const exp = manager.getExportsIndex().getExportsFromId('MyClass');
    expect(exp).toBeDefined();
    expect(exp.length).toBe(1);
    expect(exp[0].id).toBe('MyClass');
    expect(exp[0].isTypeExport).toBe(false);
    expect(exp[0].type).toBe('ClassExpression');
    expect(exp[0].uri).toBe('testFile');
    expect(exp[0].isDefault).toBe(true);
  });
  it('Should index duplicate symbols in different files', () => {
    const program1 = 'export function Foo(){};';
    const program2 = 'export class Foo{};';
    const manager = new ExportManager();
    const ast1 = babylon.parse(program1, babylonOptions);
    const ast2 = babylon.parse(program2, babylonOptions);
    manager.addFile('file1.js', ast1);
    manager.addFile('file2.js', ast2);
    const exp = manager.getExportsIndex().getExportsFromId('Foo');
    expect(exp).toBeDefined();
    expect(exp.length).toBe(2);
    expect(exp.filter(el => el.uri === 'file1.js').length).toBe(1);
    expect(exp.filter(el => el.uri === 'file2.js').length).toBe(1);
  });
  it('Should clear file when added twice', () => {
    const program = 'export function Foo(){};';
    const manager = new ExportManager();
    let ast = babylon.parse(program, babylonOptions);
    manager.addFile('file1.js', ast);
    let exp = manager.getExportsIndex().getExportsFromId('Foo');
    expect(exp).toBeDefined();
    expect(exp.length).toBe(1);

    const refactoredProgram = 'export function Bar(){};';
    ast = babylon.parse(refactoredProgram, babylonOptions);
    manager.addFile('file1.js', ast);
    exp = manager.getExportsIndex().getExportsFromId('Foo');
    expect(exp).toBeDefined();
    expect(exp.length).toBe(0);
    exp = manager.getExportsIndex().getExportsFromId('Bar');
    expect(exp).toBeDefined();
    expect(exp.length).toBe(1);
  });
  it('Should support export all with name', () => {
    const program = "export * as X from 'foo';";
    const manager = new ExportManager();
    const ast = babylon.parse(program, babylonOptions);
    manager.addFile('testFile.js', ast);
    const exp = manager.getExportsIndex().getExportsFromId('X');
    expect(exp).toBeDefined();
    expect(exp.length).toBe(1);
  });
  it('Exports with same symbol in different files', () => {
    const program1 = 'export const b = 4;';
    const program2 = 'const a = 1; const b = 2; export {a, b}';
    const ast1 = babylon.parse(program1, babylonOptions);
    const ast2 = babylon.parse(program2, babylonOptions);
    const manager = new ExportManager();
    manager.addFile('file1.js', ast1);
    manager.addFile('file2.js', ast2);
    const expA = manager.getExportsIndex().getExportsFromId('a');
    const expB = manager.getExportsIndex().getExportsFromId('b');
    expect(expA).toBeDefined();
    expect(expB).toBeDefined();
    expect(expA.length).toBe(1);
    expect(expB.length).toBe(2);
  });
  it('Should support export default object', () => {
    const program = 'const a =1; const b = 2; export default {a, b}';
    const manager = new ExportManager();
    const ast = babylon.parse(program, babylonOptions);
    manager.addFile('testFile.js', ast);
    const exp = manager.getExportsIndex().getExportsFromId('testFile');
    expect(exp).toBeDefined();
    expect(exp.length).toBe(1);
  });
  it('Should support export default function', () => {
    const program = 'export default function(){}';
    const manager = new ExportManager();
    const ast = babylon.parse(program, babylonOptions);
    manager.addFile('testFile.js', ast);
    const exp = manager.getExportsIndex().getExportsFromId('testFile');
    expect(exp).toBeDefined();
    expect(exp.length).toBe(1);
  });
  it('Should support export default array', () => {
    const program = 'export default [0, 1, 2, 3]';
    const manager = new ExportManager();
    const ast = babylon.parse(program, babylonOptions);
    manager.addFile('some-test-file.js', ast);
    const exp = manager.getExportsIndex().getExportsFromId('someTestFile');
    expect(exp).toBeDefined();
    expect(exp.length).toBe(1);
  });
  it('Should index default unnamed exports with dashes as camelCase', () => {
    const program = 'const a =1; const b = 2; export default {a, b}';
    const manager = new ExportManager();
    const ast = babylon.parse(program, babylonOptions);
    manager.addFile('some-file.js', ast);
    const exp = manager.getExportsIndex().getExportsFromId('someFile');
    expect(exp).toBeDefined();
    expect(exp.length).toBe(1);
  });
  it('Should index module.exports entire object as default', () => {
    const program = 'const a = 1; const b = 2; module.exports = {a, b}';
    const manager = new ExportManager();
    const ast = babylon.parse(program, babylonOptions);
    manager.addFile('SomeFileWithExports.js', ast);
    const exp = manager
      .getExportsIndex()
      .getExportsFromId('SomeFileWithExports');
    expect(exp).toBeDefined();
    expect(exp.length).toBe(1);
  });
  it('Should index module.exports idenfitier default', () => {
    const program = 'const CSS = {}; module.exports = CSS';
    const manager = new ExportManager();
    const ast = babylon.parse(program, babylonOptions);
    manager.addFile('SomeFileWithExports.js', ast);
    const exp = manager.getExportsIndex().getExportsFromId('CSS');
    expect(exp).toBeDefined();
    expect(exp.length).toBe(1);
    expect(exp[0].isDefault).toBe(true);
  });
});
