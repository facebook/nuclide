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

import type {IpcProxyConfig, ProxyConfig, TcpProxyConfig} from './types';

export function matchProxyConfig<R>(
  matcher: {tcp: TcpProxyConfig => R, ipcSocket: IpcProxyConfig => R},
  proxyConfig: ProxyConfig,
): R {
  if (proxyConfig.path === undefined) {
    return matcher.tcp(proxyConfig);
  }
  if (proxyConfig.port === undefined) {
    return matcher.ipcSocket(proxyConfig);
  }
  throw new Error('unreachable');
}

export function isProxyConfigEqual(a: ProxyConfig, b: ProxyConfig): boolean {
  if (a.path === undefined && b.path === undefined) {
    return a.port === b.port && a.useIPv4 === b.useIPv4;
  }

  if (a.port === undefined && b.port === undefined) {
    return a.path === b.path;
  }

  return false;
}

export function isProxyConfigOverlapping(
  a: ProxyConfig,
  b: ProxyConfig,
): boolean {
  if (a.port !== undefined && b.port !== undefined && a.port === b.port) {
    return true;
  }
  if (a.path !== undefined && b.path !== undefined && a.path === b.path) {
    return true;
  }
  return false;
}

export function getProxyConfigDescriptor(config: ProxyConfig): string {
  return matchProxyConfig(
    {
      tcp: c => `port=${c.port}`,
      ipcSocket: c => `socket=${c.path}`,
    },
    config,
  );
}
