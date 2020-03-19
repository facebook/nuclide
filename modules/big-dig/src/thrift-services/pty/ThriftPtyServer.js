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

// $FlowIgnore
import thrift from 'thrift';
// $FlowIgnore
import ThriftPtyService from './gen-nodejs/ThriftPtyService';
import {ThriftPtyServiceHandler} from './ThriftPtyServiceHandler';
import {getLogger} from 'log4js';

const logger = getLogger('thrift-pty-server');

export class ThriftPtyServer {
  _handler: ThriftPtyServiceHandler;
  _server: thrift.Server;
  _portOrPath: number | string;

  constructor(_portOrPath: number | string) {
    this._portOrPath = _portOrPath;
    this._server = null;
  }

  async initialize(): Promise<void> {
    logger.info('initializing thrift pty service');
    if (this._server != null) {
      return;
    }
    this._handler = new ThriftPtyServiceHandler();
    this._server = thrift.createServer(ThriftPtyService, this._handler);
    this._server.on('error', error => {
      logger.info('got error');
      throw error;
    });
    this._server.listen(this._portOrPath);
  }

  close() {
    logger.info('Closing Thrift Pty Server');
    this._server = null;
    this._handler.dispose();
  }
}
