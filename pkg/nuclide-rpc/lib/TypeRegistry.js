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

import assert from 'assert';
import invariant from 'assert';
import vm from 'vm';
import fs from 'fs';

import type {
  Type,
  ObjectType,
  ObjectField,
  UnionType,
  Location,
  Parameter,
} from './types';
import {
  builtinLocation,
  objectType,
  dateType,
  regExpType,
  bufferType,
  fsStatsType,
} from './builtin-types';
import type {ObjectRegistry} from './ObjectRegistry';
import {locationsEqual, locationToString} from './location';
import type {NamedTransformer, PredefinedTransformer} from './index';

/*
 * This type represents a Transformer function, which takes in a value, and either serializes
 * or deserializes it. Transformer's are added to a registry and indexed by the name of
 * the type they handle (eg: 'Date'). The second argument is the actual type object that represent
 * the value. Parameterized types like Array, or Object can use this to recursively call other
 * transformers.
 *
 * In the interest of a performance, a transformer should only return a Promise if necessary.
 * (Promise objects and Promise.all are very expensive operations in large numbers).
 */
export type Transformer = (
  value: any,
  type: Type,
  context: ObjectRegistry,
) => any | Promise<any>;

// Equivalent to Promise.all, but avoids wrappers if nothing is actually a promise.
// Input must be homogenously typed.
function smartPromiseAll<T>(arr: Array<T>): Array<T> | Promise<Array<T>> {
  if (arr.length === 0 || !(arr[0] instanceof Promise)) {
    return arr;
  }
  return Promise.all(arr);
}

// Same as the above, but works for non-homogenous input.
function checkedSmartPromiseAll(
  arr: Array<any>,
): Array<any> | Promise<Array<any>> {
  for (const elem of arr) {
    if (elem instanceof Promise) {
      return Promise.all(arr);
    }
  }
  return arr;
}

function canBeUndefined(type: Type): boolean {
  return (
    type.kind === 'nullable' || type.kind === 'mixed' || type.kind === 'any'
  );
}

function statsToObject(stats: fs.Stats): Object {
  const result = {
    dev: stats.dev,
    mode: stats.mode,
    nlink: stats.nlink,
    uid: stats.uid,
    gid: stats.gid,
    rdev: stats.rdev,
    blksize: stats.blksize,
    ino: stats.ino,
    size: stats.size,
    blocks: stats.blocks,
    atime: stats.atime.toJSON(),
    mtime: stats.mtime.toJSON(),
    ctime: stats.ctime.toJSON(),
  };

  if (stats.birthtime instanceof Date) {
    return {...result, birthtime: stats.birthtime.toJSON()};
  }

  return result;
}

function objectToStats(jsonStats: Object): fs.Stats {
  const stats = new fs.Stats();

  stats.dev = jsonStats.dev;
  stats.mode = jsonStats.mode;
  stats.nlink = jsonStats.nlink;
  stats.uid = jsonStats.uid;
  stats.gid = jsonStats.gid;
  stats.rdev = jsonStats.rdev;
  stats.blksize = jsonStats.blksize;
  stats.ino = jsonStats.ino;
  stats.size = jsonStats.size;
  stats.blocks = jsonStats.blocks;
  stats.atime = new Date(jsonStats.atime);
  stats.mtime = new Date(jsonStats.mtime);
  stats.ctime = new Date(jsonStats.ctime);

  if (jsonStats.birthtime) {
    stats.birthtime = new Date(jsonStats.birthtime);
  }

  return stats;
}

/*
 * The TypeRegistry is a centralized place to register functions that serialize and deserialize
 * types. This allows for types defined in one service to include types from another service in
 * another file. It also allows the ability to add new primitives, ranging from Buffer to NuclideUri
 * that are not handled at the transport layer. The key concept is that marshalling functions can
 * be recursive, calling other marshalling functions, ending at the primitives.
 *
 * The ObjectRegistry is opaque to the TypeRegistry and allows for adding per-connection
 * context to marshalling transformations.
 */
export class TypeRegistry {
  /** Store marshallers and and unmarshallers, index by the kind of the type. */
  _kindMarshallers: Map<
    string,
    {
      marshaller: Transformer,
      unmarshaller: Transformer,
    },
  >;

  /** Store marshallers and and unmarshallers, index by the name of the type. */
  _namedMarshallers: Map<
    string,
    {
      location: Location,
      marshaller: NamedTransformer,
      unmarshaller: NamedTransformer,
    },
  >;

