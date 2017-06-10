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

export default function createUtmUrl(url: string, campaign: string) {
  return `${url}/?utm_source=nuclide&utm_medium=app&utm_campaign=${campaign}`;
}
