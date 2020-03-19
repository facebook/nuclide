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
import type {CoverageResult} from '../../nuclide-type-coverage/lib/rpc-types';
import type {IconName} from 'nuclide-commons-ui/Icon';
import type {LanguageService} from './LanguageService';

import {ConnectionCache} from '../../nuclide-remote-connection';
import {trackTiming} from 'nuclide-analytics';

export type TypeCoverageConfig = {|
  version: '0.0.0',
  priority: number,
  analyticsEventName: string,
  icon?: IconName,
|};

// Provides Diagnostics for un-typed regions of Hack code.
export class TypeCoverageProvider<T: LanguageService> {
  displayName: string;
  priority: number;
  grammarScopes: Array<string>;
  icon: IconName | void;
  _analyticsEventName: string;
  _connectionToLanguageService: ConnectionCache<T>;
  _onToggleValue: boolean;

  constructor(
    name: string,
    grammarScopes: Array<string>,
    priority: number,
    analyticsEventName: string,
    icon: IconName | void,
    connectionToLanguageService: ConnectionCache<T>,
  ) {
    this.displayName = name;
    this.priority = priority;
    this.grammarScopes = grammarScopes;
    this.icon = icon;
    this._analyticsEventName = analyticsEventName;
    this._connectionToLanguageService = connectionToLanguageService;
    this._onToggleValue = false;
    // eslint-disable-next-line nuclide-internal/unused-subscription
    this._connectionToLanguageService
      .observeValues()
      .subscribe(async languageService => {
        const ls = await languageService;
        ls.onToggleCoverage(this._onToggleValue);
      });
  }

  static register(
    name: string,
    grammarScopes: Array<string>,
    config: TypeCoverageConfig,
    connectionToLanguageService: ConnectionCache<T>,
  ): IDisposable {
    return atom.packages.serviceHub.provide(
      'nuclide-type-coverage',
      config.version,
      new TypeCoverageProvider(
        name,
        grammarScopes,
        config.priority,
        config.analyticsEventName,
        config.icon,
        connectionToLanguageService,
      ),
    );
  }

  async getCoverage(path: NuclideUri): Promise<?CoverageResult> {
    return trackTiming(this._analyticsEventName, async () => {
      const languageService = this._connectionToLanguageService.getForUri(path);
      if (languageService == null) {
        return null;
      }

      return (await languageService).getCoverage(path);
    });
  }

  async onToggle(on: boolean): Promise<void> {
    this._onToggleValue = on;
    await Promise.all(
      Array.from(this._connectionToLanguageService.values()).map(
        async languageService => {
          const ls = await languageService;
          ls.onToggleCoverage(on);
        },
      ),
    );
  }
}
