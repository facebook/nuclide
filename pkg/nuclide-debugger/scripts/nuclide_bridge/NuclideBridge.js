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
  ObjectGroup,
  WebInspector$CallFrame,
  WebInspector$Event,
  IPCBreakpoint,
  EvaluationResult,
  ExpansionResult,
} from '../../lib/types';

import invariant from 'assert';
import electron from 'electron';

import Emitter from './Emitter';
import {MultiMap} from 'nuclide-commons/collection';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {beginTimerTracking, endTimerTracking} from '../../lib/AnalyticsHelper';
import WebInspector from '../../lib/WebInspector';

const {ipcRenderer} = electron;
invariant(ipcRenderer != null);

const NUCLIDE_DEBUGGER_CONSOLE_OBJECT_GROUP = 'console';

type BreakpointNotificationType = 'BreakpointAdded' | 'BreakpointRemoved';

class NuclideBridge {
  _allBreakpoints: {sourceURL: string, lineNumber: number}[];
  _unresolvedBreakpoints: MultiMap<string, number>;
  _emitter: Emitter;
  _debuggerPausedCount: number;
  _suppressBreakpointNotification: boolean;
  _callframeId: number;

  constructor() {
    this._allBreakpoints = [];
    this._unresolvedBreakpoints = new MultiMap();
    this._emitter = new Emitter();
    this._debuggerPausedCount = 0;
    this._suppressBreakpointNotification = false;
    this._callframeId = -1;

    ipcRenderer.on('command', this._handleIpcCommand.bind(this));

    WebInspector.targetManager.addModelListener(
      WebInspector.DebuggerModel,
      WebInspector.DebuggerModel.Events.CallFrameSelected,
      this._handleCallFrameSelected,
      this,
    );

    WebInspector.targetManager.addModelListener(
      WebInspector.DebuggerModel,
      WebInspector.DebuggerModel.Events.ClearInterface,
      this._handleClearInterface,
      this,
    );

    WebInspector.targetManager.addModelListener(
      WebInspector.DebuggerModel,
      WebInspector.DebuggerModel.Events.DebuggerResumed,
      this._handleDebuggerResumed,
      this,
    );

    WebInspector.targetManager.addModelListener(
      WebInspector.DebuggerModel,
      WebInspector.DebuggerModel.Events.DebuggerPaused,
      this._handleDebuggerPaused,
      this,
    );

    WebInspector.targetManager.addModelListener(
      WebInspector.DebuggerModel,
      WebInspector.DebuggerModel.Events.ThreadsUpdateIPC,
      this._handleThreadsUpdated,
      this,
    );

    WebInspector.targetManager.addModelListener(
      WebInspector.DebuggerModel,
      WebInspector.DebuggerModel.Events.ThreadUpdateIPC,
      this._handleThreadUpdated,
      this,
    );

    WebInspector.workspace.addEventListener(
      WebInspector.Workspace.Events.UISourceCodeAdded,
      this._handleUISourceCodeAdded,
      this,
    );

    WebInspector.notifications.addEventListener(
      WebInspector.UserMetrics.UserAction,
      function(event: WebInspector.Event) {
        if (event.data.action === 'openSourceLink') {
          this._handleOpenSourceLocation(event);
        }
      },
      this,
    );

    WebInspector.breakpointManager.addEventListener(
      WebInspector.BreakpointManager.Events.BreakpointAdded,
      this._handleBreakpointAdded,
      this,
    );

    WebInspector.breakpointManager.addEventListener(
      WebInspector.BreakpointManager.Events.BreakpointRemoved,
      this._handleBreakpointRemoved,
      this,
    );

    this._customizeWebInspector();
    window.runOnWindowLoad(this._handleWindowLoad.bind(this));
  }

