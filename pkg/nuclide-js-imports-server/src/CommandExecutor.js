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

import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {SourceOptions} from './common/options/SourceOptions';
import type {AutoImportsManager} from './lib/AutoImportsManager';
import type {JSExport, JSImport} from './lib/types';
import type TextDocuments from '../../nuclide-lsp-implementation-common/TextDocuments';
import type {
  TextEdit,
  WorkspaceEdit,
} from '../../nuclide-vscode-language-service-rpc/lib/protocol';

import {applyTextEditsToBuffer} from 'nuclide-commons-atom/text-edit';
import {arrayFlatten} from 'nuclide-commons/collection';
import {IConnection} from 'vscode-languageserver';
import {lspTextEdits_atomTextEdits} from '../../nuclide-vscode-language-service-rpc/lib/convert';
import {getDefaultSettings, calculateOptions} from './common/settings';
import {ADD_IMPORT_COMMAND_ID} from './constants';
import {ImportFormatter} from './lib/ImportFormatter';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {parseFile} from './lib/AutoImportsManager';
import {Range} from 'simple-text-buffer';
import {
  compareForInsertion,
  getRequiredModule,
  compareForSuggestion,
} from './utils/util';
import TextBuffer from 'simple-text-buffer';
import {atomRangeToLSPRange} from '../../nuclide-lsp-implementation-common/lsp-utils';

export type AddImportCommandParams = [JSExport, NuclideUri];

type EditParams = {
  row: number,
  column: number,
  indent?: number,
  newLinesBefore: number,
  newLinesAfter: number,
};

export class CommandExecutor {
  static COMMANDS = {
    [ADD_IMPORT_COMMAND_ID]: true,
  };

  connection: IConnection;
  autoImportsManager: AutoImportsManager;
  importFormatter: ImportFormatter;
  documents: TextDocuments;

  constructor(
    connection: IConnection,
    autoImportsManager: AutoImportsManager,
    importFormatter: ImportFormatter,
    documents: TextDocuments,
  ) {
    this.connection = connection;
    this.autoImportsManager = autoImportsManager;
    this.importFormatter = importFormatter;
    this.documents = documents;
  }

  executeCommand(command: string, args: any) {
    switch (command) {
      case ADD_IMPORT_COMMAND_ID:
        return this._addImport((args: AddImportCommandParams));
      case 'organizeImports':
        return this._organizeImports(args[0]);
      default:
        throw new Error(`Unexpected command ${command}`);
    }
  }

  async _addImport(args: AddImportCommandParams): Promise<void> {
    const [missingImport, fileMissingImport] = args;
    const ast = parseFile(
      this.documents
        .get(nuclideUri.nuclideUriToUri(fileMissingImport))
        .getText(),
    );
    if (ast == null || ast.program == null || ast.program.body == null) {
      // File could not be parsed. If this is reached, we shouldn't be applying
      // addImport anyways since the file must have changed from when we computed
      // the CodeAction.
      return;
    }
    const {body} = ast.program;
    const edits = getEditsForImport(
      this.importFormatter,
      fileMissingImport,
      missingImport,
      body,
    );

    await this.connection.workspace.applyEdit(
      this._toWorkspaceEdit(fileMissingImport, edits),
    );
  }

  async _organizeImports(filePath: NuclideUri): Promise<void> {
    // get edits for the missing imports
    const edits = this._getEditsForFixingMissingImports(filePath);

    // Apply text edits to add missing imports to a buffer containing the full
    // source and then organize the imports in the buffer in a seperate step.
    // This was done in 2 steps because code for organizing was ported from an
    // external Atom package and we wanted to avoid a huge refactor.
    const filePathUri = nuclideUri.nuclideUriToUri(filePath);
    const atomTextEdits = lspTextEdits_atomTextEdits(edits);
    const inputSource = this.documents.get(filePathUri).getText();

    const buffer = new TextBuffer(inputSource);
    const oldRange = this.documents.get(filePathUri).buffer.getRange();
    applyTextEditsToBuffer(buffer, atomTextEdits);
    const sourceWithMissingImportsAdded = buffer.getText();

    const settings = getDefaultSettings();
    const options = calculateOptions(settings);

    const transformResult = transformCodeOrShowError(
      sourceWithMissingImportsAdded,
      options,
    );

    const edit = [
      {
        range: atomRangeToLSPRange(oldRange),
        newText: transformResult,
      },
    ];

    await this.connection.workspace.applyEdit(
      this._toWorkspaceEdit(filePath, edit),
    );
  }

  _toWorkspaceEdit(
    filePath: NuclideUri,
    edits: Array<TextEdit>,
  ): WorkspaceEdit {
    const lspUri = nuclideUri.nuclideUriToUri(filePath);
    // Version 2.0 LSP
    const changes = {};
    changes[lspUri] = edits;

    // Version 3.0 LSP
    const documentChanges = [
      {
        textDocument: {
          uri: lspUri,
          version: this.documents.get(lspUri).version,
        },
        edits,
      },
    ];

    return ({changes, documentChanges}: WorkspaceEdit);
  }

