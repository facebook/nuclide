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

import fs from 'fs';
import temp from 'temp';
temp.track();

import updateKeymap from '../lib/updateKeymap';

describe('updateKeymap', () => {
  it('updates a user keymap', () => {
    let notification;
    let updatePromise;
    const {path} = temp.openSync({suffix: 'test.cson'});

    waitsForPromise(async () => {
      fs.writeFileSync(path, '"alt-w": "command"\n"ctrl-w": "command-1"');

      spyOn(atom.notifications, 'addInfo').andCallFake((title, data) => {
        notification = data;
        return {dismiss: () => {}};
      });

      updatePromise = updateKeymap(path, {
        command: 'new-command',
        'command-1': 'new-command-1',
      });
    });

    waitsFor(() => notification != null);

    waitsForPromise(async () => {
      expect(notification.description).toContain('- `command`\n- `command-1`');
      notification.buttons[0].onDidClick();

      await updatePromise;
      const file = fs.readFileSync(path, 'utf8');
      expect(file).toBe('"alt-w": "new-command"\n"ctrl-w": "new-command-1"');
    });
  });
});
