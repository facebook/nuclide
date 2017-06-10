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

import type {LineMapper, OffsetMap} from '../commons-node/computeDiff';

import {Range} from 'atom';
import React from 'react';
import ReactDOM from 'react-dom';
import {concatIterators} from 'nuclide-commons/collection';
import {syncBlockDecorations} from './block-decorations';

export type EditorElementsMap = Map<number, React.Element<any>>;

function renderLineOffset(
  lineCount: number,
  lineHeight: number,
): React.Element<any> {
  return (
    <div
      className="nuclide-diff-view-block-offset"
      style={{minHeight: lineCount * lineHeight}}
    />
  );
}

function renderInlineOffset(
  offsetElement: React.Element<any>,
): React.Element<any> {
  return (
    <div style={{position: 'relative', width: '100%'}}>
      <div
        className="nuclide-diff-view-block-offset"
        style={{position: 'absolute', left: 0, right: 0, top: 0, bottom: 0}}
      />
      <div style={{visibility: 'hidden', pointerEvents: 'none'}}>
        {offsetElement}
      </div>
    </div>
  );
}

/**
 * The DiffViewEditor manages the lifecycle of the two editors used in the diff view,
 * and controls its rendering of highlights and offsets.
 */
export default class DiffViewEditor {
  _editor: atom$TextEditor;
  _editorElement: atom$TextEditorElement;
  _highlightMarkers: Array<atom$Marker>;
  _offsetMarkers: Array<atom$Marker>;
  _uiElementsMarkers: Array<atom$Marker>;
  _offsetUiElementsMarkers: Array<atom$Marker>;

  constructor(editorElement: atom$TextEditorElement) {
    this._editorElement = editorElement;
    this._editor = editorElement.getModel();
    this._highlightMarkers = [];
    this._offsetMarkers = [];
    this._uiElementsMarkers = [];
    this._offsetUiElementsMarkers = [];

    this._cleanupInvisibleDecorations();
  }

  // This is now to work around Atom 1.12.x not clearing removed block decorations.
  // TODO(most): Remove this when upgrading to Atom 1.13.x.
  _cleanupInvisibleDecorations(): void {
    if (this._editor.isDestroyed()) {
      return;
    }
    const removedElements = Array.from(
      this._editorElement.getElementsByClassName(
        'atom--invisible-block-decoration',
      ),
    );
    for (const element of removedElements) {
      ReactDOM.unmountComponentAtNode(element);
    }
  }

  setUiElements(elements: EditorElementsMap): void {
    const diffBlockType = 'inline';
    this._uiElementsMarkers = syncBlockDecorations(
      this._editorElement,
      diffBlockType,
      elements,
      (element, customProps) => customProps.element !== element,
      element => ({
        element,
        customProps: {diffBlockType, element},
      }),
      /* syncWidth */ true,
    );
  }

  setOffsetUiElements(
    offsetElements: EditorElementsMap,
    lineMapper: LineMapper,
  ): void {
    const mappedOffsetElements = new Map();
    for (const [bufferRow, offsetElement] of offsetElements) {
      mappedOffsetElements.set(lineMapper[bufferRow], offsetElement);
    }

    const diffBlockType = 'inline-offset';
    this._offsetUiElementsMarkers = syncBlockDecorations(
      this._editorElement,
      diffBlockType,
      mappedOffsetElements,
      (offsetElement, customProps) =>
        customProps.offsetElement !== offsetElement,
      offsetElement => ({
        element: renderInlineOffset(offsetElement),
        customProps: {diffBlockType, offsetElement},
      }),
    );
  }

  scrollToScreenLine(screenLine: number): void {
    this._editor.scrollToScreenPosition(
      // Markers are ordered in ascending order by line number.
      [screenLine, 0],
      {center: true},
    );
  }

  setFileContents(filePath: string, contents: string): void {
    const buffer = this._editor.getBuffer();
    if (buffer.getText() !== contents) {
      // Applies only to the compared read only text buffer.
      // Hence, it's safe and performant to use `setText` because the cursor position is hidden.
      buffer.setText(contents);
    }
    const grammar = atom.grammars.selectGrammar(filePath, contents);
    this._editor.setGrammar(grammar);
  }

  getModel(): Object {
    return this._editor;
  }

  getText(): string {
    return this._editor.getText();
  }

  /**
   * @param addedLines An array of buffer line numbers that should be highlighted as added.
   * @param removedLines An array of buffer line numbers that should be highlighted as removed.
   */
  setHighlightedLines(
    addedLines: Array<number> = [],
    removedLines: Array<number> = [],
  ) {
    for (const marker of this._highlightMarkers) {
      marker.destroy();
    }
    this._highlightMarkers = addedLines
      .map(lineNumber => this._createLineMarker(lineNumber, 'insert'))
      .concat(
        removedLines.map(lineNumber =>
          this._createLineMarker(lineNumber, 'delete'),
        ),
      );
  }

  /**
   * @param lineNumber A buffer line number to be highlighted.
   * @param type The type of highlight to be applied to the line.
  *    Could be a value of: ['insert', 'delete'].
   */
  _createLineMarker(lineNumber: number, type: string): atom$Marker {
    const range = new Range([lineNumber, 0], [lineNumber + 1, 0]);
    const marker = this._editor.markBufferRange(range, {invalidate: 'never'});
    this._editor.decorateMarker(marker, {
      type: 'highlight',
      class: `diff-view-${type}`,
    });
    return marker;
  }

  setOffsets(lineOffsets: OffsetMap): void {
    const lineHeight = this._editor.getLineHeightInPixels();
    const diffBlockType = 'line-offset';
    this._offsetMarkers = syncBlockDecorations(
      this._editorElement,
      diffBlockType,
      lineOffsets,
      (lineCount, customProps) => customProps.lineCount !== lineCount,
      lineCount => ({
        element: renderLineOffset(lineCount, lineHeight),
        customProps: {lineCount, diffBlockType},
      }),
    );
  }

  destroyMarkers(): void {
    const allMarkers = concatIterators(
      this._highlightMarkers,
      this._offsetMarkers,
      this._uiElementsMarkers,
      this._offsetUiElementsMarkers,
    );
    for (const marker of allMarkers) {
      marker.destroy();
    }
    this._highlightMarkers = [];
    this._offsetMarkers = [];
    this._uiElementsMarkers = [];
    this._offsetUiElementsMarkers = [];
    this._cleanupInvisibleDecorations();
  }

  destroy(): void {
    this.destroyMarkers();
    this._editor.destroy();
  }

  getEditor(): atom$TextEditor {
    return this._editor;
  }

  getEditorDomElement(): atom$TextEditorElement {
    return this._editorElement;
  }
}
