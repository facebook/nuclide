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

export const BASIC_FDSTEST_COMPONENT_WITH_PROPS_SOURCE = `
/**
 * Copyright 2004-present Facebook. All Rights Reserved.
 */
'use strict';

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

class FDSFoo extends React.PureComponent {
  // Totally unrelated class!
}

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

module.exports = FDSTest;
`;