  _getEditsForFixingMissingImports(
    fileMissingImport: NuclideUri,
  ): Array<TextEdit> {
    const fileMissingImportUri = nuclideUri.nuclideUriToUri(fileMissingImport);
    const ast = parseFile(this.documents.get(fileMissingImportUri).getText());
    if (ast == null || ast.program == null || ast.program.body == null) {
      // TODO(T24077432): Figure out when this happens and throw an error
      return [];
    }
    const {body} = ast.program;
    return arrayFlatten(
      this.autoImportsManager
        .findMissingImportsInAST(fileMissingImport, ast, false)
        .map(({filesWithExport, symbol}) => {
          if (filesWithExport.length === 0) {
            return undecidableImportEdits();
          }
          const missingImport = findClosestImport(
            symbol.id,
            fileMissingImport,
            filesWithExport,
          );
          if (!missingImport) {
            return undecidableImportEdits();
          }
          return getEditsForImport(
            this.importFormatter,
            fileMissingImport,
            missingImport,
            body,
          );
        }),
    );
  }
}

function transformCodeOrShowError(
  inputSource: string,
  options: SourceOptions,
): string {
  const {transform} = require('./common/transform');
  // TODO: Add a limit so the transform is not run on files over a certain size.
  const result = transform(inputSource, options);
  return result.output;
}

export function getEditsForImport(
  importFormatter: ImportFormatter,
  fileMissingImport: NuclideUri,
  missingImport: JSExport,
  programBody: Array<Object>,
): Array<TextEdit> {
  const importPath = importFormatter.formatImportFile(
    fileMissingImport,
    missingImport,
  );
  const insertEdit = insertIntoExistingImport(
    importPath,
    missingImport,
    programBody,
  );
  if (insertEdit != null) {
    return [createEdit(missingImport.id, insertEdit)];
  }
  return [
    createEdit(
      importFormatter.formatImport(fileMissingImport, missingImport),
      createNewImport(
        missingImport,
        programBody,
        importPath,
        importFormatter.useRequire,
      ),
    ),
  ];
}

function createEdit(
  insertText: string,
  {row, column, indent, newLinesAfter, newLinesBefore}: EditParams,
): TextEdit {
  return {
    range: atomRangeToLSPRange(new Range([row, column], [row, column])),
    newText:
      // We're always going to insert before any trailing commas, so it's safe to always add one.
      (column === 0 ? '' : ',') +
      '\n'.repeat(newLinesBefore) +
      ' '.repeat(indent || 0) +
      insertText +
      '\n'.repeat(newLinesAfter),
  };
}

// Find a position where we can just insert the missing ID.
function insertIntoExistingImport(
  importPath: string,
  missingImport: JSExport,
  programBody: Array<Object>,
): ?EditParams {
  // For now, we won't allow mixed imports (e.g. import {type X, Y})
  if (missingImport.isDefault) {
    return null;
  }
  for (const node of programBody) {
    const jsImport = getJSImport(node);
    if (jsImport == null) {
      continue;
    }
    const isTypeImport = jsImport.type === 'importType';
    if (
      jsImport.importPath !== importPath ||
      isTypeImport !== missingImport.isTypeExport
    ) {
      continue;
    }
    if (jsImport.type === 'require') {
      const declaration = node.declarations[0];
      if (declaration.id.type === 'ObjectPattern') {
        const {properties} = declaration.id;
        return positionAfterNode(node, properties[properties.length - 1]);
      }
    } else {
      const {specifiers} = node;
      return positionAfterNode(node, specifiers[specifiers.length - 1]);
    }
  }
}

// Return the insert position that would be immediately after the given node.
// e.g. after X in const {X|} = require('...')
function positionAfterNode(importNode, afterNode) {
  const hasNewline = importNode.loc.start.line !== importNode.loc.end.line;
  const {line, column} = afterNode.loc.end;
  return {
    row: line - 1,
    column,
    indent: hasNewline ? afterNode.loc.start.column : 1,
    newLinesAfter: 0,
    newLinesBefore: Number(hasNewline),
  };
}

function getJSImport(node: Object): ?JSImport {
  switch (node.type) {
    // const {X} = require('..');
    case 'VariableDeclaration':
      if (node.declarations.length === 1 && node.declarations[0].init != null) {
        const importPath = getRequiredModule(node.declarations[0].init);
        if (importPath != null) {
          return {
            type: 'require',
            importPath,
          };
        }
      }
      break;
    case 'ImportDeclaration':
      return {
        type: node.importKind === 'type' ? 'importType' : 'import',
        importPath: node.source.value,
      };
  }
}

