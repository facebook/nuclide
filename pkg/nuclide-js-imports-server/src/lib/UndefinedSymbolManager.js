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

import traverse from '@babel/traverse';

import type {UndefinedSymbol} from './types';

const BUILT_INS = ['Iterator', '__DEV__'];
const FBT_TAG = 'fbt';
const REACT_MODULE_NAME = 'React';
const JSX_CSX_PRAGMA_REGEX = /\*?\s*@csx/;

export class UndefinedSymbolManager {
  globals: Set<string>;

  constructor(globals: Array<string>) {
    this.globals = new Set(BUILT_INS.concat(globals));
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

  ast.comments.forEach(({type, value}) => {
    // Parses out /* global a, b, c: true, d: false */
    if (type === 'CommentBlock') {
      const trimmed = value.trim();
      if (trimmed.startsWith('global ') || trimmed.startsWith('globals ')) {
        const vars = trimmed.substr(7).trimLeft();
        vars.split(',').forEach(varString => {
          const varName = varString.split(':')[0].trim();
          definedTypes.add(varName);
          definedValues.add(varName);
        });
      }
    }
  });

  let csx = false;
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
    DeclareFunction: path => {
      save(path, definedValues);
      return true;
    },
    DeclareTypeAlias: path => {
      save(path, definedTypes);
      return true;
    },
    DeclareVariable: path => {
      save(path, definedValues);
      return true;
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
    Program(path) {
      csx =
        csx ||
        path.parent.comments.some(({value}) =>
          JSX_CSX_PRAGMA_REGEX.test(value),
        );
    },
    JSXFragment(path) {
      if (!csx) {
        findUndefinedReact(path, undefinedSymbols, globals);
      }
    },
    JSXIdentifier(path) {
      if (!csx && path.parent.type === 'JSXOpeningElement') {
        if (path.node.name === FBT_TAG) {
          findUndefinedValues(path, undefinedSymbols, globals);
        } else {
          findUndefinedReact(path, undefinedSymbols, globals);
        }
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
  const type: string = path.parent.type;
  if (
    // Type Annotations are considered identifiers, so ignore them
    isTypeIdentifier(type) ||
    // Other weird cases where we want to ignore identifiers
    type === 'ExportSpecifier' || // export {a} from 'a' (a would be undefined)
    (type === 'QualifiedTypeIdentifier' &&
      path.parentKey !== 'qualification') || // SomeModule.SomeType
    globals.has(node.name) ||
    scope.hasBinding(node.name)
  ) {
    return;
  }

  undefinedSymbols.push({
    id: node.name,
    type: path.parent.type === 'QualifiedTypeIdentifier' ? 'type' : 'value',
    location: {
      start: {line: node.loc.start.line, col: node.loc.start.column},
      end: {line: node.loc.end.line, col: node.loc.end.column},
    },
  });
}

function findUndefinedReact(
  path: Object,
  undefinedSymbols: Array<UndefinedSymbol>,
  globals: Set<string>,
) {
  const {node, scope} = path;

  if (scope.hasBinding(REACT_MODULE_NAME)) {
    return;
  }

  undefinedSymbols.push({
    id: REACT_MODULE_NAME,
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
    scope.hasBinding(node.id.name)
  ) {
    return;
  }

  if (node.id && node.id.name) {
    undefinedSymbols.push({
      id: node.id.name,
      // "typeof" must refer to a value.
      type: path.parent.type === 'TypeofTypeAnnotation' ? 'value' : 'type',
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

function isTypeIdentifier(node: string) {
  return (
    node === 'GenericTypeAnnotation' ||
    node === 'ObjectTypeIndexer' ||
    node === 'TypeAlias' ||
    node === 'FunctionTypeParam' ||
    node === 'ObjectTypeProperty' ||
    node === 'InterfaceDeclaration' ||
    node === 'DeclareClass' ||
    node === 'InterfaceExtends' ||
    node === 'ClassImplements'
  );
}