  constructor(predefinedTypes: Array<PredefinedTransformer>) {
    this._kindMarshallers = new Map();
    this._namedMarshallers = new Map();

    this._registerPrimitives();
    this._registerSpecialTypes();
    this._registerContainers();
    this._registerLiterals();
    this._registerUnions();
    this._registerIntersections();

    // Register NullableType and NamedType
    this._registerKind(
      'nullable',
      (value: any, type: Type, context: ObjectRegistry) => {
        invariant(type.kind === 'nullable');
        if (value === null || value === undefined) {
          return value;
        }
        return this._marshal(context, value, type.type);
      },
      (value: any, type: Type, context: ObjectRegistry) => {
        invariant(type.kind === 'nullable');
        if (value === null || value === undefined) {
          return value;
        }
        return this._unmarshal(context, value, type.type);
      },
    );

    this._registerKind(
      'named',
      (value: any, type: Type, context: ObjectRegistry) => {
        invariant(type.kind === 'named');
        const namedMarshaller = this._namedMarshallers.get(type.name);
        if (namedMarshaller == null) {
          throw new Error(`No marshaller found for named type ${type.name}.`);
        }
        return namedMarshaller.marshaller(value, context);
      },
      (value: any, type: Type, context: ObjectRegistry) => {
        invariant(type.kind === 'named');
        const namedMarshaller = this._namedMarshallers.get(type.name);
        if (namedMarshaller == null) {
          throw new Error(`No marshaller found for named type ${type.name}.`);
        }
        return namedMarshaller.unmarshaller(value, context);
      },
    );

    this._registerKind(
      'void',
      (value, type, context) => Promise.resolve(null),
      (value, type, context) => Promise.resolve(null),
    );

    predefinedTypes.forEach(type => {
      this.registerPredefinedType(
        type.typeName,
        type.marshaller,
        type.unmarshaller,
      );
    });
  }

  _registerKind(
    kind: string,
    marshaller: Transformer,
    unmarshaller: Transformer,
  ): void {
    invariant(!this._kindMarshallers.has(kind));
    this._kindMarshallers.set(kind, {
      marshaller: makeKindMarshaller(kind, marshaller),
      unmarshaller: makeKindMarshaller(kind, unmarshaller),
    });
  }

  registerPredefinedType(
    typeName: string,
    marshaller: NamedTransformer,
    unmarshaller: NamedTransformer,
  ): void {
    this.registerType(typeName, builtinLocation, marshaller, unmarshaller);
  }

  /**
   * Register a type by providing both a marshaller and an unmarshaller. The marshaller
   * will be called to transform the type before sending it out onto the network, while the
   * unmarshaller will be called on values incoming from the network.
   * @param typeName - The string name of the type that the provided marshallers convert.
   * @param marshaller - Serialize the type.
   * @param unmarshaller - Deserialize the type.
   */
  registerType(
    typeName: string,
    location: Location,
    marshaller: NamedTransformer,
    unmarshaller: NamedTransformer,
  ): void {
    const existingMarshaller = this._namedMarshallers.get(typeName);
    if (existingMarshaller != null) {
      // If the locations are equal then assume that the types are equal.
      if (!locationsEqual(existingMarshaller.location, location)) {
        throw new Error(
          `${locationToString(
            location,
          )}: A type by the name ${typeName} has already` +
            ` been registered at ${locationToString(
              existingMarshaller.location,
            )}.`,
        );
      }
    } else {
      this._namedMarshallers.set(typeName, {
        location,
        marshaller: makeNamedMarshaller(typeName, marshaller),
        unmarshaller: makeNamedMarshaller(typeName, unmarshaller),
      });
    }
  }

  /**
   * Helper function for registering the marashaller/unmarshaller for a type alias.
   * @param name - The name of the alias type.
   * @param type - The type the the alias represents.
   */
  registerAlias(name: string, location: Location, type: Type): void {
    this.registerType(
      name,
      location,
      (value, context) => this._marshal(context, value, type),
      (value, context) => this._unmarshal(context, value, type),
    );
  }

  /**
   * Marshal an object using the appropriate marshal function.
   * Ensures the result is actually a Promise.
   * @param value - The value to be marshalled.
   * @param type - The type object (used to find the appropriate function).
   */
  marshal(context: ObjectRegistry, value: any, type: Type): Promise<any> {
    return Promise.resolve(this._marshal(context, value, type));
  }

