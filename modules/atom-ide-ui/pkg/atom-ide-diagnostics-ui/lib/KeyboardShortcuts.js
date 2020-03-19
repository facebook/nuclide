/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow strict-local
 * @format
 */

import type {
  DiagnosticTrace,
  DiagnosticMessage,
  DiagnosticUpdater,
} from '../../atom-ide-diagnostics/lib/types';

import invariant from 'assert';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {goToLocation} from 'nuclide-commons-atom/go-to-location';
import {observableFromSubscribeFunction} from 'nuclide-commons/event';

// TODO(peterhal): The current index should really live in the DiagnosticStore.
export default class KeyboardShortcuts {
  _subscriptions: UniversalDisposable;
  _diagnostics: Array<DiagnosticMessage>;
  _index: ?number;
  _traceIndex: ?number;

  constructor(diagnosticUpdater: DiagnosticUpdater) {
    this._index = null;
    this._diagnostics = [];

    this._subscriptions = new UniversalDisposable();

    const first = () => this.setIndex(0);
    const last = () => this.setIndex(this._diagnostics.length - 1);
    this._subscriptions.add(
      observableFromSubscribeFunction(
        diagnosticUpdater.observeMessages,
      ).subscribe(diagnostics => {
        this._index = null;
        this._traceIndex = null;
        this._diagnostics = diagnostics;
      }),
      atom.commands.add(
        'atom-workspace',
        'diagnostics:go-to-first-diagnostic',
        first,
      ),
      atom.commands.add(
        'atom-workspace',
        'diagnostics:go-to-last-diagnostic',
        last,
      ),
      atom.commands.add(
        'atom-workspace',
        'diagnostics:go-to-next-diagnostic',
        () => {
          this._index == null ? first() : this.setIndex(this._index + 1);
        },
      ),
      atom.commands.add(
        'atom-workspace',
        'diagnostics:go-to-previous-diagnostic',
        () => {
          this._index == null ? last() : this.setIndex(this._index - 1);
        },
      ),
      atom.commands.add(
        'atom-workspace',
        'diagnostics:go-to-next-diagnostic-trace',
        () => {
          this.nextTrace();
        },
      ),
      atom.commands.add(
        'atom-workspace',
        'diagnostics:go-to-previous-diagnostic-trace',
        () => {
          this.previousTrace();
        },
      ),
    );
  }

  setIndex(index: number): void {
    this._traceIndex = null;
    if (this._diagnostics.length === 0) {
      this._index = null;
      return;
    }
    this._index = Math.max(0, Math.min(index, this._diagnostics.length - 1));
    this.gotoCurrentIndex();
  }

  gotoCurrentIndex(): void {
    invariant(this._index != null);
    invariant(this._traceIndex == null);
    const diagnostic = this._diagnostics[this._index];
    const range = diagnostic.range;
    if (range == null) {
      goToLocation(diagnostic.filePath);
    } else {
      goToLocation(diagnostic.filePath, {
        line: range.start.row,
        column: range.start.column,
      });
    }
  }

  nextTrace(): void {
    const traces = this.currentTraces();
    if (traces == null) {
      return;
    }
    let candidateTrace = this._traceIndex == null ? 0 : this._traceIndex + 1;
    while (candidateTrace < traces.length) {
      if (this.trySetCurrentTrace(traces, candidateTrace)) {
        return;
      }
      candidateTrace++;
    }
    this._traceIndex = null;
    this.gotoCurrentIndex();
  }

  previousTrace(): void {
    const traces = this.currentTraces();
    if (traces == null) {
      return;
    }
    let candidateTrace =
      this._traceIndex == null ? traces.length - 1 : this._traceIndex - 1;
    while (candidateTrace >= 0) {
      if (this.trySetCurrentTrace(traces, candidateTrace)) {
        return;
      }
      candidateTrace--;
    }
    this._traceIndex = null;
    this.gotoCurrentIndex();
  }

  currentTraces(): ?Array<DiagnosticTrace> {
    if (this._index == null) {
      return null;
    }
    const diagnostic = this._diagnostics[this._index];
    return diagnostic.trace;
  }

  // TODO: Should filter out traces whose location matches the main diagnostic's location?
  trySetCurrentTrace(
    traces: Array<DiagnosticTrace>,
    traceIndex: number,
  ): boolean {
    const trace = traces[traceIndex];
    if (trace.filePath != null && trace.range != null) {
      this._traceIndex = traceIndex;
      goToLocation(trace.filePath, {
        line: trace.range.start.row,
        column: trace.range.start.column,
      });
      return true;
    }
    return false;
  }

  dispose(): void {
    this._subscriptions.dispose();
  }
}