  /**
   * Override and customize some functionalities of WebInspector.
   * Deliberately suppress any flow errors in this method.
   */
  _customizeWebInspector() {
    // $FlowFixMe.
    WebInspector.ObjectPropertyTreeElement._populate = function(
      treeElement,
      value,
      skipProto,
      emptyPlaceholder,
    ) {
      /**
         * @param {?Array.<!WebInspector.RemoteObjectProperty>} properties
         * @param {?Array.<!WebInspector.RemoteObjectProperty>} internalProperties
         */
      function callback(properties, internalProperties) {
        treeElement.removeChildren();
        if (!properties) {
          return;
        }
        // $FlowFixMe.
        WebInspector.ObjectPropertyTreeElement.populateWithProperties(
          treeElement,
          properties,
          internalProperties,
          skipProto,
          value,
          emptyPlaceholder,
        );
      }
      // $FlowFixMe.
      WebInspector.RemoteObject.loadFromObjectPerProto(value, callback);
    };

    // $FlowFixMe.
    WebInspector.ObjectPropertiesSection.prototype.update = function() {
      /**
         * @param {?Array.<!WebInspector.RemoteObjectProperty>} properties
         * @param {?Array.<!WebInspector.RemoteObjectProperty>} internalProperties
         * @this {WebInspector.ObjectPropertiesSection}
         */
      function callback(scopeName, properties, internalProperties) {
        if (!properties) {
          return;
        }
        this.updateProperties(properties, internalProperties);
      }
      // $FlowFixMe.
      WebInspector.RemoteObject.loadFromObject(
        this.object,
        Boolean(this.ignoreHasOwnProperty),
        // We use the scope object's `description` field as the scope's section header in the UI.
        callback.bind(this),
      );
    };
  }

  _handleWindowLoad() {
    ipcRenderer.sendToHost('notification', 'ready');
  }

  _handleIpcCommand(event: Object, command: string, ...args: any[]) {
    switch (command) {
      case 'SyncBreakpoints':
        this._allBreakpoints = args[0];
        this._syncBreakpoints();
        break;
      case 'AddBreakpoint':
        this._addBreakpoint(args[0]);
        break;
      case 'UpdateBreakpoint':
        this._updateBreakpoint(args[0]);
        break;
      case 'DeleteBreakpoint':
        this._deleteBreakpoint(args[0]);
        break;
      case 'Continue':
        this._continue();
        break;
      case 'Pause':
        this._pause();
        break;
      case 'StepOver':
        this._stepOver();
        break;
      case 'StepInto':
        this._stepInto();
        break;
      case 'StepOut':
        this._stepOut();
        break;
      case 'RunToLocation':
        this._runToLocation(args[0], args[1]);
        break;
      case 'evaluateOnSelectedCallFrame':
        this._evaluateOnSelectedCallFrame(args[0], args[1], args[2]);
        break;
      case 'runtimeEvaluate':
        this._runtimeEvaluate(args[0], args[1]);
        break;
      case 'getProperties':
        this._getProperties(args[0], args[1]);
        break;
      case 'triggerDebuggerAction':
        this._triggerDebuggerAction(args[0]);
        break;
      case 'setPauseOnException':
        this._setPauseOnException(args[0]);
        break;
      case 'setPauseOnCaughtException':
        this._setPauseOnCaughtException(args[0]);
        break;
      case 'setSingleThreadStepping':
        this._setSingleThreadStepping(args[0]);
        break;
      case 'selectThread':
        this.selectThread(args[0]);
        break;
      case 'setSelectedCallFrameIndex':
        this._handleSetSelectedCallFrameIndex(args[0]);
    }
  }

  _handleCallFrameSelected(event: WebInspector.Event) {
    // TODO(jonaldislarry): Extend chrome protocol as per t12187369.
    if (this._debuggerPausedCount <= 1) {
      return;
    }
    const frame: WebInspector$CallFrame = event.data;
    const uiLocation = WebInspector.debuggerWorkspaceBinding.rawLocationToUILocation(
      frame.location(),
    );
    ipcRenderer.sendToHost('notification', 'CallFrameSelected', {
      sourceURL: uiLocation.uiSourceCode.uri(),
      lineNumber: uiLocation.lineNumber,
    });
    this._updateScopes(frame);
  }

  _handleOpenSourceLocation(event: WebInspector.Event) {
    // TODO(jonaldislarry): Extend chrome protocol as per t12187369.
    if (this._debuggerPausedCount <= 1) {
      return;
    }
    const eventData = event.data;
    this.sendOpenSourceLocation(eventData.url, eventData.lineNumber);
  }

  sendOpenSourceLocation(sourceURL: string, line: number) {
    ipcRenderer.sendToHost('notification', 'OpenSourceLocation', {
      sourceURL,
      lineNumber: line,
    });
  }

  selectThread(threadId: string) {
    const target = WebInspector.targetManager.mainTarget();
    if (target != null) {
      target.debuggerModel.selectThread(threadId);
      target.debuggerModel.threadStore.getActiveThreadStack(callFrames => {
        const callstack = this._convertFramesToIPCFrames(callFrames);
        ipcRenderer.sendToHost('notification', 'CallstackUpdate', callstack);
      });
    }
  }

