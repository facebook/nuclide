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

import {Command, Diagnostic} from 'vscode-languageserver';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {AddImportCommandParams} from './CommandExecuter';

import {AutoImportsManager} from './lib/AutoImportsManager';
import {ImportFormatter} from './lib/ImportFormatter';
import {arrayFlatten} from 'nuclide-commons/collection';
import {DIAGNOSTIC_SOURCE} from './Diagnostics';

export class CodeActions {
  autoImportsManager: AutoImportsManager;
  importFormatter: ImportFormatter;

  constructor(
    autoImportsManager: AutoImportsManager,
    importFormatter: ImportFormatter,
  ) {
    this.autoImportsManager = autoImportsManager;
    this.importFormatter = importFormatter;
  }

  provideCodeActions(
    diagnostics: Array<Diagnostic>,
    fileUri: NuclideUri,
  ): Array<Command> {
    return arrayFlatten(
      diagnostics.map(diagnostic =>
        diagnosticToCommands(
          this.autoImportsManager,
          this.importFormatter,
          diagnostic,
          fileUri,
        ),
      ),
    );
  }
}

function diagnosticToCommands(
  autoImportsManager: AutoImportsManager,
  importFormatter: ImportFormatter,
  diagnostic: Diagnostic,
  fileWithDiagnostic: NuclideUri,
): Array<Command> {
  // For now, only offer CodeActions for this server's Diagnostics. In the future,
  // we can provide CodeActions for Flow or the Linter.
  if (diagnostic.source === DIAGNOSTIC_SOURCE) {
    return arrayFlatten(
      autoImportsManager
        .getSuggestedImportsForRange(fileWithDiagnostic, diagnostic.range)
        // Create a CodeAction for each file with an export.
        .map(missingImport =>
          missingImport.filesWithExport.map(fileWithExport => {
            const addImportArgs: AddImportCommandParams = [
              missingImport.symbol.id,
              fileWithExport,
              fileWithDiagnostic,
            ];
            return {
              title: `Import from ${importFormatter.formatImportFile(
                fileWithDiagnostic,
                fileWithExport,
              )}`,
              command: 'addImport',
              arguments: addImportArgs,
            };
          }),
        ),
    );
  }
  return [];
}
