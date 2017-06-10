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

import {BusySignalProviderBase} from '../lib/BusySignalProviderBase';

describe('BusySignalProviderBase', () => {
  let providerBase: BusySignalProviderBase = (null: any);
  let messages: Array<BusySignalMessage> = (null: any);

  beforeEach(() => {
    providerBase = new BusySignalProviderBase();
    messages = [];
    providerBase.messages.subscribe(message => messages.push(message));
  });

  it('should record messages before and after a call', () => {
    expect(messages.length).toBe(0);
    providerBase.reportBusy('foo', () => Promise.resolve(5));
    expect(messages.length).toBe(1);
    waitsFor(
      () => messages.length === 2,
      'It should publish a second message',
      100,
    );
  });

  it('should throw if the function does not return a promise', () => {
    // We have to cast here because the test case purposely subverts the type system.
    const f = () => providerBase.reportBusy('foo', (() => 5: any));
    expect(f).toThrow();
    expect(messages.length).toBe(2);
  });

  it("should send the 'done' message even if the promise rejects", () => {
    providerBase.reportBusy('foo', () => Promise.reject(new Error()));
    expect(messages.length).toBe(1);
    waitsFor(
      () => messages.length === 2,
      'It should publish a second message',
      100,
    );
  });

  describe('when onlyForFile is provided', () => {
    let editor1: atom$TextEditor = (null: any);
    let editor2: atom$TextEditor = (null: any);
    let editor3: atom$TextEditor = (null: any);

    beforeEach(() => {
      waitsForPromise(async () => {
        editor1 = await atom.workspace.open('/file1.txt');
        editor2 = await atom.workspace.open('/file2.txt');
        editor3 = await atom.workspace.open();
      });
    });

    afterEach(() => {
      [editor1, editor2, editor3].forEach(editor => editor.destroy());
    });

    it('should only display for the proper text editor', () => {
      atom.workspace.getActivePane().activateItem(editor1);

      const disposable = providerBase.displayMessage('foo', {
        onlyForFile: '/file2.txt',
      });
      expect(messages).toEqual([]);

      atom.workspace.getActivePane().activateItem(editor2);
      expect(messages.length).toBe(1);
      expect(messages[0]).toEqual({status: 'busy', id: 0, message: 'foo'});

      atom.workspace.getActivePane().activateItem(editor3);
      expect(messages.length).toBe(2);
      expect(messages[1]).toEqual({status: 'done', id: 0});

      atom.workspace.getActivePane().activateItem(editor2);
      expect(messages.length).toBe(3);
      expect(messages[2]).toEqual({status: 'busy', id: 1, message: 'foo'});

      disposable.dispose();
      expect(messages.length).toBe(4);
      expect(messages[3]).toEqual({status: 'done', id: 1});
    });
  });
});
