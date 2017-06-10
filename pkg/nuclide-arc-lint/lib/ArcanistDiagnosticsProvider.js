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

import type {ArcDiagnostic} from '../../nuclide-arcanist-rpc';
import type {LinterMessage} from 'atom-ide-ui';

import {Range} from 'atom';
import {Subject} from 'rxjs';
import os from 'os';

import featureConfig from 'nuclide-commons-atom/feature-config';
import {trackTiming} from '../../nuclide-analytics';
import {removeCommonSuffix} from 'nuclide-commons/string';
import {PromisePool} from '../../commons-node/promise-executors';
import {getLogger} from 'log4js';
import {getArcanistServiceByNuclideUri} from '../../nuclide-remote-connection';

const logger = getLogger('nuclide-arc-lint');

const _runningProcess = new Map();
const _promisePool = new PromisePool(Math.round(os.cpus().length / 2));

export function lint(textEditor: TextEditor): Promise<?Array<LinterMessage>> {
  return trackTiming('nuclide-arcanist:lint', () => _lint(textEditor));
}

async function _lint(textEditor: TextEditor): Promise<?Array<LinterMessage>> {
  const filePath = textEditor.getPath();
  if (filePath == null) {
    return null;
  }

  let diagnostics;
  try {
    diagnostics = await _findDiagnostics(filePath);
  } catch (err) {
    logger.warn('arc lint failed:', err);
    return null;
  }

  if (diagnostics == null) {
    return null;
  } else if (textEditor.isDestroyed()) {
    return [];
  }

  return diagnostics.map(diagnostic => {
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
    if (
      diagnostic.original != null &&
      diagnostic.replacement != null &&
      // Sometimes linters set original and replacement to the same value. Obviously that won't
      // fix anything.
      diagnostic.original !== diagnostic.replacement
    ) {
      // Copy the object so the type refinements hold...
      maybeProperties.fix = _getFix({...diagnostic});
    }
    return {
      name: 'Arc' + (diagnostic.code ? `: ${diagnostic.code}` : ''),
      type: diagnostic.type,
      text,
      filePath: diagnostic.filePath,
      range,
      ...maybeProperties,
    };
  });
}

async function _findDiagnostics(
  filePath: string,
): Promise<?Array<ArcDiagnostic>> {
  const blacklistedLinters: Array<string> = (featureConfig.get(
    'nuclide-arc-lint.blacklistedLinters',
  ): any);
  const runningProcess = _runningProcess.get(filePath);
  if (runningProcess != null) {
    // This will cause the previous lint run to resolve with `undefined`.
    runningProcess.complete();
  }
  const subject = new Subject();
  _runningProcess.set(filePath, subject);
  return _promisePool.submit(() => {
    // It's possible that the subject was replaced by a queued lint run.
    if (_runningProcess.get(filePath) !== subject) {
      return Promise.resolve(null);
    }
    const arcService = getArcanistServiceByNuclideUri(filePath);
    const subscription = arcService
      .findDiagnostics(filePath, blacklistedLinters)
      .refCount()
      .toArray()
      .timeout((featureConfig.get('nuclide-arc-lint.lintTimeout'): any))
      .subscribe(subject);
    return subject
      .finally(() => {
        subscription.unsubscribe();
        _runningProcess.delete(filePath);
      })
      .toPromise();
  });
}

// This type is a bit different than an ArcDiagnostic since original and replacement are
// mandatory.
function _getFix(diagnostic: {
  row: number,
  col: number,
  original: string,
  replacement: string,
}) {
  // For now just remove the suffix. The prefix would be nice too but it's a bit harder since we
  // then also have to manipulate the row/col accordingly.
  const [original, replacement] = removeCommonSuffix(
    diagnostic.original,
    diagnostic.replacement,
  );
  return {
    range: _getRangeForFix(diagnostic.row, diagnostic.col, original),
    newText: replacement,
    oldText: original,
  };
}

function _getRangeForFix(
  startRow: number,
  startCol: number,
  originalText: string,
): atom$Range {
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

export const __testing__ = {
  _findDiagnostics,
  _getRangeForFix,
  _getFix,
  _runningProcess,
};
