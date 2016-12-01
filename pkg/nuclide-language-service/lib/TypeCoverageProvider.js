'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import type {NuclideUri} from '../../commons-node/nuclideUri';
import type {CoverageResult} from '../../nuclide-type-coverage/lib/rpc-types';
import type {LanguageService} from './LanguageService';

import {ConnectionCache} from '../../nuclide-remote-connection';
import {trackTiming} from '../../nuclide-analytics';

export type TypeCoverageConfig = {
  version: '0.0.0',
  priority: number,
  analyticsEventName: string,
};

// Provides Diagnostics for un-typed regions of Hack code.
export class TypeCoverageProvider<T: LanguageService> {
  displayName: string
  priority: number;
  grammarScopes: string
  _analyticsEventName: string;
  _connectionToLanguageService: ConnectionCache<T>;

  constructor(
    name: string,
    selector: string,
    priority: number,
    analyticsEventName: string,
    connectionToLanguageService: ConnectionCache<T>,
  ) {
    this.displayName = name;
    this.priority = priority;
    this.grammarScopes = selector;
    this._analyticsEventName = analyticsEventName;
    this._connectionToLanguageService = connectionToLanguageService;
  }

  static register(
    name: string,
    selector: string,
    config: TypeCoverageConfig,
    connectionToLanguageService: ConnectionCache<T>,
  ): IDisposable {
    return atom.packages.serviceHub.provide(
      'nuclide-type-coverage',
      config.version,
      new TypeCoverageProvider(
        name,
        selector,
        config.priority,
        config.analyticsEventName,
        connectionToLanguageService,
      ));
  }

  async getCoverage(path: NuclideUri): Promise<?CoverageResult> {
    return trackTiming(this._analyticsEventName, async () => {
      const languageService = this._connectionToLanguageService.getForUri(path);
      if (languageService == null) {
        return null;
      }

      return await (await languageService).getCoverage(path);
    });
  }
}
