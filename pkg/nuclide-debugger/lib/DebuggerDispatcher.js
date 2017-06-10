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
  DebuggerProcessInfo,
  DebuggerInstanceBase,
} from '../../nuclide-debugger-base';
import type {
  Callstack,
  ControlButtonSpecification,
  DebuggerModeType,
  ScopeSection,
  ExpressionResult,
  GetPropertiesResult,
  NuclideThreadData,
  ThreadItem,
} from './types';

import Dispatcher from '../../commons-node/Dispatcher';

export type DebuggerAction =
  | {
      actionType: 'SET_DEBUGGER_INSTANCE',
      data: ?DebuggerInstanceBase,
    }
  | {
      actionType: 'SET_ERROR',
      data: ?string,
    }
  | {
      actionType: 'SET_PROCESS_SOCKET',
      data: ?string,
    }
  | {
      actionType: 'DEBUGGER_MODE_CHANGE',
      data: DebuggerModeType,
    }
  | {
      actionType: 'ADD_DEBUGGER_PROVIDER',
      data: NuclideDebuggerProvider,
    }
  | {
      actionType: 'REMOVE_DEBUGGER_PROVIDER',
      data: NuclideDebuggerProvider,
    }
  | {
      actionType: 'UPDATE_CONNECTIONS',
      data: Array<string>,
    }
  | {
      actionType: 'ADD_EVALUATION_EXPRESSION_PROVIDER',
      data: NuclideEvaluationExpressionProvider,
    }
  | {
      actionType: 'REMOVE_EVALUATION_EXPRESSION_PROVIDER',
      data: NuclideEvaluationExpressionProvider,
    }
  | {
      actionType: 'ADD_WATCH_EXPRESSION',
      data: {expression: string},
    }
  | {
      actionType: 'REMOVE_WATCH_EXPRESSION',
      data: {index: number},
    }
  | {
      actionType: 'UPDATE_WATCH_EXPRESSION',
      data: {index: number, newExpression: string},
    }
  | {
      actionType: 'TRIGGER_DEBUGGER_ACTION',
      data: {actionId: string},
    }
  | {
      actionType: 'ADD_REGISTER_EXECUTOR',
      data: () => IDisposable,
    }
  | {
      actionType: 'REMOVE_REGISTER_EXECUTOR',
      data: () => IDisposable,
    }
  | {
      actionType: 'REGISTER_CONSOLE',
      data: {},
    }
  | {
      actionType: 'UNREGISTER_CONSOLE',
      data: {},
    }
  | {
      actionType: 'UPDATE_CALLSTACK',
      data: {callstack: Callstack},
    }
  | {
      actionType: 'OPEN_DEV_TOOLS',
    }
  | {
      actionType: 'OPEN_SOURCE_LOCATION',
      data: {sourceURL: string, lineNumber: number},
    }
  | {
      actionType: 'CLEAR_INTERFACE',
      data: {},
    }
  | {
      actionType: 'SET_SELECTED_CALLFRAME_INDEX',
      data: {index: number},
    }
  | {
      actionType: 'SET_SELECTED_CALLFRAME_LINE',
      data: {options: ?{sourceURL: string, lineNumber: number}},
    }
  | {
      actionType: 'ADD_BREAKPOINT',
      data: {path: string, line: number},
    }
  | {
      actionType: 'UPDATE_BREAKPOINT_CONDITION',
      data: {breakpointId: number, condition: string},
    }
  | {
      actionType: 'UPDATE_BREAKPOINT_ENABLED',
      data: {breakpointId: number, enabled: boolean},
    }
  | {
      actionType: 'DELETE_BREAKPOINT',
      data: {path: string, line: number},
    }
  | {
      actionType: 'DELETE_ALL_BREAKPOINTS',
      data: {},
    }
  | {
      actionType: 'ENABLE_ALL_BREAKPOINTS',
      data: {},
    }
  | {
      actionType: 'DISABLE_ALL_BREAKPOINTS',
      data: {},
    }
  | {
      actionType: 'TOGGLE_BREAKPOINT',
      data: {path: string, line: number},
    }
  | {
      actionType: 'DELETE_BREAKPOINT_IPC',
      data: {path: string, line: number},
    }
  | {
      actionType: 'BIND_BREAKPOINT_IPC',
      data: {
        path: string,
        line: number,
        condition: string,
        enabled: boolean,
        resolved: boolean,
      },
    }
  | {
      actionType: 'UPDATE_SCOPES',
      data: Array<ScopeSection>,
    }
  | {
      actionType: 'TOGGLE_PAUSE_ON_EXCEPTION',
      data: boolean,
    }
  | {
      actionType: 'TOGGLE_PAUSE_ON_CAUGHT_EXCEPTION',
      data: boolean,
    }
  | {
      actionType: 'UPDATE_THREADS',
      data: {threadData: NuclideThreadData},
    }
  | {
      actionType: 'UPDATE_THREAD',
      data: {thread: ThreadItem},
    }
  | {
      actionType: 'UPDATE_STOP_THREAD',
      data: {id: number},
    }
  | {
      actionType: 'UPDATE_SELECTED_THREAD',
      data: {id: number},
    }
  | {
      actionType: 'NOTIFY_THREAD_SWITCH',
      data: {sourceURL: string, lineNumber: number, message: string},
    }
  | {
      actionType: 'TOGGLE_SINGLE_THREAD_STEPPING',
      data: boolean,
    }
  | {
      actionType: 'RECEIVED_EXPRESSION_EVALUATION_RESPONSE',
      data: {id: number, response: ExpressionResult},
    }
  | {
      actionType: 'RECEIVED_GET_PROPERTIES_RESPONSE',
      data: {id: number, response: GetPropertiesResult},
    }
  | {
      actionType: 'UPDATE_CUSTOM_CONTROL_BUTTONS',
      data: Array<ControlButtonSpecification>,
    }
  | {
      actionType: 'UPDATE_CONFIGURE_SOURCE_PATHS_CALLBACK',
      data: ?() => void,
    }
  | {
      actionType: 'CONFIGURE_SOURCE_PATHS',
    }
  | {
      actionType: 'SET_DEBUG_PROCESS_INFO',
      data: ?DebuggerProcessInfo,
    };

