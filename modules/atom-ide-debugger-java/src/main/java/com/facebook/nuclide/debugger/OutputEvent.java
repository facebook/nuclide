/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

package com.facebook.nuclide.debugger;

import org.json.JSONObject;

public class OutputEvent extends base$Event {
  private JSONObject body;

  public OutputEvent() {
    super("output");
    body = new JSONObject();
  }

  public OutputEvent setCategory(String category) {
    body.put("category", category);
    return this;
  }

  public OutputEvent setOutput(String output) {
    body.put("output", output);
    return this;
  }

  public OutputEvent setData(JSONObject data) {
    body.put("data", data);
    return this;
  }

  public JSONObject toJSON() {
    return super.toJSON().put("body", body);
  }
}
