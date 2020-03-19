/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

package com.facebook.nuclide.debugger;

import org.json.JSONObject;

public class BreakpointEvent extends base$Event {
  private JSONObject body;

  public BreakpointEvent() {
    super("breakpoint");
    body = new JSONObject();
  }

  public BreakpointEvent setReason(String reason) {
    body.put("reason", reason);
    return this;
  }

  public BreakpointEvent setBreakpoint(Breakpoint breakpoint) {
    body.put("breakpoint", breakpoint.toJSON());
    return this;
  }

  public JSONObject toJSON() {
    return super.toJSON().put("body", body);
  }
}
