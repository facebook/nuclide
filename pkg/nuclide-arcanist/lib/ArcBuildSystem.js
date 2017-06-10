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

import type {Task} from '../../commons-node/tasks';
import type {TaskEvent} from 'nuclide-commons/process';
import type {TaskMetadata} from '../../nuclide-task-runner/lib/types';
import type {ArcToolbarModel as ArcToolbarModelType} from './ArcToolbarModel';
import type {Directory} from '../../nuclide-remote-connection';

import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {taskFromObservable} from '../../commons-node/tasks';
import {observableFromSubscribeFunction} from 'nuclide-commons/event';
import {createExtraUiComponent} from './ui/createExtraUiComponent';
import React from 'react';
import {Observable} from 'rxjs';

export default class ArcBuildSystem {
  _model: ArcToolbarModelType;
  _extraUi: ?ReactClass<any>;
  id: string;
  name: string;

  constructor() {
    this.id = 'arcanist';
    this._model = this._getModel();
    this.name = this._model.getName();
  }

  setProjectRoot(
    projectRoot: ?Directory,
    callback: (enabled: boolean, taskList: Array<TaskMetadata>) => mixed,
  ): IDisposable {
    const path = projectRoot ? projectRoot.getPath() : null;
    this._model.setProjectPath(path);

    const storeReady = observableFromSubscribeFunction(
      this._model.onChange.bind(this._model),
    )
      .map(() => this._model)
      .startWith(this._model)
      .filter(
        model =>
          model.isArcSupported() !== null &&
          model.getActiveProjectPath() === path,
      );

    const enabledObservable = storeReady
      .map(model => model.isArcSupported() === true)
      .distinctUntilChanged();

    const tasksObservable = storeReady.map(model => model.getTaskList());

    return new UniversalDisposable(
      Observable.combineLatest(
        enabledObservable,
        tasksObservable,
      ).subscribe(([enabled, tasks]) => callback(enabled, tasks)),
    );
  }

  _getModel(): ArcToolbarModelType {
    let ArcToolbarModel;
    try {
      // $FlowFB
      ArcToolbarModel = require('./fb/FbArcToolbarModel').FbArcToolbarModel;
    } catch (_) {
      ArcToolbarModel = require('./ArcToolbarModel').ArcToolbarModel;
    }
    return new ArcToolbarModel();
  }

  getExtraUi(): ReactClass<any> {
    if (this._extraUi == null) {
      this._extraUi = createExtraUiComponent(this._model);
    }
    return this._extraUi;
  }

  getIcon(): ReactClass<any> {
    return ArcIcon;
  }

  runTask(taskType: string): Task {
    if (!this._model.getTaskList().some(task => task.type === taskType)) {
      throw new Error(`There's no hhvm task named "${taskType}"`);
    }

    const taskFunction = getTaskRunFunction(this._model, taskType);
    return taskFromObservable(taskFunction());
  }
}

function getTaskRunFunction(
  model: ArcToolbarModelType,
  taskType: string,
): () => Observable<TaskEvent> {
  switch (taskType) {
    case 'build':
      return () => model.arcBuild();
    default:
      throw new Error(`Invalid task type: ${taskType}`);
  }
}

const ArcIcon = () => <span>arc</span>;
