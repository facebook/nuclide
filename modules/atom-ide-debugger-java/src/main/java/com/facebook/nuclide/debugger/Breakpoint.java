/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

package com.facebook.nuclide.debugger;

import org.json.JSONObject;

public class Breakpoint {
  public int id;
  public boolean verified;
  public String message;
  public Source source;
  public int line;
  public Integer column;
  public Integer endLine;
  public Integer endColumn;
  public int nuclide_hitCount;

  public Breakpoint(
      int id,
      boolean verified,
      String message,
      Source source,
      int line,
      Integer column,
      Integer endLine,
      Integer endColumn,
      int nuclide_hitCount) {
    this.id = id;
    this.verified = verified;
    this.message = message;
    this.source = source;
    this.line = line;
    this.column = column;
    this.endLine = endLine;
    this.endColumn = endColumn;
    this.nuclide_hitCount = nuclide_hitCount;
  }

  public JSONObject toJSON() {
    JSONObject breakpointAsJSON =
        new JSONObject()
            .put("id", id)
            .put("verified", verified)
            .put("message", message)
            .put("line", line)
            .put("nuclide_hitCount", nuclide_hitCount);
    if (source != null) {
      breakpointAsJSON.put("source", source.toJSON());
    }
    if (column != null) {
      breakpointAsJSON.put("column", column.intValue());
    }
    if (endLine != null) {
      breakpointAsJSON.put("endLine", endLine.intValue());
    }
    if (endColumn != null) {
      breakpointAsJSON.put("endColumn", endColumn.intValue());
    }
    return breakpointAsJSON;
  }
}
