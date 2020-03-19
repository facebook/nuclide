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

import type {Collection, Node, NodePath} from '../types/ast';
import type {SourceOptions} from '../options/SourceOptions';

import getJSXIdentifierName from './getJSXIdentifierName';
import getNamesFromID from './getNamesFromID';
import jscs from './jscodeshift';

type ConfigEntry = {
  nodeType: string,
  getNodes: (path: NodePath, options: SourceOptions) => Array<Node>,
};

const REACT_NODE = jscs.identifier('React');

/**
 * These are the ways in which one might access an undeclared identifier. This
 * should only apply to actual code, not accessing undeclared types.
 */
const CONFIG: Array<ConfigEntry> = [
  // foo;
  {
    nodeType: jscs.ExpressionStatement,
    getNodes: path => [path.node.expression],
  },

  // foo(bar);
  {
    nodeType: jscs.CallExpression,
    getNodes: path => [path.node.callee].concat(path.node.arguments),
  },

  // foo.declared;
  {
    nodeType: jscs.MemberExpression,
    getNodes: path => [path.node.object],
  },

  // foo = bar;
  {
    nodeType: jscs.AssignmentExpression,
    getNodes: path => [path.node.left, path.node.right],
  },

  // class declared extends foo {}
  {
    nodeType: jscs.ClassDeclaration,
    getNodes: path => [path.node.superClass],
  },

  // var declared = foo;
  {
    nodeType: jscs.VariableDeclarator,
    getNodes: path => [path.node.init],
  },

  // switch (declared) { case foo: break; }
  {
    nodeType: jscs.SwitchCase,
    getNodes: path => [path.node.test],
  },

  // {declared: foo}
  {
    nodeType: jscs.ObjectExpression,
    // Generally props have a value, if it is a spread property it doesn't.
    getNodes: path => path.node.properties.map(prop => prop.value || prop),
  },

  // return foo;
  {
    nodeType: jscs.ReturnStatement,
    getNodes: path => [path.node.argument],
  },

  // if (foo) {}
  {
    nodeType: jscs.IfStatement,
    getNodes: path => [path.node.test],
  },

  // switch (foo) {}
  {
    nodeType: jscs.SwitchStatement,
    getNodes: path => [path.node.discriminant],
  },

  // !foo;
  {
    nodeType: jscs.UnaryExpression,
    getNodes: path => [path.node.argument],
  },

  // foo || bar;
  {
    nodeType: jscs.BinaryExpression,
    getNodes: path => [path.node.left, path.node.right],
  },

  // foo < bar;
  {
    nodeType: jscs.LogicalExpression,
    getNodes: path => [path.node.left, path.node.right],
  },

  // foo ? bar : baz;
  {
    nodeType: jscs.ConditionalExpression,
    getNodes: path => [
      path.node.test,
      path.node.alternate,
      path.node.consequent,
    ],
  },

  // new Foo()
  {
    nodeType: jscs.NewExpression,
    getNodes: path => [path.node.callee].concat(path.node.arguments),
  },

  // foo++;
  {
    nodeType: jscs.UpdateExpression,
    getNodes: path => [path.node.argument],
  },

  // <Element attribute={foo} />
  {
    nodeType: jscs.JSXExpressionContainer,
    getNodes: path => [path.node.expression],
  },

  // for (foo in bar) {}
  {
    nodeType: jscs.ForInStatement,
    getNodes: path => [path.node.left, path.node.right],
  },

  // for (foo of bar) {}
  {
    nodeType: jscs.ForOfStatement,
    getNodes: path => [path.node.left, path.node.right],
  },

  // for (foo; bar; baz) {}
  {
    nodeType: jscs.ForStatement,
    getNodes: path => [path.node.init, path.node.test, path.node.update],
  },

  // while (foo) {}
  {
    nodeType: jscs.WhileStatement,
    getNodes: path => [path.node.test],
  },

  // do {} while (foo)
  {
    nodeType: jscs.DoWhileStatement,
    getNodes: path => [path.node.test],
  },

  // [foo]
  {
    nodeType: jscs.ArrayExpression,
    getNodes: path => path.node.elements,
  },

  // Special case. Any JSX elements will get transpiled to use React.
  {
    nodeType: jscs.JSXOpeningElement,
    getNodes: (path, options) =>
      getJSXIdentifierName(path).concat(
        shouldRequireReact(path, options) ? [REACT_NODE] : [],
      ),
  },

  // Special case. Any JSX fragment will get transpiled to use React.
  {
    nodeType: jscs.JSXFragment,
    getNodes: (path, options) => [REACT_NODE],
  },

  // foo`something`
  {
    nodeType: jscs.TaggedTemplateExpression,
    getNodes: path => [path.node.tag],
  },

  // `${bar}`
  {
    nodeType: jscs.TemplateLiteral,
    getNodes: path => path.node.expressions,
  },

  // function foo(a = b) {}
  {
    nodeType: jscs.AssignmentPattern,
    getNodes: path => [path.node.right],
  },

  // (foo: SomeType)
  {
    nodeType: jscs.TypeCastExpression,
    getNodes: path => [path.node.expression],
  },
];

/**
 * This will get a list of all identifiers that are not from a declaration.
 *
 * NOTE: this can get identifiers that are declared, if you want access to
 * identifiers that are access but undeclared see getUndeclaredIdentifiers
 */
function getNonDeclarationIdentifiers(
  root: Collection,
  options: SourceOptions,
): Set<string> {
  const ids = new Set();
  const visitor = {};

  CONFIG.forEach(config => {
    visitor[`visit${config.nodeType}`] = function(path) {
      const nodes = config.getNodes(path, options);

      nodes.forEach(node => {
        const names = getNamesFromID(node);
        for (const name of names) {
          ids.add(name);
        }
      });
      this.traverse(path);
    };
  });

  jscs.types.visit(root.nodes()[0], visitor);
  return ids;
}

function shouldRequireReact(path: NodePath, options: SourceOptions): boolean {
  const tag = path.node.name;
  if (jscs.JSXNamespacedName.check(tag)) {
    return !options.jsxNonReactNames.has(tag.namespace.name);
  }
  if (jscs.JSXIdentifier.check(tag)) {
    return !options.jsxNonReactNames.has(tag.name);
  }
  return true;
}

export default getNonDeclarationIdentifiers;
