/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

package com.facebook.nuclide.debugger;

import org.json.JSONObject;

public class ContinueResponse extends base$Response {
  private JSONObject body;

  public ContinueResponse(int request_seq) {
    super(request_seq, "continue");
  }

  public ContinueResponse setAllThreadsContinued(boolean allThreadsContinued) {
    this.body = new JSONObject().put("allThreadsContinued", allThreadsContinued);
    return this;
  }

  public JSONObject toJSON() {
    return super.toJSON().put("body", body);
  }
}
