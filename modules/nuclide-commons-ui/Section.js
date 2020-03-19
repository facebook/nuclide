/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow strict
 * @format
 */

import * as React from 'react';
import classnames from 'classnames';

type SectionSize = 'large' | 'medium' | 'small';
type Props = {
  headline: React.Node,
  className?: string,
  children?: React.Node,
  // Option A: Specify just `collapsable` for uncontrolled toggle behavior.
  collapsable?: boolean,
  // `collapsable` overrides this when specified.
  collapsedByDefault?: boolean,

  // Option B: Also specify `collapsed` and `onChange` for controlled toggle behavior.
  collapsed?: boolean,
  onChange?: (isCollapsed: boolean) => mixed,

  size?: SectionSize,
  title?: string,
};

type State = {
  isCollapsed: boolean,
};

/** A vertical divider with a title.
 * Specifying `collapsable` prop as true will add a clickable chevron icon that
 * collapses the component children. Optionally specify collapsedByDefault
 * (defaults to false)
 */
export class Section extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    const initialIsCollapsed: boolean =
      this.props.collapsable != null &&
      this.props.collapsable &&
      this.props.collapsedByDefault != null &&
      this.props.collapsedByDefault;
    this.state = {
      isCollapsed: initialIsCollapsed,
    };
  }

  _toggleCollapsed = (): void => {
    if (this.props.collapsed == null) {
      // uncontrolled mode
      // TODO: (wbinnssmith) T30771435 this setState depends on current state
      // and should use an updater function rather than an object
      // eslint-disable-next-line react/no-access-state-in-setstate
      this.setState({isCollapsed: !this.state.isCollapsed});
    } else {
      // controlled mode
      if (typeof this.props.onChange === 'function') {
        this.props.onChange(!this.props.collapsed);
      }
    }
  };

  render(): React.Node {
    const collapsable: boolean =
      this.props.collapsable != null ? this.props.collapsable : false;
    const collapsed =
      this.props.collapsed == null
        ? this.state.isCollapsed
        : this.props.collapsed;
    // Only include classes if the component is collapsable
    const iconClass = classnames({
      icon: collapsable,
      'icon-chevron-down': collapsable && !collapsed,
      'icon-chevron-right': collapsable && collapsed,
      'nuclide-ui-section-collapsable': collapsable,
    });
    const conditionalProps = {};
    if (collapsable) {
      conditionalProps.onClick = this._toggleCollapsed;
      conditionalProps.title = collapsed
        ? 'Click to expand'
        : 'Click to collapse';
    }
    // Any custom title prop should override the default title.
    if (this.props.title != null) {
      conditionalProps.title = this.props.title;
    }
    const HeadlineComponent = getHeadlineComponent(this.props.size);
    return (
      <div className={this.props.className}>
        <HeadlineComponent className={iconClass} {...conditionalProps}>
          {this.props.headline}
        </HeadlineComponent>
        <div
          style={collapsed ? {display: 'none'} : {}}
          className="nuclide-ui-section-body">
          {this.props.children}
        </div>
      </div>
    );
  }
}

function getHeadlineComponent(size?: string): 'h6' | 'h5' | 'h3' {
  switch (size) {
    case 'small':
      return 'h6';
    case 'medium':
      return 'h5';
    default:
      return 'h3';
  }
}
