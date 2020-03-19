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

import Tabs from 'nuclide-commons-ui/Tabs';
import {arrayCompact} from 'nuclide-commons/collection';
import * as React from 'react';
import classnames from 'classnames';

type Props = {
  // An array of possible tab names
  tabNames: Array<string>,
  // Any children rendered as null will have their tab name hidden
  children: Array<React.Node>,

  className?: ?string,
};

type State = {
  activeTabName: string,
};

// Tabbed Container which renders all of its children, but applies
// `display: none` to inactive ones. This allows tab changes to be very fast and
// not lose state on expensive-to-mount components
export default class TabbedContainer extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    const {children, tabNames} = props;
    const firstRealTabIndex = children.findIndex(val => val != null);
    this.state = {
      activeTabName: tabNames[Math.max(0, firstRealTabIndex)],
    };
  }

  static getDerivedStateFromProps(nextProps: Props, prevState: State): ?State {
    const {activeTabName} = prevState;
    const {tabNames, children} = nextProps;
    const activeTabIndex = tabNames.findIndex(name => name === activeTabName);
    if (children[activeTabIndex] == null) {
      return {
        ...prevState,
        activeTabName: tabNames[0],
      };
    }
    return null;
  }

  render(): React.Node {
    const {children, tabNames, className} = this.props;

    const visibleTabs = arrayCompact(
      tabNames.slice(0, children.length).map((name, tabIndex) => {
        if (children[tabIndex] == null) {
          return null;
        }
        return {name, tabContent: <div>{name}</div>};
      }),
    );

    if (visibleTabs.length === 0) {
      return null;
    }

    const {activeTabName} = this.state;
    const activeTabIndex = tabNames.findIndex(name => name === activeTabName);
    const wrappedChildren = arrayCompact(
      children.map((child, childIndex) => {
        if (child == null) {
          return null;
        }
        return (
          <div
            key={childIndex}
            className={classnames({
              hidden: childIndex !== activeTabIndex,
            })}>
            {child}
          </div>
        );
      }),
    );

    return (
      <div className={className}>
        <Tabs
          tabs={visibleTabs}
          activeTabName={this.state.activeTabName}
          triggeringEvent="onClick"
          onActiveTabChange={newTabName =>
            this.setState({activeTabName: newTabName.name})
          }
        />
        {wrappedChildren}
      </div>
    );
  }
}
