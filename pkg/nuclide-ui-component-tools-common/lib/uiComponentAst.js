/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 */

// TODO: T29733418 Figure out a typed import for babylon or @babel/parser.
// flowlint-next-line untyped-import:off
import {File, Node, parse} from '@babel/parser';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {babylonOptions} from '../../nuclide-js-imports-server/src/lib/AutoImportsManager';
import {removePrefix} from './utils';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {ComponentProp} from './types';

const babelParserOptions = babylonOptions;

function matchesExtension(
  parts: Array<string>,
  extension: Array<string>,
): boolean {
  if (parts.length !== extension.length + 1) {
    return false;
  }

  // Start at 1 to skip the basename, parts should be the entire filename.
  for (let i = 1; i < parts.length; i++) {
    if (parts[i] !== extension[i - 1]) {
      return false;
    }
  }

  return true;
}

export function getComponentNameFromUri(uri: NuclideUri): ?string {
  const basename = nuclideUri.basename(uri);
  const parts = basename.split('.');
  if (
    !matchesExtension(parts, ['react', 'js']) &&
    !matchesExtension(parts, ['experimental', 'react', 'js'])
  ) {
    // This must be exactly ComponentName.react.js or
    // ComponentName.experimental.react.js.
    // We don't want to index ComponentName.example.react.js and clobber over
    // the ComponentName definition.
    return null;
  }
  const componentName = parts[0];
  if (componentName.length === 0) {
    return null;
  }

  return componentName;
}

export function parseCode(code: string): ?File {
  try {
    return parse(code, babelParserOptions);
  } catch (_error) {
    // This will be a common error when parse fails on this string of code.
    // Logging this would likely be far more noise than signal.
    return null;
  }
}

function isComponent(node: Node): boolean {
  return node.type === 'ClassDeclaration' && node.superClass;
}

function getComponentNode(componentName: string, ast: File): ?Node {
  return ast.program.body.find(
    n => isComponent(n) && n.id && n.id.name === componentName,
  );
}

function getTypeParameterNames(
  componentName: string,
  ast: File,
): Array<string> {
  const componentNode = getComponentNode(componentName, ast);
  if (!componentNode) {
    return [];
  }
  if (
    componentNode.superTypeParameters == null ||
    componentNode.superTypeParameters.params == null
  ) {
    return [];
  }
  return componentNode.superTypeParameters.params.map(
    p => p.type === 'GenericTypeAnnotation' && p.id.name,
  );
}

function getTypeAnnotation(node: Node): string {
  // Get the actual name of the type instead of something like
  // 'GenericTypeAnnotation'.
  if (node.value.id) {
    return node.value.id.name;
  }

  // Primitive types such as 'string' and 'number' won't have an id.
  return node.value.type;
}

export function formatLeadingComment(comment: string): string {
  return (
    comment
      .split('\n')
      // Remove any leading asterisks.
      .map(l => removePrefix('*', l.trim()).trim())
      // Filter any blank lines before and after the entire text.
      .filter(
        (l, i, arr) =>
          (i > 0 && i < arr.length - 2 && arr[i + 1].length > 0) ||
          l.length > 0,
      )
      // Join lines together, but preserve extra newlines in the text.
      // e.g., Hello\nGoodbye becomes "Hello Goodbye" but "Hello\n\nGoodbye"
      // remains "Hello\n\nGoodbye".
      .reduce((res, line, i, arr) => {
        if (i === 0) {
          return line;
        }

        if (line.length === 0) {
          return res + '\n\n';
        }

        if (arr[i - 1].length > 0) {
          return res + ' ' + line;
        }

        return res + line;
      }, '')
  );
}

function getLeadingComment(node: Node): ?string {
  if (!node.leadingComments) {
    return null;
  }

  // Remove trailing whitespace, trailing empty lines, and leading asterisk.
  return formatLeadingComment(
    node.leadingComments[node.leadingComments.length - 1].value,
  );
}

function getDefaultPropsFromIdentifier(
  identifier: string,
  ast: File,
): Array<string> {
  for (let i = 0; i < ast.program.body.length; i++) {
    const node = ast.program.body[i];
    if (node.type !== 'VariableDeclaration') {
      continue;
    }

    const expr = node.declarations.find(
      n =>
        n.type === 'VariableDeclarator' &&
        n.id.type === 'Identifier' &&
        n.id.name === identifier,
    );
    if (!expr) {
      continue;
    }

    if (expr.init && expr.init.type === 'ObjectExpression') {
      return getDefaultPropsFromObjectExpression(expr.init);
    }
    return [];
  }
  return [];
}

