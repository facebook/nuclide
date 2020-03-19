/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 * @emails oncall+nuclide
 */
import formatEnoentNotification from '../format-enoent-notification';
import featureConfig from 'nuclide-commons-atom/feature-config';
import invariant from 'assert';

describe('formatEnoentNotification', () => {
  let formatted;

  beforeEach(() => {
    jest.spyOn(featureConfig, 'getSchema').mockReturnValue({
      title: 'Path to Node Executable',
      type: 'string',
      default: 'node',
      description: 'Absolute path to the node executable on your system.',
    });
    jest.spyOn(featureConfig, 'get').mockReturnValue('/path/to/node');
    formatted = formatEnoentNotification({
      feature: 'awesome stuff creation',
      toolName: 'node',
      pathSetting: 'my-special-package.pathToNode',
    });
  });

  it('formats the message', () => {
    invariant(formatted != null);
    expect(formatted.message).toBe("Nuclide couldn't find *node*!");
  });

  it('has a useful intro line', () => {
    invariant(formatted != null);
    const expected =
      "Awesome stuff creation needs *node* but Nuclide couldn't find it at `/path/to/node`";
    invariant(formatted.meta.description != null);
    expect(formatted.meta.description.startsWith(expected)).toBe(true);
  });

  it('mentions the setting title in the description', () => {
    invariant(formatted != null);
    invariant(formatted.meta.description != null);
    expect(/Path to Node/.test(formatted.meta.description)).toBe(true);
  });

  it('mentions the setting category in the description', () => {
    invariant(formatted != null);
    invariant(formatted.meta.description != null);
    expect(/My-special-package/.test(formatted.meta.description)).toBe(true);
  });
});
