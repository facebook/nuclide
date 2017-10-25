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

import {
  infoFromUri,
  uriFromCwd,
  uriFromInfo,
  TERMINAL_DEFAULT_LOCATION,
  TERMINAL_DEFAULT_ICON,
} from '../nuclide-terminal-uri';

const defaultInfo = {
  remainOnCleanExit: false,
  defaultLocation: TERMINAL_DEFAULT_LOCATION,
  icon: TERMINAL_DEFAULT_ICON,
};

describe('main', () => {
  describe('infoFromUri', () => {
    // This is verified via round-tripping below
  });
  describe('uriFromCwd', () => {
    it('creates a default uri', () => {
      const uri = uriFromCwd(null);
      const info = infoFromUri(uri);
      expect(info).not.toBeNull();
      expect(info.cwd).not.toBeDefined();
      expect(info.command).not.toBeDefined();
      expect(info.title).not.toBeDefined();
    });
    it('creates a uri with local cwd', () => {
      const uri = uriFromCwd('/home/username');
      const info = infoFromUri(uri);
      expect(info).not.toBeNull();
      expect(info.cwd).toEqual('/home/username');
      expect(info.command).not.toBeDefined();
      expect(info.title).not.toBeDefined();
    });
    it('creates a uri with remote cwd', () => {
      const uri = uriFromCwd('nuclide://home/username');
      const info = infoFromUri(uri);
      expect(info).not.toBeNull();
      expect(info.cwd).toEqual('nuclide://home/username');
      expect(info.command).not.toBeDefined();
      expect(info.title).not.toBeDefined();
    });
  });
  describe('uriFromInfo', () => {
    it('creates a default uri', () => {
      const uri = uriFromInfo(defaultInfo);
      const info = infoFromUri(uri);
      expect(info).not.toBeNull();
      expect(info.cwd).not.toBeDefined();
      expect(info.command).not.toBeDefined();
      expect(info.title).not.toBeDefined();
    });
    it('creates a uri with remote cwd only', () => {
      const uri = uriFromInfo({...defaultInfo, cwd: 'nuclide://home/username'});
      const info = infoFromUri(uri);
      expect(info).not.toBeNull();
      expect(info.cwd).toEqual('nuclide://home/username');
      expect(info.command).not.toBeDefined();
      expect(info.title).not.toBeDefined();
    });
    it('creates a uri with command only', () => {
      const command = {file: '/usr/bin/env', args: ['cowsay', 'hi']};
      const uri = uriFromInfo({...defaultInfo, command});
      const info = infoFromUri(uri);
      expect(info).not.toBeNull();
      expect(info.cwd).not.toBeDefined();
      expect(info.command).toEqual(command);
      expect(info.title).not.toBeDefined();
    });
    it('creates a uri with a title only', () => {
      const title = 'The Brothers Karamazov';
      const uri = uriFromInfo({...defaultInfo, title});
      const info = infoFromUri(uri);
      expect(info).not.toBeNull();
      expect(info.cwd).not.toBeDefined();
      expect(info.command).not.toBeDefined();
      expect(info.title).toEqual(title);
    });
    it('creates a uri with everything defined', () => {
      const cwd = 'nuclide://home/username';
      const command = {file: '/usr/bin/env', args: ['cowsay', 'hi']};
      const title = 'The Hymn of Acxiom';
      const uri = uriFromInfo({...defaultInfo, cwd, command, title});
      const info = infoFromUri(uri);
      expect(info).not.toBeNull();
      expect(info.cwd).toEqual(cwd);
      expect(info.command).toEqual(command);
      expect(info.title).toEqual(title);
    });
  });
});
