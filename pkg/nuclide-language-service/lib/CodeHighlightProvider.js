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

import type {CodeHighlightProvider as CodeHighlightProviderType} from 'atom-ide-ui';
import type {LanguageService} from './LanguageService';

import {trackTiming} from '../../nuclide-analytics';
import {ConnectionCache} from '../../nuclide-remote-connection';
import {getFileVersionOfEditor} from '../../nuclide-open-files';
import {Range} from 'atom';

export type CodeHighlightConfig = {|
  version: '0.1.0',
  priority: number,
  analyticsEventName: string,
|};

export class CodeHighlightProvider<T: LanguageService> {
  name: string;
  grammarScopes: Array<string>;
  priority: number;
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

  highlight(
    editor: atom$TextEditor,
    position: atom$Point,
  ): Promise<?Array<atom$Range>> {
    return trackTiming(this._analyticsEventName, async () => {
      const fileVersion = await getFileVersionOfEditor(editor);
      const languageService = this._connectionToLanguageService.getForUri(
        editor.getPath(),
      );
      if (languageService == null || fileVersion == null) {
        return null;
      }

      const result = await (await languageService).highlight(
        fileVersion,
        position,
      );
      if (result == null) {
        return null;
      }

      return result.map(range => new Range(range.start, range.end));
    });
  }

  static register(
    name: string,
    grammarScopes: Array<string>,
    config: CodeHighlightConfig,
    connectionToLanguageService: ConnectionCache<T>,
  ): IDisposable {
    return atom.packages.serviceHub.provide(
      'code-highlight',
      config.version,
      new CodeHighlightProvider(
        name,
        grammarScopes,
        config.priority,
        config.analyticsEventName,
        connectionToLanguageService,
      ),
    );
  }
}

(((null: any): CodeHighlightProvider<
  LanguageService,
>): CodeHighlightProviderType);
