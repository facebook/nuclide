'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import type {Store, TaskRunner} from '../types';

import {bindObservableAsProps} from '../../../nuclide-ui/bindObservableAsProps';
import {viewableFromReactElement} from '../../../commons-atom/viewableFromReactElement';
import {throttle} from '../../../commons-node/observable';
import * as Actions from '../redux/Actions';
import {getActiveTaskId, getActiveTaskRunner} from '../redux/Selectors';
import {Toolbar} from './Toolbar';
import memoize from 'lodash.memoize';
import {React} from 'react-for-atom';
import {Observable} from 'rxjs';
import shallowEqual from 'shallowequal';

export function createPanelItem(store: Store): Object {
  const staticProps = {
    runTask: taskId => { store.dispatch(Actions.runTask(taskId)); },
    selectTask: taskId => { store.dispatch(Actions.selectTask(taskId)); },
    stopTask: () => { store.dispatch(Actions.stopTask()); },
  };

  const raf = Observable.create(observer => {
    window.requestAnimationFrame(() => { observer.complete(); });
  });

  // $FlowFixMe: We need to teach Flow about Symbol.observable
  const states = Observable.from(store).distinctUntilChanged();

  // We don't want to refresh the UI with a "pending" state while we wait for the initial tasks to
  // become ready; that would cause too many updates in quick succession. So we make the parts of
  // the state related to the selected task "sticky." Other parts of the state, however, we always
  // need to update immediately (e.g. progress).
  const stickyProps = states
    .filter(state => state.tasksAreReady)
    // Map to a subset of state so we can ignore changes of the other parts.
    .map(state => ({
      taskRunners: state.taskRunners,
      activeTaskRunner: getActiveTaskRunner(state),
      activeTaskId: getActiveTaskId(state),
      taskLists: state.taskLists,
    }))
    .distinctUntilChanged(shallowEqual)
    .map(({taskRunners, activeTaskRunner, activeTaskId, taskLists}) => {
      return {
        taskRunnerInfo: Array.from(taskRunners.values()),
        getExtraUi: getExtraUiFactory(activeTaskRunner),
        activeTaskId,
        taskLists,
        getActiveTaskRunnerIcon: () => activeTaskRunner && activeTaskRunner.getIcon(),
      };
    });
  const otherProps = states
    .map(state => {
      return {
        ...staticProps,
        // Don't let people click on things if we're using "stale" sticky props.
        disabled: !state.tasksAreReady,
        progress: state.runningTaskInfo && state.runningTaskInfo.progress,
        taskIsRunning: state.runningTaskInfo != null,
        showPlaceholder: !state.viewIsInitialized && state.showPlaceholderInitially,
      };
    })
    .distinctUntilChanged(shallowEqual);
  // Throttle to animation frames.
  const props = throttle(
    Observable.combineLatest(stickyProps, otherProps, (a, b) => ({...a, ...b})),
    () => raf,
  );
  const StatefulToolbar = bindObservableAsProps(props, Toolbar);
  return viewableFromReactElement(<StatefulToolbar />);
}

/**
 * Since `getExtraUi` may create a React class dynamically, we want to ensure that we only ever call
 * it once. To do that, we memoize the function and cache the result.
 */
const extraUiFactories = new WeakMap();
function getExtraUiFactory(taskRunner: ?TaskRunner): ?() => ReactClass<any> {
  let getExtraUi = extraUiFactories.get(taskRunner);
  if (getExtraUi != null) { return getExtraUi; }
  if (taskRunner == null) { return null; }
  if (taskRunner.getExtraUi == null) { return null; }
  getExtraUi = memoize(taskRunner.getExtraUi.bind(taskRunner));
  extraUiFactories.set(taskRunner, getExtraUi);
  return getExtraUi;
}
