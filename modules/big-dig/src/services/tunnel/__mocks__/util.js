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

declare var jest;

import type {Transport} from '../Proxy';

import {Observable} from 'rxjs';

export function TestTransportFactory(msgs: ?Array<string>): Transport {
  const messages = msgs != null ? msgs : [];
  return {
    send: jest.fn(),
    onMessage: () => {
      return Observable.from(messages);
    },
  };
}
