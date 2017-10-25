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

// TODO @jxg export debugger typedefs from main module. (t11406963)
import type {EvaluationResult} from '../nuclide-debugger/lib/types';

import * as React from 'react';
import {ValueComponentClassNames} from './ValueComponentClassNames';
import {TextRenderer} from './TextRenderer';

type Props = {
  expression: ?string,
  evaluationResult: EvaluationResult,
};

const booleanRegex = /^true|false$/i;
export const STRING_REGEX = /^(['"]).*\1$/;

function renderNullish(
  evaluationResult: EvaluationResult,
): ?React.Element<any> {
  const {type} = evaluationResult;
  return type === 'undefined' || type === 'null' ? (
    <span className={ValueComponentClassNames.nullish}>{type}</span>
  ) : null;
}

function renderString(evaluationResult: EvaluationResult): ?React.Element<any> {
  const {type, value} = evaluationResult;
  if (value == null) {
    return null;
  }
  if (STRING_REGEX.test(value)) {
    return <span className={ValueComponentClassNames.string}>{value}</span>;
  } else if (type === 'string') {
    return (
      <span className={ValueComponentClassNames.string}>
        <span className={ValueComponentClassNames.stringOpeningQuote}>"</span>
        {value}
        <span className={ValueComponentClassNames.stringClosingQuote}>"</span>
      </span>
    );
  } else {
    return null;
  }
}

function renderNumber(evaluationResult: EvaluationResult): ?React.Element<any> {
  const {type, value} = evaluationResult;
  if (value == null) {
    return null;
  }
  return type === 'number' || !isNaN(Number(value)) ? (
    <span className={ValueComponentClassNames.number}>{String(value)}</span>
  ) : null;
}

function renderBoolean(
  evaluationResult: EvaluationResult,
): ?React.Element<any> {
  const {type, value} = evaluationResult;
  if (value == null) {
    return null;
  }
  return type === 'boolean' || booleanRegex.test(value) ? (
    <span className={ValueComponentClassNames.boolean}>{String(value)}</span>
  ) : null;
}

function renderDefault(evaluationResult: EvaluationResult): ?string {
  return evaluationResult.value;
}

const valueRenderers = [
  TextRenderer,
  renderString,
  renderNumber,
  renderNullish,
  renderBoolean,
  renderDefault,
];

export default class SimpleValueComponent extends React.Component<Props> {
  shouldComponentUpdate(nextProps: Props): boolean {
    const {expression, evaluationResult} = this.props;
    return (
      expression !== nextProps.expression ||
      evaluationResult.type !== nextProps.evaluationResult.type ||
      evaluationResult.value !== nextProps.evaluationResult.value ||
      evaluationResult.description !== nextProps.evaluationResult.description
    );
  }

  render(): React.Node {
    const {expression, evaluationResult} = this.props;
    let displayValue;
    for (const renderer of valueRenderers) {
      displayValue = renderer(evaluationResult);
      if (displayValue != null) {
        break;
      }
    }
    if (displayValue == null || displayValue === '') {
      // flowlint-next-line sketchy-null-string:off
      displayValue = evaluationResult.description || '(N/A)';
    }
    if (expression == null) {
      return <span>{displayValue}</span>;
    }
    // TODO @jxg use a text editor to apply proper syntax highlighting for expressions
    // (t11408154)
    const renderedExpression = (
      <span className={ValueComponentClassNames.identifier}>{expression}</span>
    );
    return (
      <span>
        {renderedExpression}
        : {displayValue}
      </span>
    );
  }
}
