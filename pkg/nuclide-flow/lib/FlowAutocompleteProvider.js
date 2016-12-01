'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import type {FlowAutocompleteItem} from '../../nuclide-flow-rpc';

import invariant from 'assert';
import {filter} from 'fuzzaldrin';

import {trackTiming} from '../../nuclide-analytics';
import AutocompleteCacher from '../../commons-atom/AutocompleteCacher';
import passesGK from '../../commons-node/passesGK';

import {getFlowServiceByNuclideUri} from './FlowServiceFactory';

export default class FlowAutocompleteProvider {
  _cacher: AutocompleteCacher<?Array<atom$AutocompleteSuggestion>>;
  constructor() {
    this._cacher = new AutocompleteCacher({
      getSuggestions: getSuggestionsFromFlow,
      updateResults,
    });
  }

  getSuggestions(
    request: atom$AutocompleteRequest,
  ): Promise<?Array<atom$AutocompleteSuggestion>> {
    return trackTiming(
      'flow.autocomplete',
      () => this._getSuggestions(request),
    );
  }

  async _getSuggestions(
    request: atom$AutocompleteRequest,
  ): Promise<?Array<atom$AutocompleteSuggestion>> {
    const {prefix, activatedManually} = request;
    // We may want to make this configurable, but if it is ever higher than one we need to make sure
    // it works properly when the user manually activates it (e.g. with ctrl+space). See
    // https://github.com/atom/autocomplete-plus/issues/597
    //
    // If this is made configurable, consider using autocomplete-plus' minimumWordLength setting, as
    // per https://github.com/atom/autocomplete-plus/issues/594
    const minimumPrefixLength = 1;

    // Allows completions to immediately appear when we are completing off of object properties.
    // This also needs to be changed if minimumPrefixLength goes above 1, since after you type a
    // single alphanumeric character, autocomplete-plus no longer includes the dot in the prefix.
    const prefixHasDot = prefix.indexOf('.') !== -1;

    const replacementPrefix = getReplacementPrefix(prefix);

    if (!activatedManually && !prefixHasDot && replacementPrefix.length < minimumPrefixLength) {
      return null;
    }

    if (await passesGK('nuclide_fast_autocomplete')) {
      return this._cacher.getSuggestions(request);
    } else {
      return getSuggestionsFromFlow(request);
    }
  }
}

async function getSuggestionsFromFlow(
  request: atom$AutocompleteRequest,
): Promise<?Array<atom$AutocompleteSuggestion>> {
  const {bufferPosition, editor, prefix} = request;
  const filePath = editor.getPath();
  const contents = editor.getText();
  const replacementPrefix = getReplacementPrefix(request.prefix);
  if (filePath == null) {
    return null;
  }

  const flowService = getFlowServiceByNuclideUri(filePath);
  invariant(flowService);
  const flowSuggestions = await flowService.flowGetAutocompleteSuggestions(
    filePath,
    contents,
    bufferPosition,
    prefix,
  );

  if (flowSuggestions == null) {
    return null;
  }

  const atomSuggestions =
    await flowSuggestions.map(item => processAutocompleteItem(replacementPrefix, item));
  return updateResults(request, atomSuggestions);

}

function updateResults(
  request: atom$AutocompleteRequest,
  results: ?Array<atom$AutocompleteSuggestion>,
): ?Array<atom$AutocompleteSuggestion> {
  if (results == null) {
    return null;
  }
  const replacementPrefix = getReplacementPrefix(request.prefix);
  const resultsWithCurrentPrefix = results.map(result => {
    return {
      ...result,
      replacementPrefix,
    };
  });
  return filter(resultsWithCurrentPrefix, replacementPrefix, {key: 'displayText'});
}

function getReplacementPrefix(originalPrefix: string): string {
  // If it is just whitespace and punctuation, ignore it (this keeps us
  // from eating leading dots).
  return /^[\s.]*$/.test(originalPrefix) ? '' : originalPrefix;
}

/**
 * Takes an autocomplete item from Flow and returns a valid autocomplete-plus
 * response, as documented here:
 * https://github.com/atom/autocomplete-plus/wiki/Provider-API
 */
export function processAutocompleteItem(
  replacementPrefix: string,
  flowItem: FlowAutocompleteItem,
): atom$AutocompleteSuggestion {
  // Truncate long types for readability
  const description = flowItem.type.length < 80
    ? flowItem.type
    : flowItem.type.substring(0, 80) + ' ...';
  let result = {
    description,
    displayText: flowItem.name,
    replacementPrefix,
  };
  const funcDetails = flowItem.func_details;
  if (funcDetails) {
    // The parameters in human-readable form for use on the right label.
    const rightParamStrings = funcDetails.params
      .map(param => `${param.name}: ${param.type}`);
    const snippetString = getSnippetString(funcDetails.params.map(param => param.name));
    result = {
      ...result,
      leftLabel: funcDetails.return_type,
      rightLabel: `(${rightParamStrings.join(', ')})`,
      snippet: `${flowItem.name}(${snippetString})`,
      type: 'function',
    };
  } else {
    result = {
      ...result,
      rightLabel: flowItem.type,
      text: flowItem.name,
    };
  }
  return result;
}

function getSnippetString(paramNames: Array<string>): string {
  const groupedParams = groupParamNames(paramNames);
  // The parameters turned into snippet strings.
  const snippetParamStrings = groupedParams
    .map(params => params.join(', '))
    .map((param, i) => `\${${i + 1}:${param}}`);
  return snippetParamStrings.join(', ');
}

/**
 * Group the parameter names so that all of the trailing optional parameters are together with the
 * last non-optional parameter. That makes it easy to ignore the optional parameters, since they
 * will be selected along with the last non-optional parameter and you can just type to overwrite
 * them.
 */
export function groupParamNames(paramNames: Array<string>): Array<Array<string>> {
  // Split the parameters into two groups -- all of the trailing optional paramaters, and the rest
  // of the parameters. Trailing optional means all optional parameters that have only optional
  // parameters after them.
  const [ordinaryParams, trailingOptional] =
    paramNames.reduceRight(([ordinary, optional], param) => {
      // If there have only been optional params so far, and this one is optional, add it to the
      // list of trailing optional params.
      if (isOptional(param) && ordinary.length === 0) {
        optional.unshift(param);
      } else {
        ordinary.unshift(param);
      }
      return [ordinary, optional];
    },
    [[], []],
  );

  const groupedParams = ordinaryParams.map(param => [param]);
  const lastParam = groupedParams[groupedParams.length - 1];
  if (lastParam != null) {
    lastParam.push(...trailingOptional);
  } else if (trailingOptional.length > 0) {
    groupedParams.push(trailingOptional);
  }

  return groupedParams;
}

function isOptional(param: string): boolean {
  invariant(param.length > 0);
  const lastChar = param[param.length - 1];
  return lastChar === '?';
}
