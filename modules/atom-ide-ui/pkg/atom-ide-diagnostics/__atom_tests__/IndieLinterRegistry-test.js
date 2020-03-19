/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow strict-local
 * @format
 * @emails oncall+nuclide
 */
import IndieLinterRegistry from '../lib/services/IndieLinterRegistry';

describe('IndieLinterRegistry', () => {
  const registry = new IndieLinterRegistry();
  const message1 = {
    location: {
      file: 'test.txt',
      position: [[0, 0], [0, 0]],
    },
    excerpt: 'test',
    severity: 'error',
  };
  const message2 = {
    location: {
      file: 'test2.txt',
      position: [[0, 0], [0, 0]],
    },
    excerpt: 'test2',
    severity: 'error',
  };

  let delegate;
  beforeEach(() => {
    delegate = registry.register({name: 'test'});
  });

  afterEach(() => {
    delegate.dispose();
    expect(registry._delegates.size).toBe(0);
  });

  describe('IndieLinterDelegate', () => {
    it('has a name', () => {
      expect(delegate.name).toBe('test');
    });

    it('supports message APIs', () => {
      expect(delegate.getMessages()).toEqual([]);

      delegate.setMessages('test.txt', [message1]);
      expect(delegate.getMessages()).toEqual([message1]);

      // Replaces the previous message.
      delegate.setMessages('test.txt', [message1]);
      expect(delegate.getMessages()).toEqual([message1]);

      // Doesn't affect existing files.
      delegate.setMessages('test2.txt', [message2]);
      expect(delegate.getMessages()).toEqual([message1, message2]);

      delegate.setAllMessages([message1]);
      expect(delegate.getMessages()).toEqual([message1]);

      delegate.clearMessages();
      expect(delegate.getMessages()).toEqual([]);
    });

    it('supports onDidChange', () => {
      const spy = jest.fn();
      delegate.onDidUpdate(spy);
      delegate.setMessages('test.txt', [message1]);
      expect(spy).toHaveBeenCalledWith([message1]);
    });

    it('supports onDidDestroy', () => {
      const spy = jest.fn();
      delegate.onDidDestroy(spy);
      expect(spy.mock.calls.length).toBe(0);
      delegate.dispose();
      delegate.dispose();
      expect(spy.mock.calls.length).toBe(1);
    });
  });
});
