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

import type {
  Level,
  Record,
  DisplayableRecord,
  Executor,
  OutputProvider,
} from '../types';

import classnames from 'classnames';
import * as React from 'react';
import {LazyNestedValueComponent} from '../../../nuclide-ui/LazyNestedValueComponent';
import SimpleValueComponent from '../../../nuclide-ui/SimpleValueComponent';
import shallowEqual from 'shallowequal';
import {TextRenderer} from '../../../nuclide-ui/TextRenderer';
import {MeasuredComponent} from '../../../nuclide-ui/MeasuredComponent';
import debounce from 'nuclide-commons/debounce';
import {nextAnimationFrame} from 'nuclide-commons/observable';
import {URL_REGEX} from 'nuclide-commons/string';
import featureConfig from 'nuclide-commons-atom/feature-config';

type Props = {
  displayableRecord: DisplayableRecord,
  showSourceLabel: boolean,
  getExecutor: (id: string) => ?Executor,
  getProvider: (id: string) => ?OutputProvider,
  onHeightChange: (recordId: number, newHeight: number) => void,
};

const ONE_DAY = 1000 * 60 * 60 * 24;
export default class RecordView extends React.Component<Props> {
  _wrapper: ?HTMLElement;
  _debouncedMeasureAndNotifyHeight: () => void;
  _rafDisposable: ?rxjs$Subscription;

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

  componentWillUnmount() {
    if (this._rafDisposable != null) {
      this._rafDisposable.unsubscribe();
    }
  }

  _renderContent(displayableRecord: DisplayableRecord): React.Element<any> {
    const {record} = displayableRecord;
    if (record.kind === 'request') {
      // TODO: We really want to use a text editor to render this so that we can get syntax
      // highlighting, but they're just too expensive. Figure out a less-expensive way to get syntax
      // highlighting.
      return <pre>{record.text || ' '}</pre>;
    } else if (record.kind === 'response') {
      const executor = this.props.getExecutor(record.sourceId);
      return this._renderNestedValueComponent(displayableRecord, executor);
    } else if (record.data != null) {
      const provider = this.props.getProvider(record.sourceId);
      return this._renderNestedValueComponent(displayableRecord, provider);
    } else {
      // If there's not text, use a space to make sure the row doesn't collapse.
      const text = record.text || ' ';
      return <pre>{parseText(text)}</pre>;
    }
  }

  shouldComponentUpdate(nextProps: Props): boolean {
    return !shallowEqual(this.props, nextProps);
  }

  _renderNestedValueComponent(
    displayableRecord: DisplayableRecord,
    provider: ?OutputProvider | ?Executor,
  ): React.Element<any> {
    const {record, expansionStateId} = displayableRecord;
    const getProperties = provider == null ? null : provider.getProperties;
    const type = record.data == null ? null : record.data.type;
    const simpleValueComponent = getComponent(type);
    return (
      <LazyNestedValueComponent
        className="nuclide-console-lazy-nested-value"
        evaluationResult={record.data}
        fetchChildren={getProperties}
        simpleValueComponent={simpleValueComponent}
        shouldCacheChildren={true}
        expansionStateId={expansionStateId}
      />
    );
  }

  render(): React.Node {
    const {displayableRecord} = this.props;
    const {record} = displayableRecord;
    const {level, kind, timestamp, sourceId} = record;

    const classNames = classnames(
      'nuclide-console-record',
      `level-${level || 'log'}`,
      {
        request: kind === 'request',
        response: kind === 'response',
      },
    );

    const iconName = getIconName(record);
    // flowlint-next-line sketchy-null-string:off
    const icon = iconName ? <span className={`icon icon-${iconName}`} /> : null;
    const sourceLabel = this.props.showSourceLabel ? (
      <span
        className={`nuclide-console-record-source-label ${getHighlightClassName(
          level,
        )}`}>
        {sourceId}
      </span>
    ) : null;
    let renderedTimestamp;
    if (timestamp != null) {
      const timestampLabel =
        Date.now() - timestamp > ONE_DAY
          ? timestamp.toLocaleString()
          : timestamp.toLocaleTimeString();
      renderedTimestamp = (
        <div className="nuclide-console-record-timestamp">{timestampLabel}</div>
      );
    }
    return (
      <MeasuredComponent
        onMeasurementsChanged={this._debouncedMeasureAndNotifyHeight}>
        {/* $FlowFixMe(>=0.53.0) Flow suppress */}
        <div ref={this._handleRecordWrapper} className={classNames}>
          {icon}
          <div className="nuclide-console-record-content-wrapper">
            {displayableRecord.record.repeatCount > 1 && (
              <div className="nuclide-console-record-duplicate-number">
                {displayableRecord.record.repeatCount}
              </div>
            )}
            <div className="nuclide-console-record-content">
              {this._renderContent(displayableRecord)}
            </div>
          </div>
          {sourceLabel}
          {renderedTimestamp}
        </div>
      </MeasuredComponent>
    );
  }

