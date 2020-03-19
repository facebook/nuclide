/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 * @format
 * @emails oncall+nuclide
 */
import os from 'os';
import nuclideUri from 'nuclide-commons/nuclideUri';
import waitsFor from '../../../../../jest/waits_for';
import {sleep} from 'nuclide-commons/promise';

import {CodeActionManager} from '../lib/CodeActionManager';

describe('CodeActionManager', () => {
  let manager;
  let provider;
  let delegate;
  let editor;
  beforeEach(async () => {
    editor = await atom.workspace.open(
      nuclideUri.join(os.tmpdir(), 'test.txt'),
    );
    editor.setText('abc\ndef\nghi');

    manager = new CodeActionManager();
    provider = {
      priority: 1,
      grammarScopes: ['text.plain.null-grammar'],
      async getCodeActions(_e, _r, _d) {
        return [];
      },
    };
    delegate = {
      clearMessages: () => {},
      setAllMessages: _messages => {},
    };
    manager._linterDelegate = (delegate: any);
    manager.addProvider(provider);
  });

  it('finds code actions on highlight change and updates linter', async () => {
    const actions = [
      {
        apply() {},
        async getTitle() {
          return 'Mock action';
        },
        dispose() {},
      },
    ];
    const spyActions = jest
      .spyOn(provider, 'getCodeActions')
      .mockReturnValue(actions);
    const spyLinter = jest.spyOn(delegate, 'setAllMessages');

    await sleep(1); // trigger debounce
    editor.selectAll();
    await sleep(501);

    await waitsFor(
      () => spyLinter.mock.calls.length > 0,
      'should have called setAllMessages',
    );

    expect(spyActions).toHaveBeenCalled();
    expect(spyLinter).toHaveBeenCalled();
    expect(
      (spyLinter.mock.calls[spyLinter.mock.calls.length - 1]: any)[0][0]
        .solutions.length,
    ).toEqual(1);
  });
});
