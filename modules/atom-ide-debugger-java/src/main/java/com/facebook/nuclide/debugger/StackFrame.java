/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

package com.facebook.nuclide.debugger;

import org.json.JSONObject;

public class StackFrame {
  public int id;
  public String name;
  public Source source;
  public int line;
  public int column;

  public StackFrame(int id, String name, Source source, int line, int column) {
    this.id = id;
    this.name = name;
    this.source = source;
    this.line = line;
    this.column = column;
  }

  public JSONObject toJSON() {
    return new JSONObject()
        .put("id", id)
        .put("name", name)
        .put("source", source.toJSON())
        .put("line", line)
        .put("column", column);
  }
}
