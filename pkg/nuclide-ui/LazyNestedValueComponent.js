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
import type {
  EvaluationResult,
  ExpansionResult,
} from '../nuclide-debugger/lib/types';
import type {Observable} from 'rxjs';

import React from 'react';
import invariant from 'assert';
import {bindObservableAsProps} from 'nuclide-commons-ui/bindObservableAsProps';
import {highlightOnUpdate} from './highlightOnUpdate';
import {ValueComponentClassNames} from './ValueComponentClassNames';
import {TreeList, TreeItem, NestedTreeItem} from './Tree';
import {LoadingSpinner} from 'nuclide-commons-ui/LoadingSpinner';
import ignoreTextSelectionEvents from 'nuclide-commons-ui/ignoreTextSelectionEvents';
import classnames from 'classnames';

const SPINNER_DELAY = 100; /* ms */
const NOT_AVAILABLE_MESSAGE = '<not available>';

function isObjectValue(result: EvaluationResult): boolean {
  return result.objectId != null;
}

function TreeItemWithLoadingSpinner(): React.Element<any> {
  return (
    <TreeItem className="nuclide-ui-lazy-nested-value-spinner">
      <LoadingSpinner size="EXTRA_SMALL" delay={SPINNER_DELAY} />
    </TreeItem>
  );
}

type LoadableValueComponentProps = {
  children?: ExpansionResult,
  fetchChildren: ?(objectId: string) => Observable<?ExpansionResult>,
  path: string,
  expandedValuePaths: Map<string, NodeData>,
  onExpandedStateChange: (path: string, isExpanded: boolean) => void,
  simpleValueComponent: ReactClass<any>,
  shouldCacheChildren: boolean,
  getCachedChildren: (path: string) => ?ExpansionResult,
  setCachedChildren: (path: string, children: ExpansionResult) => void,
};

/**
 * A wrapper that renders a (delayed) spinner while the list of child properties is being loaded.
 * Otherwise, it renders ValueComponent for each property in `children`.
 */
const LoadableValueComponent = (props: LoadableValueComponentProps) => {
  const {
    children,
    fetchChildren,
    path,
    expandedValuePaths,
    onExpandedStateChange,
    simpleValueComponent,
    shouldCacheChildren,
    getCachedChildren,
    setCachedChildren,
  } = props;
  if (children == null) {
    return TreeItemWithLoadingSpinner();
  }
  if (shouldCacheChildren) {
    setCachedChildren(path, children);
  }
  return (
    <span>
      {children.map(child =>
        <TreeItem key={child.name}>
          <ValueComponent
            evaluationResult={child.value}
            fetchChildren={fetchChildren}
            expression={child.name}
            expandedValuePaths={expandedValuePaths}
            onExpandedStateChange={onExpandedStateChange}
            path={path + '.' + child.name}
            simpleValueComponent={simpleValueComponent}
            shouldCacheChildren={shouldCacheChildren}
            getCachedChildren={getCachedChildren}
            setCachedChildren={setCachedChildren}
          />
        </TreeItem>,
      )}
    </span>
  );
};

// TODO allow passing action components (edit button, pin button) here
function renderValueLine(
  expression: React.Element<any> | ?string,
  value: React.Element<any> | string,
): React.Element<any> {
  if (expression == null) {
    return (
      <div className="nuclide-ui-lazy-nested-value-container">
        {value}
      </div>
    );
  } else {
    // TODO @jxg use a text editor to apply proper syntax highlighting for expressions (t11408154)
    return (
      <div className="nuclide-ui-lazy-nested-value-container">
        <span className={ValueComponentClassNames.identifier}>
          {expression}
        </span>
        : {value}
      </div>
    );
  }
}

type LazyNestedValueComponentProps = {
  evaluationResult: ?EvaluationResult,
  fetchChildren: ?(objectId: string) => Observable<?ExpansionResult>,
  expression: ?string,
  isRoot?: boolean,
  expandedValuePaths: Map<string, NodeData>,
  onExpandedStateChange: (path: string, expanded: boolean) => void,
  path: string,
  simpleValueComponent: ReactClass<any>,
  shouldCacheChildren: boolean,
  getCachedChildren: (path: string) => ?ExpansionResult,
  setCachedChildren: (path: string, children: ExpansionResult) => void,
};

type LazyNestedValueComponentState = {
  isExpanded: boolean,
  children: ?Observable<?ExpansionResult>,
};

/**
 * A component that knows how to render recursive, interactive expression/evaluationResult pairs.
 * The rendering of non-expandable "leaf" values is delegated to the SimpleValueComponent.
 */
class ValueComponent extends React.Component {
  props: LazyNestedValueComponentProps;
  state: LazyNestedValueComponentState;

  _toggleExpandFiltered: (e: SyntheticMouseEvent) => void;

  constructor(props: LazyNestedValueComponentProps) {
    super(props);
    this.state = {
      isExpanded: false,
      children: null,
    };
    (this: any)._toggleExpandFiltered = ignoreTextSelectionEvents(
      this._toggleExpand.bind(this),
    );
  }

