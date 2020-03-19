/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

package com.facebook.nuclide.debugger;

import org.json.JSONObject;

public abstract class base$Response extends base$ProtocolMessage {
  public int request_seq;
  public boolean success;
  public String command;
  private String message;

  public base$Response(int request_seq, String command) {
    super("response");
    this.request_seq = request_seq;
    this.command = command;
    this.success = true;
    this.message = "";
  }

  public base$Response(JSONObject responseJSON) {
    super(responseJSON);
    this.request_seq = responseJSON.getInt("request_seq");
    this.command = responseJSON.getString("command");
    this.success = responseJSON.getBoolean("success");
    this.message = responseJSON.optString("message");
  }

  public base$Response setSuccess(boolean success) {
    this.success = success;
    return this;
  }

  public base$Response setMessage(String message) {
    this.message = message;
    return this;
  }

  public JSONObject toJSON() {
    return super.toJSON()
        .put("request_seq", request_seq)
        .put("command", command)
        .put("success", success)
        .put("message", message);
  }
}
