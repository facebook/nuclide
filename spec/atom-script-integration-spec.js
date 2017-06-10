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

// The tests for the nuclide-atom-script package cannot live in pkg/nuclide-atom-script/spec
// because nuclide-atom-script specifies a custom test runner as part of its implementation
// in its package.json. As such, any tests for it that need to use Atom's built-in test runner
// need to live elsewhere, which is why they are in the top-level spec/ directory.

import {runCommand} from 'nuclide-commons/process';

describe('atom-script', () => {
  describe('echo sample', () => {
    // This module is CommonJS (i.e. `module.exports = function() {}`)
    const echoScript = require.resolve(
      './fixtures/atom-script-echo-in-commonjs',
    );

    it('with zero arguments', () => {
      waitsForPromise(async () => {
        const stdout = await runAtomScript(echoScript);
        expect(stdout).toBe('Please pass me an arg!\n');
      });
    });

    it('with multiple arguments arguments', () => {
      waitsForPromise(async () => {
        const stdout = await runAtomScript(echoScript, ['one', 'two', 'three']);
        expect(stdout).toBe('one two three\n');
      });
    });
  });

  describe('markdown sample', () => {
    // This is an ES Module (i.e. `export default function() {}`)
    const markdownScript = require.resolve(
      '../pkg/nuclide-atom-script/samples/markdown',
    );
    const readme = require.resolve('../pkg/nuclide-atom-script/README.md');

    it(
      'verify that all of the output has been written to stdout ' +
        '(Note this is important to verify because the logic for flushing a large amount of data ' +
        'is a bit shaky.)',
      () => {
        waitsForPromise(async () => {
          const stdout = await runAtomScript(markdownScript, [readme]);
          expect(stdout.endsWith('</body>\n</html>\n')).toBe(true);
        });
      },
    );
  });
});

function runAtomScript(script: string, args = []): Promise<string> {
  return runCommand(
    require.resolve('../pkg/nuclide-atom-script/bin/atom-script'),
    [script].concat(args),
  ).toPromise();
}
