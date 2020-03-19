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
import type {ServerConnection} from '..';

import invariant from 'assert';
import fs from 'fs';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {observeStream} from 'nuclide-commons/stream';
import crypto from 'crypto';
import {Subject} from 'rxjs';
import temp from 'temp';
import connectionMock from '../__mocks__/connection_mock';
import {RemoteFile} from '../lib/RemoteFile';
import waitsFor from '../../../jest/waits_for';

temp.track();

describe('RemoteFile', () => {
  const computeDigest = contents => {
    const hash = crypto.createHash('sha1').update(contents || '');
    invariant(hash);
    return hash.digest('hex');
  };

  describe('getRealPath() & getRealPathSync()', () => {
    let filePath;
    let symlinkedFilePath;

    beforeEach(() => {
      const tempDir = temp.mkdirSync('realpath_test');
      filePath = nuclideUri.join(tempDir, 'file.txt');
      fs.writeFileSync(filePath, 'some contents');
      filePath = fs.realpathSync(filePath);
      symlinkedFilePath = filePath + '.sym';
      fs.symlinkSync(filePath, symlinkedFilePath, 'file');
    });

    it('gets realpath of a file', async () => {
      const file = new RemoteFile(connectionMock, symlinkedFilePath);
      const realpath = await file.getRealPath();
      expect(realpath).toBe(fs.realpathSync(symlinkedFilePath));
    });

    it('caches the getRealPath result', async () => {
      const file = new RemoteFile(connectionMock, symlinkedFilePath);
      expect(file.getRealPathSync()).toBe(symlinkedFilePath);
      await file.getRealPath();
      expect(file.getRealPathSync()).toBe(filePath);
    });
  });

  describe('delete()', () => {
    let tempDir;

    beforeEach(() => {
      tempDir = temp.mkdirSync('delete_test');
    });

    it('deletes the existing file', async () => {
      const filePath = nuclideUri.join(tempDir, 'file_to_delete');
      fs.writeFileSync(filePath, '');
      const file = new RemoteFile(connectionMock, filePath);
      expect(fs.existsSync(filePath)).toBe(true);
      await file.delete();
      expect(fs.existsSync(filePath)).toBe(false);
    });

    it('deletes the non-existent file', async () => {
      const filePath = nuclideUri.join(tempDir, 'file_to_delete');
      const file = new RemoteFile(connectionMock, filePath);
      await file.delete();
      expect(fs.existsSync(filePath)).toBe(false);
    });
  });

  describe('RemoteFile::onDidDelete()', () => {
    let tempDir;

    beforeEach(() => {
      tempDir = temp.mkdirSync('on_did_create_and_delete_test');
    });

    it('calls on delete', async () => {
      const filePath = nuclideUri.join(tempDir, 'file_to_delete');
      fs.writeFileSync(filePath, '');
      const file = new RemoteFile(connectionMock, filePath);
      const callbackSpy = jest.fn();
      jest.spyOn(file, '_willAddSubscription').mockReturnValue(null);
      file.onDidDelete(callbackSpy);
      file.delete();
      await waitsFor(() => callbackSpy.mock.calls.length > 0);
      expect(callbackSpy.mock.calls.length).toBe(1);
      expect(file._willAddSubscription).toHaveBeenCalled();
    });
  });

  describe('RemoteDirectory::isSymbolicLink()', () => {
    let tempDir;

    beforeEach(() => {
      tempDir = temp.mkdirSync('rename_test');
    });

    it('verifies symlink', () => {
      const targetFilePath = nuclideUri.join(tempDir, 'target');
      const symLinkedFilePath = nuclideUri.join(tempDir, 'linked');
      fs.writeFileSync(targetFilePath, '');
      fs.symlinkSync(targetFilePath, symLinkedFilePath, 'file');
      expect(fs.lstatSync(symLinkedFilePath).isSymbolicLink()).toBe(true);

      const file = new RemoteFile(
        connectionMock,
        `nuclide://host13${symLinkedFilePath}`,
        true,
      );
      const symlink = file.isSymbolicLink();
      expect(symlink).toBe(true);
    });

    it('verifies non-symlink', () => {
      const notLinkedFilePath = nuclideUri.join(tempDir, 'not_linked');
      fs.writeFileSync(notLinkedFilePath, '');
      expect(fs.lstatSync(notLinkedFilePath).isSymbolicLink()).toBe(false);

      const file = new RemoteFile(
        connectionMock,
        `nuclide://host13${notLinkedFilePath}`,
        false,
      );
      const symlink = file.isSymbolicLink();
      expect(symlink).toBe(false);
    });
  });

  describe('copy()', () => {
    let tempDir;

    beforeEach(() => {
      tempDir = temp.mkdirSync('copy_test');
    });

    // We only do this simple test to make sure it's delegating to the connection.
    // Adding the other cases is misleading and incorrect since it's actually
    // delegating to `fsPromise` here.
    it('copying existing files', async () => {
      const filePath = nuclideUri.join(tempDir, 'file_to_copy');
      const fileContents = 'copy me!';
      fs.writeFileSync(filePath, fileContents);
      const newFilePath = nuclideUri.join(tempDir, 'copied_file');
      expect(fs.existsSync(filePath)).toBe(true);
      expect(fs.existsSync(newFilePath)).toBe(false);

      const file = new RemoteFile(connectionMock, filePath);
      jest.spyOn(file, '_subscribeToNativeChangeEvents').mockReturnValue(null);
      const result = await file.copy(newFilePath);
      const newFile = new RemoteFile(connectionMock, newFilePath);
      const digest = await newFile.getDigest();
      expect(result).toBe(true);
      expect(fs.existsSync(newFilePath)).toBe(true);
      expect(digest).toBe(computeDigest(fileContents));
    });
  });

  // TODO: #7344702 Re-enable and don't depend on watchman.
  // eslint-disable-next-line jasmine/no-disabled-tests
  xdescribe('RemoteFile watchFile integration', () => {
    const WATCHMAN_SETTLE_TIME_MS = 1 * 1000;
    let tempDir;
    let filePath;
    let file;

    beforeEach(async () => {
      jasmine.getEnv().defaultTimeoutInterval = 10000;
      tempDir = temp.mkdirSync('on_did_change_test');
      filePath = nuclideUri.join(tempDir, 'file.txt');
      file = new RemoteFile(connectionMock, filePath);
      fs.writeFileSync(filePath, 'sample contents');
      // Ask watchman to watch the directory.
      await (() =>
        connectionMock.getFsService().watchDirectoryRecursive(tempDir))();
      // wait for the watchman to settle on the created directory and file.
      waits(WATCHMAN_SETTLE_TIME_MS + /* buffer */ 10);
    });

    afterEach(async () => {
      await file._unsubscribeFromNativeChangeEvents();
      await connectionMock.getFsService().unwatchDirectoryRecursive(tempDir);
    });

    describe('when the contents of the file change', () => {
      it('notifies ::onDidChange observers', () => {
        const changeHandler = jest.fn();
        file.onDidChange(changeHandler);
        runs(() => fs.writeFileSync(filePath, 'this is new!'));
        waitsFor(() => changeHandler.mock.calls.length > 0);
        runs(() => expect(changeHandler.mock.calls.length).toBe(1));
      });
    });

    describe('when the file is deleted, but not through the client', () => {
      it('notifies ::onDidDelete observers', () => {
        const deletionHandler = jest.fn();
        file.onDidDelete(deletionHandler);
        runs(() => fs.unlinkSync(filePath));
        waitsFor(() => deletionHandler.mock.calls.length > 0);
        runs(() => expect(deletionHandler.mock.calls.length).toBe(1));
      });
    });

    // Watchman doesn't support rename event, if needed, will need to be fuzzily implemented.
    // eslint-disable-next-line jasmine/no-disabled-tests
    xdescribe('when the file is renamed', () => {
      it('notifies ::onDidRename observers', () => {
        const renameHandler = jest.fn();
        file.onDidRename(renameHandler);
        runs(() => fs.renameSync(filePath, filePath + '_moved'));
        waits(500); // wait for the rename event to emit.
        runs(() => advanceClock(150)); // pass the rename timeout.
        waitsFor(() => renameHandler.mock.calls.length > 0);
        runs(() => {
          expect(renameHandler.mock.calls.length).toBe(1);
          expect(renameHandler.mock.calls[0][0]).toBe(
            nuclideUri.basename(filePath + '_moved'),
          );
        });
      });
    });

    describe('when a watch handling error happens', () => {
      it('notifies ::onWillThrowWatchError observers', async () => {
        const notExistingFile = new RemoteFile(
          connectionMock,
          nuclideUri.join(tempDir, 'no_existing.txt'),
        );
        let skippedError;
        let handleError;
        notExistingFile.onWillThrowWatchError(watchError => {
          const {error, handle} = watchError;
          skippedError = error;
          handle();
        });
        try {
          // Simulate an change event comes, but the file doesn't exist!
          await notExistingFile._handleNativeChangeEvent('change');
        } catch (error) {
          handleError = error;
        }
        waitsFor(() => skippedError);
        runs(() => {
          expect(skippedError.code).toBe('ENOENT');
          expect(handleError).not.toBeDefined();
        });
      });
    });
  });

  describe('::create()', () => {
    let tempDir;

    beforeEach(() => {
      tempDir = temp.mkdirSync('create_test');
    });

    it('returns true when file creation is successful', async () => {
      const filePath = nuclideUri.join(tempDir, 'create.txt');
      const remoteFile = new RemoteFile(connectionMock, filePath);
      const wasCreated = await remoteFile.create();
      expect(wasCreated).toBe(true);
    });
  });

  describe('::exists()', () => {
    let tempDir;

    beforeEach(() => {
      tempDir = temp.mkdirSync('on_did_change_test');
    });

    it('exists resolves to true when the file exists', async () => {
      const filePath = nuclideUri.join(tempDir, 'file.txt');
      fs.writeFileSync(filePath, 'sample contents');
      const existingFile = new RemoteFile(connectionMock, filePath);
      const exists = await existingFile.exists();
      expect(exists).toBe(true);
    });

    it('exists resolves to false when the file does not exist', async () => {
      const notExistingFile = new RemoteFile(
        connectionMock,
        nuclideUri.join(tempDir, 'no_existing.txt'),
      );
      const exists = await notExistingFile.exists();
      expect(exists).toBe(false);
    });
  });

  describe('RemoteFile::getDigest(), getDigestSync() and _setDigest()', () => {
    let tempDir;
    let filePath;
    let file;
    let fileContents;

    beforeEach(() => {
      tempDir = temp.mkdirSync('on_did_change_test');
      filePath = nuclideUri.join(tempDir, 'file.txt');
      fileContents = 'sample contents!';
      fs.writeFileSync(filePath, fileContents);
      file = new RemoteFile(connectionMock, filePath);
    });

    it('getDigest even if the file was not read before', async () => {
      const digest = await file.getDigest();
      expect(digest).toBe(computeDigest(fileContents));
    });

    it('getDigestSync cached the digest value', async () => {
      await file.getDigest();
      const digest = file.getDigestSync();
      expect(digest).toBe(computeDigest(fileContents));
    });

    it('file reading sets the digest', async () => {
      await file.read();
      const digest = file.getDigestSync();
      expect(digest).toBe(computeDigest(fileContents));
    });

    it('getDigestSync sets the digest for an empty string if no digest is cached', () => {
      const digest = file.getDigestSync();
      expect(digest).toBe(computeDigest(''));
    });

    it('_setDigest sets the digest', async () => {
      const newContents = 'new contents 2!';
      file._setDigest(newContents);
      expect(file.getDigestSync()).toBe(computeDigest(newContents));
    });
  });

  describe('RemoteFile::getParent()', () => {
    let server: ServerConnection = (null: any);

    beforeEach(() => {
      server = ({
        createDirectory: () => {},
        getRemoteConnectionForUri: () => null,
      }: any);
    });

    it('gets the parent directory for a file in a root directory', () => {
      const parentDirectory = jest.fn();
      jest.spyOn(server, 'createDirectory').mockReturnValue(parentDirectory);

      const filePath = 'nuclide://foo.bar.com/foo.txt';
      const file = new RemoteFile(server, filePath);
      expect(file.getParent()).toBe(parentDirectory);
      expect(server.createDirectory).toHaveBeenCalledWith(
        'nuclide://foo.bar.com/',
        null,
      );
    });

    it('gets the parent directory for a file in a non-root directory', () => {
      const parentDirectory = jest.fn();
      jest.spyOn(server, 'createDirectory').mockReturnValue(parentDirectory);

      const filePath = 'nuclide://foo.bar.com/a/foo.txt';
      const file = new RemoteFile(server, filePath);
      expect(file.getParent()).toBe(parentDirectory);
      expect(server.createDirectory).toHaveBeenCalledWith(
        'nuclide://foo.bar.com/a',
        null,
      );
    });
  });

  describe('RemoteFile::setPath()', () => {
    it('resubscribes after a rename', () => {
      const changeHandler = jest.fn();
      const deletionHandler = jest.fn();
      const mockWatch = new Subject();
      jest.spyOn(connectionMock, 'getFileWatch').mockReturnValue(mockWatch);
      const file = new RemoteFile(connectionMock, 'test');

      file.onDidChange(changeHandler);
      file.onDidDelete(deletionHandler);

      // The file tree sets the path before doing the rename.
      file.setPath('test2');

      // Simulate a Watchman rename (delete + change)
      mockWatch.next({type: 'delete', path: 'test'});
      mockWatch.next({type: 'change', path: 'test2'});
      expect(deletionHandler).not.toHaveBeenCalled();
      expect(changeHandler).toHaveBeenCalled();
    });
  });

  describe('RemoteFile::createReadStream()', () => {
    it('is able to read file contents', async () => {
      const tempDir = temp.mkdirSync('stream_test');
      const filePath = nuclideUri.join(tempDir, 'file.txt');
      fs.writeFileSync(filePath, 'test1234');

      const file = new RemoteFile(connectionMock, filePath);
      const readStream = file.createReadStream();
      const data = await observeStream(readStream)
        .toArray()
        .toPromise();
      expect(data).toEqual(['test1234']);
    });

    it('handles errors', async () => {
      const file = new RemoteFile(connectionMock, 'test');
      const readStream = file.createReadStream();
      const data = await observeStream(readStream)
        .toArray()
        .toPromise()
        .catch(e => e);
      expect(data instanceof Error).toBe(true);
    });
  });

  describe('RemoteFile::createWriteStream()', () => {
    it('is able to write file contents', async () => {
      const tempDir = temp.mkdirSync('stream_test');
      const filePath = nuclideUri.join(tempDir, 'file.txt');
      const file = new RemoteFile(connectionMock, filePath);
      const writeStream = file.createWriteStream();
      writeStream.write('test1234');
      await new Promise(resolve => writeStream.end(resolve));
      expect(fs.readFileSync(filePath, 'utf8')).toBe('test1234');
    });

    it('handles errors', async () => {
      const file = new RemoteFile(connectionMock, 'a/');
      const writeStream = file.createWriteStream();
      writeStream.write('test1234');
      let error: ?Error = null;
      writeStream.on('error', e => (error = e));
      await new Promise(resolve => writeStream.end(resolve));
      expect(error).not.toBeNull();
    });
  });
});
