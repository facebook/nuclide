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

import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {AtomLanguageService} from '../../nuclide-language-service';
import type {
  LanguageService,
  SymbolResult,
} from '../../nuclide-language-service/lib/LanguageService';

/**
 * This service allows other packages to search JS symbols using language service
 */
export default class JSSymbolSearchProvider {
  _languageService: AtomLanguageService<LanguageService>;

  constructor(languageService: AtomLanguageService<LanguageService>) {
    this._languageService = languageService;
  }

  async searchJSSymbol(
    query: string,
    directoryUri: NuclideUri,
  ): Promise<?Array<SymbolResult>> {
    const uriLanguageService = await this._languageService.getLanguageServiceForUri(
      directoryUri,
    );
    return uriLanguageService
      ? uriLanguageService.symbolSearch(query, [directoryUri])
      : null;
  }
}
