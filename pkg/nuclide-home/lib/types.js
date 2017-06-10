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

export type HomeFragments = {
  // A string that a package can publish to the main part of the home panel. This allows for
  // customized welcome messages, but should be used judiciously.
  welcome?: React.Element<any>,
  feature?: {
    title: string,
    icon: string,
    description: React.Element<any> | string,
    command?: string | (() => void),
  },
  priority?: number,
};
