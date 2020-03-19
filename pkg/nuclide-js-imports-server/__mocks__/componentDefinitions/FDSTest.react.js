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
'use strict';

/* eslint-disable nuclide-internal/no-unresolved */
/* eslint-disable nuclide-internal/no-commonjs */
/* eslint-disable dependencies/case-sensitive */
/* eslint-disable react/no-unused-prop-types */

const React = require('React');

export type FDSType = 'regular' | 'special';

export type Props = {|
  /**
   * Test value.
   */
  value: number,

  /**
   * A test required enum.
   */
  type: FDSType,

  /**
   * Test optional.
   */
  optionalValue?: number,
|};

export type RedHerringProps = {|
  /**
   * This prop isn't related to the FDSTest component.
   */
  doNotIncludeMe: number,
|};

/**
 * @explorer-desc
 *
 * Test!
 */
class FDSTest extends React.PureComponent<Props> {
  static defaultProps = {
    type: 'regular',
    optionalValue: 50,
  };
}

// eslint-disable-next-line
module.exports = FDSTest;
