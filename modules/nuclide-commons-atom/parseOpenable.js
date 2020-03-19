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

import type {NuclideUri} from 'nuclide-commons/nuclideUri';

type ParsedOpenable = {|
  +uri: NuclideUri,
  +line?: number,
  +column?: number,
|};

// From the nuclide-fuzzy-filename-provider module
// TODO: Remove that module when Dash and openables replace it
export default function parseOpenable(query: string): ParsedOpenable {
  const [uri, line, column] = query.split(/:+/);
  const lineNumber = parseInt(line, 10);
  const columnNumber = parseInt(column, 10);

  return {
    uri,
    line: !Number.isNaN(lineNumber) ? lineNumber - 1 : undefined,
    column: !Number.isNaN(columnNumber) ? columnNumber - 1 : undefined,
  };
}
