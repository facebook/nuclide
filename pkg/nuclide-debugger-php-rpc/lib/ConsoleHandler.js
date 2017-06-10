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

import Handler from './Handler';
import type {ClientCallback} from './ClientCallback';

// Handles all 'Console.*' Chrome dev tools messages
export default class ConsoleHandler extends Handler {
  constructor(clientCallback: ClientCallback) {
    super('Console', clientCallback);
  }

  handleMethod(id: number, method: string, params: ?Object): Promise<void> {
    switch (method) {
      case 'enable':
      case 'disable':
        this.replyToCommand(id, {});
        break;

      case 'clearMessages':
        this.sendMethod('Console.messagesCleared');
        break;

      default:
        this.unknownMethod(id, method, params);
        break;
    }
    return Promise.resolve();
  }
}
