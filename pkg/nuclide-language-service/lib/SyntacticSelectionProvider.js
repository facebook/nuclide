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

import type {LanguageService} from './LanguageService';
import type {SyntacticSelectionProvider as SyntacticSelectionProviderType} from '../../nuclide-syntactic-selection/lib/types';

import {ConnectionCache} from '../../nuclide-remote-connection';
import {getFileVersionOfEditor} from '../../nuclide-open-files';
import {trackTiming} from '../../nuclide-analytics';

export type SyntacticSelectionConfig = {|
  version: '0.1.0',
  priority: number,
  expandAnalyticsEventName: string,
  collapseAnalyticsEventName: string,
|};

export class SyntacticSelectionProvider<T: LanguageService> {
  grammarScopes: Array<string>;
  priority: number;
  name: string;
  _expandAnalyticsEventName: string;
  _collapseAnalyticsEventName: string;
  _connectionToLanguageService: ConnectionCache<T>;

  constructor(
    name: string,
    grammarScopes: Array<string>,
    priority: number,
    expandAnalyticsEventName: string,
    collapseAnalyticsEventName: string,
    connectionToLanguageService: ConnectionCache<T>,
  ) {
    this.name = name;
    this.grammarScopes = grammarScopes;
    this.priority = priority;
    this._expandAnalyticsEventName = expandAnalyticsEventName;
    this._collapseAnalyticsEventName = collapseAnalyticsEventName;
    this._connectionToLanguageService = connectionToLanguageService;
  }

  static register(
    name: string,
    grammarScopes: Array<string>,
    config: SyntacticSelectionConfig,
    connectionToLanguageService: ConnectionCache<T>,
  ): IDisposable {
    return atom.packages.serviceHub.provide(
      'nuclide-syntactic-selection',
      config.version,
      new SyntacticSelectionProvider(
        name,
        grammarScopes,
        config.priority,
        config.expandAnalyticsEventName,
        config.collapseAnalyticsEventName,
        connectionToLanguageService,
      ),
    );
  }

  getExpandedSelectionRange(editor: atom$TextEditor): Promise<?atom$Range> {
    return trackTiming(this._expandAnalyticsEventName, async () => {
      const fileVersion = await getFileVersionOfEditor(editor);
      const languageService = this._connectionToLanguageService.getForUri(
        editor.getPath(),
      );
      if (languageService == null || fileVersion == null) {
        return null;
      }

      return (await languageService).getExpandedSelectionRange(
        fileVersion,
        editor.getSelectedBufferRange(),
      );
    });
  }

  getCollapsedSelectionRange(
    editor: atom$TextEditor,
    originalCursorPosition: atom$Point,
  ): Promise<?atom$Range> {
    return trackTiming(this._collapseAnalyticsEventName, async () => {
      const fileVersion = await getFileVersionOfEditor(editor);
      const languageService = this._connectionToLanguageService.getForUri(
        editor.getPath(),
      );
      if (languageService == null || fileVersion == null) {
        return null;
      }

      return (await languageService).getCollapsedSelectionRange(
        fileVersion,
        editor.getSelectedBufferRange(),
        originalCursorPosition,
      );
    });
  }
}

// Ensures that SyntacticSelectionProvider has all the fields and methods defined in
// the SyntacticSelectionProvider type in the atom-ide-syntactic-selection package.
(((null: any): SyntacticSelectionProvider<
  LanguageService,
>): SyntacticSelectionProviderType);
