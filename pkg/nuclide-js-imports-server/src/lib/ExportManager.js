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

import * as t from 'babel-types';
import {ExportIndex} from './ExportIndex';
import {getLogger} from 'log4js';
import {arrayCompact} from 'nuclide-commons/collection';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {Settings} from '../Settings';

import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {JSExport} from './types';

const logger = getLogger();

export function getExportsFromAst(
  fileUri: NuclideUri,
  ast: Object,
): Array<JSExport> {
  const exports = [];
  try {
    traverseTreeAndIndexExports(ast, fileUri, exports);
  } catch (err) {
    logger.warn(`Error getting exports from ${fileUri}:`, err);
  }
  return exports;
}

export class ExportManager {
  _exportIndex: ExportIndex;

  constructor() {
    this._exportIndex = new ExportIndex();
  }

  setExportsForFile(fileUri: NuclideUri, exports: Array<JSExport>) {
    this._exportIndex.setAll(fileUri, exports);
  }

  clearExportsFromFile(fileUri: NuclideUri) {
    this._exportIndex.clearExportsFromFile(fileUri);
  }

  addFile(fileUri: NuclideUri, ast: Object) {
    const exports = [];
    traverseTreeAndIndexExports(ast, fileUri, exports);
    this._exportIndex.setAll(fileUri, exports);
  }

  hasExport(id: string): boolean {
    return this._exportIndex.hasExport(id);
  }

  getExportsIndex(): ExportIndex {
    return this._exportIndex;
  }
}

function isModuleExports(node: Object): boolean {
  return (
    (t.isMemberExpression(node) &&
      node.object.name === 'module' &&
      node.property.name === 'exports') ||
    (t.isIdentifier(node) && node.name === 'exports')
  );
}

function addModuleExports(
  rightNode: Object,
  fileUri: NuclideUri,
  exportIndex: Array<JSExport>,
): void {
  const isTypeExport = false; // You can only module.exports a value (not a type)
  expressionToExports(rightNode, isTypeExport, fileUri).forEach(exp => {
    exportIndex.push(exp);
  });
}

function addDefaultDeclarationToExportIndex(
  node: Object,
  fileUri: NuclideUri,
  exportIndex: Array<JSExport>,
): void {
  // Only values can be exported as default (not types)
  const isTypeExport = false;
  const isDefault = true;

  if (t.isObjectExpression(node.declaration)) {
    // (ex: export default {someObject, otherObject})
    // Assume the id will be the name of the file.
    const id = idFromFileName(fileUri);
    exportIndex.push({id, uri: fileUri, isDefault, isTypeExport});
    return;
  }

  declarationToExport(
    node.declaration,
    isTypeExport,
    fileUri,
    isDefault,
  ).forEach(exp => {
    exportIndex.push(exp);
  });
}

function addNamedDeclarationToExportIndex(
  node: Object,
  fileUri: NuclideUri,
  exportIndex: Array<JSExport>,
): void {
  const isDefault = false;
  // export class Foo
  if (node && node.declaration) {
    const {declaration, exportKind} = node;
    declarationToExport(
      declaration,
      exportKind === 'type',
      fileUri,
      isDefault,
    ).forEach(exp => {
      exportIndex.push(exp);
    });
  } else if (node.specifiers) {
    // export {foo, bar} from ...
    const {exportKind} = node;
    node.specifiers.forEach(specifier => {
      exportIndex.push(
        specifierToExport(specifier, fileUri, exportKind === 'type', isDefault),
      );
    });
  } else {
    throw new Error('ExportNamedDeclaration without declaration or specifiers');
  }
}

function specifierToExport(
  node: Object,
  fileUri: NuclideUri,
  isTypeExport: boolean,
  isDefault: boolean,
): JSExport {
  return {
    id: node.exported.name,
    uri: fileUri,
    isTypeExport,
    isDefault,
  };
}

