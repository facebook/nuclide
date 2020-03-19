/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

package com.facebook.nuclide.debugger;

import com.sun.jdi.Location;
import com.sun.jdi.ReferenceType;
import com.sun.jdi.VirtualMachine;
import com.sun.jdi.request.BreakpointRequest;
import com.sun.jdi.request.EventRequest;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.json.JSONObject;

/**
 * Abstract base class for all breakpoints. Threading: access from both request and event threads.
 */
public abstract class BreakpointSpec {
  private static int _breakpointIdSeed = 0;
  private final String _breakpointId;
  private final int _breakpointIdAsInt;
  private final ContextManager _contextManager;
  private volatile Optional<Location> _boundLocation = Optional.empty();
  private final Object _breakpointRequestsLock = new Object();
  private final List<BreakpointRequest> _breakpointRequests = new ArrayList<>();
  private final String _condition;
  private int _hitCount = 0;

  public BreakpointSpec(ContextManager contextManager, String condition) {
    _breakpointIdAsInt = getAndIncrementBreakpointIdSeed();
    _breakpointId = String.format("BreakpointSpec.%d", _breakpointIdAsInt);
    _contextManager = contextManager;
    _condition = condition;
  }

  private static synchronized int getAndIncrementBreakpointIdSeed() {
    return ++_breakpointIdSeed;
  }

  /** Used by debugger UI to remote unique identify this breakpoint. */
  public String getId() {
    return _breakpointId;
  }

  public int getIdAsInt() {
    return _breakpointIdAsInt;
  }

  public String getCondition() {
    return _condition;
  }

  protected final ContextManager getContextManager() {
    return _contextManager;
  }

  /** Whether this breakpoint is resolved or not. */
  public boolean isResolved() {
    return _boundLocation.isPresent();
  }

  public int getHitCount() {
    return _hitCount;
  }

  public int incrementHitCount() {
    return ++_hitCount;
  }

  public Optional<Location> getBoundLocation() {
    return _boundLocation;
  }

  public void clear() {
    synchronized (_breakpointRequestsLock) {
      getContextManager()
          .getVirtualMachine()
          .eventRequestManager()
          .deleteEventRequests(_breakpointRequests);
      if (isResolved()) {
        getContextManager()
            .getBreakpointManager()
            .removeResolvedBreakpoint(this, getBoundLocation().get());
      }
      _breakpointRequests.clear();
    }
  }

  /** Resolve the breakpoint immediately in current loaded classes list. */
  protected void resolveImmediate(String className) {
    VirtualMachine vm = getContextManager().getVirtualMachine();
    if (vm == null) {
      // Haven't start debugging yet.
      return;
    }

    List<ReferenceType> matchClasses = vm.classesByName(className);
    for (ReferenceType type : matchClasses) {
      resolveForClass(type, false, null);
    }
  }

  private boolean resolveForClass(
      ReferenceType clazz, boolean sendNotification, JavaDebuggerServer javaDebuggerServer) {
    Optional<Location> location = getMatchLocationFromClass(clazz);
    if (!location.isPresent()) {
      return false;
    }
    _boundLocation = location;
    handleBreakpointResolved();

    BreakpointRequest breakpointRequest =
        getContextManager()
            .getVirtualMachine()
            .eventRequestManager()
            .createBreakpointRequest(location.get());
    breakpointRequest.setSuspendPolicy(EventRequest.SUSPEND_ALL);
    breakpointRequest.enable();
    synchronized (_breakpointRequestsLock) {
      _breakpointRequests.add(breakpointRequest);
    }
    if (sendNotification) {
      if (javaDebuggerServer != null) {
        javaDebuggerServer.sendBreakpointEvent(
            this, true /* verified */, Utils.BreakpointEventReasons.CHANGED);
      } else {
        sendBreakpointResolvedNotification();
      }
    }
    return true;
  }

  /** Notify debugger UI this breakpoint is resolved to certain location. */
  private void sendBreakpointResolvedNotification() {
    JSONObject params = new JSONObject();
    params.put("breakpointId", getId());
    params.put("location", getLocationJson());

    JSONObject messageJson = new JSONObject();
    messageJson.put("method", "Debugger.breakpointResolved");
    messageJson.put("params", params);

    getContextManager().getNotificationChannel().send(messageJson.toString());
  }

  /** Resolve the breakpoint for input class if possible. Threading: called by event thread. */
  public void resolve(
      ReferenceType clazz, String className, JavaDebuggerServer javaDebuggerServer) {
    if (doesClassMatchBreakpoint(className)) {
      // TODO: guard it into a debug switch
      resolveForClass(clazz, true /*sendNotification*/, javaDebuggerServer);
    }
  }

  /** Enable this breakpoint. */
  public abstract void enable();

  /** Returns resolved breakpoint physical location for input class. */
  protected abstract Optional<Location> getMatchLocationFromClass(ReferenceType clazz);

  /** Called when this breakpoint is resolved. */
  protected void handleBreakpointResolved() {}

  /** Get the location info in json format. */
  public abstract JSONObject getLocationJson();

  /** Get breakpoint line. */
  public abstract int getLine();

  /** Determines if the specified class matches this breakpoint */
  protected abstract boolean doesClassMatchBreakpoint(String className);
}
