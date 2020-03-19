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

import type {LinterProvider} from '../types';
import {LinterAdapter} from './LinterAdapter';

type BusyReporter = (title: string) => IDisposable;

export function createAdapter(
  provider: LinterProvider,
  busyReporter: BusyReporter,
): ?LinterAdapter {
  const validationErrors = validateLinter(provider);
  if (validationErrors.length === 0) {
    return new LinterAdapter(provider, busyReporter);
  } else {
    const nameString = provider.name;
    let message =
      `nuclide-diagnostics-store found problems with the linter \`${nameString}\`. ` +
      'Diagnostic messages from that linter will be unavailable.\n';
    message += validationErrors.map(error => `- ${error}\n`).join('');
    atom.notifications.addError(message, {dismissable: true});
    return null;
  }
}

export function validateLinter(provider: LinterProvider): Array<string> {
  const errors = [];
  validate(provider, 'Must not be undefined', errors);

  if (errors.length === 0) {
    validate(provider.grammarScopes, 'Must specify grammarScopes', errors);
    validate(
      Array.isArray(provider.grammarScopes),
      'grammarScopes must be an Array',
      errors,
    );
    if (errors.length === 0) {
      for (const grammar of provider.grammarScopes) {
        validate(
          typeof grammar === 'string',
          `Each grammarScope entry must be a string: ${grammar}`,
          errors,
        );
      }
    }

    validate(
      provider.scope === 'file' || provider.scope === 'project',
      `Scope must be 'file' or 'project'; found '${provider.scope}'`,
      errors,
    );

    validate(provider.lint, 'lint function must be specified', errors);
    validate(
      typeof provider.lint === 'function',
      'lint must be a function',
      errors,
    );

    // Older LinterV1 providers didn't have to provide a name.
    // We'll tolerate this, since there's still a few out there.
    if (provider.name == null) {
      provider.name = 'Linter';
    }
    validate(
      typeof provider.name === 'string',
      'provider must have a name',
      errors,
    );
  }

  return errors;
}

function validate(condition: mixed, msg: string, errors: Array<string>): void {
  // flowlint-next-line sketchy-null-mixed:off
  if (!condition) {
    errors.push(msg);
  }
}
