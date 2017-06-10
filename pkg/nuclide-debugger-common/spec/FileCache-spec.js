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

import nuclideUri from 'nuclide-commons/nuclideUri';
import FileCache from '../lib/FileCache';

describe('debugger-common FileCache', () => {
  let cache;
  let sendServerMethod;
  let filepath;
  let symlinkedFilepath;

  beforeEach(() => {
    sendServerMethod = jasmine.createSpy('sendServerMethod');
    cache = new FileCache(sendServerMethod);
    const fixturesPath = nuclideUri.join(__dirname, 'fixtures');
    filepath = nuclideUri.join(fixturesPath, 'test.php');
    symlinkedFilepath = nuclideUri.join(fixturesPath, 'test-symlink.php');
  });

  it('registerFile - source file path', () => {
    waitsForPromise(async () => {
      const sourceFileUrl = `file://${filepath}`;
      await cache.registerFile(sourceFileUrl);
      expect(sendServerMethod).toHaveBeenCalledWith('Debugger.scriptParsed', {
        scriptId: filepath,
        url: sourceFileUrl,
        startLine: 0,
        startColumn: 0,
        endLine: 0,
        endColumn: 0,
      });
      const source = await cache.getFileSource(filepath);
      expect(source).toBe('<?hh\n');
    });
  });

  it('registerFile - no source file', () => {
    waitsForPromise(async () => {
      const noSourceFileUrl = `file://${filepath}`;
      await cache.registerFile(noSourceFileUrl);
      expect(sendServerMethod).toHaveBeenCalledWith('Debugger.scriptParsed', {
        scriptId: filepath,
        url: noSourceFileUrl,
        startLine: 0,
        startColumn: 0,
        endLine: 0,
        endColumn: 0,
      });
      const source = await cache.getFileSource(filepath);
      expect(source).toBe('<?hh\n');
    });
  });

  it('registerFile - traverses symlink', () => {
    waitsForPromise(async () => {
      const linkSourceUrl = `file://${symlinkedFilepath}`;
      await cache.registerFile(linkSourceUrl);
      expect(sendServerMethod).toHaveBeenCalledWith('Debugger.scriptParsed', {
        scriptId: symlinkedFilepath,
        url: `file://${filepath}`,
        startLine: 0,
        startColumn: 0,
        endLine: 0,
        endColumn: 0,
      });
      const source = await cache.getFileSource(filepath);
      expect(source).toBe('<?hh\n');
    });
  });
});
