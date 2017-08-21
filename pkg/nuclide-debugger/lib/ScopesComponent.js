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

import type {EvaluationResult, ExpansionResult, ScopeSection} from './types';
import {WatchExpressionStore} from './WatchExpressionStore';
import type {Observable} from 'rxjs';

import React from 'react';
import {LazyNestedValueComponent} from '../../nuclide-ui/LazyNestedValueComponent';
import SimpleValueComponent from '../../nuclide-ui/SimpleValueComponent';
import {Section} from '../../nuclide-ui/Section';

type ScopesComponentProps = {
  scopes: Array<ScopeSection>,
  watchExpressionStore: WatchExpressionStore,
};

function isLocalScopeName(scopeName: string): boolean {
  return ['Local', 'Locals'].indexOf(scopeName) !== -1;
}

export class ScopesComponent extends React.Component {
  props: ScopesComponentProps;
  _expansionStates: Map<
    string /* expression */,
    /* unique reference for expression */ Object,
  >;

  constructor(props: ScopesComponentProps) {
    super(props);
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

  _renderExpression = (
    fetchChildren: (objectId: string) => Observable<?ExpansionResult>,
    binding: {
      name: string,
      value: EvaluationResult,
    },
    index: number,
  ): ?React.Element<any> => {
    if (binding == null) {
      // `binding` might be `null` while switching threads.
      return null;
    }
    const {name, value} = binding;
    return (
      <div className="nuclide-debugger-expression-value-row" key={index}>
        <div className="nuclide-debugger-expression-value-content">
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
  };

  _renderScopeSection(
    fetchChildren: (objectId: string) => Observable<?ExpansionResult>,
    scope: ScopeSection,
  ): ?React.Element<any> {
    // Non-local scopes should be collapsed by default since users typically care less about them.
    const collapsedByDefault = !isLocalScopeName(scope.name);
    const noLocals =
      collapsedByDefault || scope.scopeVariables.length > 0
        ? null
        : <div className="nuclide-debugger-expression-value-row">
            <span className="nuclide-debugger-expression-value-content">
              (no variables)
            </span>
          </div>;

    return (
      <Section
        collapsable={true}
        headline={scope.name}
        size="small"
        collapsedByDefault={collapsedByDefault}>
        {noLocals}
        {scope.scopeVariables.map(
          this._renderExpression.bind(this, fetchChildren),
        )}
      </Section>
    );
  }

  render(): ?React.Element<any> {
    const {watchExpressionStore, scopes} = this.props;
    if (scopes == null || scopes.length === 0) {
      return <span>(no variables)</span>;
    }
    const fetchChildren = watchExpressionStore.getProperties.bind(
      watchExpressionStore,
    );
    const scopeSections = scopes.map(
      this._renderScopeSection.bind(this, fetchChildren),
    );
    return (
      <div className="nuclide-debugger-expression-value-list">
        {scopeSections}
      </div>
    );
  }
}
