/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

package com.facebook.nuclide.debugger;

import org.json.JSONArray;
import org.json.JSONObject;

public class ScopesResponse extends base$Response {
  private JSONObject body;

  public ScopesResponse(int request_seq) {
    super(request_seq, "scopes");
  }

  public ScopesResponse setScopes(JSONArray scopes) {
    this.body = new JSONObject().put("scopes", scopes);
    return this;
  }

  public JSONObject toJSON() {
    return super.toJSON().put("body", body);
  }
}
