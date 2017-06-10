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
import type {HackRange} from './rpc-types';
import type {HackSpan} from './OutlineView';
import type {Definition, DefinitionQueryResult} from 'atom-ide-ui';

import invariant from 'assert';
import {
  atomPointOfHackRangeStart,
  hackRangeToAtomRange,
  hackSpanToAtomRange,
} from './HackHelpers';

export type HackDefinition = {
  name: string,
  result_type?: string,
  pos: HackRange,
  definition_pos: ?HackRange,
  definition_span?: HackSpan,
  definition_id?: string,
};

export function convertDefinitions(
  hackDefinitions: Array<HackDefinition>,
  filePath: NuclideUri,
  projectRoot: NuclideUri,
): ?DefinitionQueryResult {
  function convertDefinition(definition: HackDefinition): Definition {
    const {definition_pos, definition_span, name} = definition;
    invariant(definition_pos != null);
    return {
      path: definition_pos.filename || filePath,
      position: atomPointOfHackRangeStart(definition_pos),
      range: definition_span == null
        ? undefined
        : hackSpanToAtomRange(definition_span),
      // TODO: definition_id
      id: name,
      name,
      language: 'php',
      projectRoot,
    };
  }

  const filteredDefinitions = hackDefinitions.filter(
    definition => definition.definition_pos != null,
  );
  if (filteredDefinitions.length === 0) {
    return null;
  }

  const definitions: Array<Definition> = filteredDefinitions.map(
    convertDefinition,
  );

  return {
    queryRange: [hackRangeToAtomRange(filteredDefinitions[0].pos)],
    definitions,
  };
}
