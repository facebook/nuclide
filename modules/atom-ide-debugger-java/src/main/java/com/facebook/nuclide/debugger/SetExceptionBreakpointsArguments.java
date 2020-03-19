/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

package com.facebook.nuclide.debugger;

import java.util.ArrayList;
import org.json.JSONArray;
import org.json.JSONObject;

public class SetExceptionBreakpointsArguments {
  public ArrayList<String> filters;
  public JSONArray exceptionOptions;

  public SetExceptionBreakpointsArguments(JSONObject arguments) {
    exceptionOptions = arguments.optJSONArray("exceptionOptions");
    JSONArray filtersJSONArray = arguments.getJSONArray("filters");
    filters = Utils.stringArrayListFrom(filtersJSONArray);
  }
}
