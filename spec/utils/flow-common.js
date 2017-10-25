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

import type {TestContext} from './remotable-tests';

import dedent from 'dedent';
import busySignal from './busy-signal-common';
import {generateFixture} from 'nuclide-commons/test-helpers';
import {Deferred} from 'nuclide-commons/promise';

export function generateFlowProject(): Promise<string> {
  // When a test fails, the generated fixtures can be found in
  // `$TMP/flow_project_xxxxxxxx`.
  return generateFixture(
    'flow_project',
    new Map([
      [
        '.flowconfig',
        dedent`
      [ignore]

      [include]

      [libs]

      [options]
    `,
      ],
      [
        'Foo.js',
        dedent`
      // @flow
      export class Foo {
        bar(): void {}
      }
    `,
      ],
      [
        'main.js',
        dedent`
      // @flow
      const num = 3;
      import {Foo} from './Foo';
      new Foo().bar();
    `,
      ],
    ]),
  );
}

export function setup(context: TestContext): Promise<atom$TextEditor> {
  const deferred: Deferred<atom$TextEditor> = new Deferred();
  waitsForPromise({timeout: 240000}, async () => {
    const flowProjectPath = await generateFlowProject();

    // Add this directory as an atom project.
    await context.setProject(flowProjectPath);
    // Open a file in the flow project we copied, and get reference to the editor's HTML.
    const editor = await atom.workspace.open(
      context.getProjectRelativePath('main.js'),
    );
    deferred.resolve(editor);
  });

  waitsFor('spinner to start', 10000, () => {
    return busySignal.isBusy();
  });

  waitsFor('spinner to stop', 30000, () => {
    return !busySignal.isBusy();
  });

  return deferred.promise;
}
