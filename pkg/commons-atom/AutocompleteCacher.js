'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

export type AutocompleteCacherConfig<T> = {
 getSuggestions: (request: atom$AutocompleteRequest) => Promise<T>,
 updateResults: (
   request: atom$AutocompleteRequest,
   firstResult: T,
 ) => T,
};

type AutocompleteSession<T> = {
  firstResult: Promise<T>,
  lastRequest: atom$AutocompleteRequest,
};

export default class AutocompleteCacher<T> {
  _config: AutocompleteCacherConfig<T>;

  _session: ?AutocompleteSession<T>;

  constructor(config: AutocompleteCacherConfig<T>) {
    this._config = config;
  }

  getSuggestions(request: atom$AutocompleteRequest): Promise<T> {
    const session = this._session;
    if (session != null && canFilterResults(session, request)) {
      const result = this._filterSuggestions(request, session.firstResult);
      this._session = {
        firstResult: session.firstResult,
        lastRequest: request,
      };
      return result;
    } else {
      const result = this._config.getSuggestions(request);
      this._session = {
        firstResult: result,
        lastRequest: request,
      };
      return result;
    }
  }

  async _filterSuggestions(
    request: atom$AutocompleteRequest,
    firstResult: Promise<T>,
  ): Promise<T> {
    return this._config.updateResults(request, await firstResult);
  }
}

// TODO make this configurable per language
const IDENTIFIER_CHAR_REGEX = /[a-zA-Z_]/;

function canFilterResults<T>(
  session: AutocompleteSession<T>,
  request: atom$AutocompleteRequest,
): boolean {
  const {lastRequest} = session;
  return lastRequest.bufferPosition.row === request.bufferPosition.row &&
      lastRequest.bufferPosition.column + 1 === request.bufferPosition.column &&
      request.prefix.startsWith(lastRequest.prefix) &&
      IDENTIFIER_CHAR_REGEX.test(request.prefix.charAt(request.prefix.length - 1));
}
