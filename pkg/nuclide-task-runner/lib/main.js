'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import type {GetToolBar} from '../../commons-atom/suda-tool-bar';
import type {
  AppState,
  BoundActionCreators,
  TaskRunnerServiceApi,
  SerializedAppState,
  Store,
  TaskStartedAction,
  TaskStoppedAction,
  TaskCompletedAction,
  TaskErroredAction,
  TaskRunner,
} from './types';
import type {CwdApi} from '../../nuclide-current-working-directory/lib/CwdApi';
import type {DistractionFreeModeProvider} from '../../nuclide-distraction-free-mode';

import syncAtomCommands from '../../commons-atom/sync-atom-commands';
import createPackage from '../../commons-atom/createPackage';
import PanelRenderer from '../../commons-atom/PanelRenderer';
import {arrayRemove} from '../../commons-node/collection';
import {combineEpics, createEpicMiddleware} from '../../commons-node/redux-observable';
import UniversalDisposable from '../../commons-node/UniversalDisposable';
import {trackEvent} from '../../nuclide-analytics';
import {createEmptyAppState} from './createEmptyAppState';
import * as Actions from './redux/Actions';
import * as Epics from './redux/Epics';
import {getActiveTaskId} from './redux/Selectors';
import * as Reducers from './redux/Reducers';
import {createPanelItem} from './ui/createPanelItem';
import invariant from 'assert';
import {Disposable} from 'atom';
import nullthrows from 'nullthrows';
import {applyMiddleware, bindActionCreators, createStore} from 'redux';
import {Observable} from 'rxjs';

// TODO: use a more general versioning mechanism.
// Perhaps Atom should provide packages with some way of doing this.
const SERIALIZED_VERSION = 2;

const SHOW_PLACEHOLDER_INITIALLY_KEY = 'nuclide:nuclide-task-runner:showPlaceholderInitially';

class Activation {
  _disposables: UniversalDisposable;
  _actionCreators: BoundActionCreators;
  _panelRenderer: PanelRenderer;
  _store: Store;

