/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

package com.facebook.nuclide.debugger;

import org.json.JSONObject;

/** Implements Nuclide runtime domain protocols. */
public class RuntimeDomain extends DomainHandlerBase {
  RuntimeDomain(ContextManager contextManager) {
    super("Runtime", contextManager);
  }

  @Override
  JSONObject handleMethod(String id, String methodName, JSONObject params)
      throws DomainHandlerException {
    JSONObject result = new JSONObject();
    switch (methodName) {
      case "getProperties":
        result = getProperties(String.valueOf(params.get("objectId")));
        break;

      default:
        throwUndefinedMethodException(methodName);
        break;
    }
    return result;
  }

  private JSONObject getProperties(String objectId) {
    return getContextManager().getRemoteObjectManager().getObject(objectId).getProperties();
  }
}
