/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 * @format
 */

import classnames from 'classnames';
import escapeHtml from 'escape-html';
import nullthrows from 'nullthrows';
import * as React from 'react';

export type HighlightedToken =
  | {|
      type: 'start',
      className: string,
    |}
  | {|
      type: 'end',
    |}
  | {|
      type: 'value',
      value: string,
    |};

export type HighlightedTokens = Array<Array<HighlightedToken>>;

const scopeToClassNameCache = new Map();

function scopeToClassName(scope: string): string {
  let className = scopeToClassNameCache.get(scope);
  if (className == null) {
    className = 'syntax--' + scope.replace(/\./g, ' syntax--');
    scopeToClassNameCache.set(scope, className);
  }
  return className;
}

/**
 * Re-uses an Atom grammar's tokenization functions to produce syntax-higlighted text
 * without the overhead of creating a new TextEditor / TextBuffer.
 */
export function highlightCode(
  grammar: atom$Grammar,
  code: string,
): HighlightedTokens {
  return grammar.tokenizeLines(code).map(highlightTokens);
}

function highlightTokens(
  line: Array<atom$GrammarToken>,
): Array<HighlightedToken> {
  const resultLine = [];
  const scopeStack = [];
  for (const token of line) {
    const diffIndex = scopeStack.findIndex(
      (stackEntry, i) => token.scopes[i] !== stackEntry,
    );
    if (diffIndex !== -1) {
      while (diffIndex < scopeStack.length) {
        resultLine.push({type: 'end'});
        scopeStack.pop();
      }
    }
    while (scopeStack.length < token.scopes.length) {
      const scope = token.scopes[scopeStack.length];
      resultLine.push({
        type: 'start',
        className: scopeToClassName(scope),
      });
      scopeStack.push(scope);
    }
    resultLine.push({type: 'value', value: token.value});
  }
  while (scopeStack.length) {
    resultLine.push({type: 'end'});
    scopeStack.pop();
  }
  return resultLine;
}

/**
 * Converts the grammar/code directly to HTML (using highlightCode above).
 */
export function highlightCodeHtml(grammar: atom$Grammar, code: string): string {
  const tokens = highlightCode(grammar, code);
  return tokens.map(tokensToHtml).join('\n');
}

function tokensToHtml(tokens: Array<HighlightedToken>): string {
  let html = '';
  for (const token of tokens) {
    switch (token.type) {
      case 'start':
        html += `<span class=${JSON.stringify(token.className)}>`;
        break;
      case 'end':
        html += '</span>';
        break;
      case 'value':
        html += escapeHtml(token.value);
        break;
    }
  }
  return html;
}

/**
 * Ready-to-render component for highlighted code.
 * Can be used with React's experimental AsyncMode component for
 * asynchronous highlighting.
 */
export function HighlightedCode({
  grammar,
  code,
  className,
  ...otherProps
}: {
  grammar: atom$Grammar,
  code: string,
  className?: string,
}): React.Node {
  return (
    <pre
      className={classnames(
        className,
        'nuclide-highlighted-code',
        'native-key-bindings',
      )}
      tabIndex={-1}
      {...otherProps}>
      <code>
        <HighlightedLines grammar={grammar} code={code} />
      </code>
    </pre>
  );
}

/**
 * Renders only the raw highlighted tokens used in HighlightedCode.
 * (you'll need to provide the styling yourself.)
 */
export function HighlightedLines({
  grammar,
  code,
}: {
  grammar: atom$Grammar,
  code: string,
}): React.Node {
  const lines = code.split('\n');
  // This is really hacky but we need a way to pass the parsed rule stack from one line to the next.
  // We'll give each component a shared array of rule stacks that can be written / read from.
  // React needs to render each line in order to make this work (but this assumption seems safe).
  const ruleStacks = new Array(lines.length);
  return lines.map((line, i) => {
    return (
      <HighlightedLine
        key={i}
        grammar={grammar}
        line={line}
        lineNumber={i}
        ruleStacks={ruleStacks}
      />
    );
  });
}

function HighlightedLine({grammar, line, lineNumber, ruleStacks}): React.Node {
  // $FlowIgnore
  const {tokens, ruleStack} = grammar.tokenizeLine(
    line,
    // Throws if the lines haven't been rendered in order.
    lineNumber > 0 ? nullthrows(ruleStacks[lineNumber - 1]) : null,
    /* firstLine */ lineNumber === 0,
  );
  ruleStacks[lineNumber] = ruleStack;
  return (
    <span
      dangerouslySetInnerHTML={{
        __html: tokensToHtml(highlightTokens(tokens)) + '\n',
      }}
    />
  );
}