  _handleSetSelectedCallFrameIndex(callframeIndex: number): void {
    const target = WebInspector.targetManager.mainTarget();
    if (target != null) {
      const selectedFrame = target.debuggerModel.callFrames[callframeIndex];
      target.debuggerModel.setSelectedCallFrame(selectedFrame);
      this._updateScopes(selectedFrame);
      this._callframeId = selectedFrame.id;
    }
  }

  async _updateScopes(frame: WebInspector$CallFrame): Promise<void> {
    const scopes = frame.scopeChain();
    // We need to wait for the backend to send us the scope data, and only want to continue when
    // we have each scope.
    const scopeSections = await Promise.all(
      scopes.map(scope => {
        const scopeObj = scope.object();
        return new Promise(resolve =>
          scopeObj.getOwnProperties(scopeVariables =>
            resolve({name: scopeObj.description, scopeVariables}),
          ),
        );
      }),
    );
    ipcRenderer.sendToHost(
      'notification',
      'ScopesUpdate',
      scopeSections.map(scope => {
        const {name, scopeVariables} = scope;
        return {
          name,
          scopeVariables: scopeVariables.map(scopeVariable => {
            const {name: variableName, value: scopeValue} = scopeVariable;
            return {
              name: variableName,
              value: getIpcEvaluationResult(false /* wasThrown */, scopeValue),
            };
          }),
        };
      }),
    );
  }

  _sendCallstack(): void {
    const target = WebInspector.targetManager.mainTarget();
    if (target == null) {
      return;
    }
    const model = target.debuggerModel;
    if (model == null) {
      return;
    }
    const callFrames = model.callFrames;
    if (callFrames == null) {
      return;
    }
    const callstack = this._convertFramesToIPCFrames(callFrames);
    ipcRenderer.sendToHost('notification', 'CallstackUpdate', callstack);
  }

  _convertFramesToIPCFrames(callFrames: Array<Object>): Array<Object> {
    return callFrames.map(callFrame => {
      const location = callFrame.location();
      // If there is a sourcemap available, use it to adjust the column and line numbers.
      const uiLocation = WebInspector.debuggerWorkspaceBinding.rawLocationToUILocation(
        location,
      );
      /* names anonymous functions "(anonymous function)" */
      const functionName = WebInspector.beautifyFunctionName(
        callFrame.functionName,
      );
      return {
        name: functionName,
        location: {
          path: uiLocation.uiSourceCode.uri(),
          column: uiLocation.columnNumber,
          line: uiLocation.lineNumber,
          hasSource:
            callFrame.hasSource() != null ? callFrame.hasSource() : true,
        },
      };
    });
  }

  _getProperties(id: number, objectId: string): void {
    const mainTarget = WebInspector.targetManager.mainTarget();
    if (mainTarget == null) {
      return;
    }
    const runtimeAgent = mainTarget.runtimeAgent();
    if (runtimeAgent == null) {
      return;
    }
    runtimeAgent.getProperties(
      objectId,
      false, // ownProperties
      false, // accessorPropertiesOnly
      false, // generatePreview
      (error, properties, internalProperties) => {
        const result = getIpcExpansionResult(properties);
        ipcRenderer.sendToHost('notification', 'GetPropertiesResponse', {
          result,
          error,
          objectId,
          id,
        });
      },
    );
  }

  _evaluateOnSelectedCallFrame(
    id: number,
    expression: string,
    objectGroup: ObjectGroup,
  ): void {
    const mainTarget = WebInspector.targetManager.mainTarget();
    if (mainTarget == null) {
      return;
    }
    mainTarget.debuggerModel.evaluateOnSelectedCallFrame(
      expression,
      objectGroup,
      false /* includeCommandLineAPI */,
      true /* doNotPauseOnExceptionsAndMuteConsole */,
      false /* returnByValue */,
      false /* generatePreview */,
      (remoteObject, wasThrown, error) => {
        const result = getIpcEvaluationResult(wasThrown, remoteObject);
        ipcRenderer.sendToHost('notification', 'ExpressionEvaluationResponse', {
          result,
          // flowlint-next-line sketchy-null-mixed:off
          error: wasThrown ? error || result : null,
          expression,
          id,
        });

        if (!wasThrown) {
          // Evaluate could have had a side effect. Force a refresh of scopes for the current
          // frame.
          mainTarget.debuggerModel.threadStore.getRefreshedThreadStack(
            callFrames => {
              const frames =
                callFrames != null && callFrames.length > 0
                  ? callFrames
                  : mainTarget.debuggerModel.callFrames;

              const targetFrameId =
                frames.length === 0 || this._callframeId !== -1
                  ? this._callframeId
                  : frames[0].id;

              frames
                .filter(frame => frame.id === targetFrameId)
                .forEach(frame => this._updateScopes(frame));
            },
          );
        }
      },
    );
  }

