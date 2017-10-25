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

import traverse from 'babel-traverse';
import globalsJSON from 'globals';

// Prevent babel-traverse from yelling about Flow types in the scope.
// We're not actually relying on this behavior here.
// (Can be removed with babel-traverse 6.8+)
traverse.Scope.prototype.warnOnFlowBinding = x => x;

import type {UndefinedSymbol} from './types';

const BUILT_INS = ['Iterator', '__DEV__'];

export class UndefinedSymbolManager {
  globals: Set<string>;

  constructor(envs: Array<string>) {
    this.globals = new Set(BUILT_INS);
    envs.forEach(env => {
      Object.keys(globalsJSON[env]).forEach(globalVar => {
        this.globals.add(globalVar);
      });
    });
  }

  findUndefined(ast: Object): Array<UndefinedSymbol> {
    try {
      return traverseTreeForUndefined(ast, this.globals);
    } catch (error) {
      // babel-traverse throws errors when something is imported twice.
      // We try-catch to avoid logging any babel-traverse errors.
      // See https://github.com/babel/babel/issues/4640 for more information.
      return [];
    }
  }
}

function traverseTreeForUndefined(
  ast: Object,
  globals: Set<string>,
): Array<UndefinedSymbol> {
  const undefinedSymbols = [];
  const definedTypes = new Set();
  const definedValues = new Set();
  traverse(ast, {
    ImportDeclaration: path => {
      saveImports(path, definedTypes);
    },
    TypeAlias: path => {
      save(path, definedTypes);
    },
    DeclareClass: path => {
      save(path, definedTypes);
    },
    ClassDeclaration: path => {
      save(path, definedTypes);
    },
    InterfaceDeclaration: path => {
      save(path, definedTypes);
    },
    TypeParameter: path => {
      // Ideally, this would be aware of scope, but this is difficult to do. If
      // you use a generic parameter out of scope, this would currently not create
      // a diagnositc (but Flow would create one)
      saveTypeParameters(path, definedTypes);
    },
    ReferencedIdentifier(path) {
      findUndefinedValues(path, undefinedSymbols, globals);
    },
    GenericTypeAnnotation: {
      exit(path) {
        findUndefinedTypes(path, undefinedSymbols, globals);
      },
    },
    Identifier(path) {
      // Allow identifiers on the LHS of an assignment.
      // In non-strict JavaScript, this might just be a declaration.
      if (
        path.parent.type === 'AssignmentExpression' &&
        path.node === path.parent.left
      ) {
        definedValues.add(path.node.name);
      }
    },
    LabeledStatement(path) {
      // Create a fake binding for the label.
      if (path.node.label && path.node.label.name) {
        definedValues.add(path.node.label.name);
      }
    },
  });
  return undefinedSymbols.filter(
    symbol =>
      (symbol.type === 'value' && !definedValues.has(symbol.id)) ||
      (symbol.type === 'type' && !definedTypes.has(symbol.id)),
  );
}

function findUndefinedValues(
  path: Object,
  undefinedSymbols: Array<UndefinedSymbol>,
  globals: Set<string>,
) {
  const {node, scope} = path;
  if (
    // Type Annotations are considered identifiers, so ignore them
    isTypeIdentifier(path.parent.type) ||
    // Other weird cases where we want to ignore identifiers
    path.parent.type === 'ExportSpecifier' || // export {a} from 'a' (a would be undefined)
    path.parent.type === 'QualifiedTypeIdentifier' || // SomeModule.SomeType
    globals.has(node.name) ||
    scope.hasBinding(node.name)
  ) {
    return;
  }

  undefinedSymbols.push({
    id: node.name,
    type: 'value',
    location: {
      start: {line: node.loc.start.line, col: node.loc.start.column},
      end: {line: node.loc.end.line, col: node.loc.end.column},
    },
  });
}

function findUndefinedTypes(
  path: Object,
  undefinedSymbols: Array<UndefinedSymbol>,
  globals: Set<string>,
) {
  const {node, scope} = path;

  if (
    globals.has(node.id.name) ||
    path.parent.type === 'TypeAlias' ||
    path.parent.type === 'TypeofTypeAnnotation' ||
    scope.hasBinding(node.id.name)
  ) {
    return;
  }

  if (node.id && node.id.name) {
    undefinedSymbols.push({
      id: node.id.name,
      type: 'type',
      location: {
        start: {line: node.loc.start.line, col: node.loc.start.column},
        end: {line: node.loc.end.line, col: node.loc.end.column},
      },
    });
  }
}

function saveImports(path: Object, definedTypes: Set<string>) {
  path.node.specifiers.forEach(specifier => {
    definedTypes.add(specifier.local.name);
  });
}

function save(path: Object, definedTypes: Set<string>) {
  if (path.node.id) {
    definedTypes.add(path.node.id.name);
  }
}

function saveTypeParameters(path: Object, definedTypes: Set<string>) {
  definedTypes.add(path.node.name);
}

function isTypeIdentifier(node: Object) {
  return (
    node === 'GenericTypeAnnotation' ||
    node === 'ObjectTypeIndexer' ||
    node === 'TypeAlias' ||
    node === 'FunctionTypeParam' ||
    node === 'ObjectTypeProperty' ||
    node === 'InterfaceDeclaration' ||
    node === 'DeclareClass' ||
    node === 'InterfaceExtends'
  );
}
