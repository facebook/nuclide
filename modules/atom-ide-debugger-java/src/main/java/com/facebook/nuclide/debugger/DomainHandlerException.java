/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

package com.facebook.nuclide.debugger;

/** Base class for all domain specific exceptions. */
public class DomainHandlerException extends Exception {
  public DomainHandlerException(String message) {
    super(message);
  }

  public DomainHandlerException(String message, Throwable cause) {
    super(message, cause);
  }
}
