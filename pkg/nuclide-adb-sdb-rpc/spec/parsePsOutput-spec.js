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

import {parsePsTableOutput} from '../lib/Adb';

describe('parsePsOutput', () => {
  it('splits the output by message', () => {
    const fakePsOutput =
      'USER      PID   PPID  VSIZE  RSS   WCHAN            PC  NAME\n' +
      'u0_a2    2326  1257  1113392 38148 SyS_epoll_ 00000000 S com.android.providers.calendar\n' +
      'u0_a16   2359  1257  1109708 33484 SyS_epoll_ 00000000 S com.android.managedprovisioning\n' +
      'u0_a48   2386  1257  1215388 56116 SyS_epoll_ 00000000 S com.google.android.apps.maps\n';

    let parsed = parsePsTableOutput(fakePsOutput, ['user', 'pid', 'name']);
    expect(parsed.length).toBe(3);

    expect(parsed[0].user).toEqual('u0_a2');
    expect(parsed[0].pid).toEqual('2326');
    expect(parsed[0].name).toEqual('com.android.providers.calendar');

    expect(parsed[1].user).toEqual('u0_a16');
    expect(parsed[1].pid).toEqual('2359');
    expect(parsed[1].name).toEqual('com.android.managedprovisioning');

    expect(parsed[2].user).toEqual('u0_a48');
    expect(parsed[2].pid).toEqual('2386');
    expect(parsed[2].name).toEqual('com.google.android.apps.maps');

    // Try another output with different column ordering to confirm column mapping is working.
    const fakePsOutput2 =
      'PID      USER   PPID  VSIZE  RSS   WCHAN            PC  NAME\n' +
      '2326   u0_a2  1257  1113392 38148 SyS_epoll_ 00000000 S com.android.providers.calendar\n' +
      '2359   u0_a16  1257  1109708 33484 SyS_epoll_ 00000000 S com.android.managedprovisioning\n' +
      '2386   u0_a48  1257  1215388 56116 SyS_epoll_ 00000000 S com.google.android.apps.maps\n';

    parsed = parsePsTableOutput(fakePsOutput2, ['user', 'pid']);
    expect(parsed.length).toBe(3);

    expect(parsed[0].user).toEqual('u0_a2');
    expect(parsed[0].pid).toEqual('2326');
    expect(parsed[0].name).toBeUndefined();

    expect(parsed[1].user).toEqual('u0_a16');
    expect(parsed[1].pid).toEqual('2359');
    expect(parsed[1].name).toBeUndefined();

    expect(parsed[2].user).toEqual('u0_a48');
    expect(parsed[2].pid).toEqual('2386');
    expect(parsed[2].name).toBeUndefined();
  });
});
