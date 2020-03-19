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
import {Subject} from 'rxjs';
import {FileCache} from '../lib/FileCache';
import {Point as ServerPoint, Range as ServerRange} from 'simple-text-buffer';

function fileInfoToObject(fileInfo: {
  buffer: simpleTextBuffer$TextBuffer,
  languageId: string,
}): Object {
  return {
    buffer: {
      text: fileInfo.buffer.getText(),
      changeCount: fileInfo.buffer.changeCount,
    },
    languageId: fileInfo.languageId,
  };
}

function cacheToObject(cache: FileCache): Object {
  const result = {};
  cache._buffers.forEach((fileInfo, filePath) => {
    result[filePath] = fileInfoToObject(fileInfo);
  });
  return result;
}

describe('FileCache', () => {
  let cache: FileCache = (null: any);
  // Initialize with a placeholder
  let finishEvents: () => Promise<Array<Object>> = async () => [];
  let finishDirEvents: () => Promise<Array<Array<string>>> = async () => [];

  async function getFileContentsByVersion(
    filePath,
    changeCount,
  ): Promise<?string> {
    const buffer = await cache.getBufferAtVersion(
      cache.createFileVersion(filePath, changeCount),
    );
    if (buffer == null) {
      return null;
    }
    return buffer.getText();
  }

  beforeEach(() => {
    cache = new FileCache();

    const done = new Subject();
    const events = cache
      .observeFileEvents()
      .takeUntil(done)
      .map(event => {
        const result = {
          ...event,
          filePath: event.fileVersion.filePath,
          changeCount: event.fileVersion.version,
        };
        delete result.fileVersion;
        return result;
      })
      .toArray()
      .toPromise();
    finishEvents = () => {
      done.next();
      done.complete();
      return events;
    };
    const dirEvents = cache
      .observeDirectoryEvents()
      .takeUntil(done)
      .map(dirs => Array.from(dirs))
      .toArray()
      .toPromise();
    finishDirEvents = () => {
      done.next();
      done.complete();
      return dirEvents;
    };
  });

  it('open', async () => {
    cache.onFileEvent({
      kind: 'open',
      fileVersion: {
        notifier: cache,
        filePath: 'f1',
        version: 3,
      },
      contents: 'contents1',
      languageId: 'Babel ES6 JavaScript',
    });
    expect(cacheToObject(cache)).toEqual({
      f1: {
        buffer: {
          text: 'contents1',
          changeCount: 3,
        },
        languageId: 'Babel ES6 JavaScript',
      },
    });
    expect(await finishEvents()).toEqual([
      {
        kind: 'open',
        filePath: 'f1',
        changeCount: 3,
        contents: 'contents1',
        languageId: 'Babel ES6 JavaScript',
      },
    ]);
  });
  it('open/close', async () => {
    cache.onFileEvent({
      kind: 'open',
      fileVersion: {
        notifier: cache,
        filePath: 'f1',
        version: 3,
      },
      contents: 'contents1',
      languageId: 'Babel ES6 JavaScript',
    });
    cache.onFileEvent({
      kind: 'close',
      fileVersion: {
        notifier: cache,
        filePath: 'f1',
        version: 3,
      },
    });
    expect(cacheToObject(cache)).toEqual({});
    expect(await finishEvents()).toEqual([
      {
        kind: 'open',
        filePath: 'f1',
        changeCount: 3,
        contents: 'contents1',
        languageId: 'Babel ES6 JavaScript',
      },
      {
        kind: 'close',
        filePath: 'f1',
        changeCount: 3,
      },
    ]);
  });
  it('edit', async () => {
    cache.onFileEvent({
      kind: 'open',
      fileVersion: {
        notifier: cache,
        filePath: 'f1',
        version: 3,
      },
      contents: 'contents1',
      languageId: 'Babel ES6 JavaScript',
    });
    cache.onFileEvent({
      kind: 'edit',
      fileVersion: {
        notifier: cache,
        filePath: 'f1',
        version: 4,
      },
      oldRange: new ServerRange(new ServerPoint(0, 3), new ServerPoint(0, 6)),
      oldText: 'ten',
      newRange: new ServerRange(new ServerPoint(0, 3), new ServerPoint(0, 9)),
      newText: 'eleven',
    });
    expect(await finishEvents()).toMatchSnapshot();
  });
  it('sync closed file', async () => {
    cache.onFileEvent({
      kind: 'sync',
      fileVersion: {
        notifier: cache,
        filePath: 'f2',
        version: 4,
      },
      contents: 'contents12',
      languageId: 'Babel ES6 JavaScript',
    });
    expect(cacheToObject(cache)).toEqual({
      f2: {
        buffer: {
          text: 'contents12',
          changeCount: 4,
        },
        languageId: 'Babel ES6 JavaScript',
      },
    });
    expect(await finishEvents()).toEqual([
      {
        kind: 'open',
        filePath: 'f2',
        changeCount: 4,
        contents: 'contents12',
        languageId: 'Babel ES6 JavaScript',
      },
    ]);
  });
  it('sync opened file', async () => {
    cache.onFileEvent({
      kind: 'open',
      fileVersion: {
        notifier: cache,
        filePath: 'f2',
        version: 4,
      },
      contents: 'blip',
      languageId: 'Babel ES6 JavaScript',
    });
    cache.onFileEvent({
      kind: 'sync',
      fileVersion: {
        notifier: cache,
        filePath: 'f2',
        version: 42,
      },
      contents: 'contents12',
      languageId: 'Babel ES6 JavaScript',
    });
    expect(cacheToObject(cache)).toEqual({
      f2: {
        buffer: {
          text: 'contents12',
          changeCount: 42,
        },
        languageId: 'Babel ES6 JavaScript',
      },
    });
    expect(JSON.stringify(await finishEvents())).toEqual(
      JSON.stringify([
        {
          kind: 'open',
          contents: 'blip',
          languageId: 'Babel ES6 JavaScript',
          filePath: 'f2',
          changeCount: 4,
        },
        {
          kind: 'edit',
          oldRange: {
            start: {row: 0, column: 0},
            end: {row: 0, column: 4},
          },
          oldText: 'blip',
          newRange: {
            start: {row: 0, column: 0},
            end: {row: 0, column: 10},
          },
          newText: 'contents12',
          filePath: 'f2',
          changeCount: 42,
        },
      ]),
    );
  });
  it('out of date sync', async () => {
    cache.onFileEvent({
      kind: 'open',
      fileVersion: {
        notifier: cache,
        filePath: 'f2',
        version: 42,
      },
      contents: 'blip',
      languageId: 'Babel ES6 JavaScript',
    });
    cache.onFileEvent({
      kind: 'sync',
      fileVersion: {
        notifier: cache,
        filePath: 'f2',
        version: 4,
      },
      contents: 'contents12',
      languageId: 'Babel ES6 JavaScript',
    });
    expect(cacheToObject(cache)).toEqual({
      f2: {
        buffer: {
          text: 'blip',
          changeCount: 42,
        },
        languageId: 'Babel ES6 JavaScript',
      },
    });
    expect(JSON.stringify(await finishEvents())).toMatchSnapshot();
  });

  // Unexpected Operations Should Throw
  it('open existing file', async () => {
    cache.onFileEvent({
      kind: 'open',
      fileVersion: {
        notifier: cache,
        filePath: 'f1',
        version: 3,
      },
      contents: 'contents1',
      languageId: 'Babel ES6 JavaScript',
    });
    expect(() => {
      cache.onFileEvent({
        kind: 'open',
        fileVersion: {
          notifier: cache,
          filePath: 'f1',
          version: 3,
        },
        contents: 'contents1',
        languageId: 'Babel ES6 JavaScript',
      });
    }).toThrow();
    expect(await finishEvents()).toEqual([
      {
        kind: 'open',
        filePath: 'f1',
        changeCount: 3,
        contents: 'contents1',
        languageId: 'Babel ES6 JavaScript',
      },
    ]);
  });
  it('close non-existing file', async () => {
    expect(() => {
      cache.onFileEvent({
        kind: 'close',
        fileVersion: {
          notifier: cache,
          filePath: 'f1',
          version: 3,
        },
      });
    }).not.toThrow();
    expect(await finishEvents()).toEqual([]);
  });
  it('edit closed file', async () => {
    expect(() => {
      cache.onFileEvent({
        kind: 'edit',
        fileVersion: {
          notifier: cache,
          filePath: 'f1',
          version: 4,
        },
        oldRange: new ServerRange(new ServerPoint(0, 3), new ServerPoint(0, 6)),
        oldText: 'ten',
        newRange: new ServerRange(new ServerPoint(0, 3), new ServerPoint(0, 9)),
        newText: 'eleven',
      });
    }).toThrow();
    expect(await finishEvents()).toEqual([]);
  });
  it('edit with non-sequential version', async () => {
    cache.onFileEvent({
      kind: 'open',
      fileVersion: {
        notifier: cache,
        filePath: 'f1',
        version: 3,
      },
      oldRange: {
        start: {row: 0, column: 3},
        end: {row: 0, column: 6},
      },
      contents: 'contents1',
      languageId: 'Babel ES6 JavaScript',
    });
    expect(() => {
      cache.onFileEvent({
        kind: 'edit',
        fileVersion: {
          notifier: cache,
          filePath: 'f1',
          version: 5,
        },
        oldRange: new ServerRange(new ServerPoint(0, 3), new ServerPoint(0, 6)),
        oldText: 'ten',
        newRange: new ServerRange(new ServerPoint(0, 3), new ServerPoint(0, 9)),
        newText: 'eleven',
      });
    }).toThrow();
    expect(await finishEvents()).toEqual([
      {
        kind: 'open',
        languageId: 'Babel ES6 JavaScript',
        filePath: 'f1',
        changeCount: 3,
        contents: 'contents1',
      },
    ]);
  });
  it('edit with incorrect oldText', async () => {
    cache.onFileEvent({
      kind: 'open',
      fileVersion: {
        notifier: cache,
        filePath: 'f1',
        version: 3,
      },
      contents: 'contents1',
      languageId: 'Babel ES6 JavaScript',
    });
    expect(() => {
      cache.onFileEvent({
        kind: 'edit',
        fileVersion: {
          notifier: cache,
          filePath: 'f1',
          version: 4,
        },
        oldRange: new ServerRange(new ServerPoint(0, 3), new ServerPoint(0, 6)),
        oldText: 'one',
        newRange: new ServerRange(new ServerPoint(0, 3), new ServerPoint(0, 9)),
        newText: 'eleven',
      });
    }).toThrow();
    expect(await finishEvents()).toEqual([
      {
        kind: 'open',
        filePath: 'f1',
        changeCount: 3,
        contents: 'contents1',
        languageId: 'Babel ES6 JavaScript',
      },
    ]);
  });

  // getBufferAtVersion
  it('getBufferAtVersion on current version', async () => {
    cache.onFileEvent({
      kind: 'open',
      fileVersion: {
        notifier: cache,
        filePath: 'f1',
        version: 3,
      },
      contents: 'contents1',
      languageId: 'Babel ES6 JavaScript',
    });
    const result = await getFileContentsByVersion('f1', 3);
    expect(result).toBe('contents1');
  });
  it('getBufferAtVersion on out of date version', async () => {
    cache.onFileEvent({
      kind: 'open',
      fileVersion: {
        notifier: cache,
        filePath: 'f1',
        version: 3,
      },
      contents: 'contents1',
      languageId: 'Babel ES6 JavaScript',
    });
    const value = await getFileContentsByVersion('f1', 2);
    expect(value).toBe(null);
  });
  it('getBufferAtVersion on next version', async () => {
    cache.onFileEvent({
      kind: 'open',
      fileVersion: {
        notifier: cache,
        filePath: 'f1',
        version: 3,
      },
      contents: 'contents1',
      languageId: 'Babel ES6 JavaScript',
    });
    const result = getFileContentsByVersion('f1', 4);
    cache.onFileEvent({
      kind: 'edit',
      fileVersion: {
        notifier: cache,
        filePath: 'f1',
        version: 4,
      },
      oldRange: new ServerRange(new ServerPoint(0, 3), new ServerPoint(0, 6)),
      oldText: 'ten',
      newRange: new ServerRange(new ServerPoint(0, 3), new ServerPoint(0, 9)),
      newText: 'eleven',
    });
    const value = await result;
    expect(value).toBe('conelevents1');
  });
  it('getBufferAtVersion before open', async () => {
    const result = getFileContentsByVersion('f1', 3);
    cache.onFileEvent({
      kind: 'open',
      fileVersion: {
        notifier: cache,
        filePath: 'f1',
        version: 3,
      },
      contents: 'contents1',
      languageId: 'Babel ES6 JavaScript',
    });
    const value = await result;
    expect(value).toBe('contents1');
  });
  it('getBufferAtVersion on out of date version before open', async () => {
    const result = getFileContentsByVersion('f1', 2);
    cache.onFileEvent({
      kind: 'open',
      fileVersion: {
        notifier: cache,
        filePath: 'f1',
        version: 3,
      },
      contents: 'contents1',
      languageId: 'Babel ES6 JavaScript',
    });
    expect(await result).toBe(null);
  });
  it('getBufferAtVersion on sync open', async () => {
    const result = getFileContentsByVersion('f1', 3);
    cache.onFileEvent({
      kind: 'sync',
      fileVersion: {
        notifier: cache,
        filePath: 'f1',
        version: 3,
      },
      contents: 'contents1',
      languageId: 'Babel ES6 JavaScript',
    });
    const value = await result;
    expect(value).toBe('contents1');
  });
  it('getBufferAtVersion on sync edit', async () => {
    const result = getFileContentsByVersion('f1', 6);
    cache.onFileEvent({
      kind: 'open',
      fileVersion: {
        notifier: cache,
        filePath: 'f1',
        version: 3,
      },
      contents: 'contents1',
      languageId: 'Babel ES6 JavaScript',
    });
    cache.onFileEvent({
      kind: 'sync',
      fileVersion: {
        notifier: cache,
        filePath: 'f1',
        version: 6,
      },
      contents: 'contents6',
      languageId: 'Babel ES6 JavaScript',
    });
    const value = await result;
    expect(value).toBe('contents6');
  });
  it('getBufferAtVersion on reopened file', async () => {
    const result1 = getFileContentsByVersion('f1', 3);
    cache.onFileEvent({
      kind: 'open',
      fileVersion: {
        notifier: cache,
        filePath: 'f1',
        version: 3,
      },
      contents: 'contents1',
      languageId: 'Babel ES6 JavaScript',
    });
    expect(await result1).toBe('contents1');
    cache.onFileEvent({
      kind: 'close',
      fileVersion: {
        notifier: cache,
        filePath: 'f1',
        version: 4,
      },
    });

    const result2 = getFileContentsByVersion('f1', 4);
    cache.onFileEvent({
      kind: 'open',
      fileVersion: {
        notifier: cache,
        filePath: 'f1',
        version: 4,
      },
      contents: 'contents-reopened',
      languageId: 'Babel ES6 JavaScript',
    });
    expect(await result2).toBe('contents-reopened');
  });
  it('Initial dirs', async () => {
    expect(await finishDirEvents()).toEqual([[]]);
  });
  it('Single dir', async () => {
    cache.onDirectoriesChanged(new Set(['abc']));
    expect(await finishDirEvents()).toEqual([[], ['abc']]);
  });

  afterEach(() => {
    cache.dispose();
    cache = (null: any);
  });
});
