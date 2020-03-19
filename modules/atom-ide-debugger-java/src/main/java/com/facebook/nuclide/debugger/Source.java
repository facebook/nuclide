/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

package com.facebook.nuclide.debugger;

import org.json.JSONObject;

public class Source {
  public String name;
  public String path;

  public Source(JSONObject source) {
    if (source != null) {
      name = source.optString("name");
      path = source.optString("path");
    }
  }

  public Source(String name, String path) {
    this.name = name;
    this.path = path;
  }

  public JSONObject toJSON() {
    return new JSONObject().put("name", name).put("path", path);
  }
}
