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
  DebuggerConfigAction,
  DebuggerLaunchAttachProvider,
  NuclideDebuggerProvider,
  DebuggerConfigurationProvider,
} from 'nuclide-debugger-common';
import type {
  ConsoleService,
  DatatipProvider,
  DatatipService,
  RegisterExecutorFunction,
  TerminalApi,
} from 'atom-ide-ui';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {SerializedState, IBreakpoint} from './types';

import idx from 'idx';
import {observeRemovedHostnames} from 'nuclide-commons-atom/projects';
import BreakpointManager from './BreakpointManager';
import {AnalyticsEvents, DebuggerMode} from './constants';
import BreakpointConfigComponent from './ui/BreakpointConfigComponent';
import createPackage from 'nuclide-commons-atom/createPackage';
import {getLineForEvent} from './utils';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import invariant from 'assert';
import {track} from 'nuclide-commons/analytics';
import RemoteControlService from './RemoteControlService';
import DebuggerUiModel from './DebuggerUiModel';
import DebugService from './vsp/DebugService';
import {debuggerDatatip} from './DebuggerDatatip';
import * as React from 'react';
import ReactDOM from 'react-dom';
import DebuggerLaunchAttachUI from './ui/DebuggerLaunchAttachUI';
import {renderReactRoot} from 'nuclide-commons-ui/renderReactRoot';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {
  setNotificationService,
  setConsoleService,
  setConsoleRegisterExecutor,
  setDatatipService,
  setTerminalService,
  setRpcService,
  addDebugConfigurationProvider,
} from './AtomServiceContainer';
import {wordAtPosition, trimRange} from 'nuclide-commons-atom/range';
import DebuggerLayoutManager from './ui/DebuggerLayoutManager';
import DebuggerPaneViewModel from './ui/DebuggerPaneViewModel';
import DebuggerPaneContainerViewModel from './ui/DebuggerPaneContainerViewModel';
import os from 'os';
import nullthrows from 'nullthrows';
import ReactMountRootElement from 'nuclide-commons-ui/ReactMountRootElement';
import {sortMenuGroups} from 'nuclide-commons/menuUtils';
import passesGK from 'nuclide-commons/passesGK';

const DATATIP_PACKAGE_NAME = 'debugger-datatip';

type LaunchAttachDialogArgs = {
  dialogMode: DebuggerConfigAction,
  selectedTabName?: string,
  config?: {[string]: mixed},
};

class Activation {
  _disposables: UniversalDisposable;
  _uiModel: DebuggerUiModel;
  _breakpointManager: BreakpointManager;
  _service: DebugService;
  _layoutManager: DebuggerLayoutManager;
  _selectedDebugConnection: ?string;
  _visibleLaunchAttachDialogMode: ?DebuggerConfigAction;
  _lauchAttachDialogCloser: ?() => void;
  _connectionProviders: Map<string, Array<DebuggerLaunchAttachProvider>>;

