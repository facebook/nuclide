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

export type ReturnType = 'promise' | 'observable' | 'void';

/**
 * `Definitions` encodes all of the information in a service defintion file that is required to
 * generate a remote proxy.
 */
export type Definitions = {[name: string]: Definition};

export type Definition =
  | FunctionDefinition
  | InterfaceDefinition
  | AliasDefinition;

// A top level function.
export type FunctionDefinition = {
  kind: 'function',
  name: string,
  location: Location,
  type: FunctionType,
};

export type Parameter = {
  name: string,
  type: Type,
};

// An interface class.
export type InterfaceDefinition = {
  kind: 'interface',
  name: string,
  location: Location,
  constructorArgs: ?Array<Parameter>,
  instanceMethods: {[name: string]: FunctionType},
  staticMethods: {[name: string]: FunctionType},
};

// A type alias.
export type AliasDefinition = {
  kind: 'alias',
  name: string,
  location: Location,
  definition?: Type,
};

export type Type =
  | NullableType
  | MixedType
  | AnyType
  | StringType
  | BooleanType
  | NumberType // Primitive types.
  | ObjectType
  | ArrayType
  | MapType
  | SetType
  | TupleType // Container types.
  | VoidType
  | PromiseType
  | ObservableType // Return types.
  | StringLiteralType
  | NumberLiteralType
  | BooleanLiteralType // Literal types.
  | NamedType
  | FunctionType
  | UnionType
  | IntersectionType; // Type aliases.

// Nullable type.
export type NullableType = {kind: 'nullable', type: Type};

// Functions.
export type FunctionType = {
  kind: 'function',
  // Preserve locations for function types, since methods don't have definitions.
  location: Location,
  argumentTypes: Array<Parameter>,
  returnType: Type,
};

// Primitive types.
export type AnyType = {kind: 'any'};
export type MixedType = {kind: 'mixed'};
export type StringType = {kind: 'string'};
export type BooleanType = {kind: 'boolean'};
export type NumberType = {kind: 'number'};

// Literal types.
export type LiteralType =
  | StringLiteralType
  | NumberLiteralType
  | BooleanLiteralType;
export type StringLiteralType = {
  kind: 'string-literal',
  value: string,
};
export type NumberLiteralType = {
  kind: 'number-literal',
  value: number,
};
export type BooleanLiteralType = {
  kind: 'boolean-literal',
  value: boolean,
};

// Possible Return formats.
export type VoidType = {kind: 'void'};
export type PromiseType = {kind: 'promise', type: Type};
export type ObservableType = {
  kind: 'observable',
  type: Type,
};

// Container Types.
export type ArrayType = {kind: 'array', type: Type};
export type SetType = {kind: 'set', type: Type};
export type MapType = {
  kind: 'map',
  keyType: Type,
  valueType: Type,
};
export type ObjectType = {
  kind: 'object',
  fields: Array<ObjectField>,
};
export type ObjectField = {
  name: string,
  type: Type,
  optional: boolean,
};
export type TupleType = {kind: 'tuple', types: Array<Type>};

export type UnionType = {
  kind: 'union',
  types: Array<Type>,
  discriminantField?: string, // This is filled in for unions of object types during validation.
};

export type IntersectionType = {
  kind: 'intersection',
  types: Array<Type>,
  // Filled in during validation -- this is the flattened object type containing all of the relevant
  // fields.
  flattened?: ObjectType,
};

// Represents a named, custom type.
export type NamedType = {kind: 'named', name: string};

export type Location = SourceLocation | BuiltinLocation;

export type SourceLocation = {
  type: 'source',
  fileName: string,
  line: number,
};

export type BuiltinLocation = {
  type: 'builtin',
};

export type ReturnKind = 'promise' | 'observable' | 'void';

// Babel Definitions
// TODO: Move these to external-interfaces package.

export type Babel$Node = {
  loc: Babel$Range,
};

export type Babel$Range = {
  start: Babel$Location,
  end: Babel$Location,
};

export type Babel$Location = {
  line: number,
};
