/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 * @format
 */

import type {ThriftServiceConfig, ThriftServerConfig} from './types';

import thrift from 'thrift';

export function getTransport(config: ThriftServiceConfig) {
  switch (config.thriftTransport) {
    case 'framed':
      return thrift.TFramedTransport;
    case 'buffered':
      return thrift.TBufferedTransport;
    default:
      (config.thriftTransport: empty);
      throw new Error(`Invalid Thrift Transport ${config.thriftTransport}`);
  }
}

export function getProtocol(config: ThriftServiceConfig) {
  switch (config.thriftProtocol) {
    case 'binary':
      return thrift.TBinaryProtocol;
    case 'compact':
      return thrift.TCompactProtocol;
    case 'json':
      return thrift.TJSONProtocol;
    default:
      (config.thriftProtocol: empty);
      throw new Error(`Invalid Thrift Protocol ${config.thriftProtocol}`);
  }
}

export function convertToServerConfig(
  serviceConfig: ThriftServiceConfig,
): ThriftServerConfig {
  return {
    name: serviceConfig.name,
    remoteCommand: serviceConfig.remoteCommand,
    remoteCommandArgs: serviceConfig.remoteCommandArgs,
    remoteConnection: serviceConfig.remoteConnection,
    killOldThriftServerProcess: serviceConfig.killOldThriftServerProcess,
  };
}

export function genConfigId(config: ThriftServerConfig): string {
  return [
    config.name,
    config.remoteCommand,
    ...config.remoteCommandArgs,
    config.remoteConnection.type,
    config.remoteConnection.type === 'tcp'
      ? config.remoteConnection.port
      : config.remoteConnection.path,
  ].join('#');
}
