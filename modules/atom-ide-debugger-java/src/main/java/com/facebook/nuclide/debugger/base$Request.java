/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

package com.facebook.nuclide.debugger;

import org.json.JSONObject;

public abstract class base$Request extends base$ProtocolMessage {
  public String command;
  public Object arguments;

  public base$Request(String command) {
    super("request");
    this.command = command;
  }

  public base$Request(JSONObject requestJSON) {
    super(requestJSON.getInt("seq"), requestJSON.getString("type"));
    command = requestJSON.getString("command");
  }

  public JSONObject toJSON() {
    return super.toJSON().put("command", command);
  }
}
