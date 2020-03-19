/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

package com.facebook.nuclide.debugger;

import org.json.JSONObject;

public class EvaluateArguments {
  public String expression;
  public int frameId;

  public EvaluateArguments(JSONObject arguments) {
    expression = arguments.getString("expression");
    frameId = arguments.optInt("frameId", -1);
  }
}
