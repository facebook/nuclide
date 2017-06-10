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

import type {TaskEvent} from 'nuclide-commons/process';
import type {TaskMetadata} from '../../nuclide-task-runner/lib/types';
import type {Observable} from 'rxjs';

import {Disposable} from 'atom';

export const TASKS: Array<TaskMetadata> = [];

/*
 * This will provide the toolbar functionality for the open-source-supported HHVM targets.
 * e.g. HHVM Debugger
 */
export class ArcToolbarModel {
  _projectPath: ?string;

  constructor() {}

  setProjectPath(projectPath: ?string) {
    this._projectPath = projectPath;
  }

  getActiveProjectPath(): ?string {
    return this._projectPath;
  }

  onChange(callback: () => mixed): IDisposable {
    return new Disposable(() => {});
  }

  setActiveBuildTarget(value: string): void {
    throw new Error('arc build targets not supported');
  }

  isArcSupported(): ?boolean {
    return false;
  }

  getActiveBuildTarget(): string {
    return '';
  }

  getName(): string {
    return 'Arcanist';
  }

  getTaskList(): Array<TaskMetadata> {
    return TASKS;
  }

  async arcBuild(): Observable<TaskEvent> {
    throw new Error('arc build not supported');
  }

  getBuildTargets(): ?Array<string> {
    throw new Error('arc build not supported');
  }

  updateBuildTargets(): void {
    throw new Error('arc build not supported');
  }

  getBuildTargetsError(): ?Error {
    throw new Error('arc build not supported');
  }

  viewActivated(): void {
    throw new Error('arc build not supported');
  }

  viewDeactivated(): void {
    throw new Error('arc build not supported');
  }
}
