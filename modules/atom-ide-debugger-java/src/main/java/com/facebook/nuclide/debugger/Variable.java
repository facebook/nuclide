/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

package com.facebook.nuclide.debugger;

import org.json.JSONObject;

public class Variable {
  public String name;
  public String value;
  public String type;
  public int variablesReference;
  public boolean valuesWereSet;

  public Variable(JSONObject property) {
    JSONObject value = property.getJSONObject("value");
    String subtype = value.optString("subtype", "");
    String objectId = value.optString("objectId", "");
    int variablesReference =
        !objectId.isEmpty() ? Integer.parseInt(objectId.substring(objectId.indexOf(".") + 1)) : 0;
    this.setValues(
        property.getString("name"),
        value.getString("description"),
        !subtype.isEmpty() ? subtype : value.getString("type"),
        variablesReference);
  }

  public Variable(String name, String value, String type, int variablesReference) {
    this.setValues(name, value, type, variablesReference);
  }

  public Variable setValues(String name, String value, String type, int variablesReference) {
    this.name = name;
    this.value = value;
    this.type = type;
    this.variablesReference = variablesReference;
    return this;
  }

  public String getName() {
    return name;
  }

  public JSONObject toJSON() {
    return new JSONObject()
        .put("name", name)
        .put("value", value)
        .put("type", type)
        .put("variablesReference", variablesReference);
  }
}
