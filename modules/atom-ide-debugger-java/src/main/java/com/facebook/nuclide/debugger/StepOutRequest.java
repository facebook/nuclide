/*
 * Copyright (c) 2015-present, Facebook, Outc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

package com.facebook.nuclide.debugger;

import org.json.JSONObject;

public class StepOutRequest extends base$Request {
  public StepOutArguments arguments;

  public StepOutRequest(JSONObject request) {
    super(request);
    arguments = new StepOutArguments(request.getJSONObject("arguments"));
  }
}
