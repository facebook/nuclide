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

export type ScrollbarIndicatorMarkType =
  | 'SELECTION'
  | 'CURSOR'
  | 'DIAGNOSTIC_ERROR'
  | 'STALE_DIAGNOSTIC_ERROR'
  | 'INLINE_REVIEW_COMMENT'
  | 'SEARCH_RESULT'
  | 'SOURCE_CONTROL_ADDITION'
  | 'SOURCE_CONTROL_REMOVAL'
  | 'SOURCE_CONTROL_CHANGE';

export const scrollbarMarkTypes: {
  [ScrollbarIndicatorMarkType]: ScrollbarIndicatorMarkType,
} = {
  SELECTION: 'SELECTION',
  CURSOR: 'CURSOR',
  DIAGNOSTIC_ERROR: 'DIAGNOSTIC_ERROR',
  STALE_DIAGNOSTIC_ERROR: 'STALE_DIAGNOSTIC_ERROR',
  SEARCH_RESULT: 'SEARCH_RESULT',
  SOURCE_CONTROL_ADDITION: 'SOURCE_CONTROL_ADDITION',
  SOURCE_CONTROL_REMOVAL: 'SOURCE_CONTROL_REMOVAL',
  SOURCE_CONTROL_CHANGE: 'SOURCE_CONTROL_CHANGE',
  INLINE_REVIEW_COMMENT: 'INLINE_REVIEW_COMMENT',
};
