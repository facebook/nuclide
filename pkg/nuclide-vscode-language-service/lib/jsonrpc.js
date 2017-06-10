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

// https://github.com/Microsoft/vscode-languageserver-node/blob/master/jsonrpc/src/main.ts
export type JsonRpcConnection = {
  sendRequest(method: string, params?: Object): Promise<any>,
  sendNotification(method: string, params?: Object): void,
  listen(): void,
  onNotification(type: {method: string}, callback: (Object) => void): void,
  onRequest(
    type: {method: string},
    callback: (Object, Object) => Promise<any>,
  ): void,
  dispose(): void,
  trace(level: 0 | 1 | 2, logger: JsonRpcTraceLogger): void,
  onError(callback: ([Error, ?Object, ?number]) => void): void,
  onClose(callback: () => void): void,
  onUnhandledNotification(callback: (Object) => void): void,
  onDispose(callback: () => void): void,
};

export const JsonRpcTrace = {
  Off: 0,
  Messages: 1,
  Verbose: 2,
};

export type JsonRpcTraceLogger = {
  log(message: string, data: ?string): void,
};
