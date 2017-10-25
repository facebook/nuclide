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

import {
  type CompletionItem,
  type TextDocumentPositionParams,
  type TextEdit,
  CompletionItemKind,
} from '../../nuclide-vscode-language-service-rpc/lib/protocol';
import type {ImportType} from './lib/ImportFormatter';

import {AutoImportsManager} from './lib/AutoImportsManager';
import {ImportFormatter, createImportStatement} from './lib/ImportFormatter';
import {compareForSuggestion} from './utils/util';
import {setIntersect} from 'nuclide-commons/collection';

import type TextDocuments from './TextDocuments';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {JSExport} from './lib/types';

type ImportInformation = {
  ids: Array<string>,
  importType: ImportType,
  isComplete: boolean,
};

const MAX_RESULTS = 200;

const INCOMPLETE_IMPORT_REGEX = {
  namedType: /^\s*import\s+type\s+{\s*([$\w]+)$/,
  namedValue: /^\s*import\s+{\s*([$\w\s,]+)$/,
  defaultType: /^\s*import\s+type\s+([$\w]+)$/,
  defaultValue: /^\s*import\s+([$\w]+)$/,
  requireImport: /^const\s+([$\w]+)$/,
  requireDestructured: /^const\s+{\s*([$\w]+)$/,
};

const IMPORT_STATEMENT_REGEXES = {
  namedType: /^\s*import\s+type\s+{\s*([$\w\s,]+)\s*}\s*(.*)/,
  namedValue: /^\s*import\s+{\s*([$\w\s,]+)\s*}\s*(.*)/,
  defaultType: /^\s*import\s+type\s+([$\w]+)\s+(.*)/,
  defaultValue: /^\s*import\s+([$\w]+)\s+(.*)/,
  requireImport: /^const\s+([$\w]+)\s+(.*)/,
  requireDestructured: /^const\s+{\s*([$\w\s,]+)\s*}\s*(.*)/,
};

export class Completions {
  documents: TextDocuments;
  autoImportsManager: AutoImportsManager;
  importsFormatter: ImportFormatter;

  constructor(
    documents: TextDocuments,
    autoImportsManager: AutoImportsManager,
    importsFormatter: ImportFormatter,
  ) {
    this.documents = documents;
    this.autoImportsManager = autoImportsManager;
    this.importsFormatter = importsFormatter;
  }

  provideCompletions(
    textDocumentPosition: TextDocumentPositionParams,
    nuclideFormattedUri: NuclideUri,
  ): Array<CompletionItem> {
    const {position, textDocument} = textDocumentPosition;

    // TODO(seansegal): Handle imports broken up on multiple lines.
    const line = this.documents
      .get(textDocument.uri)
      .buffer.lineForRow(position.line);

    if (
      positionIsAtLineEnd(line, position) &&
      // Check if line starts with "import" (or "const") before matching all regexes.
      isImportStatement(line) &&
      line.indexOf(';') < 0
    ) {
      const prefix = line.substr(0, position.character);
      const importInformation = getImportInformation(prefix);
      if (importInformation) {
        return importInformation.isComplete
          ? provideImportFileCompletions(
              importInformation,
              this.importsFormatter,
              this.autoImportsManager,
              nuclideFormattedUri,
              line,
              position.line,
            )
          : provideFullImportCompletions(
              importInformation,
              this.importsFormatter,
              this.autoImportsManager,
              nuclideFormattedUri,
              line,
              position.line,
            );
      }
    }
    return [];
  }
}

// Provides autocompletion of IDs that could be imported. When selected
// the entire import line is added.
export function provideFullImportCompletions(
  importInformation: ImportInformation,
  importsFormatter: ImportFormatter,
  autoImportsManager: AutoImportsManager,
  nuclideFormattedUri: NuclideUri,
  line: string,
  lineNum: number,
): Array<CompletionItem> {
  const {ids, importType} = importInformation;
  const exportsIndex = autoImportsManager.exportsManager.getExportsIndex();
  // 1) Find all IDs that fuzzily match the given string.
  const matchingIds = exportsIndex.getIdsMatching(ids[0], MAX_RESULTS);
  return matchingIds.reduce((results, id) => {
    const needed = MAX_RESULTS - results.length;
    if (needed <= 0) {
      return results;
    }
    // 2) For each ID, find all exports for the ID.
    const exportsForId = exportsIndex.getExportsFromId(id);
    // 3) Filter and sort the exports, and add them to the return list of completions.
    const importPaths = filterSuggestions(exportsForId, importType)
      .filter(jsExport => jsExport.uri !== nuclideFormattedUri)
      .map(suggestion =>
        importsFormatter.formatImportFile(nuclideFormattedUri, suggestion),
      )
      .sort(compareForSuggestion);
    return results.concat(
      importPaths.slice(0, needed).map(importPath => {
        return {
          label: id,
          kind: CompletionItemKind.Module,
          inlineDetail: importsFormatter.stripLeadingDots(importPath),
          textEdit: createLineEdit(
            lineNum,
            line,
            createImportStatement(id, importPath, importType),
          ),
        };
      }),
    );
  }, []);
}

// Given a list of IDs that are already typed, provide autocompletion for
// the files that those IDs might be imported from.
export function provideImportFileCompletions(
  importInformation: ImportInformation,
  importsFormatter: ImportFormatter,
  autoImportsManager: AutoImportsManager,
  nuclideFormattedUri: NuclideUri,
  line: string,
  lineNum: number,
): Array<CompletionItem> {
  const {ids, importType} = importInformation;
  // Intersect all exports for `ids` and then filter/sort the result.
  const suggestions = findCommonSuggestions(
    autoImportsManager,
    ids,
    importType,
  );
  return filterSuggestions(suggestions, importType)
    .filter(jsExport => jsExport.uri !== nuclideFormattedUri)
    .map(suggestion =>
      importsFormatter.formatImportFile(nuclideFormattedUri, suggestion),
    )
    .sort(compareForSuggestion)
    .slice(0, MAX_RESULTS)
    .map(importPath => {
      return {
        label:
          importType === 'requireImport' || importType === 'requireDestructured'
            ? `= require('${importPath}');`
            : `from '${importPath}';`,
        kind: CompletionItemKind.Module,
        textEdit: createLineEdit(
          lineNum,
          line,
          createImportStatement(ids.join(', '), importPath, importType),
        ),
      };
    });
}

// Find a list of URIs that contain all the given exports,
// and return a representative export for each one.
function findCommonSuggestions(
  autoImportsManager: AutoImportsManager,
  ids: Array<string>,
  importType: ImportType,
): Array<JSExport> {
  const suggestionsForEachId = ids.map(id =>
    autoImportsManager.findFilesWithSymbol(id),
  );
  if (suggestionsForEachId.length === 1) {
    return suggestionsForEachId[0];
  }
  const commonUris = suggestionsForEachId.reduce(
    (aggregated, suggestionForId) => {
      return setIntersect(aggregated, new Set(suggestionForId.map(s => s.uri)));
    },
    new Set(suggestionsForEachId[0].map(s => s.uri)),
  );
  return suggestionsForEachId[0].filter(e => commonUris.has(e.uri));
}

function filterSuggestions(
  suggestions: Array<JSExport>,
  importType: ImportType,
): Array<JSExport> {
  // Filter out suggestions based on the import type
  switch (importType) {
    case 'defaultValue':
      return suggestions.filter(exp => exp.isDefault && !exp.isTypeExport);
    case 'defaultType':
      return suggestions.filter(
        exp =>
          exp.isDefault && (exp.isTypeExport || isClassOrUnknownExport(exp)),
      );
    case 'namedValue':
      return suggestions.filter(exp => !exp.isDefault && !exp.isTypeExport);
    case 'namedType':
      return suggestions.filter(
        exp =>
          !exp.isDefault && (exp.isTypeExport || isClassOrUnknownExport(exp)),
      );
    case 'requireImport':
      return suggestions.filter(exp => exp.isDefault && !exp.isTypeExport);
    case 'requireDestructured':
      return suggestions.filter(exp => !exp.isDefault && !exp.isTypeExport);
    default:
      (importType: empty);
      return suggestions;
  }
}

// Exported for testing
export function getImportInformation(line: string): ?ImportInformation {
  for (const importType of Object.keys(IMPORT_STATEMENT_REGEXES)) {
    const importStatement = line.match(IMPORT_STATEMENT_REGEXES[importType]);
    if (importStatement && importStatement.length > 1) {
      if (importStatement[1] === 'type') {
        // Edge case: "import type TextDoc" will match complete defaultValue
        // regex, but we want it to match the incomplete defaultType regex.
        continue;
      }
      return {
        ids: importStatement[1]
          .split(',')
          .map(id => id.trim())
          .filter(id => id.length > 0),
        isComplete: true,
        importType,
      };
    }
  }
  for (const importType of Object.keys(INCOMPLETE_IMPORT_REGEX)) {
    const importStatement = line.match(INCOMPLETE_IMPORT_REGEX[importType]);
    if (importStatement && importStatement.length > 1) {
      return {
        ids: [importStatement[1]],
        isComplete: false,
        importType,
      };
    }
  }
  return null;
}

function createLineEdit(
  lineNum: number,
  lineText: string,
  newText: string,
): TextEdit {
  return {
    range: {
      start: {line: lineNum, character: 0},
      end: {line: lineNum, character: lineText.length},
    },
    newText,
  };
}

function isImportStatement(line: string): boolean {
  return /^\s*import/.test(line) || /^const/.test(line);
}

// This function will always return true when an export is a Class export,
// but will sometimes return true even if an export is NOT a class export.
// More specifically, if the type of export is unknown (for example, this would
// happen in the program: "class SomeClass{}; export {SomeClass}")
// this function returns true.
function isClassOrUnknownExport(exp: JSExport): boolean {
  return (
    !exp.type ||
    exp.type === 'ClassDeclaration' ||
    exp.type === 'ClassExpression'
  );
}

function positionIsAtLineEnd(line: string, position: Object): boolean {
  if (line.length === position.character) {
    return true;
  }
  const remainder = line.substr(position.character).trim();
  // Still provide autocomplete if there is trailing whitespace.
  // Editor bracket matchers often insert a trailing "}", which should also be ignored.
  return remainder === '' || remainder === '}';
}
