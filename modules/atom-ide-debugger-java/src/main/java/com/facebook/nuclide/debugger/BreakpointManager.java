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
import com.sun.jdi.event.ClassPrepareEvent;
import java.util.ArrayList;
import java.util.HashMap;

/**
 * Providing breakpoint management functionality. Threading: access from both request and event
 * threads.
 */
public class BreakpointManager {
  private final ContextManager _contextManager;
  private final Object _breakpointMapLock = new Object();
  // breakpointId -> BreakpointSpec
  private final HashMap<String, BreakpointSpec> _breakpointMap =
      new HashMap<String, BreakpointSpec>();
  // Breakpoint location -> List of breakpoints corresponding to that location.
  private final HashMap<Location, ArrayList<BreakpointSpec>> _breakpointsByFilename =
      new HashMap<Location, ArrayList<BreakpointSpec>>();

  BreakpointManager(ContextManager contextManager) {
    _contextManager = contextManager;
  }

  public void handleClassPrepareEvent(
      ClassPrepareEvent classPrepareEvent, JavaDebuggerServer javaDebuggerServer) {
    ReferenceType loadClass = classPrepareEvent.referenceType();
    String className = loadClass.name();
    synchronized (_breakpointMapLock) {
      for (BreakpointSpec breakpoint : _breakpointMap.values()) {
        breakpoint.resolve(loadClass, className, javaDebuggerServer);
      }
    }
  }

  public String setFileLineBreakpoint(
      String filePath, int line, String packageHint, String condition) {
    // Any files user tries to set breakpoint are potential source search paths.
    _contextManager.getSourceLocator().addPotentialPath(filePath);
    _contextManager
        .getSourceLocator()
        .addPotentialPath(Utils.packageRootPathFromFilePath(filePath, packageHint));
    BreakpointSpec breakpoint =
        new FileLineBreakpointSpec(
            _contextManager,
            new FileLineBreakpointRequestInfo(filePath, line, packageHint),
            condition);
    return addNewBreakpoint(breakpoint);
  }

  public void forceResolveAll() {
    synchronized (_breakpointMapLock) {
      _breakpointMap.values().stream().forEach(BreakpointSpec::enable);
    }
  }

  private String addNewBreakpoint(BreakpointSpec breakpoint) {
    /**
     * TODO: currently client IDE prevents duplicate breakpoint request to be sent to backend, but
     * we should deal with duplicate breakpoint in future.
     */
    breakpoint.enable();
    synchronized (_breakpointMapLock) {
      _breakpointMap.putIfAbsent(breakpoint.getId(), breakpoint);
    }
    return breakpoint.getId();
  }

  public BreakpointSpec getBreakpointFromId(String breakpointId) {
    synchronized (_breakpointMapLock) {
      return _breakpointMap.get(breakpointId);
    }
  }

  public void removeBreakpoint(String breakpointId) {
    synchronized (_breakpointMapLock) {
      BreakpointSpec breakpoint = _breakpointMap.get(breakpointId);
      if (breakpoint != null) {
        breakpoint.clear();
        _breakpointMap.remove(breakpointId);
      } else {
        // TODO: throw exception?
      }
    }
  }

  public void addResolvedBreakpoint(BreakpointSpec breakpoint, Location location) {
    synchronized (_breakpointMapLock) {
      ArrayList<BreakpointSpec> breakpoints = _breakpointsByFilename.get(location);
      if (breakpoints == null) {
        breakpoints = new ArrayList<BreakpointSpec>();
        _breakpointsByFilename.put(location, breakpoints);
      }

      breakpoints.add(breakpoint);
    }
  }

  public void removeResolvedBreakpoint(BreakpointSpec breakpoint, Location location) {
    synchronized (_breakpointMapLock) {
      ArrayList<BreakpointSpec> breakpoints = _breakpointsByFilename.get(location);
      if (breakpoints != null) {
        breakpoints.remove(breakpoint);
        if (breakpoints.isEmpty()) {
          _breakpointsByFilename.remove(location);
        }
      }
    }
  }

  public ArrayList<BreakpointSpec> getBreakpointsAtLocation(Location location) {
    synchronized (_breakpointMapLock) {
      ArrayList<BreakpointSpec> breakpointsAtLocation = _breakpointsByFilename.get(location);
      return breakpointsAtLocation != null
          ? new ArrayList<BreakpointSpec>(breakpointsAtLocation)
          : new ArrayList<BreakpointSpec>();
    }
  }
}
