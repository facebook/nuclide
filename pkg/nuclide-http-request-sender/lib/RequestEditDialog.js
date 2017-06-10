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

import type {BoundActionCreators} from './types';

import React from 'react';
import {AtomInput} from 'nuclide-commons-ui/AtomInput';
import {Button, ButtonTypes} from 'nuclide-commons-ui/Button';
import {ButtonGroup} from 'nuclide-commons-ui/ButtonGroup';
import {Dropdown} from '../../nuclide-ui/Dropdown';
import {AtomTextEditor} from 'nuclide-commons-ui/AtomTextEditor';
import invariant from 'assert';
import shallowequal from 'shallowequal';

type Headers = {[key: string]: string};

type PropsType = {
  actionCreators: BoundActionCreators,
  uri: string,
  method: string,
  headers: Headers,
  body: ?string,
};

const METHOD_DROPDOWN_OPTIONS = [
  {label: 'GET', value: 'GET'},
  {label: 'POST', value: 'POST'},
];

export class RequestEditDialog extends React.Component<void, PropsType, void> {
  props: PropsType;
  _editorComponent: ?AtomTextEditor;

  constructor(props: PropsType) {
    super(props);
    this._editorComponent = null;
    (this: any)._onCancel = this._onCancel.bind(this);
    (this: any)._onSendHttpRequest = this._onSendHttpRequest.bind(this);
  }

  shouldComponentUpdate(nextProps: PropsType): boolean {
    const {uri, method, headers, body} = this.props;
    return (
      nextProps.uri !== uri ||
      nextProps.method !== method ||
      nextProps.body !== body ||
      !shallowequal(nextProps.headers, headers)
    );
  }

  componentDidMount(): void {
    this._componentDidRender();
  }

  componentDidUpdate(): void {
    this._componentDidRender();
  }

  /**
   * This method should be called after every render to set the AtomTextEditor text.
   */
  _componentDidRender(): void {
    const editorComponent = this._editorComponent;
    invariant(editorComponent != null);
    const editor = editorComponent.getModel();
    invariant(editor != null);
    const jsonGrammar = atom.grammars.grammarForScopeName('source.json');
    invariant(jsonGrammar != null);
    editor.setGrammar(jsonGrammar);
    editor.setText(JSON.stringify(this.props.headers, null, 2));
  }

  _onSendHttpRequest(): void {
    this.props.actionCreators.sendHttpRequest();
    this._toggleDialog();
  }

  _onCancel(): void {
    this._toggleDialog();
  }

  _toggleDialog(): void {
    atom.commands.dispatch(
      atom.views.getView(atom.workspace),
      'nuclide-http-request-sender:toggle-http-request-edit-dialog',
    );
  }

  _handleTextBufferChange(event: atom$TextEditEvent): void {
    // TODO: It's better to store changes, even if they are illegal JSON.
    let headers;
    try {
      headers = JSON.parse(event.newText);
    } catch (_) {
      return; // Do not store illegal JSON.
    }
    this.props.actionCreators.updateState({headers});
  }

  render(): React.Element<any> {
    return (
      <div className="block">
        <div className="nuclide-edit-request-dialog">
          <label>URI: </label>
          <AtomInput
            tabIndex="1"
            placeholderText="https://www.facebook.com"
            value={this.props.uri}
            onDidChange={uri => this.props.actionCreators.updateState({uri})}
          />
          <label>Method: </label>
          <Dropdown
            value={this.props.method}
            options={METHOD_DROPDOWN_OPTIONS}
            onChange={method => this.props.actionCreators.updateState({method})}
          />
          {this.props.method !== 'POST'
            ? null
            : <div>
                <label>Body</label>
                <AtomInput
                  tabIndex="2"
                  onDidChange={body =>
                    this.props.actionCreators.updateState({body})}
                />
              </div>}
          <label>Headers: </label>
          <div className="nuclide-http-request-sender-headers">
            <AtomTextEditor
              ref={editorComponent => {
                this._editorComponent = editorComponent;
              }}
              tabIndex="3"
              autoGrow={false}
              softWrapped={true}
              onDidTextBufferChange={this._handleTextBufferChange.bind(this)}
            />
          </div>
          <ButtonGroup className="nuclide-http-request-sender-button-group">
            <Button
              buttonType={ButtonTypes.PRIMARY}
              tabIndex="5"
              onClick={this._onSendHttpRequest}>
              Send HTTP Request
            </Button>
            <Button tabIndex="4" onClick={this._onCancel}>
              Cancel
            </Button>
          </ButtonGroup>
        </div>
      </div>
    );
  }
}
