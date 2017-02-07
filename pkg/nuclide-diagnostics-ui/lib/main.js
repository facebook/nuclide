/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow
 */

import type {DiagnosticMessage} from '../../nuclide-diagnostics-common';
import type {
  FileMessageUpdate,
  ObservableDiagnosticUpdater,
} from '../../nuclide-diagnostics-common';
import type {
  FileDiagnosticMessage,
  Trace,
} from '../../nuclide-diagnostics-common/lib/rpc-types';
import type {WorkspaceViewsService} from '../../nuclide-workspace-views/lib/types';
import type {GetToolBar} from '../../commons-atom/suda-tool-bar';

import invariant from 'assert';
import {Disposable} from 'atom';

import {track} from '../../nuclide-analytics';

import type {HomeFragments} from '../../nuclide-home/lib/types';

import createPackage from '../../commons-atom/createPackage';
import {observeTextEditors} from '../../commons-atom/text-editor';
import UniversalDisposable from '../../commons-node/UniversalDisposable';
import {observableFromSubscribeFunction} from '../../commons-node/event';
import {DiagnosticsPanelModel, WORKSPACE_VIEW_URI} from './DiagnosticsPanelModel';
import StatusBarTile from './StatusBarTile';
import {applyUpdateToEditor} from './gutter';
import {goToLocation} from '../../commons-atom/go-to-location';
import featureConfig from '../../commons-atom/featureConfig';
import {BehaviorSubject, Observable} from 'rxjs';

const LINTER_PACKAGE = 'linter';
const MAX_OPEN_ALL_FILES = 20;

type ActivationState = {
  showTraces: boolean,
  filterByActiveTextEditor: boolean,
};

function disableLinter() {
  atom.packages.disablePackage(LINTER_PACKAGE);
}

class Activation {
  _bottomPanel: ?atom$Panel;
  _diagnosticUpdaters: BehaviorSubject<?ObservableDiagnosticUpdater>;
  _subscriptions: UniversalDisposable;
  _state: ActivationState;
  _statusBarTile: ?StatusBarTile;

  constructor(state_: ?Object): void {
    this._diagnosticUpdaters = new BehaviorSubject(null);
    this._subscriptions = new UniversalDisposable();
    const _showDiagnosticTraces: boolean =
      (featureConfig.get('nuclide-diagnostics-ui.showDiagnosticTraces'): any);
    const state = state_ || {};
    this._state = {
      showTraces: state.showTraces || _showDiagnosticTraces,
      filterByActiveTextEditor: state.filterByActiveTextEditor === true,
    };
  }

  consumeDiagnosticUpdates(diagnosticUpdater: ObservableDiagnosticUpdater): void {
    this._getStatusBarTile().consumeDiagnosticUpdates(diagnosticUpdater);
    this._subscriptions.add(gutterConsumeDiagnosticUpdates(diagnosticUpdater));

    // Currently, the DiagnosticsPanel is designed to work with only one DiagnosticUpdater.
    if (this._diagnosticUpdaters.getValue() != null) {
      return;
    }
    this._diagnosticUpdaters.next(diagnosticUpdater);
    this._subscriptions.add(
      addAtomCommands(diagnosticUpdater),
      () => {
        if (this._diagnosticUpdaters.getValue() === diagnosticUpdater) {
          this._diagnosticUpdaters.next(null);
        }
      },
    );
  }

  consumeStatusBar(statusBar: atom$StatusBar): void {
    this._getStatusBarTile().consumeStatusBar(statusBar);
  }

  consumeToolBar(getToolBar: GetToolBar): IDisposable {
    const toolBar = getToolBar('nuclide-diagnostics-ui');
    toolBar.addButton({
      icon: 'law',
      callback: 'nuclide-diagnostics-ui:toggle-table',
      tooltip: 'Toggle Diagnostics Table',
      priority: 100,
    });
    const disposable = new Disposable(() => { toolBar.removeItems(); });
    this._subscriptions.add(disposable);
    return disposable;
  }

  deserializeDiagnosticsPanelModel(): DiagnosticsPanelModel {
    return this._createDiagnosticsPanelModel();
  }

  dispose(): void {
    this._subscriptions.dispose();
    if (this._statusBarTile) {
      this._statusBarTile.dispose();
      this._statusBarTile = null;
    }
  }

  serialize(): ActivationState {
    return this._state;
  }

