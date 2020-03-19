/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 */

import type {PythonDiagnostic} from '../../nuclide-python-rpc';

import {Point, Range} from 'atom';
import {wordAtPosition, trimRange} from 'nuclide-commons-atom/range';
import {getLogger} from 'log4js';

const logger = getLogger('nuclide-python');

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
        if (code === 'F405') {
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
    const diagnosticAsString = `${
      diagnostic.file
    }:${unsafeLine}:${column} - ${code}: ${message}`;
    logger.error(
      `Failed to find flake8 diagnostic range: ${diagnosticAsString}`,
      e,
    );
  }

  return new Range([line, trimmedStartCol], [line, trimmedEndCol]);
}
