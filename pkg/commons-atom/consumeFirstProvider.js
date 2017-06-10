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

/**
 * The module formerly known as "service-hub-plus". Provides a workaround for
 * https://github.com/atom/service-hub/issues/6
 */

export default function consumeFirstProvider(
  keyPath: string,
  version: string = '0.0.0',
): Promise<any> {
  return new Promise((resolve, reject) => {
    const subscription = atom.packages.serviceHub.consume(
      keyPath,
      version,
      provider => {
        process.nextTick(() => {
          resolve(provider);
          subscription.dispose();
        });
      },
    );
  });
}
