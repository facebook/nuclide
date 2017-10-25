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

import type {FormatOptions, LanguageService} from './LanguageService';
import type {
  RangeCodeFormatProvider,
  FileCodeFormatProvider,
  OnTypeCodeFormatProvider,
} from 'atom-ide-ui';
import type {TextEdit} from 'nuclide-commons-atom/text-edit';

import {ConnectionCache} from '../../nuclide-remote-connection';
import {trackTiming} from '../../nuclide-analytics';
import {getFileVersionOfEditor} from '../../nuclide-open-files';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';

export type CodeFormatConfig = {|
  version: '0.1.0',
  priority: number,
  analyticsEventName: string,

  // If true, support formatting at ranges. Also, use the range formatter to
  // format the whole document. If false, only support formatting the whole
  // document, using the document formatter.
  canFormatRanges: boolean,

  // If true, support formatting at a position (such as for as-you-type
  // formatting). If false, don't support that.
  canFormatAtPosition: boolean,
|};

export class CodeFormatProvider<T: LanguageService> {
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

  static register(
    name: string,
    grammarScopes: Array<string>,
    config: CodeFormatConfig,
    connectionToLanguageService: ConnectionCache<T>,
  ): IDisposable {
    const disposable = new UniversalDisposable(
      config.canFormatRanges
        ? atom.packages.serviceHub.provide(
            'code-format.range',
            config.version,
            new RangeFormatProvider(
              name,
              grammarScopes,
              config.priority,
              config.analyticsEventName,
              connectionToLanguageService,
            ).provide(),
          )
        : atom.packages.serviceHub.provide(
            'code-format.file',
            config.version,
            new FileFormatProvider(
              name,
              grammarScopes,
              config.priority,
              config.analyticsEventName,
              connectionToLanguageService,
            ).provide(),
          ),
    );

    if (config.canFormatAtPosition) {
      disposable.add(
        atom.packages.serviceHub.provide(
          'code-format.onType',
          config.version,
          new PositionFormatProvider(
            name,
            grammarScopes,
            config.priority,
            config.analyticsEventName,
            connectionToLanguageService,
          ).provide(),
        ),
      );
    }

    return disposable;
  }
}

class RangeFormatProvider<T: LanguageService> extends CodeFormatProvider<T> {
  constructor(
    name: string,
    grammarScopes: Array<string>,
    priority: number,
    analyticsEventName: string,
    connectionToLanguageService: ConnectionCache<T>,
  ) {
    super(
      name,
      grammarScopes,
      priority,
      analyticsEventName,
      connectionToLanguageService,
    );
  }

  formatCode(
    editor: atom$TextEditor,
    range: atom$Range,
  ): Promise<Array<TextEdit>> {
    return trackTiming(this._analyticsEventName, async () => {
      const fileVersion = await getFileVersionOfEditor(editor);
      const languageService = this._connectionToLanguageService.getForUri(
        editor.getPath(),
      );
      if (languageService != null && fileVersion != null) {
        const result = await (await languageService).formatSource(
          fileVersion,
          range,
          getFormatOptions(editor),
        );
        if (result != null) {
          return result;
        }
      }

      return [];
    });
  }

  provide(): RangeCodeFormatProvider {
    return {
      formatCode: this.formatCode.bind(this),
      grammarScopes: this.grammarScopes,
      priority: this.priority,
    };
  }
}

class FileFormatProvider<T: LanguageService> extends CodeFormatProvider<T> {
  constructor(
    name: string,
    grammarScopes: Array<string>,
    priority: number,
    analyticsEventName: string,
    connectionToLanguageService: ConnectionCache<T>,
  ) {
    super(
      name,
      grammarScopes,
      priority,
      analyticsEventName,
      connectionToLanguageService,
    );
  }

  formatEntireFile(
    editor: atom$TextEditor,
    range: atom$Range,
  ): Promise<{
    newCursor?: number,
    formatted: string,
  }> {
    return trackTiming(this._analyticsEventName, async () => {
      const fileVersion = await getFileVersionOfEditor(editor);
      const languageService = this._connectionToLanguageService.getForUri(
        editor.getPath(),
      );
      if (languageService != null && fileVersion != null) {
        const result = await (await languageService).formatEntireFile(
          fileVersion,
          range,
          getFormatOptions(editor),
        );
        if (result != null) {
          return result;
        }
      }

      return {formatted: editor.getText()};
    });
  }

  provide(): FileCodeFormatProvider {
    return {
      formatEntireFile: this.formatEntireFile.bind(this),
      grammarScopes: this.grammarScopes,
      priority: this.priority,
    };
  }
}

class PositionFormatProvider<T: LanguageService> extends CodeFormatProvider<T> {
  formatAtPosition(
    editor: atom$TextEditor,
    position: atom$Point,
    character: string,
  ): Promise<Array<TextEdit>> {
    return trackTiming(this._analyticsEventName, async () => {
      const fileVersion = await getFileVersionOfEditor(editor);
      const languageService = this._connectionToLanguageService.getForUri(
        editor.getPath(),
      );
      if (languageService != null && fileVersion != null) {
        const result = await (await languageService).formatAtPosition(
          fileVersion,
          position,
          character,
          getFormatOptions(editor),
        );
        if (result != null) {
          return result;
        }
      }

      return [];
    });
  }

  provide(): OnTypeCodeFormatProvider {
    return {
      formatAtPosition: this.formatAtPosition.bind(this),
      grammarScopes: this.grammarScopes,
      priority: this.priority,
    };
  }
}

function getFormatOptions(editor: atom$TextEditor): FormatOptions {
  return {
    tabSize: editor.getTabLength(),
    insertSpaces: editor.getSoftTabs(),
  };
}
