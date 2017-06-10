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

import {observableFromSubscribeFunction} from 'nuclide-commons/event';
import {indent} from 'nuclide-commons/string';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {AtomInput} from 'nuclide-commons-ui/AtomInput';
import {AtomTextEditor} from 'nuclide-commons-ui/AtomTextEditor';
import {Button} from 'nuclide-commons-ui/Button';
import {ButtonGroup} from 'nuclide-commons-ui/ButtonGroup';
import invariant from 'assert';
import React from 'react';
import {Observable} from 'rxjs';

export type Message =
  | {|
      kind: 'response',
      body: string,
    |}
  | {|
      kind: 'request',
      body: string,
    |};

type Props = {
  initialCommand: string,
  initialMessage: string,
  messages: Observable<Message>,
  running: boolean,
  sendMessage(message: Object): void,
  startServer: (command: string) => void,
  stopServer: () => void,
};

type State = {
  grammar: ?atom$Grammar,
};

export class PanelView extends React.Component {
  props: Props;
  state: State;
  _disposables: ?UniversalDisposable;

  constructor(props: Props) {
    super(props);
    (this: any)._handleSendButtonClick = this._handleSendButtonClick.bind(this);
    (this: any)._handleStartButtonClick = this._handleStartButtonClick.bind(
      this,
    );
    this.state = {
      grammar: null,
    };
  }

  componentWillUnmount(): void {
    invariant(this._disposables != null);
    this._disposables.unsubscribe();
  }

  render(): React.Element<any> {
    return (
      <div className="sample-lsp-tester-panel padded">
        <div className="sample-lsp-tester-command-wrapper">
          <AtomInput
            ref="commandField"
            className="sample-lsp-tester-command"
            placeholderText="Command to Run (e.g. node jsonServerMain.js --stdio)"
          />
          <ButtonGroup>
            <Button
              icon="triangle-right"
              disabled={this.props.running}
              onClick={this._handleStartButtonClick}
            />
            <Button
              icon="primitive-square"
              disabled={!this.props.running}
              onClick={this.props.stopServer}
            />
          </ButtonGroup>
        </div>
        <AtomTextEditor
          ref="inputField"
          className="sample-lsp-tester-input"
          grammar={this.state.grammar}
          gutterHidden={true}
          placeholderText="Enter JSON message"
        />
        <Button
          buttonType="PRIMARY"
          disabled={!this.props.running}
          onClick={this._handleSendButtonClick}>
          Send
        </Button>
        <div className="sample-lsp-tester-output-wrapper">
          <label>Output:</label>
          <AtomTextEditor
            ref="outputField"
            className="sample-lsp-tester-output"
            gutterHidden={true}
            disabled={true}
          />
        </div>
      </div>
    );
  }

  _handleStartButtonClick(): void {
    const commandString = this.refs.commandField.getText();
    this.props.startServer(commandString.trim());
  }

  componentDidMount(): void {
    // Fill in initial command
    this.refs.commandField.setText(this.props.initialCommand || '');

    // Fill in initial message text.
    this.refs.inputField.getModel().setText(this.props.initialMessage);

    this._disposables = new UniversalDisposable(
      // Subscribe to the responses. Note that we don't handle this prop changing after mount.
      this.props.messages
        .map(
          message =>
            `${message.kind.toUpperCase()}...\n${indent(message.body)}`,
        )
        .subscribe(data => {
          const textEditor = this.refs.outputField.getModel();
          textEditor.getBuffer().append(`${data}\n\n`);
          (atom.views.getView(textEditor): any).scrollToBottom();
        }),
      getGrammar('source.json').subscribe(grammar => {
        this.setState({grammar});
      }),
    );
  }

  _handleSendButtonClick(event: SyntheticMouseEvent): void {
    const {inputField} = this.refs;
    const rawMessage = inputField.getModel().getText();
    let parsed;
    try {
      parsed = parseMessage(rawMessage);
    } catch (err) {
      if (err instanceof InvalidInputError) {
        atom.notifications.addError(err.message);
        return;
      }
      throw err;
    }
    inputField.getModel().setText('');
    this.props.sendMessage(parsed);
  }
}

function parseMessage(raw_: string): Object {
  const raw = raw_.trim();
  let message;
  if (raw === '') {
    throw new InvalidInputError('You must enter a command');
  }
  try {
    message = JSON.parse(raw);
  } catch (err) {
    throw new InvalidInputError(`Invalid JSON: ${err.message}`);
  }
  if (message.jsonrpc == null) {
    throw new InvalidInputError('Missing "jsonrpc" field. Use 2.0.');
  }
  return message;
}

class InvalidInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidInputError';
  }
}

function getGrammar(scopeName: string): Observable<atom$Grammar> {
  const grammar = atom.grammars.grammarForScopeName(scopeName);
  if (grammar != null) {
    return Observable.of(grammar);
  }
  return observableFromSubscribeFunction(
    atom.grammars.onDidAddGrammar.bind(atom.grammars),
  )
    .filter(g => g.scopeName === scopeName)
    .take(1);
}