  getHomeFragments(): HomeFragments {
    return {
      feature: {
        title: 'Diagnostics',
        icon: 'law',
        description: 'Displays diagnostics, errors, and lint warnings for your files and projects.',
        command: 'nuclide-diagnostics-ui:show-table',
      },
      priority: 4,
    };
  }

  _createDiagnosticsPanelModel(): DiagnosticsPanelModel {
    return new DiagnosticsPanelModel(
      this._diagnosticUpdaters
        .switchMap(updater => (
          updater == null ? Observable.of([]) : updater.allMessageUpdates
        )),
      this._state.showTraces,
      showTraces => {
        if (this._state != null) {
          this._state.showTraces = showTraces;
        }
      },
      disableLinter,
      observeLinterPackageEnabled(),
      this._state.filterByActiveTextEditor,
      filterByActiveTextEditor => {
        if (this._state != null) {
          this._state.filterByActiveTextEditor = filterByActiveTextEditor;
        }
      },
    );
  }

  consumeWorkspaceViewsService(api: WorkspaceViewsService): void {
    this._subscriptions.add(
      api.addOpener(uri => {
        if (uri === WORKSPACE_VIEW_URI) {
          return this._createDiagnosticsPanelModel();
        }
      }),
      () => api.destroyWhere(item => item instanceof DiagnosticsPanelModel),
      atom.commands.add(
        'atom-workspace',
        'nuclide-diagnostics-ui:toggle-table',
        event => { api.toggle(WORKSPACE_VIEW_URI, (event: any).detail); },
      ),
    );
  }

  _getStatusBarTile(): StatusBarTile {
    if (!this._statusBarTile) {
      this._statusBarTile = new StatusBarTile();
    }
    return this._statusBarTile;
  }
}

function gutterConsumeDiagnosticUpdates(
  diagnosticUpdater: ObservableDiagnosticUpdater,
): IDisposable {
  const fixer = diagnosticUpdater.applyFix.bind(diagnosticUpdater);
  return observeTextEditors((editor: TextEditor) => {
    const filePath = editor.getPath();
    if (!filePath) {
      return; // The file is likely untitled.
    }

    const callback = (update: FileMessageUpdate) => {
      // Although the subscription below should be cleaned up on editor destroy,
      // the very act of destroying the editor can trigger diagnostic updates.
      // Thus this callback can still be triggered after the editor is destroyed.
      if (!editor.isDestroyed()) {
        applyUpdateToEditor(editor, update, fixer);
      }
    };
    const disposable = new UniversalDisposable(
      diagnosticUpdater.getFileMessageUpdates(filePath).subscribe(callback),
    );

    // Be sure to remove the subscription on the DiagnosticStore once the editor is closed.
    editor.onDidDestroy(() => disposable.dispose());
  });
}

function addAtomCommands(diagnosticUpdater: ObservableDiagnosticUpdater): IDisposable {
  const fixAllInCurrentFile = () => {
    const editor = atom.workspace.getActiveTextEditor();
    if (editor == null) {
      return;
    }
    const path = editor.getPath();
    if (path == null) {
      return;
    }
    track('diagnostics-autofix-all-in-file');
    diagnosticUpdater.applyFixesForFile(path);
  };

  const openAllFilesWithErrors = () => {
    track('diagnostics-panel-open-all-files-with-errors');
    diagnosticUpdater.allMessageUpdates
      .first()
      .subscribe((messages: Array<DiagnosticMessage>) => {
        const errorsToOpen = getTopMostErrorLocationsByFilePath(messages);

        if (errorsToOpen.size > MAX_OPEN_ALL_FILES) {
          atom.notifications.addError(
            `Diagnostics: Will not open more than ${MAX_OPEN_ALL_FILES} files`,
          );
          return;
        }

        const column = 0;
        errorsToOpen.forEach((line, uri) => goToLocation(uri, line, column));
      });
  };

  return new UniversalDisposable(
    atom.commands.add(
      'atom-workspace',
      'nuclide-diagnostics-ui:fix-all-in-current-file',
      fixAllInCurrentFile,
    ),
    atom.commands.add(
      'atom-workspace',
      'nuclide-diagnostics-ui:open-all-files-with-errors',
      openAllFilesWithErrors,
    ),
    new KeyboardShortcuts(diagnosticUpdater),
  );
}

