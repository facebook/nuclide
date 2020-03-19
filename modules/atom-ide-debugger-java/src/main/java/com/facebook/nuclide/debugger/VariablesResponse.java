/*
 * Copyright (c) 2015-present, Facebook, Outc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

package com.facebook.nuclide.debugger;

import java.util.List;
import org.json.JSONArray;
import org.json.JSONObject;

public class VariablesResponse extends base$Response {
  public List<JSONObject> variables;

  public VariablesResponse(int request_seq) {
    super(request_seq, "variables");
  }

  public VariablesResponse setVariables(List<JSONObject> variables) {
    this.variables = variables;
    return this;
  }

  public JSONObject toJSON() {
    return super.toJSON().put("body", new JSONObject().put("variables", new JSONArray(variables)));
  }
}
