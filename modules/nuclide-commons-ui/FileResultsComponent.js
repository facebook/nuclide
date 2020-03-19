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

/* globals getSelection, requestAnimationFrame */

import type {FileResults} from 'nuclide-commons/FileResults';

import invariant from 'assert';
import classnames from 'classnames';
import getFragmentGrammar from 'nuclide-commons-atom/getFragmentGrammar';
import {HighlightedLines} from './HighlightedCode';
import HighlightedText from './HighlightedText';
import * as React from 'react';
import PathWithFileIcon from './PathWithFileIcon';

// $FlowIgnore: Not an official API yet.
const ConcurrentMode = React.unstable_ConcurrentMode;

// Asynchronously highlight any results with a lot of lines.
const ASYNC_LINE_LIMIT = 5;

// Must match value defined in FileResults.less.
const TAB_SIZE = 8;

// Return the number of leading tabs in the line.
function countLeadingTabs(line: string): number {
  let tabsSeen = 0;
  for (let index = 0; index < line.length; index++) {
    if (line.charAt(index) === '\t') {
      tabsSeen++;
    } else {
      break;
    }
  }
  return tabsSeen;
}

// Renders highlights for matches in the current line.
// Highlights are designed to be superimposed on the actual code.
function renderHighlights(
  line: string,
  matches: Array<atom$Range>,
): Array<string | React.Element<any>> {
  const pieces = [];
  const leadingTabs = countLeadingTabs(line);
  let curChar = 0;
  matches.forEach((match, i) => {
    if (match.start.column > line.length) {
      // This occasionally happens when lines are truncated server-side. Ignore.
      return;
    }
    if (match.start.column > curChar) {
      // If we picked up any leading tabs, convert them to spaces.
      const tabDifference = Math.max(leadingTabs - curChar, 0);
      const tabExtraSpaces = (TAB_SIZE - 1) * tabDifference;
      pieces.push(' '.repeat(tabExtraSpaces + match.start.column - curChar));
    }
    const matchStart = Math.max(curChar, match.start.column);
    // Note that matches can overlap.
    if (matchStart < match.end.column) {
      pieces.push(
        <span
          key={match.end.column}
          data-column={match.start.column}
          className="highlight-info">
          {line.substring(matchStart, match.end.column)}
        </span>,
      );
    }
    curChar = Math.max(curChar, match.end.column);
  });
  pieces.push('\n');
  return pieces;
}

function selectGrammar(path: string): atom$Grammar {
  let bestMatch = null;
  let highestScore = -Infinity;
  atom.grammars.forEachGrammar(grammar => {
    // TODO: tree-sitter grammars are not supported yet.
    if (!('tokenizeLine' in grammar)) {
      return;
    }
    const score = atom.grammars.getGrammarScore(grammar, path, '');
    if (score > highestScore || bestMatch == null) {
      bestMatch = grammar;
      highestScore = score;
    }
  });
  invariant(bestMatch != null, 'no grammars found');
  return getFragmentGrammar(bestMatch);
}

type Props = {
  fileResults: FileResults,
  collapsed: boolean,
  onClick: (path: string, line?: number, column?: number) => mixed,
  onToggle: (path: string) => mixed,
};

type State = {
  highlighted: boolean,
};

export default class FileResultsComponent extends React.Component<
  Props,
  State,
