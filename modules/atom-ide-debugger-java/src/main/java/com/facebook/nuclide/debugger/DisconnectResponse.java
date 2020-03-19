/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

package com.facebook.nuclide.debugger;

public class DisconnectResponse extends base$Response {
  public DisconnectResponse(int request_seq) {
    super(request_seq, "disconnect");
  }
}
