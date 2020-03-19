/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 * @emails oncall+nuclide
 */
import {WorkingSetsStore} from '../lib/WorkingSetsStore';

describe('WorkingSetStore', () => {
  it('Aggregates all URIs of active defs', () => {
    jest
      .spyOn(atom.project, 'getDirectories')
      .mockReturnValue([{getPath: () => '/aaa'}]);

    const store = new WorkingSetsStore();
    store.updateUserDefinitions([
      {name: '1', active: true, uris: ['/aaa/bbb1'], sourceType: 'user'},
      {name: '2', active: true, uris: ['/aaa/bbb2'], sourceType: 'user'},
      {name: '3', active: false, uris: ['/aaa/bbb3'], sourceType: 'user'},
    ]);

    expect(store.getCurrent().getUris()).toEqual(['/aaa/bbb1', '/aaa/bbb2']);
  });

  it('Updates the applicability', () => {
    let directories = ['/aaa/bbb1'];

    jest.spyOn(atom.project, 'getDirectories').mockImplementation(() => {
      return directories.map(d => {
        return {getPath: () => d};
      });
    });

    const d1 = {
      name: '1',
      active: true,
      uris: ['/aaa/bbb1/ccc'],
      sourceType: 'user',
    };
    const d2 = {
      name: '2',
      active: true,
      uris: ['/aaa/bbb2/ccc'],
      sourceType: 'user',
    };
    const d3 = {
      name: '3',
      active: false,
      uris: ['/aaa/bbb3/ccc'],
      sourceType: 'user',
    };

    const store = new WorkingSetsStore();
    store.updateUserDefinitions([d1, d2, d3]);

    expect(store.getApplicableDefinitions()).toEqual([d1]);
    expect(store.getNotApplicableDefinitions()).toEqual([d2, d3]);
    expect(store.getCurrent().getUris()).toEqual(['/aaa/bbb1/ccc']);

    directories = ['/aaa/bbb1', '/aaa/bbb2'];
    store.updateApplicability();

    expect(store.getApplicableDefinitions()).toEqual([d1, d2]);
    expect(store.getNotApplicableDefinitions()).toEqual([d3]);
    expect(store.getCurrent().getUris()).toEqual([
      '/aaa/bbb1/ccc',
      '/aaa/bbb2/ccc',
    ]);

    directories = ['/aaa/bbb2', '/aaa/bbb3'];
    store.updateApplicability();

    expect(store.getApplicableDefinitions()).toEqual([d2, d3]);
    expect(store.getNotApplicableDefinitions()).toEqual([d1]);
    expect(store.getCurrent().getUris()).toEqual(['/aaa/bbb2/ccc']);
  });
});
