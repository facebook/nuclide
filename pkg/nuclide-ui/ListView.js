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

import classnames from 'classnames';
import React from 'react';

import ignoreTextSelectionEvents from 'nuclide-commons-ui/ignoreTextSelectionEvents';

type ListViewItemProps = {
  index: number,
  value?: ?Object,
  children?: ?React.Element<any>,
  onSelect: (value: ?Object, index: number) => void,
};

/**
 * Use ListViewItem in conjunction with ListView.
 */
export class ListViewItem extends React.Component {
  // $FlowIssue `index` and `onSelect` are injected by the surrounding `ListView` component.
  props: ListViewItemProps;

  _select(value: ?Object, index: number, event: SyntheticMouseEvent): void {
    this.props.onSelect(value, index);
  }

  render(): React.Element<any> {
    const {children, index, value, ...remainingProps} = this.props;
    return (
      <div
        className="nuclide-ui-listview-item"
        {...remainingProps}
        onClick={ignoreTextSelectionEvents(
          this._select.bind(this, value, index),
        )}>
        {children}
      </div>
    );
  }
}

type ListViewProps = {
  /**
   * Whether to shade even and odd items differently.
   */
  alternateBackground?: boolean,
  children?: React.Element<any>,
  /**
   * Whether items can be selected.
   * If specified, `onSelect` must also be specified.
   */
  selectable?: boolean,
  /**
   * Handler to be called upon selection. Called iff `selectable` is `true`.
   */
  onSelect?: (selectedIndex: number, selectedData: ?Object) => mixed,
};

export class ListView extends React.Component {
  props: ListViewProps;

  _handleSelect = (
    value: ?Object,
    index: number,
    event: SyntheticMouseEvent,
  ): void => {
    if (this.props.selectable && this.props.onSelect != null) {
      this.props.onSelect(index, value);
    }
  };

  render(): React.Element<any> {
    const {children, alternateBackground, selectable} = this.props;
    const renderedItems = React.Children.map(
      children,
      (child: React.Element<any>, index: number) =>
        React.cloneElement(child, {
          index,
          onSelect: this._handleSelect,
        }),
    );
    const className = classnames({
      'native-key-bindings': true,
      'nuclide-ui-listview': true,
      'nuclide-ui-listview-highlight-odd': alternateBackground,
      'nuclide-ui-listview-selectable': selectable,
    });
    return (
      <div className={className} tabIndex={-1}>
        {renderedItems}
      </div>
    );
  }
}
