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

import invariant from 'assert';
import fs from 'fs';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {Directory} from 'atom';
import {RemoteDirectory} from '../lib/RemoteDirectory';
import connectionMock from './connection_mock';
import temp from 'temp';

temp.track();

const FILE_MODE = 33188;

describe('RemoteDirectory', () => {
  it('does have a existsSync() method', () => {
    const remoteDirectory = new RemoteDirectory(
      connectionMock,
      'nuclide://example.com/',
    );
    expect(remoteDirectory.existsSync()).toBe(true);
  });

  it(
    'does not list the property used to mark the directory as remote as one of its enumerable' +
      ' properties.',
    () => {
      const remoteDirectory = new RemoteDirectory(
        connectionMock,
        'nuclide://example.com/',
      );
      for (const property in remoteDirectory) {
        expect(property).not.toBe('__nuclide_remote_directory__');
      }
    },
  );

  describe('::isRemoteDirectory', () => {
    it('distinguishes a RemoteDirectory from a Directory.', () => {
      const remoteDirectory = new RemoteDirectory(
        connectionMock,
        'nuclide://example.com/',
      );
      expect(RemoteDirectory.isRemoteDirectory(remoteDirectory)).toBe(true);

      const localDirectory = new Directory('/Test/Path');
      expect(RemoteDirectory.isRemoteDirectory(localDirectory)).toBe(false);
    });
  });
});

describe('RemoteDirectory::isRoot()', () => {
  it('nuclide://example.com/ is a root', () => {
    const remoteDirectory = new RemoteDirectory(
      connectionMock,
      'nuclide://example.com/',
    );
    expect(remoteDirectory.isRoot()).toBe(true);
  });

  it('nuclide://example.com/path/to/directory is not a root', () => {
    const remoteDirectory = new RemoteDirectory(
      connectionMock,
      'nuclide://example.com/path/to/directory',
    );
    expect(remoteDirectory.isRoot()).toBe(false);
  });
});

describe('RemoteDirectory::getBaseName()', () => {
  it('to handle a root path', () => {
    const remoteDirectory = new RemoteDirectory(
      connectionMock,
      'nuclide://example.com/',
    );
    expect(remoteDirectory.getBaseName()).toBe('');
  });

  it('to handle a non-root path', () => {
    const remoteDirectory = new RemoteDirectory(
      connectionMock,
      'nuclide://example.com/path/to/directory',
    );
    expect(remoteDirectory.getBaseName()).toBe('directory');
  });
});

describe('RemoteDirectory::relativize()', () => {
  it('to relativize a file against a root path', () => {
    const remoteDirectory = new RemoteDirectory(
      connectionMock,
      'nuclide://example.com/',
    );
    expect(remoteDirectory.relativize('nuclide://example.com/foo/bar')).toBe(
      'foo/bar',
    );
  });
});

describe('RemoteDirectory::getEntries()', () => {
  it('sorts directories then files alphabetically case insensitive', () => {
    let complete = false;

    runs(() => {
      // Directories should sort first, then files, and case should be ignored
      spyOn(connectionMock.getFsService(), 'readdir').andReturn([
        ['Aa', true],
        ['a', true],
        ['Bb', false],
        ['b', false],
      ]);
      const remoteDirectory = new RemoteDirectory(
        connectionMock,
        'nuclide://example.com/',
      );

      remoteDirectory.getEntries((err, entries) => {
        expect(err).toBe(null);
        invariant(entries);
        const sortedEntries = entries.map(entry => entry.getBaseName());
        expect(sortedEntries).toEqual(['b', 'Bb', 'a', 'Aa']);
        complete = true;
      });
    });

    waitsFor(() => {
      return complete;
    });
  });

  it("calls the given callback with an error on failure to match node-path-watcher's API", () => {
    let complete = false;

    runs(() => {
      spyOn(connectionMock.getFsService(), 'readdir').andCallFake(() => {
        throw new Error('ENOENT');
      });

      const remoteDirectory = new RemoteDirectory(
        connectionMock,
        'nuclide://example.com/',
      );

      remoteDirectory.getEntries((err, entries) => {
        expect(err).not.toBe(null);
        expect(entries).toBe(null);
        complete = true;
      });
    });

    waitsFor(() => {
      return complete;
    });
  });
});

describe('RemoteDirectory::getParent()', () => {
  it('a root is its own parent', () => {
    const remoteDirectory = new RemoteDirectory(
      connectionMock,
      'nuclide://example.com/',
    );
    expect(remoteDirectory.getParent()).toBe(remoteDirectory);
  });

  it('a non-root has the expected parent', () => {
    const parentDirectory = jasmine.createSpy('RemoteDirectory');
    spyOn(connectionMock, 'createDirectory').andReturn(parentDirectory);

    const remoteDirectory = new RemoteDirectory(
      connectionMock,
      'nuclide://example.com/path/to/directory',
    );
    expect(remoteDirectory.getParent()).toBe(parentDirectory);
    expect(connectionMock.createDirectory).toHaveBeenCalledWith(
      'nuclide://example.com/path/to',
      null,
    );
  });
});

