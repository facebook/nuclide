/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 */

import type {ButtonType} from 'nuclide-commons-ui/Button';
import type {Observable} from 'rxjs';
import type {RevisionTree, RevisionPreview} from './revisionTree/RevisionTree';
import type {OperationProgress} from '../../nuclide-hg-rpc/lib/types';

export type TreePreviewApplierFunction = (
  tree: RevisionTree,
  previewType: ?RevisionPreview,
) => [Array<RevisionTree>, ?RevisionPreview];

export type ReportedOptimisticState = {
  optimisticApplier?: ?TreePreviewApplierFunction,
  showFullscreenSpinner?: boolean,
};

/**
 * This interface defines an operation to be run by hg. This includes arguments,
 * human-readable command information, how to preview this operation, and when
 * this operation will be marked as "completed".
 *
 * These objects are instantiated by the user and sent to the hg service to be run.
 */
export interface HgOperation {
  // Human-readable name of this operation
  name: string;

  // return the arguments passed to hg to run this command
  getArgs(): Array<string>;

  // Human-readable equivalent
  getEquivalentCommand(): string;

  // Documentation that can be shown when previewing this command
  getCommandDocumentation(): ?{
    naturalLanguageDescription: ?string,
    confirmationMessage: ?string,
    confirmationButtonType?: ButtonType,
    confirmationButtonText?: string,
    confirmationNote?: ?string,
  };

  // How to traverse and modify the commit tree to preview this operation before actually running it
  +makePreviewApplier?: (
    baseTree: Array<RevisionTree>,
  ) => ?TreePreviewApplierFunction;

  // While an operation is running or when waiting for smartlog to refresh after running,
  // we want to show optimistic state. This optimistic preview applier might change
  // over the course of an operation's execution, so the functions to apply are observed.
  // This function is used by the hg service and the results are passed back for consumption via HgOperationProgress.
  +makeOptimisticStateApplier?: (
    treeObservable: Observable<Array<RevisionTree>>,
  ) => Observable<?ReportedOptimisticState>;
}

/**
 * This wrapper around an HgOperation contains information about a currently running or previously run operation.
 * This includes how to optimistically render, which might change as the operation progresses.
 *
 * These objects are returned/observed from the service to render info, progress, errors, etc
 * about previously submitted operations.
 */
export type HgOperationProgress = {
  operation: HgOperation,

  stdout: Array<string>, // also contains stderr
  hasProcessExited: boolean, // whether the hg process has exited
  hasCompleted: boolean, // whether the process exited AND we've gotten a new list from hg AND confirmed the result of operation is present
  wasCanceled: boolean,
  exitCode: ?number,

  progress: ?OperationProgress, // current topic, progress precentage, time remaining

  // The current preview applier to apply optimisitc state. Will be `null` if no
  // optimistic state is required. Completes when the result of the operation is reflected in the data fetched from hg.
} & ReportedOptimisticState;

export function emptyHgOperationProgress(
  operation: HgOperation,
): HgOperationProgress {
  return {
    operation,
    optimisticApplier: null,
    stdout: [],
    hasProcessExited: false,
    hasCompleted: false,
    wasCanceled: false,
    exitCode: null,
    progress: null,
  };
}
