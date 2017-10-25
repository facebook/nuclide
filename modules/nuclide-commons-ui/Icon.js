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

import classnames from 'classnames';
import * as React from 'react';

export type Nuclicon =
  | 'nuclicon-nuclide'
  | 'nuclicon-react'
  | 'nuclicon-buck'
  | 'nuclicon-hhvm'
  | 'nuclicon-hack'
  | 'nuclicon-relay'
  | 'nuclicon-swift'
  | 'nuclicon-file-directory'
  | 'nuclicon-file-directory-starred'
  | 'nuclicon-debugger'
  | 'nuclicon-arrow-down'
  | 'nuclicon-bug'
  | 'nuclicon-graphql'
  | 'nuclicon-comment-discussion'
  | 'nuclicon-comment'
  | 'nuclicon-jest-outline'
  | 'nuclicon-flow'
  | 'nuclicon-react-devtools'
  | 'nuclicon-funnel'
  | 'nuclicon-error'
  // Currently, "nuclicon-warning" is the same as Octicon's "alert" but we duplicate it because the
  // Octicons aren't vertically centered and the fact that this one's frequently shown next to
  // nuclicon-error makes it wayyyy more obvious.
  | 'nuclicon-warning'
  | 'nuclicon-small-arrow-right';

export type IconName = Nuclicon | atom$Octicon;

type Props = {
  /** Icon name, without the `icon-` prefix. E.g. `'arrow-up'` */
  icon: IconName,
  className?: string,
  /** Optional text content to render next to the icon. */
  children?: React.Node,
};

/**
 * Renders an icon with optional text next to it.
 */
export const Icon = (props: Props) => {
  const {icon, children, className, ...remainingProps} = props;
  const newClassName = classnames(
    className,
    icon == null ? null : `icon icon-${icon}`,
  );
  return (
    <span className={newClassName} {...remainingProps}>
      {children}
    </span>
  );
};
