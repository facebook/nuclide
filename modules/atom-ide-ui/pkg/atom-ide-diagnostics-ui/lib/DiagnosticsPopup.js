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
import type {NuclideUri} from 'nuclide-commons/nuclideUri';

import React from 'react';
import classnames from 'classnames';
import {DiagnosticsMessage} from './DiagnosticsMessage';

type DiagnosticsPopupProps = {
  messages: Array<FileDiagnosticMessage>,
  goToLocation: (filePath: NuclideUri, line: number) => mixed,
  fixer: (message: FileDiagnosticMessage) => void,
  left: number,
  top: number,
};

function renderMessage(
  fixer: (message: FileDiagnosticMessage) => void,
  goToLocation: (filePath: NuclideUri, line: number) => mixed,
  message: FileDiagnosticMessage,
  index: number,
): React.Element<any> {
  const className = classnames(
    // native-key-bindings and tabIndex=-1 are both needed to allow copying the text in the popup.
    'native-key-bindings',
    'nuclide-diagnostics-gutter-ui-popup-diagnostic',
    {
      'nuclide-diagnostics-gutter-ui-popup-error': message.type === 'Error',
      'nuclide-diagnostics-gutter-ui-popup-warning': message.type !== 'Error',
    },
  );
  return (
    <div className={className} key={index} tabIndex={-1}>
      <DiagnosticsMessage
        fixer={fixer}
        goToLocation={goToLocation}
        key={index}
        message={message}
      />
    </div>
  );
}

// TODO move LESS styles to nuclide-ui
export const DiagnosticsPopup = (props: DiagnosticsPopupProps) => {
  const {fixer, goToLocation, left, messages, top, ...rest} = props;
  return (
    <div
      className="nuclide-diagnostics-gutter-ui-popup"
      style={{
        left,
        top,
      }}
      {...rest}>
      {messages.map(renderMessage.bind(null, fixer, goToLocation))}
    </div>
  );
};