  _marshal(context: ObjectRegistry, value: any, type: Type): any {
    const kindMarshaller = this._kindMarshallers.get(type.kind);
    if (kindMarshaller == null) {
      throw new Error(`No marshaller found for type kind ${type.kind}.`);
    }
    return kindMarshaller.marshaller(value, type, context);
  }

  async marshalArguments(
    context: ObjectRegistry,
    args: Array<any>,
    argTypes: Array<Parameter>,
  ): Promise<Object> {
    const marshalledargs = await Promise.all(
      argTypes.map((param, i) => this.marshal(context, args[i], param.type)),
    );
    const result = {};
    marshalledargs.forEach((arg, i) => {
      invariant(typeof argTypes[i].name === 'string');
      result[argTypes[i].name] = arg;
    });
    return result;
  }

  /**
   * Unmarshal and object using the appropriate unmarshal function.
   * Ensures the result is actually a Promise.
   * @param value - The value to be marshalled.
   * @param type - The type object (used to find the appropriate function).
   */
  unmarshal(context: ObjectRegistry, value: any, type: Type): Promise<any> {
    return Promise.resolve(this._unmarshal(context, value, type));
  }

  unmarshalArguments(
    context: ObjectRegistry,
    args: Object,
    argTypes: Array<Parameter>,
  ): Promise<Array<any>> {
    return Promise.all(
      argTypes.map((arg, i) => {
        invariant(
          Object.hasOwnProperty.call(args, arg.name) ||
            canBeUndefined(arg.type),
          `unmarshalArguments: Missing argument: ${arg.name}`,
        );
        return this.unmarshal(context, args[arg.name], arg.type);
      }),
    );
  }

  _unmarshal(context: ObjectRegistry, value: any, type: Type): any {
    const kindMarshaller = this._kindMarshallers.get(type.kind);
    if (kindMarshaller == null) {
      throw new Error(`No unmarshaller found for type kind ${type.kind}.`);
    }
    return kindMarshaller.unmarshaller(value, type, context);
  }

  _registerPrimitives(): void {
    // Since string, number, and boolean are JSON primitives,
    // they require no marshalling. Instead, simply create wrapped transformers
    // that assert the type of their argument.
    const stringTransformer = arg_ => {
      let arg = arg_;
      // Unbox argument.
      arg = arg instanceof String ? arg.valueOf() : arg;
      assert(typeof arg === 'string', 'Expected a string argument');
      return arg;
    };
    const numberMarshaller = arg_ => {
      let arg = arg_;
      // Unbox argument.
      if (arg instanceof Number) {
        arg = arg.valueOf();
      }
      assert(typeof arg === 'number', 'Expected a number argument');
      if (!Number.isFinite(arg)) {
        if (arg === Number.NEGATIVE_INFINITY) {
          arg = 'NEGATIVE_INFINITY';
        } else if (arg === Number.POSITIVE_INFINITY) {
          arg = 'POSITIVE_INFINITY';
        } else {
          arg = 'NaN';
        }
      }
      return arg;
    };
    const numberUnmarshaller = arg_ => {
      let arg = arg_;
      if (typeof arg === 'string') {
        switch (arg) {
          case 'NEGATIVE_INFINITY':
            arg = Number.NEGATIVE_INFINITY;
            break;
          case 'POSITIVE_INFINITY':
            arg = Number.POSITIVE_INFINITY;
            break;
          case 'NaN':
            arg = Number.NaN;
            break;
          default:
            // This will assert below
            break;
        }
      } else if (arg instanceof Number) {
        arg = arg.valueOf();
      }
      assert(typeof arg === 'number', 'Expected a number argument');
      return arg;
    };
    const booleanTransformer = arg_ => {
      let arg = arg_;
      // Unbox argument
      if (arg instanceof Boolean) {
        arg = arg.valueOf();
      }
      assert(typeof arg === 'boolean', 'Expected a boolean argument');
      return arg;
    };
    // We assume an 'any' and 'mixed' types require no marshalling.
    const identityTransformer = arg => arg;

    // Register these transformers
    this._registerKind('string', stringTransformer, stringTransformer);
    this._registerKind('number', numberMarshaller, numberUnmarshaller);
    this._registerKind('boolean', booleanTransformer, booleanTransformer);
    this._registerKind('any', identityTransformer, identityTransformer);
    this._registerKind('mixed', identityTransformer, identityTransformer);
  }

