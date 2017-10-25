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

import type {Store, TaskRunner} from '../types';

import {bindObservableAsProps} from 'nuclide-commons-ui/bindObservableAsProps';
import {viewableFromReactElement} from '../../../commons-atom/viewableFromReactElement';
import {nextAnimationFrame, throttle} from 'nuclide-commons/observable';
import * as Actions from '../redux/Actions';
import {Toolbar} from './Toolbar';
import * as React from 'react';
import {Observable} from 'rxjs';
import shallowequal from 'shallowequal';

export function createPanelItem(store: Store): Object {
  const staticProps = {
    runTask: taskMeta => {
      store.dispatch(Actions.runTask(taskMeta));
    },
    selectTaskRunner: taskRunner => {
      store.dispatch(Actions.selectTaskRunner(taskRunner, true));
    },
    stopRunningTask: () => {
      store.dispatch(Actions.stopTask());
    },
  };

  // $FlowFixMe: We need to teach Flow about Symbol.observable
  const states = Observable.from(store).distinctUntilChanged();

  // We don't want to refresh the UI with a "pending" state while we wait for the initial tasks to
  // become ready; that would cause too many updates in quick succession. So we make the parts of
  // the state related to the selected task "sticky." Other parts of the state, however, we always
  // need to update immediately (e.g. progress).
  const stickyProps = states
    .filter(state => state.taskRunnersReady && !state.isUpdatingTaskRunners)
    .startWith(store.getState())
    .map(state => ({
      taskRunners: state.taskRunners,
      statesForTaskRunners: state.statesForTaskRunners,
      activeTaskRunner: state.activeTaskRunner,
      iconComponent: state.activeTaskRunner
        ? state.activeTaskRunner.getIcon()
        : null,
      extraUiComponent: getExtraUiComponent(state.activeTaskRunner),
    }))
    .distinctUntilChanged(shallowequal);

  const alwaysUpToDateProps = states.map(state => ({
    ...staticProps,
    toolbarDisabled: !state.taskRunnersReady || state.isUpdatingTaskRunners,
    progress: state.runningTask ? state.runningTask.progress : null,
    taskIsRunning: state.runningTask != null,
    runningTaskIsCancelable: state.runningTask
      ? state.runningTask.metadata.cancelable !== false
      : undefined,
  }));

  const props = Observable.combineLatest(
    stickyProps,
    alwaysUpToDateProps,
    (a, b) => ({
      ...a,
      ...b,
    }),
  ).let(throttle(() => nextAnimationFrame));

  const StatefulToolbar = bindObservableAsProps(props, Toolbar);
  return viewableFromReactElement(<StatefulToolbar />);
}

// Since `getExtraUi` may create a React class dynamically, the classes are cached
const extraUiComponentCache = new WeakMap();
function getExtraUiComponent(
  taskRunner: ?TaskRunner,
): ?React.ComponentType<any> {
  if (!taskRunner) {
    return null;
  }
  let extraUi = extraUiComponentCache.get(taskRunner);
  if (extraUi != null) {
    return extraUi;
  }
  if (!taskRunner.getExtraUi) {
    return null;
  }
  extraUi = taskRunner.getExtraUi();
  extraUiComponentCache.set(taskRunner, extraUi);
  return extraUi;
}