  constructor(state: ?SerializedState) {
    atom.views.addViewProvider(DebuggerPaneViewModel, createDebuggerView);
    atom.views.addViewProvider(
      DebuggerPaneContainerViewModel,
      createDebuggerView,
    );
    this._service = new DebugService(state);
    this._uiModel = new DebuggerUiModel(this._service);
    this._breakpointManager = new BreakpointManager(this._service);
    this._selectedDebugConnection = null;
    this._visibleLaunchAttachDialogMode = null;
    this._lauchAttachDialogCloser = null;
    this._connectionProviders = new Map();
    this._layoutManager = new DebuggerLayoutManager(this._service, state);

    // Manually manipulate the `Debugger` top level menu order.
    const insertIndex = atom.menu.template.findIndex(
      item => item.role === 'window' || item.role === 'help',
    );
    if (insertIndex !== -1) {
      const deuggerIndex = atom.menu.template.findIndex(
        item => item.label === 'Debugger',
      );
      const menuItem = atom.menu.template.splice(deuggerIndex, 1)[0];
      const newIndex =
        insertIndex > deuggerIndex ? insertIndex - 1 : insertIndex;
      atom.menu.template.splice(newIndex, 0, menuItem);
      atom.menu.update();
    }

    const removedHostnames = observeRemovedHostnames();

    this._disposables = new UniversalDisposable(
      this._layoutManager,
      this._service,
      this._uiModel,
      this._breakpointManager,
      removedHostnames.subscribe(hostname => {
        this._service
          .getModel()
          .getProcesses()
          .forEach(debuggerProcess => {
            const debuggeeTargetUri = debuggerProcess.configuration.targetUri;
            if (nuclideUri.isLocal(debuggeeTargetUri)) {
              return; // Nothing to do if our debug session is local.
            }
            if (nuclideUri.getHostname(debuggeeTargetUri) === hostname) {
              this._service.stopProcess(debuggerProcess);
            }
          });
      }),
      this._uiModel.onConnectionsUpdated(() => {
        const newConnections = this._uiModel.getConnections();
        const keys = Array.from(this._connectionProviders.keys());

        const removedConnections = keys.filter(
          connection =>
            newConnections.find(item => item === connection) == null,
        );
        const addedConnections = newConnections.filter(
          connection => keys.find(item => item === connection) == null,
        );

        for (const key of removedConnections) {
          this._connectionProviders.delete(key);
        }

        for (const connection of addedConnections) {
          this._setProvidersForConnection(connection);
        }
      }),
      this._uiModel.onProvidersUpdated(() => {
        const connections = this._uiModel.getConnections();
        for (const connection of connections) {
          this._setProvidersForConnection(connection);
        }
      }),
      // Commands.
      atom.commands.add('atom-workspace', {
        'debugger:show-attach-dialog': event => {
          const selectedTabName: any = idx(
            event,
            _ => _.detail.selectedTabName,
          );
          const config: any = idx(event, _ => _.detail.config);
          this._showLaunchAttachDialog({
            dialogMode: 'attach',
            selectedTabName,
            config,
          });
        },
      }),
      atom.commands.add('atom-workspace', {
        'debugger:show-launch-dialog': event => {
          const selectedTabName: any = event?.detail?.selectedTabName;
          const config: any = event?.detail?.config;
          this._showLaunchAttachDialog({
            dialogMode: 'launch',
            selectedTabName,
            config,
          });
        },
      }),
      atom.commands.add('atom-workspace', {
        'debugger:continue-debugging': this._continue.bind(this),
      }),
      atom.commands.add('atom-workspace', {
        'debugger:stop-debugging': this._stop.bind(this),
      }),
      atom.commands.add('atom-workspace', {
        'debugger:restart-debugging': this._restart.bind(this),
      }),
      atom.commands.add('atom-workspace', {
        'debugger:step-over': this._stepOver.bind(this),
      }),
      atom.commands.add('atom-workspace', {
        'debugger:step-into': this._stepInto.bind(this),
      }),
      atom.commands.add('atom-workspace', {
        'debugger:step-out': this._stepOut.bind(this),
      }),
      atom.commands.add('atom-workspace', {
        // eslint-disable-next-line nuclide-internal/atom-apis
        'debugger:add-breakpoint': this._addBreakpoint.bind(this),
      }),
      atom.commands.add('atom-workspace', {
        'debugger:toggle-breakpoint': this._toggleBreakpoint.bind(this),
      }),
      atom.commands.add('atom-workspace', {
        'debugger:toggle-breakpoint-enabled': this._toggleBreakpointEnabled.bind(
          this,
        ),
      }),
      atom.commands.add('atom-workspace', {
        // eslint-disable-next-line nuclide-internal/atom-apis
        'debugger:edit-breakpoint': this._configureBreakpoint.bind(this),
      }),
      atom.commands.add('.debugger-thread-list-item', {
        'debugger:terminate-thread': this._terminateThread.bind(this),
      }),
      atom.commands.add('atom-workspace', {
        'debugger:remove-all-breakpoints': this._deleteAllBreakpoints.bind(
          this,
        ),
      }),
      atom.commands.add('atom-workspace', {
        'debugger:enable-all-breakpoints': this._enableAllBreakpoints.bind(
          this,
        ),
      }),
      atom.commands.add('atom-workspace', {
        'debugger:disable-all-breakpoints': this._disableAllBreakpoints.bind(
          this,
        ),
      }),
      atom.commands.add('atom-workspace', {
        'debugger:remove-breakpoint': this._deleteBreakpoint.bind(this),
      }),
      atom.commands.add('atom-workspace', {
        // eslint-disable-next-line nuclide-internal/atom-apis
        'debugger:add-to-watch': this._addToWatch.bind(this),
      }),
      atom.commands.add('atom-workspace', {
        'debugger:run-to-location': this._runToLocation.bind(this),
      }),
      atom.commands.add('.debugger-expression-value-list', {
        'debugger:copy-debugger-expression-value': this._copyDebuggerExpressionValue.bind(
          this,
        ),
      }),
      atom.commands.add('atom-workspace', {
        'debugger:copy-debugger-callstack': this._copyDebuggerCallstack.bind(
          this,
        ),
      }),
      // Context Menu Items.
      atom.contextMenu.add({
        '.debugger-breakpoint-list': [
          {
            label: 'Enable All Breakpoints',
            command: 'debugger:enable-all-breakpoints',
          },
          {
            label: 'Disable All Breakpoints',
            command: 'debugger:disable-all-breakpoints',
          },
          {
            label: 'Remove All Breakpoints',
            command: 'debugger:remove-all-breakpoints',
          },
          {type: 'separator'},
        ],
        '.debugger-breakpoint': [
          {
            label: 'Edit breakpoint...',
            command: 'debugger:edit-breakpoint',
            shouldDisplay: event => {
              const bp = this._getBreakpointFromEvent(event);
              return bp != null && this._supportsConditionalBreakpoints();
            },
          },
          {
            label: 'Remove Breakpoint',
            command: 'debugger:remove-breakpoint',
          },
          {type: 'separator'},
        ],
        '.debugger-thread-list-item': [
          {
            label: 'Terminate thread',
            command: 'debugger:terminate-thread',
            shouldDisplay: event => {
              const target: HTMLElement = event.target;
              if (target.dataset.threadid) {
                const threadId = parseInt(target.dataset.threadid, 10);
                if (!Number.isNaN(threadId)) {
                  return (
                    this._supportsTerminateThreadsRequest() &&
                    !this._isReadOnlyTarget()
                  );
                }
              }
              return false;
            },
          },
        ],
        '.debugger-callstack-table': [
          {
            label: 'Copy Callstack',
            command: 'debugger:copy-debugger-callstack',
          },
        ],
        '.debugger-expression-value-list': [
          {
            label: 'Copy',
            command: 'debugger:copy-debugger-expression-value',
          },
        ],
        'atom-text-editor': [
          {type: 'separator'},
          {
            label: 'Debugger',
            submenu: [
              {
                label: 'Toggle Breakpoint',
                command: 'debugger:toggle-breakpoint',
              },
              {
                label: 'Toggle Breakpoint enabled/disabled',
                command: 'debugger:toggle-breakpoint-enabled',
                shouldDisplay: event =>
                  this._executeWithEditorPath(
                    event,
                    (filePath, line) =>
                      this._service
                        .getModel()
                        .getBreakpointAtLine(filePath, line) != null,
                  ) || false,
              },
              {
                label: 'Edit Breakpoint...',
                command: 'debugger:edit-breakpoint',
                shouldDisplay: event =>
                  this._executeWithEditorPath(event, (filePath, line) => {
                    const bp = this._service
                      .getModel()
                      .getBreakpointAtLine(filePath, line);
                    return bp != null && this._supportsConditionalBreakpoints();
                  }) || false,
              },
              {
                label: 'Add to Watch',
                command: 'debugger:add-to-watch',
                shouldDisplay: event => {
                  const textEditor = atom.workspace.getActiveTextEditor();
                  if (
                    this._service.getDebuggerMode() === DebuggerMode.STOPPED ||
                    textEditor == null
                  ) {
                    return false;
                  }
                  return (
                    textEditor.getSelections().length === 1 &&
                    !textEditor.getSelectedBufferRange().isEmpty()
                  );
                },
              },
              {
                label: 'Run to Location',
                command: 'debugger:run-to-location',
                shouldDisplay: event =>
                  this._service.getDebuggerMode() === DebuggerMode.PAUSED &&
                  !this._isReadOnlyTarget(),
              },
            ],
          },
          {type: 'separator'},
        ],
      }),
      this._registerCommandsContextMenuAndOpener(),
    );

    sortMenuGroups(['Debugger']);
  }

