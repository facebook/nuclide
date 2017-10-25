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

import type {Task} from '../../../commons-node/tasks';
import type {TaskMetadata} from '../../../nuclide-task-runner/lib/types';
import type {Directory} from '../../../nuclide-remote-connection';
import type {SwiftPMTaskRunnerStoreState} from './SwiftPMTaskRunnerStoreState';

import {Observable, Subject} from 'rxjs';
import * as React from 'react';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import fsPromise from 'nuclide-commons/fsPromise';
import {observeProcess, exitEventToMessage} from 'nuclide-commons/process';
import {observableFromSubscribeFunction} from 'nuclide-commons/event';
import {createMessage, taskFromObservable} from '../../../commons-node/tasks';
import SwiftPMTaskRunnerStore from './SwiftPMTaskRunnerStore';
import SwiftPMTaskRunnerActions from './SwiftPMTaskRunnerActions';
import SwiftPMTaskRunnerDispatcher from './SwiftPMTaskRunnerDispatcher';
import {buildCommand, testCommand} from './SwiftPMTaskRunnerCommands';
import {
  SwiftPMTaskRunnerBuildTaskMetadata,
  SwiftPMTaskRunnerTestTaskMetadata,
  SwiftPMTaskRunnerTaskMetadata,
} from './SwiftPMTaskRunnerTaskMetadata';
import SwiftPMTaskRunnerToolbar from './toolbar/SwiftPMTaskRunnerToolbar';
import SwiftPMAutocompletionProvider from './providers/SwiftPMAutocompletionProvider';
import {Icon} from 'nuclide-commons-ui/Icon';
import nullthrows from 'nullthrows';
import nuclideUri from 'nuclide-commons/nuclideUri.js';

/**
 * nuclide-swift makes use of the Flux design pattern. The SwiftPMTaskRunner is
 * responsible for kicking off SwiftPM tasks such as building a package. How it
 * builds the package is determined by the state of the
 * SwiftPMTaskRunnerToolbar -- the path to the package, whether a build path is
 * specified, etc. -- and that state is maintained by the
 * SwiftPMTaskRunnerStore. Updates to the toolbar UI options trigger actions,
 * defined in SwiftPMTaskRunnerActions, which update the state of the store.
 * Actions are routed to the store via a Flux.Dispatcher (instantiated by
 * SwiftPMTaskRunner).
 */
type SwiftPMTaskRunnerFlux = {
  store: SwiftPMTaskRunnerStore,
  actions: SwiftPMTaskRunnerActions,
};

// This must match URI defined in ../../../nuclide-console/lib/ui/ConsoleContainer
const CONSOLE_VIEW_URI = 'atom://nuclide/console';

/**
 * The primary controller for spawning SwiftPM tasks, such as building a
 * package, or running its tests. This class conforms to Nuclide's TaskRunner
 * interface.
 */
export class SwiftPMTaskRunner {
  id: string;
  name: string;
  _disposables: UniversalDisposable;
  _initialState: ?SwiftPMTaskRunnerStoreState;
  _flux: ?SwiftPMTaskRunnerFlux;
  _autocompletionProvider: ?SwiftPMAutocompletionProvider;
  _projectRoot: Subject<?string>;

  constructor(initialState: ?SwiftPMTaskRunnerStoreState) {
    this.id = 'swiftpm';
    this.name = 'Swift';
    this._initialState = initialState;
    this._projectRoot = new Subject();
    this._disposables = new UniversalDisposable(
      this._projectRoot.subscribe(path =>
        this._getFlux().actions.updateProjectRoot(path),
      ),
    );
  }

  dispose(): void {
    this._disposables.dispose();
  }

  serialize(): SwiftPMTaskRunnerStoreState {
    return this._getFlux().store.serialize();
  }

  getExtraUi(): React.ComponentType<any> {
    const {store, actions} = this._getFlux();
    return class ExtraUi extends React.Component<{}> {
      render(): React.Node {
        return <SwiftPMTaskRunnerToolbar store={store} actions={actions} />;
      }
    };
  }

