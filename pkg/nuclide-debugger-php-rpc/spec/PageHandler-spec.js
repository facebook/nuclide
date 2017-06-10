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

import type {ClientCallback as ClientCallbackType} from '../lib/ClientCallback';

import PageHandler from '../lib/PageHandler';

describe('debugger-php-rpc PageHandler', () => {
  let clientCallback: any;
  let handler: any;

  beforeEach(() => {
    clientCallback = ((jasmine.createSpyObj('clientCallback', [
      'replyToCommand',
      'replyWithError',
      'sendMethod',
    ]): any): ClientCallbackType);
    handler = new PageHandler(clientCallback);
  });

  it('enable', () => {
    handler.handleMethod(1, 'enable');
    expect(clientCallback.replyToCommand).toHaveBeenCalledWith(
      1,
      {},
      undefined,
    );
  });

  it('canScreencast', () => {
    handler.handleMethod(2, 'canScreencast');
    expect(clientCallback.replyToCommand).toHaveBeenCalledWith(
      2,
      {result: false},
      undefined,
    );
  });

  it('getResourceTree', () => {
    handler.handleMethod(3, 'getResourceTree');
    expect(clientCallback.replyToCommand).toHaveBeenCalledWith(
      3,
      {
        frameTree: {
          childFrames: [],
          resources: [],
          frame: {
            id: 'Frame.0',
            loaderId: 'Loader.0',
            mimeType: '',
            name: 'HHVM',
            securityOrigin: '',
            url: 'hhvm:///',
          },
        },
      },
      undefined,
    );
  });

  it('unknown', () => {
    handler.handleMethod(4, 'unknown');
    expect(clientCallback.replyWithError).toHaveBeenCalledWith(
      4,
      jasmine.any(String),
    );
  });
});
