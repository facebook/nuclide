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

import * as React from 'react';

import type {EvaluationResult} from '../nuclide-debugger/lib/types';

export function TextRenderer(
  evaluationResult: EvaluationResult,
): ?React.Element<any> {
  const {type, value} = evaluationResult;
  if (type === 'text') {
    return <span>{value}</span>;
  } else {
    return null;
  }
}
