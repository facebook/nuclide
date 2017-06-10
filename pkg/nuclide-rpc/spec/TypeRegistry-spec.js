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

import {TypeRegistry} from '../lib/TypeRegistry';
import invariant from 'assert';

import type {
  NamedType,
  ArrayType,
  ObjectType,
  NullableType,
  BooleanType,
  UnionType,
  IntersectionType,
} from '../lib/types';

import {
  builtinLocation,
  numberType,
  stringType,
  booleanType,
  dateType,
  regExpType,
  bufferType,
  anyType,
  mixedType,
  objectType,
} from '../lib/builtin-types';
import type {ObjectRegistry} from '../lib/ObjectRegistry';

describe('TypeRegistry', () => {
  let typeRegistry: TypeRegistry = (null: any);
  let context: ObjectRegistry = (null: any);
  beforeEach(() => {
    typeRegistry = new TypeRegistry([]);
    context = ({}: any);
  });

  it('Can serialize / deserialize basic primitive types', () => {
    waitsForPromise(async () => {
      invariant(typeRegistry);

      const expected1 = 'Hello World';
      const str1 = await typeRegistry.unmarshal(
        context,
        await typeRegistry.marshal(context, expected1, stringType),
        stringType,
      );
      expect(str1).toBe(expected1);

      const expected2 = 312213;
      const num2 = await typeRegistry.unmarshal(
        context,
        await typeRegistry.marshal(context, expected2, numberType),
        numberType,
      );
      expect(num2).toBe(expected2);

      const expected3 = false;
      const bool3 = await typeRegistry.unmarshal(
        context,
        await typeRegistry.marshal(context, expected3, booleanType),
        booleanType,
      );
      expect(bool3).toBe(expected3);

      const expected4 = false;
      const bool4 = await typeRegistry.unmarshal(
        context,
        await typeRegistry.marshal(context, expected4, anyType),
        anyType,
      );
      expect(bool4).toBe(expected4);

      const expected5 = 42;
      const num5 = await typeRegistry.unmarshal(
        context,
        await typeRegistry.marshal(context, expected5, mixedType),
        mixedType,
      );
      expect(num5).toBe(expected5);

      const expected6 = Number.NEGATIVE_INFINITY;
      const num6 = await typeRegistry.unmarshal(
        context,
        await typeRegistry.marshal(context, expected6, numberType),
        numberType,
      );
      expect(num6).toBe(expected6);

      const expected7 = Number.POSITIVE_INFINITY;
      const num7 = await typeRegistry.unmarshal(
        context,
        await typeRegistry.marshal(context, expected7, numberType),
        numberType,
      );
      expect(num7).toBe(expected7);

      const expected8 = Number.POSITIVE_INFINITY;
      const num8 = await typeRegistry.unmarshal(
        context,
        await typeRegistry.marshal(context, expected8, numberType),
        numberType,
      );
      expect(num8).toBe(expected8);

      // Marshalling an unexpected value throws.
      let thrown = false;
      try {
        await typeRegistry.marshal(context, null, numberType);
      } catch (e) {
        thrown = true;
      }
      expect(thrown).toBe(true);
    });
  });

  it('Can serialize / deserialize literal types', () => {
    waitsForPromise(async () => {
      const stringLiteralType = {
        location: builtinLocation,
        kind: 'string-literal',
        value: 'Hello World',
      };
      invariant(typeRegistry);

      const expected1 = 'Hello World';
      const str1 = await typeRegistry.unmarshal(
        context,
        await typeRegistry.marshal(context, expected1, stringLiteralType),
        stringLiteralType,
      );
      expect(str1).toBe(expected1);

      const numberLiteralType = {
        location: builtinLocation,
        kind: 'number-literal',
        value: 312213,
      };
      const expected2 = 312213;
      const num2 = await typeRegistry.unmarshal(
        context,
        await typeRegistry.marshal(context, expected2, numberLiteralType),
        numberLiteralType,
      );
      expect(num2).toBe(expected2);

      const falseLiteralType: BooleanType = {
        location: builtinLocation,
        kind: 'boolean',
        value: false,
      };
      const expected3 = false;
      const bool3 = await typeRegistry.unmarshal(
        context,
        await typeRegistry.marshal(context, expected3, falseLiteralType),
        falseLiteralType,
      );
      expect(bool3).toBe(expected3);

      // Marshalling an unexpected value throws.
      let thrown = false;
      try {
        await typeRegistry.marshal(context, 42, falseLiteralType);
      } catch (e) {
        thrown = true;
      }
      expect(thrown).toBe(true);
    });
  });

  it('Can serialize / deserialize complex types like Date, Regex and Buffer', () => {
    waitsForPromise(async () => {
      invariant(typeRegistry);

      const expected1 = {a: 42, b: {c: 'str'}};
      const object1 = await typeRegistry.unmarshal(
        context,
        await typeRegistry.marshal(context, expected1, objectType),
        objectType,
      );
      expect(object1).toBe(expected1);

      const expected2 = new Date();
      const date2 = await typeRegistry.unmarshal(
        context,
        await typeRegistry.marshal(context, expected2, dateType),
        dateType,
      );
      expect(date2.getTime()).toBe(expected2.getTime());

      const expected3 = /nuclide/gi;
      const regex3 = await typeRegistry.unmarshal(
        context,
        await typeRegistry.marshal(context, expected3, regExpType),
        regExpType,
      );
      expect(regex3.source).toBe(expected3.source);

      const expected4 = new Buffer('test buffer data.');
      const buf4: Buffer = await typeRegistry.unmarshal(
        context,
        await typeRegistry.marshal(context, expected4, bufferType),
        bufferType,
      );
      expect(expected4.equals(buf4)).toBeTruthy();
    });
  });

  it('Can serialize / deserialize parameterized types like Array and Object', () => {
    waitsForPromise(async () => {
      invariant(typeRegistry);

      // An array of buffers.
      const expected = [new Buffer('testdas'), new Buffer('test')];
      const type: ArrayType = {
        location: builtinLocation,
        kind: 'array',
        type: bufferType,
      };
      const result = await typeRegistry.unmarshal(
        context,
        await typeRegistry.marshal(context, expected, type),
        type,
      );
      expect(result.length).toBe(2);
      expect(result[0].equals(expected[0])).toBeTruthy();
      expect(result[1].equals(expected[1])).toBeTruthy();

      // Object with a a nullable property and a buffer property.
      const customObjectType: ObjectType = {
        location: builtinLocation,
        kind: 'object',
        fields: [
          // A nullable string property.
          {
            location: builtinLocation,
            type: {
              location: builtinLocation,
              kind: 'nullable',
              type: stringType,
            },
            name: 'a',
            optional: false,
          },
          // A non-nullable buffer property.
          {
            location: builtinLocation,
            type: bufferType,
            name: 'b',
            optional: false,
          },
          // An optional number property.
          {
            location: builtinLocation,
            type: numberType,
            name: 'c',
            optional: true,
          },
        ],
      };
      const expected2 = {a: null, b: new Buffer('test')};
      const result2 = await typeRegistry.unmarshal(
        context,
        await typeRegistry.marshal(context, expected2, customObjectType),
        customObjectType,
      );
      expect(result2.a).toBeNull();
      expect(result2.b.equals(expected2.b)).toBeTruthy();

      // Undefined is acceptable for nullable fields.
      const expected3 = {a: undefined, b: new Buffer('test')};
      const marshalled = await typeRegistry.marshal(
        context,
        expected3,
        customObjectType,
      );
      const result3 = await typeRegistry.unmarshal(
        context,
        // JSON omits undefined values, so accurately test that.
        JSON.parse(JSON.stringify(marshalled)),
        customObjectType,
      );
      expect(result3.a).toBe(undefined);
      expect(result3.b.equals(expected3.b)).toBeTruthy();
    });
  });

  it('Can serialize / deserialize type aliases.', () => {
    waitsForPromise(async () => {
      invariant(typeRegistry);
      typeRegistry.registerAlias('ValueTypeA', builtinLocation, ValueTypeA);

      const data = {valueA: 'Hello World.', valueB: null};
      const type: NamedType = {
        location: builtinLocation,
        kind: 'named',
        name: 'ValueTypeA',
      };
      const result = await typeRegistry.unmarshal(
        context,
        await typeRegistry.marshal(context, data, type),
        type,
      );
      expect(result.valueA).toBe(data.valueA);
      expect(result.valueB).toBeNull();
      expect(result.hasOwnProperty('valueC')).toBeFalsy();
    });
  });

  it('Can serialize / deserialize named types with same name as type kinds.', () => {
    waitsForPromise(async () => {
      invariant(typeRegistry);
      typeRegistry.registerAlias('nullable', builtinLocation, numberType);

      const data = null;
      const type: NullableType = {
        location: builtinLocation,
        kind: 'nullable',
        type: stringType,
      };
      const result = await typeRegistry.unmarshal(
        context,
        await typeRegistry.marshal(context, data, type),
        type,
      );
      expect(result).toBe(null);
    });
  });

  it('Can serialize / deserialize union literal types.', () => {
    waitsForPromise(async () => {
      invariant(typeRegistry);

      const type: UnionType = {
        location: builtinLocation,
        kind: 'union',
        types: [a1, a2, a3],
      };

      const data1 = 'bork';
      const result1 = await typeRegistry.unmarshal(
        context,
        await typeRegistry.marshal(context, data1, type),
        type,
      );
      expect(result1).toBe(data1);

      const data2 = 'bork!';
      const result2 = await typeRegistry.unmarshal(
        context,
        await typeRegistry.marshal(context, data2, type),
        type,
      );
      expect(result2).toBe(data2);

      const data3 = 42;
      const result3 = await typeRegistry.unmarshal(
        context,
        await typeRegistry.marshal(context, data3, type),
        type,
      );
      expect(result3).toBe(data3);

      const data4 = 'not bork!';
      let thrown = false;
      try {
        await typeRegistry.marshal(context, data4, type);
      } catch (e) {
        thrown = true;
      }
      expect(thrown).toBe(true);
    });
  });

  it('Can serialize / deserialize union object types.', () => {
    waitsForPromise(async () => {
      invariant(typeRegistry);

      // {kind: 'bork'; n: number }
      const o1: ObjectType = {
        location: builtinLocation,
        kind: 'object',
        fields: [
          {
            location: builtinLocation,
            type: a1,
            name: 'kind',
            optional: false,
          },
          {
            location: builtinLocation,
            type: numberType,
            name: 'n',
            optional: false,
          },
        ],
      };

      // {kind: 'bork!'; s: string }
      const o2: ObjectType = {
        location: builtinLocation,
        kind: 'object',
        fields: [
          {
            location: builtinLocation,
            type: a2,
            name: 'kind',
            optional: false,
          },
          {
            location: builtinLocation,
            type: stringType,
            name: 's',
            optional: false,
          },
        ],
      };

      // {kind: 42; b: boolean }
      const o3: ObjectType = {
        location: builtinLocation,
        kind: 'object',
        fields: [
          {
            location: builtinLocation,
            type: a3,
            name: 'kind',
            optional: false,
          },
          {
            location: builtinLocation,
            type: booleanType,
            name: 'b',
            optional: false,
          },
        ],
      };

      const type: UnionType = {
        location: builtinLocation,
        kind: 'union',
        types: [o1, o2, o3],
        discriminantField: 'kind',
      };

      const data1 = {kind: 'bork', n: 42};
      const result1 = await typeRegistry.unmarshal(
        context,
        await typeRegistry.marshal(context, data1, type),
        type,
      );
      expect(result1).toEqual(data1);

      const data2 = {kind: 'bork!', s: 'hello'};
      const result2 = await typeRegistry.unmarshal(
        context,
        await typeRegistry.marshal(context, data2, type),
        type,
      );
      expect(result2).toEqual(data2);

      const data3 = {kind: 42, b: true};
      const result3 = await typeRegistry.unmarshal(
        context,
        await typeRegistry.marshal(context, data3, type),
        type,
      );
      expect(result3).toEqual(data3);

      // Ensure no extra fields are accidentally marshalled.
      const data4 = {kind: 'bork', n: 42, s: 'hello', b: true};
      const result4 = await typeRegistry.unmarshal(
        context,
        await typeRegistry.marshal(context, data4, type),
        type,
      );
      expect(result4).toEqual(data1);

      const data5 = {kind: 'not bork!'};
      let thrown = false;
      try {
        await typeRegistry.marshal(context, data5, type);
      } catch (e) {
        thrown = true;
      }
      expect(thrown).toBe(true);
    });
  });

  it('can serialize/deserialize intersection object types', () => {
    waitsForPromise(async () => {
      invariant(typeRegistry);

      // { x: number, y: number }
      const o1: ObjectType = {
        location: builtinLocation,
        kind: 'object',
        fields: [
          {
            location: builtinLocation,
            type: numberType,
            name: 'x',
            optional: false,
          },
          {
            location: builtinLocation,
            type: numberType,
            name: 'y',
            optional: false,
          },
        ],
      };

      // { s: string }
      const o2: ObjectType = {
        location: builtinLocation,
        kind: 'object',
        fields: [
          {
            location: builtinLocation,
            type: stringType,
            name: 's',
            optional: false,
          },
        ],
      };

      const type: IntersectionType = {
        location: builtinLocation,
        kind: 'intersection',
        types: [o1, o2],
        flattened: {
          kind: 'object',
          location: builtinLocation,
          fields: o1.fields.concat(o2.fields),
        },
      };

      const data1 = {x: 5, y: 6, s: 'asdf'};
      const result1 = await typeRegistry.unmarshal(
        context,
        await typeRegistry.marshal(context, data1, type),
        type,
      );
      expect(result1).toEqual(data1);

      // Ensure no extra fields are accidentally marshalled.
      const data4 = {x: 5, y: 6, s: 'asdf', b: true};
      const result4 = await typeRegistry.unmarshal(
        context,
        await typeRegistry.marshal(context, data4, type),
        type,
      );
      expect(result4).toEqual(data1);
    });
  });

  it('Can serialize / deserialize undefined values', () => {
    waitsForPromise(async () => {
      invariant(typeRegistry);

      const data = undefined;
      const type: NullableType = {
        location: builtinLocation,
        kind: 'nullable',
        type: stringType,
      };
      const result = await typeRegistry.unmarshal(
        context,
        await typeRegistry.marshal(context, data, type),
        type,
      );
      expect(result).toBe(undefined);
    });
  });

  it('works for very large values', () => {
    waitsForPromise(async () => {
      jasmine.unspy(Date, 'now');
      const testArray = [];
      for (let i = 0; i < 100000; i++) {
        testArray.push('this is a test string');
      }
      const {heapUsed} = process.memoryUsage();
      const startTime = Date.now();
      const result = await typeRegistry.marshal(context, testArray, {
        location: builtinLocation,
        kind: 'array',
        type: stringType,
      });
      const mem = process.memoryUsage().heapUsed - heapUsed;
      // eslint-disable-next-line no-console
      console.log('time taken: %d seconds', (Date.now() - startTime) / 1000);
      // eslint-disable-next-line no-console
      console.log('memory used: %d', mem);

      // 10MB is a very reasonable upper bound.
      // In contrast, using promises takes 152MB!
      expect(result).toEqual(testArray);
      expect(mem).toBeLessThan(10 * 1024 * 1024);
    });
  });

  it('works for parameter names same name as members from Object.prototype', () => {
    waitsForPromise(async () => {
      invariant(typeRegistry);

      const parameters = [
        {
          name: 'hasOwnProperty',
          type: stringType,
        },
      ];

      const expected = 'Hello World';
      const results = await typeRegistry.unmarshalArguments(
        context,
        await typeRegistry.marshalArguments(context, [expected], parameters),
        parameters,
      );
      expect(results).toEqual([expected]);
    });
  });

  it('accepts undefined parameters for nullable/mixed/any types', () => {
    waitsForPromise(async () => {
      invariant(typeRegistry);

      const parameters = [
        {
          name: 'a',
          type: {
            location: builtinLocation,
            kind: 'nullable',
            type: stringType,
          },
        },
        {
          name: 'b',
          type: anyType,
        },
        {
          name: 'c',
          type: mixedType,
        },
      ];

      const results = await typeRegistry.unmarshalArguments(
        context,
        {}, // JSON.stringify removes all undefined values.
        parameters,
      );
      expect(results).toEqual([undefined, undefined, undefined]);
    });
  });
});

const a1 = {
  location: builtinLocation,
  kind: 'string-literal',
  value: 'bork',
};
const a2 = {
  location: builtinLocation,
  kind: 'string-literal',
  value: 'bork!',
};
const a3 = {
  location: builtinLocation,
  kind: 'number-literal',
  value: 42,
};

const ValueTypeA: ObjectType = {
  location: builtinLocation,
  kind: 'object',
  fields: [
    {
      location: builtinLocation,
      name: 'valueA',
      optional: false,
      type: stringType,
    },
    {
      location: builtinLocation,
      name: 'valueB',
      optional: false,
      type: {
        location: builtinLocation,
        kind: 'nullable',
        type: {
          location: builtinLocation,
          kind: 'named',
          name: 'ValueTypeB',
        },
      },
    },
    {
      location: builtinLocation,
      name: 'valueC',
      optional: true,
      type: booleanType,
    },
  ],
};
