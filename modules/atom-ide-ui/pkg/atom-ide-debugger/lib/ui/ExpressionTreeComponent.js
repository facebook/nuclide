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

import type {IExpression, IVariable} from 'atom-ide-ui';
import type {Expected} from 'nuclide-commons/expected';

import {AtomInput} from 'nuclide-commons-ui/AtomInput';
import {Icon} from 'nuclide-commons-ui/Icon';
import {track} from 'nuclide-commons/analytics';
import * as React from 'react';
import classnames from 'classnames';
import {Expect} from 'nuclide-commons/expected';
import ignoreTextSelectionEvents from 'nuclide-commons-ui/ignoreTextSelectionEvents';
import invariant from 'assert';
import nullthrows from 'nullthrows';
import {LoadingSpinner} from 'nuclide-commons-ui/LoadingSpinner';
import {Observable} from 'rxjs';
import SimpleValueComponent from 'nuclide-commons-ui/SimpleValueComponent';
import {STRING_REGEX} from 'nuclide-commons-ui/SimpleValueComponent';
import {TreeList, TreeItem, NestedTreeItem} from 'nuclide-commons-ui/Tree';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {ValueComponentClassNames} from 'nuclide-commons-ui/ValueComponentClassNames';

const EDIT_VALUE_FROM_ICON = 'edit-value-from-icon';
const NOT_AVAILABLE_MESSAGE = '<not available>';
const SPINNER_DELAY = 200; /* ms */

// This weak map tracks which node path(s) are expanded in a recursive expression
// value tree. These must be tracked outside of the React objects themselves, because
// expansion state is persisted even if the tree is destroyed and recreated (such as when
// stepping in a debugger). The root of each tree has a context, which is based on the
// component that contains the tree (such as a debugger pane, tooltip or console pane).
// When that component is destroyed, the WeakMap will remove the expansion state information
// for the entire tree.
const ExpansionStates: WeakMap<Object, Map<string, boolean>> = new WeakMap();

type ExpressionTreeNodeProps = {|
  expression: IExpression,
  pending?: boolean,
  expansionCache: Map<string, boolean>,
  nodePath: string,
  hideExpressionName?: boolean,
  readOnly?: boolean,
|};

type ExpressionTreeNodeState = {|
  expanded: boolean,
  children: Expected<IExpression[]>,
  isEditing: boolean,
  pendingValue: ?string,
  pendingSave: boolean,
|};

export class ExpressionTreeNode extends React.Component<
  ExpressionTreeNodeProps,
  ExpressionTreeNodeState,
