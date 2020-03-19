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

import invariant from 'assert';
import {MIAsyncRecord, MIResultRecord} from './MIRecord';

// Type conversions from a generic MI record to command-specfic results

// failure from any command where resultClass is 'error'
export type MICommandError = {
  msg: string,
};

export function toCommandError(record: MIResultRecord): MICommandError {
  invariant(record.error);
  return ((record.result: any): MICommandError);
}

// break-insert
export type MIBreakpoint = {
  number: string,
  line?: string,
  'original-location'?: string,
  file?: string,
  fullname?: string,
  pending?: string,
};

export type MIBreakInsertResult = {
  bkpt: [MIBreakpoint],
};

export function breakInsertResult(record: MIResultRecord): MIBreakInsertResult {
  invariant(!record.error);
  return ((record.result: any): MIBreakInsertResult);
}

// data-evaluate-expression
export type MIDataEvaluateExpressionResult = {
  value: string,
};

export function dataEvaluateExpressionResult(
  record: MIResultRecord,
): MIDataEvaluateExpressionResult {
  invariant(!record.error);
  return ((record.result: any): MIDataEvaluateExpressionResult);
}

// data-list-register-names
export type MIDataListRegisterNamesResult = {
  'register-names': Array<string>,
};

export function dataListRegisterNamesResult(
  record: MIResultRecord,
): MIDataListRegisterNamesResult {
  invariant(!record.error);
  return ((record.result: any): MIDataListRegisterNamesResult);
}

// data-list-register-values
export type MIDataListRegisterValuesResult = {
  'register-values': Array<{
    number: string,
    value: string,
  }>,
};

export function dataListRegisterValuesResult(
  record: MIResultRecord,
): MIDataListRegisterValuesResult {
  invariant(!record.error);
  return ((record.result: any): MIDataListRegisterValuesResult);
}

// thread-info
export type MIThreadInfo = {
  id: string, // this is a globally unique id for the thread
  'target-id': string, // this is an id that is only unique in the target the thread is running in
  details?: string,
  name?: string,
  frame: MIStackFrame,
  state: 'stopped' | 'running',
  core?: string,
};

export type MIThreadInfoResult = {
  threads: [MIThreadInfo],
  'current-thread-id': string,
};

export function threadInfoResult(record: MIResultRecord): MIThreadInfoResult {
  invariant(!record.error);
  return ((record.result: any): MIThreadInfoResult);
}

// stack-info-depth
export type MIStackInfoDepthResult = {
  depth: string,
};

export function stackInfoDepthResult(
  record: MIResultRecord,
): MIStackInfoDepthResult {
  invariant(!record.error);
  return ((record.result: any): MIStackInfoDepthResult);
}

// stack-list-frames
export type MIStackFrame = {
  level: string, // a decimal integer, 0 is the most recent frame
  addr: string,
  func: string,
  file?: string,
  fullname?: string,
  line?: string,
  from?: string,
};

export type MIStackListFramesResult = {
  stack: Array<{
    frame: MIStackFrame,
  }>,
};

export function stackListFramesResult(
  record: MIResultRecord,
): MIStackListFramesResult {
  invariant(!record.error);
  return ((record.result: any): MIStackListFramesResult);
}

// stack-list-variables
export type MIVariable = {
  name: string,
  arg?: string, // if present, flags if variable is a function argument
  value?: string, // if missing, means this is a container (array, struct, etc.)
};

export type MIStackListVariablesResult = {
  variables: Array<MIVariable>,
};

export function stackListVariablesResult(
  record: MIResultRecord,
): MIStackListVariablesResult {
  invariant(!record.error);
  return ((record.result: any): MIStackListVariablesResult);
}

// var-create
export type MIVarCreateResult = {
  name: string,
  numchild: string,
  value: string,
  type: string,
  'thread-id': string,
  has_more: string,
};

export function varCreateResult(record: MIResultRecord): MIVarCreateResult {
  invariant(!record.error);
  return ((record.result: any): MIVarCreateResult);
}

// var-list-children
export type MIVarChild = {
  child: {
    name: string,
    exp: string,
    numchild: string,
    value?: string,
    type: string,
    'thread-id': string,
  },
};

export type MIVarListChildrenResult = {
  numchild: string,
  children: Array<MIVarChild>,
  has_more: string,
};

export function varListChildrenResult(
  record: MIResultRecord,
): MIVarListChildrenResult {
  invariant(!record.error);
  return ((record.result: any): MIVarListChildrenResult);
}

// var-info-num-children
export type MIVarInfoNumChildrenResult = {
  numchild: string,
};

export function varInfoNumChildrenResult(
  record: MIResultRecord,
): MIVarInfoNumChildrenResult {
  invariant(!record.error);
  return ((record.result: any): MIVarInfoNumChildrenResult);
}

// var-info-type
export type MIVarInfoTypeResult = {
  type: string,
};

export function varInfoTypeResult(record: MIResultRecord): MIVarInfoTypeResult {
  invariant(!record.error);
  return ((record.result: any): MIVarInfoTypeResult);
}

// var-evaluate-expression
export type MIVarEvaluateExpressionResult = {
  value: string,
};

export function varEvaluateExpressionResult(
  record: MIResultRecord,
): MIVarEvaluateExpressionResult {
  invariant(!record.error);
  return ((record.result: any): MIVarEvaluateExpressionResult);
}

// var-assign
export type MIVarAssignResult = {
  value: string,
};

export function varAssignResult(record: MIResultRecord): MIVarAssignResult {
  invariant(!record.error);
  return ((record.result: any): MIVarAssignResult);
}

// stopped async event
export type MIStoppedEventResult = {
  reason: string,
  bkptno: ?string,
  'thread-id': string,
};

export function stoppedEventResult(
  record: MIAsyncRecord,
): MIStoppedEventResult {
  invariant(record.asyncClass === 'stopped');
  return ((record.result: any): MIStoppedEventResult);
}

// breakpoint modified event
export type MIBreakpointModifiedEventResult = {
  bkpt: [MIBreakpoint],
};

export function breakpointModifiedEventResult(
  record: MIAsyncRecord,
): MIBreakpointModifiedEventResult {
  invariant(record.asyncClass === 'breakpoint-modified');
  return ((record.result: any): MIBreakpointModifiedEventResult);
}

// data-disassemble result
export type MIDisassembleInstruction = {
  address: string,
  inst: string,
};

export type MIDataDisassembleResult = {
  asm_insns: Array<MIDisassembleInstruction>,
};

export function dataDisassembleResult(
  record: MIResultRecord,
): MIDataDisassembleResult {
  invariant(!record.error);
  return ((record.result: any): MIDataDisassembleResult);
}

export type StopReason = {
  reason: string,
  description: string,
};
