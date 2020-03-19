/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

package com.facebook.nuclide.debugger;

import org.json.JSONObject;

public class ExitedEvent extends base$Event {
  private JSONObject body;

  public ExitedEvent() {
    super("exited");
    body = new JSONObject();
  }

  public ExitedEvent setExitCode(int exitCode) {
    body.put("exitCode", exitCode);
    return this;
  }

  public JSONObject toJSON() {
    return super.toJSON().put("body", body);
  }
}
