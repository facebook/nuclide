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

import {DUMMY_FRAME_ID} from './helpers';
import Handler from './Handler';

import type {ClientCallback} from './ClientCallback';

// Handles all 'Page.*' Chrome dev tools messages
export default class PageHandler extends Handler {
  constructor(clientCallback: ClientCallback) {
    super('Page', clientCallback);
  }

  handleMethod(id: number, method: string, params: ?Object): Promise<void> {
    switch (method) {
      case 'canScreencast':
        this.replyToCommand(id, {result: false});
        break;

      case 'enable':
        this.replyToCommand(id, {});
        break;

      case 'getResourceTree':
        this.replyToCommand(
          id,
          // For now, return a dummy resource tree so various initializations in
          // client happens.
          {
            frameTree: {
              childFrames: [],
              resources: [],
              frame: {
                id: DUMMY_FRAME_ID,
                loaderId: 'Loader.0',
                mimeType: '',
                name: 'HHVM',
                securityOrigin: '',
                url: 'hhvm:///',
              },
            },
          },
        );
        break;

      default:
        this.unknownMethod(id, method, params);
        break;
    }
    return Promise.resolve();
  }
}
