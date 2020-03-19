/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

package com.facebook.nuclide.debugger;

import org.json.JSONObject;

abstract class DomainHandlerBase {
  private final String _domainName;
  private final ContextManager _contextManager;

  DomainHandlerBase(String domain, ContextManager contextManager) {
    _domainName = domain;
    _contextManager = contextManager;
  }

  protected String getDomainName() {
    return _domainName;
  }

  public ContextManager getContextManager() {
    return _contextManager;
  }

  protected void throwUndefinedMethodException(String method)
      throws UndefinedHandlerMethodException {
    String message = String.format("Undefined method: %s.%s", _domainName, method);
    throw new UndefinedHandlerMethodException(message);
  }

  abstract JSONObject handleMethod(String id, String methodName, JSONObject params)
      throws DomainHandlerException;
}
