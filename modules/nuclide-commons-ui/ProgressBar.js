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

import React from 'react';

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
