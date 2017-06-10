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

import type {PythonDiagnostic} from '../../nuclide-python-rpc';

import {Point, Range} from 'atom';
import {wordAtPosition, trimRange} from 'nuclide-commons-atom/range';
import {getLogger} from 'log4js';

const logger = getLogger('nuclide-python');

function tokenizedLineForRow(
  editor: atom$TextEditor,
  line: number,
): any /* atom$TokenizedLine */ {
  const tokenBuffer = editor.hasOwnProperty('displayBuffer')
    ? (editor: any).displayBuffer.tokenizedBuffer
    : (editor: any).tokenizedBuffer;
  return tokenBuffer.tokenizedLineForRow(line);
}

// Finds the range of the module name from a pyflakes F4XX message.
// Assumes that the module name exists.
// Ported from https://github.com/AtomLinter/linter-flake8
function getModuleNameRange(
  message: string,
  line: number,
  editor: atom$TextEditor,
): ?Range {
  // Split on space or dot to get the basename or alias, i.e. retrieve <a> in
  // "from .. import <a>" or "from .. import .. as <a>".
  const match = /'([^']+)'/.exec(message);
  if (match == null) {
    return null;
  }
  const symbol = match[1].split(/\s|\./).pop();

  let foundImport = false;
  let lineNumber = line;
  for (;;) {
    let offset = 0;
    const tokenizedLine = tokenizedLineForRow(editor, lineNumber);
    if (!tokenizedLine) {
      break;
    }
    for (let i = 0; i < tokenizedLine.tokens.length; i++) {
      const token = tokenizedLine.tokens[i];
      if (foundImport && token.value === symbol) {
        return new Range(
          [lineNumber, offset],
          [lineNumber, offset + token.value.length],
        );
      }
      if (
        token.value === 'import' &&
        token.scopes.indexOf('keyword.control.import.python') >= 0
      ) {
        foundImport = true;
      }
      offset += token.value.length;
    }
    lineNumber += 1;
  }
  logger.warn(`getModuleNameRange failed for message: ${message}`);
}

// Computes an appropriate underline range using the diagnostic type information.
// Range variants include underlining the entire line, entire trimmed line,
// or a word or whitespace range within the line.
export function getDiagnosticRange(
  diagnostic: PythonDiagnostic,
  editor: atom$TextEditor,
): Range {
  const buffer = editor.getBuffer();

  // The diagnostic message's line index may be out of bounds if buffer contents
  // have changed. To prevent an exception, we just use the last line of the buffer if
  // unsafeLine is out of bounds.
  const {code, line: unsafeLine, column, message} = diagnostic;
  const lastRow = buffer.getLastRow();
  const line = unsafeLine <= lastRow ? unsafeLine : lastRow;

  const lineLength = buffer.lineLengthForRow(line);
  const trimmedRange = trimRange(editor, buffer.rangeForRow(line, false));
  const trimmedStartCol = trimmedRange.start.column;
  const trimmedEndCol = trimmedRange.end.column;

  try {
    switch (code.slice(0, 2)) {
      // pep8 - indentation
      case 'E1':
      case 'E9':
      case 'W1':
        // For E901 SyntaxError and E902 IOError, we should underline the whole line.
        // FOr E901 IndentationError, proceed to only underline the leading whitespace.
        if (code === 'E902' || message.startsWith('SyntaxError')) {
          break;
        }
        return new Range([line, 0], [line, trimmedStartCol]);
      // pep8 - whitespace
      case 'E2':
        // '#' comment spacing
        if (code.startsWith('E26')) {
          return new Range([line, column], [line, trimmedEndCol]);
        }
        const numericCode = parseInt(code.slice(1), 10);
        // Missing whitespace - underline the closest symbol
        if ((numericCode >= 225 && numericCode <= 231) || numericCode === 275) {
          return new Range([line, column], [line, column + 1]);
        }
        // Extra whitespace - underline the offending whitespace
        const whitespace = wordAtPosition(
          editor,
          new Point(line, column),
          /\s+/g,
        );
        if (whitespace) {
          return whitespace.range;
        }
        break;
      // pep8 - blank line
      // pep8 - line length
      case 'E3':
      case 'E5':
        return new Range([line, 0], [line, lineLength]);
      // pep8 - whitespace warning
      case 'W2':
        // trailing whitespace
        if (code === 'W291') {
          return new Range([line, trimmedEndCol], [line, lineLength]);
        }
        break;
      // pyflakes - import related messages
      case 'F4':
        if (code === 'F401') {
          // 'XXX' is imported but not used
          const range = getModuleNameRange(message, line, editor);
          if (range != null) {
            return range;
          }
        } else if (code === 'F405') {
          // <XXX> may be undefined, or defined from import *
          const word = wordAtPosition(editor, new Point(line, column));
          if (word) {
            return word.range;
          }
        }
        break;
      // pyflakes - variable/name related messages
      case 'F8':
        // Highlight word for reference errors, default to highlighting line for
        // definition and other errors.
        if (!code.startsWith('F82')) {
          break;
        }
        const word = wordAtPosition(editor, new Point(line, column));
        if (word) {
          return word.range;
        }
        break;
      default:
        break;
    }
  } catch (e) {
    const diagnosticAsString = `${diagnostic.file}:${unsafeLine}:${column} - ${code}: ${message}`;
    logger.error(
      `Failed to find flake8 diagnostic range: ${diagnosticAsString}`,
      e,
    );
  }

  return new Range([line, trimmedStartCol], [line, trimmedEndCol]);
}
