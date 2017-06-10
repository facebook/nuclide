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

import type {MessageType} from 'atom-ide-ui';

function classifyCode(code: string): MessageType {
  if (/^(B9|C|E[35]|T400|T49)/.test(code)) {
    return 'Info';
  } else if (/^(F|B|T484|E999)/.test(code)) {
    return 'Error';
  }
  return 'Warning';
}

export function parseFlake8Output(src: string, output: string): Array<Object> {
  const regex = /(\d+):(\d+):\s([A-Z]\d{2,3})\s+(.*)/g;
  const results = [];

  for (;;) {
    const match = regex.exec(output);
    if (match == null) {
      break;
    }
    const [, line, column, code, message] = match;
    results.push({
      file: src,
      line: parseInt(line, 10) - 1 || 0,
      column: parseInt(column, 10) - 1 || 0,
      code,
      type: classifyCode(code),
      message,
    });
  }

  return results;
}
