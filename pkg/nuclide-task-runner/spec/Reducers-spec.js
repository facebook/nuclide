'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import type {AnnotatedTaskMetadata, TaskId} from '../lib/types';

import {createEmptyAppState} from '../lib/createEmptyAppState';
import * as Actions from '../lib/redux/Actions';
import * as Reducers from '../lib/redux/Reducers';
import * as dummy from './dummy';

describe('Reducers', () => {

  describe('SET_TASK_LISTS', () => {

    // Previously, this would change the active task. With the new behavior, we only want to change
    // the active task when the task list reaches a "stable" state. This way, we avoid seemingly
    // random changes in UI.
    it("doesn't change the active task if the tasks are already ready", () => {
      const initialState = {
        ...createEmptyAppState(),
        tasksAreReady: true,
        taskRunners: new Map([
          ['previous-build-system', new dummy.TaskRunner('previous-build-system')],
        ]),
        activeTaskId: {
          type: 'test',
          taskRunnerId: 'some-build-system',
        },
        previousSessionActiveTaskId: {
          type: 'other',
          taskRunnerId: 'previous-build-system',
        },
      };
      const action = Actions.setTaskLists(new Map([
        ['previous-build-system', [createTask('previous-build-system', 'other')]],
      ]));
      const finalState = [action].reduce(Reducers.app, initialState);
      expect(finalState.activeTaskId).toBeNull();
    });

    describe('initial visiblity', () => {

      describe("when there's no visiblity from the previous session", () => {

        describe("when there's a task to restore from the previous session", () => {

          it('shows the toolbar', () => {
            const initialState = {
              ...createEmptyAppState(),
              taskRunners: new Map([['build-system', new dummy.TaskRunner('build-system')]]),
              taskLists: new Map(),
              previousSessionActiveTaskId: {taskRunnerId: 'build-system', type: 'test'},
              projectWasOpened: true,
            };
            const action = Actions.setTaskLists(
              new Map([['build-system', [createTask('build-system', 'test', false)]]]),
            );
            const finalState = [action].reduce(Reducers.app, initialState);
            expect(finalState.visible).toBe(true);
          });

          it("doesn't show the toolbar if the active task doesn't have a disabled value", () => {
            const initialState = {
              ...createEmptyAppState(),
              taskLists: new Map([
                ['build-system', [createTask('build-system', 'test')]],
              ]),
              previousSessionActiveTaskId: {taskRunnerId: 'build-system', type: 'test'},
            };
            const action = Actions.setTaskLists(
              new Map([['build-system', [createTask('build-system', 'test', false)]]]),
            );
            const finalState = [action].reduce(Reducers.app, initialState);
            expect(finalState.visible).toBe(false);
          });

        });

        it('hides the toolbar the first time tasks become ready without an active task', () => {
          const initialState = {
            ...createEmptyAppState(),
            taskRunners: new Map([['build-system', new dummy.TaskRunner('build-system')]]),
            taskLists: new Map(),
            previousSessionActiveTaskId: {taskRunnerId: 'build-system', type: 'test'},
          };
          const action = Actions.setTaskLists(new Map([]));
          const finalState = [action].reduce(Reducers.app, initialState);
          expect(finalState.visible).toBe(false);
        });

      });

      describe("when there's a serialized visibility from the previous session", () => {

        it('shows the toolbar if the value is true (even with no task)', () => {
          const initialState = {
            ...createEmptyAppState(),
            previousSessionVisible: true,
            projectWasOpened: true,
          };
          const action = Actions.setTaskLists(new Map());
          const finalState = [action].reduce(Reducers.app, initialState);
          expect(finalState.visible).toBe(true);
        });

        it('hides the toolbar if the value is false', () => {
          const initialState = {
            ...createEmptyAppState(),
            taskRunners: new Map([['build-system', new dummy.TaskRunner('build-system')]]),
            taskLists: new Map(),
            previousSessionActiveTaskId: {taskRunnerId: 'build-system', type: 'test'},
            previousSessionVisible: false,
          };
          const action = Actions.setTaskLists(
            new Map([['build-system', [createTask('build-system', 'test', false)]]]),
          );
          const finalState = [action].reduce(Reducers.app, initialState);
          expect(finalState.visible).toBe(false);
        });

      });

    });

  });

  describe('UNREGISTER_TASK_RUNNER', () => {

    it("doesn't leave an invalid task selected", () => {
      const taskRunner = new dummy.TaskRunner('previous-build-system');
      const initialState = {
        ...createEmptyAppState(),
        activeTaskId: {
          type: 'test',
          taskRunnerId: 'some-build-system',
        },
        taskRunners: new Map([['some-build-system', taskRunner]]),
      };
      const action = {
        type: Actions.UNREGISTER_TASK_RUNNER,
        payload: {id: 'some-build-system'},
      };
      const finalState = [action].reduce(Reducers.app, initialState);
      expect(finalState.activeTaskId).toBe(null);
    });

  });

  describe('initial tasks', () => {

    it("prefers the previous session's active task", () => {
      expect(
        getInitialTask(
          [createTask('build-system', 'other')],
          {type: 'other', taskRunnerId: 'build-system'},
        ),
      ).toEqual({type: 'other', taskRunnerId: 'build-system'});
    });

    it('prefers non-disabled tasks', () => {
      expect(
        getInitialTask([
          createTask('build-system', 'disabled', true),
          createTask('build-system', 'enabled', false),
        ]),
      ).toEqual({type: 'enabled', taskRunnerId: 'build-system'});
    });

    it('prefers tasks that provide disabled', () => {
      expect(
        getInitialTask([
          createTask('build-system', 'enabled'),
          createTask('build-system', 'enabled-better', false),
        ]),
      ).toEqual({type: 'enabled-better', taskRunnerId: 'build-system'});
    });

    it('prefers tasks with higher priority', () => {
      expect(
        getInitialTask([
          createTask('build-system', 'enabled0', false, 0),
          createTask('build-system', 'enabled1', false, 1),
          createTask('build-system', 'enabled-bad', true, 666),
        ]),
      ).toEqual({type: 'enabled1', taskRunnerId: 'build-system'});
    });

  });

  // Though the visibility shouldn't be updated when the project root changes, the initial task
  // should.
  describe('initial tasks after the view is already initialized', () => {

    it("prefers the previous session's active task", () => {
      expect(
        getInitialTask(
          [createTask('build-system', 'other')],
          {type: 'other', taskRunnerId: 'build-system'},
          true,
        ),
      ).toEqual({type: 'other', taskRunnerId: 'build-system'});
    });

    it('prefers non-disabled tasks', () => {
      expect(
        getInitialTask(
          [
            createTask('build-system', 'disabled', true),
            createTask('build-system', 'enabled', false),
          ],
          null,
          true,
        ),
      ).toEqual({type: 'enabled', taskRunnerId: 'build-system'});
    });

    it('prefers tasks that provide disabled', () => {
      expect(
        getInitialTask(
          [
            createTask('build-system', 'enabled'),
            createTask('build-system', 'enabled-better', false),
          ],
          null,
          true,
        ),
      ).toEqual({type: 'enabled-better', taskRunnerId: 'build-system'});
    });

    it('prefers tasks with higher priority', () => {
      expect(
        getInitialTask(
          [
            createTask('build-system', 'enabled0', false, 0),
            createTask('build-system', 'enabled1', false, 1),
            createTask('build-system', 'enabled-bad', true, 666),
          ],
          null,
          true,
        ),
      ).toEqual({type: 'enabled1', taskRunnerId: 'build-system'});
    });

    it('prefers the currently active task', () => {
      expect(
        getInitialTask(
          [
            createTask('build-system', 'one'),
            createTask('build-system', 'two'),
            createTask('build-system', 'three'),
          ],
          null,
          true,
          {taskRunnerId: 'build-system', type: 'three'},
        ),
      ).toEqual({type: 'three', taskRunnerId: 'build-system'});
    });

  });

});

function getInitialTask(
  taskList: Array<AnnotatedTaskMetadata>,
  previousSessionActiveTaskId: ?TaskId,
  viewIsInitialized: boolean = false,
  activeTaskId: ?TaskId,
): ?TaskId {
  const initialState = {
    ...createEmptyAppState(),
    activeTaskId,
    taskRunners: new Map([['build-system', new dummy.TaskRunner('build-system')]]),
    previousSessionActiveTaskId,
    viewIsInitialized,
  };
  const action = Actions.setTaskLists(new Map([['build-system', taskList]]));
  const finalState = [action].reduce(Reducers.app, initialState);
  return finalState.activeTaskId;
}

const createTask = (taskRunnerId, type, disabled = undefined, priority = 0) => ({
  type,
  label: type,
  description: type,
  disabled,
  priority,
  runnable: true,
  icon: 'triangle-right',
  taskRunnerId,
  taskRunnerName: taskRunnerId,
});
