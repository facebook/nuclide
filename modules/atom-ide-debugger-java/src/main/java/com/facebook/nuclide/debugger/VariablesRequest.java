/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

package com.facebook.nuclide.debugger;

import org.json.JSONObject;

public class VariablesRequest extends base$Request {
  public VariablesArguments arguments;

  public VariablesRequest(JSONObject request) {
    super(request);
    arguments = new VariablesArguments(request.getJSONObject("arguments"));
  }
}