  _registerLiterals(): void {
    const literalTransformer = (arg, type) => {
      invariant(
        type.kind === 'string-literal' ||
          type.kind === 'number-literal' ||
          type.kind === 'boolean-literal',
      );
      invariant(arg === type.value);
      return arg;
    };
    this._registerKind(
      'string-literal',
      literalTransformer,
      literalTransformer,
    );
    this._registerKind(
      'number-literal',
      literalTransformer,
      literalTransformer,
    );
    this._registerKind(
      'boolean-literal',
      literalTransformer,
      literalTransformer,
    );
  }

  _registerUnions(): void {
    const unionLiteralTransformer = (arg, type) => {
      invariant(type.kind === 'union');
      const alternate = type.types.find(element => {
        invariant(
          element.kind === 'string-literal' ||
            element.kind === 'number-literal' ||
            element.kind === 'boolean-literal',
        );
        return arg === element.value;
      });
      invariant(alternate);
      // This is just the literal transformer inlined ...
      return arg;
    };
    const unionObjectMarshaller = (arg, type, context) => {
      invariant(type.kind === 'union');
      return this._marshal(context, arg, findAlternate(arg, type));
    };
    const unionObjectUnmarshaller = (arg, type, context) => {
      invariant(type.kind === 'union');
      return this._unmarshal(context, arg, findAlternate(arg, type));
    };
    const unionMarshaller = (arg, type, context) => {
      invariant(type.kind === 'union');
      if (type.discriminantField != null) {
        return unionObjectMarshaller(arg, type, context);
      } else {
        return unionLiteralTransformer(arg, type);
      }
    };
    const unionUnmarshaller = (arg, type, context) => {
      invariant(type.kind === 'union');
      if (type.discriminantField != null) {
        return unionObjectUnmarshaller(arg, type, context);
      } else {
        return unionLiteralTransformer(arg, type);
      }
    };
    this._registerKind('union', unionMarshaller, unionUnmarshaller);
  }

  _registerIntersections(): void {
    const intersectionMarshaller = (arg, type, context) => {
      invariant(type.kind === 'intersection');
      invariant(type.flattened != null);
      return this._marshal(context, arg, type.flattened);
    };
    const intersectionUnmarshaller = (arg, type, context) => {
      invariant(type.kind === 'intersection');
      invariant(type.flattened != null);
      return this._unmarshal(context, arg, type.flattened);
    };
    this._registerKind(
      'intersection',
      intersectionMarshaller,
      intersectionUnmarshaller,
    );
  }

  _registerSpecialTypes(): void {
    // Serialize / Deserialize any Object type
    this.registerType(
      objectType.name,
      builtinLocation,
      object => {
        assert(
          object != null && typeof object === 'object',
          'Expected Object argument.',
        );
        return object;
      },
      object => {
        assert(
          object != null && typeof object === 'object',
          'Expected Object argument.',
        );
        return object;
      },
    );

    // Serialize / Deserialize Javascript Date objects
    this.registerType(
      dateType.name,
      builtinLocation,
      date => {
        assert(date instanceof Date, 'Expected date argument.');
        return date.toJSON();
      },
      dateStr_ => {
        let dateStr = dateStr_;
        // Unbox argument.
        dateStr = dateStr instanceof String ? dateStr.valueOf() : dateStr;

        assert(typeof dateStr === 'string', 'Expeceted a string argument.');
        return new Date(dateStr);
      },
    );

    // Serialize / Deserialize RegExp objects
    this.registerType(
      regExpType.name,
      builtinLocation,
      regexp => {
        assert(
          regexp instanceof RegExp,
          'Expected a RegExp object as an argument',
        );
        return regexp.toString();
      },
      regStr_ => {
        let regStr = regStr_;
        // Unbox argument.
        regStr = regStr instanceof String ? regStr.valueOf() : regStr;

        assert(typeof regStr === 'string', 'Expected a string argument.');
        return vm.runInThisContext(regStr);
      },
    );

    // Serialize / Deserialize Buffer objects through Base64 strings
    this.registerType(
      bufferType.name,
      builtinLocation,
      buffer => {
        assert(buffer instanceof Buffer, 'Expected a buffer argument.');
        return buffer.toString('base64');
      },
      base64string_ => {
        let base64string = base64string_;
        // Unbox argument.
        base64string =
          base64string instanceof String
            ? base64string.valueOf()
            : base64string;

        assert(
          typeof base64string === 'string',
          `Expected a base64 string. Not ${typeof base64string}`,
        );
        return new Buffer(base64string, 'base64');
      },
    );

    // fs.Stats
    this.registerType(
      fsStatsType.name,
      builtinLocation,
      stats => {
        assert(stats instanceof fs.Stats);
        return JSON.stringify(statsToObject(stats));
      },
      json => {
        assert(typeof json === 'string');
        return objectToStats(JSON.parse(json));
      },
    );
  }