  _runtimeEvaluate(id: number, expression: string): void {
    const mainTarget = WebInspector.targetManager.mainTarget();
    if (mainTarget == null) {
      return;
    }
    const executionContexts = mainTarget.runtimeModel.executionContexts();
    if (executionContexts.length === 0) {
      return;
    }
    const firstContext = executionContexts[0];
    firstContext.evaluate(
      expression,
      NUCLIDE_DEBUGGER_CONSOLE_OBJECT_GROUP,
      false /* includeCommandLineAPI */,
      true /* doNotPauseOnExceptionsAndMuteConsole */,
      false /* returnByValue */,
      false /* generatePreview */,
      (remoteObject, wasThrown, error) => {
        const result = getIpcEvaluationResult(wasThrown, remoteObject);
        ipcRenderer.sendToHost('notification', 'ExpressionEvaluationResponse', {
          result,
          error: wasThrown ? error : null,
          expression,
          id,
        });
      },
    );
  }

  _setPauseOnException(pauseOnExceptionEnabled: boolean): void {
    WebInspector.settings.pauseOnExceptionEnabled.set(pauseOnExceptionEnabled);
  }

  _setPauseOnCaughtException(pauseOnCaughtExceptionEnabled: boolean): void {
    WebInspector.settings.pauseOnCaughtException.set(
      pauseOnCaughtExceptionEnabled,
    );
  }

  _setSingleThreadStepping(singleThreadStepping: boolean): void {
    WebInspector.settings.singleThreadStepping.set(singleThreadStepping);
  }

  _triggerDebuggerAction(actionId: string): void {
    switch (actionId) {
      case 'debugger.toggle-pause':
      case 'debugger.step-over':
      case 'debugger.step-into':
      case 'debugger.step-out':
      case 'debugger.run-snippet':
        WebInspector.actionRegistry.execute(actionId);
        break;
      default:
        // console.error because throwing can fatal the Chrome dev tools.
        // eslint-disable-next-line no-console
        console.error(
          '_triggerDebuggerAction: unrecognized actionId',
          actionId,
        );
        break;
    }
  }

  _handleDebuggerPaused(event: WebInspector$Event) {
    endTimerTracking();
    ++this._debuggerPausedCount;

    if (this._debuggerPausedCount === 1) {
      this._handleLoaderBreakpoint();
    } else {
      ipcRenderer.sendToHost('notification', 'NonLoaderDebuggerPaused', {
        stopThreadId: event.data.stopThreadId,
        threadSwitchNotification: this._generateThreadSwitchNotification(
          event.data.threadSwitchMessage,
          event.data.location,
        ),
      });
      // Only send callstack for non-loader breakpoint pause.
      this._sendCallstack();
    }
  }

  _generateThreadSwitchNotification(
    message?: string,
    location?: Object,
  ): ?Object {
    if (message != null && location != null) {
      const uiLocation = WebInspector.debuggerWorkspaceBinding.rawLocationToUILocation(
        location,
      );
      return {
        sourceURL: uiLocation.uiSourceCode.uri(),
        lineNumber: uiLocation.lineNumber,
        message,
      };
    } else {
      return null;
    }
  }

  _handleLoaderBreakpoint() {
    // Sync any initial breakpoints to engine during loader breakpoint
    // and continue from it.
    this._syncBreakpoints();

    // If we were to continue synchronously here, the debugger would no longer be paused when the
    // remaining subscribers' callbacks were invoked. That's a violation of a pretty basic
    // assumption (that the debugger will be paused when your paused event callback is called) so
    // instead we wait until the next tick. If the debugger is still paused then, we continue. Not
    // doing this results in an "Runtime.getProperties failed" error in node-inspector since that
    // call is only valid during a paused state.
    process.nextTick(() => {
      const targetManager =
        WebInspector != null ? WebInspector.targetManager : null;
      const mainTarget =
        targetManager != null ? targetManager.mainTarget() : null;
      const debuggerModel =
        mainTarget != null ? mainTarget.debuggerModel : null;
      const stillPaused = debuggerModel != null && debuggerModel.isPaused();
      if (stillPaused) {
        this._continue();
      }
    });

    ipcRenderer.sendToHost('notification', 'LoaderBreakpointResumed', {});
  }