> {
  constructor(props: Props) {
    super(props);
    const totalLines = props.fileResults.groups.reduce(
      (acc, group) => acc + group.lines.length,
      0,
    );
    this.state = {
      highlighted: totalLines < ASYNC_LINE_LIMIT,
    };
  }

  componentDidMount() {
    if (!this.state.highlighted) {
      this._startHighlighting();
    }
  }

  _startHighlighting() {
    // TODO(pelmers): Use react deferred update API when facebook/react/issues/13306 is ready
    requestAnimationFrame(() => {
      this.setState({highlighted: true});
    });
  }

  shouldComponentUpdate(nextProps: Props, nextState: State): boolean {
    return (
      this.props.fileResults !== nextProps.fileResults ||
      this.props.collapsed !== nextProps.collapsed ||
      this.state.highlighted !== nextState.highlighted
    );
  }

  // Register event callbacks on the line number / code containers.
  // We can then use the data attributes to find the line numbers.
  _onLineColumnClick = (event: any) => {
    const line = (event.target: HTMLElement).dataset.line;
    if (line != null) {
      this.props.onClick(this.props.fileResults.path, parseInt(line, 10));
    }
  };

  _onCodeClick = (event: MouseEvent, startLine: number, lineCount: number) => {
    let column = undefined;
    if (
      event.target instanceof HTMLElement &&
      event.target.className === 'highlight-info'
    ) {
      // Highlights have columns attached as data-column.
      // (We could get this from the client coords as well, but it's harder.)
      column = parseInt(event.target.dataset.column, 10);
    } else {
      // Don't trigger if the user is trying to select something.
      const selection = getSelection();
      if (selection == null || selection.type === 'Range') {
        return;
      }
    }
    const {currentTarget, clientY} = event;
    if (!(currentTarget instanceof HTMLElement)) {
      return;
    }
    // Determine the line number via the relative click coordinates.
    const {top, height} = currentTarget.getBoundingClientRect();
    const relativeY = clientY - top;
    if (relativeY <= height) {
      const lineNumber =
        startLine + Math.floor((lineCount * relativeY) / height);
      this.props.onClick(this.props.fileResults.path, lineNumber - 1, column);
    }
  };

  _onToggle = () => {
    this.props.onToggle(this.props.fileResults.path);
  };

  _onFileClick = (event: MouseEvent) => {
    const {groups} = this.props.fileResults;
    if (groups.length === 0) {
      this.props.onClick(this.props.fileResults.path);
    } else {
      this.props.onClick(
        this.props.fileResults.path,
        groups[0].matches[0].start.row,
        groups[0].matches[0].start.column,
      );
    }
    event.stopPropagation();
  };

  render(): React.Node {
    const {fileResults} = this.props;
    const {path, pathMatch, groups} = fileResults;
    let displayPath = path;
    if (pathMatch != null) {
      displayPath = (
        <HighlightedText
          text={path}
          highlightedRanges={[[pathMatch[0], pathMatch[1]]]}
        />
      );
    }
    const grammar = selectGrammar(path);
    return (
      <div>
        <div
          // Show the full path in a tooltip if it overflows.
          title={fileResults.path}
          className="file-results-filename"
          onClick={this._onToggle}>
          <span
            className={classnames(
              'icon',
              this.props.collapsed ? 'icon-chevron-right' : 'icon-chevron-down',
            )}
          />
          <span onClick={this._onFileClick}>
            <PathWithFileIcon path={fileResults.path} children={[]} />
            {displayPath}
          </span>
        </div>
        <div>
          {!this.props.collapsed &&
            groups.map((group, groupKey) => {
              const lineNumbers = [];
              const highlights = [];
              const code = group.lines.join('\n');
              let matchIndex = 0;
              for (let i = 0; i < group.lines.length; i++) {
                const lineNum = i + group.startLine;
                // Extract all matches that are on the current line.
                const lineMatches = [];
                while (matchIndex < group.matches.length) {
                  const curMatch = group.matches[matchIndex];
                  const curLine = curMatch.start.row + 1;
                  if (curLine < lineNum) {
                    continue;
                  } else if (curLine === lineNum) {
                    lineMatches.push(curMatch);
                  } else {
                    break;
                  }
                  matchIndex++;
                }
                lineNumbers.push(
                  <div key={lineNum} data-line={lineNum - 1}>
                    {lineNum}
                  </div>,
                );
                highlights.push(renderHighlights(group.lines[i], lineMatches));
              }
              return (
                <div key={groupKey} className="file-results-snippet">
                  <div
                    onClick={this._onLineColumnClick}
                    className="file-results-line-numbers">
                    {lineNumbers}
                  </div>
                  <div
                    onClick={evt =>
                      this._onCodeClick(
                        evt,
                        group.startLine,
                        group.lines.length,
                      )
                    }
                    className="file-results-code">
                    {this.state.highlighted ? (
                      <ConcurrentMode>
                        <HighlightedLines grammar={grammar} code={code} />
                      </ConcurrentMode>
                    ) : (
                      code
                    )}
                    <div className="file-results-highlights">{highlights}</div>
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    );
  }
}
