"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.MessageMarshaller = undefined;

var _DebugMessage = require("./DebugMessage.js");

var _invariant = require("./../invariant.js");

var _invariant2 = _interopRequireDefault(_invariant);

var _DebuggerError = require("./../DebuggerError.js");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

class MessageMarshaller {
  constructor() {
    this._lastRunRequestID = 0;
  }


  marshallBreakpointAcknowledge(requestID, messageType, breakpoints) {
    return `${requestID} ${messageType} ${JSON.stringify(breakpoints)}`;
  }

  marshallStoppedResponse(reason, filePath, line, column, message) {
    let result = {
      kind: "stopped",
      reason: reason,
      filePath: filePath,
      line: line,
      column: column,
      message: message
    };
    return `${this._lastRunRequestID} ${_DebugMessage.DebugMessage.STOPPED_RESPONSE} ${JSON.stringify(result)}`;
  }

  marshallDebuggerStart(requestID) {
    return `${requestID} ${_DebugMessage.DebugMessage.DEBUGGER_ATTACHED}`;
  }

  marshallContinueRequest(requestID) {
    return `${requestID} ${_DebugMessage.DebugMessage.PREPACK_RUN_COMMAND}`;
  }

  marshallSetBreakpointsRequest(requestID, breakpoints) {
    return `${requestID} ${_DebugMessage.DebugMessage.BREAKPOINT_ADD_COMMAND} ${JSON.stringify(breakpoints)}`;
  }

  marshallStackFramesRequest(requestID) {
    return `${requestID} ${_DebugMessage.DebugMessage.STACKFRAMES_COMMAND}`;
  }

  marshallStackFramesResponse(requestID, stackframes) {
    return `${requestID} ${_DebugMessage.DebugMessage.STACKFRAMES_RESPONSE} ${JSON.stringify(stackframes)}`;
  }

  marshallScopesRequest(requestID, frameId) {
    return `${requestID} ${_DebugMessage.DebugMessage.SCOPES_COMMAND} ${frameId}`;
  }

  marshallScopesResponse(requestID, scopes) {
    return `${requestID} ${_DebugMessage.DebugMessage.SCOPES_RESPONSE} ${JSON.stringify(scopes)}`;
  }

  marshallVariablesRequest(requestID, variablesReference) {
    return `${requestID} ${_DebugMessage.DebugMessage.VARIABLES_COMMAND} ${variablesReference}`;
  }

  marshallVariablesResponse(requestID, variables) {
    return `${requestID} ${_DebugMessage.DebugMessage.VARIABLES_RESPONSE} ${JSON.stringify(variables)}`;
  }

  marshallStepIntoRequest(requestID) {
    return `${requestID} ${_DebugMessage.DebugMessage.STEPINTO_COMMAND}`;
  }

  marshallStepOverRequest(requestID) {
    return `${requestID} ${_DebugMessage.DebugMessage.STEPOVER_COMMAND}`;
  }

  marshallStepOutRequest(requestID) {
    return `${requestID} ${_DebugMessage.DebugMessage.STEPOUT_COMMAND}`;
  }

  marshallEvaluateRequest(requestID, frameId, expression) {
    let evalArgs = {
      kind: "evaluate",
      expression: expression
    };
    if (frameId !== undefined) {
      evalArgs.frameId = frameId;
    }
    return `${requestID} ${_DebugMessage.DebugMessage.EVALUATE_COMMAND} ${JSON.stringify(evalArgs)}`;
  }

  marshallEvaluateResponse(requestID, evalResult) {
    return `${requestID} ${_DebugMessage.DebugMessage.EVALUATE_RESPONSE} ${JSON.stringify(evalResult)}`;
  }