  _supportsConditionalBreakpoints(): boolean {
    // If currently debugging, return whether or not the current debugger supports this.
    const {focusedProcess} = this._service.viewModel;
    if (focusedProcess == null) {
      // If not currently debugging, return if any of the debuggers that support
      // the file extension this bp is in support conditions.
      // TODO(ericblue): have providers register their file extensions and filter correctly here.
      return true;
    } else {
      return Boolean(
        focusedProcess.session.capabilities.supportsConditionalBreakpoints,
      );
    }
  }

  _supportsTerminateThreadsRequest(): boolean {
    // If currently debugging, return whether or not the current debugger supports this.
    const {focusedProcess} = this._service.viewModel;
    if (focusedProcess == null) {
      return false;
    } else {
      return Boolean(
        focusedProcess.session.capabilities.supportsTerminateThreadsRequest,
      );
    }
  }

  _setProvidersForConnection(connection: NuclideUri): void {
    const key = nuclideUri.isRemote(connection)
      ? nuclideUri.getHostname(connection)
      : 'local';
    const availableProviders = this._uiModel.getLaunchAttachProvidersForConnection(
      connection,
    );
    this._connectionProviders.set(key, availableProviders);
  }

  async _getSuggestions(
    request: atom$AutocompleteRequest,
  ): Promise<?Array<atom$AutocompleteSuggestion>> {
    let text = request.editor.getText();
    const lines = text.split('\n');
    const {row} = request.bufferPosition;
    // Only keep the lines up to and including the buffer position row.
    text = lines.slice(0, row + 1).join('\n');
    const {focusedStackFrame, focusedProcess} = this._service.viewModel;
    if (
      focusedProcess == null ||
      focusedStackFrame == null ||
      !Boolean(focusedProcess.session.capabilities.supportsCompletionsRequest)
    ) {
      return [];
    } else {
      const completions = await focusedProcess.completions(
        focusedStackFrame.frameId,
        text,
        request.bufferPosition,
        0,
      );
      return completions.map(item => ({
        displayText: item.label,
        text: item.text == null ? item.label : item.text,
        type: item.type,
      }));
    }
  }

