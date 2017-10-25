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

import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {
  SymbolResult,
  GlobalProviderType,
} from '../../nuclide-quick-open/lib/types';
import type {LanguageService} from '../../nuclide-language-service/lib/LanguageService';

import {getHackLanguageForUri} from './HackLanguage';
import {collect, arrayCompact, arrayFlatten} from 'nuclide-commons/collection';
import nuclideUri from 'nuclide-commons/nuclideUri';
import * as React from 'react';

async function getHackDirectoriesByService(
  directories: Array<atom$Directory>, // top-level project directories
): Promise<Array<[LanguageService, Array<NuclideUri>]>> {
  const promises: Array<
    Promise<?[LanguageService, NuclideUri]>,
  > = directories.map(async directory => {
    const service = await getHackLanguageForUri(directory.getPath());
    return service ? [service, directory.getPath()] : null;
  });
  const serviceDirectories: Array<?[
    LanguageService,
    NuclideUri,
  ]> = await Promise.all(promises);

  const results: Map<LanguageService, Array<NuclideUri>> = collect(
    arrayCompact(serviceDirectories),
  );

  return Array.from(results.entries());
}

export const HackSymbolProvider: GlobalProviderType<SymbolResult> = {
  providerType: 'GLOBAL',
  name: 'HackSymbolProvider',
  display: {
    title: 'Hack Symbols',
    prompt: 'Search Hack symbols...',
    action: 'nuclide-hack-symbol-provider:toggle-provider',
  },

  async isEligibleForDirectories(
    directories: Array<atom$Directory>,
  ): Promise<boolean> {
    const serviceDirectories = await getHackDirectoriesByService(directories);
    const eligibilities = await Promise.all(
      serviceDirectories.map(([service, dirs]) =>
        service.supportsSymbolSearch(dirs),
      ),
    );
    return eligibilities.some(e => e);
  },

  async executeQuery(
    query: string,
    directories: Array<atom$Directory>,
  ): Promise<Array<SymbolResult>> {
    if (query.length === 0) {
      return [];
    }

    const serviceDirectories = await getHackDirectoriesByService(directories);
    const results = await Promise.all(
      serviceDirectories.map(([service, dirs]) =>
        service.symbolSearch(query, dirs),
      ),
    );
    return arrayFlatten(arrayCompact(results));
  },

  getComponentForItem(item: SymbolResult): React.Element<any> {
    const filePath = item.path;
    const filename = nuclideUri.basename(filePath);
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
        <span className="omnisearch-symbol-result-filename">{filename}</span>
      </div>
    );
  },
};
