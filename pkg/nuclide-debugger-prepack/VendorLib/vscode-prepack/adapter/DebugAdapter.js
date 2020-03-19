"use strict";

var _vscodeDebugadapter = require("vscode-debugadapter");

var _vscodeDebugprotocol = require("vscode-debugprotocol");

var DebugProtocol = _interopRequireWildcard(_vscodeDebugprotocol);

var _AdapterChannel = require("./channel/AdapterChannel.js");

var _invariant = require("./../common/invariant.js");

var _invariant2 = _interopRequireDefault(_invariant);

var _DebugMessage = require("./../common/channel/DebugMessage.js");

var _DebuggerConstants = require("./../common/DebuggerConstants.js");

var _DebuggerError = require("./../common/DebuggerError.js");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

/* An implementation of an debugger adapter adhering to the VSCode Debug protocol
 * The adapter is responsible for communication between the UI and Prepack
*/
class PrepackDebugSession extends _vscodeDebugadapter.DebugSession {
  /**
   * Creates a new debug adapter that is used for one debug session.
   * We configure the default implementation of a debug adapter here.
   */
  constructor() {
    super();
    this.setDebuggerLinesStartAt1(true);
    this.setDebuggerColumnsStartAt1(true);
  }


  _generateDebugFilePath(direction) {
    let time = Date.now();
    let filePath = "/tmp/";
    if (direction === "in") {
      filePath += `prepack-debug-engine2adapter-${time}.txt`;
    } else {
      filePath += `prepack-debug-adapter2engine-${time}.txt`;
    }
    return filePath;
  }

  _registerMessageCallbacks() {
    this._ensureAdapterChannelCreated("registerMessageCallbacks");
    (0, _invariant2.default)(this._adapterChannel !== undefined, "Adapter Channel used before it was created, in debugger.");
    // Create local copy to ensure external functions don't modify the adapterChannel, satisfy flow.
    let localCopyAdapterChannel = this._adapterChannel;
    localCopyAdapterChannel.registerChannelEvent(_DebugMessage.DebugMessage.STOPPED_RESPONSE, response => {
      let result = response.result;
      (0, _invariant2.default)(result.kind === "stopped");
      let message = `${result.reason}: ${result.filePath} ${result.line}:${result.column}`;
      // Append message if there exists one (for Prepack errors)
      if (result.message !== undefined) {
        message += `. ${result.message}`;
      }
      this.sendEvent(new _vscodeDebugadapter.StoppedEvent(message, _DebuggerConstants.DebuggerConstants.PREPACK_THREAD_ID));
    });
    localCopyAdapterChannel.registerChannelEvent(_DebugMessage.DebugMessage.STEPINTO_RESPONSE, response => {
      let result = response.result;
      (0, _invariant2.default)(result.kind === "stepInto");
      this.sendEvent(new _vscodeDebugadapter.StoppedEvent("Stepped into " + `${result.filePath} ${result.line}:${result.column}`, _DebuggerConstants.DebuggerConstants.PREPACK_THREAD_ID));
    });
  }

  /**
   * The 'initialize' request is the first request called by the UI
   * to interrogate the features the debug adapter provides.
   */
  // Override
  initializeRequest(response, args) {
    this._clientID = args.clientID;
    response.body = response.body || {};
    response.body.supportsConfigurationDoneRequest = true;
    // Respond back to the UI with the configurations. Will add more configurations gradually as needed.
    // Adapter can respond immediately here because no message is sent to Prepack
    this.sendResponse(response);
  }

  // Override
  configurationDoneRequest(response, args) {
    // initial handshake with UI is complete
    if (this._clientID !== _DebuggerConstants.DebuggerConstants.CLI_CLIENTID) {
      this._ensureAdapterChannelCreated("configurationDoneRequest");
      (0, _invariant2.default)(this._adapterChannel !== undefined, "Adapter Channel used before it was created, in debugger.");
      // for all ui except the CLI, autosend the first run request
      this._adapterChannel.run(_DebuggerConstants.DebuggerConstants.DEFAULT_REQUEST_ID, runResponse => {});
    }
    this.sendResponse(response);
  }

