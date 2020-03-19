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

import nullthrows from 'nullthrows';

import type {ScrollbarIndicatorMark} from './main';

const MIN_PIXEL_HEIGHT = 4;

type MarkStyle = {
  width: number,
  offset: number,
  color: string,
};
type Props = {
  marks: Set<ScrollbarIndicatorMark>,
  screenRowForBufferRow(row: number): number,
  screenLineCount: number,
  markStyle: MarkStyle,
  height: number,
  width: number,
  editorIsVisible: boolean,
};

export default class ScrollBar extends React.PureComponent<Props> {
  _canvas: ?HTMLCanvasElement;
  _context: CanvasRenderingContext2D;

  componentDidMount() {
    const canvas = nullthrows(this._canvas);
    this._context = canvas.getContext('2d');
    this._drawToCanvas();
  }

  componentDidUpdate() {
    if (!this.props.editorIsVisible) {
      // Don't bother painting the canvas if it's not visible.
      return;
    }
    this._drawToCanvas();
  }

  _drawToCanvas() {
    const {width, height} = this._context.canvas;
    this._context.clearRect(0, 0, width, height);
    const {
      markStyle,
      screenRowForBufferRow,
      screenLineCount,
      marks,
    } = this.props;

    this._context.fillStyle = markStyle.color;
    marks.forEach(mark => {
      const screenStart = screenRowForBufferRow(mark.start);
      const screenEnd =
        // Often the mark is just one line. In that case, avoid the additional
        // call to `sceeenRowForBufferRow`
        mark.end === mark.start ? screenStart : screenRowForBufferRow(mark.end);

      const lineHeight = screenEnd - screenStart;
      const rangeHeight = Math.max(
        MIN_PIXEL_HEIGHT,
        Math.round(height * (lineHeight / screenLineCount)),
      );
      // Draw single lines as lines rather than ranges.
      const markPixelHeight = lineHeight === 1 ? MIN_PIXEL_HEIGHT : rangeHeight;
      const positionPercent = screenStart / screenLineCount;
      const pixelPosition = Math.floor(height * positionPercent);
      this._context.fillRect(
        markStyle.offset,
        pixelPosition,
        markStyle.width,
        markPixelHeight,
      );
    });
  }

  render(): React.Node {
    return (
      <canvas
        ref={node => (this._canvas = node)}
        height={this.props.height}
        width={this.props.width}
      />
    );
  }
}
