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

import type {AppState} from '../types';

import * as React from 'react';
import {Observable} from 'rxjs';

import {Combobox} from '../../../nuclide-ui/Combobox';

import nuclideUri from 'nuclide-commons/nuclideUri';
import {concatLatest} from 'nuclide-commons/observable';
import {getBuckService} from '../../../nuclide-buck-base';
import {getLogger} from 'log4js';

const NO_ACTIVE_PROJECT_ERROR =
  'No active Buck project. Check your Current Working Root.';

type Props = {
  appState: AppState,
  setBuildTarget(buildTarget: string): void,
};

export default class BuckToolbarTargetSelector extends React.Component<Props> {
  // Querying Buck can be slow, so cache aliases by project.
  // Putting the cache here allows the user to refresh it by toggling the UI.
  _projectAliasesCache: Map<string, Promise<Array<string>>>;

  _cachedOwners: ?Promise<Array<string>>;
  _cachedOwnersPath: ?string;
  _comboBox: ?Combobox;

  constructor(props: Props) {
    super(props);
    this._projectAliasesCache = new Map();
  }

  _filterOptions(options: Array<string>, filterValue: string): Array<string> {
    const filterLowerCase = filterValue.toLowerCase();
    return options
      .map((value, index) => {
        const matchIndex = value.toLowerCase().indexOf(filterLowerCase);
        if (matchIndex < 0) {
          return null;
        }
        return {value, matchIndex, index};
      })
      .filter(Boolean)
      .sort((a, b) => {
        // Prefer earlier matches, but don't break ties by string length.
        // Instead, make the sort stable by breaking ties with the index.
        return a.matchIndex - b.matchIndex || a.index - b.index;
      })
      .map(option => option.value);
  }

  _requestOptions = (inputText: string): Observable<Array<string>> => {
    const {buckRoot} = this.props.appState;
    if (buckRoot == null) {
      return Observable.throw(Error(NO_ACTIVE_PROJECT_ERROR));
    }
    return concatLatest(
      Observable.of(inputText.trim() === '' ? [] : [inputText]),
      Observable.fromPromise(this._getActiveOwners(buckRoot)),
      Observable.fromPromise(this._getAliases(buckRoot)),
    ).map(list => Array.from(new Set(list)));
  };

  _getAliases(buckRoot: string): Promise<Array<string>> {
    let cachedAliases = this._projectAliasesCache.get(buckRoot);
    if (cachedAliases == null) {
      const buckService = getBuckService(buckRoot);
      cachedAliases =
        buckService == null
          ? Promise.resolve([])
          : buckService
              .listAliases(buckRoot)
              .catch(e => {
                atom.notifications.addError(
                  `Error invoking Buck to list aliases:\n${e.toString()}`,
                );
                return [];
              })
              // Sort in alphabetical order.
              .then(aliases =>
                aliases.sort((a, b) =>
                  a.toLowerCase().localeCompare(b.toLowerCase()),
                ),
              );
      this._projectAliasesCache.set(buckRoot, cachedAliases);
    }
    return cachedAliases;
  }

  _getActiveOwners(buckRoot: string): Promise<Array<string>> {
    const editor = atom.workspace.getActiveTextEditor();
    if (editor == null) {
      return Promise.resolve([]);
    }
    const path = editor.getPath();
    if (path == null || !nuclideUri.contains(buckRoot, path)) {
      return Promise.resolve([]);
    }
    if (path === this._cachedOwnersPath && this._cachedOwners != null) {
      return this._cachedOwners;
    }
    const buckService = getBuckService(buckRoot);
    this._cachedOwners =
      buckService == null
        ? Promise.resolve([])
        : buckService
            .getOwners(buckRoot, path, [])
            .then(
              // Strip off the optional leading "//" to match typical user input.
              owners =>
                owners.map(
                  owner =>
                    owner.startsWith('//') ? owner.substring(2) : owner,
                ),
            )
            .catch(err => {
              getLogger('nuclide-buck').error(
                `Error getting Buck owners for ${path}`,
                err,
              );
              return [];
            });
    this._cachedOwnersPath = path;
    return this._cachedOwners;
  }

  _handleBuildTargetChange = (value: string) => {
    this._scrollToEnd();
    const trimmed = value.trim();
    if (this.props.appState.buildTarget === trimmed) {
      return;
    }
    this.props.setBuildTarget(trimmed);
  };

  _scrollToEnd = () => {
    if (this._comboBox != null) {
      this._comboBox.scrollToEnd();
    }
  };

  render(): React.Node {
    return (
      <Combobox
        // Hack to forcibly refresh the combobox when the target changes.
        // TODO(#11581583): Remove this when Combobox is fully controllable.
        key={this.props.appState.buildTarget}
        className="inline-block nuclide-buck-target-combobox"
        formatRequestOptionsErrorMessage={err => err.message}
        filterOptions={this._filterOptions}
        requestOptions={this._requestOptions}
        maxOptionCount={20}
        size="sm"
        loadingMessage="Updating target names..."
        initialTextInput={this.props.appState.buildTarget}
        onSelect={this._handleBuildTargetChange}
        onBlur={this._handleBuildTargetChange}
        placeholderText="Buck build target"
        wrapperStyle={{width: '100%', maxWidth: '100%'}}
        ref={box => (this._comboBox = box)}
      />
    );
  }
}
