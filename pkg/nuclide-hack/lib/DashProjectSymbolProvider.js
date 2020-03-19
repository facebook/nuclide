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

import type {
  ProjectSymbolSearchProvider,
  ProjectSymbol,
  // $FlowFB
} from '../../fb-go-to-project-symbol-dash-provider/lib/types';

import {Observable} from 'rxjs';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {getHackLanguageForUri} from './HackLanguage';

const DashProjectSymbolProvider: ProjectSymbolSearchProvider = {
  searchSymbolsForDirectory(
    query: string,
    directory: atom$Directory,
    callback: (Array<ProjectSymbol>) => mixed,
  ): IDisposable {
    const directoryPath = directory.getPath();

    const results = Observable.defer(() => getHackLanguageForUri(directoryPath))
      .switchMap(
        service =>
          service == null
            ? Observable.of([])
            : service.symbolSearch(query, [directoryPath]),
      )
      .map(searchResults => searchResults || [])
      .catch(() => Observable.of([]));

    return new UniversalDisposable(results.subscribe(callback));
  },
};

export default DashProjectSymbolProvider;
