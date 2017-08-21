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
import type {ClangConfigurationProvider} from '../../nuclide-clang/lib/types';

import createPackage from 'nuclide-commons-atom/createPackage';
import registerGrammar from '../../commons-atom/register-grammar';
import {CompositeDisposable} from 'atom';
import {openNearestBuildFile} from './buildFiles';
import {getSuggestion} from './HyperclickProvider';
import {track} from '../../nuclide-analytics';
import {BuckTaskRunner} from './BuckTaskRunner';
import {PlatformService} from './PlatformService';
import {getClangProvider} from './BuckClangProvider';

const OPEN_NEAREST_BUILD_FILE_COMMAND = 'nuclide-buck:open-nearest-build-file';

class Activation {
  _disposables: CompositeDisposable;
  _taskRunner: BuckTaskRunner;
  _initialState: ?Object = null;

  constructor(rawState: ?Object) {
    this._taskRunner = new BuckTaskRunner(rawState);
    this._disposables = new CompositeDisposable(
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
      this._taskRunner,
    );
    registerGrammar('source.python', ['BUCK']);
    registerGrammar('source.json', ['BUCK.autodeps']);
    registerGrammar('source.ini', ['.buckconfig']);
  }

  dispose(): void {
    this._disposables.dispose();
  }

  consumeTaskRunnerServiceApi(api: TaskRunnerServiceApi): void {
    this._disposables.add(api.register(this._taskRunner));
  }

  provideObservableDiagnosticUpdates() {
    return this._taskRunner.getBuildSystem().getDiagnosticProvider();
  }

  serialize(): ?SerializedState {
    return this._taskRunner.serialize();
  }

  getHyperclickProvider(): HyperclickProvider {
    return {
      priority: 200,
      providerName: 'nuclide-buck',
      getSuggestion(editor, position) {
        return getSuggestion(editor, position);
      },
    };
  }

  provideBuckBuilder(): BuckBuildSystem {
    return this._taskRunner.getBuildSystem();
  }

  providePlatformService(): PlatformService {
    return this._taskRunner.getPlatformService();
  }

  provideClangConfiguration(): ClangConfigurationProvider {
    return getClangProvider(this._taskRunner);
  }
}

createPackage(module.exports, Activation);
