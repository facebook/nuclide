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

import type {Message} from '../../../nuclide-console/lib/types';

type ReadyEvent = {kind: 'ready'};
type MessageEvent = {
  kind: 'message',
  message: Message,
};

export type PackagerEvent = ReadyEvent | MessageEvent;
