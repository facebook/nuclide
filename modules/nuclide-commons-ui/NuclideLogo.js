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

import * as React from 'react';

/* eslint-disable max-len */
const LOGO = (
  <svg viewBox="-700.2 -266 300 360">
    <path
      fill="#9B4DCA"
      d="M-492.6-134.1c-76.9-76.2-166.8-110.3-196.8-80.4-4.1 4.1-7.3 9.9-8.9 16.3-6.7 24.6 4.8 63.5 30.6 105.6l13.1-12.8c-22.3-37-31.3-69.8-26.5-88 1-3.5 2.6-6.4 4.5-8.3 8.9-8.9 33.2-7.3 61.6 4.1 35.4 14 75.6 41.8 110 76.2 64.1 63.5 93.8 132.7 85.8 162.7-1 3.5-2.6 6.4-4.5 8.3-8.9 8.9-33.2 7.3-61.6-4.1-15-6.1-31.3-14.7-47.2-25.2l-13 12.7c57.7 38.6 112.3 51.3 134.6 29 4.1-4.1 7.3-9.9 8.9-16.3 10.5-38.8-24.6-114.1-90.6-179.8z"
    />
    <path fill="#6A1B9A" d="M-596.9-86V93.9l182.1-180.5v-179.2" />
    <path
      fill="#4A148C"
      d="M-604.5-88.8l97.9-97v-80L-688.7-86V93.9l84.2-83.5"
    />
    <path
      fill="#9B4DCA"
      d="M-505-121.4c33.5 33.5 57.7 68.2 72.1 98.2h19.5c-15-34.8-42.1-74.3-79.1-111-53.6-52.9-113.2-85.8-154.7-90.6v17.9c9.6 1.3 20.4 4.5 32.2 8.9 35.3 14.5 75.5 42.2 110 76.6z"
    />
  </svg>
);
/* eslint-enable max-len */

export default (props: {className?: string}): React.Element<any> => (
  <div {...props}>{LOGO}</div>
);
