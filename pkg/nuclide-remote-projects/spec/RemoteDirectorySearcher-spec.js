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

import {Observable} from 'rxjs';

import {RemoteDirectory} from '../../nuclide-remote-connection';
import RemoteDirectorySearcher from '../lib/RemoteDirectorySearcher';
import {WORKING_SET_PATH_MARKER} from '../../nuclide-working-sets-common/lib/constants';

describe('RemoteDirectorySearcher.processPaths', () => {
  const serviceSpy: any = {grepSearch: () => null};
  const workingSetsStore: any = {getApplicableDefinitions: () => []};
  const searcher = new RemoteDirectorySearcher(
    _ => serviceSpy,
    () => workingSetsStore,
  );
  it('expands basename searches to the whole directory', () => {
    expect(searcher.processPaths('a/b/c', ['c/d', 'c'])).toEqual([]);
  });

  it('tries subdirs for basename searches', () => {
    expect(searcher.processPaths('a/b/c', ['c/d', 'c/e'])).toEqual([
      'c/d',
      'd',
      'c/e',
      'e',
    ]);
  });

  it('does not expand regular searches', () => {
    expect(searcher.processPaths('a/b/c', ['a', 'b'])).toEqual(['a', 'b']);
  });

  it('adds working set directories to search path', () => {
    const workingSetPaths = ['a/b', 'a/c/d'];
    spyOn(workingSetsStore, 'getApplicableDefinitions').andReturn([
      {name: 'foo', active: true, uris: workingSetPaths},
    ]);
    expect(searcher.processPaths('a', [WORKING_SET_PATH_MARKER])).toEqual([
      'b',
      'c/d',
    ]);
  });

  it('does not search directories excluded by working set', () => {
    spyOn(serviceSpy, 'grepSearch').andReturn({
      refCount: () => Observable.empty(),
    });
    const workingSetPaths = ['nuclide://host/a/b'];
    spyOn(workingSetsStore, 'getApplicableDefinitions').andReturn([
      {name: 'foo', active: true, uris: workingSetPaths},
    ]);
    const connection: any = null;
    const directories = ['nuclide://host/a', 'nuclide://host/c'].map(
      path => new RemoteDirectory(connection, path),
    );
    searcher.search(directories, /./, {inclusions: [WORKING_SET_PATH_MARKER]});
    expect(
      serviceSpy.grepSearch,
    ).toHaveBeenCalledWith('nuclide://host/a', /./, ['b']);
  });
});
