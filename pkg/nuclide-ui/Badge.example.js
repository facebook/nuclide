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

import * as React from 'react';
import {Block} from 'nuclide-commons-ui/Block';
import {Badge, BadgeColors, BadgeSizes} from './Badge';

const BadgeBasicExample = (): React.Element<any> => (
  <div>
    <Block>
      <Badge value={1} /> <Badge value={11} /> <Badge value={123} />
    </Block>
  </div>
);

const BadgeColorExample = (): React.Element<any> => (
  <div>
    <Block>
      Info: <Badge color={BadgeColors.info} value={123} />
    </Block>
    <Block>
      Success: <Badge color={BadgeColors.success} value={123} />
    </Block>
    <Block>
      Warning: <Badge color={BadgeColors.warning} value={123} />
    </Block>
    <Block>
      Error: <Badge color={BadgeColors.error} value={123} />
    </Block>
  </div>
);

const BadgeSizeExample = (): React.Element<any> => (
  <div>
    <Block>
      Small: <Badge size={BadgeSizes.small} value={123} />
    </Block>
    <Block>
      Medium: <Badge size={BadgeSizes.medium} value={123} />
    </Block>
    <Block>
      Large: <Badge size={BadgeSizes.large} value={123} />
    </Block>
  </div>
);

const BadgeIconExample = (): React.Element<any> => (
  <div>
    <Block>
      <Badge icon="gear" value={13} />{' '}
      <Badge icon="cloud-download" color={BadgeColors.info} value={23} />{' '}
      <Badge icon="octoface" color={BadgeColors.success} value={42} />
    </Block>
  </div>
);

export const BadgeExamples = {
  sectionName: 'Badges',
  description: 'Badges are typically used to display numbers.',
  examples: [
    {
      title: 'Basic badges',
      component: BadgeBasicExample,
    },
    {
      title: 'Colored badges',
      component: BadgeColorExample,
    },
    {
      title: 'Badges with explicit size',
      component: BadgeSizeExample,
    },
    {
      title: 'Badges with Icons',
      component: BadgeIconExample,
    },
  ],
};
