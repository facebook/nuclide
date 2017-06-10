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

import {Subject} from 'rxjs';
import {FileCache} from '../lib/FileCache';
import {Point as ServerPoint, Range as ServerRange} from 'simple-text-buffer';
import {addMatchers} from '../../nuclide-test-helpers';

function bufferToObject(buffer: simpleTextBuffer$TextBuffer): Object {
  return {
    text: buffer.getText(),
    changeCount: buffer.changeCount,
  };
}

function cacheToObject(cache: FileCache): Object {
  const result = {};
  cache._buffers.forEach((buffer, filePath) => {
    result[filePath] = bufferToObject(buffer);
  });
  return result;
}

describe('FileCache', () => {
  beforeEach(function() {
    addMatchers(this);
  });

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

  it('open', () => {
    waitsForPromise(async () => {
      cache.onFileEvent({
        kind: 'open',
        fileVersion: {
          notifier: cache,
          filePath: 'f1',
          version: 3,
        },
        contents: 'contents1',
      });
      expect(cacheToObject(cache)).toEqual({
        f1: {
          text: 'contents1',
          changeCount: 3,
        },
      });
      expect(await finishEvents()).toEqual([
        {
          kind: 'open',
          filePath: 'f1',
          changeCount: 3,
          contents: 'contents1',
        },
      ]);
    });
  });
  it('open/close', () => {
    waitsForPromise(async () => {
      cache.onFileEvent({
        kind: 'open',
        fileVersion: {
          notifier: cache,
          filePath: 'f1',
          version: 3,
        },
        contents: 'contents1',
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
        },
        {
          kind: 'close',
          filePath: 'f1',
          changeCount: 3,
        },
      ]);
    });
  });
  it('edit', () => {
    waitsForPromise(async () => {
      cache.onFileEvent({
        kind: 'open',
        fileVersion: {
          notifier: cache,
          filePath: 'f1',
          version: 3,
        },
        contents: 'contents1',
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
      expect(await finishEvents()).diffJson([
        {
          kind: 'open',
          filePath: 'f1',
          changeCount: 3,
          contents: 'contents1',
        },
        {
          kind: 'edit',
          filePath: 'f1',
          changeCount: 4,
          oldRange: {
            start: {row: 0, column: 3},
            end: {row: 0, column: 6},
          },
          oldText: 'ten',
          newRange: {
            start: {row: 0, column: 3},
            end: {row: 0, column: 9},
          },
          newText: 'eleven',
        },
      ]);
    });
  });
  it('sync closed file', () => {
    waitsForPromise(async () => {
      cache.onFileEvent({
        kind: 'sync',
        fileVersion: {
          notifier: cache,
          filePath: 'f2',
          version: 4,
        },
        contents: 'contents12',
      });
      expect(cacheToObject(cache)).toEqual({
        f2: {
          text: 'contents12',
          changeCount: 4,
        },
      });
      expect(await finishEvents()).toEqual([
        {
          kind: 'open',
          filePath: 'f2',
          changeCount: 4,
          contents: 'contents12',
        },
      ]);
    });
  });
  it('sync opened file', () => {
    waitsForPromise(async () => {
      cache.onFileEvent({
        kind: 'open',
        fileVersion: {
          notifier: cache,
          filePath: 'f2',
          version: 4,
        },
        contents: 'blip',
      });
      cache.onFileEvent({
        kind: 'sync',
        fileVersion: {
          notifier: cache,
          filePath: 'f2',
          version: 42,
        },
        contents: 'contents12',
      });
      expect(cacheToObject(cache)).toEqual({
        f2: {
          text: 'contents12',
          changeCount: 42,
        },
      });
      expect(JSON.stringify(await finishEvents())).toEqual(
        JSON.stringify([
          {
            kind: 'open',
            contents: 'blip',
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
  });
  it('out of date sync', () => {
    waitsForPromise(async () => {
      cache.onFileEvent({
        kind: 'open',
        fileVersion: {
          notifier: cache,
          filePath: 'f2',
          version: 42,
        },
        contents: 'blip',
      });
      cache.onFileEvent({
        kind: 'sync',
        fileVersion: {
          notifier: cache,
          filePath: 'f2',
          version: 4,
        },
        contents: 'contents12',
      });
      expect(cacheToObject(cache)).toEqual({
        f2: {
          text: 'blip',
          changeCount: 42,
        },
      });
      expect(JSON.stringify(await finishEvents())).toEqual(
        JSON.stringify([
          {
            kind: 'open',
            contents: 'blip',
            filePath: 'f2',
            changeCount: 42,
          },
        ]),
      );
    });
  });

  // Unexpected Operations Should Throw
  it('open existing file', () => {
    waitsForPromise(async () => {
      cache.onFileEvent({
        kind: 'open',
        fileVersion: {
          notifier: cache,
          filePath: 'f1',
          version: 3,
        },
        contents: 'contents1',
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
        });
      }).toThrow();
      expect(await finishEvents()).toEqual([
        {
          kind: 'open',
          filePath: 'f1',
          changeCount: 3,
          contents: 'contents1',
        },
      ]);
    });
  });
  it('close non-existing file', () => {
    waitsForPromise(async () => {
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
  });
  it('edit closed file', () => {
    waitsForPromise(async () => {
      expect(() => {
        cache.onFileEvent({
          kind: 'edit',
          fileVersion: {
            notifier: cache,
            filePath: 'f1',
            version: 4,
          },
          oldRange: new ServerRange(
            new ServerPoint(0, 3),
            new ServerPoint(0, 6),
          ),
          oldText: 'ten',
          newRange: new ServerRange(
            new ServerPoint(0, 3),
            new ServerPoint(0, 9),
          ),
          newText: 'eleven',
        });
      }).toThrow();
      expect(await finishEvents()).toEqual([]);
    });
  });
  it('edit with non-sequential version', () => {
    waitsForPromise(async () => {
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
      });
      expect(() => {
        cache.onFileEvent({
          kind: 'edit',
          fileVersion: {
            notifier: cache,
            filePath: 'f1',
            version: 5,
          },
          oldRange: new ServerRange(
            new ServerPoint(0, 3),
            new ServerPoint(0, 6),
          ),
          oldText: 'ten',
          newRange: new ServerRange(
            new ServerPoint(0, 3),
            new ServerPoint(0, 9),
          ),
          newText: 'eleven',
        });
      }).toThrow();
      expect(await finishEvents()).toEqual([
        {
          kind: 'open',
          filePath: 'f1',
          changeCount: 3,
          contents: 'contents1',
        },
      ]);
    });
  });
  it('edit with incorrect oldText', () => {
    waitsForPromise(async () => {
      cache.onFileEvent({
        kind: 'open',
        fileVersion: {
          notifier: cache,
          filePath: 'f1',
          version: 3,
        },
        contents: 'contents1',
      });
      expect(() => {
        cache.onFileEvent({
          kind: 'edit',
          fileVersion: {
            notifier: cache,
            filePath: 'f1',
            version: 4,
          },
          oldRange: new ServerRange(
            new ServerPoint(0, 3),
            new ServerPoint(0, 6),
          ),
          oldText: 'one',
          newRange: new ServerRange(
            new ServerPoint(0, 3),
            new ServerPoint(0, 9),
          ),
          newText: 'eleven',
        });
      }).toThrow();
      expect(await finishEvents()).toEqual([
        {
          kind: 'open',
          filePath: 'f1',
          changeCount: 3,
          contents: 'contents1',
        },
      ]);
    });
  });

  // getBufferAtVersion
  it('getBufferAtVersion on current version', () => {
    waitsForPromise(async () => {
      cache.onFileEvent({
        kind: 'open',
        fileVersion: {
          notifier: cache,
          filePath: 'f1',
          version: 3,
        },
        contents: 'contents1',
      });
      const result = await getFileContentsByVersion('f1', 3);
      expect(result).toBe('contents1');
    });
  });
  it('getBufferAtVersion on out of date version', () => {
    waitsForPromise(async () => {
      cache.onFileEvent({
        kind: 'open',
        fileVersion: {
          notifier: cache,
          filePath: 'f1',
          version: 3,
        },
        contents: 'contents1',
      });
      const value = await getFileContentsByVersion('f1', 2);
      expect(value).toBe(null);
    });
  });
  it('getBufferAtVersion on next version', () => {
    waitsForPromise(async () => {
      cache.onFileEvent({
        kind: 'open',
        fileVersion: {
          notifier: cache,
          filePath: 'f1',
          version: 3,
        },
        contents: 'contents1',
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
  });
  it('getBufferAtVersion before open', () => {
    waitsForPromise(async () => {
      const result = getFileContentsByVersion('f1', 3);
      cache.onFileEvent({
        kind: 'open',
        fileVersion: {
          notifier: cache,
          filePath: 'f1',
          version: 3,
        },
        contents: 'contents1',
      });
      const value = await result;
      expect(value).toBe('contents1');
    });
  });
  it('getBufferAtVersion on out of date version before open', () => {
    const result = getFileContentsByVersion('f1', 2);
    waitsForPromise(async () => {
      cache.onFileEvent({
        kind: 'open',
        fileVersion: {
          notifier: cache,
          filePath: 'f1',
          version: 3,
        },
        contents: 'contents1',
      });
      expect(await result).toBe(null);
    });
  });
  it('getBufferAtVersion on sync open', () => {
    waitsForPromise(async () => {
      const result = getFileContentsByVersion('f1', 3);
      cache.onFileEvent({
        kind: 'sync',
        fileVersion: {
          notifier: cache,
          filePath: 'f1',
          version: 3,
        },
        contents: 'contents1',
      });
      const value = await result;
      expect(value).toBe('contents1');
    });
  });
  it('getBufferAtVersion on sync edit', () => {
    waitsForPromise(async () => {
      const result = getFileContentsByVersion('f1', 6);
      cache.onFileEvent({
        kind: 'open',
        fileVersion: {
          notifier: cache,
          filePath: 'f1',
          version: 3,
        },
        contents: 'contents1',
      });
      cache.onFileEvent({
        kind: 'sync',
        fileVersion: {
          notifier: cache,
          filePath: 'f1',
          version: 6,
        },
        contents: 'contents6',
      });
      const value = await result;
      expect(value).toBe('contents6');
    });
  });
  it('getBufferAtVersion on reopened file', () => {
    waitsForPromise(async () => {
      const result1 = getFileContentsByVersion('f1', 3);
      cache.onFileEvent({
        kind: 'open',
        fileVersion: {
          notifier: cache,
          filePath: 'f1',
          version: 3,
        },
        contents: 'contents1',
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
      });
      expect(await result2).toBe('contents-reopened');
    });
  });
  it('Initial dirs', () => {
    waitsForPromise(async () => {
      expect(await finishDirEvents()).toEqual([[]]);
    });
  });
  it('Single dir', () => {
    waitsForPromise(async () => {
      cache.onDirectoriesChanged(new Set(['abc']));
      expect(await finishDirEvents()).toEqual([[], ['abc']]);
    });
  });

  afterEach(() => {
    cache.dispose();
    cache = (null: any);
  });
});
