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

import invariant from 'assert';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {ServiceTester} from './ServiceTester';
import typeof * as EchoServiceType from './EchoService';
import {RemotableObject} from './EchoService';

describe('EchoServer', () => {
  let testHelper;
  let service: EchoServiceType = (null: any);
  beforeEach(() => {
    testHelper = new ServiceTester();
    waitsForPromise(() =>
      testHelper.start(
        [
          {
            name: 'EchoService',
            definition: nuclideUri.join(__dirname, 'EchoService.js'),
            implementation: nuclideUri.join(__dirname, 'EchoService.js'),
          },
        ],
        'echo_protocol',
      ),
    );

    runs(() => {
      service = testHelper.getRemoteService('EchoService');
    });
  });

  // Basic types.
  it('Echoes an argument of type "any".', () => {
    const number = 12345;
    waitsForPromise(async () => {
      const results = await service.echoAny(number);
      expect(results).toBe(number);
    });
    const object = {hello: 'world', success: true};
    waitsForPromise(async () => {
      const results = await service.echoAny(object);
      expect(results).toEqual(object);
    });
  });
  it('Echoes a string.', () => {
    const expected = 'Hello World.';
    waitsForPromise(async () => {
      const results = await service.echoString(expected);
      expect(results).toBe(expected);
    });
  });
  it('Echoes a number.', () => {
    const expected = 231312;
    waitsForPromise(async () => {
      const results = await service.echoNumber(expected);
      expect(results).toBe(expected);
    });
  });
  it('Echoes a boolean.', () => {
    const expected = false;
    waitsForPromise(async () => {
      const results = await service.echoBoolean(expected);
      expect(results).toBe(expected);
    });
  });
  it('Echoes a number with a default value.', () => {
    const expected = 1;
    waitsForPromise(async () => {
      const results = await service.echoDefaultNumber();
      expect(results).toBe(expected);
    });
  });

  // More complex types.
  it('Echoes a date.', () => {
    const expected = new Date();
    waitsForPromise(async () => {
      const results = await service.echoDate(expected);
      expect(results.getTime()).toBe(expected.getTime());
    });
  });
  it('Echoes a Regex.', () => {
    const expected = /nuclide/gi;
    waitsForPromise(async () => {
      const results = await service.echoRegExp(expected);
      expect(results.source).toBe(expected.source);
    });
  });
  it('Echoes a Buffer.', () => {
    const expected = new Buffer('Test Buffer Content.');
    waitsForPromise(async () => {
      const results = await service.echoBuffer(expected);
      expect(results.equals(expected)).toBe(true);
    });
  });

  // Parameterized types.
  it('Echoes an Array<Array<Date>>.', () => {
    const a = new Date();
    const b = new Date(1995, 11, 17, 3, 24, 0);
    const expected = [[a, b]];

    waitsForPromise(async () => {
      const results = await service.echoArrayOfArrayOfDate(expected);
      expect(results.length).toBe(1);
      expect(results[0].length).toBe(2);
      expect(results[0][0].getTime()).toBe(a.getTime());
      expect(results[0][1].getTime()).toBe(b.getTime());
    });
  });
  it('Echoes an Object.', () => {
    const a = null;
    const b = new Buffer('testBuffer');
    const c = undefined;

    waitsForPromise(async () => {
      const results = await service.echoObject({a, b});
      expect(results.a).toBe(null);
      expect(results.b.equals(b)).toBe(true);

      const results2 = await service.echoObject({a, b, c});
      // hasOwnProperty('c') evaluates to false since JSON doesn't serialize undefined.
      // This is an imperfection in the service framework.
      expect(results2.hasOwnProperty('c')).toBeFalsy();
      expect(results2.c).toBeUndefined();
    });
  });
  it('Echoes a Set.', () => {
    const original = new Set(['a', 'b']);
    waitsForPromise(async () => {
      const results = await service.echoSet(original);
      expect(results.has('a')).toBeTruthy();
      expect(results.has('b')).toBeTruthy();
      expect(results.has('c')).toBeFalsy();
    });
  });
  it('Echoes a Map.', () => {
    const original = new Map([
      ['a', new Date()],
      ['b', new Date(1995, 11, 17, 3, 24, 0)],
    ]);
    waitsForPromise(async () => {
      const results = await service.echoMap(original);

      const originalA = original.get('a');
      expect(originalA).toBeTruthy();
      if (originalA != null) {
        const resultA = results.get('a');
        invariant(resultA != null);
        expect(resultA.getTime()).toEqual(originalA.getTime());
      }

      const originalB = original.get('b');
      expect(originalB).toBeTruthy();
      if (originalB != null) {
        const resultB = results.get('b');
        invariant(resultB != null);
        expect(resultB.getTime()).toEqual(originalB.getTime());
      }

      expect(results.has('c')).toBeFalsy();
    });
  });
  it('Echoes a Tuple.', () => {
    const original = [3, 'hello'];
    waitsForPromise(async () => {
      const results = await service.echoTuple(original);
      expect(results.length).toBe(original.length);
      expect(results[0]).toBe(original[0]);
      expect(results[1]).toBe(original[1]);
    });
  });

  // Echo value types.
  it('Echoes a value type (struct).', () => {
    const expected = {
      a: new Date(),
      b: new Buffer('Buffer Test Data.'),
    };

    waitsForPromise(async () => {
      invariant(service);
      const results = await service.echoValueType(expected);

      expect(results.a.getTime()).toBe(expected.a.getTime());
      expect(results.b.equals(expected.b)).toBe(true);
    });
  });

  // Echo a NuclideUri.
  it('Echoes a NuclideUri.', () => {
    const expected = testHelper.getUriOfRemotePath('/fake/file.txt');
    waitsForPromise(async () => {
      invariant(service);
      const results = await service.echoNuclideUri(expected);
      expect(results).toBe(expected);
    });
  });

  // Echo a RemotableObject.
  it('Echoes a RemotableObject.', () => {
    const expected = new RemotableObject();
    waitsForPromise(async () => {
      invariant(service);
      const results = await service.echoRemotableObject(expected);
      expect(results).toBe(expected);
    });
  });

  afterEach(() => testHelper.stop());
});