  _handleDebuggerResumed(event: WebInspector$Event) {
    ipcRenderer.sendToHost('notification', 'DebuggerResumed', {});
  }

  _handleClearInterface(event: WebInspector$Event) {
    ipcRenderer.sendToHost('notification', 'ClearInterface', {});
  }

  _handleBreakpointAdded(event: WebInspector$Event) {
    this._sendBreakpointNotification(event, 'BreakpointAdded');
  }

  _handleBreakpointRemoved(event: WebInspector$Event) {
    this._sendBreakpointNotification(event, 'BreakpointRemoved');
  }

  _sendBreakpointNotification(
    event: WebInspector$Event,
    type: BreakpointNotificationType,
  ) {
    if (!this._suppressBreakpointNotification) {
      ipcRenderer.sendToHost(
        'notification',
        type,
        this._getIPCBreakpointFromEvent(event),
      );
    }
  }

  _getIPCBreakpointFromEvent(event: WebInspector$Event): IPCBreakpoint {
    const {breakpoint, uiLocation, resolved} = event.data;
    return {
      sourceURL: uiLocation.uiSourceCode.uri(),
      lineNumber: uiLocation.lineNumber,
      condition: breakpoint.condition(),
      enabled: breakpoint.enabled(),
      resolved: resolved || false,
    };
  }

  // TODO[jeffreytan]: this is a hack to enable hhvm/lldb debugger
  // setting breakpoints in non-parsed files.
  // Open issues:
  // Any breakpoints in this list will shown as bound/resolved;
  // needs to revisit the unresolved breakpoints detection logic.
  _parseBreakpointSources(): void {
    this._allBreakpoints.forEach(breakpoint => {
      this._parseBreakpointSourceIfNeeded(breakpoint);
    });
  }

  _parseBreakpointSourceIfNeeded(breakpoint: Object): void {
    const sourceUrl = breakpoint.sourceURL;
    const source = WebInspector.workspace.uiSourceCodeForOriginURL(sourceUrl);
    if (source != null) {
      return;
    }
    const target = WebInspector.targetManager.mainTarget();
    if (target == null) {
      return;
    }
    target.debuggerModel._parsedScriptSource(sourceUrl, sourceUrl);
  }

  // Synchronizes nuclide BreakpointStore and BreakpointManager
  _syncBreakpoints() {
    this._parseBreakpointSources();

    // Add the ones that don't.
    this._unresolvedBreakpoints = new MultiMap();
    this._allBreakpoints.forEach(breakpoint => {
      if (!this._addBreakpoint(breakpoint)) {
        // No API exists for adding breakpoints to source files that are not
        // yet known, store it locally and try to add them later.
        this._unresolvedBreakpoints.set(breakpoint.sourceURL, [
          breakpoint.lineNumber,
        ]);
      }
    });
    this._emitter.emit('unresolved-breakpoints-changed', null);
  }

  _addBreakpoint(breakpoint: Object): boolean {
    this._parseBreakpointSourceIfNeeded(breakpoint);
    const {sourceURL, lineNumber, condition} = breakpoint;
    const source = WebInspector.workspace.uiSourceCodeForOriginURL(sourceURL);
    if (source == null) {
      return false;
    }
    WebInspector.breakpointManager.setBreakpoint(
      source,
      lineNumber,
      0, // columnNumber
      condition || '', // Condition
      true, // enabled
    );
    return true;
  }

  _updateBreakpoint(breakpoint: Object): boolean {
    const {sourceURL, lineNumber, condition, enabled} = breakpoint;
    const source = WebInspector.workspace.uiSourceCodeForOriginURL(sourceURL);
    if (source == null) {
      return false;
    }
    const chromeBreakpoint = WebInspector.breakpointManager.findBreakpointOnLine(
      source,
      lineNumber,
    );
    if (chromeBreakpoint == null) {
      return false;
    }
    invariant(condition != null);
    chromeBreakpoint.setCondition(condition);
    invariant(enabled != null);
    chromeBreakpoint.setEnabled(enabled);
    return true;
  }

