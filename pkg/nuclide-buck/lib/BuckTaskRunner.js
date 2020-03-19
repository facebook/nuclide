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

import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {TaskMetadata} from '../../nuclide-task-runner/lib/types';
import type {Task} from '../../commons-node/tasks';
import type {
  AppState,
  BuckSubcommand,
  CompilationDatabaseParams,
  PreferredNames,
  SerializedState,
  Store,
  TaskInfo,
  TaskType,
} from './types';
import {combineEpicsFromImports} from 'nuclide-commons/epicHelpers';
import {
  formatDeploymentTarget,
  selectValidDeploymentTarget,
} from './DeploymentTarget';
import {PlatformService} from './PlatformService';

import invariant from 'assert';
import {applyMiddleware, createStore} from 'redux';
import {Observable, Subject} from 'rxjs';
import {createMessage, taskFromObservable} from '../../commons-node/tasks';
import {NuclideArtilleryTrace} from '../../nuclide-artillery';
import {BuckBuildSystem} from './BuckBuildSystem';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {createEpicMiddleware} from 'nuclide-commons/redux-observable';
import observableFromReduxStore from 'nuclide-commons/observableFromReduxStore';

import {bindObservableAsProps} from 'nuclide-commons-ui/bindObservableAsProps';
import {Icon} from 'nuclide-commons-ui/Icon';
import * as Actions from './redux/Actions';
import * as Epics from './redux/Epics';
import Reducers from './redux/Reducers';
import BuckToolbar from './BuckToolbar';
import * as React from 'react';
import {arrayEqual} from 'nuclide-commons/collection';
import shallowequal from 'shallowequal';

export const TASKS = [
  {
    type: 'build',
    label: 'Build',
    description: 'Build the specified Buck target',
    icon: 'tools',
  },
  {
    type: 'run',
    label: 'Run',
    description: 'Run the specified Buck target',
    icon: 'triangle-right',
  },
  {
    type: 'test',
    label: 'Test',
    description: 'Test the specified Buck target',
    icon: 'check',
  },
  {
    type: 'build-launch-debug',
    label: 'Build, launch && debug',
    description: 'Build, launch and debug the specified Buck target',
    icon: 'nuclicon-debugger',
  },
  {
    type: 'launch-debug',
    label: 'Launch && debug (skip build)',
    description: 'Launch and debug the specified Buck target (skip building)',
    icon: 'nuclicon-debugger',
  },
  {
    type: 'attach-debug',
    label: 'Attach to running',
    description:
      'Attemp to find a running specified Buck target and attach debugger',
    icon: 'nuclicon-debugger',
  },
];

// This must match URI defined in ../../nuclide-console/lib/ui/ConsoleContainer
export const CONSOLE_VIEW_URI = 'atom://nuclide/console';

function shouldEnableTask(taskType: TaskType, ruleType: string): boolean {
  switch (taskType) {
    case 'build':
    case 'test':
      return true;
    case 'run':
      return ruleType.endsWith('binary');
    case 'build-launch-debug':
    case 'attach-debug':
      return ruleType.endsWith('binary') || ruleType.endsWith('test');
    case 'launch-debug':
      return false;
    default:
      return false;
  }
}

export function isDebugTask(taskType: TaskType) {
  return (
    taskType === 'build-launch-debug' ||
    taskType === 'launch-debug' ||
    taskType === 'attach-debug'
  );
}

export function getBuckSubcommandForTaskType(
  taskType: TaskType,
): BuckSubcommand {
  invariant(taskType === 'build' || taskType === 'run' || taskType === 'test');
  return taskType;
}

export class BuckTaskRunner {
  _store: Store;
  _disposables: UniversalDisposable;
  _extraUi: ?React.ComponentType<any>;
  id: string;
  name: string;
  _serializedState: ?SerializedState;
  _buildSystem: BuckBuildSystem;
  _platformService: PlatformService;
  _completedTasksObservable: Subject<TaskInfo>;

