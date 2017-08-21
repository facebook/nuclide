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

import type {BoundActionCreators, Parameter} from './types';

import React from 'react';
import {Button, ButtonTypes} from 'nuclide-commons-ui/Button';
import {ButtonGroup} from 'nuclide-commons-ui/ButtonGroup';
import {Dropdown} from '../../nuclide-ui/Dropdown';
import {AtomTextEditor} from 'nuclide-commons-ui/AtomTextEditor';
import {AtomInput} from 'nuclide-commons-ui/AtomInput';
import {ParameterInput} from './ParameterInput';
import invariant from 'assert';
import shallowequal from 'shallowequal';

type Headers = {[key: string]: string};

type PropsType = {
  actionCreators: BoundActionCreators,
  uri: string,
  method: string,
  headers: Headers,
  body: ?string,
  parameters: Array<Parameter>,
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
    (this: any)._handleParameterChange = this._handleParameterChange.bind(this);
    (this: any)._handleRemoveParameter = this._handleRemoveParameter.bind(this);
    (this: any)._getParameters = this._getParameters.bind(this);
  }

  shouldComponentUpdate(nextProps: PropsType): boolean {
    const {uri, method, headers, body, parameters} = this.props;
    return (
      nextProps.uri !== uri ||
      nextProps.method !== method ||
      nextProps.body !== body ||
      !shallowequal(nextProps.headers, headers) ||
      !shallowequal(nextProps.parameters, parameters)
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

  _onSendHttpRequest = (): void => {
    this.props.actionCreators.sendHttpRequest();
    this._toggleDialog();
  };

  _onCancel = (): void => {
    this._toggleDialog();
  };

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

  _renderRequestBody(): React.Element<any> | null {
    if (this.props.method !== 'POST') {
      return null;
    }

    return (
      <div>
        <label>Body</label>
        <AtomInput
          onDidChange={body => this.props.actionCreators.updateState({body})}
        />
      </div>
    );
  }

  _renderRequestParameters(): React.Element<any> | null {
    const parameterObj = {};
    return (
      <div>
        <label>Parameters</label>
        <div className="nuclide-parameter-input-container">
          <label>Key</label>
          <label>Value</label>
        </div>
        {this.props.parameters.map((parameter, index) => {
          if (!parameter) {
            return null;
          }
          const key = parameter.key;
          const value = parameter.value;
          const trimmedKey = key.trim();
          const output = (
            <ParameterInput
              key={index}
              index={index}
              paramKey={key}
              paramValue={value}
              isDuplicate={Boolean(key && parameterObj[trimmedKey])}
              updateParameter={this._handleParameterChange}
              removeParameter={this._handleRemoveParameter}
            />
          );

          parameterObj[trimmedKey] = true;
          return output;
        })}
      </div>
    );
  }

  _getParameters() {
    return this.props.parameters.map(
      param => (param == null ? null : {...param}),
    );
  }

  _handleParameterChange(index: number, parameter: Parameter): void {
    const parameters = this._getParameters();
    parameters[index] = parameter;
    this._updateParameterState(index, parameters);
  }

  _handleRemoveParameter(index: number): void {
    const parameters = this._getParameters();
    parameters[index] = null;
    this._updateParameterState(index, parameters);
  }

  _updateParameterState(
    modifiedIndex: number,
    parameters: Array<Parameter>,
  ): void {
    // If last parameter is modified, add new parameter
    if (modifiedIndex === parameters.length - 1) {
      parameters.push({key: '', value: ''});
    }

    this.props.actionCreators.updateState({parameters});
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
          <label>Method:</label>
          <Dropdown
            className="nuclide-edit-request-method-select"
            value={this.props.method}
            options={METHOD_DROPDOWN_OPTIONS}
            onChange={method => this.props.actionCreators.updateState({method})}
          />
          {this._renderRequestParameters()}
          {this._renderRequestBody()}
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