  measureAndNotifyHeight = () => {
    // This method is called after the necessary DOM mutations have
    // already occurred, however it is possible that the updates have
    // not been flushed to the screen. So the height change update
    // is deferred until the rendering is complete so that
    // this._wrapper.offsetHeight gives us the correct final height
    if (this._rafDisposable != null) {
      this._rafDisposable.unsubscribe();
    }
    this._rafDisposable = nextAnimationFrame.subscribe(() => {
      if (this._wrapper == null) {
        return;
      }
      const {offsetHeight} = this._wrapper;
      const {displayableRecord, onHeightChange} = this.props;
      if (offsetHeight !== displayableRecord.height) {
        onHeightChange(displayableRecord.id, offsetHeight);
      }
    });
  };

  _handleRecordWrapper = (wrapper: HTMLElement) => {
    this._wrapper = wrapper;
  };
}

function getComponent(type: ?string): React.ComponentType<any> {
  switch (type) {
    case 'text':
      return props => TextRenderer(props.evaluationResult);
    case 'boolean':
    case 'string':
    case 'number':
    case 'object':
    default:
      return SimpleValueComponent;
  }
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

/**
 * Parse special entities into links. In the future, it would be great to add a service so that we
 * could add new clickable things and to allow providers to mark specific ranges as links to things
 * that only they can know (e.g. relative paths output in BUCK messages). For now, however, we'll
 * just use some pattern settings and hardcode the patterns we care about.
 */
function parseText(text: string): Array<string | React.Element<any>> {
  const chunks = [];
  let lastIndex = 0;
  let index = 0;
  while (true) {
    const match = CLICKABLE_RE.exec(text);
    if (match == null) {
      break;
    }

    const matchedText = match[0];

    // Add all the text since our last match.
    chunks.push(
      text.slice(lastIndex, CLICKABLE_RE.lastIndex - matchedText.length),
    );
    lastIndex = CLICKABLE_RE.lastIndex;

    let href;
    if (match[1] != null) {
      // It's a diff
      const url = toString(featureConfig.get('nuclide-console.diffUrlPattern'));
      if (url !== '') {
        href = url.replace('%s', matchedText);
      }
    } else if (match[2] != null) {
      // It's a task
      const url = toString(featureConfig.get('nuclide-console.taskUrlPattern'));
      if (url !== '') {
        href = url.replace('%s', matchedText.slice(1));
      }
    } else if (match[3] != null) {
      // It's a URL
      href = matchedText;
    }

    chunks.push(
      // flowlint-next-line sketchy-null-string:off
      href ? (
        <a key={`r${index}`} href={href} target="_blank">
          {matchedText}
        </a>
      ) : (
        matchedText
      ),
    );

    index++;
  }

  // Add any remaining text.
  chunks.push(text.slice(lastIndex));

  return chunks;
}

const DIFF_PATTERN = '\\b[dD][1-9][0-9]{5,}\\b';
const TASK_PATTERN = '\\b[tT]\\d+\\b';
const CLICKABLE_PATTERNS = `(${DIFF_PATTERN})|(${TASK_PATTERN})|${URL_REGEX.source}`;
const CLICKABLE_RE = new RegExp(CLICKABLE_PATTERNS, 'g');

function toString(value: mixed): string {
  return typeof value === 'string' ? value : '';
}
