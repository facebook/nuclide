/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

package com.facebook.nuclide.debugger;

import java.util.List;
import org.json.JSONArray;
import org.json.JSONObject;

public class RunInTerminalRequest extends base$Request {
  public JSONObject arguments;

  public RunInTerminalRequest(boolean integratedOrExternal) {
    super("runInTerminal");
    arguments = new JSONObject();
    // Java Debugger does not currently support external terminal
    arguments.put("kind", integratedOrExternal ? "integrated" : "external");
  }

  public RunInTerminalRequest setTitle(String title) {
    arguments.put("title", title);
    return this;
  }

  public RunInTerminalRequest setCWD(String cwd) {
    arguments.put("cwd", cwd);
    return this;
  }

  public RunInTerminalRequest setEnv(JSONObject env) {
    arguments.put("env", env);
    return this;
  }

  public RunInTerminalRequest setArgs(List<String> args) {
    arguments.put("args", new JSONArray(args));
    return this;
  }

  public JSONObject toJSON() {
    return super.toJSON().put("arguments", arguments);
  }
}
