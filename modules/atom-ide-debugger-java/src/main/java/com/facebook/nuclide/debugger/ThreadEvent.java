/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

package com.facebook.nuclide.debugger;

import org.json.JSONObject;

public class ThreadEvent extends base$Event {
  private JSONObject body;

  public ThreadEvent() {
    super("thread");
    body = new JSONObject();
  }

  public ThreadEvent setReason(String reason) {
    body.put("reason", reason);
    return this;
  }

  public ThreadEvent setThreadId(long threadId) {
    body.put("threadId", threadId);
    return this;
  }

  public JSONObject toJSON() {
    return super.toJSON().put("body", body);
  }
}
