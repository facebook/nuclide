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
  FileDiagnosticMessage,
} from '../../atom-ide-diagnostics/lib/rpc-types';

import React from 'react';
import {Button, ButtonTypes} from 'nuclide-commons-ui/Button';
import {ButtonGroup} from 'nuclide-commons-ui/ButtonGroup';
import {DiagnosticsMessageText} from './DiagnosticsMessageText';
import {DiagnosticsTraceItem} from './DiagnosticsTraceItem';

type DiagnosticsMessageProps = {
  message: FileDiagnosticMessage,
  goToLocation: (path: string, line: number) => mixed,
  fixer: (message: FileDiagnosticMessage) => void,
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
        {message.fix.title || 'Fix'}
      </Button>
    );
  }
  return (
    <div className="nuclide-diagnostics-gutter-ui-popup-header">
      <ButtonGroup>
        {fixButton}
      </ButtonGroup>
      <span className={providerClassName}>{message.providerName}</span>
    </div>
  );
}

function traceElements(props: DiagnosticsMessageProps) {
  const {message, goToLocation} = props;
  return message.trace
    ? message.trace.map((traceItem, i) => (
        <DiagnosticsTraceItem
          key={i}
          trace={traceItem}
          goToLocation={goToLocation}
        />
      ))
    : null;
}

/**
 * Visually groups Buttons passed in as children.
 */
export const DiagnosticsMessage = (props: DiagnosticsMessageProps) => {
  return (
    <div>
      {diagnosticHeader(props)}
      <div className="nuclide-diagnostics-gutter-ui-popup-message">
        <DiagnosticsMessageText message={props.message} />
      </div>
      {traceElements(props)}
    </div>
  );
};

/**
 * Visually groups Buttons passed in as children.
 */
export const DiagnosticsMessageNoHeader = (props: DiagnosticsMessageProps) => {
  return (
    <div>
      <DiagnosticsMessageText message={props.message} />
      {traceElements(props)}
    </div>
  );
};
