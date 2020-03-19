/*
 * Copyright (c) 2015-present, Facebook, Outc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

package com.facebook.nuclide.debugger;

import org.json.JSONObject;

public class StepOutArguments {
  public int threadId;

  public StepOutArguments(JSONObject arguments) {
    threadId = arguments.getInt("threadId");
  }
}
