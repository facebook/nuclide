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
import fs from 'fs';
import fsPromise from 'nuclide-commons/fsPromise';
import nuclideUri from 'nuclide-commons/nuclideUri';
import ScribeProcess, {__test__} from '../ScribeProcess';
import waitsFor from '../../../jest/waits_for';

// scripe process does not pass the ENV vars properly and scribe_cat_mock
// fails on os.environ['SCRIBE_MOCK_PATH']
describe.skip('scribe_cat test suites', () => {
  let tempDir = '';
  let originalCommand = '';

  function getContentOfScribeCategory(category: string): Array<string> {
    const categoryFilePath = nuclideUri.join(tempDir, category);
    const content = fs.readFileSync(categoryFilePath, 'utf8');
    const result = content.split('\n').filter(item => item.length > 0);
    return result;
  }

  beforeEach(async () => {
    // Simulated scribe_cat script which saves data into:
    //   ${process.env['SCRIBE_MOCK_PATH'] + category_name}
    // It terminates once we cut off the stdin stream.
    const scribeCatMockCommandPath = nuclideUri.join(
      nuclideUri.dirname(__filename),
      '../__mocks__/scripts',
      'scribe_cat_mock',
    );
    tempDir = await fsPromise.tempdir();
    originalCommand = __test__.setScribeCatCommand(scribeCatMockCommandPath);
    process.env.SCRIBE_MOCK_PATH = tempDir;
  });

  afterEach(async () => {
    __test__.setScribeCatCommand(originalCommand);
  });

  it('Saves data to scribe category', async () => {
    const localScribeProcess = new ScribeProcess('test');

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
    messages.map(message => localScribeProcess.write(message));

    // Wait for `scribe_cat_mock` to flush data into disk.
    await localScribeProcess.join();
    expect(messages).toEqual(getContentOfScribeCategory('test'));
  });

  it('Saves data to scribe category and resume from error', async () => {
    const localScribeProcess = new ScribeProcess('test');

    const firstPart = 'A nuclide is an atomic species'.split(' ');
    const secondPart = 'characterized by the specific constitution of its nucleus.'.split(
      ' ',
    );

    firstPart.map(message => localScribeProcess.write(message));
    // Kill the existing process.
    await localScribeProcess.join();
    secondPart.map(message => localScribeProcess.write(message));
    // Wait for `scribe_cat_mock` to flush data into disk.
    await localScribeProcess.join();
    expect(firstPart.concat(secondPart)).toEqual(
      getContentOfScribeCategory('test'),
    );
  });

  it('Can automatically join', async () => {
    const localScribeProcess = new ScribeProcess('test', 100);
    localScribeProcess.write('test1');

    await waitsFor(() => getContentOfScribeCategory('test').includes('test1'));

    localScribeProcess.write('test2');
    localScribeProcess.write('test3');
    expect(getContentOfScribeCategory('test')).toEqual(['test1']);

    await waitsFor(() => getContentOfScribeCategory('test').includes('test3'));

    expect(getContentOfScribeCategory('test')).toEqual([
      'test1',
      'test2',
      'test3',
    ]);
  });

  it('disables itself when spawning fails', async () => {
    __test__.setScribeCatCommand('not a valid command');
    const scribeProcess = new ScribeProcess('test', 100);
    expect(await scribeProcess.write('hi')).toBe(false);
    expect(ScribeProcess.isEnabled()).toBe(false);
    expect(await scribeProcess.write('hi')).toBe(false);
  });
});
