/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 * @format
 * @emails oncall+nuclide
 */
import type {BusySignalOptions} from '../lib/types';

import fsPromise from 'nuclide-commons/fsPromise';
import {MessageStore} from '../lib/MessageStore';
import BusySignalSingleton from '../lib/BusySignalSingleton';
import waitsFor from '../../../../../jest/waits_for';

describe('BusySignalSingleton', () => {
  let messageStore: MessageStore;
  let singleton: BusySignalSingleton;
  let messages: Array<Array<string>>;
  const options: BusySignalOptions = {debounce: false};

  beforeEach(() => {
    messageStore = new MessageStore();
    singleton = new BusySignalSingleton(messageStore);
    messages = [];
    messageStore
      .getMessageStream()
      .skip(1)
      .subscribe(elements => {
        const strings = [...elements].map(element => {
          const titleElement = element.getTitleElement();
          const child =
            titleElement != null && titleElement.childNodes.length >= 1
              ? titleElement.childNodes[0]
              : {};
          return child.data != null && typeof child.data === 'string'
            ? child.data
            : '';
        });
        messages.push(strings);
      });
  });

  it('should record messages before and after a call', async () => {
    expect(messages.length).toBe(0);
    singleton.reportBusyWhile('foo', () => Promise.resolve(5), options);
    expect(messages.length).toBe(1);
    await waitsFor(
      () => messages.length === 2,
      'It should publish a second message',
      100,
    );
  });

  it("should send the 'done' message even if the promise rejects", async () => {
    singleton
      .reportBusyWhile('foo', () => Promise.reject(new Error()), options)
      .catch(() => {});
    expect(messages.length).toBe(1);
    await waitsFor(
      () => messages.length === 2,
      'It should publish a second message',
      100,
    );
  });

  it('should properly display duplicate messages', () => {
    const dispose1 = singleton.reportBusy('foo', options);
    expect(messages.length).toBe(1);
    expect(messages[0]).toEqual(['foo']);

    const dispose2 = singleton.reportBusy('foo', options);
    expect(messages.length).toBe(2);
    expect(messages[1]).toEqual(['foo', 'foo']);

    dispose2.dispose();
    expect(messages.length).toBe(3);
    expect(messages[2]).toEqual(['foo']);

    dispose1.dispose();
    expect(messages.length).toBe(4);
    expect(messages[3]).toEqual([]);
  });

  describe('when onlyForFile is provided', () => {
    let editor1: atom$TextEditor = (null: any);
    let editor2: atom$TextEditor = (null: any);
    let editor3: atom$TextEditor = (null: any);
    let file2;

    beforeEach(async () => {
      editor1 = await atom.workspace.open(await fsPromise.tempfile());
      file2 = await fsPromise.tempfile();
      editor2 = await atom.workspace.open(file2);
      editor3 = await atom.workspace.open();
    });

    afterEach(() => {
      [editor1, editor2, editor3].forEach(editor => editor.destroy());
    });

    it('should only display for the proper text editor', () => {
      atom.workspace.getActivePane().activateItem(editor1);

      const disposable = singleton.reportBusy('foo', {
        onlyForFile: file2,
        ...options,
      });
      expect(messages).toEqual([]);

      atom.workspace.getActivePane().activateItem(editor2);
      expect(messages.length).toBe(1);
      expect(messages[0]).toEqual(['foo']);

      atom.workspace.getActivePane().activateItem(editor3);
      expect(messages.length).toBe(2);
      expect(messages[1]).toEqual([]);

      atom.workspace.getActivePane().activateItem(editor2);
      expect(messages.length).toBe(3);
      expect(messages[2]).toEqual(['foo']);

      disposable.dispose();
      expect(messages.length).toBe(4);
      expect(messages[3]).toEqual([]);
    });
  });

  it('correctly sets revealTooltip when provided', async () => {
    function getCurrentMessages() {
      return messageStore
        .getMessageStream()
        .take(1)
        .toPromise();
    }

    singleton.reportBusy('foo', {
      debounce: false,
      revealTooltip: true,
    });
    const curMessages = await getCurrentMessages();
    expect(curMessages.length).toBe(1);
    expect(curMessages[0].shouldRevealTooltip()).toBe(true);
  });
});
