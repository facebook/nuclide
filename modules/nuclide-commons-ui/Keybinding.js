/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow strict
 * @format
 */

import React from 'react';
import humanizeKeystroke from 'nuclide-commons/humanizeKeystroke';

type Props = {|
  keystrokes: string,
|};

export default function Keybinding({keystrokes}: Props) {
  return (
    <kbd className="key-binding">
      {humanizeKeystroke(keystrokes, process.platform)}
    </kbd>
  );
}
