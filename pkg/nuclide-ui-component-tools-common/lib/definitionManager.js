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

import type {MatcherOptions} from 'nuclide-fuzzy-native';
import type TextDocument from '../../nuclide-lsp-implementation-common/TextDocument';
import type {
  CompletionItem,
  Hover,
  TextDocumentPositionParams,
} from '../../nuclide-vscode-language-service-rpc/lib/protocol';
import type {ComponentDefinition} from './types';

import invariant from 'assert';
import {Matcher} from 'nuclide-fuzzy-native';
import {lspPositionToAtomPoint} from '../../nuclide-lsp-implementation-common/lsp-utils';
import {
  CompletionItemKind,
  InsertTextFormat,
} from '../../nuclide-vscode-language-service-rpc/lib/protocol';
import {removePrefix} from './utils';
import {LEADING_COMMENT_LIMIT} from './constants';

export function getSnippetFromDefinition(
  definition: ComponentDefinition,
): string {
  let snippet = definition.name;
  if (definition.requiredProps.length === 0) {
    snippet += ' $1/>';
    return snippet;
  }

  snippet += '\n';
  let i = 1;
  definition.requiredProps.forEach((prop, index) => {
    // This is naive and quadratic time but N is really small.
    if (
      !definition.defaultProps.includes(prop.name) &&
      prop.name !== 'children'
    ) {
      // There's different behavior depending on the type annotation.
      // String props have a nested tabstop that gives the user the opportunity
      // to either delete the quotes in exchange for braces, or to tab into the
      // quotes.
      // Other types of props simply render {$tabstop}.
      const value =
        prop.typeAnnotation === 'string' || prop.typeAnnotation === 'Fbt'
          ? `\${${i++}:"$${i++}"}`
          : `{$${i++}}`;
      snippet += `  ${prop.name}=${value}\n`;
    }
  });

  // If the component requires children then place a tabstop in between an
  // opening and closing tag.
  if (definition.requiredProps.find(p => p.name === 'children')) {
    return snippet + `>\n  $${i++}\n</${definition.name}>`;
  }

  return snippet + `$${i}/>`;
}

// Force an opening JSX tag character so that we don't autocomplete in something
// like a createElement call with a JSX snippet. Note: this is not the most
// robust regex to match React identifiers and some false negatives are
// possible.
const componentNameRegexp = new RegExp('<[a-zA-Z_]+');

function getComponentNameFromPositionParams(
  document: TextDocument,
  positionParams: TextDocumentPositionParams,
): ?string {
  const rowRange = document.buffer.rangeForRow(positionParams.position.line);
  rowRange.end = lspPositionToAtomPoint(positionParams.position);

  let word = null;
  document.buffer.backwardsScanInRange(componentNameRegexp, rowRange, arg => {
    word = arg.matchText;
  });
  return word;
}

export function getDocumentationObject(
  definition: ComponentDefinition,
): {documentation?: string} {
  if (
    definition.leadingComment == null ||
    !definition.leadingComment.startsWith('@explorer-desc') ||
    definition.leadingComment.includes('@no-completion-description')
  ) {
    return {};
  }

  invariant(definition.leadingComment != null);
  let candidate = removePrefix('@explorer-desc', definition.leadingComment)
    .split('\n')
    .find(l => l.length > 0);
  if (candidate == null) {
    return {};
  } else {
    candidate = candidate.trim();
  }
  if (candidate.length < 20) {
    // This is probably too short and not a real component description. Exclude
    // it.
    return {};
  } else if (candidate.length < LEADING_COMMENT_LIMIT) {
    return {documentation: candidate};
  }
  return {documentation: candidate.substr(0, LEADING_COMMENT_LIMIT) + '…'};
}

/**
 * Performs some minimal changes to convert Remarkup from leading comments
 * (originally intended for consumption by UICE) to Markdown consumable by
 * Nuclide. This function does not fully convert Remarkup to Markdown.
 */
