"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */

/*  strict */

//A collection of messages used between Prepack and the debug adapter
class DebugMessage {}
exports.DebugMessage = DebugMessage;
DebugMessage.DEBUGGER_ATTACHED = "DebuggerAttached";
DebugMessage.PREPACK_RUN_COMMAND = "PrepackRun";
DebugMessage.BREAKPOINT_ADD_COMMAND = "Breakpoint-add-command";
DebugMessage.BREAKPOINT_REMOVE_COMMAND = "Breakpoint-remove-command";
DebugMessage.BREAKPOINT_ENABLE_COMMAND = "Breakpoint-enable-command";
DebugMessage.BREAKPOINT_DISABLE_COMMAND = "Breakpoint-disable-command";
DebugMessage.STACKFRAMES_COMMAND = "Stackframes-command";
DebugMessage.SCOPES_COMMAND = "Scopes-command";
DebugMessage.VARIABLES_COMMAND = "Variables-command";
DebugMessage.STEPINTO_COMMAND = "StepInto-command";
DebugMessage.STEPOVER_COMMAND = "StepOver-command";
DebugMessage.STEPOUT_COMMAND = "StepOut-command";
DebugMessage.EVALUATE_COMMAND = "Evaluate-command";
DebugMessage.PREPACK_READY_RESPONSE = "PrepackReady";
DebugMessage.PREPACK_FINISH_RESPONSE = "PrepackFinish";
DebugMessage.STOPPED_RESPONSE = "Stopped-response";
DebugMessage.STACKFRAMES_RESPONSE = "Stackframes-response";
DebugMessage.SCOPES_RESPONSE = "Scopes-response";
DebugMessage.VARIABLES_RESPONSE = "Variables-response";
DebugMessage.STEPINTO_RESPONSE = "StepInto-response";
DebugMessage.EVALUATE_RESPONSE = "Evaluate-response";
DebugMessage.BREAKPOINT_ADD_ACKNOWLEDGE = "Breakpoint-add-acknowledge";
DebugMessage.BREAKPOINT_REMOVE_ACKNOWLEDGE = "Breakpoint-remove-acknowledge";
DebugMessage.BREAKPOINT_ENABLE_ACKNOWLEDGE = "Breakpoint-enable-acknowledge";
DebugMessage.BREAKPOINT_DISABLE_ACKNOWLEDGE = "Breakpoint-disable-acknowledge";
//# sourceMappingURL=DebugMessage.js.map