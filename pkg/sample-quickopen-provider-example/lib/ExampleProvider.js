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

import type {FileResult, Provider} from '../../nuclide-quick-open/lib/types';

const FIXTURE = [
  'ac',
  'accumsan',
  'adipiscing',
  'amet',
  'auctor',
  'consectetur',
  'dictum',
  'dolor',
  'efficitur',
  'eget',
  'elit',
  'enim',
  'eros',
  'eu',
  'Fusce',
  'imperdiet',
  'in',
  'ipsum',
  'lacus',
  'leo',
  'libero',
  'lorem',
  'Lorem',
  'luctus',
  'mattis',
  'maximus',
  'mi',
  'Morbi',
  'Nam',
  'nec',
  'non',
  'Nulla',
  'Nullam',
  'odio',
  'placerat',
  'quis',
  'sagittis',
  'sapien',
  'scelerisque',
  'Sed',
  'semper',
  'sit',
  'tellus',
  'tempus',
  'tincidunt',
  'turpis',
  'ultricies',
  'Ut',
  'vel',
  'venenatis',
  'vestibulum',
  'Vestibulum',
  'vitae',
];

const ExampleProvider: Provider<FileResult> = {
  /**
   * One of 'GLOBAL', 'DIRECTORY'.
   * DIRECTORY providers work in the context of a mounted directory (e.g. Hack symbol search).
   * GLOBAL providers work regardless of mounted directories (e.g. open tabs search; web requests).
   */
  providerType: 'DIRECTORY',

  /**
   * A unique name, used internally by quick-open to store cached results.
   */
  name: 'ExampleProvider',

  /**
   * Information used to render the provider in a dedicated tab. If omitted, results from the
   * provider will only be shown in the OmniSearch result list.
   */
  display: {
    /**
     * The title of the quick-open tab that exclusively contains results from this provider.
     */
    title: 'IpsumSearch',

    /**
     * Shown as a placeholder in the query input.
     */
    prompt: 'Search Lorem Ipsum',

    /**
     * Optional: The Atom action for toggling this provider via a command. Used to render
     * the associated keybinding.
     */
    action: 'sample-quickopen-provider-example:toggle-provider',

    /**
     * Optional: return whether the "Open All" button is allowed for this provider.
     * Default: true.
     */
    canOpenAll: false,
  },

  /**
   * Optional: return a specific delay (in ms) used to debounce queries to this provider.
   * Default: 200ms. Useful for e.g. reducing the delay for cheap queries (e.g. opened files).
   */
  debounceDelay: 0,

  /**
   * An optional number ≥ 0 used to determine ranking order in OmniSearch.
   * 0 == highest rank, +Infinity == lowest rank. Defaults to Number.POSITIVE_INFINITY.
   */
  priority: 20,

  /**
   * Only required if providerType === 'DIRECTORY'.
   */
  isEligibleForDirectory(directory: atom$Directory): Promise<boolean> {
    return Promise.resolve(true);
  },

  /**
   * Only required if providerType === 'GLOBAL'.
   */
  isEligibleForDirectories(
    directories: Array<atom$Directory>,
  ): Promise<boolean> {
    return Promise.resolve(true);
  },

  /**
   * Return the actual search results.
   * For providerType === 'DIRECTORY' the second parameter is `directory`.
   * For providerType === 'GLOBAL' it is `directories: Array<atom$Directory>`
   */
  executeQuery(
    query: string,
    directory: atom$Directory,
  ): Promise<Array<FileResult>> {
    if (!query.length) {
      return Promise.resolve([]);
    }
    const results = FIXTURE.filter(f => f.indexOf(query) !== -1).map(str => ({
      resultType: 'FILE',
      path: '/foo/bar/' + str + '.js',
    }));
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        resolve(results);
      }, 1000);
    });
  },

  /**
   * getComponentForItem Optional function that returns a React Element.
   * Useful for overriding the default view of a quick-open result.
   */
  // import React from 'react';
  // getComponentForItem(item: FileResult): React.Element {
  //   var {
  //     matchIndexes,
  //     path,
  //   } = item;
  //   return (
  //     <div className="">
  //       {path}
  //     </div>
  //   );
  // };
};

// eslint-disable-next-line rulesdir/no-commonjs
module.exports = ExampleProvider;
