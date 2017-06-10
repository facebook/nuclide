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

import type {
  NuclideDebuggerProvider,
  NuclideEvaluationExpressionProvider,
} from '../../nuclide-debugger-interfaces/service';
import type {
  DatatipProvider,
  DatatipService,
} from '../../nuclide-datatip/lib/types';
import type {
  RegisterExecutorFunction,
  OutputService,
} from '../../nuclide-console/lib/types';
import type {
  WorkspaceViewsService,
} from '../../nuclide-workspace-views/lib/types';
import type {EvaluationResult, SerializedBreakpoint} from './types';
import type {WatchExpressionStore} from './WatchExpressionStore';
import type {NuxTourModel} from '../../nuclide-nux/lib/NuxModel';
import type {RegisterNux, TriggerNux} from '../../nuclide-nux/lib/main';
import type {CwdApi} from '../../nuclide-current-working-directory/lib/CwdApi';
import type {
  DebuggerLaunchAttachProvider,
  DebuggerConfigAction,
} from '../../nuclide-debugger-base';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {DebuggerProviderStore} from './DebuggerProviderStore';

import {AnalyticsEvents} from './constants';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {Subject, Observable} from 'rxjs';
import invariant from 'assert';
import classnames from 'classnames';
import {Disposable} from 'atom';
import {track} from '../../nuclide-analytics';
import RemoteControlService from './RemoteControlService';
import DebuggerModel from './DebuggerModel';
import {debuggerDatatip} from './DebuggerDatatip';
import React from 'react';
import ReactDOM from 'react-dom';
import {DebuggerLaunchAttachUI} from './DebuggerLaunchAttachUI';
import {
  DebuggerLaunchAttachConnectionChooser,
} from './DebuggerLaunchAttachConnectionChooser';
import {renderReactRoot} from 'nuclide-commons-ui/renderReactRoot';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {ServerConnection} from '../../nuclide-remote-connection';
import {
  setNotificationService,
  setOutputService,
} from '../../nuclide-debugger-base';
import {DebuggerMode} from './DebuggerStore';
import {NewDebuggerView} from './NewDebuggerView';
import DebuggerControllerView from './DebuggerControllerView';
import {wordAtPosition, trimRange} from 'nuclide-commons-atom/range';
import {DebuggerLayoutManager} from './DebuggerLayoutManager';
import {DebuggerPaneViewModel} from './DebuggerPaneViewModel';
import os from 'os';
import nullthrows from 'nullthrows';

export type SerializedState = {
  breakpoints: ?Array<SerializedBreakpoint>,
};

const DATATIP_PACKAGE_NAME = 'nuclide-debugger-datatip';
const NUX_NEW_DEBUGGER_UI_ID = 4377;
const GK_NEW_DEBUGGER_UI_NUX = 'mp_nuclide_new_debugger_ui';
const NUX_NEW_DEBUGGER_UI_NAME = 'nuclide_new_debugger_ui';
const SCREEN_ROW_ATTRIBUTE_NAME = 'data-screen-row';

function getGutterLineNumber(target: HTMLElement): ?number {
  const eventLine = parseInt(target.dataset.line, 10);
  if (eventLine != null && eventLine >= 0 && !isNaN(Number(eventLine))) {
    return eventLine;
  }
}

function getEditorLineNumber(
  editor: atom$TextEditor,
  target: HTMLElement,
): ?number {
  let node = target;
  while (node != null) {
    if (node.hasAttribute(SCREEN_ROW_ATTRIBUTE_NAME)) {
      const screenRow = Number(node.getAttribute(SCREEN_ROW_ATTRIBUTE_NAME));
      try {
        return editor.bufferPositionForScreenPosition([screenRow, 0]).row;
      } catch (error) {
        return null;
      }
    }
    node = node.parentElement;
  }
}

function firstNonNull(...args) {
  return nullthrows(args.find(arg => arg != null));
}

function getLineForEvent(editor: atom$TextEditor, event: any): number {
  const cursorLine = editor.getLastCursor().getBufferRow();
  const target = event ? (event.target: HTMLElement) : null;
  if (target == null) {
    return cursorLine;
  }
  // toggleLine is the line the user clicked in the gutter next to, as opposed
  // to the line the editor's cursor happens to be in. If this command was invoked
  // from the menu, then the cursor position is the target line.
  return firstNonNull(
    getGutterLineNumber(target),
    getEditorLineNumber(editor, target),
    // fall back to the line the cursor is on.
    cursorLine,
  );
}

