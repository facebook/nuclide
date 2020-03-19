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

import type {DefinitionQueryResult} from 'atom-ide-ui';
import type {LanguageService} from './LanguageService';

import {ConnectionCache} from '../../nuclide-remote-connection';
import {trackTiming} from 'nuclide-analytics';
import {getFileVersionOfEditor} from '../../nuclide-open-files';

export type DefinitionConfig = {|
  version: '0.1.0',
  priority: number,
  wordRegExp?: RegExp,
  definitionEventName: string,
|};

export class DefinitionProvider<T: LanguageService> {
  name: string;
  priority: number;
  grammarScopes: Array<string>;
  wordRegExp: ?RegExp;
  _definitionEventName: string;
  _connectionToLanguageService: ConnectionCache<T>;

  constructor(
    name: string,
    grammars: Array<string>,
    priority: number,
    definitionEventName: string,
    wordRegExp: ?RegExp,
    connectionToLanguageService: ConnectionCache<T>,
  ) {
    this.name = name;
    this.priority = priority;
    this.grammarScopes = grammars;
    this.wordRegExp = wordRegExp;
    this._definitionEventName = definitionEventName;
    this._connectionToLanguageService = connectionToLanguageService;
  }

  static register(
    name: string,
    grammars: Array<string>,
    config: DefinitionConfig,
    connectionToLanguageService: ConnectionCache<T>,
  ): IDisposable {
    return atom.packages.serviceHub.provide(
      'definitions',
      config.version,
      new DefinitionProvider(
        name,
        grammars,
        config.priority,
        config.definitionEventName,
        config.wordRegExp,
        connectionToLanguageService,
      ),
    );
  }

  async getDefinition(
    editor: TextEditor,
    position: atom$Point,
  ): Promise<?DefinitionQueryResult> {
    return trackTiming(this._definitionEventName, async () => {
      const fileVersion = await getFileVersionOfEditor(editor);
      const languageService = this._connectionToLanguageService.getForUri(
        editor.getPath(),
      );
      if (languageService == null || fileVersion == null) {
        return null;
      }
      return (await languageService).getDefinition(fileVersion, position);
    });
  }
}
