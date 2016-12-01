'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import type {
  EvaluationResult,
  ExpansionResult,
} from './types';
import {WatchExpressionStore} from './WatchExpressionStore';
import type {Observable} from 'rxjs';

import {
  React,
} from 'react-for-atom';
import {LazyNestedValueComponent} from '../../nuclide-ui/LazyNestedValueComponent';
import SimpleValueComponent from '../../nuclide-ui/SimpleValueComponent';

type LocalsComponentProps = {
  locals: ExpansionResult,
  watchExpressionStore: WatchExpressionStore,
};

export class LocalsComponent extends React.Component {
  props: LocalsComponentProps;
  _expansionStates: Map<string /* expression */, /* unique reference for expression */ Object>;

  constructor(props: LocalsComponentProps) {
    super(props);
    (this: any)._renderExpression = this._renderExpression.bind(this);
    this._expansionStates = new Map();
  }

  _getExpansionStateIdForExpression(expression: string): Object {
    let expansionStateId = this._expansionStates.get(expression);
    if (expansionStateId == null) {
      expansionStateId = {};
      this._expansionStates.set(expression, expansionStateId);
    }
    return expansionStateId;
  }

  _renderExpression(
    fetchChildren: (objectId: string) => Observable<?ExpansionResult>,
    local: {
      name: string,
      value: EvaluationResult,
    },
    index: number,
  ): ?React.Element<any> {
    if (local == null) {
      // `local` might be `null` while switching threads.
      return null;
    }
    const {
      name,
      value,
    } = local;
    return (
      <div
        className="nuclide-debugger-expression-value-row"
        key={index}>
        <div
          className="nuclide-debugger-expression-value-content">
          <LazyNestedValueComponent
            expression={name}
            evaluationResult={value}
            fetchChildren={fetchChildren}
            simpleValueComponent={SimpleValueComponent}
            expansionStateId={this._getExpansionStateIdForExpression(name)}
          />
        </div>
      </div>
    );
  }

  render(): ?React.Element<any> {
    const {
      watchExpressionStore,
      locals,
    } = this.props;
    if (locals == null || locals.length === 0) {
      return <span>(no variables)</span>;
    }
    const fetchChildren = watchExpressionStore.getProperties.bind(watchExpressionStore);
    const expressions = locals.map(this._renderExpression.bind(this, fetchChildren));
    return (
      <div className="nuclide-debugger-expression-value-list">
        {expressions}
      </div>
    );
  }
}
