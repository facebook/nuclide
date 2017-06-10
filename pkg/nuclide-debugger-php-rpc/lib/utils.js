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

import {getLogger} from 'log4js';

const DEBUGGER_LOGGER_CATEGORY = 'nuclide-debugger-php';

export default getLogger(DEBUGGER_LOGGER_CATEGORY);

export function makeExpressionHphpdCompatible(params: {
  expression: string,
}): Object {
  // Hphpd requires that '=' is prefixed to expressions, but xdebug doesn't require this, so
  // we remove leading '=' if necessary.
  const expr = params.expression;
  if (expr.startsWith('=')) {
    params.expression = expr.substring(1);
  }
  return params;
}
