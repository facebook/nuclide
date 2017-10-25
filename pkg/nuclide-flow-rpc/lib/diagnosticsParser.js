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

import type {DiagnosticFix, DiagnosticTrace} from 'atom-ide-ui';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';

import type {FileDiagnosticMessage} from '../../nuclide-language-service/lib/LanguageService';
import type {
  FlowStatusOutput,
  FlowStatusError,
  FlowStatusErrorMessageComponent,
} from './flowOutputTypes';

import invariant from 'assert';
import {Range} from 'simple-text-buffer';

// Flow sometimes reports this as the file path for an error. When this happens, we should simply
// leave out the location, since it isn't very useful and it's not a well-formed path, which can
// cause issues down the line.
const BUILTIN_LOCATION = '(builtins)';

export function flowStatusOutputToDiagnostics(
  statusOutput: FlowStatusOutput,
): Array<FileDiagnosticMessage> {
  return statusOutput.errors.map(flowMessageToDiagnosticMessage);
}

// Exported for testing
export function diagnosticToFix(
  diagnostic: FileDiagnosticMessage,
): ?DiagnosticFix {
  for (const extractionFunction of fixExtractionFunctions) {
    const fix = extractionFunction(diagnostic);
    if (fix != null) {
      return fix;
    }
  }

  return null;
}

const fixExtractionFunctions: Array<
  (diagnostic: FileDiagnosticMessage) => ?DiagnosticFix,
> = [unusedSuppressionFix, namedImportTypo];

function unusedSuppressionFix(
  diagnostic: FileDiagnosticMessage,
): ?DiagnosticFix {
  // Automatically remove unused suppressions:
  if (
    diagnostic.trace != null &&
    diagnostic.trace.length === 1 &&
    diagnostic.text === 'Error suppressing comment' &&
    diagnostic.trace[0].text === 'Unused suppression'
  ) {
    const oldRange = diagnostic.range;
    invariant(oldRange != null);
    return {
      newText: '',
      oldRange,
      speculative: true,
    };
  }

  return null;
}

function namedImportTypo(diagnostic: FileDiagnosticMessage): ?DiagnosticFix {
  const trace = diagnostic.trace;
  const text = diagnostic.text;
  if (trace == null || trace.length !== 1 || text == null) {
    return null;
  }
  const traceText = trace[0].text;
  if (traceText == null) {
    return null;
  }

  if (!/^Named import from module `[^`]*`$/.test(text)) {
    return null;
  }

  const regex = /^This module has no named export called `([^`]*)`. Did you mean `([^`]*)`\?$/;
  const match = regex.exec(traceText);
  if (match == null) {
    return null;
  }

  const oldText = match[1];
  const newText = match[2];
  const oldRange = diagnostic.range;
  invariant(oldRange != null);

  return {
    oldText,
    newText,
    oldRange,
    speculative: true,
  };
}

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

function extractPath(
  message: FlowStatusErrorMessageComponent,
): NuclideUri | void {
  if (message.loc == null || message.loc.source === BUILTIN_LOCATION) {
    return undefined;
  }
  return message.loc.source;
}

// A trace object is very similar to an error object.
function flowMessageToTrace(
  message: FlowStatusErrorMessageComponent,
): DiagnosticTrace {
  return {
    type: 'Trace',
    text: message.descr,
    filePath: extractPath(message),
    range: extractRange(message),
  };
}

function flowMessageToDiagnosticMessage(flowStatusError: FlowStatusError) {
  const flowMessageComponents: Array<FlowStatusErrorMessageComponent> =
    flowStatusError.message;

  const mainMessage = flowMessageComponents[0];

  // The Flow type does not capture this, but the first message always has a path, and the
  // diagnostics package requires a FileDiagnosticMessage to have a path.
  const path = flowMessageComponents
    .map(extractPath)
    .find(extractedPath => extractedPath != null);
  invariant(path != null, 'Expected path to not be null or undefined');

  const diagnosticMessage: FileDiagnosticMessage = {
    providerName: 'Flow',
    type: flowStatusError.level === 'error' ? 'Error' : 'Warning',
    text: mainMessage.descr,
    filePath: path,
    range: extractRange(mainMessage),
    trace: extractTraces(flowStatusError),
  };

  const fix = diagnosticToFix(diagnosticMessage);
  if (fix != null) {
    diagnosticMessage.fix = fix;
  }

  return diagnosticMessage;
}

function extractTraces(
  flowStatusError: FlowStatusError,
): Array<DiagnosticTrace> | void {
  const flowMessageComponents: Array<FlowStatusErrorMessageComponent> =
    flowStatusError.message;

  const trace: Array<DiagnosticTrace> = [];
  // When the message is an array with multiple elements, the second element
  // onwards comprise the trace for the error.
  if (flowMessageComponents.length > 1) {
    trace.push(...flowMessageComponents.slice(1).map(flowMessageToTrace));
  }

  const operation = flowStatusError.operation;
  if (operation != null) {
    const operationComponent = flowMessageToTrace(operation);
    invariant(operationComponent.text != null);
    operationComponent.text = 'See also: ' + operationComponent.text;
    trace.push(operationComponent);
  }
  const extra = flowStatusError.extra;
  if (extra != null) {
    extra.forEach(({message, children}) => {
      trace.push(...message.map(flowMessageToTrace));
      if (children != null) {
        const childrenTraces: Array<DiagnosticTrace> = [].concat(
          ...children.map(child =>
            [].concat(child.message.map(flowMessageToTrace)),
          ),
        );
        trace.push(...childrenTraces);
      }
    });
  }

  if (trace.length > 0) {
    return trace;
  } else {
    return undefined;
  }
}

// Use `atom$Range | void` rather than `?atom$Range` to exclude `null`, so that the type is
// compatible with the `range` property, which is an optional property rather than a nullable
// property.
export function extractRange(
  message: FlowStatusErrorMessageComponent,
): atom$Range | void {
  if (message.loc == null || message.loc.source === BUILTIN_LOCATION) {
    return undefined;
  } else {
    // It's unclear why the 1-based to 0-based indexing works the way that it
    // does, but this has the desired effect in the UI, in practice.
    return new Range(
      [message.loc.start.line - 1, message.loc.start.column - 1],
      [message.loc.end.line - 1, message.loc.end.column],
    );
  }
}
