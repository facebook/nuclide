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

import type {DataCache as DataCacheType} from '../lib/DataCache';
import type {DbgpSocket as DbgpSocketType} from '../lib/DbgpSocket';

import invariant from 'assert';
import {uncachedRequire} from '../../nuclide-test-helpers';
import {
  remoteObjectIdOfObjectId,
  createContextObjectId,
  pagedObjectId,
  singlePageObjectId,
} from '../lib/ObjectId';
import {ConnectionStatus} from '../lib/DbgpSocket';

const PROPERTIES = [{$: {fullname: 'pizza'}}];
const CONVERTED_PROPERTIES = ['converted-properties'];
const EXPRESSION = ['expression'];

describe('debugger-php-rpc DataCache', () => {
  let socket: DbgpSocketType = (null: any);
  let cache: DataCacheType = (null: any);

  const contextId = createContextObjectId(1, 2, '3');
  const contextRemoteId = remoteObjectIdOfObjectId(contextId);
  const pagedId = pagedObjectId(contextId, 'fullname-value', {
    pagesize: 32,
    startIndex: 0,
    count: 42,
  });
  const pagedRemoteId = remoteObjectIdOfObjectId(pagedId);
  const singlePageId = singlePageObjectId(contextId, 'fullname-value', 42);
  const singlePageRemoteId = remoteObjectIdOfObjectId(singlePageId);
  let convertProperties;
  let getPagedProperties;
  let convertValue;
  let statusCallback;

  beforeEach(() => {
    socket = (({
      onStatus: callback => {
        statusCallback = callback;
      },
      getContextsForFrame: jasmine.createSpy().andReturn(
        Promise.resolve([
          {
            name: 'Locals',
            id: '0',
          },
          {
            name: 'Superglobals',
            id: '1',
          },
          {
            name: 'User defined constants',
            id: '2',
          },
        ]),
      ),
      getContextProperties: jasmine
        .createSpy()
        .andReturn(Promise.resolve(PROPERTIES)),
    }: any): DbgpSocketType);
    statusCallback = null;

    const properties = require('../lib/properties');
    convertProperties = spyOn(properties, 'convertProperties').andReturn(
      CONVERTED_PROPERTIES,
    );
    getPagedProperties = spyOn(properties, 'getPagedProperties').andReturn(
      CONVERTED_PROPERTIES,
    );

    const values = require('../lib/values');
    convertValue = spyOn(values, 'convertValue').andReturn(EXPRESSION);

    const {DataCache} = ((uncachedRequire(require, '../lib/DataCache'): any): {
      DataCache: Class<DataCacheType>,
    });
    cache = new DataCache(socket);
  });
  function enable() {
    invariant(statusCallback);
    statusCallback(ConnectionStatus.Break);
  }
  function disable() {
    invariant(statusCallback);
    statusCallback(ConnectionStatus.Running);
  }

  it('no enable', () => {
    waitsForPromise({shouldReject: true, timeout: 0}, async () => {
      await cache.getScopesForFrame(4);
    });
  });

  it('enable/disable', () => {
    waitsForPromise({shouldReject: true, timeout: 0}, async () => {
      enable();
      disable();
      await cache.getScopesForFrame(4);
    });
  });

  it('getScopesForFrame', () => {
    waitsForPromise(async () => {
      enable();
      const result = await cache.getScopesForFrame(42);

      expect(socket.getContextsForFrame).toHaveBeenCalledWith(42);
      expect(result).toEqual([
        {
          object: {
            description: 'Locals',
            type: 'object',
            objectId: '{"enableCount":1,"frameIndex":42,"contextId":"0"}',
          },
          type: 'local',
        },
        {
          object: {
            description: 'Superglobals',
            type: 'object',
            objectId: '{"enableCount":1,"frameIndex":42,"contextId":"1"}',
          },
          type: 'global',
        },
        {
          object: {
            description: 'User defined constants',
            type: 'object',
            objectId: '{"enableCount":1,"frameIndex":42,"contextId":"2"}',
          },
          type: 'global',
        },
      ]);
    });
  });

  it('getProperties - context', () => {
    waitsForPromise(async () => {
      enable();
      const result = await cache.getProperties(contextRemoteId);
      expect(result).toEqual(CONVERTED_PROPERTIES);
      expect(socket.getContextProperties).toHaveBeenCalledWith(2, '3');
      expect(convertProperties).toHaveBeenCalledWith(contextId, PROPERTIES);
    });
  });

  it('getProperties - paged', () => {
    waitsForPromise(async () => {
      enable();
      const result = await cache.getProperties(pagedRemoteId);
      expect(result).toEqual(CONVERTED_PROPERTIES);
      expect(getPagedProperties).toHaveBeenCalledWith(pagedId);
    });
  });

  it('getProperties - single page', () => {
    waitsForPromise(async () => {
      // $FlowFixMe override instance method.
      socket.getPropertiesByFullname = jasmine
        .createSpy('getPropertiesByFullname')
        .andReturn(Promise.resolve(PROPERTIES));
      enable();
      const result = await cache.getProperties(singlePageRemoteId);
      expect(result).toEqual(CONVERTED_PROPERTIES);
      expect(socket.getPropertiesByFullname).toHaveBeenCalledWith(
        2,
        '3',
        'fullname-value',
        42,
      );
      expect(convertProperties).toHaveBeenCalledWith(singlePageId, PROPERTIES);
    });
  });

  it('evaluateOnCallFrame', () => {
    waitsForPromise(async () => {
      // $FlowFixMe override instance method.
      socket.evaluateOnCallFrame = jasmine
        .createSpy('evaluateOnCallFrame')
        .andReturn(Promise.resolve({result: PROPERTIES, wasThrown: false}));
      enable();
      const result = await cache.evaluateOnCallFrame(5, 'expression');
      expect(socket.evaluateOnCallFrame).toHaveBeenCalledWith(5, 'expression');
      expect(convertValue).toHaveBeenCalledWith(
        {
          enableCount: 1,
          frameIndex: 5,
          contextId: 'Watch Context Id',
        },
        PROPERTIES,
      );
      expect(result).toEqual({
        result: EXPRESSION,
        wasThrown: false,
      });
    });
  });
});
