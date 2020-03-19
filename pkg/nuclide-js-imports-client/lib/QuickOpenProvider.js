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

import type {AtomLanguageService} from '../../nuclide-language-service';
import type {LanguageService} from '../../nuclide-language-service/lib/LanguageService';
import type {SymbolResult} from '../../nuclide-quick-open/lib/types';

import humanizePath from 'nuclide-commons-atom/humanizePath';
import {arrayCompact, collect, arrayFlatten} from 'nuclide-commons/collection';
import {asyncFind} from 'nuclide-commons/promise';
import * as React from 'react';

export default class QuickOpenProvider {
  providerType = 'GLOBAL';
  name = 'JSImportsService';
  display = {
    title: 'JS Symbols',
    prompt: 'Search JavaScript symbols...',
    action: 'nuclide-js-imports:toggle-provider',
  };

  _languageService: AtomLanguageService<LanguageService>;

  constructor(languageService: AtomLanguageService<LanguageService>) {
    this._languageService = languageService;
  }

  async _getDirectoriesByService(
    directories: Array<atom$Directory>,
  ): Promise<Map<LanguageService, Array<string>>> {
    return collect(
      arrayCompact(
        await Promise.all(
          // Flow's inference engine blows up without the annotation :(
          directories.map(
            async (directory): Promise<?[LanguageService, string]> => {
              const path = directory.getPath();
              const service = await this._languageService.getLanguageServiceForUri(
                path,
              );
              return service != null ? [service, path] : null;
            },
          ),
        ),
      ),
    );
  }

  async isEligibleForDirectories(
    directories: Array<atom$Directory>,
  ): Promise<boolean> {
    const directoriesByService = await this._getDirectoriesByService(
      directories,
    );
    return (
      (await asyncFind(Array.from(directoriesByService), ([service, paths]) =>
        service.supportsSymbolSearch(paths),
      )) != null
    );
  }

  async executeQuery(
    query: string,
    directories: Array<atom$Directory>,
  ): Promise<Array<SymbolResult>> {
    if (query.length === 0) {
      return [];
    }

    const directoriesByService = await this._getDirectoriesByService(
      directories,
    );
    const results = await Promise.all(
      Array.from(directoriesByService).map(([service, paths]) =>
        service.symbolSearch(query, paths),
      ),
    );
    return arrayFlatten(arrayCompact(results));
  }

  // TODO: Standardize on a generic SymbolResult renderer.
  getComponentForItem(item: SymbolResult): React.Element<any> {
    const name = item.name || '';

    // flowlint-next-line sketchy-null-string:off
    const symbolClasses = item.icon
      ? `file icon icon-${item.icon}`
      : 'file icon no-icon';
    return (
      <div title={item.hoverText || ''}>
        <span className={symbolClasses}>
          <code>{name}</code>
        </span>
        <span className="omnisearch-symbol-result-filename">
          {humanizePath(item.path)}
        </span>
      </div>
    );
  }
}
