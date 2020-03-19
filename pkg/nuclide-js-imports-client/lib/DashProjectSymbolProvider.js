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

// $FlowFB
import type {ProjectSymbol} from '../../fb-go-to-project-symbol-dash-provider/lib/types';
import type {AtomLanguageService} from '../../nuclide-language-service';
import type {LanguageService} from '../../nuclide-language-service/lib/LanguageService';

import {Observable} from 'rxjs';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';

export default class Omni2ProjectSymbolProvider {
  _languageService: AtomLanguageService<LanguageService>;

  constructor(languageService: AtomLanguageService<LanguageService>) {
    this._languageService = languageService;
  }

  searchSymbolsForDirectory(
    query: string,
    directory: atom$Directory,
    callback: (Array<ProjectSymbol>) => mixed,
  ): IDisposable {
    const directoryPath = directory.getPath();

    const results = Observable.defer(() =>
      this._languageService.getLanguageServiceForUri(directoryPath),
    )
      .switchMap(
        service =>
          service == null
            ? Observable.of([])
            : service.symbolSearch(query, [directoryPath]),
      )
      .map(searchResults => searchResults || [])
      .catch(() => Observable.of([]));

    return new UniversalDisposable(results.subscribe(callback));
  }
}
