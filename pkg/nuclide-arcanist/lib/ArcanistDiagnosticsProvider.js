'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import type {BusySignalProviderBase} from '../../nuclide-busy-signal';

import type {
  MessageUpdateCallback,
  MessageInvalidationCallback,
} from '../../nuclide-diagnostics-common';
import type {
  Fix,
} from '../../nuclide-diagnostics-common/lib/rpc-types';

import type {ArcDiagnostic} from '../../nuclide-arcanist-rpc';

import {CompositeDisposable, Range} from 'atom';
import {Subject} from 'rxjs';
import {DiagnosticsProviderBase} from '../../nuclide-diagnostics-provider-base';

import featureConfig from '../../commons-atom/featureConfig';
import {trackTiming} from '../../nuclide-analytics';
import onWillDestroyTextBuffer from '../../commons-atom/on-will-destroy-text-buffer';
import {removeCommonSuffix} from '../../commons-node/string';
import invariant from 'assert';
import {getLogger} from '../../nuclide-logging';
import {getArcanistServiceByNuclideUri} from '../../nuclide-remote-connection';

const logger = getLogger();

export class ArcanistDiagnosticsProvider {
  _providerBase: DiagnosticsProviderBase;
  _runningProcess: Map<string, Subject<Array<ArcDiagnostic>>>;
  _subscriptions: atom$CompositeDisposable;
  _busySignalProvider: BusySignalProviderBase;

  constructor(busySignalProvider: BusySignalProviderBase) {
    this._busySignalProvider = busySignalProvider;
    this._subscriptions = new CompositeDisposable();
    const baseOptions = {
      enableForAllGrammars: true,
      shouldRunOnTheFly: false,
      onTextEditorEvent: this._runLintWithBusyMessage.bind(this),
    };
    this._providerBase = new DiagnosticsProviderBase(baseOptions);
    this._subscriptions.add(this._providerBase);
    this._runningProcess = new Map();
    this._subscriptions.add(onWillDestroyTextBuffer(buffer => {
      const path: ?string = buffer.getPath();
      if (!path) {
        return;
      }
      const runningProcess = this._runningProcess.get(path);
      if (runningProcess != null) {
        runningProcess.complete();
      }
      this._providerBase.publishMessageInvalidation({scope: 'file', filePaths: [path]});
    }));
  }

  dispose(): void {
    this._subscriptions.dispose();
  }

  /** The returned Promise will resolve when results have been published. */
  _runLintWithBusyMessage(textEditor: TextEditor): Promise<void> {
    const path = textEditor.getPath();
    if (path == null) {
      return Promise.resolve();
    }
    return this._busySignalProvider.reportBusy(
      `Waiting for arc lint results for \`${textEditor.getTitle()}\``,
      () => this._runLint(textEditor),
      {onlyForFile: path},
    );
  }

  /** Do not call this directly -- call _runLintWithBusyMessage */
  _runLint(textEditor: TextEditor): Promise<void> {
    return trackTiming(
      'nuclide-arcanist:lint',
      () => this.__runLint(textEditor),
    );
  }

  async __runLint(textEditor: TextEditor): Promise<void> {
    const filePath = textEditor.getPath();
    invariant(filePath);
    try {
      const diagnostics = await this._findDiagnostics(filePath);
      if (diagnostics == null) {
        return;
      }

      const fileDiagnostics = diagnostics.map(diagnostic => {
        const range = new Range(
          [diagnostic.row, diagnostic.col],
          [diagnostic.row, textEditor.getBuffer().lineLengthForRow(diagnostic.row)],
        );
        let text;
        if (Array.isArray(diagnostic.text)) {
          // Sometimes `arc lint` returns an array of strings for the text, rather than just a
          // string :(.
          text = diagnostic.text.join(' ');
        } else {
          text = diagnostic.text;
        }
        const maybeProperties = {};
        if (diagnostic.original != null &&
          diagnostic.replacement != null &&
          // Sometimes linters set original and replacement to the same value. Obviously that won't
          // fix anything.
          diagnostic.original !== diagnostic.replacement
        ) {
          // Copy the object so the type refinements hold...
          maybeProperties.fix = this._getFix({...diagnostic});
        }
        return {
          scope: 'file',
          providerName: 'Arc' + (diagnostic.code ? `: ${diagnostic.code}` : ''),
          type: diagnostic.type,
          text,
          filePath: diagnostic.filePath,
          range,
          ...maybeProperties,
        };
      });
      const diagnosticsUpdate = {
        filePathToMessages: new Map([[filePath, fileDiagnostics]]),
      };
      // If the editor has been closed since we made the request, we don't want to display the
      // errors. This ties in with the fact that we invalidate errors for a file when it is closed.
      if (!textEditor.isDestroyed()) {
        this._providerBase.publishMessageUpdate(diagnosticsUpdate);
      }
    } catch (error) {
      logger.error(error);
      return;
    }
  }

  async _findDiagnostics(filePath: string): Promise<?Array<ArcDiagnostic>> {
    const blacklistedLinters: Array<string> =
      (featureConfig.get('nuclide-arcanist.blacklistedLinters'): any);
    const runningProcess = this._runningProcess.get(filePath);
    if (runningProcess != null) {
      // This will cause the previous lint run to resolve with `undefined`.
      runningProcess.complete();
    }
    const arcService = getArcanistServiceByNuclideUri(filePath);
    const subject = new Subject();
    this._runningProcess.set(filePath, subject);
    const subscription = arcService.findDiagnostics(filePath, blacklistedLinters)
      .refCount()
      .toArray()
      .timeout((featureConfig.get('nuclide-arcanist.lintTimeout'): any))
      .subscribe(subject);
    return subject
      .finally(() => {
        subscription.unsubscribe();
        this._runningProcess.delete(filePath);
      })
      .toPromise();
  }

  // This type is a bit different than an ArcDiagnostic since original and replacement are
  // mandatory.
  _getFix(diagnostic: {row: number, col: number, original: string, replacement: string}): Fix {
    // For now just remove the suffix. The prefix would be nice too but it's a bit harder since we
    // then also have to manipulate the row/col accordingly.
    const [original, replacement] = removeCommonSuffix(diagnostic.original, diagnostic.replacement);
    return {
      oldRange: this._getRangeForFix(diagnostic.row, diagnostic.col, original),
      newText: replacement,
      oldText: original,
    };
  }

  _getRangeForFix(startRow: number, startCol: number, originalText: string): atom$Range {
    let newlineCount = 0;
    for (const char of originalText) {
      if (char === '\n') {
        newlineCount++;
      }
    }
    const endRow = startRow + newlineCount;
    const lastNewlineIndex = originalText.lastIndexOf('\n');
    let endCol;
    if (lastNewlineIndex === -1) {
      endCol = startCol + originalText.length;
    } else {
      endCol = originalText.length - lastNewlineIndex - 1;
    }

    return new Range([startRow, startCol], [endRow, endCol]);
  }

  onMessageUpdate(callback: MessageUpdateCallback): IDisposable {
    return this._providerBase.onMessageUpdate(callback);
  }

  onMessageInvalidation(callback: MessageInvalidationCallback): IDisposable {
    return this._providerBase.onMessageInvalidation(callback);
  }
}
