/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

package com.facebook.nuclide.debugger;

import com.sun.jdi.request.EventRequest;
import com.sun.jdi.request.EventRequestManager;
import com.sun.jdi.request.ExceptionRequest;

public class ExceptionManager {
  private enum ExceptionTypes {
    NONE,
    ALL,
    CAUGHT,
    UNCAUGHT
  };

  private final ContextManager _contextManager;
  private ExceptionTypes _previousExceptionTypes = ExceptionTypes.NONE;

  public ExceptionManager(ContextManager contextManager) {
    _contextManager = contextManager;
  }

  private ExceptionTypes parseExceptionType(String state) {
    ExceptionTypes types;
    switch (state) {
      case "all":
        types = ExceptionTypes.ALL;
        break;
      case "caught":
        types = ExceptionTypes.CAUGHT;
        break;
      case "uncaught":
        types = ExceptionTypes.UNCAUGHT;
        break;
      case "none":
        types = ExceptionTypes.NONE;
        break;

      default:
        throw new IllegalArgumentException(state);
    }

    return types;
  }

  public void setPauseOnExceptions(String state) {
    ExceptionTypes types = parseExceptionType(state);
    EventRequestManager eventManager = _contextManager.getVirtualMachine().eventRequestManager();

    if (types != _previousExceptionTypes) {
      _previousExceptionTypes = types;

      // Delete any previous exception event requests.
      eventManager.deleteEventRequests(eventManager.exceptionRequests());

      if (types != ExceptionTypes.NONE) {
        // Create a new request.
        // TODO: Enable filtering by exception class.
        ExceptionRequest exceptionRequest =
            eventManager.createExceptionRequest(
                null,
                types == ExceptionTypes.ALL || types == ExceptionTypes.CAUGHT, // notifyCaught
                types == ExceptionTypes.ALL || types == ExceptionTypes.UNCAUGHT // notifyUncaught
                );
        exceptionRequest.setSuspendPolicy(EventRequest.SUSPEND_ALL);
        exceptionRequest.enable();
      }
    }
  }
}
