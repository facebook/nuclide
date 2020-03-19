/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

package com.facebook.nuclide.shim;

import com.sun.jdi.ClassType;
import com.sun.jdi.Method;
import com.sun.jdi.ObjectReference;
import com.sun.jdi.ThreadReference;
import com.sun.jdi.Value;
import java.util.List;
import org.eclipse.debug.core.DebugException;
import org.eclipse.jdt.internal.debug.core.model.JDIThread;

// This implements a shim for JDIThread by extending it and implementing the bare
// minium functionality needed for performing evals() that invoke function calls
// and create new reference types.
// NOTE: We cannot shim this using just the IThread interface like the others because
// the eclipse interpreter is casting to the concrete JDIThread implementation on
// critical paths that we need to use.
public class EclipseJDIThreadShim extends JDIThread {
  private boolean _invokeInProgress = false;

  public EclipseJDIThreadShim(ThreadReference thread) {
    super(null, thread);
  }

  @Override
  protected void initialize() {
    setTerminated(false);
    setRunning(false);
  }

  public ObjectReference createNewInstance(
      ClassType receiverClass, Method constructor, List<? extends Value> args)
      throws DebugException {

    return super.newInstance(receiverClass, constructor, args);
  }

  public void setInvokeInProgress(boolean invoking) {
    _invokeInProgress = invoking;
  }

  public boolean getInvokeInProgress() {
    return _invokeInProgress;
  }
}
