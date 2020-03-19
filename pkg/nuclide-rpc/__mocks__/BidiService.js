/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict
 * @format
 */

interface I {
  m(arg: string): Promise<string>;
  dispose(): void;
}

export async function f(s: string, i: I): Promise<string> {
  const result = await i.m(s);
  i.dispose();
  return result;
}
