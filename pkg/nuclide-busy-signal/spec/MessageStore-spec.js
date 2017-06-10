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

import type {BusySignalMessage, BusySignalMessageBusy} from '../lib/types';

import {Subject} from 'rxjs';

import {MessageStore} from '../lib/MessageStore';

describe('MessageStore', () => {
  let messageStore: MessageStore = (null: any);
  let messagePublisher: Subject<BusySignalMessage> = (null: any);
  let messageStreamResults: Array<Array<BusySignalMessageBusy>> = (null: any);
  let sampleMessage: BusySignalMessage = (null: any);

  function getLastResult() {
    return messageStreamResults[messageStreamResults.length - 1];
  }

  beforeEach(() => {
    messageStore = new MessageStore();
    messagePublisher = new Subject();
    messageStreamResults = [];
    sampleMessage = {
      status: 'busy',
      id: 0,
      message: 'foobar',
    };
    const provider = {
      messages: messagePublisher,
    };
    messageStore.consumeProvider(provider);
    messageStore
      .getMessageStream()
      .subscribe(messages => messageStreamResults.push(messages));
  });

  it('should publish the current state as soon as it receives a subscriber', () => {
    expect(messageStreamResults).toEqual([[]]);
  });

  it('should publish messages it receives', () => {
    messagePublisher.next(sampleMessage);
    expect(getLastResult()).toEqual([sampleMessage]);
  });

  it('should remove invalidated messages', () => {
    messagePublisher.next(sampleMessage);
    messagePublisher.next({id: 0, status: 'done', message: 'foobar'});
    expect(getLastResult()).toEqual([]);
  });

  it('should allow multiple messages from a single provider', () => {
    const firstMessage = sampleMessage;
    const secondMessage = {id: 1, status: 'busy', message: 'foobar'};
    messagePublisher.next(firstMessage);
    messagePublisher.next(secondMessage);
    // Message order within a provider is respected.
    expect(getLastResult()).toEqual([firstMessage, secondMessage]);
    messagePublisher.next({id: 0, status: 'done', message: 'foobar'});
    messagePublisher.next({id: 1, status: 'done'});
    expect(getLastResult()).toEqual([]);
  });

  it('should handle messages from different providers', () => {
    const otherPublisher = new Subject();
    messageStore.consumeProvider({
      messages: otherPublisher,
    });
    messagePublisher.next(sampleMessage);
    otherPublisher.next(sampleMessage);
    expect(getLastResult()).toEqual([sampleMessage, sampleMessage]);
    messagePublisher.next({id: 0, status: 'done', message: 'foobar'});
    expect(getLastResult()).toEqual([sampleMessage]);
  });
});
