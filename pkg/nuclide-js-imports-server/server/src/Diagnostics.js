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

import {DiagnosticSeverity} from 'vscode-languageserver';
import {AutoImportsManager} from './lib/AutoImportsManager';
import {ImportFormatter} from './lib/ImportFormatter';

import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {ImportSuggestion} from './lib/types';

export const DIAGNOSTIC_SOURCE = 'JS Auto-imports';

export class Diagnostics {
  autoImportsManager: AutoImportsManager;
  importFormatter: ImportFormatter;

  constructor(
    autoImportsManager: AutoImportsManager,
    importFormatter: ImportFormatter,
  ) {
    this.autoImportsManager = autoImportsManager;
    this.importFormatter = importFormatter;
  }

  findDiagnosticsForFile(text: string, uri: NuclideUri) {
    return this.autoImportsManager
      .findMissingImports(uri, text)
      .map(missingImport =>
        missingImportToDiagnostic(this.importFormatter, missingImport, uri),
      );
  }
}

function missingImportToDiagnostic(
  importFormatter: ImportFormatter,
  importSuggestion: ImportSuggestion,
  uri: NuclideUri,
) {
  const {symbol} = importSuggestion;
  return {
    severity: DiagnosticSeverity.Warning,
    range: {
      start: {
        character: symbol.location.start.col,
        line: symbol.location.start.line - 1,
      },
      end: {
        character: symbol.location.end.col,
        line: symbol.location.end.line - 1,
      },
    },
    message: `The ${symbol.type} ${symbol.id} is not imported.`,
    source: DIAGNOSTIC_SOURCE,
  };
}
