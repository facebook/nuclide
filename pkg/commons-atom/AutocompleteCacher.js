/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 */

import passesGK from 'nuclide-commons/passesGK';
import {PromiseWithState} from 'nuclide-commons/promise';

export type AutocompleteCacherConfig<T> = {|
  // This function filters+sorts the firstResult that came back from `getSuggestions`.
  // Return null here to if firstResult isn't appropriate and we should go back
  // to the language service.
  // This function is also responsible for updating any cached TextEdit ranges.
  updateResults: (
    originalRequest: atom$AutocompleteRequest,
    currentRequest: atom$AutocompleteRequest,
    firstResult: T,
  ) => ?T,
  // If we had to go to `getSuggestions` for whatever reason, we can still configure
  // a filter+sort function to be used in that case too.
  updateFirstResults?: (request: atom$AutocompleteRequest, firstResult: T) => T,
  // If this is provided, we will ask it whether we can filter on the given request after first
  // verifying that the cursor has only moved by one column since the last request.
  shouldFilter?: (
    lastRequest: atom$AutocompleteRequest,
    currentRequest: atom$AutocompleteRequest,
    // autocomplete-plus does some debouncing so if the user types quickly enough we may not see a
    // request for every character. This indicates how many columns the cursor has moved since the
    // last request. Typically, within an autocomplete session this will be 1, but it may be greater
    // if the user typed quickly. It is also possible that the cursor moved for another reason, so
    // take care to avoid returning `true` when we are in fact not in the same autocomplete session.
    charsSinceLastRequest: number,
  ) => boolean,
  gatekeeper?: string,
|};

type TrackedResponse<T> = {request: atom$AutocompleteRequest, response: T};

function track<T>(
  request: atom$AutocompleteRequest,
  responsePromise: Promise<?T>,
): Promise<?TrackedResponse<T>> {
  return responsePromise.then(
    response => (response == null ? null : {request, response}),
  );
}

type AutocompleteSession<T> = {
  firstResultPromise: PromiseWithState<?TrackedResponse<T>>,
  lastRequest: atom$AutocompleteRequest,
};

export default class AutocompleteCacher<T> {
  _getSuggestions: (request: atom$AutocompleteRequest) => Promise<?T>;
  _config: AutocompleteCacherConfig<T>;

  _enabled: boolean;
  _session: ?AutocompleteSession<T>;

  constructor(
    // If getSuggestions returns null or undefined, it means that we should not filter that result
    // to serve later queries, even if shouldFilter returns true. If there are truly no results, it
    // is recommended that getSuggestions return an empty Array.
    getSuggestions: (request: atom$AutocompleteRequest) => Promise<?T>,
    config: AutocompleteCacherConfig<T>,
  ) {
    this._getSuggestions = async (request: atom$AutocompleteRequest) => {
      const results = await getSuggestions(request);
      return config.updateFirstResults == null || results == null
        ? results
        : config.updateFirstResults(request, results);
    };
    this._config = config;
    this._setEnabled();
  }

  async _setEnabled(): Promise<void> {
    const gk = this._config.gatekeeper;
    if (gk == null) {
      this._enabled = true;
    } else {
      this._enabled = false;
      this._enabled = await passesGK(gk);
    }
  }

  getSuggestions(request: atom$AutocompleteRequest): Promise<?T> {
    if (!this._enabled) {
      return this._getSuggestions(request);
    }
    const session = this._session;
    if (session != null && this._canMaybeFilterResults(session, request)) {
      const state = session.firstResultPromise.getState();
      if (state.kind === 'fulfilled' && state.value != null) {
        // Maybe an earlier request had already resolved to not-null so we can use
        // it right now, synchronously?
        const firstResult = state.value;
        const result = this._config.updateResults(
          firstResult.request,
          request,
          firstResult.response,
        );
        if (result != null) {
          this._session = {...this._session, lastRequest: request};
          return Promise.resolve(result);
        }
      }

      // If it hasn't already resolved, or if it had resolved to not-null,
      // or if the updateResults function decided synchronously that it wasn't
      // able to do anything, then in all cases we'll send an additional request
      // speculatively right now (to reduce overall latency) and defer the
      // decision about whether to use the existing response or
      // the speculative one.
      const resultFromLanguageService = this._getSuggestions(request);
      const result = this._filterSuggestionsIfPossible(
        request,
        session,
        resultFromLanguageService,
      );
      this._session = {
        firstResultPromise: new PromiseWithState(
          getNewFirstResult(
            session.firstResultPromise.getPromise(),
            track(request, resultFromLanguageService),
          ),
        ),
        lastRequest: request,
      };
      return result;
    } else {
      const result = this._getSuggestions(request);
      this._session = {
        firstResultPromise: new PromiseWithState(track(request, result)),
        originalRequest: request,
        lastRequest: request,
      };
      return result;
    }
  }

