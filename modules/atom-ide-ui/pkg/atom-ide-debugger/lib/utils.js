/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 * @format
 */

import type {
  IExpression,
  IEvaluatableExpression,
  IProcess,
  IStackFrame,
  ContextType,
} from './types';
import type {Expected} from 'nuclide-commons/expected';

import nullthrows from 'nullthrows';
import {Observable} from 'rxjs';
import logger from './logger';
import {Expect} from 'nuclide-commons/expected';

function getGutterLineNumber(target: HTMLElement): ?number {
  const eventLine = parseInt(target.dataset.line, 10);
  if (eventLine != null && eventLine >= 0 && !isNaN(Number(eventLine))) {
    return eventLine;
  }
}

const SCREEN_ROW_ATTRIBUTE_NAME = 'data-screen-row';

function getEditorLineNumber(
  editor: atom$TextEditor,
  target: HTMLElement,
): ?number {
  let node = target;
  while (node != null) {
    if (node.hasAttribute(SCREEN_ROW_ATTRIBUTE_NAME)) {
      const screenRow = Number(node.getAttribute(SCREEN_ROW_ATTRIBUTE_NAME));
      try {
        return editor.bufferPositionForScreenPosition([screenRow, 0]).row;
      } catch (error) {
        return null;
      }
    }
    node = node.parentElement;
  }
}

async function getEditorOrNull(path: string): Promise<?atom$TextEditor> {
  try {
    // eslint-disable-next-line nuclide-internal/atom-apis
    return await atom.workspace.open(path, {
      searchAllPanes: true,
      pending: true,
    });
  } catch (error) {
    return null;
  }
}

export async function openSourceLocation(
  path: string,
  line: number,
): Promise<?atom$TextEditor> {
  const editor = await getEditorOrNull(path);
  if (editor == null) {
    // Failed to open file.
    return null;
  }
  editor.scrollToBufferPosition([line, 0]);
  editor.setCursorBufferPosition([line, 0]);

  // Put the focus back in the console prompt.
  atom.commands.dispatch(
    atom.views.getView(atom.workspace),
    'atom-ide-console:focus-console-prompt',
  );

  return editor;
}

function firstNonNull(...args) {
  return nullthrows(args.find(arg => arg != null));
}

export function getLineForEvent(editor: atom$TextEditor, event: any): number {
  const cursorLine = editor.getLastCursor().getBufferRow();
  const target = event ? (event.target: HTMLElement) : null;
  if (target == null) {
    return cursorLine;
  }
  // toggleLine is the line the user clicked in the gutter next to, as opposed
  // to the line the editor's cursor happens to be in. If this command was invoked
  // from the menu, then the cursor position is the target line.
  return firstNonNull(
    getGutterLineNumber(target),
    getEditorLineNumber(editor, target),
    // fall back to the line the cursor is on.
    cursorLine,
  );
}

export function isLocalScopeName(scopeName: string): boolean {
  return ['Local', 'Locals'].indexOf(scopeName) !== -1;
}

export function evaluateExpressionAsStream(
  expression: IEvaluatableExpression,
  focusedProcess: IProcess,
  focusedStackFrame: ?IStackFrame,
  context: ContextType,
): Observable<Expected<IExpression>> {
  return Observable.fromPromise(
    expression.evaluate(focusedProcess, focusedStackFrame, context),
  )
    .catch(error => Observable.of(Expect.error(error)))
    .map(() => Expect.value(expression))
    .startWith(Expect.pending());
}

export function onUnexpectedError(error: any) {
  const errorMessage = error.stack || error.message || String(error);
  logger.error('Unexpected error', error);
  atom.notifications.addError(
    'Atom debugger ran into an unexpected error - please file a bug!',
    {
      detail: errorMessage,
    },
  );
}

export function capitalize(str: string): string {
  return str[0].toUpperCase() + str.slice(1);
}

export function notifyOpenDebugSession(): void {
  atom.notifications.addInfo(
    "Received a debug request, but there's an open debug session already!",
    {
      detail: 'Please terminate your existing debug session',
    },
  );
}
