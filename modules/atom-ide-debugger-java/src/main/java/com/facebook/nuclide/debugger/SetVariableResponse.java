/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

package com.facebook.nuclide.debugger;

import org.json.JSONObject;

public class SetVariableResponse extends base$Response {
  private JSONObject body;

  public SetVariableResponse(int request_seq) {
    super(request_seq, "stackTrace");
    this.body = new JSONObject();
  }

  public SetVariableResponse setValue(String value) {
    this.body.put("value", value);
    return this;
  }

  public SetVariableResponse setType(String type) {
    this.body.put("type", type);
    return this;
  }

  public SetVariableResponse setVariablesReference(int variablesReference) {
    this.body.put("variablesReference", variablesReference);
    return this;
  }

  public JSONObject toJSON() {
    return super.toJSON().put("body", body);
  }
}
