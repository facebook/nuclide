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

import commandExists from 'command-exists';

export function hasCommand(command: string): Promise<boolean> {
  return commandExists(command).then(() => true, () => false);
}