  serialize(): SerializedState {
    const model = this._service.getModel();
    const state = {
      sourceBreakpoints: model.getBreakpoints(),
      functionBreakpoints: model.getFunctionBreakpoints(),
      exceptionBreakpoints: model.getExceptionBreakpoints(),
      watchExpressions: model.getWatchExpressions().map(e => e.name),
      showDebugger: this._layoutManager.isDebuggerVisible(),
      workspaceDocksVisibility: this._layoutManager.getWorkspaceDocksVisibility(),
    };
    return state;
  }

  dispose() {
    this._disposables.dispose();
  }

  _registerCommandsContextMenuAndOpener(): UniversalDisposable {
    const disposable = new UniversalDisposable(
      atom.workspace.addOpener(uri => {
        return this._layoutManager.getModelForDebuggerUri(uri);
      }),
      () => {
        this._layoutManager.hideDebuggerViews(false);
      },
      atom.commands.add('atom-workspace', {
        'debugger:show': event => {
          const detail = event.detail;
          const show =
            detail == null ||
            Boolean(detail.showOnlyIfHidden) === false ||
            !this._layoutManager.isDebuggerVisible();
          if (show) {
            this._layoutManager.showDebuggerViews();
          }
        },
      }),
      atom.commands.add('atom-workspace', {
        'debugger:hide': () => {
          this._layoutManager.hideDebuggerViews(false);
          for (const process of this._service.getModel().getProcesses()) {
            this._service.stopProcess(process);
          }
        },
      }),
      atom.commands.add('atom-workspace', 'debugger:toggle', () => {
        if (this._layoutManager.isDebuggerVisible() === true) {
          atom.commands.dispatch(
            atom.views.getView(atom.workspace),
            'debugger:hide',
          );
        } else {
          atom.commands.dispatch(
            atom.views.getView(atom.workspace),
            'debugger:show',
          );
        }
      }),
      this._service.onDidChangeProcessMode(() =>
        this._layoutManager.debuggerModeChanged(),
      ),
      this._service.viewModel.onDidChangeDebuggerFocus(() =>
        this._layoutManager.debuggerModeChanged(),
      ),
      atom.commands.add('atom-workspace', {
        'debugger:reset-layout': () => {
          this._layoutManager.resetLayout();
        },
      }),
      atom.contextMenu.add({
        '.debugger-container': [
          {
            label: 'Debugger Views',
            submenu: [
              {
                label: 'Reset Layout',
                command: 'debugger:reset-layout',
              },
            ],
          },
        ],
      }),
    );
    return disposable;
  }