  async _filterSuggestionsIfPossible(
    request: atom$AutocompleteRequest,
    session: AutocompleteSession<T>,
    resultFromLanguageService: Promise<?T>,
  ): Promise<?T> {
    const firstResult = await session.firstResultPromise.getPromise();
    if (firstResult != null) {
      const updated = this._config.updateResults(
        firstResult.request,
        request,
        firstResult.response,
      );
      if (updated != null) {
        return updated;
      }
    }
    return resultFromLanguageService;
  }

  // This doesn't guarantee we can filter results -- if the previous result turns out to be null, we
  // may still have to use the results from the language service.
  _canMaybeFilterResults(
    session: AutocompleteSession<T>,
    currentRequest: atom$AutocompleteRequest,
  ): boolean {
    const {lastRequest} = session;
    const shouldFilter =
      this._config.shouldFilter != null
        ? this._config.shouldFilter
        : defaultShouldFilter;
    const charsSinceLastRequest =
      currentRequest.bufferPosition.column - lastRequest.bufferPosition.column;
    return (
      lastRequest.bufferPosition.row === currentRequest.bufferPosition.row &&
      charsSinceLastRequest > 0 &&
      shouldFilter(lastRequest, currentRequest, charsSinceLastRequest)
    );
  }
}

async function getNewFirstResult<T>(
  firstResultPromise: Promise<?TrackedResponse<T>>,
  resultFromLanguageService: Promise<?TrackedResponse<T>>,
): Promise<?TrackedResponse<T>> {
  const firstResult = await firstResultPromise;
  if (firstResult != null) {
    return firstResult;
  } else {
    return resultFromLanguageService;
  }
}

const IDENTIFIER_REGEX = /^[a-zA-Z_]+$/;

function defaultShouldFilter(
  lastRequest: atom$AutocompleteRequest,
  currentRequest: atom$AutocompleteRequest,
  charsSinceLastRequest: number,
) {
  // This function's goal is to check whether the currentRequest represents
  // additional typing to do further filtering, or whether it represents an
  // entirely new autocomplete request.
  // It does this by checking the request.prefix that AutocompletePlus had
  // computed for the previous request vs the currentRequest. How
  // AutocompletePlus computes this prefix is via a 'word regex' to see what
  // word the caret is on, and take the portion of it to the left of the caret.
  // Its word regex is roughly [a-zA-Z0-9_-]+. If the currentRequest.prefix
  // is strictly longer than the lastRequest.prefix, by the right number
  // of characters, then we should continue to do further filtering.
  // NOTE: the prefix computed by AutocompletePlus is not necessarily the
  // replacementPrefix that will be used if the user accepts a suggestion.
  // And it's not necessarily appropriate for the language (e.g. flow
  // disallows hyphens, and php allows $). But that doesn't matter. We're merely
  // using it as a convenient consistent source of a good enough word regex.
  // We do further filtering to only accept [a-zA-Z_], so no numerals or
  // hyphens. This makes us very conservative. When we're too conservative
  // (e.g. always failing to cache for identifiers that have numerals or
  // hyphens), the only bad effect is more autocomplete requests to the
  // language server than is strictly necessary.
  return (
    currentRequest.prefix.startsWith(lastRequest.prefix) &&
    currentRequest.prefix.length ===
      lastRequest.prefix.length + charsSinceLastRequest &&
    IDENTIFIER_REGEX.test(currentRequest.prefix)
  );
}
