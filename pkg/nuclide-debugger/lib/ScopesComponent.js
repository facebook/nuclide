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

import type {RemoteObjectId} from '../../nuclide-debugger-base/lib/protocol-types';
import type ScopesStore from './ScopesStore';
import type {EvaluationResult, ExpansionResult, ScopeSection} from './types';
import invariant from 'assert';
import {WatchExpressionStore} from './WatchExpressionStore';
import type {Observable} from 'rxjs';

import * as React from 'react';
import {LazyNestedValueComponent} from '../../nuclide-ui/LazyNestedValueComponent';
import SimpleValueComponent from '../../nuclide-ui/SimpleValueComponent';
import {Section} from '../../nuclide-ui/Section';

type Props = {|
  +scopes: Array<ScopeSection>,
  +watchExpressionStore: WatchExpressionStore,
  scopesStore: ScopesStore,
|};

function isLocalScopeName(scopeName: string): boolean {
  return ['Local', 'Locals'].indexOf(scopeName) !== -1;
}

export class ScopesComponent extends React.Component<Props> {
  _expansionStates: Map<
    string /* expression */,
    Object /* unique reference for expression */,
  >;

  constructor(props: Props) {
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

  _setVariable = (
    scopeObjectId: RemoteObjectId,
    scopeNumber: number,
    expression: ?string,
    newValue: ?string,
  ): void => {
    if (Boolean(expression) && Boolean(newValue)) {
      invariant(expression != null);
      invariant(newValue != null);
      this.props.scopesStore.sendSetVariableRequest(
        scopeNumber,
        Number(scopeObjectId),
        expression,
        newValue,
      );
    }
  };

  _renderExpression = (
    fetchChildren: (objectId: string) => Observable<?ExpansionResult>,
    setVariable: ?(expression: ?string, newValue: ?string) => void,
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
            setVariable={setVariable}
          />
        </div>
      </div>
    );
  };

  _renderScopeSection(
    fetchChildren: (objectId: string) => Observable<?ExpansionResult>,
    scope: ScopeSection,
    scopeNumber: number,
  ): ?React.Element<any> {
    const {scopesStore} = this.props;
    const {name, scopeObjectId, scopeVariables} = scope;
    // Non-local scopes should be collapsed by default since users typically care less about them.
    const collapsedByDefault = !isLocalScopeName(name);
    const noLocals =
      collapsedByDefault || scopeVariables.length > 0 ? null : (
        <div className="nuclide-debugger-expression-value-row">
          <span className="nuclide-debugger-expression-value-content">
            (no variables)
          </span>
        </div>
      );

    const setVariableHandler = scopesStore.supportsSetVariable()
      ? this._setVariable.bind(this, scopeObjectId, scopeNumber)
      : null;

    return (
      // $FlowFixMe(>=0.53.0) Flow suppress
      <Section
        collapsable={true}
        headline={name}
        size="small"
        collapsedByDefault={collapsedByDefault}>
        {noLocals}
        {scopeVariables.map(
          this._renderExpression.bind(this, fetchChildren, setVariableHandler),
        )}
      </Section>
    );
  }

  render(): React.Node {
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