  _isReadOnlyTarget(): boolean {
    const {focusedProcess} = this._service.viewModel;
    return (
      focusedProcess != null && Boolean(focusedProcess.configuration.isReadOnly)
    );
  }

  _continue() {
    if (this._isReadOnlyTarget()) {
      return;
    }
    const {focusedThread} = this._service.viewModel;
    if (focusedThread != null) {
      track(AnalyticsEvents.DEBUGGER_STEP_CONTINUE);
      focusedThread.continue();
    }
  }

  _stop() {
    const {focusedProcess} = this._service.viewModel;
    if (focusedProcess) {
      this._service.stopProcess(focusedProcess);
    }
  }

  _restart() {
    if (this._isReadOnlyTarget()) {
      return;
    }
    const {focusedProcess} = this._service.viewModel;
    if (focusedProcess) {
      this._service.restartProcess(focusedProcess);
    }
  }

  _stepOver() {
    if (this._isReadOnlyTarget()) {
      return;
    }
    const {focusedThread} = this._service.viewModel;
    if (focusedThread != null) {
      track(AnalyticsEvents.DEBUGGER_STEP_OVER);
      focusedThread.next();
    }
  }

  _stepInto() {
    if (this._isReadOnlyTarget()) {
      return;
    }
    const {focusedThread} = this._service.viewModel;
    if (focusedThread != null) {
      track(AnalyticsEvents.DEBUGGER_STEP_INTO);
      focusedThread.stepIn();
    }
  }

  _stepOut() {
    if (this._isReadOnlyTarget()) {
      return;
    }
    const {focusedThread} = this._service.viewModel;
    if (focusedThread != null) {
      track(AnalyticsEvents.DEBUGGER_STEP_OUT);
      focusedThread.stepOut();
    }
  }

  _addBreakpoint(event: any) {
    return this._executeWithEditorPath(event, (filePath, lineNumber) => {
      this._service.addSourceBreakpoint(filePath, lineNumber);
    });
  }

  _toggleBreakpoint(event: any) {
    return this._executeWithEditorPath(event, (filePath, lineNumber) => {
      this._service.toggleSourceBreakpoint(filePath, lineNumber);
    });
  }

  _toggleBreakpointEnabled(event: any) {
    this._executeWithEditorPath(event, (filePath, line) => {
      const bp = this._service.getModel().getBreakpointAtLine(filePath, line);

      if (bp != null) {
        this._service.enableOrDisableBreakpoints(!bp.enabled, bp);
      }
    });
  }

