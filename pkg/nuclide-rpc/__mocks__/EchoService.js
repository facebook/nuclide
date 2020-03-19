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

import type {NuclideUri} from 'nuclide-commons/nuclideUri';

import assert from 'assert';

// Basic Primitives.
export async function echoAny(arg: any): Promise<any> {
  return arg;
}
export async function echoString(arg: string): Promise<string> {
  assert(
    typeof arg === 'string',
    `Argument to echoString must be a string, not ${typeof arg}.`,
  );
  return arg;
}
export async function echoNumber(arg: number): Promise<number> {
  assert(
    typeof arg === 'number',
    `Argument to echoNumber must be a number, not ${typeof arg}.`,
  );
  return arg;
}
export async function echoBoolean(arg: boolean): Promise<boolean> {
  assert(
    typeof arg === 'boolean',
    `Argument to echoBoolean must be a boolean, not ${typeof arg}.`,
  );
  return arg;
}
export async function echoDefaultNumber(arg: number = 1): Promise<number> {
  return arg;
}
export async function echoVoid(arg: void): Promise<void> {
  assert(arg === undefined, 'Argument to echoVoid must be undefined');
  return arg;
}

// More Complex Objects.
export async function echoDate(arg: Date): Promise<Date> {
  assert(arg instanceof Date, 'Argument to echoDate must be a Date.');
  return arg;
}
export async function echoRegExp(arg: RegExp): Promise<RegExp> {
  assert(
    arg instanceof RegExp,
    // $FlowFixMe
    `Argument to echoRegExp must be a RegExp. Not ${arg.constructor}`,
  );
  return arg;
}
export async function echoBuffer(arg: Buffer): Promise<Buffer> {
  assert(
    arg instanceof Buffer,
    // $FlowFixMe
    `Argument to echoBuffer must be a Buffer. Not ${arg.constructor}`,
  );
  return arg;
}

// Parameterized types.
export async function echoArrayOfArrayOfDate(
  arg: Array<Array<Date>>,
): Promise<Array<Array<Date>>> {
  return arg;
}
export async function echoObject(arg: {
  a: ?string,
  b: Buffer,
  c?: string,
}): Promise<{a: ?string, b: Buffer, c?: string}> {
  return arg;
}
export async function echoSet(arg: Set<string>): Promise<Set<string>> {
  return arg;
}
export async function echoMap(
  arg: Map<string, Date>,
): Promise<Map<string, Date>> {
  return arg;
}
export async function echoTuple(
  arg: [number, string],
): Promise<[number, string]> {
  return arg;
}

// Value Type
export type BufferAlias = Buffer;
export type ValueTypeA = {
  a: Date,
  b: BufferAlias,
  c?: number, // Note that as of 5.8.14, there is a bug with parsing optional props in Babel.
};
export async function echoValueType(arg: ValueTypeA): Promise<ValueTypeA> {
  return arg;
}

// NuclideUri
export async function echoNuclideUri(arg: NuclideUri): Promise<NuclideUri> {
  return arg;
}

// Remotable object
export class RemotableObject {
  dispose(): void {}
}
export async function echoRemotableObject(
  arg: RemotableObject,
): Promise<RemotableObject> {
  return arg;
}
