'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import type {Level, Record, Executor, OutputProvider} from '../types';

import classnames from 'classnames';
import {React} from 'react-for-atom';
import {LazyNestedValueComponent} from '../../../nuclide-ui/LazyNestedValueComponent';
import SimpleValueComponent from '../../../nuclide-ui/SimpleValueComponent';
import shallowEqual from 'shallowequal';
import {TextRenderer} from '../../../nuclide-ui/TextRenderer';

type Props = {
  record: Record,
  showSourceLabel: boolean,
  getExecutor: (id: string) => ?Executor,
  getProvider: (id: string) => ?OutputProvider,
};

export default class RecordView extends React.Component {
  props: Props;

  _renderContent(record: Record): React.Element<any> {
    if (record.kind === 'request') {
      // TODO: We really want to use a text editor to render this so that we can get syntax
      // highlighting, but they're just too expensive. Figure out a less-expensive way to get syntax
      // highlighting.
      return <pre>{record.text || ' '}</pre>;
    } else if (record.kind === 'response') {
      const executor = this.props.getExecutor(record.sourceId);
      return this._renderNestedValueComponent(record, executor);
    } else if (record.data != null) {
      const provider = this.props.getProvider(record.sourceId);
      return this._renderNestedValueComponent(record, provider);
    } else {
      // If there's not text, use a space to make sure the row doesn't collapse.
      const text = record.text || ' ';
      return <pre>{text}</pre>;
    }
  }

  shouldComponentUpdate(nextProps: Props): boolean {
    return !shallowEqual(this.props, nextProps);
  }

  _renderNestedValueComponent(
    record: Record,
    provider: ?OutputProvider | ?Executor,
  ): React.Element<any> {
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
        expansionStateId={this}
      />
    );
  }

  render(): React.Element<any> {
    const {record} = this.props;
    const classNames = classnames(
      'nuclide-console-record',
      `level-${record.level || 'log'}`,
      {
        request: record.kind === 'request',
        response: record.kind === 'response',
      },
    );

    const iconName = getIconName(record);
    const icon = iconName ? <span className={`icon icon-${iconName}`} /> : null;
    const sourceLabel = this.props.showSourceLabel
      ? (
        <span
          className={`nuclide-console-record-source-label ${getHighlightClassName(record.level)}`}>
          {record.sourceId}
        </span>
      )
      : null;

    return (
      <div className={classNames}>
        {icon}
        <div className="nuclide-console-record-content-wrapper">
          {this._renderContent(record)}
        </div>
        {sourceLabel}
      </div>
    );
  }

}

function getComponent(type: ?string): ReactClass<any> {
  switch (type) {
    case 'text': return props => TextRenderer(props.evaluationResult);
    case 'boolean':
    case 'string':
    case 'number':
    case 'object':
    default: return SimpleValueComponent;
  }
}

function getHighlightClassName(level: Level): string {
  switch (level) {
    case 'info': return 'highlight-info';
    case 'success': return 'highlight-success';
    case 'warning': return 'highlight-warning';
    case 'error': return 'highlight-error';
    default: return 'highlight';
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
