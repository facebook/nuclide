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

import type {Message} from 'nuclide-commons/process';
import type {TaskRunnerServiceApi} from '../../nuclide-task-runner/lib/types';
import type {BusySignalService} from 'atom-ide-ui';
import type {HyperclickProvider} from 'atom-ide-ui';
import type {
  BuckTaskRunnerService,
  SerializedState,
  ConsolePrinter,
  TaskInfo,
} from './types';
import type {BuckBuildSystem} from './BuckBuildSystem';
import type {ClangConfigurationProvider} from '../../nuclide-clang/lib/types';

import createPackage from 'nuclide-commons-atom/createPackage';
import registerGrammar from '../../commons-atom/register-grammar';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {openNearestBuildFile} from './buildFiles';
import {getSuggestion} from './HyperclickProvider';
import {BuckTaskRunner} from './BuckTaskRunner';
import {PlatformService} from './PlatformService';
import {getClangProvider} from './BuckClangProvider';

const OPEN_NEAREST_BUILD_FILE_COMMAND = 'nuclide-buck:open-nearest-build-file';

class Activation {
  _disposables: UniversalDisposable;
  _busySignalService: ?BusySignalService;
  _printToConsole: ?ConsolePrinter;
  _taskRunner: BuckTaskRunner;
  _initialState: ?Object = null;

  constructor(rawState: ?Object) {
    this._taskRunner = new BuckTaskRunner(rawState);
    this._disposables = new UniversalDisposable(
      atom.commands.add(
        'atom-workspace',
        OPEN_NEAREST_BUILD_FILE_COMMAND,
        event => {
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
    this._printToConsole = (message: Message) =>
      api.printToConsole(message, this._taskRunner);
    this._disposables.add(
      new UniversalDisposable(
        api.register(this._taskRunner),
        () => (this._printToConsole = null),
      ),
    );
  }

  consumeBusySignal(service: BusySignalService): IDisposable {
    this._busySignalService = service;
    return new UniversalDisposable(() => {
      this._busySignalService = null;
    });
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

  provideBuckTaskRunnerService(): BuckTaskRunnerService {
    return {
      getBuildTarget: () => this._taskRunner.getBuildTarget(),
      setBuildTarget: buildTarget =>
        this._taskRunner.setBuildTarget(buildTarget),
      setDeploymentTarget: preferredNames =>
        this._taskRunner.setDeploymentTarget(preferredNames),
      onDidCompleteTask: (callback: TaskInfo => any): IDisposable => {
        return new UniversalDisposable(
          this._taskRunner.getCompletedTasks().subscribe(callback),
        );
      },
    };
  }

  providePlatformService(): PlatformService {
    return this._taskRunner.getPlatformService();
  }

  provideClangConfiguration(): ClangConfigurationProvider {
    return getClangProvider(
      this._taskRunner,
      () => this._busySignalService,
      () => this._printToConsole,
    );
  }
}

createPackage(module.exports, Activation);
