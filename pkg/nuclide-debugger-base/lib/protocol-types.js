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

/** Unique script identifier. */
export type ScriptId = string;

/** Unique object identifier. */
export type RemoteObjectId = string;

/** Mirror object referencing original JavaScript object. */
// description wins over value in display
export type RemoteObject = {
  /** Object type. */
  type:
    | 'object'
    | 'function'
    | 'undefined'
    | 'string'
    | 'number'
    | 'boolean'
    | 'symbol'
    | 'text',
  /** Object subtype hint. Specified for 'object' type values only. */
  subtype?:
    | 'array'
    | 'null'
    | 'node'
    | 'regexp'
    | 'date'
    | 'map'
    | 'set'
    | 'iterator'
    | 'generator'
    | 'error'
    | 'proxy'
    | 'promise'
    | 'typedarray',
  /** Object class (constructor) name. Specified for 'object' type values only. */
  className?: string,

  /** Remote object value in case of primitive values or JSON values (if it was requested). */
  value?: any,

  /** String representation of the object. */
  description?: string,

  /** Unique object identifier (for non-primitive values). */
  objectId?: RemoteObjectId,
};

/** Object property descriptor. */
export type PropertyDescriptor = {
  /** Property name or symbol description. */
  name: string,

  /** The value associated with the property. */
  value?: RemoteObject,

  /** True if the value associated with the property may be changed (data descriptors only). */
  writable?: boolean,

  /** A function which serves as a getter for the property, or 'undefined' if there is no getter (accessor descriptors only). */
  get?: RemoteObject,

  /** A function which serves as a setter for the property, or 'undefined' if there is no setter (accessor descriptors only). */
  set?: RemoteObject,

  /** True if the type of this property descriptor may be changed and if the property may be deleted from the corresponding object. */
  configurable: boolean,

  /** True if this property shows up during enumeration of the properties on the corresponding object. */
  enumerable: boolean,

  /** True if the result was thrown during the evaluation. */
  wasThrown?: boolean,

  /** True if the property is owned for the object. */
  isOwn?: boolean,

  /** Property symbol object, if the property is of the 'symbol' type. */
  symbol?: RemoteObject,
};

/** Represents function call argument. Either remote object id 'objectId</code>, primitive <code>value', unserializable primitive value or neither of (for undefined) them should be specified. */
export type CallArgument = {
  /** Primitive value. */
  value?: any,

  /** Primitive value which can not be JSON-stringified. */
  // unserializableValue?: UnserializableValue,

  /** Remote object handle. */
  objectId?: RemoteObjectId,
};

/** Id of an execution context. */
export type ExecutionContextId = number;

/** Number of milliseconds since epoch. */
export type Timestamp = number;

/** Call frames for assertions or error messages. */
export type StackTrace = {
  /** String label of this stack trace. For async traces this may be a name of the function that initiated the async call. */
  description?: string,

  /** JavaScript function name. */
  callFrames: CallFrame[],

  /** Asynchronous JavaScript stack trace that preceded this stack, if available. */
  parent?: StackTrace,
};

/** Detailed information about exception (or error) that was thrown during script compilation or execution. */
export type ExceptionDetails = {
  /** Exception id. */
  exceptionId: number,

  /** Exception text, which should be used together with exception object when available. */
  text: string,

  /** Line number of the exception location (0-based). */
  lineNumber: number,

  /** Column number of the exception location (0-based). */
  columnNumber: number,

  /** Script ID of the exception location. */
  scriptId?: ScriptId,

  /** URL of the exception location, to be used when the script was not reported. */
  url?: string,

  /** JavaScript stack trace if available. */
  stackTrace?: StackTrace,

  /** Exception object if available. */
  exception?: RemoteObject,

  /** Identifier of the context where exception happened. */
  executionContextId?: ExecutionContextId,
};

export type EvaluateRequest = {
  /** Expression to evaluate. */
  expression: string,

  /** Symbolic group name that can be used to release multiple objects. */
  objectGroup?: string,

  /** Determines whether Command Line API should be available during the evaluation. */
  includeCommandLineAPI?: boolean,

  /** In silent mode exceptions thrown during evaluation are not reported and do not pause execution. Overrides 'setPauseOnException' state. */
  silent?: boolean,

  /** Specifies in which execution context to perform evaluation. If the parameter is omitted the evaluation will be performed in the context of the inspected page. */
  contextId?: ExecutionContextId,

  /** Whether the result is expected to be a JSON object that should be sent by value. */
  returnByValue?: boolean,

  /** Whether preview should be generated for the result. */
  generatePreview?: boolean,

  /** Whether execution should be treated as initiated by user in the UI. */
  userGesture?: boolean,

  /** Whether execution should wait for promise to be resolved. If the result of evaluation is not a Promise, it's considered to be an error. */
  awaitPromise?: boolean,
};