  unmarshallRequest(message) {
    let parts = message.split(" ");
    // each request must have a length and a command
    (0, _invariant2.default)(parts.length >= 2, "Request is not well formed");
    // unique ID for each request
    let requestID = parseInt(parts[0], 10);
    (0, _invariant2.default)(!isNaN(requestID), "Request ID must be a number");
    let command = parts[1];
    let args;
    switch (command) {
      case _DebugMessage.DebugMessage.PREPACK_RUN_COMMAND:
        this._lastRunRequestID = requestID;
        let runArgs = {
          kind: "run"
        };
        args = runArgs;
        break;
      case _DebugMessage.DebugMessage.BREAKPOINT_ADD_COMMAND:
        args = this._unmarshallBreakpointsArguments(requestID, parts.slice(2).join(" "));
        break;
      case _DebugMessage.DebugMessage.STACKFRAMES_COMMAND:
        let stackFrameArgs = {
          kind: "stackframe"
        };
        args = stackFrameArgs;
        break;
      case _DebugMessage.DebugMessage.SCOPES_COMMAND:
        args = this._unmarshallScopesArguments(requestID, parts[2]);
        break;
      case _DebugMessage.DebugMessage.VARIABLES_COMMAND:
        args = this._unmarshallVariablesArguments(requestID, parts[2]);
        break;
      case _DebugMessage.DebugMessage.STEPINTO_COMMAND:
        this._lastRunRequestID = requestID;
        let stepIntoArgs = {
          kind: "stepInto"
        };
        args = stepIntoArgs;
        break;
      case _DebugMessage.DebugMessage.STEPOVER_COMMAND:
        this._lastRunRequestID = requestID;
        let stepOverArgs = {
          kind: "stepOver"
        };
        args = stepOverArgs;
        break;
      case _DebugMessage.DebugMessage.STEPOUT_COMMAND:
        this._lastRunRequestID = requestID;
        let stepOutArgs = {
          kind: "stepOut"
        };
        args = stepOutArgs;
        break;
      case _DebugMessage.DebugMessage.EVALUATE_COMMAND:
        args = this._unmarshallEvaluateArguments(requestID, parts.slice(2).join(" "));
        break;
      default:
        throw new _DebuggerError.DebuggerError("Invalid command", "Invalid command from adapter: " + command);
    }
    (0, _invariant2.default)(args !== undefined);
    let result = {
      id: requestID,
      command: command,
      arguments: args
    };
    return result;
  }

  _unmarshallBreakpointsArguments(requestID, responseString) {
    let breakpoints = JSON.parse(responseString);
    for (const breakpoint of breakpoints) {
      (0, _invariant2.default)(breakpoint.hasOwnProperty("filePath"), "breakpoint missing filePath property");
      (0, _invariant2.default)(breakpoint.hasOwnProperty("line"), "breakpoint missing line property");
      (0, _invariant2.default)(breakpoint.hasOwnProperty("column"), "breakpoint missing column property");
      (0, _invariant2.default)(!isNaN(breakpoint.line));
      (0, _invariant2.default)(!isNaN(breakpoint.column));
    }
    let result = {
      kind: "breakpoint",
      breakpoints: breakpoints
    };
    return result;
  }

  _unmarshallScopesArguments(requestID, responseString) {
    let frameId = parseInt(responseString, 10);
    (0, _invariant2.default)(!isNaN(frameId));
    let result = {
      kind: "scopes",
      frameId: frameId
    };
    return result;
  }

  _unmarshallVariablesArguments(requestID, responseString) {
    let varRef = parseInt(responseString, 10);
    (0, _invariant2.default)(!isNaN(varRef));
    let result = {
      kind: "variables",
      variablesReference: varRef
    };
    return result;
  }

  _unmarshallEvaluateArguments(requestID, responseString) {
    let evalArgs = JSON.parse(responseString);
    (0, _invariant2.default)(evalArgs.hasOwnProperty("kind"), "Evaluate arguments missing kind field");
    (0, _invariant2.default)(evalArgs.hasOwnProperty("expression"), "Evaluate arguments missing expression field");
    if (evalArgs.hasOwnProperty("frameId")) (0, _invariant2.default)(!isNaN(evalArgs.frameId));
    return evalArgs;
  }

  unmarshallResponse(message) {
    try {
      let parts = message.split(" ");
      let requestID = parseInt(parts[0], 10);
      (0, _invariant2.default)(!isNaN(requestID));
      let messageType = parts[1];
      let dbgResult;
      let resultString = parts.slice(2).join(" ");
      if (messageType === _DebugMessage.DebugMessage.PREPACK_READY_RESPONSE) {
        dbgResult = this._unmarshallReadyResult();
      } else if (messageType === _DebugMessage.DebugMessage.BREAKPOINT_ADD_ACKNOWLEDGE) {
        dbgResult = this._unmarshallBreakpointsAddResult(resultString);
      } else if (messageType === _DebugMessage.DebugMessage.STOPPED_RESPONSE) {
        dbgResult = this._unmarshallStoppedResult(resultString);
      } else if (messageType === _DebugMessage.DebugMessage.STACKFRAMES_RESPONSE) {
        dbgResult = this._unmarshallStackframesResult(resultString);
      } else if (messageType === _DebugMessage.DebugMessage.SCOPES_RESPONSE) {
        dbgResult = this._unmarshallScopesResult(resultString);
      } else if (messageType === _DebugMessage.DebugMessage.VARIABLES_RESPONSE) {
        dbgResult = this._unmarshallVariablesResult(resultString);
      } else if (messageType === _DebugMessage.DebugMessage.EVALUATE_RESPONSE) {
        dbgResult = this._unmarshallEvaluateResult(resultString);
      } else {
        (0, _invariant2.default)(false, "Unexpected response type");
      }

      let dbgResponse = {
        id: requestID,
        result: dbgResult
      };
      return dbgResponse;
    } catch (e) {
      throw new _DebuggerError.DebuggerError("Invalid command", e.message);
    }
  }

