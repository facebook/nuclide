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
import type {JSExport, JSImport} from './lib/types';
import type TextDocuments from './TextDocuments';
import type {
  WorkspaceEdit,
  TextEdit,
} from '../../nuclide-vscode-language-service-rpc/lib/protocol';

import {IConnection} from 'vscode-languageserver';
import {ImportFormatter} from './lib/ImportFormatter';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {parseFile} from './lib/AutoImportsManager';
import {Range} from 'simple-text-buffer';
import {
  atomRangeToLSPRange,
  compareForInsertion,
  getRequiredModule,
} from './utils/util';

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
    addImport: true,
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

  executeCommand(command: $Keys<typeof CommandExecutor.COMMANDS>, args: any) {
    switch (command) {
      case 'addImport':
        return this._addImport((args: AddImportCommandParams));
      default:
        (command: empty);
        throw new Error('Unexpected Command');
    }
  }

  _addImport(args: AddImportCommandParams) {
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

    const lspUri = nuclideUri.nuclideUriToUri(fileMissingImport);
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

    this.connection.workspace.applyEdit(
      ({changes, documentChanges}: WorkspaceEdit),
    );
  }
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
      createNewImport(missingImport, programBody, importPath),
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
    if (jsImport == null || jsImport.importPath !== importPath) {
      continue;
    }
    if (jsImport.type === 'require') {
      const declaration = node.declarations[0];
      if (declaration.id.type === 'ObjectPattern') {
        const {properties} = declaration.id;
        return positionAfterNode(node, properties[properties.length - 1]);
      }
    } else {
      const isTypeImport = jsImport.type === 'importType';
      if (isTypeImport === missingImport.isTypeExport) {
        const {specifiers} = node;
        return positionAfterNode(node, specifiers[specifiers.length - 1]);
      }
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
    if (nodesByType.import.length > 0) {
      return insertInto(nodesByType.import, importPath);
    } else if (nodesByType.require.length > 0) {
      return insertInto(nodesByType.require, importPath);
    } else if (nodesByType.importType.length > 0) {
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