export type EvaluateResponse = {
  /** Evaluation result. */
  result: RemoteObject,

  /** True if the result was thrown during the evaluation. */
  wasThrown?: boolean,

  /** Exception details. */
  exceptionDetails?: ExceptionDetails,
};

export type GetPropertiesRequest = {
  /** Identifier of the object to return properties for. */
  objectId: RemoteObjectId,

  /** If true, returns properties belonging only to the element itself, not to its prototype chain. */
  ownProperties?: boolean,

  /** If true, returns accessor properties (with getter/setter) only; internal properties are not returned either. */
  accessorPropertiesOnly?: boolean,

  /** Whether preview should be generated for the results. */
  generatePreview?: boolean,
};

export type GetPropertiesResponse = {
  /** Object properties. */
  result: PropertyDescriptor[],

  /** Internal object properties (only of the element itself). */
  // internalProperties?: InternalPropertyDescriptor[],

  /** Exception details. */
  exceptionDetails?: ExceptionDetails,
};

export type ExceptionThrownEvent = {
  /** Timestamp of the exception. */
  timestamp: Timestamp,

  exceptionDetails: ExceptionDetails,
};

//------------------------------------------------------------------------------
// Debugger domain types.
//------------------------------------------------------------------------------

/** Breakpoint identifier. */
export type BreakpointId = string;

/** Call frame identifier. */
export type CallFrameId = string;

/** Location in the source code. */
export type Location = {
  /** Script identifier as reported in the 'Debugger.scriptParsed'. */
  scriptId: ScriptId,

  /** Line number in the script (0-based). */
  lineNumber: number,

  /** Column number in the script (0-based). */
  columnNumber?: number,
};

/** JavaScript call frame. Array of call frames form the call stack. */
export type CallFrame = {
  /** Call frame identifier. This identifier is only valid while the virtual machine is paused. */
  callFrameId: CallFrameId,

  /** Name of the JavaScript function called on this call frame. */
  functionName: string,

  /** Location in the source code. */
  functionLocation?: Location,

  /** Location in the source code. */
  location: Location,

  /** Whether this frame has source code or not. */
  hasSource?: boolean,

  /** Scope chain for this call frame. */
  scopeChain: Scope[],

  /** 'this' object for this call frame. */
  this: RemoteObject,

  /** The value being returned, if the function is at return point. */
  returnValue?: RemoteObject,
};

/** Scope description. */
// scope.object.description shows on RHS
export type Scope = {
  /** Scope type. */
  type: string,
  // type: ScopeType,

  /** Object representing the scope. For 'global</code> and <code>with' scopes it represents the actual object; for the rest of the scopes, it is artificial transient object enumerating scope variables as its properties. */
  object: RemoteObject,

  name?: string,

  /** Location in the source code where scope starts */
  startLocation?: Location,

  /** Location in the source code where scope ends */
  endLocation?: Location,
};

export type ScopeType =
  | 'catch'
  | 'closure'
  | 'global'
  | 'local'
  | 'with'
  | 'block'
  | 'script';

export type SetBreakpointByUrlRequest = {
  /** Line number to set breakpoint at. */
  lineNumber: number,

  /** URL of the resources to set breakpoint on. */
  url: string,

  /** Regex pattern for the URLs of the resources to set breakpoints on. Either 'url</code> or <code>urlRegex' must be specified. */
  urlRegex?: string,

  /** Offset in the line to set breakpoint at. */
  columnNumber?: number,

  /** Expression to use as a breakpoint condition. When specified, debugger will only stop on the breakpoint if this expression evaluates to true. */
  condition?: string,
};

export type SetBreakpointByUrlResponse = {
  /** Id of the created breakpoint for further reference. */
  breakpointId: BreakpointId,

  /** List of the locations this breakpoint resolved into upon addition. */
  locations: Location[],

  /** Whether the breakpoint is resolved or not. */
  resolved?: boolean,
};

export type RemoveBreakpointRequest = {
  breakpointId: BreakpointId,
};

export type ContinueToLocationRequest = {
  /** Location to continue to. */
  location: Location,
};