describe('RemoteDirectory::contains()', () => {
  it('returns false when passed undefined path', () => {
    const remoteDirectory = new RemoteDirectory(
      connectionMock,
      'nuclide://example.com/',
    );
    expect(remoteDirectory.contains(undefined)).toBe(false);
  });

  it('returns false when passed null path', () => {
    const remoteDirectory = new RemoteDirectory(
      connectionMock,
      'nuclide://example.com/',
    );
    expect(remoteDirectory.contains(null)).toBe(false);
  });

  it('returns false when passed empty path', () => {
    const remoteDirectory = new RemoteDirectory(
      connectionMock,
      'nuclide://example.com/',
    );
    expect(remoteDirectory.contains('')).toBe(false);
  });

  it('returns true when passed sub directory', () => {
    const remoteDirectory = new RemoteDirectory(
      connectionMock,
      'nuclide://example.com/',
    );
    expect(remoteDirectory.contains('nuclide://example.com/asdf')).toBe(true);
  });

  it('returns false when passed dir at same level with similar name', () => {
    const remoteDirectory = new RemoteDirectory(
      connectionMock,
      'nuclide://example.com/www',
    );
    expect(remoteDirectory.contains('nuclide://example.com/www-base')).toBe(
      false,
    );
  });

  it('returns false when has slash and passed dir with similar name', () => {
    const remoteDirectory = new RemoteDirectory(
      connectionMock,
      'nuclide://example.com/www/',
    );
    expect(remoteDirectory.contains('nuclide://example.com/www-base')).toBe(
      false,
    );
  });
});

describe('RemoteDirectory::getFile()', () => {
  it('returns a RemoteFile under the directory', () => {
    const remoteFile = jasmine.createSpy('RemoteFile');
    spyOn(connectionMock, 'createFile').andReturn(remoteFile);

    const remoteDirectory = new RemoteDirectory(
      connectionMock,
      'nuclide://example.com/path/to/directory',
    );
    expect(remoteDirectory.getFile('foo.txt')).toBe(remoteFile);
    expect(connectionMock.createFile).toHaveBeenCalledWith(
      'nuclide://example.com/path/to/directory/foo.txt',
    );
  });
});

describe('RemoteDirectory::delete()', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = temp.mkdirSync('delete_test');
  });

  it('deletes the existing directory', () => {
    waitsForPromise(async () => {
      const directoryPath = nuclideUri.join(tempDir, 'directory_to_delete');
      fs.mkdirSync(directoryPath);
      fs.mkdirSync(nuclideUri.join(directoryPath, 'subdir'));
      const directory = new RemoteDirectory(
        connectionMock,
        `nuclide://host13${directoryPath}`,
      );
      expect(fs.existsSync(directoryPath)).toBe(true);
      await directory.delete();
      expect(fs.existsSync(directoryPath)).toBe(false);
    });
  });

  it('deletes the non-existent directory', () => {
    waitsForPromise(async () => {
      const directoryPath = nuclideUri.join(tempDir, 'directory_to_delete');
      const directory = new RemoteDirectory(
        connectionMock,
        `nuclide://host13${directoryPath}`,
      );
      await directory.delete();
      expect(fs.existsSync(directoryPath)).toBe(false);
    });
  });
});

describe('RemoteDirectory::exists()', () => {
  it('verifies existence', () => {
    waitsForPromise(async () => {
      const directoryPath = temp.mkdirSync('exists_test');
      expect(fs.existsSync(directoryPath)).toBe(true);

      const directory = new RemoteDirectory(
        connectionMock,
        `nuclide://host13${directoryPath}`,
      );
      const exists = await directory.exists();
      expect(exists).toBe(true);
    });
  });

  it('verifies non-existence', () => {
    waitsForPromise(async () => {
      const tempDir = temp.mkdirSync('exists_test');
      const directoryPath = nuclideUri.join(
        tempDir,
        '/directory_that_doesnt_exist',
      );
      expect(fs.existsSync(directoryPath)).toBe(false);

      const directory = new RemoteDirectory(
        connectionMock,
        `nuclide://host13${directoryPath}`,
      );
      const exists = await directory.exists();
      expect(exists).toBe(false);
    });
  });
});

describe('RemoteDirectory::isSymbolicLink()', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = temp.mkdirSync('rename_test');
  });

  it('verifies symlink', () => {
    const targetDirectoryPath = nuclideUri.join(tempDir, 'target');
    const symLinkedDirectoryPath = nuclideUri.join(tempDir, 'linked');
    fs.mkdirSync(targetDirectoryPath);
    fs.symlinkSync(targetDirectoryPath, symLinkedDirectoryPath, 'dir');
    expect(fs.lstatSync(symLinkedDirectoryPath).isSymbolicLink()).toBe(true);

    const directory = new RemoteDirectory(
      connectionMock,
      `nuclide://host13${symLinkedDirectoryPath}`,
      true,
    );
    const symlink = directory.isSymbolicLink();
    expect(symlink).toBe(true);
  });

  it('verifies non-symlink', () => {
    const notLinkedDirectoryPath = nuclideUri.join(tempDir, 'not_linked');
    fs.mkdirSync(notLinkedDirectoryPath);
    expect(fs.lstatSync(notLinkedDirectoryPath).isSymbolicLink()).toBe(false);

    const directory = new RemoteDirectory(
      connectionMock,
      `nuclide://host13${notLinkedDirectoryPath}`,
      false,
    );
    const symlink = directory.isSymbolicLink();
    expect(symlink).toBe(false);
  });
});

