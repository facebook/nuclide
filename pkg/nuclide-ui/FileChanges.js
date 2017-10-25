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

import {AtomTextEditor} from 'nuclide-commons-ui/AtomTextEditor';
import {goToLocation} from 'nuclide-commons-atom/go-to-location';
import nullthrows from 'nullthrows';
import {pluralize} from 'nuclide-commons/string';
import {Range, TextBuffer} from 'atom';
import * as React from 'react';
import ReactDOM from 'react-dom';
import {renderReactRoot} from 'nuclide-commons-ui/renderReactRoot';
import {Section} from './Section';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';

type Props = {
  collapsable?: boolean,
  diff: diffparser$FileDiff,
  extraData?: mixed,
  // eslint-disable-next-line react/no-unused-prop-types
  hunkComponentClass?: React.ComponentType<HunkProps>,
  fullPath?: NuclideUri,
  collapsable?: boolean,
  collapsedByDefault?: boolean,
};

type DefaultProps = {
  hunkComponentClass: React.ComponentType<HunkProps>,
};

export type HunkProps = {
  // TODO: remove disable
  /* eslint-disable react/no-unused-prop-types */
  collapsable?: boolean,
  extraData?: mixed,
  /* eslint-enable react/no-unused-prop-types */
  grammar: atom$Grammar,
  hunk: diffparser$Hunk,
};

const MAX_GUTTER_WIDTH = 5;

function getHighlightClass(type: diffparser$ChangeType): ?string {
  if (type === 'add') {
    return 'nuclide-ui-hunk-diff-insert';
  }
  if (type === 'del') {
    return 'nuclide-ui-hunk-diff-delete';
  }
  return null;
}

// add a gutter to a text editor with line numbers defined by an iterable, as
// opposed to being forced to start at 1 and counting up
export function createCustomLineNumberGutter(
  editor: atom$TextEditor,
  lineNumbers: Iterable<number>,
  gutterWidth: number,
): atom$Gutter {
  // 'nuclide-ui-file-changes-line-number-gutter-wX' makes a gutter Xem wide.
  // 'nuclide-ui-file-changes-line-number-gutter' makes a gutter 5em wide
  const suffix =
    gutterWidth > 0 && gutterWidth < MAX_GUTTER_WIDTH ? `-w${gutterWidth}` : '';
  const gutter = editor.addGutter({
    name: `nuclide-ui-file-changes-line-number-gutter${suffix}`,
  });

  let index = 0;
  for (const lineNumber of lineNumbers) {
    const marker = editor.markBufferPosition([index, 0], {
      invalidate: 'touch',
    });
    const item = createGutterItem(lineNumber, gutterWidth);
    gutter.decorateMarker(marker, {
      type: 'gutter',
      item,
    });
    gutter.onDidDestroy(() => {
      marker.destroy();
      ReactDOM.unmountComponentAtNode(item);
    });
    index++;
  }

  return gutter;
}

const NBSP = '\xa0';
function createGutterItem(
  lineNumber: number,
  gutterWidth: number,
): HTMLElement {
  const fillWidth = gutterWidth - String(lineNumber).length;
  // Paralleling the original line-number implementation,
  // pad the line number with leading spaces.
  const filler = fillWidth > 0 ? new Array(fillWidth).fill(NBSP).join('') : '';
  // Attempt to reuse the existing line-number styles.
  return renderReactRoot(
    <div className="line-number">
      {filler}
      {lineNumber}
    </div>,
  );
}

export class HunkDiff extends React.Component<HunkProps> {
  editor: atom$TextEditor;
  _disposables: UniversalDisposable;

  constructor(props: HunkProps) {
    super(props);
    this._disposables = new UniversalDisposable();
  }

  componentDidMount(): void {
    const editor = nullthrows(this.editor);
    this._createLineMarkers(editor);
    this._createLineNumbers(editor);
  }

  componentWillReceiveProps(nextProps: HunkProps): void {
    const {hunk, grammar} = nextProps;
    const changes = hunk.changes;
    const prevHunk = this.props.hunk;
    const editor = nullthrows(this.editor);

    const newText = changes.map(change => change.content.slice(1)).join('\n');
    const oldText = prevHunk.changes
      .map(change => change.content.slice(1))
      .join('\n');
    const oldGrammar = this.props.grammar;

    if (newText === oldText && grammar === oldGrammar) {
      return;
    }

    if (newText !== oldText) {
      editor.setText(newText);
    }
    if (grammar !== oldGrammar) {
      editor.setGrammar(grammar);
    }
    this._disposables.dispose();
    this._disposables = new UniversalDisposable();
    this._createLineMarkers(editor);
    this._createLineNumbers(editor);
  }

  shouldComponentUpdate(nextProps: HunkProps): boolean {
    return false;
  }

  componentWillUnmount(): void {
    this._disposables.dispose();
  }