type Props = {
  model: DebuggerModel,
};
type State = {
  showOldView: boolean,
};

class DebuggerView extends React.Component {
  props: Props;
  state: State;
  _nuxTimeout: ?number;

  constructor(props: Props) {
    super(props);
    this.state = {
      showOldView: false,
      debuggerConnection: '',
    };
    (this: any)._openDevTools = this._openDevTools.bind(this);
    (this: any)._stopDebugging = this._stopDebugging.bind(this);
  }

  _getUiTypeForAnalytics(): string {
    return this.state.showOldView ? 'chrome-devtools' : 'nuclide';
  }

  componentDidMount(): void {
    track(AnalyticsEvents.DEBUGGER_UI_MOUNTED, {
      frontend: this._getUiTypeForAnalytics(),
    });
    // Wait for UI to initialize and "calm down"
    this._nuxTimeout = setTimeout(() => {
      if (activation != null && !this.state.showOldView) {
        activation.tryTriggerNux(NUX_NEW_DEBUGGER_UI_ID);
      }
    }, 2000);
  }

  componentDidUpdate(prevProps: Props, prevState: State): void {
    if (prevState.showOldView !== this.state.showOldView) {
      track(AnalyticsEvents.DEBUGGER_UI_TOGGLED, {
        frontend: this._getUiTypeForAnalytics(),
      });
    }
  }

  componentWillUnmount(): void {
    if (this._nuxTimeout) {
      clearTimeout(this._nuxTimeout);
    }
  }

  _openDevTools(): void {
    this.props.model.getActions().openDevTools();
  }

  _stopDebugging(): void {
    this.props.model.getActions().stopDebugging();
  }

  render(): React.Element<any> {
    const {model} = this.props;
    const {showOldView} = this.state;
    return (
      <div className="nuclide-debugger-root">
        <div
          className={classnames({
            'nuclide-debugger-container-old-enabled': showOldView,
          })}>
          <DebuggerControllerView
            store={model.getStore()}
            bridge={model.getBridge()}
            breakpointStore={model.getBreakpointStore()}
            openDevTools={this._openDevTools}
            stopDebugging={this._stopDebugging}
          />
        </div>
        {!showOldView
          ? <NewDebuggerView
              model={model}
              watchExpressionListStore={model.getWatchExpressionListStore()}
            />
          : null}
      </div>
    );
  }
}

export function createDebuggerView(model: mixed): ?HTMLElement {
  let view = null;
  if (model instanceof DebuggerModel) {
    view = <DebuggerView model={model} />;
  } else if (model instanceof DebuggerPaneViewModel) {
    view = model.createView();
  }

  if (view != null) {
    const elem = renderReactRoot(view);
    elem.className = 'nuclide-debugger-container';
    return elem;
  }

  return null;
}

class Activation {
  _disposables: UniversalDisposable;
  _model: DebuggerModel;
  _tryTriggerNux: ?TriggerNux;
  _layoutManager: DebuggerLayoutManager;
  _selectedDebugConnection: ?string;
  _visibleLaunchAttachDialogMode: ?DebuggerConfigAction;
  _lauchAttachDialogCloser: ?() => void;
  _connectionProviders: Map<string, Array<DebuggerLaunchAttachProvider>>;

