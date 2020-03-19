/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow
 * @format
 * @emails oncall+nuclide
 */
import invariant from 'assert';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {ServiceTester} from '../__mocks__/ServiceTester';
import typeof * as EchoServiceType from '../__mocks__/EchoService';
import {RemotableObject} from '../__mocks__/EchoService';

describe('EchoServer', () => {
  let testHelper;
  let service: EchoServiceType = (null: any);

  beforeEach(async () => {
    testHelper = new ServiceTester();
    await testHelper.start(
      [
        {
          name: 'EchoService',
          definition: nuclideUri.join(__dirname, '../__mocks__/EchoService.js'),
          implementation: nuclideUri.join(
            __dirname,
            '../__mocks__/EchoService.js',
          ),
        },
      ],
      'echo_protocol',
    );

    service = testHelper.getRemoteService('EchoService');
  });

  // Basic types.
  it('Echoes an argument of type "any".', async () => {
    const number = 12345;
    await (async () => {
      const results = await service.echoAny(number);
      expect(results).toBe(number);
    })();
    const object = {hello: 'world', success: true};
    await (async () => {
      const results = await service.echoAny(object);
      expect(results).toEqual(object);
    })();
  });
  it('Echoes a string.', async () => {
    const expected = 'Hello World.';
    await (async () => {
      const results = await service.echoString(expected);
      expect(results).toBe(expected);
    })();
  });
  it('Echoes a number.', async () => {
    const expected = 231312;
    await (async () => {
      const results = await service.echoNumber(expected);
      expect(results).toBe(expected);
    })();
  });
  it('Echoes a boolean.', async () => {
    const expected = false;
    await (async () => {
      const results = await service.echoBoolean(expected);
      expect(results).toBe(expected);
    })();
  });
  it('Echoes a number with a default value.', async () => {
    const expected = 1;
    await (async () => {
      const results = await service.echoDefaultNumber();
      expect(results).toBe(expected);
    })();
  });
  it('Echoes undefined.', async () => {
    await (async () => {
      const result = await service.echoVoid(undefined);
      expect(result).toBe(undefined);
    })();
  });

  // More complex types.
  it('Echoes a date.', async () => {
    const expected = new Date();
    await (async () => {
      const results = await service.echoDate(expected);
      expect(results.getTime()).toBe(expected.getTime());
    })();
  });
  it('Echoes a Regex.', async () => {
    // eslint-disable-next-line no-control-regex
    const expected = new RegExp('nuclide\nnewline', 'gi');
    await (async () => {
      const results = await service.echoRegExp(expected);
      expect(results.source).toBe(expected.source);
      expect(results.flags).toBe(expected.flags);
    })();
  });
  it('Echoes a Buffer.', async () => {
    const expected = new Buffer('Test Buffer Content.');
    await (async () => {
      const results = await service.echoBuffer(expected);
      expect(results.equals(expected)).toBe(true);
    })();
  });

  // Parameterized types.
  it('Echoes an Array<Array<Date>>.', async () => {
    const a = new Date();
    const b = new Date(1995, 11, 17, 3, 24, 0);
    const expected = [[a, b]];

    await (async () => {
      const results = await service.echoArrayOfArrayOfDate(expected);
      expect(results.length).toBe(1);
      expect(results[0].length).toBe(2);
      expect(results[0][0].getTime()).toBe(a.getTime());
      expect(results[0][1].getTime()).toBe(b.getTime());
    })();
  });
  it('Echoes an Object.', async () => {
    const a = null;
    const b = new Buffer('testBuffer');
    const c = undefined;

    await (async () => {
      const results = await service.echoObject({a, b});
      expect(results.a).toBe(null);
      expect(results.b.equals(b)).toBe(true);

      const results2 = await service.echoObject({a, b, c});
      // hasOwnProperty('c') evaluates to false since JSON doesn't serialize undefined.
      // This is an imperfection in the service framework.
      expect(results2.hasOwnProperty('c')).toBeFalsy();
      expect(results2.c).toBeUndefined();
    })();
  });
  it('Echoes a Set.', async () => {
    const original = new Set(['a', 'b']);
    await (async () => {
      const results = await service.echoSet(original);
      expect(results.has('a')).toBeTruthy();
      expect(results.has('b')).toBeTruthy();
      expect(results.has('c')).toBeFalsy();
    })();
  });
  it('Echoes a Map.', async () => {
    const original = new Map([
      ['a', new Date()],
      ['b', new Date(1995, 11, 17, 3, 24, 0)],
    ]);
    await (async () => {
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
    })();
  });
  it('Echoes a Tuple.', async () => {
    const original = [3, 'hello'];
    await (async () => {
      const results = await service.echoTuple(original);
      expect(results.length).toBe(original.length);
      expect(results[0]).toBe(original[0]);
      expect(results[1]).toBe(original[1]);
    })();
  });

  // Echo value types.
  it('Echoes a value type (struct).', async () => {
    const expected = {
      a: new Date(),
      b: new Buffer('Buffer Test Data.'),
    };

    await (async () => {
      invariant(service);
      const results = await service.echoValueType(expected);

      expect(results.a.getTime()).toBe(expected.a.getTime());
      expect(results.b.equals(expected.b)).toBe(true);
    })();
  });

  // Echo a NuclideUri.
  it('Echoes a NuclideUri.', async () => {
    const expected = testHelper.getUriOfRemotePath('/fake/file.txt');
    await (async () => {
      invariant(service);
      const results = await service.echoNuclideUri(expected);
      expect(results).toBe(expected);
    })();
  });

  // Echo a RemotableObject.
  it('Echoes a RemotableObject.', async () => {
    const expected = new RemotableObject();
    await (async () => {
      invariant(service);
      const results = await service.echoRemotableObject(expected);
      expect(results).toBe(expected);
    })();
  });

  it('Throws when attempting to construct a remotable object', () => {
    let err;
    try {
      // eslint-disable-next-line no-new
      new service.RemotableObject();
    } catch (_err) {
      err = _err;
    }
    expect(err).toBeTruthy();
    invariant(err != null);
    expect(err.message).toBe(
      'constructors are not supported for remote objects',
    );
  });

  afterEach(() => testHelper.stop());
});
