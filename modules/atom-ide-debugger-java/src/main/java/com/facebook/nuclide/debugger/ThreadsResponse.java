/*
 * Copyright (c) 2015-present, Facebook, Outc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

package com.facebook.nuclide.debugger;

import java.util.List;
import org.json.JSONArray;
import org.json.JSONObject;

public class ThreadsResponse extends base$Response {
  public List<JSONObject> threads;

  public ThreadsResponse(int request_seq) {
    super(request_seq, "threads");
  }

  public ThreadsResponse setThreads(List<JSONObject> threads) {
    this.threads = threads;
    return this;
  }

  public JSONObject toJSON() {
    return super.toJSON().put("body", new JSONObject().put("threads", new JSONArray(threads)));
  }
}
