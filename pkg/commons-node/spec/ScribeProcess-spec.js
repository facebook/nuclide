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

import nuclideUri from 'nuclide-commons/nuclideUri';
import fsPromise from 'nuclide-commons/fsPromise';
import ScribeProcess, {__test__} from '../ScribeProcess';

describe('scribe_cat test suites', () => {
  let tempDir = '';
  let scribeProcess: ?ScribeProcess = null;
  let originalCommand = '';

  async function getContentOfScribeCategory(
    category: string,
  ): Promise<Array<string>> {
    const categoryFilePath = nuclideUri.join(tempDir, category);
    const content = await fsPromise.readFile(categoryFilePath);
    const result = content
      .toString()
      .split('\n')
      .filter(item => item.length > 0);
    return result;
  }

  beforeEach(() => {
    jasmine.useRealClock();
    // Simulated scribe_cat script which saves data into:
    //   ${process.env['SCRIBE_MOCK_PATH'] + category_name}
    // It terminates once we cut off the stdin stream.
    const scribeCatMockCommandPath = nuclideUri.join(
      nuclideUri.dirname(__filename),
      'scripts',
      'scribe_cat_mock',
    );
    waitsForPromise(async () => {
      tempDir = await fsPromise.tempdir();
      originalCommand = __test__.setScribeCatCommand(scribeCatMockCommandPath);
      process.env.SCRIBE_MOCK_PATH = tempDir;
    });
  });

  afterEach(() => {
    waitsForPromise(async () => {
      if (scribeProcess) {
        await scribeProcess.dispose();
      }
      __test__.setScribeCatCommand(originalCommand);
    });
  });

  it('Saves data to scribe category', () => {
    const localScribeProcess = (scribeProcess = new ScribeProcess('test'));

    const messages = [
      'A',
      'nuclide',
      'is',
      'an',
      'atomic',
      'species',
      'characterized',
      'by',
      'the',
      'specific',
      'constitution',
      'of',
      'its',
      'nucleus.',
    ];
    waitsForPromise(async () => {
      messages.map(message => localScribeProcess.write(message));
      // Wait for `scribe_cat_mock` to flush data into disk.
      await localScribeProcess.join();
      expect(messages).toEqual(await getContentOfScribeCategory('test'));
    });
  });

  it('Saves data to scribe category and resume from error', () => {
    const localScribeProcess = (scribeProcess = new ScribeProcess('test'));

    const firstPart = 'A nuclide is an atomic species'.split(' ');
    const secondPart = 'characterized by the specific constitution of its nucleus.'.split(
      ' ',
    );

    waitsForPromise(async () => {
      firstPart.map(message => localScribeProcess.write(message));
      // Kill the existing process.
      await localScribeProcess.join();
      secondPart.map(message => localScribeProcess.write(message));
      // Wait for `scribe_cat_mock` to flush data into disk.
      await localScribeProcess.join();
      expect(firstPart.concat(secondPart)).toEqual(
        await getContentOfScribeCategory('test'),
      );
    });
  });
});
