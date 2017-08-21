/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 * @format
 */

import type {
  DiagnosticMessage,
  FileDiagnosticMessage,
  FileDiagnosticMessages,
  ProjectDiagnosticMessage,
  Store,
} from '../types';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';

import ObservableDiagnosticUpdater from './ObservableDiagnosticUpdater';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';

export default class DiagnosticUpdater {
  _observableUpdater: ObservableDiagnosticUpdater;

  constructor(store: Store) {
    this._observableUpdater = new ObservableDiagnosticUpdater(store);
  }

  onFileMessagesDidUpdate(
    callback: (update: FileDiagnosticMessages) => mixed,
    filePath: NuclideUri,
  ): IDisposable {
    return new UniversalDisposable(
      this._observableUpdater
        .getFileMessageUpdates(filePath)
        .subscribe(callback),
    );
  }

  onProjectMessagesDidUpdate(
    callback: (messages: Array<ProjectDiagnosticMessage>) => mixed,
  ): IDisposable {
    return new UniversalDisposable(
      this._observableUpdater.projectMessageUpdates.subscribe(callback),
    );
  }

  onAllMessagesDidUpdate(
    callback: (messages: Array<DiagnosticMessage>) => mixed,
  ): IDisposable {
    return new UniversalDisposable(
      this._observableUpdater.allMessageUpdates.subscribe(callback),
    );
  }

  applyFix(message: FileDiagnosticMessage): void {
    this._observableUpdater.applyFix(message);
  }

  applyFixesForFile(file: NuclideUri): void {
    this._observableUpdater.applyFixesForFile(file);
  }
}