  constructor(state: ?SerializedState) {
    this._model = new DebuggerModel(state);
    this._selectedDebugConnection = null;
    this._visibleLaunchAttachDialogMode = null;
    this._lauchAttachDialogCloser = null;
    this._connectionProviders = new Map();
    this._layoutManager = new DebuggerLayoutManager(this._model);
    this._disposables = new UniversalDisposable(
      this._model,
      this._layoutManager,
      // Listen for removed connections and kill the debugger if it is using that connection.
      ServerConnection.onDidCloseServerConnection(connection => {
        const debuggerProcess = this._model.getStore().getDebuggerInstance();
        if (debuggerProcess == null) {
          return; // Nothing to do if we're not debugging.
        }
        const debuggeeTargetUri = debuggerProcess.getTargetUri();
        if (nuclideUri.isLocal(debuggeeTargetUri)) {
          return; // Nothing to do if our debug session is local.
        }
        if (
          nuclideUri.getHostname(debuggeeTargetUri) ===
          connection.getRemoteHostname()
        ) {
          this._model.getActions().stopDebugging();
        }
      }),
      this._model.getDebuggerProviderStore().onConnectionsUpdated(() => {
        const store = this._model.getDebuggerProviderStore();
        const newConnections = store.getConnections();
        const keys = Array.from(this._connectionProviders.keys());

        const removedConnections = keys.filter(
          connection =>
            newConnections.find(item => item === connection) == null,
        );
        const addedConnections = newConnections.filter(
          connection => keys.find(item => item === connection) == null,
        );

        for (const key of removedConnections) {
          for (const provider of this._connectionProviders.get(key) || []) {
            provider.dispose();
          }

          this._connectionProviders.delete(key);
        }

        for (const connection of addedConnections) {
          this._setProvidersForConnection(store, connection);
        }
      }),
      this._model.getDebuggerProviderStore().onProvidersUpdated(() => {
        const store = this._model.getDebuggerProviderStore();
        const connections = store.getConnections();
        for (const connection of connections) {
          this._setProvidersForConnection(store, connection);
        }
      }),
      // Commands.
      atom.commands.add('atom-workspace', {
        'nuclide-debugger:show-attach-dialog': () => {
          const boundFn = this._showLaunchAttachDialog.bind(this);
          boundFn('attach');
        },
      }),
      atom.commands.add('atom-workspace', {
        'nuclide-debugger:show-launch-dialog': () => {
          const boundFn = this._showLaunchAttachDialog.bind(this);
          boundFn('launch');
        },
      }),
      atom.commands.add('atom-workspace', {
        'nuclide-debugger:continue-debugging': this._continue.bind(this),
      }),
      atom.commands.add('atom-workspace', {
        'nuclide-debugger:stop-debugging': this._stop.bind(this),
      }),
      atom.commands.add('atom-workspace', {
        'nuclide-debugger:restart-debugging': this._restart.bind(this),
      }),
      atom.commands.add('atom-workspace', {
        'nuclide-debugger:step-over': this._stepOver.bind(this),
      }),
      atom.commands.add('atom-workspace', {
        'nuclide-debugger:step-into': this._stepInto.bind(this),
      }),
      atom.commands.add('atom-workspace', {
        'nuclide-debugger:step-out': this._stepOut.bind(this),
      }),
      atom.commands.add('atom-workspace', {
        'nuclide-debugger:toggle-breakpoint': this._toggleBreakpoint.bind(this),
      }),
      atom.commands.add('atom-workspace', {
        'nuclide-debugger:toggle-breakpoint-enabled': this._toggleBreakpointEnabled.bind(
          this,
        ),
      }),
      atom.commands.add('atom-workspace', {
        'nuclide-debugger:remove-all-breakpoints': this._deleteAllBreakpoints.bind(
          this,
        ),
      }),
      atom.commands.add('atom-workspace', {
        'nuclide-debugger:enable-all-breakpoints': this._enableAllBreakpoints.bind(
          this,
        ),
      }),
      atom.commands.add('atom-workspace', {
        'nuclide-debugger:disable-all-breakpoints': this._disableAllBreakpoints.bind(
          this,
        ),
      }),
      atom.commands.add('atom-workspace', {
        'nuclide-debugger:remove-breakpoint': this._deleteBreakpoint.bind(this),
      }),
      atom.commands.add('atom-workspace', {
        'nuclide-debugger:add-to-watch': this._addToWatch.bind(this),
      }),
      atom.commands.add('atom-workspace', {
        'nuclide-debugger:run-to-location': this._runToLocation.bind(this),
      }),
      atom.commands.add('.nuclide-debugger-root', {
        'nuclide-debugger:copy-debugger-expression-value': this._copyDebuggerExpressionValue.bind(
          this,
        ),
      }),
      atom.commands.add('.nuclide-debugger-root', {
        'nuclide-debugger:copy-debugger-callstack': this._copyDebuggerCallstack.bind(
          this,
        ),
      }),
      // Context Menu Items.
      atom.contextMenu.add({
        '.nuclide-debugger-breakpoint': [
          {
            label: 'Enable All Breakpoints',
            command: 'nuclide-debugger:enable-all-breakpoints',
          },
          {
            label: 'Disable All Breakpoints',
            command: 'nuclide-debugger:disable-all-breakpoints',
          },
          {
            label: 'Remove Breakpoint',
            command: 'nuclide-debugger:remove-breakpoint',
          },
          {
            label: 'Remove All Breakpoints',
            command: 'nuclide-debugger:remove-all-breakpoints',
          },
        ],
        '.nuclide-debugger-callstack-table': [
          {
            label: 'Copy Callstack',
            command: 'nuclide-debugger:copy-debugger-callstack',
          },
        ],
        '.nuclide-debugger-expression-value-list': [
          {
            label: 'Copy',
            command: 'nuclide-debugger:copy-debugger-expression-value',
          },
        ],
        'atom-text-editor': [
          {type: 'separator'},
          {
            label: 'Debugger',
            submenu: [
              {
                label: 'Run to Location',
                command: 'nuclide-debugger:run-to-location',
                shouldDisplay: event => {
                  // Should also check for is paused.
                  const store = this.getModel().getStore();
                  const debuggerInstance = store.getDebuggerInstance();
                  if (
                    store.getDebuggerMode() === DebuggerMode.PAUSED &&
                    debuggerInstance != null &&
                    debuggerInstance
                      .getDebuggerProcessInfo()
                      .supportContinueToLocation()
                  ) {
                    return true;
                  }
                  return false;
                },
              },
              {
                label: 'Toggle Breakpoint',
                command: 'nuclide-debugger:toggle-breakpoint',
              },
              {
                label: 'Toggle Breakpoint enabled/disabled',
                command: 'nuclide-debugger:toggle-breakpoint-enabled',
                shouldDisplay: event =>
                  this._executeWithEditorPath(
                    event,
                    (filePath, line) =>
                      this.getModel()
                        .getBreakpointStore()
                        .getBreakpointAtLine(filePath, line) != null,
                  ) || false,
              },
              {
                label: 'Add to Watch',
                command: 'nuclide-debugger:add-to-watch',
                shouldDisplay: event => {
                  const textEditor = atom.workspace.getActiveTextEditor();
                  if (
                    !this.getModel().getStore().isDebugging() ||
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
            ],
          },
          {type: 'separator'},
        ],
      }),
    );
  }

  _setProvidersForConnection(
    store: DebuggerProviderStore,
    connection: NuclideUri,
  ): void {
    const key = nuclideUri.isRemote(connection)
      ? nuclideUri.getHostname(connection)
      : 'local';
    const availableProviders = store.getLaunchAttachProvidersForConnection(
      connection,
    );
    this._connectionProviders.set(key, availableProviders);
  }

  serialize(): SerializedState {
    const state = {
      breakpoints: this.getModel()
        .getBreakpointStore()
        .getSerializedBreakpoints(),
    };
    return state;
  }

  dispose() {
    this._disposables.dispose();
  }

  getModel(): DebuggerModel {
    return this._model;
  }

  consumeRegisterNuxService(addNewNux: RegisterNux): Disposable {
    const disposable = addNewNux(createDebuggerNuxTourModel());
    this._disposables.add(disposable);
    return disposable;
  }

  consumeWorkspaceViewsService(api: WorkspaceViewsService): void {
    this._disposables.add(
      api.addOpener(uri => {
        return this._layoutManager.getModelForDebuggerUri(uri);
      }),
      () => {
        this._layoutManager.hideDebuggerViews(api, false);
      },
      atom.commands.add('atom-workspace', {
        'nuclide-debugger:show': () => {
          this._layoutManager.showDebuggerViews(api);
        },
      }),
      atom.commands.add('atom-workspace', {
        'nuclide-debugger:hide': () => {
          this._layoutManager.hideDebuggerViews(api, false);
          this._model.getActions().stopDebugging();
        },
      }),
      this._model
        .getStore()
        .onDebuggerModeChange(() =>
          this._layoutManager.debuggerModeChanged(api),
        ),
      atom.commands.add('atom-workspace', {
        'nuclide-debugger:reset-layout': () => {
          this._layoutManager.resetLayout(api);
        },
      }),
    );

    this._disposables.add(
      atom.contextMenu.add({
        '.nuclide-debugger-container': [
          {
            label: 'Debugger Views',
            submenu: [
              {
                label: 'Reset Layout',
                command: 'nuclide-debugger:reset-layout',
              },
            ],
          },
        ],
      }),
    );

    this._layoutManager.consumeWorkspaceViewsService(api);
  }

  setTriggerNux(triggerNux: TriggerNux): void {
    this._tryTriggerNux = triggerNux;
  }

  tryTriggerNux(id: number): void {
    if (this._tryTriggerNux != null) {
      this._tryTriggerNux(id);
    }
  }

  _continue() {
    // TODO(jeffreytan): when we figured out the launch lifecycle story
    // we may bind this to start-debugging too.
    track(AnalyticsEvents.DEBUGGER_STEP_CONTINUE);
    this._model.getBridge().continue();
  }

  _stop() {
    this._model.getActions().stopDebugging();
  }

  _restart() {
    this._model.getActions().restartDebugger();
  }

  _stepOver() {
    track(AnalyticsEvents.DEBUGGER_STEP_OVER);
    this._model.getBridge().stepOver();
  }

  _stepInto() {
    track(AnalyticsEvents.DEBUGGER_STEP_INTO);
    this._model.getBridge().stepInto();
  }

  _stepOut() {
    track(AnalyticsEvents.DEBUGGER_STEP_OUT);
    this._model.getBridge().stepOut();
  }

  _toggleBreakpoint(event: any) {
    return this._executeWithEditorPath(event, (filePath, line) => {
      this._model.getActions().toggleBreakpoint(filePath, line);
    });
  }

  _toggleBreakpointEnabled(event: any) {
    this._executeWithEditorPath(event, (filePath, line) => {
      const bp = this._model
        .getBreakpointStore()
        .getBreakpointAtLine(filePath, line);

      if (bp) {
        const {id, enabled} = bp;
        this._model.getActions().updateBreakpointEnabled(id, !enabled);
      }
    });
  }

  _runToLocation(event: any) {
    this._executeWithEditorPath(event, (path, line) => {
      track(AnalyticsEvents.DEBUGGER_STEP_RUN_TO_LOCATION);
      this._model.getBridge().runToLocation(path, line);
    });
  }

  _executeWithEditorPath<T>(
    event: any,
    fn: (filePath: string, line: number) => T,
  ): ?T {
    const editor = atom.workspace.getActiveTextEditor();
    if (!editor || !editor.getPath()) {
      return null;
    }

    const line = getLineForEvent(editor, event);
    return fn(nullthrows(editor.getPath()), line);
  }

  _deleteBreakpoint(event: any): void {
    const actions = this._model.getActions();
    const target = (event.target: HTMLElement);
    const path = target.dataset.path;
    const line = parseInt(target.dataset.line, 10);
    if (path == null) {
      return;
    }
    actions.deleteBreakpoint(path, line);
  }

  _deleteAllBreakpoints(): void {
    const actions = this._model.getActions();
    actions.deleteAllBreakpoints();
  }

  _enableAllBreakpoints(): void {
    const actions = this._model.getActions();
    actions.enableAllBreakpoints();
  }

  _disableAllBreakpoints(): void {
    const actions = this._model.getActions();
    actions.disableAllBreakpoints();
  }

  _renderConfigDialog(
    panel: atom$Panel,
    chooseConnection: boolean,
    dialogMode: DebuggerConfigAction,
    dialogCloser: () => void,
  ): void {
    if (this._selectedDebugConnection == null) {
      // If no connection is selected yet, default to the local connection.
      this._selectedDebugConnection = 'local';
    }

    invariant(this._selectedDebugConnection != null);
    if (chooseConnection) {
      const options = this._model
        .getDebuggerProviderStore()
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
      ReactDOM.render(
        <DebuggerLaunchAttachConnectionChooser
          options={options}
          selectedConnection={this._selectedDebugConnection || 'local'}
          connectionChanged={(newValue: ?string) => {
            this._selectedDebugConnection = newValue;
            this._renderConfigDialog(panel, false, dialogMode, dialogCloser);
          }}
          dialogCloser={dialogCloser}
        />,
        panel.getItem(),
      );
    } else {
      const connection = this._selectedDebugConnection || 'local';
      const key = nuclideUri.isRemote(connection)
        ? nuclideUri.getHostname(connection)
        : 'local';
      ReactDOM.render(
        <DebuggerLaunchAttachUI
          dialogMode={dialogMode}
          store={this._model.getDebuggerProviderStore()}
          debuggerActions={this._model.getActions()}
          connection={connection}
          chooseConnection={() =>
            this._renderConfigDialog(panel, true, dialogMode, dialogCloser)}
          dialogCloser={dialogCloser}
          providers={this._connectionProviders.get(key) || []}
        />,
        panel.getItem(),
      );
    }
  }

  _showLaunchAttachDialog(dialogMode: DebuggerConfigAction): void {
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
    });

    const parentEl: HTMLElement = (hostEl.parentElement: any);
    parentEl.style.maxWidth = '100em';

    // Function callback that closes the dialog and frees all of its resources.
    this._renderConfigDialog(pane, false, dialogMode, () =>
      disposables.dispose(),
    );
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
    if (watchExpression) {
      this._model.getActions().addWatchExpression(watchExpression);
    }
  }

  _copyDebuggerExpressionValue(event: Event) {
    const clickedElement: HTMLElement = (event.target: any);
    atom.clipboard.write(clickedElement.textContent);
  }

  _copyDebuggerCallstack(event: Event) {
    const callstackStore = this._model.getCallstackStore();
    const callstack = callstackStore.getCallstack();
    if (callstack) {
      let callstackText = '';
      callstack.forEach((item, i) => {
        const path = nuclideUri.basename(
          item.location.path.replace(/^[a-zA-Z]+:\/\//, ''),
        );
        callstackText += `${i}\t${item.name}\t${path}:${item.location.line}${os.EOL}`;
      });

      atom.clipboard.write(callstackText.trim());
    }
  }

  consumeCurrentWorkingDirectory(cwdApi: CwdApi): IDisposable {
    const updateSelectedConnection = directory => {
      this._selectedDebugConnection = directory != null
        ? directory.getPath()
        : null;
    };
    const boundUpdateSelectedColumn = updateSelectedConnection.bind(this);
    const disposable = cwdApi.observeCwd(directory =>
      boundUpdateSelectedColumn(directory),
    );
    this._disposables.add(disposable);
    return new UniversalDisposable(() => {
      disposable.dispose();
      this._disposables.remove(disposable);
    });
  }
}

function createDatatipProvider(): DatatipProvider {
  if (datatipProvider == null) {
    datatipProvider = {
      // Eligibility is determined online, based on registered EvaluationExpression providers.
      validForScope: (scope: string) => true,
      providerName: DATATIP_PACKAGE_NAME,
      inclusionPriority: 1,
      datatip: (editor: TextEditor, position: atom$Point) => {
        if (activation == null) {
          return Promise.resolve(null);
        }
        const model = activation.getModel();
        return debuggerDatatip(model, editor, position);
      },
    };
  }
  return datatipProvider;
}

let activation = null;
let datatipProvider: ?DatatipProvider;

export function activate(state: ?SerializedState): void {
  if (!activation) {
    activation = new Activation(state);
  }
}

export function serialize(): SerializedState {
  if (activation) {
    return activation.serialize();
  } else {
    return {
      breakpoints: null,
    };
  }
}

export function deactivate() {
  if (activation) {
    activation.dispose();
    activation = null;
  }
}

export function consumeOutputService(api: OutputService): void {
  setOutputService(api);
}

function registerConsoleExecutor(
  watchExpressionStore: WatchExpressionStore,
  registerExecutor: RegisterExecutorFunction,
): IDisposable {
  const disposables = new UniversalDisposable();
  const rawOutput: Subject<?EvaluationResult> = new Subject();
  const send = expression => {
    disposables.add(
      // We filter here because the first value in the BehaviorSubject is null no matter what, and
      // we want the console to unsubscribe the stream after the first non-null value.
      watchExpressionStore
        .evaluateConsoleExpression(expression)
        .filter(result => result != null)
        .first()
        .subscribe(result => rawOutput.next(result)),
    );
    watchExpressionStore._triggerReevaluation();
  };
  const output: Observable<{
    result?: EvaluationResult,
  }> = rawOutput.map(result => {
    invariant(result != null);
    return {data: result};
  });
  disposables.add(
    registerExecutor({
      id: 'debugger',
      name: 'Debugger',
      send,
      output,
      getProperties: watchExpressionStore.getProperties.bind(
        watchExpressionStore,
      ),
    }),
  );
  return disposables;
}

export function consumeRegisterExecutor(
  registerExecutor: RegisterExecutorFunction,
): IDisposable {
  if (activation != null) {
    const model = activation.getModel();
    const register = () =>
      registerConsoleExecutor(
        model.getWatchExpressionStore(),
        registerExecutor,
      );
    model.getActions().addConsoleRegisterFunction(register);
    return new Disposable(() =>
      model.getActions().removeConsoleRegisterFunction(register),
    );
  } else {
    return new Disposable();
  }
}

export function consumeDebuggerProvider(
  provider: NuclideDebuggerProvider,
): IDisposable {
  if (activation) {
    activation.getModel().getActions().addDebuggerProvider(provider);
  }
  return new Disposable(() => {
    if (activation) {
      activation.getModel().getActions().removeDebuggerProvider(provider);
    }
  });
}

export function consumeEvaluationExpressionProvider(
  provider: NuclideEvaluationExpressionProvider,
): IDisposable {
  if (activation) {
    activation
      .getModel()
      .getActions()
      .addEvaluationExpressionProvider(provider);
  }
  return new Disposable(() => {
    if (activation) {
      activation
        .getModel()
        .getActions()
        .removeEvaluationExpressionProvider(provider);
    }
  });
}

export function consumeToolBar(getToolBar: toolbar$GetToolbar): IDisposable {
  const toolBar = getToolBar('nuclide-debugger');
  toolBar.addButton({
    iconset: 'icon-nuclicon',
    icon: 'debugger',
    callback: 'nuclide-debugger:show-attach-dialog',
    tooltip: 'Attach Debugger',
    priority: 500,
  }).element;
  const disposable = new Disposable(() => {
    toolBar.removeItems();
  });
  invariant(activation);
  activation._disposables.add(disposable);
  return disposable;
}

export function consumeNotifications(
  raiseNativeNotification: (
    title: string,
    body: string,
    timeout: number,
    raiseIfAtomHasFocus: boolean,
  ) => ?IDisposable,
): void {
  setNotificationService(raiseNativeNotification);
}

export function provideRemoteControlService(): RemoteControlService {
  return new RemoteControlService(
    () => (activation ? activation.getModel() : null),
  );
}

export function consumeDatatipService(service: DatatipService): IDisposable {
  const provider = createDatatipProvider();
  const disposable = service.addProvider(provider);
  invariant(activation);
  activation.getModel().getThreadStore().setDatatipService(service);
  activation._disposables.add(disposable);
  return disposable;
}

function createDebuggerNuxTourModel(): NuxTourModel {
  const welcomeToNewUiNux = {
    content: 'Welcome to the new Nuclide debugger UI!</br>' +
      'We are evolving the debugger to integrate more closely with Nuclide.',
    selector: '.nuclide-debugger-container-new',
    position: 'left',
  };

  const newDebuggerUINuxTour = {
    id: NUX_NEW_DEBUGGER_UI_ID,
    name: NUX_NEW_DEBUGGER_UI_NAME,
    nuxList: [welcomeToNewUiNux],
    gatekeeperID: GK_NEW_DEBUGGER_UI_NUX,
  };

  return newDebuggerUINuxTour;
}

export function consumeRegisterNuxService(addNewNux: RegisterNux): Disposable {
  invariant(activation);
  return activation.consumeRegisterNuxService(addNewNux);
}

export function consumeTriggerNuxService(tryTriggerNux: TriggerNux): void {
  if (activation != null) {
    activation.setTriggerNux(tryTriggerNux);
  }
}

export function consumeWorkspaceViewsService(api: WorkspaceViewsService): void {
  invariant(activation);
  activation.consumeWorkspaceViewsService(api);
}

export function consumeCurrentWorkingDirectory(cwdApi: CwdApi): IDisposable {
  invariant(activation);
  return activation.consumeCurrentWorkingDirectory(cwdApi);
}
