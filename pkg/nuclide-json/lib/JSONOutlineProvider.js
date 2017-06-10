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

import type {Outline} from 'atom-ide-ui';

import {parseJSON, babelPosToPoint} from './parsing';

export function getOutline(text: string): ?Outline {
  const expression = parseJSON(text);
  if (expression == null) {
    return null;
  }
  if (expression.type === 'ObjectExpression') {
    const outlineTrees = expression.properties
      // Filter out property keys that aren't string literals, such as computed properties. They
      // aren't valid JSON but nothing actually enforces that we are getting valid JSON and we are
      // using a full JS parser so we have to handle cases like this.
      .filter(
        prop =>
          prop.type === 'ObjectProperty' && prop.key.type === 'StringLiteral',
      )
      .map(prop => {
        return {
          plainText: String(prop.key.value),
          startPosition: babelPosToPoint(prop.loc.start),
          endPosition: babelPosToPoint(prop.loc.end),
          children: [],
        };
      });
    return {outlineTrees};
  }
  return null;
}
