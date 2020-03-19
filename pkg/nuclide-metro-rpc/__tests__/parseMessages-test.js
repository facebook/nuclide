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
import {parseMessages} from '../lib/parseMessages';
import fsPromise from 'nuclide-commons/fsPromise';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {Observable} from 'rxjs';

describe('parseMessages', () => {
  // Run the same tests for each format of the packager output. We do this not because we want to
  // stay DRY, but to ensure that we're testing for the same output for each format.
  [
    'packager-stdout-1',
    'packager-stdout-2',
    'packager-stdout-3',
    'packager-stdout-4',
  ].forEach(fixtureName => {
    describe(fixtureName, () => {
      const lines = getLines(fixtureName).publishReplay();
      lines.connect();

      it('parses the preamble (skipping the ceremony)', async () => {
        const output = await parseMessages(lines)
          .toArray()
          .toPromise();
        expect((output[0]: any).message.text).toBe(
          'Running Metro on port 8081.',
        );
      });

      it('finds the ready line', async () => {
        const output = await parseMessages(lines)
          .toArray()
          .toPromise();
        const readyLines = output.filter(line => line.type === 'ready');
        expect(readyLines.length).toBe(
          1,
          'Expected exactly one ready message.',
        );
      });
    });
  });
});

function getLines(name: string): Observable<string> {
  const pathToFile = nuclideUri.resolve(
    __dirname,
    '../__mocks__/fixtures',
    `${name}.txt`,
  );
  return Observable.defer(() => fsPromise.readFile(pathToFile)).switchMap(
    contents => Observable.from(contents.toString().split('\n')),
  );
}
