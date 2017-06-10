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

import type {PythonCompletion} from './PythonService';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {
  AutocompleteResult,
} from '../../nuclide-language-service/lib/LanguageService';
import type JediServerManager from './JediServerManager';

import {matchRegexEndingAt} from 'nuclide-commons/range';

// Type mappings between Jedi types and autocomplete-plus types used for styling.
const TYPES = {
  module: 'import',
  class: 'class',
  instance: 'variable',
  function: 'function',
  generator: 'generator',
  statement: 'variable',
  import: 'import',
  param: 'variable',
  property: 'property',
};

const TRIGGER_REGEX = /(\.|[a-zA-Z_][a-zA-Z0-9_]*)$/;

/**
 * Generate a function-signature line string if completion is a function.
 * Otherwise just return the completion text.
 * @param  completion           The completion object to get text of.
 * @param  includeOptionalArgs  Whether or not to skip optional python arguments,
 *   including keyword args with default values, and star args (*, *args, **kwargs)
 * @param  createPlaceholders   Create snippet placeholders for the arguments
 *   instead of plain text.
 * @return string               Textual representation of the completion.
 */
function getText(
  completion: PythonCompletion,
  includeOptionalArgs: boolean = true,
  createPlaceholders: boolean = false,
): string {
  if (completion.params) {
    const params = includeOptionalArgs
      ? completion.params
      : completion.params.filter(
          param => param.indexOf('=') < 0 && param.indexOf('*') < 0,
        );

    const paramTexts = params.map((param, index) => {
      return createPlaceholders ? `\${${index + 1}:${param}}` : param;
    });
    return `${completion.text}(${paramTexts.join(', ')})`;
  }

  return completion.text;
}

export async function getAutocompleteSuggestions(
  serverManager: JediServerManager,
  filePath: NuclideUri,
  buffer: simpleTextBuffer$TextBuffer,
  position: atom$Point,
  activatedManually: boolean,
  autocompleteArguments: boolean,
  includeOptionalArguments: boolean,
): Promise<AutocompleteResult> {
  if (
    !activatedManually &&
    matchRegexEndingAt(buffer, position, TRIGGER_REGEX) == null
  ) {
    return {isIncomplete: false, items: []};
  }

  const results = await getCompletions(
    serverManager,
    filePath,
    buffer.getText(),
    position.row,
    position.column,
  );
  if (results == null) {
    return {isIncomplete: false, items: []};
  }

  const items = results.map(completion => {
    // Always display optional arguments in the UI.
    const displayText = getText(completion);
    // Only autocomplete arguments if the include optional arguments setting is on.
    const snippet = autocompleteArguments
      ? getText(
          completion,
          includeOptionalArguments,
          true /* createPlaceholders */,
        )
      : completion.text;
    return {
      displayText,
      snippet,
      type: TYPES[completion.type],
      description: completion.description,
    };
  });
  return {
    isIncomplete: false,
    items,
  };
}

export async function getCompletions(
  serverManager: JediServerManager,
  src: NuclideUri,
  contents: string,
  line: number,
  column: number,
): Promise<?Array<PythonCompletion>> {
  const service = await serverManager.getJediService(src);
  return service.get_completions(src, contents, line, column);
}