function getDefaultPropsFromObjectExpression(expr: Node): Array<string> {
  return expr.properties
    .filter(n => n.type === 'ObjectProperty' && n.key.type === 'Identifier')
    .map(n => n.key.name);
}

export function getDefaultPropNames(
  componentName: string,
  ast: File,
): Array<string> {
  const componentNode = getComponentNode(componentName, ast);
  if (
    !componentNode ||
    !componentNode.body ||
    componentNode.body.type !== 'ClassBody'
  ) {
    return [];
  }

  const defaultPropsStaticNode = componentNode.body.body.find(
    n =>
      n.type === 'ClassProperty' && n.static && n.key.name === 'defaultProps',
  );
  if (!defaultPropsStaticNode || !defaultPropsStaticNode.value) {
    return [];
  }
  if (defaultPropsStaticNode.value.type === 'Identifier') {
    return getDefaultPropsFromIdentifier(
      defaultPropsStaticNode.value.name,
      ast,
    );
  } else if (defaultPropsStaticNode.value.type === 'ObjectExpression') {
    return getDefaultPropsFromObjectExpression(defaultPropsStaticNode.value);
  }

  return [];
}

function getObjectTypeProperties(node: Node): ?Array<Node> {
  if (!node.declaration.right) {
    return null;
  }

  const n = node.declaration.right;
  if (n.type === 'ObjectTypeAnnotation') {
    return node.declaration.right.properties;
  }

  // Only support the $Exact utility. We could recurse and support other utility
  // types but then we would need more logic and we'd start just re-writing
  // Flow. Traversing one $Exact utility type is sufficient for these purposes.
  // We don't want to support something like $Rest or $Diff.
  if (
    n.type === 'GenericTypeAnnotation' &&
    n.id.name === '$Exact' &&
    n.typeParameters.type === 'TypeParameterInstantiation' &&
    // The $Exact utility will only have one parameter. Anything more
    // complicated and we abandon ship.
    n.typeParameters.params.length === 1 &&
    n.typeParameters.params[0].type === 'ObjectTypeAnnotation'
  ) {
    return n.typeParameters.params[0].properties;
  }
}

export function getRequiredPropsFromAst(
  componentName: string,
  ast: File,
): ?Array<ComponentProp> {
  const typeParameterNames = getTypeParameterNames(componentName, ast);
  if (typeParameterNames.length === 0) {
    return null;
  }

  const requiredProps = ast.program.body
    .filter(
      node =>
        node.exportKind === 'type' &&
        node.declaration &&
        node.declaration.right &&
        // Ensure this type is in the component's class generics.
        // i.e., ``class Foo extends Component<Props>`` means this type should
        // be named "Props".
        typeParameterNames.includes(node.declaration.id.name),
    )
    .reduce((props: Array<string>, node: Node) => {
      const properties = getObjectTypeProperties(node);
      if (properties == null) {
        return props;
      }

      const required = properties
        // There could be properties with a type such as
        // ObjectTypeSpreadProperty which would require more logic to
        // include.
        .filter(n => !n.optional && n.type === 'ObjectTypeProperty' && n.key)
        .map(n => {
          const leadingComment = getLeadingComment(n);
          return {
            name: n.key.name,
            typeAnnotation: getTypeAnnotation(n),
            ...(leadingComment == null ? {} : {leadingComment}),
          };
        });
      return props.concat(required);
    }, []);

  return requiredProps;
}

// This is used for testing purposes. ASTs are expensive to compute and thus
// should be re-used by passing instances to `getRequiredPropsFromAst`.
export function getRequiredProps(
  componentName: string,
  code: string,
): ?Array<ComponentProp> {
  const ast = parseCode(code);
  if (ast == null) {
    return [];
  }

  return getRequiredPropsFromAst(componentName, ast);
}

export function getLeadingCommentForComponent(
  componentName: string,
  ast: File,
): ?string {
  const componentNode = getComponentNode(componentName, ast);
  if (!componentNode) {
    return null;
  }

  return getLeadingComment(componentNode);
}