function remarkupToMarkdown(remarkup: string): string {
  return remarkup.replace(/^={6}/gm, '###');
}

function countMinimumLeadingSpaces(text: string): number {
  const whitespaceRegexp = /^\s+/;
  let min = -1;
  // Avoiding reduce so that we can terminate early on 0.
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().length === 0) {
      continue;
    }
    const match = lines[i].match(whitespaceRegexp);
    if (match == null) {
      return 0;
    }
    const newMin = match[0].length;
    if (min === -1 || newMin < min) {
      min = newMin;
    }
  }
  return min === -1 ? 0 : min;
}

export function getHoverFromComponentDefinition(
  definition: ?ComponentDefinition,
): Hover {
  if (definition == null || definition.leadingComment == null) {
    return emptyHoverObject;
  }

  const min = countMinimumLeadingSpaces(definition.leadingComment);
  invariant(definition.leadingComment != null);
  const value = definition.leadingComment
    .split('\n')
    .map(l => l.substr(min).trimRight())
    .filter(l => l.length > 0 && !l.startsWith('@'))
    .join('\n');

  return {
    contents: {
      language: 'markdown',
      value: remarkupToMarkdown(value),
    },
    // Excluding the optional range property means the hover is valid for the
    // whole word around the cursor, exactly what we want here.
  };
}

const emptyHoverObject = {
  contents: [],
};

const matcherOptions: MatcherOptions = {
  // We want "fds" to match "FDSButton".
  caseSensitive: false,
  // We're dealing with component names which are fairly short.
  maxGap: 20,
  // There can be thousands of component definitions in a large codebase. The
  // results should be limited so that we don't provide thousands of completion
  // suggestions and perform wasted map calls.
  maxResults: 50,
  // Explicit default.
  numThreads: 1,
  // Explicit default.
  recordMatchIndexes: false,
  // Prefer case-sensitive matches if the user signals casing, e.g., "Component"
  // would prefer "ComponentGroup" over "componentWrapper".
  smartCase: true,
};

export default class DefinitionManager {
  definitionForComponentName: Map<string, ComponentDefinition>;
  matcher: Matcher;

  constructor() {
    this.definitionForComponentName = new Map();
    this.matcher = new Matcher([]);
  }

  addDefinition(definition: ComponentDefinition) {
    const key = definition.name;
    this.definitionForComponentName.set(key, definition);
    this.matcher.addCandidates([key]);
  }

  getCompletions(
    document: TextDocument,
    positionParams: TextDocumentPositionParams,
  ): Array<CompletionItem> {
    const componentName = getComponentNameFromPositionParams(
      document,
      positionParams,
    );
    if (componentName == null) {
      return [];
    }

    return this.matcher
      .match(componentName.substring(1), matcherOptions)
      .map(({value}) => this.definitionForComponentName.get(value))
      .filter(Boolean)
      .map(definition => {
        return {
          insertText: getSnippetFromDefinition(definition),
          insertTextFormat: InsertTextFormat.Snippet,
          kind: CompletionItemKind.Snippet,
          label: definition.name,
          ...getDocumentationObject(definition),
        };
      });
  }

  getHover(
    document: TextDocument,
    positionParams: TextDocumentPositionParams,
  ): Hover {
    const {position} = positionParams;
    // Nuclide doesn't give us the word we've hovering on directly, so grab the
    // text on the line being hovered on and then scan for a word.
    let word = null;
    document.buffer.scanInRange(
      /[A-Za-z_]+/g,
      document.buffer.rangeForRow(position.line),
      ({matchText, range, stop}) => {
        // This will iterate through every match on the line, so we need to find
        // the word that intersects the hover position.
        if (range.containsPoint(lspPositionToAtomPoint(position))) {
          word = matchText;
          stop();
        }
      },
    );
    if (!word) {
      return emptyHoverObject;
    }

    return getHoverFromComponentDefinition(
      this.definitionForComponentName.get(word),
    );
  }
}
