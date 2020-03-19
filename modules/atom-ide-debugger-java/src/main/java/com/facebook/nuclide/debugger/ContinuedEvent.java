/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

package com.facebook.nuclide.debugger;

import org.json.JSONObject;

public class ContinuedEvent extends base$Event {
  private JSONObject body;

  public ContinuedEvent() {
    super("continued");
    body = new JSONObject();
  }

  public ContinuedEvent setThreadId(long threadId) {
    body.put("threadId", threadId);
    return this;
  }

  public ContinuedEvent setAllThreadsContinued(boolean allThreadsContinued) {
    body.put("allThreadsContinued", allThreadsContinued);
    return this;
  }

  public JSONObject toJSON() {
    return super.toJSON().put("body", body);
  }
}