  constructor(rawState: ?SerializedAppState): void {
    let serializedState = rawState;
    if (serializedState == null || serializedState.version !== SERIALIZED_VERSION) {
      serializedState = {};
    }

    const {previousSessionVisible} = serializedState;
    const initialState = {
      ...createEmptyAppState(),
      ...serializedState,
      // If the task runner toolbar was shown previously, we'll display a placholder until the view
      // initializes so there's not a jump in the UI.
      showPlaceholderInitially: typeof previousSessionVisible === 'boolean'
        ? previousSessionVisible
        : window.localStorage.getItem(SHOW_PLACEHOLDER_INITIALLY_KEY) === 'true',
    };

    const epics = Object.keys(Epics)
      .map(k => Epics[k])
      .filter(epic => typeof epic === 'function');
    const rootEpic = combineEpics(...epics);
    this._store = createStore(
      Reducers.app,
      initialState,
      applyMiddleware(createEpicMiddleware(rootEpic), trackingMiddleware),
    );
    const states = Observable.from(this._store).filter(state => state != null);
    this._actionCreators = bindActionCreators(Actions, this._store.dispatch);
    this._panelRenderer = new PanelRenderer({
      location: 'top',
      createItem: () => createPanelItem(this._store),
    });

    this._disposables = new UniversalDisposable(
      // We stick a stream of states onto the store so that epics can use them. This is less than
      // ideal. See redux-observable/redux-observable#56
      // $FlowFixMe: Teach flow about Symbol.observable
      Observable.from(this._store).subscribe(initialState.states),

      // A stand-in for `atom.packages.didLoadInitialPackages` until atom/atom#12897
      Observable.interval(0).take(1)
        .map(() => Actions.didLoadInitialPackages())
        .subscribe(this._store.dispatch),

      // Whenever the visiblity changes, store the value in localStorage so that we can use it
      // to decide whether we should show the placeholder at the beginning of the next session.
      states
        .filter(state => state.viewIsInitialized)
        .map(state => state.visible)
        .subscribe(visible => {
          window.localStorage.setItem(SHOW_PLACEHOLDER_INITIALLY_KEY, String(visible));
        }),

      this._panelRenderer,
      atom.commands.add('atom-workspace', {
        'nuclide-task-runner:toggle-toolbar-visibility': event => {
          const visible = event.detail != null && typeof event.detail === 'object'
           ? event.detail.visible
           : undefined;
          if (typeof visible === 'boolean') {
            this._actionCreators.setToolbarVisibility(visible);
          } else {
            this._actionCreators.toggleToolbarVisibility();
          }
        },
        'nuclide-task-runner:run-selected-task': event => {
          const detail = event != null ? (event: any).detail : null;
          const taskId = detail != null && detail.taskRunnerId && detail.type ? detail : null;
          this._actionCreators.runTask(taskId);
        },
      }),

      // Add a command for each task type. If there's more than one of the same type runnable, the
      // first is used.
      // TODO: Instead, prompt user for which to use and remember their choice.
      syncAtomCommands(
        states
          .debounceTime(500)
          .map(state => state.taskLists)
          .distinctUntilChanged()
          .map(taskLists => {
            const allTasks = Array.prototype.concat(...Array.from(taskLists.values()));
            const types = allTasks
              .filter(taskMeta => taskMeta.runnable)
              .map(taskMeta => taskMeta.type);
            return new Set(types);
          }),
        taskType => ({
          'atom-workspace': {
            [`nuclide-task-runner:${taskType}`]: () => {
              const state = this._store.getState();
              const {activeTaskId, taskRunners} = state;
              const taskRunnerIds = Array.from(taskRunners.keys());
              // Give precedence to the task runner of the selected task.
              if (activeTaskId != null) {
                arrayRemove(taskRunnerIds, activeTaskId.taskRunnerId);
                taskRunnerIds.unshift(activeTaskId.taskRunnerId);
              }
              for (const taskRunnerId of taskRunnerIds) {
                const taskList = state.taskLists.get(taskRunnerId);
                if (taskList == null) { continue; }
                for (const taskMeta of taskList) {
                  if (taskMeta.runnable && taskMeta.type === taskType) {
                    this._actionCreators.runTask(taskMeta);
                    return;
                  }
                }
              }
            },
          },
        }),
      ),

      // Add a command for each individual task ID.
      syncAtomCommands(
        states
          .debounceTime(500)
          .map(state => state.taskLists)
          .distinctUntilChanged()
          .map(taskLists => {
            const state = this._store.getState();
            const taskIds = new Set();
            for (const [taskRunnerId, taskList] of taskLists) {
              const taskRunnerName = nullthrows(state.taskRunners.get(taskRunnerId)).name;
              for (const taskMeta of taskList) {
                taskIds.add({taskRunnerId, taskRunnerName, type: taskMeta.type});
              }
            }
            return taskIds;
          }),
        taskId => ({
          'atom-workspace': {
            [`nuclide-task-runner:${taskId.taskRunnerName}-${taskId.type}`]: () => {
              this._actionCreators.runTask(taskId);
            },
          },
        }),
      ),

      // Add a toggle command for each task runner.
      syncAtomCommands(
        states
          .debounceTime(500)
          .map(state => state.taskRunners)
          .distinctUntilChanged()
          .map(taskRunners => new Set(taskRunners.values())),
        taskRunner => ({
          'atom-workspace': {
            [`nuclide-task-runner:toggle-${taskRunner.name}-toolbar`]: () => {
              this._actionCreators.toggleToolbarVisibility(taskRunner.id);
            },
          },
        }),
        taskRunner => taskRunner.id,
      ),

      states
        .map(state => state.visible || (!state.viewIsInitialized && state.showPlaceholderInitially))
        .distinctUntilChanged()
        .subscribe(visible => { this._panelRenderer.render({visible}); }),
    );
  }

  dispose(): void {
    this._disposables.dispose();
  }

  consumeCurrentWorkingDirectory(api: CwdApi): void {
    this._disposables.add(api.observeCwd(directory => {
      this._actionCreators.setProjectRoot(directory);
    }));
  }

