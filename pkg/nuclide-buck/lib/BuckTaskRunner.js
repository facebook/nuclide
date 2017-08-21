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

import type {Directory} from '../../nuclide-remote-connection';
import type {TaskMetadata} from '../../nuclide-task-runner/lib/types';
import type {Task} from '../../commons-node/tasks';
import type {
  AppState,
  DeploymentTarget,
  SerializedState,
  Store,
  TaskType,
  CompilationDatabaseParams,
} from './types';
import {PlatformService} from './PlatformService';

import invariant from 'assert';
import {applyMiddleware, createStore} from 'redux';
import {Observable} from 'rxjs';
import {createMessage, taskFromObservable} from '../../commons-node/tasks';
import {BuckBuildSystem} from './BuckBuildSystem';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {
  combineEpics,
  createEpicMiddleware,
} from 'nuclide-commons/redux-observable';

import {bindObservableAsProps} from 'nuclide-commons-ui/bindObservableAsProps';
import {getLogger} from 'log4js';
import {Icon} from 'nuclide-commons-ui/Icon';
import * as Actions from './redux/Actions';
import * as Epics from './redux/Epics';
import Reducers from './redux/Reducers';
import BuckToolbar from './BuckToolbar';
import observeBuildCommands from './observeBuildCommands';
import React from 'react';
import {arrayEqual} from 'nuclide-commons/collection';
import shallowequal from 'shallowequal';

const TASKS = [
  {
    type: 'build',
    label: 'Build',
    description: 'Build the specified Buck target',
    icon: 'tools',
  },
  {
    type: 'run',
    label: 'Run',
    description: 'Run the specfied Buck target',
    icon: 'triangle-right',
  },
  {
    type: 'test',
    label: 'Test',
    description: 'Test the specfied Buck target',
    icon: 'check',
  },
  {
    type: 'debug',
    label: 'Debug',
    description: 'Debug the specfied Buck target',
    icon: 'nuclicon-debugger',
  },
];

// This must match URI defined in ../../nuclide-console/lib/ui/ConsoleContainer
const CONSOLE_VIEW_URI = 'atom://nuclide/console';

function shouldEnableTask(taskType: TaskType, ruleType: string): boolean {
  switch (taskType) {
    case 'build':
    case 'test':
      return true;
    case 'run':
      return ruleType.endsWith('binary');
    default:
      return false;
  }
}

export class BuckTaskRunner {
  _store: Store;
  _disposables: UniversalDisposable;
  _extraUi: ?ReactClass<any>;
  id: string;
  name: string;
  _serializedState: ?SerializedState;
  _buildSystem: BuckBuildSystem;
  _platformService: PlatformService;

  constructor(initialState: ?SerializedState) {
    this.id = 'buck';
    this.name = 'Buck';
    this._buildSystem = new BuckBuildSystem();
    this._serializedState = initialState;
    this._disposables = new UniversalDisposable();
    this._platformService = new PlatformService();
  }

  getExtraUi(): ReactClass<any> {
    if (this._extraUi == null) {
      const store = this._getStore();
      const boundActions = {
        setBuildTarget: buildTarget =>
          store.dispatch(Actions.setBuildTarget(buildTarget)),
        setDeploymentTarget: deploymentTarget =>
          store.dispatch(Actions.setDeploymentTarget(deploymentTarget)),
        setTaskSettings: settings =>
          store.dispatch(Actions.setTaskSettings(settings)),
      };
      this._extraUi = bindObservableAsProps(
        // $FlowFixMe: type symbol-observable
        Observable.from(store).map(appState => ({appState, ...boundActions})),
        BuckToolbar,
      );
    }
    return this._extraUi;
  }

  getIcon(): ReactClass<any> {
    return () =>
      <Icon icon="nuclicon-buck" className="nuclide-buck-task-runner-icon" />;
  }

  getBuildSystem(): BuckBuildSystem {
    return this._buildSystem;
  }

  getPlatformService(): PlatformService {
    return this._platformService;
  }

  setProjectRoot(
    projectRoot: ?Directory,
    callback: (enabled: boolean, taskList: Array<TaskMetadata>) => mixed,
  ): IDisposable {
    const path = projectRoot == null ? null : projectRoot.getPath();

    // $FlowFixMe: type symbol-observable
    const storeReady: Observable<AppState> = Observable.from(this._getStore())
      .distinctUntilChanged()
      .filter(
        (state: AppState) =>
          !state.isLoadingBuckProject && state.projectRoot === path,
      )
      .share();

    const enabledObservable = storeReady
      .map(state => state.buckRoot != null)
      .distinctUntilChanged();

    const tasksObservable = storeReady
      .map(state => {
        const {buildRuleType, platformGroups, selectedDeploymentTarget} = state;

        const tasksFromPlatform = new Set();
        if (
          selectedDeploymentTarget != null &&
          selectedDeploymentTarget.platform.isMobile
        ) {
          selectedDeploymentTarget.platform
            .tasksForDevice(selectedDeploymentTarget.device)
            .forEach(taskType => tasksFromPlatform.add(taskType));
        } else if (buildRuleType != null) {
          const ruleType = buildRuleType;
          platformGroups.forEach(platformGroup => {
            platformGroup.platforms.forEach(platform => {
              if (!platform.isMobile) {
                platform
                  .tasksForBuildRuleType(ruleType)
                  .forEach(taskType => tasksFromPlatform.add(taskType));
              }
            });
          });
        }
        return TASKS.map(task => {
          const enabled =
            !state.isLoadingPlatforms &&
            buildRuleType != null &&
            (tasksFromPlatform.size > 0
              ? tasksFromPlatform.has(task.type)
              : shouldEnableTask(task.type, buildRuleType.type));

          return {...task, disabled: !enabled};
        });
      })
      .distinctUntilChanged((a, b) => arrayEqual(a, b, shallowequal));

    const subscription = Observable.combineLatest(
      enabledObservable,
      tasksObservable,
    ).subscribe(([enabled, tasks]) => callback(enabled, tasks));

    this._getStore().dispatch(Actions.setProjectRoot(path));

    return new UniversalDisposable(subscription);
  }

