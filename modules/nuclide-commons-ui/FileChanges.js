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

import type {NuclideUri} from 'nuclide-commons/nuclideUri';

import {AtomTextEditor} from './AtomTextEditor';
import {goToLocation} from 'nuclide-commons-atom/go-to-location';
import {LoadingSpinner, LoadingSpinnerSizes} from './LoadingSpinner';
import nullthrows from 'nullthrows';
import {pluralize, ZERO_WIDTH_SPACE} from 'nuclide-commons/string';
import {Range, TextBuffer} from 'atom';
import * as React from 'react';
import ReactDOM from 'react-dom';
import {renderReactRoot} from './renderReactRoot';
import {Section} from './Section';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import classnames from 'classnames';

type Props = {
  collapsable?: boolean,
  diff: diffparser$FileDiff,
  extraData?: mixed,
  grammar?: atom$Grammar,
  // eslint-disable-next-line react/no-unused-prop-types
  hunkComponentClass?: React.ComponentType<HunkProps>,
  fullPath?: NuclideUri,
  displayPath?: string,
  collapsable?: boolean,
  collapsedByDefault?: boolean,
  hideHeadline?: boolean,
  softWrapped?: boolean,
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
  onClickLine?: (lineNum: number) => mixed,
  softWrapped?: boolean,
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
  lineNumbers: Iterable<?number>,
  gutterWidth: number,
  options: {
    extraName?: string,
    onClick?: (lineNumber: number) => mixed,
  } = {},
): atom$Gutter {
  const {extraName, onClick} = options;
  // 'nuclide-ui-file-changes-line-number-gutter-wX' makes a gutter Xem wide.
  // 'nuclide-ui-file-changes-line-number-gutter' makes a gutter 5em wide
  const suffix =
    gutterWidth > 0 && gutterWidth < MAX_GUTTER_WIDTH ? `-w${gutterWidth}` : '';
  let name = `nuclide-ui-file-changes-line-number-gutter${suffix}`;
  if (extraName != null) {
    name += ` ${extraName}`;
  }
  const gutter = editor.addGutter({name});

  let index = -1;
  for (const lineNumber of lineNumbers) {
    index++;
    if (lineNumber == null) {
      continue;
    }
    const marker = editor.markBufferPosition([index, 0], {
      invalidate: 'touch',
    });
    const item = createGutterItem(lineNumber, gutterWidth, onClick);
    gutter.decorateMarker(marker, {
      type: 'gutter',
      item,
    });
    gutter.onDidDestroy(() => {
      marker.destroy();
      ReactDOM.unmountComponentAtNode(item);
    });
  }

  return gutter;
}

const NBSP = '\xa0';
function createGutterItem(
  lineNumber: number,
  gutterWidth: number,
  onClick: ?(lineNumber: number) => mixed,
): HTMLElement {
  const fillWidth = gutterWidth - String(lineNumber).length;
  // Paralleling the original line-number implementation,
  // pad the line number with leading spaces.
  const filler = fillWidth > 0 ? new Array(fillWidth).fill(NBSP).join('') : '';
  // Attempt to reuse the existing line-number styles.
  return renderReactRoot(
    <div
      onClick={onClick && (() => onClick(lineNumber))}
      className={classnames('line-number', {clickable: onClick != null})}>
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
    this._disposables = new UniversalDisposable(
      // enable copying filename
      // core:copy isn't used because it breaks the custom copy behavior below,
      // and this selection doesn't work easily with cmd-c anyway.
      atom.contextMenu.add({
        '.nuclide-ui-file-changes-item': [
          {
            label: 'Copy',
            command: 'nuclide-ui-file-changes-item:copy',
          },
        ],
      }),
      atom.commands.add(
        '.nuclide-ui-file-changes-item',
        'nuclide-ui-file-changes-item:copy',
        event => {
          // need to strip out zero-width spaces that were added to the filename
          if (!(event.target instanceof HTMLElement)) {
            return;
          }
          const element: HTMLElement = event.target;
          const text = element.innerText;
          if (text == null) {
            return;
          }
          const allSpacesRegex = new RegExp(ZERO_WIDTH_SPACE, 'g');
          atom.clipboard.write(text.replace(allSpacesRegex, ''));
          event.stopPropagation();
        },
      ),
    );
  }

  componentDidMount(): void {
    const editor = nullthrows(this.editor);
    this._createLineMarkers(editor);
    this._createLineNumbers(editor);
  }

  UNSAFE_componentWillReceiveProps(nextProps: HunkProps): void {
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
      {
        onClick: this.props.onClickLine,
      },
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
    const {hunk, grammar, softWrapped} = this.props;
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
        softWrapped={softWrapped}
        ref={editorRef => {
          // $FlowFixMe(>=0.53.0) Flow suppress
          this.editor = editorRef && editorRef.getModel();
        }}
        textBuffer={textBuffer}
      />
    );
  }
}

