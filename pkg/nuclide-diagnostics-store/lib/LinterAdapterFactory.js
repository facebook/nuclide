/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow
 */

import type {LinterProvider} from '../../nuclide-diagnostics-common';
// Flow didn't like it when I tried import type here. This shouldn't affect
// performance though, since LinterAdapter requires this anyway.
import {DiagnosticsProviderBase} from '../../nuclide-diagnostics-provider-base';
import {LinterAdapter} from './LinterAdapter';

function createSingleAdapter(
  provider: LinterProvider,
  ProviderBase?: typeof DiagnosticsProviderBase,
): ?LinterAdapter {
  if (provider.disabledForNuclide) {
    return;
  }
  const validationErrors = validateLinter(provider);
  if (validationErrors.length === 0) {
    return new LinterAdapter(provider, ProviderBase);
  } else {
    const nameString = provider && provider.providerName ? ` (${provider.providerName})` : '';
    let message = `nuclide-diagnostics-store found problems with a linter${nameString}. ` +
      'Diagnostic messages from that linter will be unavailable.\n';
    message += validationErrors.map(error => `- ${error}\n`).join('');
    atom.notifications.addError(message, {dismissable: true});
    return null;
  }
}

function addSingleAdapter(
  adapters: Set<LinterAdapter>,
  provider: LinterProvider,
  ProviderBase?: typeof DiagnosticsProviderBase,
): void {
  const adapter: ?LinterAdapter = createSingleAdapter(provider);
  if (adapter) {
    adapters.add(adapter);
  }
}

export function createAdapters(
  providers: LinterProvider | Array<LinterProvider>,
  ProviderBase?: typeof DiagnosticsProviderBase,
): Set<LinterAdapter> {
  const adapters = new Set();
  if (Array.isArray(providers)) {
    for (const provider of providers) {
      addSingleAdapter(adapters, provider);
    }
  } else {
    addSingleAdapter(adapters, providers);
  }
  return adapters;
}

export function validateLinter(provider: LinterProvider): Array<string> {
  const errors = [];
  validate(provider, 'Must not be undefined', errors);

  if (errors.length === 0) {
    validate(provider.grammarScopes, 'Must specify grammarScopes', errors);
    validate(Array.isArray(provider.grammarScopes), 'grammarScopes must be an Array', errors);
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
    validate(typeof provider.lint === 'function', 'lint must be a function', errors);

    if (provider.providerName) {
      validate(typeof provider.providerName === 'string', 'providerName must be a string', errors);
    }
  }

  return errors;
}

function validate(condition: mixed, msg: string, errors: Array<string>): void {
  if (!condition) {
    errors.push(msg);
  }
}
