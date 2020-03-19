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
import type {Observable} from 'rxjs';

import os from 'os';
import invariant from 'assert';
import {FileCache} from '../../nuclide-open-files-rpc/lib/FileCache';
import {
  reset,
  getFileVersionOfBuffer,
  getNotifierByConnection,
} from '../lib/main';
import {Point, TextBuffer} from 'atom';
import {getBufferAtVersion} from '../../nuclide-open-files-rpc';

describe('nuclide-open-files', () => {
  let notifier: FileCache = (null: any);

  async function getFileCache(): Promise<FileCache> {
    const cache = await getNotifierByConnection(null);
    invariant(cache != null);
    return (cache: any);
  }

  describe('observeFileEvents', () => {
    beforeEach(async () => {
      reset();
      notifier = await getFileCache();
    });

    let events: Observable<Object> = (null: any);

    beforeEach(async () => {
      events = (await getFileCache()).observeFileEvents().map(event => {
        const result = {
          ...event,
          filePath: event.fileVersion.filePath,
          changeCount: event.fileVersion.version,
        };
        delete result.fileVersion;
        return result;
      });
    });

    it('open/close', async () => {
      const actual = events
        .take(2)
        .toArray()
        .toPromise();
      const buffer = new TextBuffer({filePath: 'f1', text: 'contents1'});
      // simulates an open
      atom.project.addBuffer(buffer);
      // Wait one turn before destroying the text buffer, which calls `setText('')`.
      await Promise.resolve();
      // close
      buffer.destroy();

      expect(await actual).toEqual([
        {
          kind: 'open',
          filePath: 'f1',
          changeCount: 1,
          contents: 'contents1',
          languageId: 'text.plain.null-grammar',
        },
        {
          kind: 'close',
          filePath: 'f1',
          changeCount: 1,
        },
      ]);
    });

    it('open with delayed load sends initial open event after load', async () => {
      const actual = events
        .take(2)
        .toArray()
        .toPromise();
      const buffer = new TextBuffer({filePath: 'f1'});
      // simulates an open
      atom.project.addBuffer(buffer);

      // simulates a load ...
      buffer.setText('contents1');

      // Wait one turn before destroying the text buffer, which calls `setText('')`.
      await Promise.resolve();

      // close
      buffer.destroy();

      expect(await actual).toEqual([
        {
          kind: 'open',
          filePath: 'f1',
          changeCount: 2,
          contents: 'contents1',
          languageId: 'text.plain.null-grammar',
        },
        {
          kind: 'close',
          filePath: 'f1',
          changeCount: 2,
        },
      ]);
    });

    it('edit', async () => {
      const buffer = new TextBuffer({filePath: 'f1', text: 'contents1'});
      atom.project.addBuffer(buffer);
      const firstEvents = await events
        .take(1)
        .toArray()
        .toPromise();

      buffer.append('42');

      buffer.destroy();
      const secondEvents = await events
        .take(2)
        .toArray()
        .toPromise();

      expect([...firstEvents, ...secondEvents]).toEqual([
        {
          kind: 'open',
          filePath: 'f1',
          changeCount: 1,
          contents: 'contents1',
          languageId: 'text.plain.null-grammar',
        },
        {
          kind: 'edit',
          filePath: 'f1',
          changeCount: 2,
          oldRange: {
            start: {row: 0, column: 9},
            end: {row: 0, column: 9},
          },
          oldText: '',
          newRange: {
            start: {row: 0, column: 9},
            end: {row: 0, column: 11},
          },
          newText: '42',
        },
        {
          kind: 'close',
          filePath: 'f1',
          changeCount: 2,
        },
      ]);
    });

    it('edit with multiple edits', async () => {
      const buffer = new TextBuffer({filePath: 'f1', text: 'contents1'});
      atom.project.addBuffer(buffer);
      const firstEvents = await events
        .take(1)
        .toArray()
        .toPromise();

      buffer.transact(() => {
        buffer.insert(new Point(0, 0), 'a');
        buffer.append('b');
      });
      buffer.destroy();
      const secondEvents = await events
        .take(3)
        .toArray()
        .toPromise();

      expect([...firstEvents, ...secondEvents]).toEqual([
        {
          kind: 'open',
          filePath: 'f1',
          changeCount: 1,
          contents: 'contents1',
          languageId: 'text.plain.null-grammar',
        },
        {
          kind: 'edit',
          filePath: 'f1',
          changeCount: 2,
          oldRange: {
            start: {row: 0, column: 9},
            end: {row: 0, column: 9},
          },
          oldText: '',
          newRange: {
            start: {row: 0, column: 10},
            end: {row: 0, column: 11},
          },
          newText: 'b',
        },
        {
          kind: 'edit',
          filePath: 'f1',
          changeCount: 3,
          oldRange: {
            start: {row: 0, column: 0},
            end: {row: 0, column: 0},
          },
          oldText: '',
          newRange: {
            start: {row: 0, column: 0},
            end: {row: 0, column: 1},
          },
          newText: 'a',
        },
        {
          kind: 'close',
          filePath: 'f1',
          changeCount: 3,
        },
      ]);
    });

    it('save', async () => {
      const buffer = new TextBuffer({filePath: 'f1', text: 'contents1'});
      atom.project.addBuffer(buffer);
      const firstEvents = await events
        .take(1)
        .toArray()
        .toPromise();

      buffer.save();
      const secondEvents = await events
        .take(1)
        .toArray()
        .toPromise();

      buffer.destroy();
      const thirdEvents = await events
        .take(1)
        .toArray()
        .toPromise();

      expect([...firstEvents, ...secondEvents, ...thirdEvents]).toEqual([
        {
          kind: 'open',
          filePath: 'f1',
          changeCount: 1,
          contents: 'contents1',
          languageId: 'text.plain.null-grammar',
        },
        {
          kind: 'save',
          filePath: 'f1',
          changeCount: 1,
        },
        {
          kind: 'close',
          filePath: 'f1',
          changeCount: 1,
        },
      ]);
    });

    it('rename', async () => {
      const buffer = new TextBuffer({filePath: 'f1', text: 'contents1'});
      atom.project.addBuffer(buffer);
      const firstEvents = await events
        .take(1)
        .toArray()
        .toPromise();
      // $FlowIgnore: spec
      buffer.setPath('f2');

      const secondEventsPromise = events
        .take(3)
        .toArray()
        .toPromise();

      // Wait one turn before destroying the text buffer, which calls `setText('')`.
      await Promise.resolve();

      buffer.destroy();
      const secondEvents = await secondEventsPromise;

      expect([...firstEvents, ...secondEvents]).toEqual([
        {
          kind: 'open',
          filePath: 'f1',
          changeCount: 1,
          contents: 'contents1',
          languageId: 'text.plain.null-grammar',
        },
        {
          kind: 'close',
          filePath: 'f1',
          changeCount: 1,
        },
        {
          kind: 'open',
          filePath: 'f2',
          changeCount: 1,
          contents: 'contents1',
          languageId: 'text.plain.null-grammar',
        },
        {
          kind: 'close',
          filePath: 'f2',
          changeCount: 1,
        },
      ]);
    });

    it('rename new file', async () => {
      const buffer = new TextBuffer('contents1');
      atom.project.addBuffer(buffer);

      // $FlowIgnore: spec
      buffer.setPath('f2');
      const eventsPromise = events
        .take(2)
        .toArray()
        .toPromise();

      // Wait one turn before destroying the text buffer, which calls `setText('')`.
      await Promise.resolve();

      buffer.destroy();

      expect(await eventsPromise).toEqual([
        {
          kind: 'open',
          filePath: 'f2',
          changeCount: 1,
          contents: 'contents1',
          languageId: 'text.plain.null-grammar',
        },
        {
          kind: 'close',
          filePath: 'f2',
          changeCount: 1,
        },
      ]);
    });

    it('open new file and paste immediately', async () => {
      const buffer = new TextBuffer({filePath: 'f1', text: ''});
      atom.project.addBuffer(buffer);
      buffer.append('\n');
      buffer.append('contents1');
      buffer.destroy();

      const actualEvents = await events
        .take(3)
        .toArray()
        .toPromise();

      expect([...actualEvents]).toEqual([
        {
          kind: 'open',
          filePath: 'f1',
          changeCount: 2,
          contents: '\n',
          languageId: 'text.plain.null-grammar',
        },
        {
          kind: 'edit',
          filePath: 'f1',
          changeCount: 3,
          newRange: {
            start: {
              column: 0,
              row: 1,
            },
            end: {
              column: 9,
              row: 1,
            },
          },
          newText: 'contents1',
          oldRange: {
            start: {
              column: 0,
              row: 1,
            },
            end: {
              column: 0,
              row: 1,
            },
          },
          oldText: '',
        },
        {
          kind: 'close',
          filePath: 'f1',
          changeCount: 3,
        },
      ]);
    });
  });

  describe('observeDirectoryEvents', () => {
    beforeEach(async () => {
      reset();
      notifier = await getFileCache();
    });

    let evts: Observable<Array<string>>;

    beforeEach(async () => {
      evts = (await getFileCache()).observeDirectoryEvents().map(dirs =>
        Array.from(dirs).filter(
          dir =>
            !dir.includes(
              // apm test adds a project using os.tempdir() as the path.
              // Exclude all directories rooted in the OS's default tmp dir.
              // https://github.com/atom/atom/pull/15990/files
              os.tmpdir(),
            ),
        ),
      );
    });

    it('Initially', async () => {
      const events = evts
        .take(1)
        .toArray()
        .toPromise();

      expect(await events).toEqual([[]]);
    });

    it('open a dir', async () => {
      const dir = __dirname;

      const events = evts
        .take(2)
        .toArray()
        .toPromise();
      atom.project.addPath(dir);

      expect(await events).toEqual([[], [dir]]);
    });
  });

  describe('getBufferAtVersion', () => {
    beforeEach(async () => {
      reset();
      notifier = await getFileCache();
    });

    it('get current version', async () => {
      const buffer = new TextBuffer({
        notifier,
        filePath: 'f1',
        text: 'contents1',
      });
      atom.project.addBuffer(buffer);

      const fileVersion = await getFileVersionOfBuffer(buffer);
      invariant(fileVersion != null);
      const serverBuffer = await getBufferAtVersion(fileVersion);
      invariant(serverBuffer != null);
      expect(serverBuffer.getText()).toEqual('contents1');

      buffer.destroy();
    });

    it('safely handles destroyed buffers', async () => {
      const buffer = new TextBuffer({
        notifier,
        filePath: 'f1',
        text: 'contents1',
      });
      atom.project.addBuffer(buffer);
      atom.project.removeBuffer(buffer);

      const fileVersion = await getFileVersionOfBuffer(buffer);
      expect(fileVersion).toBe(null);
    });

    it('get next version', async () => {
      const buffer = new TextBuffer({filePath: 'f1', text: 'contents1'});
      atom.project.addBuffer(buffer);

      const fileVersion = await getFileVersionOfBuffer(buffer);
      invariant(fileVersion != null);
      fileVersion.version++;
      const serverBufferPromise = getBufferAtVersion(fileVersion);

      buffer.append('42');

      invariant(serverBufferPromise != null);
      const serverBuffer = await serverBufferPromise;
      invariant(serverBuffer != null);
      expect(serverBuffer.getText()).toEqual('contents142');

      buffer.destroy();
    });

    it('get out of date version', async () => {
      const buffer = new TextBuffer({filePath: 'f1', text: 'contents1'});
      atom.project.addBuffer(buffer);

      const outdatedFileVersion = await getFileVersionOfBuffer(buffer);
      invariant(outdatedFileVersion != null);

      buffer.append('42');
      const fileVersion = await getFileVersionOfBuffer(buffer);
      invariant(fileVersion != null);
      await getBufferAtVersion(fileVersion);

      const result = await getBufferAtVersion(outdatedFileVersion);
      expect(result).toBe(null);

      buffer.destroy();
    });

    it('get version before file opens', async () => {
      const serverBufferPromise = getBufferAtVersion({
        notifier,
        filePath: 'f3',
        version: 1,
      });

      const buffer = new TextBuffer({filePath: 'f3', text: 'contents3'});
      atom.project.addBuffer(buffer);

      const serverBuffer = await serverBufferPromise;
      invariant(serverBuffer != null);
      expect(serverBuffer.getText()).toEqual('contents3');

      buffer.destroy();
    });

    it('get out of date version on open', async () => {
      const serverBuffer = getBufferAtVersion({
        notifier,
        filePath: 'f3',
        version: 0,
      });

      const buffer = new TextBuffer({filePath: 'f3', text: 'contents1'});
      atom.project.addBuffer(buffer);

      const result = await serverBuffer;

      expect(result).toBe(null);

      buffer.destroy();
    });

    it('get reopened file', async () => {
      const buffer = new TextBuffer({filePath: 'f3', text: 'contents3'});
      atom.project.addBuffer(buffer);

      const fileVersion = await getFileVersionOfBuffer(buffer);
      invariant(fileVersion != null);
      const serverBuffer = await getBufferAtVersion(fileVersion);
      invariant(serverBuffer != null);
      expect(serverBuffer.getText()).toEqual('contents3');

      const receivedClose = (await getFileCache())
        .observeFileEvents()
        .filter(event => event.kind === 'close')
        .take(1)
        .toArray()
        .toPromise();
      buffer.destroy();
      await receivedClose;

      const buffer2 = new TextBuffer({filePath: 'f3', text: 'contents4'});
      atom.project.addBuffer(buffer2);
      const fileVersion2 = await getFileVersionOfBuffer(buffer2);
      invariant(fileVersion2 != null);
      const serverBuffer2 = await getBufferAtVersion(fileVersion2);
      invariant(serverBuffer2 != null);
      expect(serverBuffer2.getText()).toEqual('contents4');

      buffer2.destroy();
    });
  });
});
