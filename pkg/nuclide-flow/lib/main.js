'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import type {HyperclickProvider} from '../../hyperclick/lib/types';
import type {
  BusySignalProviderBase as BusySignalProviderBaseType,
} from '../../nuclide-busy-signal';
import type {CoverageProvider} from '../../nuclide-type-coverage/lib/types';
import type {OutlineProvider} from '../../nuclide-outline-view';
import type {NuclideEvaluationExpressionProvider} from '../../nuclide-debugger-interfaces/service';
import typeof * as FlowService from '../../nuclide-flow-rpc';

import invariant from 'assert';
import {CompositeDisposable} from 'atom';

import featureConfig from '../../commons-atom/featureConfig';
import {getServiceByNuclideUri} from '../../nuclide-remote-connection';
import {track} from '../../nuclide-analytics';
import registerGrammar from '../../commons-atom/register-grammar';
import {onDidRemoveProjectPath} from '../../commons-atom/projects';
import {FlowServiceWatcher} from './FlowServiceWatcher';
import AutocompleteProvider from './FlowAutocompleteProvider';
import FlowHyperclickProvider from './FlowHyperclickProvider';
// eslint-disable-next-line nuclide-internal/no-cross-atom-imports
import {DedupedBusySignalProviderBase} from '../../nuclide-busy-signal';
import FlowDiagnosticsProvider from './FlowDiagnosticsProvider';
import {FlowOutlineProvider} from './FlowOutlineProvider';
import {FlowTypeHintProvider} from './FlowTypeHintProvider';
import {FlowEvaluationExpressionProvider} from './FlowEvaluationExpressionProvider';
import {getCurrentServiceInstances} from './FlowServiceFactory';

import {getCoverage} from './FlowCoverageProvider';

import {JS_GRAMMARS, JAVASCRIPT_WORD_REGEX} from './constants';
const GRAMMARS_STRING = JS_GRAMMARS.join(', ');
const diagnosticsOnFlySetting = 'nuclide-flow.diagnosticsOnFly';

const PACKAGE_NAME = 'nuclide-flow';

let busySignalProvider;

let flowDiagnosticsProvider;

let disposables;

export function activate() {
  if (!disposables) {
    disposables = new CompositeDisposable();

    const watcher = new FlowServiceWatcher();
    disposables.add(watcher);

    disposables.add(atom.commands.add(
      'atom-workspace',
      'nuclide-flow:restart-flow-server',
      allowFlowServerRestart,
    ));

    registerGrammar('source.ini', '.flowconfig');
  }
}

/** Provider for autocomplete service. */
export function createAutocompleteProvider(): atom$AutocompleteProvider {
  const excludeLowerPriority = Boolean(featureConfig.get('nuclide-flow.excludeOtherAutocomplete'));
  const flowResultsFirst = Boolean(featureConfig.get('nuclide-flow.flowAutocompleteResultsFirst'));

  const autocompleteProvider = new AutocompleteProvider();

  return {
    selector: JS_GRAMMARS.map(grammar => '.' + grammar).join(', '),
    disableForSelector: '.source.js .comment',
    inclusionPriority: 1,
    // We want to get ranked higher than the snippets provider by default,
    // but it's configurable
    suggestionPriority: flowResultsFirst ? 5 : 1,
    onDidInsertSuggestion: () => {
      track('nuclide-flow.autocomplete-chosen');
    },
    excludeLowerPriority,
    getSuggestions(request) {
      return autocompleteProvider.getSuggestions(request);
    },
  };
}

export function getHyperclickProvider(): HyperclickProvider {
  const flowHyperclickProvider = new FlowHyperclickProvider();
  const getSuggestionForWord =
      flowHyperclickProvider.getSuggestionForWord.bind(flowHyperclickProvider);
  return {
    wordRegExp: JAVASCRIPT_WORD_REGEX,
    priority: 20,
    providerName: PACKAGE_NAME,
    getSuggestionForWord,
  };
}

export function provideBusySignal(): BusySignalProviderBaseType {
  if (!busySignalProvider) {
    busySignalProvider = new DedupedBusySignalProviderBase();
  }
  return busySignalProvider;
}

export function provideDiagnostics() {
  if (!flowDiagnosticsProvider) {
    const busyProvider = this.provideBusySignal();
    const runOnTheFly = ((featureConfig.get(diagnosticsOnFlySetting): any): boolean);
    flowDiagnosticsProvider = new FlowDiagnosticsProvider(runOnTheFly, busyProvider);
    invariant(disposables);
    disposables.add(onDidRemoveProjectPath(projectPath => {
      invariant(flowDiagnosticsProvider);
      flowDiagnosticsProvider.invalidateProjectPath(projectPath);
    }));
  }
  return flowDiagnosticsProvider;
}

export function provideOutlines(): OutlineProvider {
  const provider = new FlowOutlineProvider();
  return {
    grammarScopes: JS_GRAMMARS,
    priority: 1,
    name: 'Flow',
    getOutline: provider.getOutline.bind(provider),
  };
}

export function createTypeHintProvider(): Object {
  const flowTypeHintProvider = new FlowTypeHintProvider();
  const typeHint = flowTypeHintProvider.typeHint.bind(flowTypeHintProvider);
  return {
    selector: GRAMMARS_STRING,
    providerName: PACKAGE_NAME,
    inclusionPriority: 1,
    typeHint,
  };
}

export function createCoverageProvider(): CoverageProvider {
  return {
    displayName: 'Flow',
    priority: 10,
    grammarScopes: JS_GRAMMARS,
    getCoverage(path) {
      return getCoverage(path);
    },
  };
}

export function createEvaluationExpressionProvider(): NuclideEvaluationExpressionProvider {
  const evaluationExpressionProvider = new FlowEvaluationExpressionProvider();
  const getEvaluationExpression =
    evaluationExpressionProvider.getEvaluationExpression.bind(evaluationExpressionProvider);
  return {
    selector: GRAMMARS_STRING,
    name: PACKAGE_NAME,
    getEvaluationExpression,
  };
}

export function deactivate() {
  // TODO(mbolin): Find a way to unregister the autocomplete provider from
  // ServiceHub, or set a boolean in the autocomplete provider to always return
  // empty results.
  const service: ?FlowService = getServiceByNuclideUri('FlowService');
  invariant(service);
  service.dispose();
  if (disposables) {
    disposables.dispose();
    disposables = null;
  }
  if (flowDiagnosticsProvider) {
    flowDiagnosticsProvider.dispose();
    flowDiagnosticsProvider = null;
  }
}

function allowFlowServerRestart(): void {
  for (const service of getCurrentServiceInstances()) {
    service.allowServerRestart();
  }
}
