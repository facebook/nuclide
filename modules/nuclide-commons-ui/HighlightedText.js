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

import * as React from 'react';
import invariant from 'assert';
import {arrayEqual} from 'nuclide-commons/collection';

export type TextRange = [/* start */ number, /* end */ number];
type Props = {|
  className?: ?string,
  /*
   * A list of ranges of the text string (pairs of indexes, inclusive lower
   * bound, exclusive upper bound -- just like .slice()) that should be
   * highlighted
   */
  highlightedRanges: Array<TextRange>,
  style?: ?Object,
  text: string,
|};

export default class HighlightedText extends React.Component<Props> {
  shouldComponentUpdate(nextProps: Props) {
    return (
      this.props.text !== nextProps.text ||
      !arrayEqual(
        this.props.highlightedRanges,
        nextProps.highlightedRanges,
        rangeEqual,
      )
    );
  }

  render(): React.Element<any> {
    const {className, highlightedRanges, style, text} = this.props;

    // generate counterpart unhighlightedRanges for the highlightedRanges
    const unhighlightedRanges: Array<TextRange> = [];
    for (let i = 0; i < highlightedRanges.length; i++) {
      const lastHighlighted = highlightedRanges[i - 1];
      const currentHighlighted = highlightedRanges[i];

      if (lastHighlighted == null) {
        // there's an opportunity for a minor correctness/optimization to not
        // include a [0, 0] range, but this is an internal process and it
        // preserves a handy property that unmatched always preceeds matched.
        // We don't render zero-length slices below anyway.
        unhighlightedRanges.push([0, currentHighlighted[0]]);
      } else {
        unhighlightedRanges.push([lastHighlighted[1], currentHighlighted[0]]);
      }

      if (
        // if the last matched range
        i === highlightedRanges.length - 1 &&
        // doesn't end perfectly at the end of the text,
        currentHighlighted[1] !== text.length
      ) {
        // add an additional unmatched range to cover the rest of the text
        unhighlightedRanges.push([currentHighlighted[1], text.length]);
      }
    }

    if (unhighlightedRanges.length === 0) {
      unhighlightedRanges.push([0, text.length]);
    }

    invariant(
      unhighlightedRanges.length === highlightedRanges.length ||
        unhighlightedRanges.length === highlightedRanges.length + 1,
    );
    const renderedSequences: Array<React.Element<any>> = [];
    for (let i = 0; i < unhighlightedRanges.length; i++) {
      const unhighlightedRange = unhighlightedRanges[i];
      const highlightedRange = highlightedRanges[i];
      if (!rangeEmpty(unhighlightedRange)) {
        renderedSequences.push(
          renderUnmatchedSubsequence(
            text.slice(unhighlightedRange[0], unhighlightedRange[1]),
            unhighlightedRange.join(','),
          ),
        );
      }

      if (highlightedRange != null && !rangeEmpty(highlightedRange)) {
        renderedSequences.push(
          renderMatchedSubsequence(
            text.slice(highlightedRange[0], highlightedRange[1]),
            highlightedRange.join(','),
          ),
        );
      }
    }

    return (
      <span className={className} style={style}>
        {renderedSequences}
      </span>
    );
  }
}

function renderSubsequence(seq: string, props: Object): React.Element<any> {
  return <span {...props}>{seq}</span>;
}

function renderUnmatchedSubsequence(
  seq: string,
  key: number | string,
): React.Element<any> {
  return renderSubsequence(seq, {key});
}

function renderMatchedSubsequence(
  seq: string,
  key: number | string,
): React.Element<any> {
  return renderSubsequence(seq, {
    key,
    className: 'nuclide-match-highlighted-text-match',
  });
}

function rangeEqual(a: TextRange, b: TextRange): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

function rangeEmpty(range: TextRange): boolean {
  return range[0] === range[1];
}