  constructor(initialState: ?SerializedState) {
    this.id = 'buck';
    this.name = 'Buck';
    this._buildSystem = new BuckBuildSystem();
    this._serializedState = initialState;
    this._disposables = new UniversalDisposable();
    this._platformService = new PlatformService();
    this._completedTasksObservable = new Subject();
  }

  getExtraUi(): React.ComponentType<any> {
    if (this._extraUi == null) {
      const store = this._getStore();
      const boundActions = {
        setBuildTarget: buildTarget =>
          store.dispatch(Actions.setBuildTarget(buildTarget)),
        setDeploymentTarget: deploymentTarget =>
          store.dispatch(Actions.setDeploymentTarget(deploymentTarget)),
        setTaskSettings: (settings, unsanizitedSettings) =>
          store.dispatch(
            Actions.setTaskSettings(settings, unsanizitedSettings),
          ),
      };
      this._extraUi = bindObservableAsProps(
        observableFromReduxStore(store)
          .map(appState => ({appState, ...boundActions}))
          .filter(props => props.appState.buckRoot != null),
        BuckToolbar,
      );
    }
    return this._extraUi;
  }

  getIcon(): React.ComponentType<any> {
    return () => (
      <Icon icon="nuclicon-buck" className="nuclide-buck-task-runner-icon" />
    );
  }

  getBuildSystem(): BuckBuildSystem {
    return this._buildSystem;
  }

  getPlatformService(): PlatformService {
    return this._platformService;
  }

  getBuildTarget(): ?string {
    return this._getStore().getState().buildTarget;
  }

  getCompletedTasks(): rxjs$Observable<TaskInfo> {
    return this._completedTasksObservable;
  }

  setBuildTarget(buildTarget: string) {
    this._getStore().dispatch(Actions.setBuildTarget(buildTarget));
  }

  setDeploymentTarget(preferredNames: PreferredNames) {
    const store = this._getStore();
    const target = selectValidDeploymentTarget(
      preferredNames,
      store.getState().platformGroups,
    );
    if (target != null) {
      store.dispatch(Actions.setDeploymentTarget(target));
    }
  }

