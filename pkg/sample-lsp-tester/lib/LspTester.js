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

import type {LegacyProcessMessage} from 'nuclide-commons/process';
import type {Message} from './PanelView';

import {renderReactRoot} from 'nuclide-commons-ui/renderReactRoot';
import {bufferUntil, takeWhileInclusive} from 'nuclide-commons/observable';
import {splitOnce} from 'nuclide-commons/string';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {spawn, getOutputStream} from 'nuclide-commons/process';
import {SimpleModel} from '../../commons-node/SimpleModel';
import {bindObservableAsProps} from 'nuclide-commons-ui/bindObservableAsProps';
import {PanelView} from './PanelView';
import React from 'react';
import * as rpc from 'vscode-jsonrpc';
import invariant from 'assert';
import {Observable, ReplaySubject, Scheduler} from 'rxjs';
import shellQuote from 'shell-quote';

export const WORKSPACE_VIEW_URI = 'atom://nuclide/sample-lsp-tester';

type State = {
  lastCommand: ?string,
  running: boolean,
};

type SerializedState = {
  lastCommand: ?string,
};

export class LspTester extends SimpleModel {
  _messages: ReplaySubject<Message>;
  _serverDisposable: ?UniversalDisposable;
  _writer: ?rpc.StreamMessageWriter;
  state: State;

  constructor(serialized: ?SerializedState) {
    super();
    (this: any)._handleEvent = this._handleEvent.bind(this);
    (this: any)._sendMessage = this._sendMessage.bind(this);
    (this: any)._startServer = this._startServer.bind(this);
    (this: any)._stopServer = this._stopServer.bind(this);
    this.state = {
      lastCommand: serialized && serialized.lastCommand,
      running: false,
    };
    this._messages = new ReplaySubject(/* buffer size */ 200);
  }

  destroy(): void {
    this._stopServer();
  }

  getTitle(): string {
    return 'LSP Tester';
  }

  getURI(): string {
    return WORKSPACE_VIEW_URI;
  }

  getDefaultLocation(): string {
    return 'right';
  }

  getElement(): HTMLElement {
    const initialMessage = this._getInitialMessage();
    // $FlowFixMe: Observable.from symbol-iterator
    const props = (Observable.from(this): Observable<State>).map(state => ({
      initialCommand: state.lastCommand,
      initialMessage,
      messages: this._messages,
      running: state.running,
      sendMessage: this._sendMessage,
      startServer: this._startServer,
      stopServer: this._stopServer,
    }));
    const StatefulPanelView = bindObservableAsProps(props, PanelView);
    return renderReactRoot(<StatefulPanelView />);
  }

  _getInitialMessage(): string {
    const dirs = atom.project.getDirectories();
    const rootPath = dirs.length > 0 ? dirs[0].getPath() : null;
    const rootUri = rootPath ? `file://${rootPath}` : 'file://path/to/root';
    const initialMessage = {
      jsonrpc: '2.0',
      id: 0,
      method: 'initialize',
      params: {
        processId: process.pid,
        rootPath: rootUri,
        rootUri,
        capabilities: {},
        trace: 'verbose',
      },
    };
    return JSON.stringify(initialMessage, undefined, 2);
  }

  _sendMessage(message: Object): void {
    this._messages.next({
      kind: 'request',
      body: JSON.stringify(message, undefined, 2),
    });
    invariant(this._writer != null);
    this._writer.write(message);
  }

  _startServer(commandString: string): void {
    this._stopServer();
    const [command, ...args] = shellQuote.parse(commandString);
    const events = takeWhileInclusive(
      // Use the async scheduler so that `disposable.dispose()` can still be called in
      // error/complete handlers.
      spawn(command, args)
        .do(process => {
          this._writer = new rpc.StreamMessageWriter(process.stdin);
          const reader = new rpc.StreamMessageReader(process.stdout);
          rpc.createMessageConnection(reader, this._writer).listen();
        })
        .flatMap(proc =>
          getOutputStream(proc, {
            /* TODO(T17353599) */ isExitError: () => false,
          }),
        )
        .subscribeOn(Scheduler.async),
      event => event.kind !== 'error' && event.kind !== 'exit',
    ).share();
    const responses = parseResponses(
      events
        .catch(() => Observable.empty()) // We'll handle them on the "other" stream.
        .filter(event => event.kind === 'stdout')
        .map(event => {
          invariant(event.kind === 'stdout');
          return event.data;
        }),
    );
    const other = events.filter(event => event.kind !== 'stdout');

    this.setState({
      lastCommand: commandString,
      running: true,
    });

    const disposable = (this._serverDisposable = new UniversalDisposable(
      responses.subscribe(response => {
        this._messages.next({kind: 'response', body: response});
      }),
      other.subscribe(
        this._handleEvent,
        err => {
          atom.notifications.addError('Error!', {detail: err.message});
          disposable.dispose();
        },
        () => {
          disposable.dispose();
        },
      ),
      () => {
        this._writer = null;
      },
      () => {
        this.setState({running: false});
      },
    ));
  }

  _stopServer(): void {
    if (this._serverDisposable != null) {
      this._serverDisposable.dispose();
      this._serverDisposable = null;
    }
  }

  serialize(): Object {
    return {
      deserializer: 'nuclide.LspTester',
      data: {
        lastCommand: this.state.lastCommand,
      },
    };
  }

  _handleEvent(event: LegacyProcessMessage /* TODO(T17463635) */): void {
    switch (event.kind) {
      case 'stderr':
        // eslint-disable-next-line no-console
        console.error('stderr from the lsp server process', event.data);
        break;
      case 'exit':
        atom.notifications.addError('LSP Server process exited unexpectedly.');
        break;
      case 'error':
        atom.notifications.addError('Unexpected LSP Server process error', {
          detail: String(event.error),
        });
        break;
    }
  }
}

function parseChunks(chunks: Array<string>): ?{header: string, body: mixed} {
  const combined = chunks.join('');
  const [header, body] = splitOnce(combined, '\r\n\r\n');
  if (body == null) {
    // The header isn't complete yet.
    return null;
  }
  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch (err) {
    // Guess we haven't received the entire body yet.
    return null;
  }
  return {header, body: parsed};
}

function parseResponses(raw: Observable<string>): Observable<string> {
  // TODO: We're parsing twice out of laziness here: once for validation, then for usage.
  return bufferUntil(raw, (_, chunks) => parseChunks(chunks) != null)
    .map(chunks => {
      const parsed = parseChunks(chunks);
      invariant(parsed != null);
      return parsed;
    })
    .map(
      ({header, body}) => `${header}\n${JSON.stringify(body, undefined, 2)}`,
    );
}
