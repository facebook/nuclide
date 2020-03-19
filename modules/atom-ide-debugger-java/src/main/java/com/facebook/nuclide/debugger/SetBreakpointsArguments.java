/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

package com.facebook.nuclide.debugger;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;
import org.json.JSONArray;
import org.json.JSONObject;

public class SetBreakpointsArguments {
  public Source source;
  public List<SourceBreakpoint> breakpoints;
  public boolean sourceModified;

  public SetBreakpointsArguments(JSONObject arguments) {
    source = new Source(arguments.getJSONObject("source"));
    sourceModified = arguments.optBoolean("sourceModified", false);
    JSONArray breakpointsJSONArray = arguments.optJSONArray("breakpoints");
    breakpoints =
        breakpointsJSONArray != null
            ? Utils.jsonObjectArrayListFrom(breakpointsJSONArray)
                .parallelStream()
                .map(SourceBreakpoint::new)
                .collect(Collectors.toList())
            : new ArrayList<SourceBreakpoint>();
  }
}
