/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow strict
 * @format
 */

export type TunnelMessage =
  | {
      event: 'error',
      clientId: number,
      error: Error,
      tunnelId: string,
    }
  | {
      event: 'data' | 'timeout' | 'end' | 'close',
      arg: string,
      clientId: number,
      tunnelId: string,
    }
  | {
      event: 'proxyCreated',
      proxyConfig: ProxyConfig,
      tunnelId: string,
    }
  | {event: 'proxyClosed', tunnelId: string}
  | {
      event: 'proxyError',
      error: Error,
      tunnelConfig: TunnelConfig,
      tunnelId: string,
    }
  | {
      event: 'connection',
      clientId: number,
      tunnelId: string,
    }
  | {
      event: 'closeProxy',
      tunnelId: string,
    }
  | {
      event: 'createProxy',
      tunnelConfig: TunnelConfig,
      tunnelId: string,
    };

export type TunnelConfig = {local: ProxyConfig, remote: ProxyConfig};

export type ProxyConfig = TcpProxyConfig | IpcProxyConfig;

export type TcpProxyConfig = {
  port: number,
  useIPv4: boolean,
};

// This intentionally matches the Node specification for TCP/IPC connections:
// https://nodejs.org/api/net.html#net_socket_connect_options_connectlistener
export type IpcProxyConfig = {path: string};
