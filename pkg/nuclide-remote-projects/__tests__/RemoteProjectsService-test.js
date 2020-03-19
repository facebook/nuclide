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
import RemoteProjectsService from '../lib/RemoteProjectsService';

describe('RemoteProjectsService', () => {
  it('waits for reload', () => {
    const service = new RemoteProjectsService();
    const spy = jest.fn();
    service.waitForRemoteProjectReload(spy);
    const projects = ['test'];
    service._reloadFinished(projects);
    expect(spy).toHaveBeenCalledWith(projects);

    // The callback should still resolve if already loaded.
    const spy2 = jest.fn();
    service.waitForRemoteProjectReload(spy2);
    expect(spy2).toHaveBeenCalledWith(projects);
  });
});
