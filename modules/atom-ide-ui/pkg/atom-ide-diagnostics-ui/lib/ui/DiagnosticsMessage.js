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

import type {DiagnosticMessage} from '../../../atom-ide-diagnostics/lib/types';

import * as React from 'react';
import {Button, ButtonTypes} from 'nuclide-commons-ui/Button';
import {ButtonGroup} from 'nuclide-commons-ui/ButtonGroup';
import {DiagnosticsMessageText} from './DiagnosticsMessageText';
import {DiagnosticsTraceItem} from './DiagnosticsTraceItem';

type DiagnosticsMessageProps = {
  // these are processed in traceElements below
  /* eslint-disable react/no-unused-prop-types */
  message: DiagnosticMessage,
  goToLocation: (path: string, line: number) => mixed,
  fixer: (message: DiagnosticMessage) => void,
  children?: React.Node,
  /* eslint-enable react/no-unused-prop-types */
};

const PROVIDER_CLASS_NAME = {
  Error: 'highlight-error',
  Warning: 'highlight-warning',
  Info: 'highlight-info',
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
  return (
    <div className="diagnostics-popup-header">
      <ButtonGroup>{fixButton}</ButtonGroup>
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
      </div>
      {traceElements(props)}
      {props.children}
    </div>
  );
};

export const DiagnosticsMessageNoHeader = (props: DiagnosticsMessageProps) => {
  return (
    <div>
      <DiagnosticsMessageText message={props.message} />
      {traceElements(props)}
    </div>
  );
};
