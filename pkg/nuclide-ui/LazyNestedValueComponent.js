'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

// TODO @jxg export debugger typedefs from main module. (t11406963)
import type {
  EvaluationResult,
  ExpansionResult,
} from '../nuclide-debugger/lib/types';
import type {Observable} from 'rxjs';

import {React} from 'react-for-atom';
import invariant from 'assert';
import {bindObservableAsProps} from './bindObservableAsProps';
import {highlightOnUpdate} from './highlightOnUpdate';
import {ValueComponentClassNames} from './ValueComponentClassNames';
import {
  TreeList,
  TreeItem,
  NestedTreeItem,
} from './Tree';
import {LoadingSpinner} from './LoadingSpinner';
import ignoreTextSelectionEvents from './ignoreTextSelectionEvents';
import classnames from 'classnames';

const SPINNER_DELAY = 100; /* ms */
const NOT_AVAILABLE_MESSAGE = '<not available>';

function isObjectValue(result: EvaluationResult): boolean {
  return result.objectId != null;
}

function TreeItemWithLoadingSpinner(): React.Element<any> {
  return <TreeItem><LoadingSpinner size="EXTRA_SMALL" delay={SPINNER_DELAY} /></TreeItem>;
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
      {
        children.map(child =>
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
        )
      }
    </span>
  );
};

// TODO allow passing action components (edit button, pin button) here
function renderValueLine(
  expression: React.Element<any> | ?string,
  value: React.Element<any> | string,
): React.Element<any> {
  if (expression == null) {
    return <div className="nuclide-ui-lazy-nested-value-container">{value}</div>;
  } else {
    // TODO @jxg use a text editor to apply proper syntax highlighting for expressions (t11408154)
    return (
      <div className="nuclide-ui-lazy-nested-value-container">
        <span className={ValueComponentClassNames.identifier}>{expression}</span>
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
    const {
      path,
      expandedValuePaths,
      fetchChildren,
      evaluationResult,
    } = this.props;
    const nodeData = expandedValuePaths.get(path);
    if (
      !this.state.isExpanded &&
      nodeData != null &&
      nodeData.isExpanded &&
      this._shouldFetch() &&
      evaluationResult != null &&
      evaluationResult.objectId != null &&
      fetchChildren != null
    ) {
      invariant(evaluationResult.objectId != null);
      this.setState({
        children: fetchChildren(evaluationResult.objectId),
        isExpanded: true,
      });
    }
  }

  componentWillReceiveProps(nextProps: LazyNestedValueComponentProps): void {
    if (
      this._shouldFetch() &&
      this.state.isExpanded &&
      nextProps.evaluationResult != null &&
      nextProps.fetchChildren != null
    ) {
      const {objectId} = nextProps.evaluationResult;
      if (objectId == null) {
        return;
      }
      this.setState({
        children: nextProps.fetchChildren(objectId),
      });
    }
  }

  _shouldFetch(): boolean {
    const {shouldCacheChildren, getCachedChildren, path} = this.props;
    const children = getCachedChildren(path);
    return !shouldCacheChildren || children == null;
  }

  _toggleExpand(event: SyntheticMouseEvent): void {
    const {
      fetchChildren,
      evaluationResult,
      onExpandedStateChange,
      path,
    } = this.props;
    const newState: LazyNestedValueComponentState = {
      children: null,
      isExpanded: !this.state.isExpanded,
    };
    if (!this.state.isExpanded) {
      if (
        this._shouldFetch() &&
        typeof fetchChildren === 'function' &&
        evaluationResult != null &&
        evaluationResult.objectId != null
      ) {
        newState.children = fetchChildren(evaluationResult.objectId);
      }
    }
    onExpandedStateChange(path, newState.isExpanded);
    this.setState(newState);
    event.stopPropagation();
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
      return isRoot ? simpleValueElement : <TreeItem>{simpleValueElement}</TreeItem>;
    }
    const description = evaluationResult.description || '<no description provided>';
    const {
      children,
      isExpanded,
    } = this.state;
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
          children.map(childrenValue => ({children: childrenValue})).startWith({children: null}),
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
      <TreeList showArrows={true} className="nuclide-ui-lazy-nested-value-treelist">
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

type TopLevelValueComponentProps = {
  className?: string,
  evaluationResult: ?EvaluationResult,
  fetchChildren: ?(objectId: string) => Observable<?ExpansionResult>,
  expression: ?string,
  simpleValueComponent: ReactClass<any>,
  // $FlowIssue -- Flow's object spread operator inference is buggy.
  shouldCacheChildren: ?boolean,
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
class TopLevelLazyNestedValueComponent extends React.Component {
  // $FlowIssue `evaluationResult` gets injected via HOC.
  props: TopLevelValueComponentProps;
  shouldCacheChildren: boolean;

  constructor(props: TopLevelValueComponentProps) {
    super(props);
    (this: any).handleExpansionChange = this.handleExpansionChange.bind(this);
    (this: any).getCachedChildren = this.getCachedChildren.bind(this);
    (this: any).setCachedChildren = this.setCachedChildren.bind(this);
    this.shouldCacheChildren = this.props.shouldCacheChildren == null
      ? false
      : this.props.shouldCacheChildren;
  }

  handleExpansionChange(expandedValuePath: string, isExpanded: boolean): void {
    const expandedValuePaths = this.getExpandedValuePaths();
    const nodeData =
      expandedValuePaths.get(expandedValuePath) || {isExpanded, cachedChildren: null};
    if (isExpanded) {
      expandedValuePaths.set(expandedValuePath, {...nodeData, isExpanded: true});
    } else {
      expandedValuePaths.set(expandedValuePath, {...nodeData, isExpanded: false});
    }
  }

  getExpandedValuePaths(): Map<string, NodeData> {
    const reference = this.props.expansionStateId;
    let expandedValuePaths = expansionStates.get(reference);
    if (expandedValuePaths == null) {
      expandedValuePaths = new Map();
      expansionStates.set(reference, expandedValuePaths);
    }
    return expandedValuePaths;
  }

  getCachedChildren(path: string): ?ExpansionResult {
    const nodeData = this.getExpandedValuePaths().get(path);
    if (nodeData == null) {
      return null;
    } else {
      return nodeData.cachedChildren;
    }
  }

  setCachedChildren(path: string, children: ExpansionResult): void {
    const nodeData = this.getExpandedValuePaths().get(path);
    if (nodeData != null) {
      this.getExpandedValuePaths().set(path, {...nodeData, cachedChildren: children});
    }
  }

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
  undefined, /* custom classname */
  undefined, /* custom delay */
);
