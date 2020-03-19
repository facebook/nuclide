/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

package com.facebook.nuclide.debugger;

import org.json.JSONObject;

public class StoppedEvent extends base$Event {
  private JSONObject body;

  public StoppedEvent() {
    super("stopped");
    body = new JSONObject();
  }

  public StoppedEvent setReason(String reason) {
    body.put("reason", reason);
    return this;
  }

  public StoppedEvent setThreadId(long threadId) {
    body.put("threadId", threadId);
    return this;
  }

  public StoppedEvent setAllThreadsStopped(boolean allThreadsStopped) {
    body.put("allThreadsStopped", allThreadsStopped);
    return this;
  }

  public StoppedEvent setPreserveFocusHint(boolean preserveFocusHint) {
    body.put("preserveFocusHint", preserveFocusHint);
    return this;
  }

  public JSONObject toJSON() {
    return super.toJSON().put("body", body);
  }
}
