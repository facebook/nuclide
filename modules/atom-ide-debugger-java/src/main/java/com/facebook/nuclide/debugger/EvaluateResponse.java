/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

package com.facebook.nuclide.debugger;

import org.json.JSONObject;

public class EvaluateResponse extends base$Response {
  private String result;
  private String type = null;
  private int variablesReference;

  public EvaluateResponse(int request_seq) {
    super(request_seq, "evaluate");
  }

  public EvaluateResponse setResult(String result) {
    this.result = result;
    return this;
  }

  public EvaluateResponse setType(String type) {
    this.type = type;
    return this;
  }

  public EvaluateResponse setVariablesReference(int variablesReference) {
    this.variablesReference = variablesReference;
    return this;
  }

  public JSONObject toJSON() {
    JSONObject body = new JSONObject();
    if (success) {
      body.put("result", result).put("variablesReference", variablesReference);
      if (type != null) {
        body.put("type", type);
      }
    }
    return super.toJSON().put("body", body);
  }
}
