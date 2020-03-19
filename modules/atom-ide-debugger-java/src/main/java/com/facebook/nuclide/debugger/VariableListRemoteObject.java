/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

package com.facebook.nuclide.debugger;

import com.sun.jdi.LocalVariable;
import com.sun.jdi.ObjectReference;
import com.sun.jdi.Value;
import java.util.Map;
import org.json.JSONArray;
import org.json.JSONObject;

/** A remote object that contains a list of variables. */
class VariableListRemoteObject extends RemoteObject {
  private final Map<LocalVariable, Value> _variableValueMap;
  private final String _scopeName;
  private final ObjectReference _thisObj;

  VariableListRemoteObject(
      RemoteObjectManager remoteObjectManager,
      Map<LocalVariable, Value> variableValueMap,
      String scopeName,
      ObjectReference thisObj) {
    super(remoteObjectManager);
    _variableValueMap = variableValueMap;
    _scopeName = scopeName;
    _thisObj = thisObj;
  }

  @Override
  JSONObject getSerializedValue() {
    JSONObject jsonObj = new JSONObject();
    jsonObj.put("type", "object");
    jsonObj.put("objectId", getId());
    jsonObj.put("description", _scopeName);
    return jsonObj;
  }

  @Override
  JSONObject getProperties() {
    JSONArray variableList = new JSONArray();

    if (_thisObj != null) {
      JSONObject thisJson = new JSONObject();
      thisJson.put("name", "this");
      thisJson.put("value", getRemoteObjectManager().serializeValue(_thisObj));
      variableList.put(thisJson);
    }

    for (LocalVariable variable : _variableValueMap.keySet()) {
      Value value = _variableValueMap.get(variable);

      JSONObject variableJson = new JSONObject();
      variableJson.put("name", variable.name());
      variableJson.put("value", getRemoteObjectManager().serializeValue(value));
      variableList.put(variableJson);
    }

    JSONObject resultJson = new JSONObject();
    resultJson.put("result", variableList);
    return resultJson;
  }
}