  _registerContainers(): void {
    // Serialize / Deserialize Arrays.
    this._registerKind(
      'array',
      (value: any, type: Type, context: ObjectRegistry) => {
        assert(value instanceof Array, 'Expected an object of type Array.');
        invariant(type.kind === 'array');
        const elemType = type.type;
        return smartPromiseAll(
          value.map(elem => this._marshal(context, elem, elemType)),
        );
      },
      (value: any, type: Type, context: ObjectRegistry) => {
        assert(value instanceof Array, 'Expected an object of type Array.');
        invariant(type.kind === 'array');
        const elemType = type.type;
        return smartPromiseAll(
          value.map(elem => this._unmarshal(context, elem, elemType)),
        );
      },
    );

    // Serialize and Deserialize Objects.
    this._registerKind(
      'object',
      (obj: any, type: Type, context: ObjectRegistry) => {
        assert(typeof obj === 'object', 'Expected an argument of type object.');
        invariant(type.kind === 'object');
        const newObj = {}; // Create a new object so we don't mutate the original one.
        const promise = checkedSmartPromiseAll(
          type.fields.map(prop => {
            const name = prop.name;
            const originalValue = obj[name];
            const annotateErrorAndThrow = e => {
              addMarshallingContextToError(`Field: ${name}`, originalValue, e);
              throw e;
            };
            // Check if the source object has this key.
            if (obj != null && obj.hasOwnProperty(name)) {
              try {
                let value;
                // Optional props can be explicitly set to `undefined`
                if (originalValue === undefined && prop.optional) {
                  value = undefined;
                } else {
                  value = this._marshal(context, originalValue, prop.type);
                }
                if (value instanceof Promise) {
                  return value.then(
                    result => (newObj[name] = result),
                    annotateErrorAndThrow,
                  );
                } else {
                  newObj[name] = value;
                }
              } catch (e) {
                annotateErrorAndThrow(e);
              }
            } else if (!prop.optional) {
              // If the property is optional, it's okay for it to be missing.
              throw new Error(
                `Source object: ${JSON.stringify(
                  obj,
                )} is missing property ${prop.name}.`,
              );
            }
          }),
        );
        if (promise instanceof Promise) {
          return promise.then(() => newObj);
        }
        return newObj;
      },
      (obj: any, type: Type, context: ObjectRegistry) => {
        assert(typeof obj === 'object', 'Expected an argument of type object.');
        invariant(type.kind === 'object');
        const newObj = {}; // Create a new object so we don't mutate the original one.
        const promise = checkedSmartPromiseAll(
          type.fields.map(prop => {
            // Check if the source object has this key.
            if (obj != null && obj.hasOwnProperty(prop.name)) {
              const name = prop.name;
              const originalValue = obj[name];
              const annotateErrorAndThrow = e => {
                addMarshallingContextToError(
                  `Field: ${name}`,
                  originalValue,
                  e,
                );
                throw e;
              };
              try {
                const value = this._unmarshal(
                  context,
                  originalValue,
                  prop.type,
                );
                if (value instanceof Promise) {
                  return value.then(
                    result => (newObj[name] = result),
                    annotateErrorAndThrow,
                  );
                } else {
                  newObj[name] = value;
                }
              } catch (e) {
                annotateErrorAndThrow(e);
              }
            } else if (!prop.optional && !canBeUndefined(prop.type)) {
              // If the property is optional, it's okay for it to be missing.
              // JSON omits undefined values, so they can also be missing.
              throw new Error(
                `Source object: ${JSON.stringify(
                  obj,
                )} is missing property ${prop.name}.`,
              );
            }
          }),
        );
        if (promise instanceof Promise) {
          return promise.then(() => newObj);
        }
        return newObj;
      },
    );

    // Serialize / Deserialize Sets.
    this._registerKind(
      'set',
      (value: any, type: Type, context: ObjectRegistry) => {
        invariant(type.kind === 'set');
        assert(value instanceof Set, 'Expected an object of type Set.');
        const serializePromises = [];
        for (const elem of value) {
          serializePromises.push(this._marshal(context, elem, type.type));
        }
        return smartPromiseAll(serializePromises);
      },
      (value: any, type: Type, context: ObjectRegistry) => {
        assert(value instanceof Array, 'Expected an object of type Array.');
        invariant(type.kind === 'set');
        const elemType = type.type;
        const elements = smartPromiseAll(
          value.map(elem => this._unmarshal(context, elem, elemType)),
        );
        if (elements instanceof Promise) {
          return elements.then(x => new Set(x));
        }
        return new Set(elements);
      },
    );

    // Serialize / Deserialize Maps.
    this._registerKind(
      'map',
      (map: Map<any, any>, type: Type, context: ObjectRegistry) => {
        assert(map instanceof Map, 'Expected an object of type Set.');
        invariant(type.kind === 'map');
        const serializePromises = [];
        for (const [key, value] of map) {
          serializePromises.push(
            checkedSmartPromiseAll([
              this._marshal(context, key, type.keyType),
              this._marshal(context, value, type.valueType),
            ]),
          );
        }
        return smartPromiseAll(serializePromises);
      },
      (serialized: any, type: Type, context: ObjectRegistry) => {
        assert(
          serialized instanceof Array,
          'Expected an object of type Array.',
        );
        invariant(type.kind === 'map');
        const keyType = type.keyType;
        const valueType = type.valueType;
        const entries = smartPromiseAll(
          serialized.map(entry =>
            checkedSmartPromiseAll([
              this._unmarshal(context, entry[0], keyType),
              this._unmarshal(context, entry[1], valueType),
            ]),
          ),
        );
        if (entries instanceof Promise) {
          return entries.then(x => new Map(x));
        }
        return new Map(entries);
      },
    );

    // Serialize / Deserialize Tuples.
    this._registerKind(
      'tuple',
      (value: any, type: Type, context: ObjectRegistry) => {
        // Assert the length of the array.
        assert(Array.isArray(value), 'Expected an object of type Array.');
        invariant(type.kind === 'tuple');
        const types = type.types;
        assert(
          value.length === types.length,
          `Expected tuple of length ${types.length}.`,
        );

        // Convert all of the elements through the correct marshaller.
        return checkedSmartPromiseAll(
          value.map((elem, i) => this._marshal(context, elem, types[i])),
        );
      },
      (value: any, type: Type, context: ObjectRegistry) => {
        // Assert the length of the array.
        assert(Array.isArray(value), 'Expected an object of type Array.');
        invariant(type.kind === 'tuple');
        const types = type.types;
        assert(
          value.length === types.length,
          `Expected tuple of length ${types.length}.`,
        );

        // Convert all of the elements through the correct unmarshaller.
        return checkedSmartPromiseAll(
          value.map((elem, i) => this._unmarshal(context, elem, types[i])),
        );
      },
    );
  }
}