export type GetScriptSourceRequest = {
  /** Id of the script to get source for. */
  scriptId: ScriptId,
};

export type GetScriptSourceResponse = {
  /** Script source. */
  scriptSource: string,
};

export type SetPauseOnExceptionsRequest = {
  /** Pause on exceptions mode. */
  state: 'none' | 'uncaught' | 'all',
};

export type EvaluateOnCallFrameRequest = {
  /** Call frame identifier to evaluate on. */
  callFrameId: CallFrameId,

  /** Expression to evaluate. */
  expression: string,

  /** String object group name to put result into (allows rapid releasing resulting object handles using 'releaseObjectGroup'). */
  objectGroup?: string,

  /** Specifies whether command line API should be available to the evaluated expression, defaults to false. */
  includeCommandLineAPI?: boolean,

  /** In silent mode exceptions thrown during evaluation are not reported and do not pause execution. Overrides 'setPauseOnException' state. */
  silent?: boolean,

  /** Whether the result is expected to be a JSON object that should be sent by value. */
  returnByValue?: boolean,

  /** Whether preview should be generated for the result. */
  generatePreview?: boolean,
};

export type EvaluateOnCallFrameResponse = {
  /** Object wrapper for the evaluation result. */
  result: RemoteObject,

  /** True if the result was thrown during the evaluation. */
  wasThrown?: boolean,

  /** Exception details. */
  exceptionDetails?: ExceptionDetails,
};

export type SetVariableValueRequest = {
  /** 0-based number of scope as was listed in scope chain. Only 'local', 'closure' and 'catch' scope types are allowed. Other scopes could be manipulated manually. */
  scopeNumber: number,

  /** Variable name. */
  variableName: string,

  /** New variable value. */
  newValue: CallArgument,

  /** Id of callframe that holds variable. */
  callFrameId: CallFrameId,

  /** Object id of closure (function) that holds variable. */
  functionObjectId: RemoteObjectId,
};

export type BreakpointResolvedEvent = {
  /** Breakpoint unique identifier. */
  breakpointId: BreakpointId,

  /** Actual breakpoint location. */
  location: Location,
};

export type PausedEvent = {
  /** Call stack the virtual machine stopped on. */
  callFrames: CallFrame[],

  /** Pause reason. */
  reason: string,
  // | 'XHR'
  // | 'DOM'
  // | 'EventListener'
  // | 'exception'
  // | 'assert'
  // | 'debugCommand'
  // | 'promiseRejection'
  // | 'other',

  /** The message to be shown to the user when the thread changes. */
  threadSwitchMessage?: ?string,

  /** Object containing break-specific auxiliary properties. */
  data?: any,

  /** ID of the stopped thread. */
  stopThreadId?: number,

  /** Hit breakpoints IDs */
  hitBreakpoints?: BreakpointId[],

  /** Async stack trace, if any. */
  asyncStackTrace?: StackTrace,
};

export type ScriptParsedEvent = {
  /** Identifier of the script parsed. */
  scriptId: ScriptId,

  /** URL or name of the script parsed (if any). */
  url: string,

  /** Line offset of the script within the resource with given URL (for script tags). */
  startLine: number,

  /** Column offset of the script within the resource with given URL. */
  startColumn: number,

  /** Last line of the script. */
  endLine: number,

  /** Length of the last line of the script. */
  endColumn: number,

  /** Specifies script creation context. */
  executionContextId: ExecutionContextId,

  /** Content hash of the script. */
  hash: string,

  /** Embedder-specific auxiliary data. */
  executionContextAuxData?: any,

  /** True, if this script is generated as a result of the live edit operation. */
  isLiveEdit?: boolean,

  /** URL of source map associated with script (if any). */
  sourceMapURL?: string,

  /** True, if this script has sourceURL. */
  hasSourceURL?: boolean,
};

export type ThreadsUpdatedEvent = {
  /** Process unique identifier. */
  owningProcessId: number,

  /** Unique identifier of the thread caused process to stop. */
  stopThreadId: number,

  /** List of threads. */
  threads: Thread[],
};

// Currently PHP only.
export type ThreadUpdatedEvent = {
  thread: Thread,
};

export type Thread = {
  id: number,
  name: ?string,
  /** Thread top frame address. */
  address: string,
  /** Thread current location in the source code. */
  location: Location,
  /** Thread stop reason if any. */
  stopReason: string,
  /** Description of the thread. */
  description: string,
  /** Wether the stop location has source. */
  hasSource: boolean,
};

