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
import type {AddImportCommandParams} from './CommandExecutor';

import {AutoImportsManager} from './lib/AutoImportsManager';
import {ImportFormatter} from './lib/ImportFormatter';
import {arrayFlatten} from 'nuclide-commons/collection';
import {DIAGNOSTIC_SOURCE} from './Diagnostics';
import {babelLocationToAtomRange, lspRangeToAtomRange} from './utils/util';
import {compareForSuggestion} from './utils/util';

const CODE_ACTIONS_LIMIT = 10;
const FLOW_DIAGNOSTIC_SOURCE = 'Flow';

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
  if (
    diagnostic.source === DIAGNOSTIC_SOURCE ||
    diagnostic.source === FLOW_DIAGNOSTIC_SOURCE
  ) {
    return arrayFlatten(
      autoImportsManager
        .getSuggestedImportsForRange(fileWithDiagnostic, diagnostic.range)
        .filter(suggestedImport => {
          // For Flow's diagnostics, only fire for missing types (exact match)
          if (diagnostic.source === FLOW_DIAGNOSTIC_SOURCE) {
            if (suggestedImport.symbol.type !== 'type') {
              return false;
            }
            const range = babelLocationToAtomRange(
              suggestedImport.symbol.location,
            );
            const diagnosticRange = lspRangeToAtomRange(diagnostic.range);
            return range.isEqual(diagnosticRange);
          }
          // Otherwise this has to be a value import.
          return suggestedImport.symbol.type === 'value';
        })
        // Create a CodeAction for each file with an export.
        .map(missingImport =>
          missingImport.filesWithExport.map(jsExport => ({
            ...jsExport,
            // Force this to be imported as a type/value depending on the context.
            isTypeExport: missingImport.symbol.type === 'type',
          })),
        ),
    )
      .map(fileWithExport => ({
        fileWithExport,
        importPath: importFormatter.formatImportFile(
          fileWithDiagnostic,
          fileWithExport,
        ),
      }))
      .sort((a, b) => compareForSuggestion(a.importPath, b.importPath))
      .slice(0, CODE_ACTIONS_LIMIT)
      .map(({fileWithExport, importPath}) => {
        const addImportArgs: AddImportCommandParams = [
          fileWithExport,
          fileWithDiagnostic,
        ];
        let verb;
        if (fileWithExport.isTypeExport) {
          verb = 'Import type';
        } else if (importFormatter.useRequire) {
          verb = 'Require';
        } else {
          verb = 'Import';
        }
        return {
          title: `${verb} from ${importPath}`,
          command: 'addImport',
          arguments: addImportArgs,
        };
      });
  }
  return [];
}
