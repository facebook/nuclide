/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow strict-local
 * @format
 */

import type {Datatip} from 'atom-ide-ui';
import type {IDebugService} from './types';

import {bindObservableAsProps} from 'nuclide-commons-ui/bindObservableAsProps';
import {getDefaultEvaluationExpression} from './evaluationExpression';
import {DebuggerMode} from './constants';
import DebuggerDatatipComponent from './ui/DebuggerDatatipComponent';
import {evaluateExpressionAsStream} from './utils';

export async function debuggerDatatip(
  service: IDebugService,
  editor: TextEditor,
  position: atom$Point,
): Promise<?Datatip> {
  if (
    service.viewModel.focusedProcess == null ||
    service.viewModel.focusedProcess.debuggerMode !== DebuggerMode.PAUSED
  ) {
    return null;
  }
  const activeEditor = atom.workspace.getActiveTextEditor();
  if (activeEditor == null) {
    return null;
  }
  const evaluationExpression = getDefaultEvaluationExpression(editor, position);
  if (evaluationExpression == null) {
    return null;
  }
  const {expression, range} = evaluationExpression;
  const {focusedProcess, focusedStackFrame} = service.viewModel;
  if (expression == null || focusedProcess == null) {
    // TODO respect session.capabilities.supportsEvaluateForHovers
    // and fallback to scopes variables resolution.
    return null;
  }

  const propStream = evaluateExpressionAsStream(
    service.createExpression(expression),
    focusedProcess,
    focusedStackFrame,
    'hover',
  ).map(exp => ({expression: exp, hideExpressionName: true, readOnly: true}));

  return {
    component: bindObservableAsProps(propStream, DebuggerDatatipComponent),
    range,
  };
}
