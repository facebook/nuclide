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

import Uri from 'vscode-uri';

export function pathToUri(path: string): string {
  return Uri.file(path).toString();
}

export function uriToPath(uri: string): string {
  return Uri.parse(uri).fsPath;
}