function createNewImport(
  missingImport: JSExport,
  programBody: Array<Object>,
  importPath: string,
  useRequire: boolean,
): EditParams {
  const nodesByType = {
    require: [],
    import: [],
    importType: [],
  };
  programBody.forEach(node => {
    const jsImport = getJSImport(node);
    if (jsImport != null) {
      nodesByType[jsImport.type].push({
        node,
        importPath: jsImport.importPath,
      });
    }
  });

  if (missingImport.isTypeExport) {
    if (nodesByType.importType.length > 0) {
      return insertInto(nodesByType.importType, importPath);
    } else {
      const firstImport = nodesByType.import[0] || nodesByType.require[0];
      if (firstImport != null) {
        return insertBefore(firstImport.node, 1);
      }
    }
  } else {
    // Make sure we try to insert imports/requires in their own group (if possible).
    const preferred = useRequire
      ? [nodesByType.require, nodesByType.import]
      : [nodesByType.import, nodesByType.require];
    for (const nodes of preferred) {
      if (nodes.length > 0) {
        return insertInto(nodes, importPath);
      }
    }
    if (nodesByType.importType.length > 0) {
      return insertAfter(
        nodesByType.importType[nodesByType.importType.length - 1].node,
        1,
      );
    }
  }
  return insertBefore(programBody[0], 1);
}

function insertInto(
  imports: Array<{node: Object, importPath: string}>,
  importPath: string,
): EditParams {
  for (const importNode of imports) {
    // Find the first import that we can be inserted before.
    if (compareForInsertion(importPath, importNode.importPath) < 0) {
      return insertBefore(importNode.node);
    }
  }
  // Failing that, just insert it after the last one.
  return insertAfter(imports[imports.length - 1].node);
}

// Insert at the start of the next line:
// <node>
// <text\n>
function insertAfter(node: Object, spacing: number = 0): EditParams {
  return {
    row: node.loc.end.line, // 1-based
    column: 0,
    newLinesAfter: 1,
    newLinesBefore: spacing,
  };
}

// Insert at the start of the line:
// <\ntext\n><node>
function insertBefore(node: Object, spacing: number = 0): EditParams {
  return {
    row: node.loc.start.line - 1, // 1-based
    column: 0,
    newLinesAfter: 1 + spacing,
    newLinesBefore: 0,
  };
}

// Signal across RPC that the import had no available exports, via empty newText
function undecidableImportEdits(): Array<TextEdit> {
  return [
    {
      range: atomRangeToLSPRange(new Range([0, 0], [0, 0])),
      newText: '',
    },
  ];
}

// Chooses the import suggestion which has the most similar file URI
// to the current file (by considering the number of up/down hops
// needed to get from to the other) or most similar module identifier
// to the missing symbol identifier.
// Returns null if the closest import cannot be determined
function findClosestImport(
  identifier: string,
  fileURI: NuclideUri,
  filesWithExport: Array<JSExport>,
): ?JSExport {
  const fileURIParts = nuclideUri.split(fileURI);
  const closestExports = findSmallestByMeasure(filesWithExport, ({uri}) => {
    const exportURIParts = nuclideUri.split(uri);
    return computeURIDistance(fileURIParts, exportURIParts);
  });

  if (closestExports.length > 1) {
    const matchingModules = findSmallestByMeasure(closestExports, ({uri}) => {
      const id = moduleID(uri);
      return id === identifier ? 0 : id.indexOf(identifier) !== -1 ? 1 : 2;
    });
    // Pick the best moduleID that matches.
    let bestModule = matchingModules[0];
    let bestModuleID = moduleID(bestModule.uri);
    for (let i = 1; i < matchingModules.length; i++) {
      const thisModule = matchingModules[i];
      const thisModuleID = moduleID(thisModule.uri);
      if (compareForSuggestion(thisModuleID, bestModuleID) < 0) {
        bestModule = thisModule;
        bestModuleID = thisModuleID;
      }
    }
    return bestModule;
  }
  return closestExports[0];
}

function computeURIDistance(uriA: Array<string>, uriB: Array<string>): number {
  let i = 0;
  while (uriA[i] === uriB[i] && uriA[i] != null) {
    i++;
  }
  // Make the importing from other modules more expensive than parent modules
  return uriA.length - i + 1.75 * (uriB.length - i);
}

function findSmallestByMeasure<T>(
  list: Array<T>,
  measure: T => number,
): Array<T> {
  const smallestIndices = new Set(findIndicesOfSmallest(list.map(measure)));
  return list.filter((_, i) => smallestIndices.has(i));
}

function findIndicesOfSmallest(list: Array<number>): Array<number> {
  let indecesOfSmallest = [0];
  let smallest = list[0];
  list.forEach((item, index) => {
    if (item < smallest) {
      indecesOfSmallest = [index];
      smallest = item;
    } else if (index > 0 && item === smallest) {
      indecesOfSmallest.push(index);
    }
  });
  return indecesOfSmallest;
}

function moduleID(fileURI: string): string {
  const parts = nuclideUri.split(fileURI);
  return parts[parts.length - 1].replace(/\.\w+$/, '');
}
