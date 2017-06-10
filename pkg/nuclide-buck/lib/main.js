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

import type {TaskRunnerServiceApi} from '../../nuclide-task-runner/lib/types';
import type {HyperclickProvider} from 'atom-ide-ui';
import type {SerializedState} from './types';
import type {BuckBuildSystem} from './BuckBuildSystem';

import registerGrammar from '../../commons-atom/register-grammar';
import invariant from 'assert';
import {CompositeDisposable, Disposable} from 'atom';
import {openNearestBuildFile} from './buildFiles';
import {getSuggestion} from './HyperclickProvider';
import {track} from '../../nuclide-analytics';
import {BuckTaskRunner} from './BuckTaskRunner';
import {PlatformService} from './PlatformService';

const OPEN_NEAREST_BUILD_FILE_COMMAND = 'nuclide-buck:open-nearest-build-file';

let disposables: ?CompositeDisposable = null;
let taskRunner: ?BuckTaskRunner = null;
let initialState: ?Object = null;

export function activate(rawState: ?Object): void {
  invariant(disposables == null);
  initialState = rawState;
  disposables = new CompositeDisposable(
    new Disposable(() => {
      taskRunner = null;
    }),
    new Disposable(() => {
      initialState = null;
    }),
    atom.commands.add(
      'atom-workspace',
      OPEN_NEAREST_BUILD_FILE_COMMAND,
      event => {
        track(OPEN_NEAREST_BUILD_FILE_COMMAND);
        // Add feature logging.
        const target = ((event.target: any): HTMLElement);
        openNearestBuildFile(target); // Note this returns a Promise.
      },
    ),
  );
  registerGrammar('source.python', ['BUCK']);
  registerGrammar('source.json', ['BUCK.autodeps']);
  registerGrammar('source.ini', ['.buckconfig']);
}

export function deactivate(): void {
  invariant(disposables != null);
  disposables.dispose();
  disposables = null;
}

export function consumeTaskRunnerServiceApi(api: TaskRunnerServiceApi): void {
  invariant(disposables != null);
  disposables.add(api.register(getTaskRunner()));
}

function getTaskRunner(): BuckTaskRunner {
  if (taskRunner == null) {
    invariant(disposables != null);
    taskRunner = new BuckTaskRunner(initialState);
    disposables.add(taskRunner);
  }
  return taskRunner;
}

export function provideObservableDiagnosticUpdates() {
  return getTaskRunner().getBuildSystem().getDiagnosticProvider();
}

export function serialize(): ?SerializedState {
  if (taskRunner != null) {
    return taskRunner.serialize();
  }
}

export function getHyperclickProvider(): HyperclickProvider {
  return {
    priority: 200,
    providerName: 'nuclide-buck',
    getSuggestion(editor, position) {
      return getSuggestion(editor, position);
    },
  };
}

export function provideBuckBuilder(): BuckBuildSystem {
  return getTaskRunner().getBuildSystem();
}

export function providePlatformService(): PlatformService {
  return getTaskRunner().getPlatformService();
}
