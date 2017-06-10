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

import {normalizeRemoteObjectValue} from '../lib/normalizeRemoteObjectValue';

describe('normalizeRemoteObjectValue', () => {
  it('empty', () => {
    const normalObj: any = normalizeRemoteObjectValue({});
    expect(normalObj.description).toBe(undefined);
    expect(normalObj.type).toBe(undefined);
    expect(normalObj.value).toBe(undefined);
    expect(normalObj.objectId).toBe(undefined);
  });

  it('trivial', () => {
    const normalObj = normalizeRemoteObjectValue(null);
    expect(normalObj).toBe(null);
  });

  it('all', () => {
    const obj = {
      description: 'a',
      type: 't',
      value: 'v',
      objectId: 'o',
    };
    const normalObj: any = normalizeRemoteObjectValue(obj);
    expect(normalObj.description).toBe('a');
    expect(normalObj.type).toBe('t');
    expect(normalObj.value).toBe('v');
    expect(normalObj.objectId).toBe('o');
  });

  it('extra', () => {
    const obj = {
      description: 'a',
      type: 't',
      value: 'v',
      objectId: 'o',
      extra: 3,
    };
    const normalObj: any = normalizeRemoteObjectValue(obj);
    expect(normalObj.description).toBe('a');
    expect(normalObj.type).toBe('t');
    expect(normalObj.value).toBe('v');
    expect(normalObj.objectId).toBe('o');
    expect(normalObj.extra).toBe(3);
  });

  it('missing', () => {
    const obj = {
      type: 't',
    };
    const normalObj: any = normalizeRemoteObjectValue(obj);
    expect(normalObj.type).toBe('t');
  });

  it('number', () => {
    const obj = {
      type: 'number',
      value: 3,
    };
    const normalObj: any = normalizeRemoteObjectValue(obj);
    expect(normalObj.type).toBe('number');
    expect(normalObj.value).toBe('3');
  });

  it('boolean', () => {
    const obj = {
      type: 'boolean',
      value: false,
    };
    const normalObj: any = normalizeRemoteObjectValue(obj);
    expect(normalObj.type).toBe('boolean');
    expect(normalObj.value).toBe('false');
  });

  it('undefined', () => {
    const obj = {
      type: 'undefined',
      value: undefined,
      description: undefined,
    };
    const normalObj: any = normalizeRemoteObjectValue(obj);
    expect(normalObj.type).toBe('undefined');
    expect(normalObj.value).toBe(undefined);
    expect(normalObj.description).toBe(undefined);
  });

  it('null', () => {
    const obj = {
      type: 'null',
      value: null,
      description: null,
    };
    const normalObj: any = normalizeRemoteObjectValue(obj);
    expect(normalObj.type).toBe('null');
    expect(normalObj.value).toBe(null);
    expect(normalObj.description).toBe(null);
  });

  it('all underscore', () => {
    const obj = {
      _description: 'a',
      _type: 't',
      _value: 'v',
      _objectId: 'o',
    };
    const normalObj: any = normalizeRemoteObjectValue(obj);
    expect(normalObj.description).toBe('a');
    expect(normalObj.type).toBe('t');
    expect(normalObj.value).toBe('v');
    expect(normalObj.objectId).toBe('o');
  });

  it('extra underscore', () => {
    const obj = {
      _description: 'a',
      _type: 't',
      _value: 'v',
      _objectId: 'o',
      _extra: 3,
    };
    const normalObj: any = normalizeRemoteObjectValue(obj);
    expect(normalObj.description).toBe('a');
    expect(normalObj.type).toBe('t');
    expect(normalObj.value).toBe('v');
    expect(normalObj.objectId).toBe('o');
    expect(normalObj._extra).toBe(3);
  });

  it('missing underscore', () => {
    const obj = {
      _type: 't',
    };
    const normalObj: any = normalizeRemoteObjectValue(obj);
    expect(normalObj.type).toBe('t');
  });

  it('number underscore', () => {
    const obj = {
      _type: 'number',
      _value: 3,
    };
    const normalObj: any = normalizeRemoteObjectValue(obj);
    expect(normalObj.type).toBe('number');
    expect(normalObj.value).toBe('3');
  });

  it('boolean underscore', () => {
    const obj = {
      _type: 'boolean',
      _value: false,
    };
    const normalObj: any = normalizeRemoteObjectValue(obj);
    expect(normalObj.type).toBe('boolean');
    expect(normalObj.value).toBe('false');
  });

  it('undefined underscore', () => {
    const obj = {
      _type: 'undefined',
      _value: undefined,
      _description: undefined,
    };
    const normalObj: any = normalizeRemoteObjectValue(obj);
    expect(normalObj.type).toBe('undefined');
    expect(normalObj.value).toBe(undefined);
    expect(normalObj.description).toBe(undefined);
  });

  it('null underscore', () => {
    const obj = {
      _type: 'null',
      _value: null,
      _description: null,
    };
    const normalObj: any = normalizeRemoteObjectValue(obj);
    expect(normalObj.type).toBe('null');
    expect(normalObj.value).toBe(undefined);
    expect(normalObj.description).toBe(undefined);
  });
});
