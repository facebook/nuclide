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

import type {CodeAction} from '../../../atom-ide-code-actions/lib/types';

import * as React from 'react';
import {Button} from 'nuclide-commons-ui/Button';
import {ButtonGroup} from 'nuclide-commons-ui/ButtonGroup';

// Maximum number of CodeActions to show for a given Diagnostic.
const MAX_CODE_ACTIONS = 4;

export default function DiagnosticsCodeActions(props: {
  codeActions: Map<string, CodeAction>,
}): React.Element<any> {
  return (
    <div className="diagnostics-code-actions">
      {Array.from(props.codeActions.entries())
        .splice(0, MAX_CODE_ACTIONS)
        // TODO: (seansegal) T21130259 Display a "more" indicator when there are many CodeActions.
        .map(([title, codeAction], i) => {
          return (
            <ButtonGroup key={i}>
              <Button
                className="diagnostics-code-action-button"
                size="EXTRA_SMALL"
                onClick={() => {
                  // TODO: (seansegal) T21130332 Display CodeAction status indicators
                  codeAction.apply().catch(handleCodeActionFailure);
                }}>
                <span className="inline-block">{title}</span>
              </Button>
            </ButtonGroup>
          );
        })}
    </div>
  );
}

function handleCodeActionFailure(error: ?Error) {
  atom.notifications.addWarning('Code action could not be applied', {
    description: error ? error.message : '',
    dismissable: true,
  });
}