export type SelectThreadRequest = {
  /** Switch to a different thread context. */
  threadId: number,
};

export type GetThreadStackRequest = {
  /** Target thread id. */
  threadId: number,
};

export type GetThreadStackResponse = {
  /** Target thread id. */
  callFrames: CallFrame[],
};

export type ExecutionContextCreatedEvent = {
  /** A newly created execution context. */
  context: ExecutionContextDescription,
};

/** Description of an isolated world. */
export type ExecutionContextDescription = {
  /** Unique id of the execution context. It can be used to specify in which execution context script evaluation should be performed. */
  id: ExecutionContextId,

  /** Execution context origin. */
  origin: string,

  /** Id of the owning frame. May be an empty string if the context is not associated with a frame. */
  frameId: string,

  /** Human readable name describing given context. */
  name: string,
};

export type SetDebuggerSettingsRequest = {
  singleThreadStepping?: boolean,
};

export type DebuggerCommand =
  | {
      id: number,
      method: 'Debugger.enable',
    }
  | {
      id: number,
      method: 'Debugger.setBreakpointByUrl',
      params: SetBreakpointByUrlRequest,
    }
  | {
      id: number,
      method: 'Debugger.removeBreakpoint',
      params: RemoveBreakpointRequest,
    }
  | {
      id: number,
      method: 'Debugger.resume',
    }
  | {
      id: number,
      method: 'Debugger.stepOver',
    }
  | {
      id: number,
      method: 'Debugger.stepInto',
    }
  | {
      id: number,
      method: 'Debugger.stepOut',
    }
  | {
      id: number,
      method: 'Debugger.continueToLocation',
      params: ContinueToLocationRequest,
    }
  | {
      id: number,
      method: 'Debugger.evaluateOnCallFrame',
      params: EvaluateOnCallFrameRequest,
    }
  | {
      id: number,
      method: 'Debugger.setVariableValue',
      params: SetVariableValueRequest,
    }
  | {
      id: number,
      method: 'Debugger.setPauseOnExceptions',
      params: SetPauseOnExceptionsRequest,
    }
  | {
      id: number,
      method: 'Debugger.getScriptSource',
      params: GetScriptSourceRequest,
    }
  | {
      id: number,
      method: 'Debugger.skipStackFrames',
    }
  | {
      id: number,
      method: 'Debugger.setAsyncCallStackDepth',
    }
  | {
      id: number,
      method: 'Debugger.selectThread',
      params: SelectThreadRequest,
    }
  | {
      id: number,
      method: 'Debugger.getThreadStack',
      params: GetThreadStackRequest,
    }
  | {
      id: number,
      method: 'Debugger.setDebuggerSettings',
      params: SetDebuggerSettingsRequest,
    }
  | {
      id: number,
      method: 'Runtime.enable',
    }
  | {
      id: number,
      method: 'Runtime.getProperties',
      params: GetPropertiesRequest,
    }
  | {
      id: number,
      method: 'Runtime.evaluate',
      params: EvaluateRequest,
    };

export type DebuggerResponse =
  | {id: number, result: {||}}
  | {id: number, error: any}
  | {
      id: number,
      // method: 'Debugger.setBreakpointByUrl',
      result: SetBreakpointByUrlResponse,
    }
  | {
      id: number,
      // method: 'Debugger.evaluateOnCallFrame',
      result: EvaluateOnCallFrameResponse,
    }
  | {
      id: number,
      // method: 'Runtime.getProperties',
      result: GetPropertiesResponse,
    }
  | {
      id: number,
      // method: 'Runtime.evaluate',
      result: EvaluateResponse,
    }
  | {
      id: number,
      // method: 'Debugger.getScriptSource',
      result: GetScriptSourceResponse,
    }
  | {
      id: number,
      // method: 'Debugger.getThreadStack',
      result: GetThreadStackResponse,
    };

export type DebuggerEvent =
  | {
      method: 'Debugger.paused',
      params: PausedEvent,
    }
  | {
      method: 'Debugger.resumed',
    }
  | {
      method: 'Debugger.breakpointResolved',
      params: BreakpointResolvedEvent,
    }
  | {
      method: 'Debugger.threadUpdated',
      params: ThreadUpdatedEvent,
    }
  | {
      method: 'Debugger.threadsUpdated',
      params: ThreadsUpdatedEvent,
    }
  | {
      id: number,
      method: 'Runtime.executionContextCreated',
      params: ExecutionContextCreatedEvent,
    };