> {
  state: ExpressionTreeNodeState;
  _toggleNodeExpanded: (e: SyntheticMouseEvent<>) => void;
  _disposables: UniversalDisposable;
  _subscription: ?rxjs$ISubscription;

  constructor(props: ExpressionTreeNodeProps) {
    super(props);
    this._subscription = null;
    this._disposables = new UniversalDisposable();
    this._disposables.add(() => {
      if (this._subscription != null) {
        this._subscription.unsubscribe();
      }
    });
    this._toggleNodeExpanded = ignoreTextSelectionEvents(
      this._toggleExpand.bind(this),
    );
    this.state = {
      expanded: this._isExpanded(),
      children: Expect.pending(),
      isEditing: false,
      pendingValue: null,
      pendingSave: false,
    };
  }

  componentDidMount(): void {
    if (this.state.expanded) {
      this._fetchChildren();
    }
  }

  componentWillUnmount(): void {
    this._disposables.dispose();
  }

  _isExpandable = (): boolean => {
    if (this.props.pending) {
      return false;
    }
    return this.props.expression.hasChildren();
  };

  _isExpanded = (): boolean => {
    if (!this._isExpandable()) {
      return false;
    }
    const {expansionCache, nodePath} = this.props;
    return Boolean(expansionCache.get(nodePath));
  };

  _setExpanded = (expanded: boolean) => {
    const {expansionCache, nodePath} = this.props;
    expansionCache.set(nodePath, expanded);

    if (expanded) {
      this._fetchChildren();
    } else {
      this._stopFetchingChildren();
    }

    this.setState({
      expanded,
    });
  };

  _stopFetchingChildren = (): void => {
    if (this._subscription != null) {
      this._subscription.unsubscribe();
      this._subscription = null;
    }
  };

  _fetchChildren = (): void => {
    this._stopFetchingChildren();

    if (this._isExpandable()) {
      this._subscription = Observable.fromPromise(
        this.props.expression.getChildren(),
      )
        .catch(error => Observable.of([]))
        .map(children => Expect.value(((children: any): IExpression[])))
        .startWith(Expect.pending())
        .subscribe(children => {
          this.setState({
            children,
          });
        });
    }
  };

  _toggleExpand = (event: SyntheticMouseEvent<>): void => {
    this._setExpanded(!this.state.expanded);
    event.stopPropagation();
  };

  _renderValueLine = (
    expression: React.Element<any> | ?string,
    value: React.Element<any> | string,
  ): React.Element<any> => {
    if (expression == null) {
      return (
        <div className="nuclide-ui-expression-tree-value-container native-key-bindings">
          {value}
        </div>
      );
    } else {
      return this.props.hideExpressionName ? (
        <div className="nuclide-ui-lazy-nested-value-container native-key-bindings">
          {value}
        </div>
      ) : (
        <div className="nuclide-ui-lazy-nested-value-container native-key-bindings">
          <span className={ValueComponentClassNames.identifier}>
            {expression}
          </span>
          : {value}
        </div>
      );
    }
  };

  _renderChild = (child: IExpression): React.Node => {
    const nodePath = this.props.nodePath + '/' + child.name;
    return (
      <TreeItem key={nodePath}>
        <ExpressionTreeNode
          expression={child}
          expansionCache={this.props.expansionCache}
          nodePath={nodePath}
        />
      </TreeItem>
    );
  };

  _getVariableExpression(): ?IVariable {
    const {expression} = this.props;
    return (expression: any).canSetVariable == null ||
      (expression: any).setVariable == null
      ? null
      : (expression: any);
  }

  _isEditable = (): boolean => {
    const variable = this._getVariableExpression();
    return (
      variable != null && variable.canSetVariable() && !this.props.readOnly
    );
  };

  _updateValue = (): void => {
    const {pendingValue} = this.state;
    const variable = nullthrows(this._getVariableExpression());

    const doEdit = pendingValue != null;
    this._cancelEdit(doEdit);

    if (doEdit) {
      invariant(pendingValue != null);
      const subscription = Observable.fromPromise(
        variable.setVariable(pendingValue),
      )
        .catch(error => {
          if (error != null && error.message != null) {
            atom.notifications.addError(
              `Failed to set variable value: ${String(error.message)}`,
            );
          }
          return Observable.of(null);
        })
        .subscribe(() => {
          this._disposables.remove(subscription);
          this.setState({
            pendingSave: false,
          });
        });

      this._disposables.add(subscription);
    }
  };

  _cancelEdit = (pendingSave: ?boolean = false): void => {
    const newState: Object = {
      isEditing: false,
      pendingValue: null,
    };
    if (pendingSave != null) {
      newState.pendingSave = pendingSave;
    }
    this.setState(newState);
  };

  _startEdit = (): void => {
    this.setState({
      isEditing: true,
      pendingValue: null,
      pendingSave: false,
    });
  };

  _getValueAsString = (expression: IExpression): string => {
    const value = expression.getValue();
    if (value != null && expression.type === 'string') {
      return STRING_REGEX.test(value) ? value : `"${value}"`;
    }
    return value || '';
  };

  _setEditorGrammar = (editor: ?AtomInput): void => {
    if (editor == null) {
      return;
    }

    const variable = this._getVariableExpression();
    if (variable == null) {
      return;
    }

    if (variable.grammarName != null && variable.grammarName !== '') {
      const grammar = atom.grammars.grammarForScopeName(variable.grammarName);
      if (grammar == null) {
        return;
      }
      editor.getTextEditor().setGrammar(grammar);
    }
  };

  _renderEditView = (expression: IExpression): React.Element<any> => {
    return (
      <div className="expression-tree-line-control">
        <AtomInput
          className="expression-tree-value-box inline-block"
          size="sm"
          autofocus={true}
          startSelected={false}
          initialValue={this._getValueAsString(expression)}
          onDidChange={pendingValue => {
            this.setState({pendingValue: pendingValue.trim()});
          }}
          onConfirm={this._updateValue}
          onCancel={() => this._cancelEdit()}
          onBlur={() => this._cancelEdit()}
          ref={this._setEditorGrammar}
        />
        <Icon
          icon="check"
          title="Save changes"
          className="expression-tree-edit-button-confirm"
          onClick={this._updateValue}
        />
        <Icon
          icon="x"
          title="Cancel changes"
          className="expression-tree-edit-button-cancel"
          onClick={this._cancelEdit}
        />
      </div>
    );
  };

  _renderEditHoverControls(): ?React.Element<any> {
    if (!this._isEditable() || this.state.isEditing) {
      return null;
    }
    return (
      <div className="debugger-scopes-view-controls">
        <Icon
          icon="pencil"
          className="debugger-scopes-view-edit-control"
          onClick={_ => {
            track(EDIT_VALUE_FROM_ICON);
            this._startEdit();
          }}
        />
      </div>
    );
  }

  render(): React.Node {
    const {pending, expression} = this.props;
    const {pendingSave} = this.state;
    if (pending || pendingSave) {
      // Value not available yet. Show a delayed loading spinner.
      return (
        <TreeItem className="nuclide-ui-expression-tree-value-spinner">
          <LoadingSpinner size="EXTRA_SMALL" delay={SPINNER_DELAY} />
        </TreeItem>
      );
    }

    const isEditable = this._isEditable();
    if (!this._isExpandable()) {
      // This is a simple value with no children.
      return (
        <div
          onDoubleClick={
            isEditable && !this.state.isEditing ? this._startEdit : () => {}
          }
          className="expression-tree-line-control">
          {this.state.isEditing ? (
            this._renderEditView(expression)
          ) : (
            <span className="native-key-bindings expression-tree-value-box">
              <SimpleValueComponent expression={expression} />
            </span>
          )}
          {isEditable ? this._renderEditHoverControls() : null}
        </div>
      );
    }

    // A node with a delayed spinner to display if we're expanded, but waiting for
    // children to be fetched.
    const pendingChildrenNode = (
      <ExpressionTreeNode
        expression={this.props.expression}
        pending={true}
        expansionCache={this.props.expansionCache}
        nodePath={this.props.nodePath}
      />
    );

    // If collapsed, render no children. Otherwise either render the pendingChildrenNode
    // if the fetch hasn't completed, or the children if we've got them.
    let children;
    if (!this.state.expanded) {
      children = null;
    } else if (this.state.children.isPending) {
      children = pendingChildrenNode;
    } else if (this.state.children.isError) {
      children = this._renderValueLine(
        'Children',
        this.state.children.error != null
          ? this.state.children.error.toString()
          : NOT_AVAILABLE_MESSAGE,
      );
    } else {
      children = this.state.children.value.map(child =>
        this._renderChild(child),
      );
    }

    return (
      <TreeList
        showArrows={true}
        className="nuclide-ui-expression-tree-value-treelist">
        <NestedTreeItem
          collapsed={!this.state.expanded}
          onConfirm={isEditable ? this._startEdit : () => {}}
          onSelect={this.state.isEditing ? () => {} : this._toggleNodeExpanded}
          title={
            this.state.isEditing
              ? this._renderEditView(expression)
              : this._renderValueLine(expression.name, expression.getValue())
          }>
          {children}
        </NestedTreeItem>
      </TreeList>
    );
  }
}

export type ExpressionTreeComponentProps = {|
  expression: IExpression,
  containerContext: Object,
  pending?: boolean,
  className?: string,
  hideExpressionName?: boolean,
  readOnly?: boolean,
|};

export class ExpressionTreeComponent extends React.Component<
  ExpressionTreeComponentProps,
> {
  constructor(props: ExpressionTreeComponentProps) {
    super(props);
  }

  _getExpansionCache = (): Map<string, boolean> => {
    let cache = ExpansionStates.get(this.props.containerContext);
    if (cache == null) {
      cache = new Map();
      ExpansionStates.set(this.props.containerContext, cache);
    }
    return cache;
  };

  render(): React.Node {
    const className = classnames(this.props.className, {
      'nuclide-ui-expression-tree-value': this.props.className == null,
    });
    return (
      <span className={className} tabIndex={-1}>
        <ExpressionTreeNode
          expression={this.props.expression}
          pending={this.props.pending}
          nodePath="root"
          expansionCache={this._getExpansionCache()}
          hideExpressionName={this.props.hideExpressionName}
          readOnly={this.props.readOnly}
        />
      </span>
    );
  }
}
