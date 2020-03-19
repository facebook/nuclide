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
import Activation from '../lib/Activation';
import CwdApi from '../lib/CwdApi';
import invariant from 'assert';
import {Directory} from 'atom';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';

describe('current-working-directory', () => {
  beforeEach(() => {
    jest
      .spyOn(atom.project, 'getDirectories')
      .mockReturnValue([new Directory('/a/b/c'), new Directory('/d/e/f')]);
  });

  describe('Activation', () => {
    describe('provideApi', () => {
      it('provides an API with the initial path', () => {
        const activation = new Activation({initialCwdPath: '/a/b/c'});
        const api = activation.provideApi();
        const cwd = api.getCwd();
        invariant(cwd != null);
        expect(cwd).toBe('/a/b/c');
      });
    });
  });

  describe('CwdApi', () => {
    it('gets and sets the cwd', () => {
      const api = new CwdApi('/a/b/c');
      let cwd = api.getCwd();
      invariant(cwd != null);
      expect(cwd).toBe('/a/b/c');
      api.setCwd('/d/e/f');
      cwd = api.getCwd();
      invariant(cwd != null);
      expect(cwd).toBe('/d/e/f');
    });

    it('errors if you set an invalid cwd', () => {
      const api = new CwdApi('/a/b/c');
      const setInvalidCwd = () => {
        api.setCwd('/x/y/z');
      };
      expect(setInvalidCwd).toThrow();
    });

    it('allows subdirectories to be the CWD', () => {
      const api = new CwdApi('/a/b/c');
      api.setCwd('/a/b/c/d');
      const cwd = api.getCwd();
      invariant(cwd != null);
      expect(cwd).toBe('/a/b/c/d');
    });
  });
});

describe('CwdApi event handling', () => {
  it('falls back to an existing project when you remove one', () => {
    let projects = [new Directory('/a/b/c'), new Directory('/d/e/f')];
    jest
      .spyOn(atom.project, 'getDirectories')
      .mockImplementation(() => projects);

    const api = new CwdApi('/d/e/f');
    let cwd = api.getCwd();
    invariant(cwd != null);
    expect(cwd).toBe('/d/e/f');

    // Simulate the removing of a directory from the project list.
    projects = [new Directory('/a/b/c')];

    cwd = api.getCwd();
    invariant(cwd != null);
    expect(cwd).toBe('/a/b/c');
  });

  it('uses the initial directory once it becomes valid', () => {
    let projects = [];
    jest
      .spyOn(atom.project, 'getDirectories')
      .mockImplementation(() => projects);

    let callback;
    const onDidChangePaths = cb => {
      callback = cb;
      return new UniversalDisposable();
    };
    jest
      .spyOn(atom.project, 'onDidChangePaths')
      .mockImplementation(onDidChangePaths);

    // The initial path does not exist, so observeCwd is initially undefined.
    const api = new CwdApi('/a/b/c');

    const spy = jest.fn();
    api.observeCwd(spy);
    expect(spy).toHaveBeenCalledWith(null);

    projects = [new Directory('/a/b/c')];

    // Once the list of projects is updated, the initial path should become active again.
    expect(callback).toBeDefined();
    invariant(callback);
    callback();

    expect(spy.mock.calls.length).toBe(2);
    const arg = spy.mock.calls[1][0];
    expect(arg).not.toBeNull();
    expect((arg: any)).toBe('/a/b/c');
  });
});
