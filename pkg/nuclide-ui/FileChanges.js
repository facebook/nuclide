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
import nullthrows from 'nullthrows';
import {pluralize} from 'nuclide-commons/string';
import {Range, TextBuffer} from 'atom';
import React from 'react';
import ReactDOM from 'react-dom';
import {Section} from './Section';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {goToLocation} from 'nuclide-commons-atom/go-to-location';

type Props = {
  collapsable?: boolean,
  diff: diffparser$FileDiff,
  extraData?: mixed,
  hunkComponentClass?: ReactClass<HunkProps>,
  fullPath?: NuclideUri,
  collapsable?: boolean,
  collapsedByDefault?: boolean,
};

type DefaultProps = {
  hunkComponentClass: ReactClass<HunkProps>,
};

export type HunkProps = {
  collapsable?: boolean,
  extraData?: mixed,
  grammar: atom$Grammar,
  hunk: diffparser$Hunk,
};

function getHighlightClass(type: diffparser$ChangeType): ?string {
  if (type === 'add') {
    return 'nuclide-ui-hunk-diff-insert';
  }
  if (type === 'del') {
    return 'nuclide-ui-hunk-diff-delete';
  }
  return null;
}

const NBSP = '\xa0';
const GutterElement = (props: {
  lineNumber: number,
  gutterWidth: number,
}): React.Element<any> => {
  const {lineNumber, gutterWidth} = props;
  const fillWidth = gutterWidth - String(lineNumber).length;
  // Paralleling the original line-number implementation,
  // pad the line number with leading spaces.
  const filler = fillWidth > 0 ? new Array(fillWidth).fill(NBSP).join('') : '';
  // Attempt to reuse the existing line-number styles.
  return <div className="line-number">{filler}{lineNumber}</div>;
};

export class HunkDiff extends React.Component {
  editor: atom$TextEditor;
  props: HunkProps;
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
    const changeCount = this.props.hunk.changes.length;
    const initialOffset = this.props.hunk.newStart;
    const maxDisplayLineNumber = initialOffset + changeCount - 1;
    // The maximum required gutter width for this hunk, in characters:
    const gutterWidth = String(maxDisplayLineNumber).length;
    const suffix = gutterWidth > 0 && gutterWidth < 5 ? `-w${gutterWidth}` : '';
    const gutter = editor.addGutter({
      name: `nuclide-ui-file-changes-line-number-gutter${suffix}`,
    });
    let deletedLinesInSection = 0;
    let deletedLines = 0;
    for (let line = 0; line < changeCount; line++) {
      if (this.props.hunk.changes[line].type === 'del') {
        deletedLinesInSection++;
      } else {
        deletedLines += deletedLinesInSection;
        deletedLinesInSection = 0;
      }
      const displayLine = line + initialOffset - deletedLines;
      const item = this._createGutterItem(displayLine, gutterWidth);
      const marker = editor.markBufferPosition([line, 0], {
        invalidate: 'touch',
      });
      gutter.decorateMarker(marker, {
        type: 'gutter',
        item,
      });
      this._disposables.add(() => {
        ReactDOM.unmountComponentAtNode(item);
        marker.destroy();
      });
    }
    this._disposables.add(() => {
      gutter.destroy();
    });
  }

  _createGutterItem(
    lineNumber: number,
    gutterWidthInCharacters: number,
  ): Object {
    const item = document.createElement('div');
    ReactDOM.render(
      <GutterElement
        lineNumber={lineNumber}
        gutterWidth={gutterWidthInCharacters}
      />,
      item,
    );
    return item;
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

  render(): React.Element<any> {
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
          this.editor = editorRef && editorRef.getModel();
        }}
        textBuffer={textBuffer}
      />
    );
  }
}

/* Renders changes to a single file. */
export default class FileChanges extends React.Component {
  props: Props;

  static defaultProps: DefaultProps = {
    hunkComponentClass: HunkDiff,
  };

  render(): ?React.Element<any> {
    const {diff, fullPath, collapsable, collapsedByDefault} = this.props;
    const {additions, annotation, chunks, deletions, to: fileName} = diff;
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
          {annotation
            .split('\n')
            .map((line, index) => <span key={index}>{line}<br /></span>)}
        </span>
      );
    }

    const diffDetails = (
      <span>
        {annotationComponent}
        {' '}
        (
        {additions + deletions}
        {' '}
        {pluralize('line', additions + deletions)}
        )
      </span>
    );

    const renderedFilename = fullPath != null
      ? <a onClick={() => goToLocation(fullPath)}>
          {fileName}
        </a>
      : fileName;

    const headline = (
      <span>
        {renderedFilename}
        {' '}
        {diffDetails}
      </span>
    );

    return (
      <Section
        collapsable={collapsable}
        collapsedByDefault={collapsedByDefault}
        headline={headline}>
        {hunks}
      </Section>
    );
  }
}