  setProjectRoot(
    projectRoot: ?NuclideUri,
    callback: (enabled: boolean, taskList: Array<TaskMetadata>) => mixed,
  ): IDisposable {
    const storeReady: Observable<AppState> = observableFromReduxStore(
      this._getStore(),
    )
      .distinctUntilChanged()
      .filter(
        (state: AppState) =>
          !state.isLoadingBuckProject && state.projectRoot === projectRoot,
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
          if (selectedDeploymentTarget.device != null) {
            selectedDeploymentTarget.platform
              .tasksForDevice(selectedDeploymentTarget.device)
              .forEach(taskType => tasksFromPlatform.add(taskType));
          }
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

    this._getStore().dispatch(Actions.setProjectRoot(projectRoot));

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
        buckversionFileContents: null,
        isLoadingBuckProject: false,
        isLoadingRule: false,
        isLoadingPlatforms: false,
        buildTarget: this._serializedState.buildTarget || '',
        buildRuleType: null,
        selectedDeploymentTarget: null,
        userSelectedDeploymentTarget: null,
        taskSettings: this._serializedState.taskSettings || {},
        platformProviderUi: null,
        lastSessionPlatformGroupName: this._serializedState
          .selectedPlatformGroupName,
        lastSessionPlatformName: this._serializedState.selectedPlatformName,
        lastSessionDeviceGroupName: this._serializedState
          .selectedDeviceGroupName,
        lastSessionDeviceName: this._serializedState.selectedDeviceName,
        unsanitizedTaskSettings:
          this._serializedState.unsanitizedTaskSettings || {},
      };
      const rootEpic = combineEpicsFromImports(Epics, 'nuclide-buck');
      this._store = createStore(
        Reducers,
        initialState,
        applyMiddleware(createEpicMiddleware(rootEpic)),
      );
    }
    return this._store;
  }

  getCompilationDatabaseParamsForCurrentContext(): CompilationDatabaseParams {
    const {
      selectedDeploymentTarget,
      taskSettings,
    } = this._getStore().getState();
    const args = taskSettings.compileDbArguments || [];
    const empty = {flavorsForTarget: [], args, useDefaultPlatform: true};
    if (selectedDeploymentTarget == null) {
      return empty;
    }
    const {platform} = selectedDeploymentTarget;
    if (typeof platform.getCompilationDatabaseParams === 'function') {
      return platform.getCompilationDatabaseParams();
    }
    return empty;
  }

  runTask(rawTask: string): Task {
    // eslint-disable-next-line nuclide-internal/atom-apis
    atom.workspace.open(CONSOLE_VIEW_URI, {searchAllPanes: true});
    const taskType = ((rawTask: any): TaskType);

    const state = this._getStore().getState();
    const {
      buckRoot,
      buildRuleType,
      buildTarget,
      selectedDeploymentTarget,
      taskSettings,
    } = state;
    invariant(buckRoot != null);
    invariant(buildRuleType);
    invariant(taskType);

    const deploymentTargetString = formatDeploymentTarget(
      selectedDeploymentTarget,
    );
    const deploymentString =
      deploymentTargetString === '' ? '' : ` on "${deploymentTargetString}"`;

    const task = taskFromObservable(
      Observable.concat(
        createMessage(
          `Resolving ${taskType} command for "${buildTarget}"${deploymentString}`,
          'log',
        ),
        Observable.defer(() => {
          const trace = NuclideArtilleryTrace.begin('nuclide_buck', taskType);
          if (selectedDeploymentTarget) {
            const {platform, device} = selectedDeploymentTarget;
            let runTask;
            if (platform.isMobile) {
              invariant(device);
              runTask = () =>
                platform.runTask(
                  this._buildSystem,
                  taskType,
                  buildRuleType.buildTarget,
                  taskSettings,
                  device,
                );
            } else {
              runTask = () =>
                platform.runTask(
                  this._buildSystem,
                  taskType,
                  buildRuleType.buildTarget,
                  taskSettings,
                );
            }
            return runTask().finally(() => trace.end());
          } else {
            let subcommand;
            if (isDebugTask(taskType)) {
              if (buildRuleType.type.endsWith('test')) {
                subcommand = 'test';
              } else {
                subcommand = 'build';
              }
            } else {
              subcommand = getBuckSubcommandForTaskType(taskType);
            }
            return this._buildSystem
              .runSubcommand(
                buckRoot,
                subcommand,
                buildRuleType.buildTarget,
                taskSettings,
                isDebugTask(taskType),
                null,
              )
              .do({
                error() {
                  trace.end();
                },
                complete() {
                  trace.end();
                },
              });
          }
        }),
      ),
    );

    task.onDidComplete(() => {
      this._completedTasksObservable.next({
        buckRoot,
        buildRuleType,
        buildTarget,
        deploymentTarget: selectedDeploymentTarget,
        taskSettings,
      });
    });

    return {
      ...task,
      getTrackingData: () => ({
        buildTarget,
        deploymentTarget: deploymentTargetString,
        ruleType: buildRuleType.type,
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
    const {buildTarget, taskSettings, unsanitizedTaskSettings} = state;
    const target = state.selectedDeploymentTarget;
    let selectedPlatformGroupName;
    let selectedPlatformName;
    let selectedDeviceGroupName;
    let selectedDeviceName;
    if (target != null) {
      selectedPlatformGroupName = target.platformGroup.name;
      selectedPlatformName = target.platform.name;
      selectedDeviceGroupName =
        target.deviceGroup != null ? target.deviceGroup.name : null;
      selectedDeviceName = target.device != null ? target.device.name : null;
    } else {
      // In case the user quits before the session is restored, forward the session restoration.
      selectedPlatformGroupName = state.lastSessionPlatformGroupName;
      selectedPlatformName = state.lastSessionPlatformName;
      selectedDeviceGroupName = state.lastSessionDeviceGroupName;
      selectedDeviceName = state.lastSessionDeviceName;
    }

    return {
      buildTarget,
      taskSettings,
      selectedPlatformGroupName,
      selectedPlatformName,
      selectedDeviceGroupName,
      selectedDeviceName,
      unsanitizedTaskSettings,
    };
  }
}
