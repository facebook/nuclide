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
import Anser from 'anser';
import escapeCarriageReturn from 'escape-carriage';

type Props = {
  useClasses?: boolean,
  colorStyle?: {[color: string]: string},
  children?: string,
  renderSegment?: RenderSegmentProps => React.Node,
};

export type RenderSegmentProps = {
  key: string,
  style: Object,
  content: string,
};

function ansiToJSON(input, useClasses) {
  const classes = useClasses == null || !useClasses ? false : useClasses;
  return Anser.ansiToJson(escapeCarriageReturn(input), {
    use_classes: classes,
    json: true,
    remove_empty: true,
  });
}

// make sure
function ansiJSONtoStyleBundle(ansiBundle, colorStyle) {
  const style = {};
  if (ansiBundle.bg) {
    style.backgroundColor =
      colorStyle != null
        ? `rgb(${colorStyle[ansiBundle.bg]})`
        : `rgb(${ansiBundle.bg})`;
  }
  if (ansiBundle.fg) {
    style.color =
      colorStyle != null
        ? `rgb(${colorStyle[ansiBundle.fg]})`
        : `rgb(${ansiBundle.fg})`;
  } else {
    if (colorStyle != null) {
      style.color = `rgb(${colorStyle.default})`;
    }
  }
  return {
    content: ansiBundle.content,
    style,
  };
}

function ansiToInlineStyle(text, useClasses, colorStyle) {
  return ansiToJSON(text, useClasses).map(input =>
    ansiJSONtoStyleBundle(input, colorStyle),
  );
}

function defaultRenderSegment({key, style, content}: RenderSegmentProps) {
  return (
    <span key={key} style={style}>
      {content}
    </span>
  );
}

export default class Ansi extends React.PureComponent<Props> {
  render() {
    const {
      useClasses,
      colorStyle,
      children,
      renderSegment = defaultRenderSegment,
      ...passThroughProps
    } = this.props;
    return (
      <code {...passThroughProps}>
        {ansiToInlineStyle(children, useClasses, colorStyle).map(
          ({style, content}, key) =>
            renderSegment({key: String(key), style, content}),
        )}
      </code>
    );
  }
}
