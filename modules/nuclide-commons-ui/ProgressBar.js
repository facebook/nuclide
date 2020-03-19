/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow strict
 * @format
 */

import * as React from 'react';

type Props = {
  /**
   * The progress value. If none is provided, the Progressbar will render in `indefinite` mode.
   * Use `indefinite mode` to indicate an initializing period,
   * Prefer using the `LoadingSpinner` component for surfacing non-deterministic progress.
   */
  value?: number,
  /** Determines the scaling of `value`. `min` is implicitly set to `0`. */
  max?: number,
};

/** A Progressbar for showing deterministic progress. */
export const ProgressBar = (props: Props) => (
  <progress value={props.value} max={props.max} {...props} />
);
