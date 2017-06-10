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

import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {
  FindReferencesReturn,
} from '../../nuclide-find-references/lib/rpc-types';

import {hackRangeToAtomRange} from './HackHelpers';

export type HackReferencesResult = Array<HackReference>;

export type HackReference = {
  name: string,
  filename: NuclideUri,
  line: number,
  char_start: number,
  char_end: number,
};

export function convertReferences(
  hackResult: HackReferencesResult,
  projectRoot: NuclideUri,
): FindReferencesReturn {
  let symbolName = hackResult[0].name;
  // Strip off the global namespace indicator.
  if (symbolName.startsWith('\\')) {
    symbolName = symbolName.slice(1);
  }

  // Process this into the format nuclide-find-references expects.
  const references = hackResult.map(ref => {
    return {
      uri: ref.filename,
      name: null, // TODO(hansonw): Get the caller when it's available
      range: hackRangeToAtomRange(ref),
    };
  });

  return {
    type: 'data',
    baseUri: projectRoot,
    referencedSymbolName: symbolName,
    references,
  };
}
