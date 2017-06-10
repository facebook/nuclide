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

import type WS from 'ws';

import BaseSession from '../VendorLib/node-inspector/lib/session';
import util from 'util';

/**
 * A custom version of node-inspector's Session that ignores commands that we don't support. (We
 * do this here so we can pull in new versions of node-inspector without having to worry about what
 * modifications we've made to the source.)
 */
function CustomSession(
  config: Object,
  debuggerPort: number,
  wsConnection: WS,
): void {
  BaseSession.call(this, config, debuggerPort, wsConnection);
  this.frontendCommandHandler._registerNoopCommands(
    'Emulation.canEmulate',
    'Network.setMonitoringXHREnabled',
    'Worker.enable',
    'ServiceWorker.enable',
    'Emulation.setScriptExecutionDisabled',
    'Page.setOverlayMessage',
    'Debugger.setDebuggerSettings',
  );
}

util.inherits(CustomSession, BaseSession);

CustomSession.prototype.close = function() {
  // Pause frontend client events to ensure none are sent after the debugger has closed the
  // websocket. Omitting this causes a "not opened" error after closing the debugger window. See
  // <https://github.com/node-inspector/node-inspector/issues/870>
  this.frontendClient.pauseEvents();

  // "super.close()"
  BaseSession.prototype.close.call(this);
};

export const Session = ((CustomSession: any): Class<BaseSession>);
