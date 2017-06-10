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

export type HackParameterDetails = {
  name: string,
  type: string,
  variadic: boolean,
};

export type HackFunctionDetails = {
  min_arity: number,
  return_type: string,
  params: Array<HackParameterDetails>,
};

// Note that all line/column values are 1-based.
export type HackRange = {
  filename: string,
  line: number,
  char_start: number,
  char_end: number,
};

export type HackCompletion = {
  name: string,
  type: string,
  pos: HackRange,
  func_details: ?HackFunctionDetails,
  expected_ty: boolean,
};

export type HackCompletionsResult = Array<HackCompletion>;

export type HackDiagnosticsResult = {
  errors: Array<{
    message: HackDiagnostic,
  }>,
};

/**
 * Each error or warning can consist of any number of different messages from
 * Flow to help explain the problem and point to different locations that may be
 * of interest.
 */
export type HackDiagnostic = Array<SingleHackMessage>;

export type SingleHackMessage = {
  path: ?string,
  descr: string,
  code: number,
  line: number,
  start: number,
  end: number,
};
