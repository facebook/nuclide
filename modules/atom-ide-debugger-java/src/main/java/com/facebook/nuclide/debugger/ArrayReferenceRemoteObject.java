/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

package com.facebook.nuclide.debugger;

import com.sun.jdi.ArrayReference;
import com.sun.jdi.PrimitiveValue;
import com.sun.jdi.Value;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONObject;

/** A remote object that represents array reference in VM. */
class ArrayReferenceRemoteObject extends RemoteObject {
  private final ArrayReference _arrayReference;
  private final int MAX_ARRAY_PREVIEW_ITEMS = 10;

  ArrayReferenceRemoteObject(
      RemoteObjectManager remoteObjectManager, ArrayReference arrayReference) {
    super(remoteObjectManager);
    _arrayReference = arrayReference;
  }

  @Override
  JSONObject getSerializedValue() {
    JSONObject jsonObj = new JSONObject();
    jsonObj.put("type", "object");
    jsonObj.put("subtype", "array");
    jsonObj.put("objectId", getId());
    jsonObj.put("description", getObjectDescription());
    return jsonObj;
  }

  private String getObjectDescription() {
    return "Array[" + _arrayReference.length() + "]" + getArrayPreview();
  }

  private String getArrayPreview() {
    if (_arrayReference.length() == 0) {
      return "";
    }

    Value val = _arrayReference.getValue(0);
    if (!(val instanceof PrimitiveValue)) {
      // ObjectReference types are too verbose to preview in the space available in the UI.
      return "";
    }

    StringBuilder sb = new StringBuilder(" ([");
    int arrayLength = _arrayReference.length();
    for (int i = 0; i < Math.min(arrayLength, MAX_ARRAY_PREVIEW_ITEMS); i++) {
      sb.append(_arrayReference.getValue(i).toString());
      if (i < arrayLength - 1) {
        sb.append(", ");
      }
    }

    if (arrayLength > MAX_ARRAY_PREVIEW_ITEMS) {
      sb.append("...");
    }

    sb.append("])");
    return sb.toString();
  }

  @Override
  JSONObject getProperties() {
    JSONArray itemsList = new JSONArray();
    List<Value> arrayValues = _arrayReference.getValues();
    for (int i = 0; i < arrayValues.size(); ++i) {
      JSONObject itemJson = new JSONObject();
      itemJson.put("name", String.format("[%d]", i));
      itemJson.put("value", getRemoteObjectManager().serializeValue(arrayValues.get(i)));
      itemsList.put(itemJson);
    }

    JSONObject resultJson = new JSONObject();
    resultJson.put("result", itemsList);
    return resultJson;
  }
}