  // Override
  launchRequest(response, args) {
    let inFilePath = this._generateDebugFilePath("in");
    let outFilePath = this._generateDebugFilePath("out");
    // Set up the communication channel to the debugger.
    let adapterChannel = new _AdapterChannel.AdapterChannel(inFilePath, outFilePath);
    this._adapterChannel = adapterChannel;
    this._registerMessageCallbacks();
    let launchArgs = {
      kind: "launch",
      sourceFiles: args.sourceFiles,
      prepackRuntime: args.prepackRuntime,
      prepackArguments: args.prepackArguments,
      debugInFilePath: inFilePath,
      debugOutFilePath: outFilePath,
      outputCallback: data => {
        let outputEvent = new _vscodeDebugadapter.OutputEvent(data.toString(), "stdout");
        this.sendEvent(outputEvent);
      },
      exitCallback: () => {
        this.sendEvent(new _vscodeDebugadapter.TerminatedEvent());
        process.exit();
      }
    };

    adapterChannel.launch(response.request_seq, launchArgs, dbgResponse => {
      this.sendResponse(response);
    });

    // Important: InitializedEvent indicates to the protocol that further requests (e.g. breakpoints, execution control)
    // are ready to be received. Prepack debugger is not ready to receive these requests until the Adapter Channel
    // has been created and Prepack has been launched. Thus, the InitializedEvent is sent after Prepack launch and
    // the creation of the Adapter Channel.
    this.sendEvent(new _vscodeDebugadapter.InitializedEvent());
  }

  /**
   * Request Prepack to continue running when it is stopped
   */
  // Override
  continueRequest(response, args) {
    // send a Run request to Prepack and try to send the next request
    this._ensureAdapterChannelCreated("continueRequest");
    (0, _invariant2.default)(this._adapterChannel !== undefined, "Adapter Channel used before it was created, in debugger.");
    this._adapterChannel.run(response.request_seq, dbgResponse => {
      this.sendResponse(response);
    });
  }

  // Override
  setBreakPointsRequest(response, args) {
    if (!args.source.path || !args.breakpoints) return;
    let filePath = args.source.path;
    let breakpointInfos = [];
    for (const breakpoint of args.breakpoints) {
      let line = breakpoint.line;
      let column = 0;
      if (breakpoint.column) {
        column = breakpoint.column;
      }
      let breakpointInfo = {
        kind: "breakpoint",
        requestID: response.request_seq,
        filePath: filePath,
        line: line,
        column: column
      };
      breakpointInfos.push(breakpointInfo);
    }

    this._ensureAdapterChannelCreated("setBreakPointsRequest");
    (0, _invariant2.default)(this._adapterChannel !== undefined, "Adapter Channel used before it was created, in debugger.");
    this._adapterChannel.setBreakpoints(response.request_seq, breakpointInfos, dbgResponse => {
      let result = dbgResponse.result;
      (0, _invariant2.default)(result.kind === "breakpoint-add");
      let breakpoints = [];
      for (const breakpointInfo of result.breakpoints) {
        let source = {
          path: breakpointInfo.filePath
        };
        let breakpoint = {
          verified: true,
          source: source,
          line: breakpointInfo.line,
          column: breakpointInfo.column
        };
        breakpoints.push(breakpoint);
      }
      response.body = {
        breakpoints: breakpoints
      };
      this.sendResponse(response);
    });
  }

  // Override
  stackTraceRequest(response, args) {
    this._ensureAdapterChannelCreated("stackTraceRequest");
    (0, _invariant2.default)(this._adapterChannel !== undefined);
    this._adapterChannel.getStackFrames(response.request_seq, dbgResponse => {
      let result = dbgResponse.result;
      (0, _invariant2.default)(result.kind === "stackframe");
      let frameInfos = result.stackframes;
      let frames = [];
      for (const frameInfo of frameInfos) {
        let source = {
          path: frameInfo.fileName
        };
        let frame = {
          id: frameInfo.id,
          name: frameInfo.functionName,
          source: source,
          line: frameInfo.line,
          column: frameInfo.column
        };
        frames.push(frame);
      }
      response.body = {
        stackFrames: frames
      };
      this.sendResponse(response);
    });
  }

  // Override
  threadsRequest(response) {
    // There will only be 1 thread, so respond immediately
    let thread = {
      id: _DebuggerConstants.DebuggerConstants.PREPACK_THREAD_ID,
      name: "main"
    };
    response.body = {
      threads: [thread]
    };
    this.sendResponse(response);
  }

