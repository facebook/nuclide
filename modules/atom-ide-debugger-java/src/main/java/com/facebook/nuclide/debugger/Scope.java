/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

package com.facebook.nuclide.debugger;

import org.json.JSONObject;

public class Scope {
  public String name;
  public int variablesReference;

  public Scope(String name, int variablesReference) {
    this.name = name;
    this.variablesReference = variablesReference;
  }

  public JSONObject toJSON() {
    return new JSONObject().put("name", name).put("variablesReference", variablesReference);
  }
}