function handleFilenameClick(
  fullPath: ?string,
  event: SyntheticMouseEvent<>,
): void {
  if (fullPath == null) {
    return;
  }
  goToLocation(fullPath);
  event.stopPropagation();
}

function renderFileChangeContainer(
  content: React.Node,
  isPreview: boolean,
  collapsable: ?boolean,
  fullPath: ?NuclideUri,
  displayPath: ?string,
  collapsedByDefault: ?boolean,
  hideHeadline: ?boolean,
  diff: ?diffparser$FileDiff,
): React.Node {
  const {additions, annotation, deletions, from: fromFileName, to: toFileName} =
    diff != null
      ? diff
      : {
          additions: null,
          annotation: null,
          deletions: null,
          from: fullPath,
          to: fullPath,
        };

  if (toFileName == null || fromFileName == null) {
    // sanity check: toFileName & fromFileName should always be given
    return null;
  }
  const fileName =
    displayPath != null
      ? displayPath
      : toFileName !== '/dev/null'
        ? toFileName
        : fromFileName;
  let annotationComponent;
  if (!isPreview && annotation != null) {
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
  const diffDetails = isPreview ? null : (
    <span className="nuclide-ui-file-changes-details">
      {annotationComponent} (
      {addedOrDeletedString}
      {additions + deletions} {pluralize('line', additions + deletions)}
      )
    </span>
  );

  // insert zero-width spaces so filenames are wrapped at '/'
  const breakableFilename = fileName.replace(/\//g, '/' + ZERO_WIDTH_SPACE);
  const renderedFilename =
    fullPath != null ? (
      <a
        className="nuclide-ui-file-changes-name"
        onClick={handleFilenameClick.bind(null, fullPath)}>
        {breakableFilename}
      </a>
    ) : (
      breakableFilename
    );

  if (hideHeadline) {
    return content;
  }

  const headline = (
    <span
      className={classnames(
        'nuclide-ui-file-changes-item',
        'native-key-bindings',
      )}
      tabIndex={-1}>
      {renderedFilename} {diffDetails}
    </span>
  );
  return (
    <Section
      collapsable={collapsable === true}
      collapsedByDefault={collapsedByDefault === true}
      headline={headline}
      title="Click to open">
      {content}
    </Section>
  );
}

/* Renders changes to a single file. */
export default class FileChanges extends React.Component<Props> {
  static defaultProps: DefaultProps = {
    hunkComponentClass: HunkDiff,
  };

  render(): React.Node {
    const {
      collapsable,
      fullPath,
      displayPath,
      collapsedByDefault,
      hideHeadline,
      diff,
      grammar,
      softWrapped,
    } = this.props;
    const {chunks, from: fromFileName, to: toFileName} = diff;
    if (toFileName == null || fromFileName == null) {
      // sanity check: toFileName & fromFileName should always be given
      return null;
    }
    const fileName = toFileName !== '/dev/null' ? toFileName : fromFileName;

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
          grammar={
            grammar != null
              ? grammar
              : atom.grammars.selectGrammar(fileName, '')
          }
          hunk={chunk}
          onClickLine={(line: number) => {
            if (fullPath != null) {
              goToLocation(fullPath, {line});
            }
          }}
          softWrapped={softWrapped}
        />,
      );
      i++;
    }

    return renderFileChangeContainer(
      hunks,
      /* isPreview */ false,
      collapsable,
      fullPath,
      displayPath,
      collapsedByDefault,
      hideHeadline,
      diff,
    );
  }
}

type LoadingProps = {
  collapsable?: boolean,
  fullPath?: NuclideUri,
  displayPath?: string,
  collapsedByDefault?: boolean,
  hideHeadline?: boolean,
};

export class LoadingFileChanges extends React.Component<LoadingProps> {
  _handleFilenameClick = (event: SyntheticMouseEvent<>): void => {
    const {fullPath} = this.props;
    if (fullPath == null) {
      return;
    }
    goToLocation(fullPath);
    event.stopPropagation();
  };

  render(): React.Node {
    const spinner = (
      <LoadingSpinner
        size={LoadingSpinnerSizes.EXTRA_SMALL}
        className="nuclide-ui-file-changes-file-spinner"
      />
    );

    const {
      collapsable,
      fullPath,
      displayPath,
      collapsedByDefault,
      hideHeadline,
    } = this.props;
    return renderFileChangeContainer(
      spinner,
      /* isPreview */ true,
      collapsable,
      fullPath,
      displayPath,
      collapsedByDefault,
      hideHeadline,
      /* diff */ null,
    );
  }
}
