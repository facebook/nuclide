/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow strict-local
 * @format
 */

/* global Node */

import {AtomInput} from './AtomInput';
import {Button, ButtonTypes} from './Button';
import {ButtonGroup, ButtonGroupSizes} from './ButtonGroup';
import * as React from 'react';
import ReactDOM from 'react-dom';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import invariant from 'assert';
import nullthrows from 'nullthrows';

export default function quickInputDialog(
  title: string,
  inputLabel: string,
  onConfirm: ?(string) => mixed,
  validateInput: string => ?string,
  initialValue: string = '',
): Promise<?string> {
  const item = document.createElement('div');
  const panel = atom.workspace.addModalPanel({item});

  return new Promise((resolve, reject) => {
    const cancel = () => {
      panel.destroy();
      resolve(null);
    };

    ReactDOM.render(
      <QuickInputDialog
        validateInput={validateInput}
        initialValue={initialValue}
        inputLabel={inputLabel}
        onCancel={cancel}
        onConfirm={content => {
          if (onConfirm) {
            onConfirm(content);
          }

          resolve(content);
          panel.destroy();
        }}
        title={title}
      />,
      item,
    );

    panel.onDidDestroy(() => ReactDOM.unmountComponentAtNode(item));
  });
}

type Props = {
  validateInput: string => ?string,
  initialValue: string,
  inputLabel: string,
  onCancel: () => mixed,
  onConfirm: string => mixed,
  title: string,
};

type State = {
  content: string,
};

class QuickInputDialog extends React.Component<Props, State> {
  _disposables: UniversalDisposable;
  _rootNode: ?HTMLDivElement;

  constructor(props: Props) {
    super(props);

    this.state = {
      content: props.initialValue,
    };

    this._disposables = new UniversalDisposable();
  }

  componentDidMount(): void {
    document.addEventListener('click', this._handleOutsideClick);
    const rootNode = nullthrows(this._rootNode);

    this._disposables.add(
      () => document.removeEventListener('click', this._handleOutsideClick),
      atom.commands.add(rootNode, 'core:confirm', this._handleConfirmClick),
      atom.commands.add(rootNode, 'core:cancel', this.props.onCancel),
    );
  }

  componentWillUnmount(): void {
    this._disposables.dispose();
  }

  _handleOutsideClick = (event: Event): void => {
    const domNode = this._rootNode;
    invariant(event.target instanceof Node);
    if (!domNode || !domNode.contains(event.target)) {
      this.props.onCancel();
    }
  };

  _handleConfirmClick = (): void => {
    this.props.onConfirm(this.state.content);
  };

  _handleInputChange = (content: string): void => {
    this.setState({content});
  };

  render(): React.Node {
    const errorMessage = this.props.validateInput(this.state.content);
    return (
      <div ref={rootNode => (this._rootNode = rootNode)}>
        <h6>
          <strong>{this.props.title}</strong>
        </h6>
        <label>{this.props.inputLabel}</label>
        <AtomInput
          autofocus={true}
          initialValue={this.props.initialValue}
          onDidChange={this._handleInputChange}
          startSelected={true}
        />
        <div style={{display: 'flex', justifyContent: 'space-between'}}>
          <span>{errorMessage}</span>
          <ButtonGroup size={ButtonGroupSizes.SMALL}>
            <Button onClick={this.props.onCancel}>Cancel</Button>
            <Button
              buttonType={ButtonTypes.PRIMARY}
              disabled={errorMessage != null}
              onClick={this._handleConfirmClick}>
              Confirm
            </Button>
          </ButtonGroup>
        </div>
      </div>
    );
  }
}