// TODO: #7344702 Re-enable and don't depend on watchman.
// eslint-disable-next-line jasmine/no-disabled-tests
xdescribe('RemoteDirectory::onDidChange()', () => {
  const WATCHMAN_SETTLE_TIME_MS = 1 * 1000;
  let directoryPath;
  let filePath;

  beforeEach(() => {
    jasmine.getEnv().defaultTimeoutInterval = 10000;
    directoryPath = temp.mkdirSync('on_did_change_test');
    filePath = nuclideUri.join(directoryPath, 'sample_file.txt');
    fs.writeFileSync(filePath, 'sample contents!');
    waitsForPromise(() =>
      connectionMock.getFsService().watchDirectoryRecursive(directoryPath),
    );
    // wait for the watchman to settle on the created directory and file.
    waits(WATCHMAN_SETTLE_TIME_MS + /* buffer */ 10);
  });

  afterEach(() => {
    waitsForPromise(() =>
      connectionMock.getFsService().unwatchDirectoryRecursive(directoryPath),
    );
  });

  it('notifies onDidChange observers when a new file is added to the directory', () => {
    const directory = new RemoteDirectory(connectionMock, directoryPath);
    const changeHandler = jasmine.createSpy();
    directory.onDidChange(changeHandler);
    runs(() =>
      fs.writeFileSync(
        nuclideUri.join(directoryPath, 'new_file.txt'),
        'new contents!',
      ),
    );
    waitsFor(() => changeHandler.callCount > 0);
    runs(() => {
      expect(changeHandler.callCount).toBe(1);
      expect(changeHandler.argsForCall[0][0]).toEqual([
        {
          name: 'new_file.txt',
          mode: FILE_MODE,
          exists: true,
          new: true,
        },
      ]);
    });
  });

  it('notifies onDidChange observers when a file is removed from the directory', () => {
    const directory = new RemoteDirectory(connectionMock, directoryPath);
    const changeHandler = jasmine.createSpy();
    directory.onDidChange(changeHandler);
    runs(() => fs.unlinkSync(filePath));
    waitsFor(() => changeHandler.callCount > 0);
    runs(() => {
      expect(changeHandler.callCount).toBe(1);
      expect(changeHandler.argsForCall[0][0]).toEqual([
        {
          name: nuclideUri.basename(filePath),
          mode: FILE_MODE,
          exists: false,
          new: false,
        },
      ]);
    });
  });

  it("Doesn't notify observers when a file is changed contents inside the the directory", () => {
    const directory = new RemoteDirectory(connectionMock, directoryPath);
    const changeHandler = jasmine.createSpy();
    directory.onDidChange(changeHandler);
    fs.writeFileSync(filePath, 'new contents!');
    waits(1000);
    runs(() => expect(changeHandler.callCount).toBe(0));
  });

  it('batches change events into a single call', () => {
    const directory = new RemoteDirectory(connectionMock, directoryPath);
    const changeHandler = jasmine.createSpy();
    directory.onDidChange(changeHandler);
    runs(() => {
      fs.writeFileSync(
        nuclideUri.join(directoryPath, 'new_file_1.txt'),
        'new contents 1!',
      );
      fs.writeFileSync(
        nuclideUri.join(directoryPath, 'new_file_2.txt'),
        'new contents 2!',
      );
    });
    waitsFor(() => changeHandler.callCount > 0);
    runs(() => {
      expect(changeHandler.callCount).toBe(1);
      // $FlowFixMe - test disabled.
      const sortedChange = changeHandler.argsForCall[0][0].sort(
        (a, b) => a.name > b.name,
      );
      expect(sortedChange).toEqual([
        {name: 'new_file_1.txt', exists: true, mode: FILE_MODE, new: true},
        {name: 'new_file_2.txt', exists: true, mode: FILE_MODE, new: true},
      ]);
    });
  });
});

describe('RemoteDirectory::onDidDelete()', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = temp.mkdirSync('on_did_delete');
  });

  it('calls on delete', () => {
    waitsForPromise(async () => {
      const dirPath = nuclideUri.join(tempDir, 'dir_to_delete');
      const dir = new RemoteDirectory(
        connectionMock,
        `nuclide://host13${dirPath}`,
      );
      const callbackSpy = jasmine.createSpy();
      dir.onDidDelete(callbackSpy);
      await dir.delete();
      expect(callbackSpy.callCount).toBe(1);
    });
  });
});