  // Line numbers are contiguous, but have a random starting point, so we can't use the
  // default line-number gutter.
  _createLineNumbers(editor: atom$TextEditor): void {
    const {changes, newStart: initialOffset} = this.props.hunk;
    const changeCount = changes.length;
    const maxDisplayLineNumber = initialOffset + changeCount - 1;
    // The maximum required gutter width for this hunk, in characters:
    const gutterWidth = String(maxDisplayLineNumber).length;

    let deletedLinesInSection = 0;
    let deletedLines = 0;
    // use a generator to avoid having to precalculate and store an array of
    // line numbers
    function* lineNumberGenerator(): Iterator<number> {
      for (let line = 0; line < changeCount; line++) {
        if (changes[line].type === 'del') {
          deletedLinesInSection++;
        } else {
          deletedLines += deletedLinesInSection;
          deletedLinesInSection = 0;
        }
        yield line + initialOffset - deletedLines;
      }
    }

    const gutter = createCustomLineNumberGutter(
      editor,
      lineNumberGenerator(),
      gutterWidth,
    );
    this._disposables.add(() => {
      gutter.destroy();
    });
  }

  /**
   * @param lineNumber A buffer line number to be highlighted.
   * @param type The type of highlight to be applied to the line.
   *             Could be a value of: ['insert', 'delete'].
   */
  _createLineMarkers(editor: atom$TextEditor): void {
    let hunkIndex = 0;
    for (const hunkChanges of this.props.hunk.changes) {
      const lineNumber = hunkIndex++;
      const range = new Range([lineNumber, 0], [lineNumber + 1, 0]);
      const marker = editor.markBufferRange(range, {invalidate: 'never'});
      const className = getHighlightClass(hunkChanges.type);
      if (className == null) {
        // No need to highlight normal lines.
        continue;
      }
      const decoration = editor.decorateMarker(marker, {
        type: 'highlight',
        class: className,
      });

      this._disposables.add(() => {
        decoration.destroy();
      });
    }
  }

  render(): React.Node {
    const {hunk, grammar} = this.props;
    const {changes} = hunk;
    // Remove the first character in each line (/[+- ]/) which indicates addition / deletion
    const text = changes.map(change => change.content.slice(1)).join('\n');
    const textBuffer = new TextBuffer();
    textBuffer.setText(text);

    return (
      <AtomTextEditor
        autoGrow={true}
        className="nuclide-ui-hunk-diff-text-editor"
        correctContainerWidth={false}
        grammar={grammar}
        gutterHidden={true}
        readOnly={true}
        ref={editorRef => {
          // $FlowFixMe(>=0.53.0) Flow suppress
          this.editor = editorRef && editorRef.getModel();
        }}
        textBuffer={textBuffer}
      />
    );
  }
}

/* Renders changes to a single file. */
export default class FileChanges extends React.Component<Props> {
  static defaultProps: DefaultProps = {
    hunkComponentClass: HunkDiff,
  };

  _handleFilenameClick = (event: SyntheticMouseEvent<>): void => {
    const {fullPath} = this.props;
    if (fullPath == null) {
      return;
    }
    goToLocation(fullPath);
    event.stopPropagation();
  };

  render(): React.Node {
    const {diff, fullPath, collapsable, collapsedByDefault} = this.props;
    const {
      additions,
      annotation,
      chunks,
      deletions,
      from: fromFileName,
      to: toFileName,
    } = diff;
    const fileName = toFileName !== '/dev/null' ? toFileName : fromFileName;
    const grammar = atom.grammars.selectGrammar(fileName, '');
    const hunks = [];
    let i = 0;
    for (const chunk of chunks) {
      if (i > 0) {
        hunks.push(
          <div className="nuclide-ui-hunk-diff-spacer" key={`spacer-${i}`} />,
        );
      }
      hunks.push(
        // $FlowFixMe(>=0.53.0) Flow suppress
        <this.props.hunkComponentClass
          extraData={this.props.extraData}
          key={chunk.oldStart}
          grammar={grammar}
          hunk={chunk}
        />,
      );
      i++;
    }
    let annotationComponent;
    if (annotation != null) {
      annotationComponent = (
        <span>
          {annotation.split('\n').map((line, index) => (
            <span key={index}>
              {line}
              <br />
            </span>
          ))}
        </span>
      );
    }

    let addedOrDeletedString = '';
    if (toFileName === '/dev/null') {
      addedOrDeletedString = 'file deleted - ';
    } else if (fromFileName === '/dev/null') {
      addedOrDeletedString = 'file added - ';
    }
    const diffDetails = (
      <span>
        {annotationComponent} (
        {addedOrDeletedString}
        {additions + deletions} {pluralize('line', additions + deletions)}
        )
      </span>
    );

    const renderedFilename =
      fullPath != null ? (
        <a onClick={this._handleFilenameClick}>{fileName}</a>
      ) : (
        fileName
      );

    const headline = (
      <span className="nuclide-ui-file-changes-item">
        {renderedFilename} {diffDetails}
      </span>
    );

    return (
      // $FlowFixMe(>=0.53.0) Flow suppress
      <Section
        collapsable={collapsable}
        collapsedByDefault={collapsedByDefault}
        headline={headline}
        title="Click to open">
        {hunks}
      </Section>
    );
  }
}