  componentDidMount(): void {
    this.setState(this._getNextState(this.props));
  }

  componentWillReceiveProps(nextProps: LazyNestedValueComponentProps): void {
    this.setState(this._getNextState(nextProps));
  }

  _toggleExpand(event: SyntheticMouseEvent): void {
    const {onExpandedStateChange, path} = this.props;
    const newState = this._getNextState(this.props, true /* toggleExpansion */);
    onExpandedStateChange(path, newState.isExpanded);
    this.setState(newState);
    event.stopPropagation();
  }

  /**
   * Constructs the corresponding state object based on the provided props.
   *
   * NOTE: This should be used to set the state when the props change or when
   *       the expansion state of the object is being toggled by the user.
   *
   * The expansion state (isExpanded) of this component is cached so it can
   * be saved across re-renders. Because of this isExpanded is set to the
   * cached value, with a default of false. If the expansion state is being
   * toggled, it is instead set to the opposite of its current state value.
   *
   * This component is also responsible for loading its children, if they
   * exist, by calling props.fetchChildren() and storing the result in the
   * state. This needs to happen when the component is expanded and the
   * children exist and have not already been loaded and cached. So based on
   * the new value of isExpanded, children is set appropriately
   * (see shouldFetchChildren()).
   */
  _getNextState(
    props: LazyNestedValueComponentProps,
    toggleExpansion?: boolean,
  ): LazyNestedValueComponentState {
    let isExpanded = false;
    let children = null;
    // The value of isExpanded is taken from its cached value in nodeData
    // unless it is being toggled. In that case, we toggle the current value.
    if (!toggleExpansion) {
      const {path, expandedValuePaths} = props;
      const nodeData = expandedValuePaths.get(path);
      isExpanded = nodeData != null && nodeData.isExpanded;
    } else {
      isExpanded = !this.state.isExpanded;
    }
    // Children are loaded if the component will be expanded
    // and other conditions (see shouldFetchChildren()) are true
    if (isExpanded && shouldFetchChildren(props)) {
      invariant(props.fetchChildren != null);
      invariant(props.evaluationResult != null);
      invariant(props.evaluationResult.objectId != null);
      children = props.fetchChildren(props.evaluationResult.objectId);
    }

    return {isExpanded, children};
  }

  render(): ?React.Element<any> {
    const {
      evaluationResult,
      expression,
      fetchChildren,
      isRoot,
      path,
      expandedValuePaths,
      onExpandedStateChange,
      shouldCacheChildren,
      getCachedChildren,
      setCachedChildren,
      simpleValueComponent: SimpleValueComponent,
    } = this.props;
    if (evaluationResult == null) {
      return renderValueLine(expression, NOT_AVAILABLE_MESSAGE);
    }
    if (!isObjectValue(evaluationResult)) {
      const simpleValueElement = (
        <SimpleValueComponent
          expression={expression}
          evaluationResult={evaluationResult}
          simpleValueComponent={SimpleValueComponent}
        />
      );
      return isRoot
        ? simpleValueElement
        : <TreeItem>
            {simpleValueElement}
          </TreeItem>;
    }
    const description =
      // flowlint-next-line sketchy-null-string:off
      evaluationResult.description || '<no description provided>';
    const {children, isExpanded} = this.state;
    let childListElement = null;
    if (isExpanded) {
      const cachedChildren = getCachedChildren(path);
      if (shouldCacheChildren && cachedChildren != null) {
        childListElement = (
          <LoadableValueComponent
            children={cachedChildren}
            fetchChildren={fetchChildren}
            path={path}
            expandedValuePaths={expandedValuePaths}
            onExpandedStateChange={onExpandedStateChange}
            simpleValueComponent={SimpleValueComponent}
            shouldCacheChildren={shouldCacheChildren}
            getCachedChildren={getCachedChildren}
            setCachedChildren={setCachedChildren}
          />
        );
      } else if (children == null) {
        childListElement = <TreeItemWithLoadingSpinner />;
      } else {
        const ChildrenComponent = bindObservableAsProps(
          children
            .map(childrenValue => ({children: childrenValue}))
            .startWith({children: null}),
          LoadableValueComponent,
        );
        childListElement = (
          <ChildrenComponent
            fetchChildren={fetchChildren}
            path={path}
            expandedValuePaths={expandedValuePaths}
            onExpandedStateChange={onExpandedStateChange}
            simpleValueComponent={SimpleValueComponent}
            shouldCacheChildren={shouldCacheChildren}
            getCachedChildren={getCachedChildren}
            setCachedChildren={setCachedChildren}
          />
        );
      }
    }
    const title = renderValueLine(expression, description);
    return (
      <TreeList
        showArrows={true}
        className="nuclide-ui-lazy-nested-value-treelist">
        <NestedTreeItem
          collapsed={!this.state.isExpanded}
          onClick={this._toggleExpandFiltered}
          title={title}>
          {childListElement}
        </NestedTreeItem>
      </TreeList>
    );
  }
}