  consumeToolBar(getToolBar: GetToolBar): IDisposable {
    const toolBar = getToolBar('nuclide-task-runner');
    toolBar.addSpacer({
      priority: 400,
    });
    const {element} = toolBar.addButton({
      callback: 'nuclide-task-runner:toggle-toolbar-visibility',
      tooltip: 'Toggle Task Runner Toolbar',
      iconset: 'ion',
      icon: 'play',
      priority: 401,
    });
    element.className += ' nuclide-task-runner-tool-bar-button';

    const buttonUpdatesDisposable = new UniversalDisposable(
      // $FlowFixMe: Update rx defs to accept ish with Symbol.observable
      Observable.from(this._store).subscribe(state => {
        if (state.taskRunners.size > 0) {
          element.removeAttribute('hidden');
        } else {
          element.setAttribute('hidden', 'hidden');
        }
      }),
    );

    // Remove the button from the toolbar.
    const buttonPresenceDisposable = new Disposable(() => { toolBar.removeItems(); });

    // If this package is disabled, stop updating the button and remove it from the toolbar.
    this._disposables.add(
      buttonUpdatesDisposable,
      buttonPresenceDisposable,
    );

    // If tool-bar is disabled, stop updating the button state and remove tool-bar related cleanup
    // from this package's disposal actions.
    return new Disposable(() => {
      buttonUpdatesDisposable.dispose();
      this._disposables.remove(buttonUpdatesDisposable);
      this._disposables.remove(buttonPresenceDisposable);
    });
  }

  provideTaskRunnerServiceApi(): TaskRunnerServiceApi {
    let pkg = this;
    this._disposables.add(() => { pkg = null; });
    return {
      register: (taskRunner: TaskRunner) => {
        invariant(pkg != null, 'Task runner service API used after deactivation');
        pkg._actionCreators.registerTaskRunner(taskRunner);
        return new Disposable(() => {
          if (pkg != null) {
            pkg._actionCreators.unregisterTaskRunner(taskRunner);
          }
        });
      },
    };
  }

  serialize(): SerializedAppState {
    const state = this._store.getState();
    return {
      previousSessionActiveTaskId: state.activeTaskId || state.previousSessionActiveTaskId,
      previousSessionVisible: state.previousSessionVisible == null
        ? state.visible
        : state.previousSessionVisible,
      version: SERIALIZED_VERSION,
    };
  }

  getDistractionFreeModeProvider(): DistractionFreeModeProvider {
    let pkg = this;
    this._disposables.add(() => { pkg = null; });
    return {
      name: 'nuclide-task-runner',
      isVisible() {
        invariant(pkg != null);
        return pkg._store.getState().visible;
      },
      toggle() {
        invariant(pkg != null);
        pkg._actionCreators.toggleToolbarVisibility();
      },
    };
  }

  // Exported for testing :'(
  _getCommands() {
    return this._actionCreators;
  }

}

export default createPackage(Activation);

function trackTaskAction(
  type: string,
  action: TaskStartedAction | TaskStoppedAction | TaskCompletedAction | TaskErroredAction,
  state: AppState,
): void {
  const task = action.payload.task;
  const taskTrackingData = task != null && typeof task.getTrackingData === 'function'
    ? task.getTrackingData()
    : {};
  const error = action.type === Actions.TASK_ERRORED ? action.payload.error : null;
  const activeTaskId = getActiveTaskId(state);
  trackEvent({
    type,
    data: {
      ...taskTrackingData,
      taskRunnerId: activeTaskId && activeTaskId.taskRunnerId,
      taskType: activeTaskId && activeTaskId.type,
      errorMessage: error != null ? error.message : null,
      stackTrace: error != null ? String(error.stack) : null,
    },
  });
}

const trackingMiddleware = store => next => action => {
  switch (action.type) {
    case Actions.TASK_STARTED:
      trackTaskAction('nuclide-task-runner:task-started', action, store.getState());
      break;
    case Actions.TASK_STOPPED:
      trackTaskAction('nuclide-task-runner:task-stopped', action, store.getState());
      break;
    case Actions.TASK_COMPLETED:
      trackTaskAction('nuclide-task-runner:task-completed', action, store.getState());
      break;
    case Actions.TASK_ERRORED:
      trackTaskAction('nuclide-task-runner:task-errored', action, store.getState());
      break;
  }
  return next(action);
};
