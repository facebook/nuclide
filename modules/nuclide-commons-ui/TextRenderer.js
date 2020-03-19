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

import type {IExpression} from 'atom-ide-ui';

import * as React from 'react';

export function TextRenderer(expression: IExpression): React.Node {
  const type = expression.type;
  const value = expression.getValue();
  if (type === 'text') {
    return <span>{value}</span>;
  } else {
    return null;
  }
}
