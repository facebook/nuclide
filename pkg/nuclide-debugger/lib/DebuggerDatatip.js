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

import type {NuclideEvaluationExpression} from '../../nuclide-debugger-interfaces/rpc-types';
import type {Datatip} from 'atom-ide-ui';
import type DebuggerModel from './DebuggerModel';
import type {EvaluationResult} from './types';

import {bindObservableAsProps} from 'nuclide-commons-ui/bindObservableAsProps';
import {getDefaultEvaluationExpression} from '../../nuclide-debugger-base';
import {DebuggerMode} from './DebuggerStore';
import {DebuggerDatatipComponent} from './DebuggerDatatipComponent';

function getEvaluationExpression(
  model: DebuggerModel,
  editor: TextEditor,
  position: atom$Point,
): Promise<?NuclideEvaluationExpression> {
  const {scopeName} = editor.getGrammar();
  const allProviders = model.getStore().getEvaluationExpressionProviders();
  let matchingProvider = null;
  for (const provider of allProviders) {
    const providerGrammars = provider.selector.split(/, ?/);
    if (providerGrammars.indexOf(scopeName) !== -1) {
      matchingProvider = provider;
      break;
    }
  }
  // eslint-disable-next-line eqeqeq
  return matchingProvider === null
    ? Promise.resolve(getDefaultEvaluationExpression(editor, position))
    : matchingProvider.getEvaluationExpression(editor, position);
}

export async function debuggerDatatip(
  model: DebuggerModel,
  editor: TextEditor,
  position: atom$Point,
): Promise<?Datatip> {
  if (model.getStore().getDebuggerMode() !== DebuggerMode.PAUSED) {
    return null;
  }
  const activeEditor = atom.workspace.getActiveTextEditor();
  if (activeEditor == null) {
    return null;
  }
  const evaluationExpression = await getEvaluationExpression(
    model,
    editor,
    position,
  );
  if (evaluationExpression == null) {
    return null;
  }
  const {expression, range} = evaluationExpression;
  if (expression == null) {
    return null;
  }
  const watchExpressionStore = model.getWatchExpressionStore();
  const evaluation = watchExpressionStore.evaluateWatchExpression(expression);
  // Avoid creating a datatip if the evaluation fails
  const evaluationResult: ?EvaluationResult = await evaluation
    .take(1)
    .toPromise();
  if (evaluationResult == null) {
    return null;
  }
  const propStream = evaluation
    .filter(result => result != null)
    .map(result => ({
      expression,
      evaluationResult: result,
      watchExpressionStore,
    }));
  return {
    component: bindObservableAsProps(propStream, DebuggerDatatipComponent),
    pinnable: true,
    range,
  };
}
