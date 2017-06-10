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

import type {ObjectId} from '../lib/ObjectId';

import {convertValue} from '../lib/values';

describe('debugger-php-rpc convertValue', () => {
  let objectId: ObjectId = (null: any);

  beforeEach(() => {
    objectId = (({}: any): ObjectId);
  });

  it('string', () => {
    expect(
      convertValue(objectId, {
        _: 'dGVzdC1jbGllbnQucGhw',
        $: {
          name: '0',
          fullname: '$argv[0]',
          address: '140735826684480',
          type: 'string',
          size: 15,
          encoding: 'base64',
        },
      }),
    ).toEqual({
      type: 'string',
      value: 'test-client.php',
    });
  });

  it('int', () => {
    expect(
      convertValue(objectId, {
        _: '1',
        $: {
          name: '$argc',
          fullname: '$argc',
          address: '140735826684880',
          type: 'int',
        },
      }),
    ).toEqual({
      type: 'number',
      value: '1',
    });
  });

  it('64bit int', () => {
    expect(
      convertValue(objectId, {
        _: '-5560108255872548864',
        $: {
          name: '$bitInt',
          fullname: '$bitInt',
          address: '140735826684880',
          type: 'int',
        },
      }),
    ).toEqual({
      type: 'number',
      value: '-5560108255872548864',
    });
  });

  it('float', () => {
    expect(
      convertValue(objectId, {
        _: '42.5',
        $: {
          name: '$arg',
          fullname: '$arg',
          address: '140735826684880',
          type: 'float',
        },
      }),
    ).toEqual({
      type: 'number',
      value: '42.5',
    });
  });

  it('bool', () => {
    expect(
      convertValue(objectId, {
        _: '1',
        $: {
          name: '$arg',
          fullname: '$arg',
          address: '140735826684880',
          type: 'bool',
        },
      }),
    ).toEqual({
      type: 'boolean',
      value: true,
    });
  });

  it('null', () => {
    expect(
      convertValue(objectId, {
        $: {
          name: '$HTTP_RAW_POST_DATA',
          fullname: '$HTTP_RAW_POST_DATA',
          address: '140735826684880',
          type: 'null',
        },
      }),
    ).toEqual({
      type: 'undefined',
      subtype: 'null',
      value: null,
    });
  });

  it('array', () => {
    expect(
      convertValue(objectId, {
        $: {
          name: '$argv',
          fullname: '$argv',
          address: '140735826684880',
          type: 'array',
          children: true,
          numchildren: 1,
          page: 0,
          pagesize: 32,
        },
        property: [
          {
            _: 'dGVzdC1jbGllbnQucGhw',
            $: {
              name: '0',
              fullname: '$argv[0]',
              address: '140735826684480',
              type: 'string',
              size: 15,
              encoding: 'base64',
            },
          },
        ],
      }),
    ).toEqual({
      description: 'Array[1]',
      type: 'object',
      objectId: '{"fullname":"$argv","page":0}',
    });
  });

  it('object', () => {
    expect(
      convertValue(objectId, {
        $: {
          name: '$arg',
          fullname: '$arg',
          address: '140735546955520',
          type: 'object',
          classname: 'CLS',
          children: false,
          numchildren: 0,
          page: 0,
          pagesize: 32,
        },
      }),
    ).toEqual({
      description: 'CLS',
      type: 'object',
      objectId: '{"fullname":"$arg","page":0}',
    });
  });
});