function getTopMostErrorLocationsByFilePath(
  messages: Array<DiagnosticMessage>,
): Map<string, number> {
  const errorLocations: Map<string, number> = new Map();

  messages.forEach(message => {
    if (message.scope !== 'file' || message.filePath == null) {
      return;
    }
    const filePath = message.filePath;
    // If initialLine is N, Atom will navigate to line N+1.
    // Flow sometimes reports a row of -1, so this ensures the line is at least one.
    let line = Math.max(message.range ? message.range.start.row : 0, 0);

    const prevMinLine = errorLocations.get(filePath);
    if (prevMinLine != null) {
      line = Math.min(prevMinLine, line);
    }

    errorLocations.set(filePath, line);
  });

  return errorLocations;
}

// TODO(peterhal): The current index should really live in the DiagnosticStore.
class KeyboardShortcuts {
  _subscriptions: UniversalDisposable;
  _diagnostics: Array<FileDiagnosticMessage>;
  _index: ?number;
  _traceIndex: ?number;

  constructor(diagnosticUpdater: ObservableDiagnosticUpdater) {
    this._index = null;
    this._diagnostics = [];

    this._subscriptions = new UniversalDisposable();

    const first = () => this.setIndex(0);
    const last = () => this.setIndex(this._diagnostics.length - 1);
    this._subscriptions.add(
      diagnosticUpdater.allMessageUpdates.subscribe(
        diagnostics => {
          this._diagnostics = (diagnostics
            .filter(diagnostic => diagnostic.scope === 'file'): any);
          this._index = null;
          this._traceIndex = null;
        }),
      atom.commands.add(
        'atom-workspace',
        'nuclide-diagnostics-ui:go-to-first-diagnostic',
        first,
      ),
      atom.commands.add(
        'atom-workspace',
        'nuclide-diagnostics-ui:go-to-last-diagnostic',
        last,
      ),
      atom.commands.add(
        'atom-workspace',
        'nuclide-diagnostics-ui:go-to-next-diagnostic',
        () => { this._index == null ? first() : this.setIndex(this._index + 1); },
      ),
      atom.commands.add(
        'atom-workspace',
        'nuclide-diagnostics-ui:go-to-previous-diagnostic',
        () => { this._index == null ? last() : this.setIndex(this._index - 1); },
      ),
      atom.commands.add(
        'atom-workspace',
        'nuclide-diagnostics-ui:go-to-next-diagnostic-trace',
        () => { this.nextTrace(); },
      ),
      atom.commands.add(
        'atom-workspace',
        'nuclide-diagnostics-ui:go-to-previous-diagnostic-trace',
        () => { this.previousTrace(); },
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
      goToLocation(diagnostic.filePath, range.start.row, range.start.column);
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
    let candidateTrace = this._traceIndex == null ? traces.length - 1 : this._traceIndex - 1;
    while (candidateTrace >= 0) {
      if (this.trySetCurrentTrace(traces, candidateTrace)) {
        return;
      }
      candidateTrace--;
    }
    this._traceIndex = null;
    this.gotoCurrentIndex();
  }

  currentTraces(): ?Array<Trace> {
    if (this._index == null) {
      return null;
    }
    const diagnostic = this._diagnostics[this._index];
    return diagnostic.trace;
  }

  // TODO: Should filter out traces whose location matches the main diagnostic's location?
  trySetCurrentTrace(traces: Array<Trace>, traceIndex: number): boolean {
    const trace = traces[traceIndex];
    if (trace.filePath != null && trace.range != null) {
      this._traceIndex = traceIndex;
      goToLocation(trace.filePath, trace.range.start.row, trace.range.start.column);
      return true;
    }
    return false;
  }

  dispose(): void {
    this._subscriptions.dispose();
  }
}

function observeLinterPackageEnabled(): Observable<boolean> {
  return Observable.merge(
    Observable.of(atom.packages.isPackageActive(LINTER_PACKAGE)),
    observableFromSubscribeFunction(atom.packages.onDidActivatePackage.bind(atom.packages))
      .filter(pkg => pkg.name === LINTER_PACKAGE)
      .mapTo(true),
    observableFromSubscribeFunction(atom.packages.onDidDeactivatePackage.bind(atom.packages))
      .filter(pkg => pkg.name === LINTER_PACKAGE)
      .mapTo(false),
  );
}

module.exports = createPackage(Activation);
