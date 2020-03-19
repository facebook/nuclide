"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.AdapterChannel = undefined;

var _FileIOWrapper = require("./../../common/channel/FileIOWrapper.js");

var _MessageMarshaller = require("./../../common/channel/MessageMarshaller.js");

var _queueFifo = require("queue-fifo");

var _queueFifo2 = _interopRequireDefault(_queueFifo);

var _events = require("events");

var _events2 = _interopRequireDefault(_events);

var _invariant = require("./../../common/invariant.js");

var _invariant2 = _interopRequireDefault(_invariant);

var _DebugMessage = require("./../../common/channel/DebugMessage.js");

var _child_process = require("child_process");

var _child_process2 = _interopRequireDefault(_child_process);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

//Channel used by the debug adapter to communicate with Prepack
class AdapterChannel {
  constructor(inFilePath, outFilePath) {
    this._ioWrapper = new _FileIOWrapper.FileIOWrapper(true, inFilePath, outFilePath);
    this._marshaller = new _MessageMarshaller.MessageMarshaller();
    this._queue = new _queueFifo2.default();
    this._pendingRequestCallbacks = new Map();
    this._eventEmitter = new _events2.default();
  }


  // Error handler for errors in files from the adapter channel
  _handleFileReadError(err) {
    console.error(err);
    process.exit(1);
  }

  _processPrepackMessage(message) {
    let dbgResponse = this._marshaller.unmarshallResponse(message);
    if (dbgResponse.result.kind === "breakpoint-add") {
      this._eventEmitter.emit(_DebugMessage.DebugMessage.BREAKPOINT_ADD_ACKNOWLEDGE, dbgResponse.id, dbgResponse);
    } else if (dbgResponse.result.kind === "stopped") {
      this._eventEmitter.emit(_DebugMessage.DebugMessage.STOPPED_RESPONSE, dbgResponse);
    } else if (dbgResponse.result.kind === "stepInto") {
      this._eventEmitter.emit(_DebugMessage.DebugMessage.STEPINTO_RESPONSE, dbgResponse);
    }
    this._prepackWaiting = true;
    this._processRequestCallback(dbgResponse);
    this.trySendNextRequest();
  }

  // Check to see if the next request to Prepack can be sent and send it if so
  trySendNextRequest() {
    // check to see if Prepack is ready to accept another request
    if (!this._prepackWaiting) return false;
    // check that there is a message to send
    if (this._queue.isEmpty()) return false;
    let request = this._queue.dequeue();
    this.listenOnFile(this._processPrepackMessage.bind(this));
    this.writeOut(request);
    this._prepackWaiting = false;
    return true;
  }

  _addRequestCallback(requestID, callback) {
    (0, _invariant2.default)(!this._pendingRequestCallbacks.has(requestID), "Request ID already exists in pending requests");
    this._pendingRequestCallbacks.set(requestID, callback);
  }

  _processRequestCallback(response) {
    let callback = this._pendingRequestCallbacks.get(response.id);
    (0, _invariant2.default)(callback !== undefined, "Request ID does not exist in pending requests: " + response.id);
    callback(response);
    this._pendingRequestCallbacks.delete(response.id);
  }

  registerChannelEvent(event, listener) {
    this._eventEmitter.addListener(event, listener);
  }

  launch(requestID, args, callback) {
    this.sendDebuggerStart(requestID);
    this.listenOnFile(this._processPrepackMessage.bind(this));
    let prepackCommand = args.sourceFiles.concat(args.prepackArguments);
    // Note: here the input file for the adapter is the output file for Prepack, and vice versa.
    prepackCommand = prepackCommand.concat(["--debugInFilePath", args.debugOutFilePath, "--debugOutFilePath", args.debugInFilePath]);

    let runtime = "prepack";
    if (args.prepackRuntime.length > 0) {
      // user specified a Prepack path
      runtime = "node";
      // Increase node's memory allowance so Prepack can handle large inputs
      prepackCommand = ["--max_old_space_size=8192", "--stack_size=10000"].concat([args.prepackRuntime]).concat(prepackCommand);
    }
    this._prepackProcess = _child_process2.default.spawn(runtime, prepackCommand);

    process.on("exit", () => {
      this._prepackProcess.kill();
      this.clean();
      process.exit();
    });

    process.on("SIGINT", () => {
      this._prepackProcess.kill();
      process.exit();
    });

    this._prepackProcess.stdout.on("data", args.outputCallback);

    this._prepackProcess.on("exit", args.exitCallback);
    this._addRequestCallback(requestID, callback);
  }

  run(requestID, callback) {
    this._queue.enqueue(this._marshaller.marshallContinueRequest(requestID));
    this.trySendNextRequest();
    this._addRequestCallback(requestID, callback);
  }

  setBreakpoints(requestID, breakpoints, callback) {
    this._queue.enqueue(this._marshaller.marshallSetBreakpointsRequest(requestID, breakpoints));
    this.trySendNextRequest();
    this._addRequestCallback(requestID, callback);
  }

  getStackFrames(requestID, callback) {
    this._queue.enqueue(this._marshaller.marshallStackFramesRequest(requestID));
    this.trySendNextRequest();
    this._addRequestCallback(requestID, callback);
  }

  getScopes(requestID, frameId, callback) {
    this._queue.enqueue(this._marshaller.marshallScopesRequest(requestID, frameId));
    this.trySendNextRequest();
    this._addRequestCallback(requestID, callback);
  }

  getVariables(requestID, variablesReference, callback) {
    this._queue.enqueue(this._marshaller.marshallVariablesRequest(requestID, variablesReference));
    this.trySendNextRequest();
    this._addRequestCallback(requestID, callback);
  }

  stepInto(requestID, callback) {
    this._queue.enqueue(this._marshaller.marshallStepIntoRequest(requestID));
    this.trySendNextRequest();
    this._addRequestCallback(requestID, callback);
  }

  stepOver(requestID, callback) {
    this._queue.enqueue(this._marshaller.marshallStepOverRequest(requestID));
    this.trySendNextRequest();
    this._addRequestCallback(requestID, callback);
  }

  stepOut(requestID, callback) {
    this._queue.enqueue(this._marshaller.marshallStepOutRequest(requestID));
    this.trySendNextRequest();
    this._addRequestCallback(requestID, callback);
  }

  evaluate(requestID, frameId, expression, callback) {
    this._queue.enqueue(this._marshaller.marshallEvaluateRequest(requestID, frameId, expression));
    this.trySendNextRequest();
    this._addRequestCallback(requestID, callback);
  }

  writeOut(contents) {
    this._ioWrapper.writeOutSync(contents);
  }

  sendDebuggerStart(requestID) {
    this.writeOut(this._marshaller.marshallDebuggerStart(requestID));
  }

  listenOnFile(messageProcessor) {
    this._ioWrapper.readIn(this._handleFileReadError.bind(this), messageProcessor);
  }

  clean() {
    this._ioWrapper.clearInFile();
    this._ioWrapper.clearOutFile();
  }
}
exports.AdapterChannel = AdapterChannel; /**
                                          * Copyright (c) 2017-present, Facebook, Inc.
                                          * All rights reserved.
                                          *
                                          * This source code is licensed under the BSD-style license found in the
                                          * LICENSE file in the root directory of this source tree. An additional grant
                                          * of patent rights can be found in the PATENTS file in the same directory.
                                          */
//# sourceMappingURL=AdapterChannel.js.map