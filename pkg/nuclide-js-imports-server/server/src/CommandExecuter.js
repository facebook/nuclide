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
import type {JSExport} from './lib/types';
import type TextDocuments from './TextDocuments';

import {IConnection, WorkspaceEdit, TextEdit} from 'vscode-languageserver';
import {ImportFormatter} from './lib/ImportFormatter';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {parseFile} from './lib/AutoImportsManager';
import {babelLocationToAtomRange, atomRangeToLSPRange} from './utils/util';
import {Range} from 'simple-text-buffer';

export type AddImportCommandParams = [string, JSExport, NuclideUri];

type ExportPosition = {
  row: number,
  newLinesBefore: number,
  newLinesAfter: number,
};

export class CommandExecuter {
  static COMMANDS = {
    addImport,
  };
  connection: IConnection;
  importFormatter: ImportFormatter;
  documents: TextDocuments;

  constructor(
    connection: IConnection,
    importFormatter: ImportFormatter,
    documents: TextDocuments,
  ) {
    this.connection = connection;
    this.importFormatter = importFormatter;
    this.documents = documents;
  }

  executeCommand(command: string, args: any) {
    switch (command) {
      case 'addImport':
        return addImport(
          (args: AddImportCommandParams),
          this.connection,
          this.importFormatter,
          this.documents,
        );
      default:
        throw new Error('Unexpected Command');
    }
  }
}

function addImport(
  args: AddImportCommandParams,
  connection: IConnection,
  importFormatter: ImportFormatter,
  documents: TextDocuments,
) {
  const [id, missingImport, fileMissingImport] = args;
  const ast = parseFile(
    documents.get(nuclideUri.nuclideUriToUri(fileMissingImport)).getText(),
  );
  if (ast == null || ast.program == null || ast.program.body == null) {
    // File could not be parsed. If this is reached, we shouldn't be applying
    // addImport anyways since the file must have changed from when we computed
    // the CodeAction.
    return;
  }
  const {body} = ast.program;
  connection.workspace.applyEdit(
    getImportWorkspaceEdit(
      fileMissingImport,
      missingImport,
      id,
      importFormatter,
      body,
      documents,
    ),
  );
}

function getImportWorkspaceEdit(
  fileMissingImport: NuclideUri,
  missingImport: JSExport,
  id: string,
  importFormatter: ImportFormatter,
  programBody: Array<Object>,
  documents: TextDocuments,
): WorkspaceEdit {
  const {row, newLinesBefore, newLinesAfter} = findPositionForImport(
    missingImport,
    programBody,
  );
  const edits = [
    getEditForFile(
      row,
      newLinesBefore,
      importFormatter,
      fileMissingImport,
      missingImport,
      newLinesAfter,
    ),
  ];
  const lspUri = nuclideUri.nuclideUriToUri(fileMissingImport);
  // Version 2.0 LSP
  const changes = {};
  changes[lspUri] = edits;

  // Version 3.0 LSP
  const documentChanges = [
    {
      textDocument: {
        uri: lspUri,
        version: documents.get(lspUri).version,
      },
      edits,
    },
  ];

  return {changes, documentChanges};
}

function getEditForFile(
  row: number,
  newLinesBefore: number,
  importFormatter: ImportFormatter,
  fileMissingImport: NuclideUri,
  missingImport: JSExport,
  newLinesAfter: number,
): TextEdit {
  return {
    range: emptyRangeAtRow(row),
    newText: `${'\n'.repeat(newLinesBefore)}${importFormatter.formatImport(
      fileMissingImport,
      missingImport,
    )};${'\n'.repeat(newLinesAfter)}`,
  };
}

function emptyRangeAtRow(row: number) {
  return atomRangeToLSPRange(new Range([row, 0], [row, 0]));
}

function findPositionForImport(
  missingImport: JSExport,
  programBody: Array<Object>,
): ExportPosition {
  // For now, we consider two types of imports: value import and type imports.
  // TODO: integrate with nuclide-format-js or replace this with a more
  // specific ordering that is easily configurable.

  const [
    lastTypeImport,
    lastValueImport,
  ] = findLastTopLevelNodeSatisfying(programBody, [
    node => node.type === 'ImportDeclaration' && node.importKind === 'type',
    node => node.type === 'ImportDeclaration' && node.importKind === 'value',
  ]);

  let row;
  let newLinesAfter = 1;
  let newLinesBefore = 0;
  if (missingImport.isTypeExport && lastTypeImport) {
    row = rowAfterRange(babelLocationToAtomRange(lastTypeImport.loc));
  } else if (!missingImport.isTypeExport && lastValueImport) {
    row = rowAfterRange(babelLocationToAtomRange(lastValueImport.loc));
  } else if (!missingImport.isTypeExport && lastTypeImport) {
    // If we are adding the first import of this kind, we should at least be
    // consistent. For now, we will have type imports come before value imports.
    row = rowAfterRange(babelLocationToAtomRange(lastTypeImport.loc));
    newLinesBefore += 1;
  } else {
    row = rowBeforeRange(babelLocationToAtomRange(programBody[0].loc), 0);
    newLinesAfter += 1;
  }

  return {
    row,
    newLinesAfter,
    newLinesBefore,
  };
}

function rowBeforeRange(range: atom$Range, rows?: number = 1) {
  return range.start.row - rows;
}

function rowAfterRange(range: atom$Range, rows?: number = 1) {
  return range.end.row + rows;
}

/**
 * Traverses top-level nodes of an AST, checking each predicate
 * function on every node.
 *
 * The output array corresponds 1:1 to the input predicate array. The i-th
 * element of the output array corresponds to the last node that returned true
 * for the i-th predicate function.
 */
function findLastTopLevelNodeSatisfying(
  programBody: Array<Object>,
  predicates: Array<(node: Object) => boolean>,
): Array<?Object> {
  const reversed = [...programBody].reverse();
  return predicates.map(predicate => reversed.find(x => predicate(x)));
}
