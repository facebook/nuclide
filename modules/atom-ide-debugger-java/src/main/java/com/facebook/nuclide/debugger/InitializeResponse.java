/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

package com.facebook.nuclide.debugger;

import org.json.JSONObject;

public class InitializeResponse extends base$Response {
  private JSONObject body;

  public InitializeResponse(int request_seq) {
    super(request_seq, "initialize");
  }

  public InitializeResponse setBody(JSONObject body) {
    this.body = body;
    return this;
  }

  public JSONObject toJSON() {
    return super.toJSON().put("body", body);
  }
}
