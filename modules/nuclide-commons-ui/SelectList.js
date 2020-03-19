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

import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import classnames from 'classnames';
import * as React from 'react';
import ReactDOM from 'react-dom';
import {scrollIntoViewIfNeeded} from './scrollIntoView';

type Option = {
  // $FlowFixMe(>=0.53.0) Flow suppress
  label: React.Children,
  value: any,
};

type Props = {
  // $FlowFixMe(>=0.53.0) Flow suppress
  optionComponent?: (props: OptionComponentProps) => React.Element<any>,
  // TODO: remove disable
  // eslint-disable-next-line react/no-unused-prop-types
  className?: string,
  options: Array<Option>,
  value: any,
  onChange: (value: any, index: number) => void,
  commandScope?: HTMLElement,
  tabIndex?: string,
};

type DefaultProps = {
  onChange: (value: any, index: number) => void,
  optionComponent: React.ComponentType<OptionComponentProps>,
  value: any,
  options: Array<Option>,
};

export default class SelectList extends React.Component<Props> {
  _commandsDisposables: UniversalDisposable;
  _activeElement: ?HTMLElement;

  static defaultProps: DefaultProps = {
    onChange: () => {},
    optionComponent: DefaultOptionComponent,
    options: [],
    value: null,
  };

  componentDidMount(): void {
    this._updateCommands();
  }

  componentDidUpdate(prevProps: Props): void {
    if (prevProps.commandScope !== this.props.commandScope) {
      this._updateCommands();
    }

    if (prevProps.value !== this.props.value) {
      this._scrollActiveElementIntoView();
    }
  }

  _scrollActiveElementIntoView(): void {
    if (this._activeElement == null) {
      return;
    }
    scrollIntoViewIfNeeded(this._activeElement);
  }

  _updateCommands(): void {
    if (this._commandsDisposables != null) {
      this._commandsDisposables.dispose();
    }
    const el = this.props.commandScope || ReactDOM.findDOMNode(this);
    this._commandsDisposables = new UniversalDisposable(
      atom.commands.add(
        // $FlowFixMe
        el,
        {
          'core:move-up': () => {
            this._moveSelectionIndex(-1);
          },
          'core:move-down': () => {
            this._moveSelectionIndex(1);
          },
        },
      ),
    );
  }

  _moveSelectionIndex(delta: number): void {
    const currentIndex = this.props.options.findIndex(
      option => option.value === this.props.value,
    );
    const nextIndex = currentIndex + delta;
    if (nextIndex < 0 || nextIndex >= this.props.options.length) {
      return;
    }
    this.props.onChange(this.props.options[nextIndex]?.value, nextIndex);
  }

  componentWillUnmount(): void {
    if (this._commandsDisposables != null) {
      this._commandsDisposables.dispose();
    }
  }

  render(): React.Node {
    return (
      <div
        className="nuclide-select-list select-list block"
        tabIndex={this.props.tabIndex ?? '0'}>
        <ol className="list-group mark-active">{this._renderOptions()}</ol>
      </div>
    );
  }

  _renderOptions(): Array<React.Element<any>> {
    const OptionComponent =
      this.props.optionComponent || DefaultOptionComponent;
    return this.props.options.map((option, index) => {
      const active = this.props.value === option.value;
      const className = classnames({
        clearfix: true,
        active,
      });
      let ref;
      if (active) {
        ref = el => {
          this._activeElement = el;
        };
      }
      return (
        <li
          key={index}
          className={className}
          // eslint-disable-next-line nuclide-internal/jsx-simple-callback-refs
          ref={ref}
          onClick={() => {
            this.props.onChange(option.value, index);
          }}>
          <OptionComponent option={option} active={active} />
        </li>
      );
    });
  }
}

export type OptionComponentProps = {
  option: Option,
  // TODO: remove disable
  /* eslint-disable react/no-unused-prop-types */
  active: boolean,
};

function DefaultOptionComponent(props: OptionComponentProps) {
  return <span>{props.option.label}</span>;
}