  _getBreakpointFromEvent(event: any): ?IBreakpoint {
    const target: HTMLElement = event.target;
    let bp = null;
    if (target != null && target.dataset != null) {
      if (target.dataset.bpId != null) {
        const bpId = target.dataset.bpId;
        bp = this._service.getModel().getBreakpointById(bpId);
      }

      if (bp == null) {
        const path = target.dataset.path;
        const line = parseInt(target.dataset.line, 10);
        if (path != null && line != null) {
          bp = this._service.getModel().getBreakpointAtLine(path, line);
        }
      }
    }

    return bp;
  }

  _configureBreakpoint(event: any) {
    const bp = this._getBreakpointFromEvent(event);
    if (bp != null && this._supportsConditionalBreakpoints()) {
      // Open the configuration dialog.
      const container = new ReactMountRootElement();
      ReactDOM.render(
        <BreakpointConfigComponent
          breakpoint={bp}
          service={this._service}
          onDismiss={() => {
            ReactDOM.unmountComponentAtNode(container);
          }}
          allowLogMessage={passesGK('nuclide_debugger_logging_breakpoints')}
        />,
        container,
      );
    }
  }

  _terminateThread(event: any) {
    if (this._isReadOnlyTarget()) {
      return;
    }
    const target: HTMLElement = event.target;
    if (target.dataset.threadid) {
      const threadId = parseInt(target.dataset.threadid, 10);
      if (!Number.isNaN(threadId) && this._supportsTerminateThreadsRequest()) {
        this._service.terminateThreads([threadId]);
      }
    }
  }

  _executeWithEditorPath<T>(
    event: any,
    fn: (filePath: string, line: number) => T,
  ): ?T {
    const editor = atom.workspace.getActiveTextEditor();
    if (!editor || !editor.getPath()) {
      return null;
    }

    const line = getLineForEvent(editor, event) + 1;
    return fn(nullthrows(editor.getPath()), line);
  }

  _deleteBreakpoint(event: any): void {
    const breakpoint = this._getBreakpointFromEvent(event);
    if (breakpoint != null) {
      this._service.removeBreakpoints(breakpoint.getId());
    }
  }

  _deleteAllBreakpoints(): void {
    this._service.removeBreakpoints();
  }

  _enableAllBreakpoints(): void {
    this._service.enableOrDisableBreakpoints(true);
  }

  _disableAllBreakpoints(): void {
    this._service.enableOrDisableBreakpoints(false);
  }

  _renderConfigDialog(
    panel: atom$Panel,
    args: LaunchAttachDialogArgs,
    dialogCloser: () => void,
  ): void {
    if (this._selectedDebugConnection == null) {
      // If no connection is selected yet, default to the local connection.
      this._selectedDebugConnection = 'local';
    }

    invariant(this._selectedDebugConnection != null);

    const options = this._uiModel
      .getConnections()
      .map(connection => {
        const displayName = nuclideUri.isRemote(connection)
          ? nuclideUri.getHostname(connection)
          : 'localhost';
        return {
          value: connection,
          label: displayName,
        };
      })
      .filter(item => item.value != null && item.value !== '')
      .sort((a, b) => a.label.localeCompare(b.label));

    // flowlint-next-line sketchy-null-string:off
    const connection = this._selectedDebugConnection || 'local';

    ReactDOM.render(
      <DebuggerLaunchAttachUI
        dialogMode={args.dialogMode}
        initialSelectedTabName={args.selectedTabName}
        initialProviderConfig={args.config}
        connectionChanged={(newValue: ?string) => {
          this._selectedDebugConnection = newValue;
          this._renderConfigDialog(
            panel,
            {dialogMode: args.dialogMode},
            dialogCloser,
          );
        }}
        connection={connection}
        connectionOptions={options}
        dialogCloser={dialogCloser}
        providers={this._connectionProviders}
      />,
      panel.getItem(),
    );
  }