function shouldFetchChildren(props: LazyNestedValueComponentProps): boolean {
  const {fetchChildren, evaluationResult} = props;
  return (
    shouldFetchBecauseNothingIsCached(props) &&
    typeof fetchChildren === 'function' &&
    evaluationResult != null &&
    evaluationResult.objectId != null
  );
}

function shouldFetchBecauseNothingIsCached(
  props: LazyNestedValueComponentProps,
): boolean {
  const {shouldCacheChildren, getCachedChildren, path} = props;
  const children = getCachedChildren(path);
  return !shouldCacheChildren || children == null;
}

type TopLevelValueComponentProps = {
  className?: string,
  evaluationResult: ?EvaluationResult,
  fetchChildren: ?(objectId: string) => Observable<?ExpansionResult>,
  expression?: string,
  simpleValueComponent: ReactClass<any>,
  shouldCacheChildren?: boolean,
  // An (arbitrary) reference object used to track expansion state of the component's
  // children across multiple re-renders. To ensure persistent re-use of the  expansion state,
  // simply continue passing the same instance.
  expansionStateId: Object,
};

type NodeData = {
  isExpanded: boolean,
  cachedChildren: ?ExpansionResult,
};

const expansionStates: WeakMap<Object, Map<string, NodeData>> = new WeakMap();
/**
 * TopLevelValueComponent wraps all expandable value components. It is in charge of keeping track
 * of the set of recursively expanded values. The set is keyed by a "path", which is a string
 * containing the concatenated object keys of all recursive parent object for a given item. This
 * is necessary to preserve the expansion state while the values are temporarily unavailable, such
 * as after stepping in the debugger, which triggers a recursive re-fetch.
 */
class TopLevelLazyNestedValueComponent extends React.PureComponent {
  props: TopLevelValueComponentProps;
  shouldCacheChildren: boolean;

  constructor(props: TopLevelValueComponentProps) {
    super(props);
    this.shouldCacheChildren =
      this.props.shouldCacheChildren == null
        ? false
        : this.props.shouldCacheChildren;
  }

  handleExpansionChange = (
    expandedValuePath: string,
    isExpanded: boolean,
  ): void => {
    const expandedValuePaths = this.getExpandedValuePaths();
    const nodeData = expandedValuePaths.get(expandedValuePath) || {
      isExpanded,
      cachedChildren: null,
    };
    if (isExpanded) {
      expandedValuePaths.set(expandedValuePath, {
        ...nodeData,
        isExpanded: true,
      });
    } else {
      expandedValuePaths.set(expandedValuePath, {
        ...nodeData,
        isExpanded: false,
      });
    }
  };

  getExpandedValuePaths(): Map<string, NodeData> {
    const reference = this.props.expansionStateId;
    let expandedValuePaths = expansionStates.get(reference);
    if (expandedValuePaths == null) {
      expandedValuePaths = new Map();
      expansionStates.set(reference, expandedValuePaths);
    }
    return expandedValuePaths;
  }

  getCachedChildren = (path: string): ?ExpansionResult => {
    const nodeData = this.getExpandedValuePaths().get(path);
    if (nodeData == null) {
      return null;
    } else {
      return nodeData.cachedChildren;
    }
  };

  setCachedChildren = (path: string, children: ExpansionResult): void => {
    const nodeData = this.getExpandedValuePaths().get(path);
    if (nodeData != null) {
      this.getExpandedValuePaths().set(path, {
        ...nodeData,
        cachedChildren: children,
      });
    }
  };

  render(): React.Element<any> {
    const className = classnames(this.props.className, {
      'native-key-bindings': true,
      // Note(vjeux): the following line should probably be `: true`
      'nuclide-ui-lazy-nested-value': this.props.className == null,
    });
    return (
      <span className={className} tabIndex={-1}>
        <ValueComponent
          {...this.props}
          isRoot={true}
          expandedValuePaths={this.getExpandedValuePaths()}
          onExpandedStateChange={this.handleExpansionChange}
          path="root"
          shouldCacheChildren={this.shouldCacheChildren}
          getCachedChildren={this.getCachedChildren}
          setCachedChildren={this.setCachedChildren}
        />
      </span>
    );
  }
}

function arePropsEqual(
  p1: LazyNestedValueComponentProps,
  p2: LazyNestedValueComponentProps,
): boolean {
  const evaluationResult1 = p1.evaluationResult;
  const evaluationResult2 = p2.evaluationResult;
  if (evaluationResult1 === evaluationResult2) {
    return true;
  }
  if (evaluationResult1 == null || evaluationResult2 == null) {
    return false;
  }
  return (
    evaluationResult1.value === evaluationResult2.value &&
    evaluationResult1.type === evaluationResult2.type &&
    evaluationResult1.description === evaluationResult2.description
  );
}
export const LazyNestedValueComponent = highlightOnUpdate(
  TopLevelLazyNestedValueComponent,
  arePropsEqual,
  undefined /* custom classname */,
  undefined /* custom delay */,
);
