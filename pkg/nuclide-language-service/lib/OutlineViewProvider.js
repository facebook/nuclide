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

import type {Outline, OutlineProvider} from 'atom-ide-ui';
import type {LanguageService} from './LanguageService';

import {ConnectionCache} from '../../nuclide-remote-connection';
import {getFileVersionOfEditor} from '../../nuclide-open-files';
import {trackTiming} from 'nuclide-analytics';

export type OutlineViewConfig = {|
  version: '0.1.0',
  priority: number,
  analyticsEventName: string,
|};

export class OutlineViewProvider<T: LanguageService> {
  grammarScopes: Array<string>;
  priority: number;
  name: string;
  _analyticsEventName: string;
  _connectionToLanguageService: ConnectionCache<T>;

  constructor(
    name: string,
    grammarScopes: Array<string>,
    priority: number,
    analyticsEventName: string,
    connectionToLanguageService: ConnectionCache<T>,
  ) {
    this.name = name;
    this.grammarScopes = grammarScopes;
    this.priority = priority;
    this._analyticsEventName = analyticsEventName;
    this._connectionToLanguageService = connectionToLanguageService;
  }

  static register(
    name: string,
    grammarScopes: Array<string>,
    config: OutlineViewConfig,
    connectionToLanguageService: ConnectionCache<T>,
  ): IDisposable {
    return atom.packages.serviceHub.provide(
      'outline-view',
      config.version,
      new OutlineViewProvider(
        name,
        grammarScopes,
        config.priority,
        config.analyticsEventName,
        connectionToLanguageService,
      ),
    );
  }

  getOutline(editor: atom$TextEditor): Promise<?Outline> {
    return trackTiming(this._analyticsEventName, async () => {
      const fileVersion = await getFileVersionOfEditor(editor);
      const languageService = this._connectionToLanguageService.getForUri(
        editor.getPath(),
      );
      if (languageService == null || fileVersion == null) {
        return null;
      }

      return (await languageService).getOutline(fileVersion);
    });
  }
}

(((null: any): OutlineViewProvider<LanguageService>): OutlineProvider);
