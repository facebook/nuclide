/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

package com.facebook.nuclide.shim;

import com.facebook.nuclide.debugger.Utils;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;
import java.util.HashMap;
import java.util.Map;

public abstract class AbstractEclipseShim<T> {

  private static final Map<Class<?>, Object> DEFAULT_VALUES;

  static {
    DEFAULT_VALUES = new HashMap<>();

    addDefaultValue(boolean.class, false);
    addDefaultValue(byte.class, (byte) 0);
    addDefaultValue(short.class, (short) 0);
    addDefaultValue(int.class, 0);
    addDefaultValue(long.class, 0l);
    addDefaultValue(float.class, 0f);
    addDefaultValue(double.class, 0d);
    addDefaultValue(char.class, (char) 0);
  }

  private static <T> void addDefaultValue(Class<T> clazz, T value) {
    // Method for compile-time type safety
    DEFAULT_VALUES.put(clazz, value);
  }

  private final T proxy;

  protected AbstractEclipseShim() {
    proxy =
        (T)
            Proxy.newProxyInstance(
                getClass().getClassLoader(),
                getClass().getInterfaces(),
                (Object proxy1, Method method, Object[] args) -> {
                  StringBuilder message = new StringBuilder();
                  message
                      .append("Proxy for ")
                      .append(getClass().getName())
                      .append(" has been called without an implementation for method ")
                      .append(method);

                  if (args.length > 0) {
                    message.append(" with arguments: {");
                    for (Object arg : args) {
                      message.append(arg);
                      message.append(", ");
                    }

                    message.setLength(message.length() - 2);
                    message.append("}");
                  }
                  message.append(System.lineSeparator());
                  try {
                    // Grab a stack trace so we know where this happened.
                    throw new UnsupportedOperationException();
                  } catch (UnsupportedOperationException ex) {
                    Utils.logException(message.toString(), ex);
                  }

                  return DEFAULT_VALUES.get(method.getReturnType());
                });
  }

  protected T getProxy() {
    return proxy;
  }
}