  _showLaunchAttachDialog(args: LaunchAttachDialogArgs): void {
    const {dialogMode} = args;
    if (
      this._visibleLaunchAttachDialogMode != null &&
      this._visibleLaunchAttachDialogMode !== dialogMode
    ) {
      // If the dialog is already visible, but isn't the correct mode, close it before
      // re-opening the correct mode.
      invariant(this._lauchAttachDialogCloser != null);
      this._lauchAttachDialogCloser();
    }

    const disposables = new UniversalDisposable();
    const hostEl = document.createElement('div');
    const pane = atom.workspace.addModalPanel({
      item: hostEl,
      className: 'debugger-config-dialog',
    });

    const parentEl: HTMLElement = (hostEl.parentElement: any);
    parentEl.style.maxWidth = '100em';

    // Function callback that closes the dialog and frees all of its resources.
    this._renderConfigDialog(pane, args, () => disposables.dispose());
    this._lauchAttachDialogCloser = () => disposables.dispose();
    disposables.add(
      pane.onDidChangeVisible(visible => {
        if (!visible) {
          disposables.dispose();
        }
      }),
    );
    disposables.add(() => {
      this._disposables.remove(disposables);
      this._visibleLaunchAttachDialogMode = null;
      this._lauchAttachDialogCloser = null;
      track(AnalyticsEvents.DEBUGGER_TOGGLE_ATTACH_DIALOG, {
        visible: false,
        dialogMode,
      });
      ReactDOM.unmountComponentAtNode(hostEl);
      pane.destroy();
    });

    track(AnalyticsEvents.DEBUGGER_TOGGLE_ATTACH_DIALOG, {
      visible: true,
      dialogMode,
    });
    this._visibleLaunchAttachDialogMode = dialogMode;
    this._disposables.add(disposables);
  }

  _addToWatch() {
    const editor = atom.workspace.getActiveTextEditor();
    if (!editor) {
      return;
    }
    const selectedText = editor.getTextInBufferRange(
      trimRange(editor, editor.getSelectedBufferRange()),
    );
    const expr = wordAtPosition(editor, editor.getCursorBufferPosition());

    const watchExpression = selectedText || (expr && expr.wordMatch[0]);
    if (watchExpression != null && watchExpression.length > 0) {
      this._service.addWatchExpression(watchExpression);
    }
  }

  _runToLocation(event) {
    if (this._isReadOnlyTarget()) {
      return;
    }
    this._executeWithEditorPath(event, (path, line) => {
      this._service.runToLocation(path, line);
    });
  }

  _copyDebuggerExpressionValue(event: Event) {
    const selection = window.getSelection();
    const clickedElement: HTMLElement = (event.target: any);
    const targetClass = '.nuclide-ui-expression-tree-value';
    const copyElement = clickedElement.closest(targetClass);

    if (copyElement != null) {
      // If the user has text in the target node selected, copy only the selection
      // instead of the entire node value.
      if (
        selection != null &&
        selection.toString() !== '' &&
        (copyElement.contains(selection?.anchorNode?.parentElement) ||
          copyElement === selection?.anchorNode?.parentElement)
      ) {
        atom.clipboard.write(selection.toString());
      } else {
        atom.clipboard.write(copyElement.textContent);
      }
    }
  }

  _copyDebuggerCallstack(event: Event) {
    const {focusedThread} = this._service.viewModel;
    if (focusedThread != null) {
      let callstackText = '';
      // eslint-disable-next-line nuclide-internal/unused-subscription
      focusedThread
        .getFullCallStack()
        .filter(expectedStack => !expectedStack.isPending)
        .take(1)
        .subscribe(expectedStack => {
          expectedStack.getOrDefault([]).forEach((item, i) => {
            const path = nuclideUri.basename(item.source.uri);
            callstackText += `${i}\t${item.name}\t${path}:${
              item.range.start.row
            }${os.EOL}`;
          });
          atom.clipboard.write(callstackText.trim());
        });
    }
  }

