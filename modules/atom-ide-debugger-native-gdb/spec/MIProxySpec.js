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

import MIProxy from '../lib/MIProxy';
import nuclideUri from 'nuclide-commons/nuclideUri';

describe('MIProxy', () => {
  let proxy;

  beforeEach(() => {
    proxy = new MIProxy();
    proxy.start('node', [
      nuclideUri.join(__dirname, '../test-support/RunMIMockServer.js'),
    ]);
  });

  it('should talk to the MI server', done => {
    proxy.sendCommand('foo').then(response => {
      expect(response.resultClass).toEqual('error');
      done();
    });
  });

  it('should send back results', done => {
    proxy.sendCommand('list-features').then(response => {
      expect(response.resultClass).toEqual('done');
      expect(response.result).toEqual({features: ['argle', 'bargle', 'blab']});
      done();
    });
  });
});
