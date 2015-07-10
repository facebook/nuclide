'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

var {getServiceByNuclideUri} = require('nuclide-client');
var {Range} = require('atom');

var {JS_GRAMMARS} = require('./constants.js');

/**
 * Currently, a diagnostic from Flow is an object with a "message" property.
 * Each item in the "message" array is an object with the following fields:
 *     - path (string) File that contains the error.
 *     - descr (string) Description of the error.
 *     - line (number) Start line.
 *     - endline (number) End line.
 *     - start (number) Start column.
 *     - end (number) End column.
 *     - code (number) Presumably an error code.
 * The message array may have more than one item. For example, if there is a
 * type incompatibility error, the first item in the message array blames the
 * usage of the wrong type and the second blames the declaration of the type
 * with which the usage disagrees. Note that these could occur in different
 * files.
 */
function extractRange(message){
  // It's unclear why the 1-based to 0-based indexing works the way that it
  // does, but this has the desired effect in the UI, in practice.
  return new Range(
    [message['line'] - 1, message['start'] - 1],
    [message['endline'] - 1, message['end']],
  );
}

// A trace object is very similar to an error object.
function flowMessageToTrace(message){
  return {
    type: 'Trace',
    text: message.descr,
    filePath: message.path,
    range: extractRange(message),
  };
}

function flowMessageToLinterMessage(arr) {
  var message = arr[0];

  var obj = {
    type: message.level || 'Error',
    text: arr.map( (errObj) => errObj.descr).join(' '),
    filePath: message.path,
    range: extractRange(message),
  };

  // When the message is an array with multiple elements
  // The second element onwards make the trace for the error.
  if (arr.length > 1){
    obj.trace = arr.slice(1).map(flowMessageToTrace);
  }

  return obj;
}

type FlowError = {
  level: string,
  descr: string,
  path: string,
  line: number,
  start: number,
  endline: number,
  end: number,
}

type FlowDiagnosticItem = {
  message: Array<FlowError>
}

function processDiagnostics(diagnostics: Array<FlowDiagnosticItem>, targetFile: string) {
  var hasMessageWithPath = function(message) {
    return message['filePath'] === targetFile;
  };

  // convert array messages to Error Objects with Traces, and filter out errors not relevant to `targetFile`
  return diagnostics
    .map( (diagnostic) => diagnostic['message'] )
    .map(flowMessageToLinterMessage)
    .filter(hasMessageWithPath);
}

module.exports = {
  grammarScopes: JS_GRAMMARS,
  scope: 'file',
  lintOnFly: true,
  async lint(textEditor: TextEditor): Promise<Array<Object>> {
    var file = textEditor.getPath();
    if (!file) {
      return [];
    }

    var diagnostics = await getServiceByNuclideUri('FlowService', file).findDiagnostics(file);
    if (!diagnostics.length) {
      return [];
    }

    return processDiagnostics(diagnostics, file);
  },
  processDiagnostics,
};
