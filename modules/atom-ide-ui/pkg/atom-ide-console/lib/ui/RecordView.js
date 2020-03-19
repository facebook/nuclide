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

import type {Level, Record} from '../types';
import type {RenderSegmentProps} from 'nuclide-commons-ui/Ansi';

import classnames from 'classnames';
import {MeasuredComponent} from 'nuclide-commons-ui/MeasuredComponent';
import * as React from 'react';

// TODO: Fix lint rule, this is in the same package!
// eslint-disable-next-line nuclide-internal/modules-dependencies
import {ExpressionTreeComponent} from 'atom-ide-ui';
import SimpleValueComponent from 'nuclide-commons-ui/SimpleValueComponent';
import FullWidthProgressBar from 'nuclide-commons-ui/FullWidthProgressBar';
import shallowEqual from 'shallowequal';
import Ansi from 'nuclide-commons-ui/Ansi';
import debounce from 'nuclide-commons/debounce';
import parseText from '../parseText';
import nullthrows from 'nullthrows';

type Props = {
  record: Record,
  showSourceLabel: boolean,
  onHeightChange: (record: Record, newHeight: number) => void,
  expansionStateId: Object,
};

const AnsiRenderSegment = ({key, style, content}: RenderSegmentProps) => (
  <span key={key} style={style} className="nuclide-console-default-text-colors">
    {parseText(content)}
  </span>
);

const ONE_DAY = 1000 * 60 * 60 * 24;
export default class RecordView extends React.Component<Props> {
  _wrapper: ?HTMLElement;
  _debouncedMeasureAndNotifyHeight: () => void;

  constructor(props: Props) {
    super(props);

    // The MeasuredComponent can call this many times in quick succession as the
    // child components render, so we debounce it since we only want to know about
    // the height change once everything has settled down
    (this: any)._debouncedMeasureAndNotifyHeight = debounce(
      this.measureAndNotifyHeight,
      10,
    );
  }

  componentDidMount() {
    // We initially assume a height for the record. After it is actually
    // rendered we need it to measure its actual height and report it
    this.measureAndNotifyHeight();
  }

  componentDidUpdate(prevProps: Props) {
    // Record is an immutable object, so any change that would affect a height
    // change should result in us getting a new object.
    if (this.props.record !== prevProps.record) {
      this.measureAndNotifyHeight();
    }
  }

  componentWillUnmount() {
    this._debouncedMeasureAndNotifyHeight.dispose();
  }

  _renderContent(): React.Element<any> {
    const {record} = this.props;
    if (record.kind === 'request') {
      // TODO: We really want to use a text editor to render this so that we can get syntax
      // highlighting, but they're just too expensive. Figure out a less-expensive way to get syntax
      // highlighting.
      return <pre>{record.text || ' '}</pre>;
    } else if (record.expressions != null) {
      return this._renderNestedValueComponent();
    } else {
      // If there's not text, use a space to make sure the row doesn't collapse.
      const text = record.text || ' ';

      if (record.format === 'ansi') {
        return <Ansi renderSegment={AnsiRenderSegment}>{text}</Ansi>;
      }
      return <pre>{parseText(text)}</pre>;
    }
  }

  shouldComponentUpdate(nextProps: Props): boolean {
    return !shallowEqual(this.props, nextProps);
  }

  _renderNestedValueComponent(): React.Element<any> {
    const {record, expansionStateId} = this.props;
    const expressions = nullthrows(record.expressions);

    // Render multiple objects.
    const children = [];
    for (const expression of expressions) {
      if (!expression.hasChildren()) {
        children.push(
          <SimpleValueComponent
            hideExpressionName={true}
            expression={expression}
          />,
        );
      } else {
        children.push(
          <ExpressionTreeComponent
            className="console-expression-tree-value"
            expression={expression}
            containerContext={expansionStateId}
            hideExpressionName={true}
          />,
        );
      }
    }
    return children.length <= 1 ? (
      children[0]
    ) : (
      <span className="console-multiple-objects">{children}</span>
    );
  }

  render(): React.Node {
    const {record} = this.props;
    const {level, kind, timestamp, sourceId, sourceName} = record;

    const classNames = classnames('console-record', `level-${level || 'log'}`, {
      request: kind === 'request',
      response: kind === 'response',
      // Allow native keybindings for text-only nodes. The ExpressionTreeComponent
      // will handle keybindings for expression nodes.
      'native-key-bindings':
        record.expressions == null || record.expressions.length === 0,
    });

    const iconName = getIconName(record);
    // flowlint-next-line sketchy-null-string:off
    const icon = iconName ? <span className={`icon icon-${iconName}`} /> : null;
    const sourceLabel = this.props.showSourceLabel ? (
      <span
        className={`console-record-source-label ${getHighlightClassName(
          level,
        )}`}>
        {sourceName ?? sourceId}
      </span>
    ) : null;
    let renderedTimestamp;
    if (timestamp != null) {
      const timestampLabel =
        Date.now() - timestamp > ONE_DAY
          ? timestamp.toLocaleString()
          : timestamp.toLocaleTimeString();
      renderedTimestamp = (
        <div className="console-record-timestamp">{timestampLabel}</div>
      );
    }
    return (
      <MeasuredComponent
        onMeasurementsChanged={this._debouncedMeasureAndNotifyHeight}>
        {/* $FlowFixMe(>=0.53.0) Flow suppress */}
        <div
          ref={this._handleRecordWrapper}
          className={classNames}
          tabIndex="0">
          {icon}
          <div className="console-record-content-wrapper">
            {record.repeatCount > 1 && (
              <div className="console-record-duplicate-number">
                {record.repeatCount}
              </div>
            )}
            <div className="console-record-content">
              {this._renderContent()}
            </div>
          </div>
          {sourceLabel}
          {renderedTimestamp}
          {<FullWidthProgressBar progress={null} visible={record.incomplete} />}
        </div>
      </MeasuredComponent>
    );
  }

  measureAndNotifyHeight = () => {
    if (this._wrapper == null) {
      return;
    }
    const {offsetHeight} = this._wrapper;
    this.props.onHeightChange(this.props.record, offsetHeight);
  };

  _handleRecordWrapper = (wrapper: HTMLElement) => {
    this._wrapper = wrapper;
  };
}

function getHighlightClassName(level: Level): string {
  switch (level) {
    case 'info':
      return 'highlight-info';
    case 'success':
      return 'highlight-success';
    case 'warning':
      return 'highlight-warning';
    case 'error':
      return 'highlight-error';
    default:
      return 'highlight';
  }
}

function getIconName(record: Record): ?string {
  switch (record.kind) {
    case 'request':
      return 'chevron-right';
    case 'response':
      return 'arrow-small-left';
  }
  switch (record.level) {
    case 'info':
      return 'info';
    case 'success':
      return 'check';
    case 'warning':
      return 'alert';
    case 'error':
      return 'stop';
  }
}
