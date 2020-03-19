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

import type {AutocompleteProvider} from './types';

import createPackage from 'nuclide-commons-atom/createPackage';
import featureConfig from 'nuclide-commons-atom/feature-config';
import {Observable} from 'rxjs';
import passesGK from 'nuclide-commons/passesGK';
import createAutocompleteProvider from './createAutocompleteProvider';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';

/**
 * Autocomplete is extremely critical to the user experience!
 * Don't tolerate anything longer than AUTOCOMPLETE_TIMEOUT seconds; just fail
 * fast and let the fallback providers provide something at least.
 *
 * NOTE: We keep a higher time limit for only testing envirnoment since the
 * autocomplete check happens right after you open the file and providers don't
 * have enough time to initialize.
 */
const DEFAULT_AUTOCOMPLETE_TIMEOUT = atom.inSpecMode() ? 3000 : 500;

class Activation {
  _disposables: UniversalDisposable;
  _timeoutValue: number = DEFAULT_AUTOCOMPLETE_TIMEOUT;

  constructor() {
    this._disposables = new UniversalDisposable(
      // If we pass the configurable timeout gk, then update the timeout value
      // when configuration changes.
      Observable.combineLatest(
        Observable.fromPromise(
          passesGK('nuclide_autocomplete_configurable_timeout'),
        ),
        featureConfig.observeAsStream('nuclide-autocomplete.timeout'),
      ).subscribe(([gkResult, value]) => {
        if (gkResult) {
          // value is an integer, as defined in package.json.
          this._timeoutValue = Number(value);
        }
      }),
    );
  }

  consumeProvider<Suggestion: atom$AutocompleteSuggestion>(
    _provider:
      | AutocompleteProvider<Suggestion>
      | Array<AutocompleteProvider<Suggestion>>,
  ): IDisposable {
    const providers = Array.isArray(_provider) ? _provider : [_provider];
    const disposables = providers.map(provider =>
      atom.packages.serviceHub.provide(
        'autocomplete.provider',
        '2.0.0',
        createAutocompleteProvider(provider, () => this._timeoutValue),
      ),
    );
    return new UniversalDisposable(...disposables);
  }

  dispose() {
    this._disposables.dispose();
  }
}

createPackage(module.exports, Activation);