  consumeCurrentWorkingDirectory(cwdApi: nuclide$CwdApi): IDisposable {
    const updateSelectedConnection = directory => {
      this._selectedDebugConnection = directory;
      if (this._selectedDebugConnection != null) {
        const conn = this._selectedDebugConnection;
        if (nuclideUri.isRemote(conn)) {
          // Use root instead of current directory as launch point for debugger.
          this._selectedDebugConnection = nuclideUri.createRemoteUri(
            nuclideUri.getHostname(conn),
            '/',
          );
        } else {
          // Use null instead of local path to use local debugger downstream.
          this._selectedDebugConnection = null;
        }
      }
    };
    const disposable = cwdApi.observeCwd(updateSelectedConnection);
    this._disposables.add(disposable);
    return new UniversalDisposable(() => {
      disposable.dispose();
      this._disposables.remove(disposable);
    });
  }

  createAutocompleteProvider(): atom$AutocompleteProvider {
    return {
      labels: ['nuclide-console'],
      selector: '*',
      filterSuggestions: true,
      getSuggestions: this._getSuggestions.bind(this),
    };
  }

  consumeConsole(createConsole: ConsoleService): IDisposable {
    return setConsoleService(createConsole);
  }

  consumeTerminal(terminalApi: TerminalApi): IDisposable {
    return setTerminalService(terminalApi);
  }

  consumeRpcService(rpcService: nuclide$RpcService): IDisposable {
    return setRpcService(rpcService);
  }

  consumeRegisterExecutor(
    registerExecutor: RegisterExecutorFunction,
  ): IDisposable {
    return setConsoleRegisterExecutor(registerExecutor);
  }

  consumeDebuggerProvider(provider: NuclideDebuggerProvider): IDisposable {
    this._uiModel.addDebuggerProvider(provider);
    return new UniversalDisposable(() => {
      this._uiModel.removeDebuggerProvider(provider);
    });
  }

  consumeDebuggerConfigurationProviders(
    providers: Array<DebuggerConfigurationProvider>,
  ): IDisposable {
    invariant(Array.isArray(providers));
    const disposable = new UniversalDisposable();
    providers.forEach(provider =>
      disposable.add(addDebugConfigurationProvider(provider)),
    );
    return disposable;
  }

  consumeToolBar(getToolBar: toolbar$GetToolbar): IDisposable {
    const toolBar = getToolBar('debugger');
    toolBar.addButton({
      iconset: 'icon-nuclicon',
      icon: 'debugger',
      callback: 'debugger:show-attach-dialog',
      tooltip: 'Attach Debugger',
      priority: 500,
    }).element;
    const disposable = new UniversalDisposable(() => {
      toolBar.removeItems();
    });
    this._disposables.add(disposable);
    return disposable;
  }

  consumeNotifications(
    raiseNativeNotification: (
      title: string,
      body: string,
      timeout: number,
      raiseIfAtomHasFocus: boolean,
    ) => ?IDisposable,
  ): void {
    setNotificationService(raiseNativeNotification);
  }

  provideRemoteControlService(): RemoteControlService {
    return new RemoteControlService(this._service);
  }

  consumeDatatipService(service: DatatipService): IDisposable {
    const disposable = new UniversalDisposable(
      service.addProvider(this._createDatatipProvider()),
      setDatatipService(service),
    );
    this._disposables.add(disposable);
    return disposable;
  }

  _createDatatipProvider(): DatatipProvider {
    return {
      // Eligibility is determined online, based on registered EvaluationExpression providers.
      providerName: DATATIP_PACKAGE_NAME,
      priority: 1,
      datatip: (editor: TextEditor, position: atom$Point) => {
        return debuggerDatatip(this._service, editor, position);
      },
    };
  }
}

function createDebuggerView(model: mixed): ?HTMLElement {
  let view = null;
  if (
    model instanceof DebuggerPaneViewModel ||
    model instanceof DebuggerPaneContainerViewModel
  ) {
    view = model.createView();
  }

  if (view != null) {
    const elem = renderReactRoot(view);
    elem.className = 'debugger-container';
    return elem;
  }

  return null;
}

createPackage(module.exports, Activation);
