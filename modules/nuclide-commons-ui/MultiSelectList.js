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
  value: Array<any>,
  onChange: (value: Array<any>) => void,
  commandScope?: HTMLElement,
};

type State = {
  selectedValue: any,
};

type DefaultProps = {
  onChange: (value: Array<any>) => void,
  optionComponent: React.ComponentType<OptionComponentProps>,
  value: Array<any>,
  options: Array<Option>,
};

export class MultiSelectList extends React.Component<Props, State> {
  _commandsDisposables: UniversalDisposable;

  static defaultProps: DefaultProps = {
    onChange: values => {},
    optionComponent: DefaultOptionComponent,
    options: [],
    value: [],
  };

  constructor(props: Props) {
    super(props);
    this.state = {
      selectedValue: null,
    };
  }

  componentDidMount(): void {
    this._updateCommands();
  }

  componentDidUpdate(prevProps: Props): void {
    if (prevProps.commandScope !== this.props.commandScope) {
      this._updateCommands();
    }
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
          'core:confirm': () => {
            const {selectedValue} = this.state;
            if (selectedValue != null) {
              this._toggleActive(selectedValue);
            }
          },
        },
      ),
    );
  }

  _moveSelectionIndex(delta: number): void {
    const currentIndex = this.props.options.findIndex(
      option => option.value === this.state.selectedValue,
    );
    const nextIndex = currentIndex + delta;
    if (nextIndex >= 0 && nextIndex < this.props.options.length) {
      this.setState({selectedValue: this.props.options[nextIndex].value});
    }
  }

  componentWillUnmount(): void {
    if (this._commandsDisposables != null) {
      this._commandsDisposables.dispose();
    }
  }

  _toggleActive(value: any): void {
    const activeValues = this.props.value.slice();
    const index = activeValues.indexOf(value);
    if (index === -1) {
      activeValues.push(value);
    } else {
      activeValues.splice(index, 1);
    }
    this.props.onChange(activeValues);
  }

  render(): React.Node {
    return (
      <div className="nuclide-multi-select-list select-list block" tabIndex="0">
        <ol className="list-group mark-active">{this._renderOptions()}</ol>
      </div>
    );
  }

  _renderOptions(): Array<React.Element<any>> {
    const OptionComponent =
      this.props.optionComponent || DefaultOptionComponent;
    return this.props.options.map((option, index) => {
      const selected = this.state.selectedValue === option.value;
      const active = this.props.value.indexOf(option.value) !== -1;
      const className = classnames({
        clearfix: true,
        selected,
        active,
      });
      return (
        <li
          key={index}
          className={className}
          onMouseOver={() => {
            this.setState({selectedValue: option.value});
          }}
          onClick={() => {
            this._toggleActive(option.value);
          }}>
          <OptionComponent
            option={option}
            active={active}
            selected={selected}
          />
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
  selected: boolean,
  /* eslint-enable react/no-unused-prop-types */
};

function DefaultOptionComponent(props: OptionComponentProps) {
  return <span>{props.option.label}</span>;
}
