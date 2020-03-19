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

import invariant from 'assert';
import * as React from 'react';
import ReactDOM from 'react-dom';
import nullthrows from 'nullthrows';
import electron from 'electron';
import {getLogger} from 'log4js';

import {initializeLogging} from '../../nuclide-logging';
initializeLogging();

const logger = getLogger('sample-experimental-window-service.window-script');

const {ipcRenderer} = electron;

invariant(ipcRenderer != null);

export type InitializeMessage<T> = {|
  windowId: number,
  componentModule: string,
  initialState: T,
|};

let windowId;
let Component;
let reduceState;
let currentState;
const container = nullthrows(document.getElementById('app'));

function dispatch(action) {
  logger.info(`window ${windowId} sending action: ${JSON.stringify(action)}`);
  // TODO: This is fine for now but we may have to include more info for routing when each window can contain multiple component roots.
  ipcRenderer.send('dispatch', {windowId, action});
}

function render(props) {
  invariant(Component != null);
  ReactDOM.render(<Component dispatch={dispatch} {...props} />, container);
}

ipcRenderer.on('initialize', (_, message: InitializeMessage<*>) => {
  const {componentModule, initialState} = message;
  windowId = message.windowId;
  // $FlowIgnore
  const module = require(componentModule);
  Component = module.default;
  reduceState = module.reduceState;
  currentState = initialState;
  render(currentState);
});

ipcRenderer.on('update', (_, update: Object) => {
  currentState =
    reduceState == null ? update : reduceState(currentState, update);
  render(currentState);
});

// TODO: Use JSONRpc?
// TODO: Dispatch actions back.
