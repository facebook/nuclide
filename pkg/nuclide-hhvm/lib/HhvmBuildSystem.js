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
import type {Task} from '../../commons-node/tasks';
import type {TaskMetadata} from '../../nuclide-task-runner/lib/types';
import type {DebugMode} from './types';

import {VsAdapterTypes} from 'nuclide-debugger-common';
import {Observable} from 'rxjs';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {observableFromSubscribeFunction} from 'nuclide-commons/event';
import {taskFromObservable} from '../../commons-node/tasks';
import {bindObservableAsProps} from 'nuclide-commons-ui/bindObservableAsProps';
import {Icon} from 'nuclide-commons-ui/Icon';
import {getDebuggerService} from 'nuclide-commons-atom/debugger';
import invariant from 'assert';
// eslint-disable-next-line nuclide-internal/no-cross-atom-imports
import {
  getLaunchProcessConfig,
  startAttachProcessConfig,
} from '../../nuclide-debugger-vsp/lib/HhvmLaunchAttachProvider';

import HhvmToolbar from './HhvmToolbar';
import ProjectStore from './ProjectStore';
import * as React from 'react';

const WEB_SERVER_OPTION = {label: 'Attach to WebServer', value: 'webserver'};
const SCRIPT_OPTION = {label: 'Launch Script', value: 'script'};
const DEBUG_OPTIONS = [WEB_SERVER_OPTION, SCRIPT_OPTION];

export default class HhvmBuildSystem {
  id: string;
  name: string;
  _projectStore: ProjectStore;
  _extraUi: ?React.ComponentType<any>;

  constructor() {
    this.id = 'hhvm';
    this.name = 'HHVM';
    this._projectStore = new ProjectStore();
    try {
      // $FlowFB
      const helpers = require('./fb-hhvm.js');
      DEBUG_OPTIONS.push(...helpers.getAdditionalLaunchOptions());
    } catch (e) {}
  }

  dispose() {
    this._projectStore.dispose();
  }

  getExtraUi(): React.ComponentType<any> {
    if (this._extraUi == null) {
      const projectStore = this._projectStore;
      const subscription = observableFromSubscribeFunction(
        projectStore.onChange.bind(projectStore),
      );
      this._extraUi = bindObservableAsProps(
        subscription
          .startWith(null)
          .mapTo({projectStore, debugOptions: DEBUG_OPTIONS}),
        HhvmToolbar,
      );
    }
    return this._extraUi;
  }

  getPriority(): number {
    return 1; // Take precedence over the Arcanist build toolbar.
  }

  getIcon(): React.ComponentType<any> {
    return () => (
      <Icon icon="nuclicon-hhvm" className="nuclide-hhvm-task-runner-icon" />
    );
  }

  runTask(taskName: string): Task {
    return taskFromObservable(
      Observable.fromPromise(
        (async () => {
          this._projectStore.updateLastUsed();
          this._projectStore.saveSettings();
          return this._debug(
            this._projectStore.getDebugMode(),
            this._projectStore.getProjectRoot(),
            this._projectStore.getDebugTarget(),
            this._projectStore.getUseTerminal(),
            this._projectStore.getScriptArguments(),
          );
        })(),
      ).ignoreElements(),
    );
  }

  async _debug(
    debugMode: DebugMode,
    activeProjectRoot: ?string,
    target: string,
    useTerminal: boolean,
    scriptArguments: string,
  ): Promise<void> {
    let processConfig = null;
    invariant(activeProjectRoot != null, 'Active project is null');

    // See if this is a custom debug mode type.
    try {
      // $FlowFB
      const helper = require('./fb-hhvm');
      processConfig = await helper.getCustomLaunchInfo(
        debugMode,
        activeProjectRoot,
        target,
        scriptArguments,
      );
    } catch (e) {}

    if (processConfig == null) {
      if (debugMode === 'script') {
        processConfig = getLaunchProcessConfig(
          activeProjectRoot,
          target,
          scriptArguments,
          null /* script wrapper */,
          useTerminal,
          '' /* cwdPath */,
        );
      } else {
        await startAttachProcessConfig(
          activeProjectRoot,
          null /* attachPort */,
          true /* serverAttach */,
        );
        return;
      }
    }

    invariant(processConfig != null);
    const debuggerService = await getDebuggerService();
    await debuggerService.startVspDebugging(processConfig);
  }

  setProjectRoot(
    projectRoot: ?NuclideUri,
    callback: (enabled: boolean, taskList: Array<TaskMetadata>) => mixed,
  ): IDisposable {
    const enabledObservable = observableFromSubscribeFunction(
      this._projectStore.onChange.bind(this._projectStore),
    )
      .map(() => this._projectStore)
      .filter(
        store =>
          store.getProjectRoot() === projectRoot &&
          // eslint-disable-next-line eqeqeq
          store.isHHVMProject() !== null,
      )
      .map(store => store.isHHVMProject() === true)
      .distinctUntilChanged();

    const getTask = (disabledMsg: ?string) => [
      {
        type: 'debug',
        label: 'Debug',
        description:
          disabledMsg != null
            ? disabledMsg
            : this._projectStore.getDebugMode() === 'webserver'
              ? 'Attach HHVM debugger to webserver'
              : 'Debug Hack/PHP Script',
        icon: 'nuclicon-debugger',
        cancelable: false,
        disabled: disabledMsg != null,
      },
    ];

    const tasksObservable = Observable.concat(
      Observable.of(null),
      Observable.fromPromise(getDebuggerService()),
    ).switchMap(debugService => {
      if (projectRoot == null || debugService == null) {
        return Observable.of(getTask(null));
      }
      return Observable.concat(
        Observable.of(getTask(null)),
        Observable.merge(
          observableFromSubscribeFunction(
            debugService.onDidChangeDebuggerSessions.bind(debugService),
          ),
          observableFromSubscribeFunction(
            this._projectStore.onChange.bind(this._projectStore),
          ),
        ).switchMap(() => {
          let disabledMsg = null;
          if (!this._projectStore.isCurrentSettingDebuggable()) {
            disabledMsg =
              this._projectStore.getDebugMode() === 'webserver'
                ? 'Cannot debug this project: Your current working root is not a Hack root!'
                : 'Cannot debug this project: The current file is not a Hack/PHP file!';
          }
          if (
            this._projectStore.getDebugMode() === 'webserver' &&
            debugService
              .getDebugSessions()
              .some(
                c =>
                  c.adapterType === VsAdapterTypes.HHVM &&
                  c.targetUri === projectRoot,
              )
          ) {
            disabledMsg =
              'The HHVM debugger is already attached to this server';
          }
          return Observable.of(getTask(disabledMsg));
        }),
      );
    });

    const subscription = Observable.combineLatest(
      enabledObservable,
      tasksObservable,
    ).subscribe(([enabled, tasks]) => callback(enabled, tasks));

    this._projectStore.setProjectRoot(projectRoot);

    return new UniversalDisposable(subscription);
  }
}
