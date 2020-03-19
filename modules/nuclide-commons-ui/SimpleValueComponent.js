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

import type {IExpression} from 'atom-ide-ui';

import * as React from 'react';
import {ValueComponentClassNames} from './ValueComponentClassNames';
import {TextRenderer} from './TextRenderer';

type Props = {
  expression: IExpression,
  hideExpressionName?: boolean,
};

const booleanRegex = /^true|false$/i;
export const STRING_REGEX = /^(['"]).*\1$/;

function renderNullish(expression: IExpression): ?React.Element<any> {
  const type = expression.type;
  return type === 'undefined' || type === 'null' ? (
    <span className={ValueComponentClassNames.nullish}>{type}</span>
  ) : null;
}

function renderString(expression: IExpression): ?React.Element<any> {
  const type = expression.type;
  const value = expression.getValue();
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

function renderNumber(expression: IExpression): ?React.Element<any> {
  const type = expression.type;
  const value = expression.getValue();
  if (value == null) {
    return null;
  }
  return type === 'number' || !isNaN(Number(value)) ? (
    <span className={ValueComponentClassNames.number}>{String(value)}</span>
  ) : null;
}

function renderBoolean(expression: IExpression): ?React.Element<any> {
  const type = expression.type;
  const value = expression.getValue();
  if (value == null) {
    return null;
  }
  return type === 'boolean' || booleanRegex.test(value) ? (
    <span className={ValueComponentClassNames.boolean}>{String(value)}</span>
  ) : null;
}

function renderDefault(expression: IExpression): ?string {
  return expression.getValue();
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
    const {expression} = this.props;
    return expression !== nextProps.expression;
  }

  render(): React.Node {
    const {expression} = this.props;
    let displayValue;
    for (const renderer of valueRenderers) {
      displayValue = renderer(expression);
      if (displayValue != null) {
        break;
      }
    }
    if (displayValue == null || displayValue === '') {
      const val = expression.getValue();
      displayValue = val != null ? val : '(N/A)';
    }
    if (expression == null) {
      return (
        <span tabIndex={-1} className="native-key-bindings">
          {displayValue}
        </span>
      );
    }
    const hideExpressionName = Boolean(this.props.hideExpressionName);
    const renderedExpression = hideExpressionName ? null : (
      <span className={ValueComponentClassNames.identifier}>
        {expression.name}
      </span>
    );
    return (
      <span tabIndex={-1} className="native-key-bindings">
        {renderedExpression}
        {hideExpressionName ? null : ':'}
        {displayValue}
      </span>
    );
  }
}
