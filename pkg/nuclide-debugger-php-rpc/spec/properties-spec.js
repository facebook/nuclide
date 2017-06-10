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

import {
  convertProperties,
  convertProperty,
  getPagedProperties,
} from '../lib/properties';

describe('debugger-php-rpc properties', () => {
  let objectId: ObjectId = (null: any);

  beforeEach(() => {
    objectId = (({}: any): ObjectId);
  });

  it('convertProperty', () => {
    expect(
      convertProperty(objectId, {
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
      configurable: false,
      enumerable: true,
      name: '0',
      value: {
        type: 'string',
        value: 'test-client.php',
      },
    });
  });

  it('convertProperties', () => {
    expect(
      convertProperties(objectId, [
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
        {
          _: '42',
          $: {
            name: '1',
            fullname: '$argv[1]',
            address: '140735826684480',
            type: 'int',
          },
        },
      ]),
    ).toEqual([
      {
        configurable: false,
        enumerable: true,
        name: '0',
        value: {
          type: 'string',
          value: 'test-client.php',
        },
      },
      {
        configurable: false,
        enumerable: true,
        name: '1',
        value: {
          type: 'number',
          value: '42',
        },
      },
    ]);
  });

  it('getPagedProperties - single and partial pages', () => {
    expect(
      getPagedProperties(
        // $FlowFixMe - fix test type.
        {
          enableCount: 12,
          frameIndex: 1,
          contextId: 2,
          fullname: 'fullname-value',
          elementRange: {
            pagesize: 32,
            startIndex: 0,
            count: 63,
          },
        },
      ),
    ).toEqual([
      {
        configurable: false,
        enumerable: true,
        name: 'Elements(0..31)',
        value: {
          description: '32 elements',
          type: 'object',
          objectId: JSON.stringify({
            enableCount: 12,
            frameIndex: 1,
            contextId: 2,
            fullname: 'fullname-value',
            page: 0,
          }),
        },
      },
      {
        configurable: false,
        enumerable: true,
        name: 'Elements(32..62)',
        value: {
          description: '31 elements',
          type: 'object',
          objectId: JSON.stringify({
            enableCount: 12,
            frameIndex: 1,
            contextId: 2,
            fullname: 'fullname-value',
            page: 1,
          }),
        },
      },
    ]);
  });

  it('getPagedProperties - page of pages', () => {
    expect(
      getPagedProperties(
        // $FlowFixMe - fix test type.
        {
          enableCount: 12,
          frameIndex: 1,
          contextId: 2,
          fullname: 'fullname-value',
          elementRange: {
            pagesize: 32,
            startIndex: 0,
            count: 32 * 32 * 32 + 1,
          },
        },
      ),
    ).toEqual([
      {
        configurable: false,
        enumerable: true,
        name: 'Elements(0..32767)',
        value: {
          description: '32768 elements',
          type: 'object',
          objectId: JSON.stringify({
            enableCount: 12,
            frameIndex: 1,
            contextId: 2,
            fullname: 'fullname-value',
            elementRange: {
              pagesize: 32,
              startIndex: 0,
              count: 32 * 32 * 32,
            },
          }),
        },
      },
      {
        configurable: false,
        enumerable: true,
        name: 'Elements(32768..32768)',
        value: {
          description: '1 elements',
          type: 'object',
          objectId: JSON.stringify({
            enableCount: 12,
            frameIndex: 1,
            contextId: 2,
            fullname: 'fullname-value',
            page: 1024,
          }),
        },
      },
    ]);
  });
});
