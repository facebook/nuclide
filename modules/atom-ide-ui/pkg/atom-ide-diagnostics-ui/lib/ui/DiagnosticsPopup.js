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

import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {
  DiagnosticMessage,
  CodeActionsState,
  DescriptionsState,
} from '../../../atom-ide-diagnostics/lib/types';
import type {CodeAction} from '../../../atom-ide-code-actions/lib/types';

import * as React from 'react';
import classnames from 'classnames';
import analytics from 'nuclide-commons/analytics';
import {mapUnion} from 'nuclide-commons/collection';
import {DiagnosticsMessage} from './DiagnosticsMessage';
import DiagnosticsCodeActions from './DiagnosticsCodeActions';

type DiagnosticsPopupProps = {
  messages: Array<DiagnosticMessage>,
  goToLocation: (filePath: NuclideUri, line: number) => mixed,
  fixer: (message: DiagnosticMessage) => void,
  codeActionsForMessage?: CodeActionsState,
  descriptions?: DescriptionsState,
  style: ?Object,
};

function renderMessage(
  fixer: (message: DiagnosticMessage) => void,
  goToLocation: (filePath: NuclideUri, line: number) => mixed,
  codeActionsForMessage: ?CodeActionsState,
  descriptions: ?DescriptionsState,
  message: DiagnosticMessage,
  index: number,
): React.Element<any> {
  const className = classnames(
    // native-key-bindings and tabIndex=-1 are both needed to allow copying the text in the popup.
    'native-key-bindings',
    'diagnostics-popup-diagnostic',
    {
      'diagnostics-popup-error': message.type === 'Error',
      'diagnostics-popup-warning': message.type === 'Warning',
      'diagnostics-popup-info': message.type === 'Info',
      'diagnostics-popup-hint': message.type === 'Hint',
    },
  );
  const codeActions = getCodeActions(message, codeActionsForMessage);
  const description = getDescription(message, descriptions);
  return (
    <div className={className} key={index} tabIndex={-1}>
      <DiagnosticsMessage
        fixer={fixer}
        goToLocation={goToLocation}
        message={message}
        description={description}>
        {codeActions && codeActions.size ? (
          <DiagnosticsCodeActions codeActions={codeActions} />
        ) : null}
      </DiagnosticsMessage>
    </div>
  );
}

function getCodeActions(
  message: DiagnosticMessage,
  codeActionsForMessage: ?CodeActionsState,
): ?Map<string, CodeAction> {
  const codeActionMaps = [];
  if (message.actions != null && message.actions.length > 0) {
    codeActionMaps.push(
      new Map(
        message.actions.map(action => {
          return [
            action.title,
            {
              async getTitle() {
                return action.title;
              },
              async apply() {
                action.apply();
              },
              dispose() {},
            },
          ];
        }),
      ),
    );
  }
  if (codeActionsForMessage) {
    const actions = codeActionsForMessage.get(message);
    if (actions != null) {
      codeActionMaps.push(actions);
    }
  }
  return codeActionMaps.length > 0 ? mapUnion(...codeActionMaps) : null;
}

function getDescription(
  message: DiagnosticMessage,
  descriptions: ?DescriptionsState,
): string {
  if (descriptions) {
    return descriptions.get(message) || '';
  }
  return '';
}

// TODO move LESS styles to nuclide-ui
export class DiagnosticsPopup extends React.Component<DiagnosticsPopupProps> {
  componentDidMount() {
    analytics.track('diagnostics-show-popup', {
      // Note: there could be multiple providers here (but it's less common).
      providerName: this.props.messages[0].providerName,
    });
  }

  render() {
    const {
      fixer,
      goToLocation,
      codeActionsForMessage,
      descriptions,
      messages,
      ...rest
    } = this.props;
    return (
      <div className="diagnostics-popup" {...rest}>
        {messages.map((msg, index) =>
          renderMessage(
            fixer,
            goToLocation,
            codeActionsForMessage,
            descriptions,
            msg,
            index,
          ),
        )}
      </div>
    );
  }
}
