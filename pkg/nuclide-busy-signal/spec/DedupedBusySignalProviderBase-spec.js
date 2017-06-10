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

import type {BusySignalMessage} from '../lib/types';

import {
  DedupedBusySignalProviderBase,
} from '../lib/DedupedBusySignalProviderBase';

describe('DedupedBusySignalProviderBase', () => {
  let providerBase: DedupedBusySignalProviderBase = (null: any);
  let messages: Array<BusySignalMessage> = (null: any);

  beforeEach(() => {
    providerBase = new DedupedBusySignalProviderBase();
    messages = [];
    providerBase.messages.subscribe(message => messages.push(message));
  });

  it('should properly dispose of a message', () => {
    providerBase.displayMessage('foo').dispose();
    expect(messages).toEqual([
      {status: 'busy', id: 0, message: 'foo'},
      {status: 'done', id: 0},
    ]);
  });

  it('should properly display and dispose of a duplicate message', () => {
    const expectedFirstMessage = {status: 'busy', id: 0, message: 'foo'};
    const expectedCancellationMessage = {status: 'done', id: 0};

    const dispose1 = providerBase.displayMessage('foo');
    const dispose2 = providerBase.displayMessage('foo');

    expect(messages).toEqual([expectedFirstMessage]);

    dispose2.dispose();

    expect(messages).toEqual([expectedFirstMessage]);

    dispose1.dispose();

    expect(messages).toEqual([
      expectedFirstMessage,
      expectedCancellationMessage,
    ]);
  });
});
