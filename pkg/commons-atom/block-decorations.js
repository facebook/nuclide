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

import * as React from 'react';
import ReactDOM from 'react-dom';

type BlockElementWithProps = {
  element: React.Element<any>,
  customProps: Object,
};

/**
 * Instead of destroying all the decorations and re-rendering them on each edit,
 * while Atom markers may have already moved the elements to the right numbers,
 * this will diff the decorations of type: `diffBlockType` with what they should be,
 * given a source of truth: `source` that can be checked if an update is needed,
 * and `getElementWithProps` will be used to get the latest item to be rendered,
 * with the metadata it needs to store to check if no need for future changes.
 *
 * This introduces `React`-like behavior for Atom block decoration markers,
 * by diffing the source of truth to the rendered version, and applying only the needed changes.
 *
 * @return an array of markers to be destroyed when the decorations are no longer needed.
 */
export function syncBlockDecorations<Value>(
  editorElement: atom$TextEditorElement,
  diffBlockType: string,
  source: Map<number, Value>,
  shouldUpdate: (value: Value, properties: Object) => boolean,
  getElementWithProps: (value: Value) => BlockElementWithProps,
  syncWidth?: boolean = false,
): Array<atom$Marker> {
  const editor = editorElement.getModel();
  const decorations = editor.getDecorations({diffBlockType});
  const renderedLineNumbers = new Set();
  const {component} = editorElement;

  const markers = [];

  for (const decoration of decorations) {
    const marker = decoration.getMarker();
    const lineNumber = marker.getBufferRange().start.row;
    const value = source.get(lineNumber);
    const properties = decoration.getProperties();
    const item: HTMLElement = properties.item;

    // If the decoration should no longer exist or it has already been rendered,
    // it needs to be destroyed.
    if (value == null || renderedLineNumbers.has(lineNumber)) {
      marker.destroy();
      continue;
    }

    if (shouldUpdate(value, properties)) {
      const {element, customProps} = getElementWithProps(value);
      ReactDOM.render(element, item);

      Object.assign(properties, customProps);

      // Invalidate the block decoration measurements.
      if (component != null) {
        component.invalidateBlockDecorationDimensions(decoration);
      }
    }

    // The item is already up to date.
    markers.push(marker);
    renderedLineNumbers.add(lineNumber);
  }

  for (const [lineNumber, value] of source) {
    if (renderedLineNumbers.has(lineNumber)) {
      continue;
    }

    const {element, customProps} = getElementWithProps(value);
    const marker = editor.markBufferPosition([lineNumber, 0], {
      invalidate: 'never',
    });

    // The position should be `after` if the element is at the end of the file.
    const position =
      lineNumber >= editor.getLineCount() - 1 ? 'after' : 'before';
    const item = document.createElement('div');
    ReactDOM.render(element, item);
    marker.onDidDestroy(() => {
      ReactDOM.unmountComponentAtNode(item);
    });
    editor.decorateMarker(marker, {
      ...customProps,
      type: 'block',
      item,
      position,
    });

    markers.push(marker);
  }

  return markers;
}
