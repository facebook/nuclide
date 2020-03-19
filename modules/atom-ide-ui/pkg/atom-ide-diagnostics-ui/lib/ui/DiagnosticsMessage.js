/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow strict-local
 * @format
 */

import type {DiagnosticMessage} from '../../../atom-ide-diagnostics/lib/types';

import * as React from 'react';
import {Button, ButtonTypes} from 'nuclide-commons-ui/Button';
import {DiagnosticsMessageText} from './DiagnosticsMessageText';
import {DiagnosticsMessageDescription} from './DiagnosticsMessageDescription';
import {DiagnosticsTraceItem} from './DiagnosticsTraceItem';

type DiagnosticsMessageProps = {
  // these are processed in traceElements below
  /* eslint-disable react/no-unused-prop-types */
  message: DiagnosticMessage,
  description?: string,
  goToLocation: (path: string, line: number) => mixed,
  fixer: (message: DiagnosticMessage) => void,
  children?: React.Node,
  /* eslint-enable react/no-unused-prop-types */
};

const PROVIDER_CLASS_NAME = {
  Error: 'highlight-error',
  Warning: 'highlight-warning',
  Info: 'highlight-info',
  Hint: 'highlight-info', // use same styles as Info
};

function diagnosticHeader(props: DiagnosticsMessageProps) {
  const {message, fixer} = props;
  const providerClassName = PROVIDER_CLASS_NAME[message.type];
  let fixButton = null;
  if (message.fix != null) {
    const applyFix = () => {
      fixer(message);
    };
    const speculative = message.fix.speculative === true;
    const buttonType = speculative ? undefined : ButtonTypes.SUCCESS;
    fixButton = (
      <Button buttonType={buttonType} size="EXTRA_SMALL" onClick={applyFix}>
        {// flowlint-next-line sketchy-null-string:off
        message.fix.title || 'Fix'}
      </Button>
    );
  }

  const staleBox = Boolean(message.stale) ? (
    <span className="diagnostics-popup-header-stale-box highlight">
      {'Stale'}
    </span>
  ) : null;

  return (
    <div className="diagnostics-popup-header">
      <span>
        {staleBox}
        {fixButton}
      </span>
      <span className={providerClassName}>{message.providerName}</span>
    </div>
  );
}

function traceElements(props: DiagnosticsMessageProps) {
  const {message, goToLocation} = props;
  return message.trace && message.trace.length ? (
    <div className="diagnostics-popup-trace">
      {message.trace.map((traceItem, i) => (
        <DiagnosticsTraceItem
          key={i}
          trace={traceItem}
          goToLocation={goToLocation}
        />
      ))}
    </div>
  ) : null;
}

export const DiagnosticsMessage = (props: DiagnosticsMessageProps) => {
  return (
    <div>
      {diagnosticHeader(props)}
      <div className="diagnostics-popup-message">
        <DiagnosticsMessageText message={props.message} />
        <DiagnosticsMessageDescription description={props.description} />
      </div>
      {traceElements(props)}
      {props.children}
    </div>
  );
};

export const DiagnosticsMessageNoHeader = (props: DiagnosticsMessageProps) => {
  return (
    <div className="diagnostics-full-description-message">
      <DiagnosticsMessageText message={props.message} />
      <DiagnosticsMessageDescription description={props.description} />
      {traceElements(props)}
    </div>
  );
};
