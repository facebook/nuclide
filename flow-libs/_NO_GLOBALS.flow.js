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

/* eslint-disable no-undef */

// This is a hack. The react-redux libdefs are leaking a global Store and Dispatch. Until we fix it
// upstream (https://github.com/flow-typed/flow-typed/pull/2606), we'll shadow their types to make
// sure we don't use them when we forget to import ours with the same name.
declare type _DO_NOT_USE_ME_YOU_FORGOT_AN_IMPORT = empty;
declare type Store<A, B> = _DO_NOT_USE_ME_YOU_FORGOT_AN_IMPORT;
declare type Dispatch<A> = _DO_NOT_USE_ME_YOU_FORGOT_AN_IMPORT;
