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
import {Observable} from 'rxjs';

import featureConfig from 'nuclide-commons-atom/feature-config';
import {RemoteDirectory} from '../../nuclide-remote-connection';
import RemoteDirectorySearcher from '../lib/RemoteDirectorySearcher';
import {WORKING_SET_PATH_MARKER} from '../../nuclide-working-sets-common/lib/constants';

describe('RemoteDirectorySearcher.processPaths', () => {
  const serviceSpy: any = {remoteAtomSearch: () => null};
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
    jest
      .spyOn(workingSetsStore, 'getApplicableDefinitions')
      .mockReturnValue([{name: 'foo', active: true, uris: workingSetPaths}]);
    expect(searcher.processPaths('a', [WORKING_SET_PATH_MARKER])).toEqual([
      'b',
      'c/d',
    ]);
  });

  it('does not search directories excluded by working set', () => {
    jest.spyOn(serviceSpy, 'remoteAtomSearch').mockReturnValue({
      refCount: () => Observable.empty(),
    });
    jest.spyOn(featureConfig, 'get').mockReturnValue({
      remoteTool: 'grep',
      remoteUseVcsSearch: true,
    });
    const workingSetPaths = ['nuclide://host/a/b'];
    jest
      .spyOn(workingSetsStore, 'getApplicableDefinitions')
      .mockReturnValue([{name: 'foo', active: true, uris: workingSetPaths}]);
    const connection: any = null;
    const directories = ['nuclide://host/a', 'nuclide://host/c'].map(
      path => new RemoteDirectory(connection, path),
    );
    searcher.search(directories, /./, {
      inclusions: [WORKING_SET_PATH_MARKER],
      leadingContextLineCount: 1,
      trailingContextLineCount: 2,
    });
    expect(serviceSpy.remoteAtomSearch).toHaveBeenCalledWith(
      'nuclide://host/a',
      /./,
      ['b'],
      true,
      'grep',
      1,
      2,
    );
  });
});