  getIcon(): React.ComponentType<any> {
    return () => (
      <Icon icon="nuclicon-swift" className="nuclide-swift-task-runner-icon" />
    );
  }

  runTask(taskName: string): Task {
    const store = this._getFlux().store;
    const chdir = nullthrows(store.getProjectRoot());
    const configuration = store.getConfiguration();
    const buildPath = store.getBuildPath();

    let command;
    switch (taskName) {
      case SwiftPMTaskRunnerBuildTaskMetadata.type:
        command = buildCommand(
          chdir,
          configuration,
          store.getXcc(),
          store.getXlinker(),
          store.getXswiftc(),
          buildPath,
        );
        break;
      case SwiftPMTaskRunnerTestTaskMetadata.type:
        command = testCommand(chdir, buildPath);
        break;
      default:
        throw new Error(`Unknown task name: ${taskName}`);
    }

    // eslint-disable-next-line rulesdir/atom-apis
    atom.workspace.open(CONSOLE_VIEW_URI, {searchAllPanes: true});

    const observable = createMessage(
      `${command.command} ${command.args.join(' ')}`,
      'log',
    ).concat(
      observeProcess(command.command, command.args, {
        /* TODO(T17353599) */ isExitError: () => false,
      })
        .catch(error => Observable.of({kind: 'error', error})) // TODO(T17463635)
        .flatMap(message => {
          switch (message.kind) {
            case 'stderr':
            case 'stdout':
              return createMessage(message.data, 'log');
            case 'exit':
              if (message.exitCode === 0) {
                this._getFlux().actions.updateCompileCommands(
                  chdir,
                  configuration,
                  buildPath,
                );
                return createMessage(
                  `${command.command} exited successfully.`,
                  'success',
                );
              } else {
                return createMessage(
                  `${command.command} failed with ${exitEventToMessage(
                    message,
                  )}`,
                  'error',
                );
              }
            default:
              return Observable.empty();
          }
        }),
    );

    return taskFromObservable(observable);
  }

  getAutocompletionProvider(): SwiftPMAutocompletionProvider {
    if (!this._autocompletionProvider) {
      this._autocompletionProvider = new SwiftPMAutocompletionProvider(
        this._getFlux().store,
      );
    }
    return this._autocompletionProvider;
  }

  setProjectRoot(
    projectRoot: ?Directory,
    callback: (enabled: boolean, taskList: Array<TaskMetadata>) => mixed,
  ): IDisposable {
    const path = projectRoot == null ? null : projectRoot.getPath();

    const storeReady = observableFromSubscribeFunction(
      this._getFlux().store.subscribe.bind(this._getFlux().store),
    )
      .map(() => this._getFlux().store)
      .startWith(this._getFlux().store)
      .filter(store => store.getProjectRoot() === path)
      .share();

    const enabledObservable = storeReady
      .map(store => store.getProjectRoot())
      .distinctUntilChanged()
      .switchMap(root => {
        // flowlint-next-line sketchy-null-string:off
        if (!root || nuclideUri.isRemote(root)) {
          return Observable.of(false);
        }
        return this._packageFileExistsAtPath(root);
      })
      .distinctUntilChanged();

    const tasksObservable = storeReady.map(
      store => SwiftPMTaskRunnerTaskMetadata,
    );

    const subscription = Observable.combineLatest(
      enabledObservable,
      tasksObservable,
    ).subscribe(([enabled, tasks]) => callback(enabled, tasks));

    this._projectRoot.next(path);

    return new UniversalDisposable(subscription);
  }

  async _packageFileExistsAtPath(path: string): Promise<boolean> {
    return fsPromise.exists(nuclideUri.join(path, 'Package.swift'));
  }

  _getFlux(): SwiftPMTaskRunnerFlux {
    if (!this._flux) {
      const dispatcher = new SwiftPMTaskRunnerDispatcher();
      const store = new SwiftPMTaskRunnerStore(dispatcher, this._initialState);
      this._disposables.add(store);
      const actions = new SwiftPMTaskRunnerActions(dispatcher);
      this._flux = {store, actions};
    }
    return this._flux;
  }
}