  _getStore(): Store {
    if (this._store == null) {
      invariant(this._serializedState != null);
      const initialState: AppState = {
        platformGroups: [],
        platformService: this._platformService,
        projectRoot: null,
        buckRoot: null,
        isLoadingBuckProject: false,
        isLoadingRule: false,
        isLoadingPlatforms: false,
        buildTarget: this._serializedState.buildTarget || '',
        buildRuleType: null,
        selectedDeploymentTarget: null,
        taskSettings: this._serializedState.taskSettings || {},
        platformProviderUi: null,
        lastSessionPlatformName: this._serializedState.selectedPlatformName,
        lastSessionDeviceName: this._serializedState.selectedDeviceName,
      };
      const epics = Object.keys(Epics)
        .map(k => Epics[k])
        .filter(epic => typeof epic === 'function');
      const rootEpic = (actions, store) =>
        combineEpics(...epics)(actions, store)
          // Log errors and continue.
          .catch((err, stream) => {
            getLogger('nuclide-buck').error(err);
            return stream;
          });
      this._store = createStore(
        Reducers,
        initialState,
        applyMiddleware(createEpicMiddleware(rootEpic)),
      );
      this._disposables.add(observeBuildCommands(this._store));
    }
    return this._store;
  }

  getCompilationDatabaseParamsForCurrentContext(): CompilationDatabaseParams {
    const {selectedDeploymentTarget} = this._getStore().getState();
    const empty = {flavorsForTarget: [], args: []};
    if (selectedDeploymentTarget == null) {
      return empty;
    }
    const {platform} = selectedDeploymentTarget;
    if (typeof platform.getCompilationDatabaseParams === 'function') {
      return platform.getCompilationDatabaseParams();
    }
    return empty;
  }

  runTask(taskType: string): Task {
    invariant(
      taskType === 'build' ||
        taskType === 'test' ||
        taskType === 'run' ||
        taskType === 'debug',
      'Invalid task type',
    );

    // eslint-disable-next-line nuclide-internal/atom-apis
    atom.workspace.open(CONSOLE_VIEW_URI);

    const state = this._getStore().getState();
    const {
      buckRoot,
      buildRuleType,
      buildTarget,
      selectedDeploymentTarget,
      taskSettings,
    } = state;
    // flowlint-next-line sketchy-null-string:off
    invariant(buckRoot);
    invariant(buildRuleType);

    const deploymentString = formatDeploymentTarget(selectedDeploymentTarget);

    const task = taskFromObservable(
      Observable.concat(
        createMessage(
          `Resolving ${taskType} command for "${buildTarget}"${deploymentString}`,
          'log',
        ),
        Observable.defer(() => {
          if (selectedDeploymentTarget) {
            const {platform, device} = selectedDeploymentTarget;
            return platform.runTask(
              this._buildSystem,
              taskType,
              buildRuleType.buildTarget,
              taskSettings,
              device,
            );
          } else {
            const subcommand = taskType === 'debug' ? 'build' : taskType;
            return this._buildSystem.runSubcommand(
              buckRoot,
              subcommand,
              buildRuleType.buildTarget,
              taskSettings,
              taskType === 'debug',
              null,
            );
          }
        }),
      ),
    );

    return {
      ...task,
      getTrackingData: () => ({
        buckRoot,
        buildTarget,
        taskSettings: state.taskSettings,
      }),
    };
  }

  dispose(): void {
    this._disposables.dispose();
  }

  serialize(): ?SerializedState {
    // If we haven't had to load and create the Flux stuff yet, don't do it now.
    if (this._store == null) {
      return;
    }
    const state = this._store.getState();
    const {buildTarget, taskSettings, selectedDeploymentTarget} = state;
    let selectedPlatformName;
    let selectedDeviceName;
    if (selectedDeploymentTarget) {
      selectedPlatformName = selectedDeploymentTarget.platform.name;
      selectedDeviceName = selectedDeploymentTarget.device
        ? selectedDeploymentTarget.device.name
        : null;
    } else {
      // In case the user quits before the session is restored, forward the session restoration.
      selectedPlatformName = state.lastSessionPlatformName;
      selectedDeviceName = state.lastSessionDeviceName;
    }

    return {
      buildTarget,
      taskSettings,
      selectedPlatformName,
      selectedDeviceName,
    };
  }
}

function formatDeploymentTarget(deploymentTarget: ?DeploymentTarget): string {
  if (!deploymentTarget) {
    return '';
  }
  const {device, platform} = deploymentTarget;
  const deviceString = device ? `: ${device.name}` : '';
  return ` on "${platform.name}${deviceString}"`;
}