function getObjectFieldByName(
  type: ObjectType,
  fieldName: string,
): ObjectField {
  const result = type.fields.find(field => field.name === fieldName);
  invariant(result != null);
  return result;
}

function findAlternate(arg: Object, type: UnionType): ObjectType {
  const discriminantField = type.discriminantField;
  invariant(discriminantField != null);
  const discriminant = arg[discriminantField];
  invariant(discriminant != null);
  const alternates: Array<ObjectType> = (type.types: any);
  const result = alternates.find(alternate => {
    invariant(alternate.kind === 'object');
    const alternateType = getObjectFieldByName(alternate, discriminantField)
      .type;
    invariant(
      alternateType.kind === 'string-literal' ||
        alternateType.kind === 'number-literal' ||
        alternateType.kind === 'boolean-literal',
    );
    return alternateType.value === discriminant;
  });
  invariant(result != null);
  return result;
}

function valueToString(value: any): string {
  try {
    return JSON.stringify(value);
  } catch (e) {
    return String(value);
  }
}

function addMarshallingContextToError(
  message: string,
  value: any,
  e: Error,
): void {
  if (e.hasMarshallingError == null) {
    (e: any).hasMarshallingError = true;
    e.message += `\nError marshalling value: '${valueToString(value)}'\n`;
  }
  e.message += `${message}\n`;
}

function makeKindMarshaller(
  kind: string,
  transformer: Transformer,
): Transformer {
  return (value: any, type: Type, context: ObjectRegistry) => {
    try {
      return transformer(value, type, context);
    } catch (e) {
      addMarshallingContextToError(kind, value, e);
      throw e;
    }
  };
}

function makeNamedMarshaller(
  typeName: string,
  transformer: NamedTransformer,
): NamedTransformer {
  return (value: any, context: ObjectRegistry) => {
    try {
      return transformer(value, context);
    } catch (e) {
      addMarshallingContextToError(typeName, value, e);
      throw e;
    }
  };
}