  _unmarshallStackframesResult(resultString) {
    let frames = JSON.parse(resultString);
    (0, _invariant2.default)(Array.isArray(frames), "Stack frames is not an array");
    for (const frame of frames) {
      (0, _invariant2.default)(frame.hasOwnProperty("id"), "Stack frame is missing id");
      (0, _invariant2.default)(frame.hasOwnProperty("fileName"), "Stack frame is missing filename");
      (0, _invariant2.default)(frame.hasOwnProperty("line"), "Stack frame is missing line number");
      (0, _invariant2.default)(frame.hasOwnProperty("column"), "Stack frame is missing column number");
      (0, _invariant2.default)(frame.hasOwnProperty("functionName"), "Stack frame is missing function name");
    }
    let result = {
      kind: "stackframe",
      stackframes: frames
    };
    return result;
  }

  _unmarshallScopesResult(resultString) {
    let scopes = JSON.parse(resultString);
    (0, _invariant2.default)(Array.isArray(scopes), "Scopes is not an array");
    for (const scope of scopes) {
      (0, _invariant2.default)(scope.hasOwnProperty("name"), "Scope is missing name");
      (0, _invariant2.default)(scope.hasOwnProperty("variablesReference"), "Scope is missing variablesReference");
      (0, _invariant2.default)(scope.hasOwnProperty("expensive"), "Scope is missing expensive");
    }
    let result = {
      kind: "scopes",
      scopes: scopes
    };
    return result;
  }

  _unmarshallVariablesResult(resultString) {
    let variables = JSON.parse(resultString);
    (0, _invariant2.default)(Array.isArray(variables), "Variables is not an array");
    for (const variable of variables) {
      (0, _invariant2.default)(variable.hasOwnProperty("name"));
      (0, _invariant2.default)(variable.hasOwnProperty("value"));
      (0, _invariant2.default)(variable.hasOwnProperty("variablesReference"));
    }
    let result = {
      kind: "variables",
      variables: variables
    };
    return result;
  }

  _unmarshallEvaluateResult(resultString) {
    let evalResult = JSON.parse(resultString);
    (0, _invariant2.default)(evalResult.hasOwnProperty("kind"), "eval result missing kind property");
    (0, _invariant2.default)(evalResult.kind === "evaluate", "eval result is the wrong kind");
    (0, _invariant2.default)(evalResult.hasOwnProperty("displayValue", "eval result missing display value property"));
    (0, _invariant2.default)(evalResult.hasOwnProperty("type", "eval result missing type property"));
    (0, _invariant2.default)(evalResult.hasOwnProperty("variablesReference", "eval result missing variablesReference property"));
    return evalResult;
  }

  _unmarshallBreakpointsAddResult(resultString) {
    let breakpoints = JSON.parse(resultString);
    (0, _invariant2.default)(Array.isArray(breakpoints));
    for (const breakpoint of breakpoints) {
      (0, _invariant2.default)(breakpoint.hasOwnProperty("filePath"), "breakpoint missing filePath property");
      (0, _invariant2.default)(breakpoint.hasOwnProperty("line"), "breakpoint missing line property");
      (0, _invariant2.default)(breakpoint.hasOwnProperty("column"), "breakpoint missing column property");
      (0, _invariant2.default)(!isNaN(breakpoint.line));
      (0, _invariant2.default)(!isNaN(breakpoint.column));
    }

    let result = {
      kind: "breakpoint-add",
      breakpoints: breakpoints
    };
    return result;
  }

  _unmarshallStoppedResult(resultString) {
    let result = JSON.parse(resultString);
    (0, _invariant2.default)(result.kind === "stopped");
    (0, _invariant2.default)(result.hasOwnProperty("reason"));
    (0, _invariant2.default)(result.hasOwnProperty("filePath"));
    (0, _invariant2.default)(result.hasOwnProperty("line"));
    (0, _invariant2.default)(!isNaN(result.line));
    (0, _invariant2.default)(result.hasOwnProperty("column"));
    (0, _invariant2.default)(!isNaN(result.column));
    return result;
  }

  _unmarshallReadyResult() {
    let result = {
      kind: "ready"
    };
    return result;
  }
}
exports.MessageMarshaller = MessageMarshaller; /**
                                                * Copyright (c) 2017-present, Facebook, Inc.
                                                * All rights reserved.
                                                *
                                                * This source code is licensed under the BSD-style license found in the
                                                * LICENSE file in the root directory of this source tree. An additional grant
                                                * of patent rights can be found in the PATENTS file in the same directory.
                                                */

/*  strict-local */
//# sourceMappingURL=MessageMarshaller.js.map