  _deleteBreakpoint(breakpoint: Object): boolean {
    const source = WebInspector.workspace.uiSourceCodeForOriginURL(
      breakpoint.sourceURL,
    );
    if (source == null) {
      return false;
    }
    const chromeBreakpoint = WebInspector.breakpointManager.findBreakpointOnLine(
      source,
      breakpoint.lineNumber,
    );
    if (chromeBreakpoint == null) {
      return false;
    }
    chromeBreakpoint.remove(false);
    return true;
  }

  _continue(): void {
    const target = WebInspector.targetManager.mainTarget();
    if (target) {
      beginTimerTracking('nuclide-debugger-atom:continue');
      target.debuggerModel.resume();
    }
  }

  _pause(): void {
    const target = WebInspector.targetManager.mainTarget();
    if (target) {
      beginTimerTracking('nuclide-debugger-atom:pause');
      target.debuggerModel.pause();
    }
  }

  _stepOver(): void {
    const target = WebInspector.targetManager.mainTarget();
    if (target) {
      beginTimerTracking('nuclide-debugger-atom:stepOver');
      target.debuggerModel.stepOver();
    }
  }

  _stepInto(): void {
    const target = WebInspector.targetManager.mainTarget();
    if (target) {
      beginTimerTracking('nuclide-debugger-atom:stepInto');
      target.debuggerModel.stepInto();
    }
  }

  _stepOut(): void {
    const target = WebInspector.targetManager.mainTarget();
    if (target) {
      beginTimerTracking('nuclide-debugger-atom:stepOut');
      target.debuggerModel.stepOut();
    }
  }

  _runToLocation(path: string, line: number): void {
    const target = WebInspector.targetManager.mainTarget();
    if (target) {
      beginTimerTracking('nuclide-debugger-atom:runToLocation');
      const url = nuclideUri.nuclideUriToUri(path);
      const location = target.debuggerModel.createRawLocationByURL(
        url,
        line,
        0,
      );
      location.continueToLocation();
    }
  }

  _handleUISourceCodeAdded(event: Object) {
    const source = event.data;
    this._unresolvedBreakpoints.get(source.uri()).forEach(line => {
      WebInspector.breakpointManager.setBreakpoint(source, line, 0, '', true);
    });
    if (this._unresolvedBreakpoints.deleteAll(source.uri())) {
      this._emitter.emit('unresolved-breakpoints-changed', null);
    }
  }

  onUnresolvedBreakpointsChanged(callback: () => void): IDisposable {
    return this._emitter.on('unresolved-breakpoints-changed', callback);
  }

  getUnresolvedBreakpointsList(): {url: string, line: number}[] {
    const result = [];
    this._unresolvedBreakpoints.forEach((line, url) => {
      result.push({url, line});
    });
    result.sort((a, b) => {
      if (a.url < b.url) {
        return -1;
      } else if (a.url > b.url) {
        return 1;
      } else {
        return a.line - b.line;
      }
    });
    return result;
  }

  _handleThreadsUpdated(event: WebInspector.Event): void {
    if (this._debuggerPausedCount <= 1) {
      return;
    }
    ipcRenderer.sendToHost('notification', 'ThreadsUpdate', event.data);
  }

  _handleThreadUpdated(event: WebInspector.Event): void {
    ipcRenderer.sendToHost('notification', 'ThreadUpdate', event.data);
  }
}

function getIpcEvaluationResult(
  wasThrown: boolean,
  remoteObject: ?EvaluationResult,
): ?EvaluationResult {
  if (remoteObject == null) {
    return null;
  }
  return {
    type: remoteObject.type,
    subtype: remoteObject.subtype,
    description: remoteObject.description,
    objectId: remoteObject.objectId,
    value: remoteObject.value,
  };
}

function getIpcExpansionResult(properties: ?ExpansionResult): ?ExpansionResult {
  if (properties == null) {
    return null;
  }
  return properties
    .filter(({name, value}) => value != null)
    .map(({name, value}) => {
      const {type, subtype, objectId, value: innerValue, description} = value;
      return {
        name,
        value: {
          type,
          subtype,
          objectId,
          value: innerValue,
          description,
        },
      };
    });
}

export default new NuclideBridge();
