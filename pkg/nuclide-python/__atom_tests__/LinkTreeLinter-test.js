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
import invariant from 'assert';
import nuclideUri from 'nuclide-commons/nuclideUri';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import LinkTreeLinter from '../lib/LinkTreeLinter';
import waitsFor from '../../../jest/waits_for';

const TEST_TARGET = '//test:target';

const sleep = n => new Promise(r => setTimeout(r, n));

describe('LinkTreeLinter', () => {
  beforeEach(() => {
    jest
      .spyOn(
        require('../../nuclide-remote-connection'),
        'getPythonServiceByNuclideUri',
      )
      .mockReturnValue({
        async getBuildableTargets() {
          return [TEST_TARGET];
        },
      });

    // Override the grammars to include the null grammar.
    (require('../lib/constants'): any).GRAMMAR_SET = new Set([
      'text.plain.null-grammar',
    ]);
  });

  it('provides diagnostics for Python files with linktrees', async () => {
    const linkTreeLinter = new LinkTreeLinter();
    const mockBuckTaskRunner = ({}: any);
    const mockCwdApi = ({}: any);
    let onDidCompleteTask;
    mockBuckTaskRunner.setBuildTarget = jest.fn();
    mockBuckTaskRunner.onDidCompleteTask = jest.fn().mockImplementation(cb => {
      onDidCompleteTask = cb;
      return new UniversalDisposable();
    });
    mockCwdApi.getCwd = jest.fn().mockReturnValue(__dirname);

    linkTreeLinter.consumeBuckTaskRunner(mockBuckTaskRunner);
    linkTreeLinter.consumeCwdApi(mockCwdApi);

    const file1 = nuclideUri.join(__dirname, 'fixtures', 't.py');
    const file2 = nuclideUri.join(__dirname, 'fixtures', 'bad_syntax_land.py');

    let messages = [];
    linkTreeLinter.observeMessages().subscribe(m => {
      messages = m;
    });

    await atom.workspace.open(file1);
    await sleep(1000); // debounce delay

    await waitsFor(() => messages.length > 0, 'a diagnostic to appear');

    expect(messages.length).toBe(1);
    const message = messages[0];
    expect(message.location.file).toBe(file1);
    const {solutions} = message;
    invariant(solutions != null);
    expect(solutions.length).toBe(2);
    expect(solutions[0].title).toBe(TEST_TARGET);

    // Applying the first action should fill the Buck runner and dismiss the message.
    invariant(solutions[0].replaceWith === undefined);
    solutions[0].apply();
    expect(messages).toEqual([]);
    expect(mockBuckTaskRunner.setBuildTarget).toHaveBeenCalledWith(TEST_TARGET);

    await atom.workspace.open(file2);
    await sleep(1000); // debounce delay

    await waitsFor(() => messages.length > 0, 'a diagnostic to appear');

    expect(messages.length).toBe(1);
    {
      const message1 = messages[0];
      expect(message1.location.file).toBe(file2);
    }

    // Finishing the Buck task should also dismiss the message.
    // $FlowFixMe
    onDidCompleteTask({buildTarget: TEST_TARGET});
    expect(messages).toEqual([]);
    mockCwdApi.getCwd.mockRestore();
    await atom.workspace.open(file1);
    await sleep(1000); // debounce delay

    // file1 should be blacklisted already: don't even check the CWD.
    expect(mockCwdApi.getCwd).not.toHaveBeenCalled();
  });
});