export const ActionTypes = Object.freeze({
  SET_DEBUGGER_INSTANCE: 'SET_DEBUGGER_INSTANCE',
  SET_ERROR: 'SET_ERROR',
  SET_PROCESS_SOCKET: 'SET_PROCESS_SOCKET',
  DEBUGGER_MODE_CHANGE: 'DEBUGGER_MODE_CHANGE',
  ADD_DEBUGGER_PROVIDER: 'ADD_DEBUGGER_PROVIDER',
  REMOVE_DEBUGGER_PROVIDER: 'REMOVE_DEBUGGER_PROVIDER',
  UPDATE_CONNECTIONS: 'UPDATE_CONNECTIONS',
  ADD_EVALUATION_EXPRESSION_PROVIDER: 'ADD_EVALUATION_EXPRESSION_PROVIDER',
  REMOVE_EVALUATION_EXPRESSION_PROVIDER: 'REMOVE_EVALUATION_EXPRESSION_PROVIDER',
  ADD_WATCH_EXPRESSION: 'ADD_WATCH_EXPRESSION',
  REMOVE_WATCH_EXPRESSION: 'REMOVE_WATCH_EXPRESSION',
  UPDATE_WATCH_EXPRESSION: 'UPDATE_WATCH_EXPRESSION',
  TRIGGER_DEBUGGER_ACTION: 'TRIGGER_DEBUGGER_ACTION',
  ADD_REGISTER_EXECUTOR: 'ADD_REGISTER_EXECUTOR',
  REMOVE_REGISTER_EXECUTOR: 'REMOVE_REGISTER_EXECUTOR',
  REGISTER_CONSOLE: 'REGISTER_CONSOLE',
  UNREGISTER_CONSOLE: 'UNREGISTER_CONSOLE',
  OPEN_DEV_TOOLS: 'OPEN_DEV_TOOLS',
  OPEN_SOURCE_LOCATION: 'OPEN_SOURCE_LOCATION',
  CLEAR_INTERFACE: 'CLEAR_INTERFACE',
  UPDATE_CALLSTACK: 'UPDATE_CALLSTACK',
  SET_SELECTED_CALLFRAME_INDEX: 'SET_SELECTED_CALLFRAME_INDEX',
  SET_SELECTED_CALLFRAME_LINE: 'SET_SELECTED_CALLFRAME_LINE',
  ADD_BREAKPOINT: 'ADD_BREAKPOINT',
  UPDATE_BREAKPOINT_CONDITION: 'UPDATE_BREAKPOINT_CONDITION',
  UPDATE_BREAKPOINT_ENABLED: 'UPDATE_BREAKPOINT_ENABLED',
  DELETE_BREAKPOINT: 'DELETE_BREAKPOINT',
  DELETE_ALL_BREAKPOINTS: 'DELETE_ALL_BREAKPOINTS',
  ENABLE_ALL_BREAKPOINTS: 'ENABLE_ALL_BREAKPOINTS',
  DISABLE_ALL_BREAKPOINTS: 'DISABLE_ALL_BREAKPOINTS',
  TOGGLE_BREAKPOINT: 'TOGGLE_BREAKPOINT',
  DELETE_BREAKPOINT_IPC: 'DELETE_BREAKPOINT_IPC',
  BIND_BREAKPOINT_IPC: 'BIND_BREAKPOINT_IPC',
  UPDATE_SCOPES: 'UPDATE_SCOPES',
  TOGGLE_PAUSE_ON_EXCEPTION: 'TOGGLE_PAUSE_ON_EXCEPTION',
  TOGGLE_PAUSE_ON_CAUGHT_EXCEPTION: 'TOGGLE_PAUSE_ON_CAUGHT_EXCEPTION',
  UPDATE_THREADS: 'UPDATE_THREADS',
  UPDATE_THREAD: 'UPDATE_THREAD',
  UPDATE_STOP_THREAD: 'UPDATE_STOP_THREAD',
  UPDATE_SELECTED_THREAD: 'UPDATE_SELECTED_THREAD',
  NOTIFY_THREAD_SWITCH: 'NOTIFY_THREAD_SWITCH',
  TOGGLE_SINGLE_THREAD_STEPPING: 'TOGGLE_SINGLE_THREAD_STEPPING',
  RECEIVED_EXPRESSION_EVALUATION_RESPONSE: 'RECEIVED_EXPRESSION_EVALUATION_RESPONSE',
  RECEIVED_GET_PROPERTIES_RESPONSE: 'RECEIVED_GET_PROPERTIES_RESPONSE',
  UPDATE_CUSTOM_CONTROL_BUTTONS: 'UPDATE_CUSTOM_CONTROL_BUTTONS',
  UPDATE_CONFIGURE_SOURCE_PATHS_CALLBACK: 'UPDATE_CONFIGURE_SOURCE_PATHS_CALLBACK',
  CONFIGURE_SOURCE_PATHS: 'CONFIGURE_SOURCE_PATHS',
  SET_DEBUG_PROCESS_INFO: 'SET_DEBUG_PROCESS_INFO',
});

// Flow hack: Every DebuggerAction actionType must be in ActionTypes.
(('': $PropertyType<DebuggerAction, 'actionType'>): $Keys<typeof ActionTypes>);

export default class DebuggerDispatcher extends Dispatcher<DebuggerAction> {}
