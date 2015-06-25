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
function flowMessageToLinterMessage(message) {
  // It's unclear why the 1-based to 0-based indexing works the way that it
  // does, but this has the desired effect in the UI, in practice.
  var range = new Range(
    [message['line'] - 1, message['start'] - 1],
    [message['endline'] - 1, message['end']]
  );

  return {
    type: 'Error',
    text: message['descr'],
    filePath: message['path'],
    range: range,
  };
}

/**
 * In some cases, flow diagnostics will span multiple files. It helps in the case
 * that there's a problem with, say, the the way a function defined in another
 * file is typed conflicts with how you're calling it.
 *
 * You get diagnostics like:
 * File A: <Type string is incompatable>
 * File B: <with type number>
 *
 * We don't have any way to deal with this, so merge the descriptions, so that
 * information doesn't get cut off.
 *
 */
function mergeFlowMessages(messages: Array) {
  var message = messages[0];
  message['descr'] = messages.map((msg)=>msg['descr']).join(' ');
  return message;
}

function processDiagnostics(diagnostics: Array<Object>, targetFile: string) {
  var hasMessageWithPath = function(message) {
    return message['path'] === targetFile;
  };

  // Filter messages not addressing `targetFile` and merge messages spanning multiple files.
  var messages = diagnostics.map( (diagnostic) => {
                  var diagnosticMessages = diagnostic['message'];
                  return mergeFlowMessages(diagnosticMessages);
                 }).filter(hasMessageWithPath);

  return messages.map(flowMessageToLinterMessage);
}

module.exports = {
  grammarScopes: ['source.js', 'source.js.jsx'],
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
};
