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
import type {BusySignalProvider} from './AtomLanguageService';
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
  version: '0.0.0',
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
  selector: string;
  inclusionPriority: number;
  _analyticsEventName: string;
  _connectionToLanguageService: ConnectionCache<T>;
  _busySignalProvider: BusySignalProvider;

  constructor(
    name: string,
    selector: string,
    priority: number,
    analyticsEventName: string,
    connectionToLanguageService: ConnectionCache<T>,
    busySignalProvider: BusySignalProvider,
  ) {
    this.name = name;
    this.selector = selector;
    this.inclusionPriority = priority;
    this._connectionToLanguageService = connectionToLanguageService;
    this._busySignalProvider = busySignalProvider;
  }

  static register(
    name: string,
    selector: string,
    config: CodeFormatConfig,
    connectionToLanguageService: ConnectionCache<T>,
    busySignalProvider: BusySignalProvider,
  ): IDisposable {
    const disposable = new UniversalDisposable(
      atom.packages.serviceHub.provide(
        'nuclide-code-format.provider',
        config.version,
        config.canFormatRanges
          ? new RangeFormatProvider(
              name,
              selector,
              config.priority,
              config.analyticsEventName,
              connectionToLanguageService,
              busySignalProvider,
            ).provide()
          : new FileFormatProvider(
              name,
              selector,
              config.priority,
              config.analyticsEventName,
              connectionToLanguageService,
              busySignalProvider,
            ).provide(),
      ),
    );

    if (config.canFormatAtPosition) {
      disposable.add(
        atom.packages.serviceHub.provide(
          'nuclide-code-format.provider',
          config.version,
          new PositionFormatProvider(
            name,
            selector,
            config.priority,
            config.analyticsEventName,
            connectionToLanguageService,
            busySignalProvider,
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
    selector: string,
    priority: number,
    analyticsEventName: string,
    connectionToLanguageService: ConnectionCache<T>,
    busySignalProvider: BusySignalProvider,
  ) {
    super(
      name,
      selector,
      priority,
      analyticsEventName,
      connectionToLanguageService,
      busySignalProvider,
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
        const result = await this._busySignalProvider.reportBusyWhile(
          `${this.name}: Formatting ${fileVersion.filePath}`,
          async () => {
            return (await languageService).formatSource(fileVersion, range);
          },
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
      selector: this.selector,
      inclusionPriority: this.inclusionPriority,
    };
  }
}

class FileFormatProvider<T: LanguageService> extends CodeFormatProvider<T> {
  constructor(
    name: string,
    selector: string,
    priority: number,
    analyticsEventName: string,
    connectionToLanguageService: ConnectionCache<T>,
    busySignalProvider: BusySignalProvider,
  ) {
    super(
      name,
      selector,
      priority,
      analyticsEventName,
      connectionToLanguageService,
      busySignalProvider,
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
        const result = await this._busySignalProvider.reportBusyWhile(
          `${this.name}: Formatting ${fileVersion.filePath}`,
          async () => {
            return (await languageService).formatEntireFile(fileVersion, range);
          },
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
      selector: this.selector,
      inclusionPriority: this.inclusionPriority,
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
        const result = await this._busySignalProvider.reportBusyWhile(
          `${this.name}: Formatting ${fileVersion.filePath}`,
          async () => {
            return (await languageService).formatAtPosition(
              fileVersion,
              position,
              character,
            );
          },
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
      selector: this.selector,
      inclusionPriority: this.inclusionPriority,
    };
  }
}