  // Override
  scopesRequest(response, args) {
    this._ensureAdapterChannelCreated("scopesRequest");
    (0, _invariant2.default)(this._adapterChannel !== undefined, "Adapter Channel used before it was created, in debugger.");
    this._adapterChannel.getScopes(response.request_seq, args.frameId, dbgResponse => {
      let result = dbgResponse.result;
      (0, _invariant2.default)(result.kind === "scopes");
      let scopeInfos = result.scopes;
      let scopes = [];
      for (const scopeInfo of scopeInfos) {
        let scope = {
          name: scopeInfo.name,
          variablesReference: scopeInfo.variablesReference,
          expensive: scopeInfo.expensive
        };
        scopes.push(scope);
      }
      response.body = {
        scopes: scopes
      };
      this.sendResponse(response);
    });
  }

  // Override
  variablesRequest(response, args) {
    this._ensureAdapterChannelCreated("variablesRequest");
    (0, _invariant2.default)(this._adapterChannel !== undefined, "Adapter Channel used before it was created, in debugger.");
    this._adapterChannel.getVariables(response.request_seq, args.variablesReference, dbgResponse => {
      let result = dbgResponse.result;
      (0, _invariant2.default)(result.kind === "variables");
      let variableInfos = result.variables;
      let variables = [];
      for (const varInfo of variableInfos) {
        let variable = {
          name: varInfo.name,
          value: varInfo.value,
          variablesReference: varInfo.variablesReference
        };
        variables.push(variable);
      }
      response.body = {
        variables: variables
      };
      this.sendResponse(response);
    });
  }

  // Override
  stepInRequest(response, args) {
    this._ensureAdapterChannelCreated("stepInRequest");
    (0, _invariant2.default)(this._adapterChannel !== undefined, "Adapter Channel used before it was created, in debugger.");
    this._adapterChannel.stepInto(response.request_seq, dbgResponse => {
      this.sendResponse(response);
    });
  }

  // Override
  nextRequest(response, args) {
    this._ensureAdapterChannelCreated("nextRequest");
    (0, _invariant2.default)(this._adapterChannel !== undefined, "Adapter Channel used before it was created, in debugger.");
    this._adapterChannel.stepOver(response.request_seq, dbgResponse => {
      this.sendResponse(response);
    });
  }

  // Override
  stepOutRequest(response, args) {
    this._ensureAdapterChannelCreated("stepOutRequest");
    (0, _invariant2.default)(this._adapterChannel !== undefined, "Adapter Channel used before it was created, in debugger.");
    this._adapterChannel.stepOut(response.request_seq, dbgResponse => {
      this.sendResponse(response);
    });
  }

  // Override
  evaluateRequest(response, args) {
    this._ensureAdapterChannelCreated("evaluateRequest");
    (0, _invariant2.default)(this._adapterChannel !== undefined, "Adapter Channel used before it was created, in debugger.");
    this._adapterChannel.evaluate(response.request_seq, args.frameId, args.expression, dbgResponse => {
      let evalResult = dbgResponse.result;
      (0, _invariant2.default)(evalResult.kind === "evaluate");
      response.body = {
        result: evalResult.displayValue,
        type: evalResult.type,
        variablesReference: evalResult.variablesReference
      };
      this.sendResponse(response);
    });
  }

  _ensureAdapterChannelCreated(callingRequest) {
    // All responses that involve the Adapter Channel should only be invoked
    // after the channel has been created. If this ordering is perturbed,
    // there was likely a change in the protocol implementation by Nuclide.
    if (this._adapterChannel === undefined) {
      throw new _DebuggerError.DebuggerError("Startup Error", `Adapter Channel in Debugger is being used before it has been created. Caused by ${callingRequest}.`);
    }
  }
} /**
   * Copyright (c) 2017-present, Facebook, Inc.
   * All rights reserved.
   *
   * This source code is licensed under the BSD-style license found in the
   * LICENSE file in the root directory of this source tree. An additional grant
   * of patent rights can be found in the PATENTS file in the same directory.
   */

/*  strict-local */

_vscodeDebugadapter.DebugSession.run(PrepackDebugSession);
//# sourceMappingURL=DebugAdapter.js.map