function expressionToExports(
  expression: Object,
  isTypeExport: boolean,
  fileUri: NuclideUri,
): Array<JSExport> {
  if (expression.id || expression.name) {
    return [
      {
        id: expression.name || expression.id.name,
        uri: fileUri,
        type: expression.type,
        isTypeExport,
        isDefault: true, // Treated as default export
      },
    ];
  }
  if (t.isObjectExpression(expression)) {
    const {
      shouldIndexObjectAsDefault,
      shouldIndexEachObjectProperty,
    } = Settings.moduleExportsSettings;

    // Index the entire object as a default export
    const defaultExport = shouldIndexObjectAsDefault
      ? [
          {
            id: idFromFileName(fileUri),
            uri: fileUri,
            type: 'ObjectExpression',
            isTypeExport,
            isDefault: true, // Treated as a default export.
          },
        ]
      : [];

    // Index each property of the object
    const propertyExports = shouldIndexEachObjectProperty
      ? arrayCompact(
          expression.properties.map(property => {
            if (property.type === 'SpreadProperty' || property.computed) {
              return null;
            }
            return {
              id:
                property.key.type === 'StringLiteral'
                  ? property.key.value
                  : property.key.name,
              uri: fileUri,
              type: expression.type,
              isTypeExport,
              isDefault: false,
            };
          }),
        )
      : [];

    return defaultExport.concat(propertyExports);
  }
  if (t.isAssignmentExpression(expression) && t.isIdentifier(expression.left)) {
    return [
      {
        id: expression.left.name,
        uri: fileUri,
        type: expression.type,
        isTypeExport,
        isDefault: true, // Treated as default export
      },
    ];
  }
  return [];
}

function declarationToExport(
  declaration: Object,
  isTypeExport: boolean,
  fileUri: NuclideUri,
  isDefault: boolean,
): Array<JSExport> {
  // export MyType;
  if (declaration.id || declaration.name) {
    return [
      {
        id: declaration.name || declaration.id.name,
        uri: fileUri,
        type: declaration.type,
        isTypeExport,
        isDefault,
      },
    ];
  }
  // export const x = 3;
  if (declaration.declarations) {
    const {declarations} = declaration;
    // We currently use map but if there were more than one, there would be a
    // lint error (one-var) so we could simplify this by just taking the first element of the array.
    return declarations.map(decl => {
      return {
        id: decl.id.name,
        uri: fileUri,
        type: declaration.type,
        isTypeExport,
        isDefault,
      };
    });
  }
  // Unnamed default exports
  if (isDefault === true) {
    return [
      {
        id: idFromFileName(fileUri),
        uri: fileUri,
        isTypeExport: false,
        type: declaration.type,
        isDefault,
      },
    ];
  }
  return [];
}

function traverseTreeAndIndexExports(
  ast: Object,
  fileUri: NuclideUri,
  exportIndex: Array<JSExport>,
): void {
  // As an optimization, only traverse top-level nodes instead of the whole AST.
  if (ast && ast.program && ast.program.body) {
    const {body} = ast.program;
    body.forEach(node => {
      const {type} = node;
      switch (type) {
        case 'ExportNamedDeclaration':
          addNamedDeclarationToExportIndex(node, fileUri, exportIndex);
          break;
        case 'ExportDefaultDeclaration':
          addDefaultDeclarationToExportIndex(node, fileUri, exportIndex);
          break;
        case 'ExpressionStatement':
          if (
            node.expression &&
            node.expression.type === 'AssignmentExpression'
          ) {
            const {left, right} = node.expression;
            if (isModuleExports(left)) {
              addModuleExports(right, fileUri, exportIndex);
            } else if (
              t.isMemberExpression(left) &&
              isModuleExports(left.object) &&
              t.isIdentifier(left.property)
            ) {
              exportIndex.push({
                id: left.property.name,
                uri: fileUri,
                type:
                  // Exclude easy cases from being imported as types.
                  right.type === 'ObjectExpression' ||
                  right.type === 'FunctionExpression' ||
                  right.type === 'NumericLiteral' ||
                  right.type === 'StringLiteral'
                    ? right.type
                    : undefined,
                isTypeExport: false,
                isDefault: false,
              });
            }
          }
          break;
      }
    });
  }
}

export function idFromFileName(fileUri: NuclideUri): string {
  const fileName = nuclideUri.basename(fileUri);
  const dotIndex = fileName.indexOf('.');
  const stripped = dotIndex >= 0 ? fileName.substr(0, dotIndex) : fileName;
  return stripped.indexOf('-') >= 0 ? dashToCamelCase(stripped) : stripped;
}

function dashToCamelCase(string: string): string {
  return string // Maintain capitalization of the first "word"
    ? string.split('-').map((el, i) => (i === 0 ? el : capitalize(el))).join('')
    : '';
}

function capitalize(word: string): string {
  if (!word) {
    return '';
  }
  return word[0].toUpperCase() + word.slice(1);
}
