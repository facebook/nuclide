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
import fs from 'fs';
import temp from 'temp';
import waitsFor from '../../../jest/waits_for';
temp.track();

import updateKeymap from '../lib/updateKeymap';

describe('updateKeymap', () => {
  it('updates a user keymap', async () => {
    let notification;
    const {path} = temp.openSync({suffix: 'test.cson'});

    fs.writeFileSync(path, '"alt-w": "command"\n"ctrl-w": "command-1"');

    jest
      .spyOn(atom.notifications, 'addInfo')
      .mockImplementation((title, data) => {
        notification = data;
        return {dismiss: () => {}};
      });

    const updatePromise = updateKeymap(path, {
      command: 'new-command',
      'command-1': 'new-command-1',
    });

    await waitsFor(() => notification != null);

    expect((notification: any).description).toContain(
      '- `command`\n- `command-1`',
    );
    (notification: any).buttons[0].onDidClick();

    await updatePromise;
    const file = fs.readFileSync(path, 'utf8');
    expect(file).toBe('"alt-w": "new-command"\n"ctrl-w": "new-command-1"');
  });
});
