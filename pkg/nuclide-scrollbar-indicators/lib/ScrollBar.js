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

import memoizeUntilChanged from 'nuclide-commons/memoizeUntilChanged';
import * as React from 'react';
import {MeasuredComponent} from 'nuclide-commons-ui/MeasuredComponent';
import Immutable from 'immutable';

import type {ScrollbarIndicatorMark, ScrollbarIndicatorMarkType} from './main';
import type {ThemeColors} from './themeColors';
import {scrollbarMarkTypes} from './constants';
import ScrollBarLayer from './ScrollBarLayer';

export type Props = {
  markTypes: ?Immutable.Map<
    ScrollbarIndicatorMarkType,
    Set<ScrollbarIndicatorMark>,
  >,
  colors: ?ThemeColors,
  screenRowForBufferRow(row: number): number,
  editorIsVisible: boolean,
  screenLineCount: number,
};
type State = {
  height: ?number,
  width: ?number,
};

type MarkStyle = {
  width: number,
  offset: number,
  color: string,
};

const DIAGNOSTIC_ERROR_COLOR = '#ff0000';
const SEARCH_RESULT_COLOR = '#ffdd00';
const INLINE_REVIEW_COMMENT_COLOR = '#9B4DCA'; // Purple

const TYPE_ORDER: Array<ScrollbarIndicatorMarkType> = [
  scrollbarMarkTypes.SELECTION,
  scrollbarMarkTypes.SOURCE_CONTROL_ADDITION,
  scrollbarMarkTypes.SOURCE_CONTROL_REMOVAL,
  scrollbarMarkTypes.SOURCE_CONTROL_CHANGE,
  scrollbarMarkTypes.INLINE_REVIEW_COMMENT,
  scrollbarMarkTypes.SEARCH_RESULT,
  scrollbarMarkTypes.DIAGNOSTIC_ERROR,
  scrollbarMarkTypes.STALE_DIAGNOSTIC_ERROR,
  scrollbarMarkTypes.CURSOR,
];

export default class ScrollBar extends React.PureComponent<Props, State> {
  _node: ?HTMLDivElement;
  state = {height: null, width: null};

  _handleRef = (node: ?HTMLDivElement) => {
    if (node == null) {
      this.setState({height: null, width: null});
      return;
    }
    const rect = node.getBoundingClientRect();
    this.setState({height: rect.height, width: rect.width});
  };

  // This is memoized not because the method is expensive, but to allow the
  // ScrollbarLayer to take advantage of being a PureComponent.
  _getMarkStyleForType = (memoizeUntilChanged(
    (
      type: ScrollbarIndicatorMarkType,
      width: number,
      colors: ThemeColors,
    ): MarkStyle => {
      const oneThird = width / 3;
      const left = {width: oneThird, offset: 0};
      const middle = {width: oneThird, offset: oneThird};
      const right = {width: oneThird, offset: oneThird * 2};
      const full = {width, offset: 0};
      switch (type) {
        case scrollbarMarkTypes.DIAGNOSTIC_ERROR:
          return {...right, color: DIAGNOSTIC_ERROR_COLOR};
        case scrollbarMarkTypes.STALE_DIAGNOSTIC_ERROR:
          return {...right, color: colors.textColorSubtle};
        case scrollbarMarkTypes.SELECTION:
          return {...middle, color: colors.syntaxSelectionColor};
        case scrollbarMarkTypes.CURSOR:
          return {...full, color: colors.syntaxTextColor};
        case scrollbarMarkTypes.SEARCH_RESULT:
          return {...middle, color: SEARCH_RESULT_COLOR};
        case scrollbarMarkTypes.SOURCE_CONTROL_ADDITION:
        case scrollbarMarkTypes.SOURCE_CONTROL_REMOVAL:
        case scrollbarMarkTypes.SOURCE_CONTROL_CHANGE:
          return {...left, color: colors.backgroundColorInfo};
        case scrollbarMarkTypes.INLINE_REVIEW_COMMENT:
          return {...left, color: INLINE_REVIEW_COMMENT_COLOR};
        default:
          throw new Error(`Invalid scroll indicator mark type: ${type}`);
      }
    },
  ): // We have to make this return type explicit:
  // https://medium.com/flow-type/asking-for-required-annotations-64d4f9c1edf8
  (
    type: ScrollbarIndicatorMarkType,
    width: number,
    colors: ThemeColors,
  ) => MarkStyle);

  _renderLayers(): Array<React.Node> {
    const {width, height} = this.state;
    const {
      markTypes,
      colors,
      screenLineCount,
      editorIsVisible,
      screenRowForBufferRow,
    } = this.props;
    if (
      markTypes == null ||
      colors == null ||
      width == null ||
      height == null
    ) {
      return [];
    }

    return TYPE_ORDER.map(
      (type): React.Node => {
        const marks = markTypes.get(type);

        return (
          marks != null && (
            <ScrollBarLayer
              key={type}
              type={type}
              marks={marks}
              screenRowForBufferRow={screenRowForBufferRow}
              markStyle={this._getMarkStyleForType(type, width, colors)}
              width={width}
              height={height}
              editorIsVisible={editorIsVisible}
              screenLineCount={screenLineCount}
            />
          )
        );
      },
    );
  }

  _handleMeasurementsChanged = (rect: DOMRectReadOnly) => {
    // TODO: This height is not quite right. It should exclude the
    // ::-webkit-scrollbar-corner, but it does not
    this.setState({height: rect.height, width: rect.width});
  };

  render(): React.Node {
    return (
      <div className="scroll-marker-view">
        <MeasuredComponent
          style={{height: '100%', width: '100%'}}
          onMeasurementsChanged={this._handleMeasurementsChanged}>
          <div ref={this._handleRef}>{this._renderLayers()}</div>
        </MeasuredComponent>
      </div>
    );
  }
}
