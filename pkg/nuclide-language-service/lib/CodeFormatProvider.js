'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import type {LanguageService} from './LanguageService';

import {ConnectionCache} from '../../nuclide-remote-connection';
import {trackTiming} from '../../nuclide-analytics';
import {getFileVersionOfEditor} from '../../nuclide-open-files';

export type CodeFormatConfig = {
  version: '0.0.0',
  priority: number,
  analyticsEventName: string,
};

export class CodeFormatProvider<T: LanguageService> {
  name: string;
  selector: string;
  inclusionPriority: number;
  _analyticsEventName: string;
  _connectionToLanguageService: ConnectionCache<T>;

  constructor(
    name: string,
    selector: string,
    priority: number,
    analyticsEventName: string,
    connectionToLanguageService: ConnectionCache<T>,
  ) {
    this.name = name;
    this.selector = selector;
    this.inclusionPriority = priority;
    this._connectionToLanguageService = connectionToLanguageService;
  }

  static register(
    name: string,
    selector: string,
    config: CodeFormatConfig,
    connectionToLanguageService: ConnectionCache<T>,
  ): IDisposable {
    return atom.packages.serviceHub.provide(
      'nuclide-code-format.provider',
      config.version,
      new CodeFormatProvider(
        name,
        selector,
        config.priority,
        config.analyticsEventName,
        connectionToLanguageService,
      ));
  }

  formatCode(editor: atom$TextEditor, range: atom$Range): Promise<string> {
    return trackTiming(this._analyticsEventName, async () => {
      const fileVersion = await getFileVersionOfEditor(editor);
      const languageService = this._connectionToLanguageService.getForUri(editor.getPath());
      if (languageService != null && fileVersion != null) {
        const result = await (await languageService).formatSource(fileVersion, range);
        if (result != null) {
          return result;
        }
      }

      return editor.getTextInBufferRange(range);
    });
  }
}
