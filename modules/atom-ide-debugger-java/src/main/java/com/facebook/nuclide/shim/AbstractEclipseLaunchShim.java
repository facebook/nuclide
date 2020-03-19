/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

package com.facebook.nuclide.shim;

import org.eclipse.debug.core.DebugException;
import org.eclipse.debug.core.ILaunch;
import org.eclipse.debug.core.ILaunchConfiguration;
import org.eclipse.debug.core.model.IDebugTarget;
import org.eclipse.debug.core.model.IProcess;
import org.eclipse.debug.core.model.ISourceLocator;

public abstract class AbstractEclipseLaunchShim extends AbstractEclipseShim<ILaunch>
    implements ILaunch {

  @Override
  public Object[] getChildren() {
    return getProxy().getChildren();
  }

  @Override
  public IDebugTarget getDebugTarget() {
    return getProxy().getDebugTarget();
  }

  @Override
  public IProcess[] getProcesses() {
    return getProxy().getProcesses();
  }

  @Override
  public IDebugTarget[] getDebugTargets() {
    return getProxy().getDebugTargets();
  }

  @Override
  public void addDebugTarget(IDebugTarget idt) {
    getProxy().addDebugTarget(idt);
  }

  @Override
  public void removeDebugTarget(IDebugTarget idt) {
    getProxy().removeDebugTarget(idt);
  }

  @Override
  public void addProcess(IProcess ip) {
    getProxy().addProcess(ip);
  }

  @Override
  public void removeProcess(IProcess ip) {
    getProxy().removeProcess(ip);
  }

  @Override
  public ISourceLocator getSourceLocator() {
    return getProxy().getSourceLocator();
  }

  @Override
  public void setSourceLocator(ISourceLocator isl) {
    getProxy().setSourceLocator(isl);
  }

  @Override
  public String getLaunchMode() {
    return getProxy().getLaunchMode();
  }

  @Override
  public ILaunchConfiguration getLaunchConfiguration() {
    return getProxy().getLaunchConfiguration();
  }

  @Override
  public void setAttribute(String string, String string1) {
    getProxy().setAttribute(string, string1);
  }

  @Override
  public String getAttribute(String string) {
    return getProxy().getAttribute(string);
  }

  @Override
  public boolean hasChildren() {
    return getProxy().hasChildren();
  }

  @Override
  public boolean canTerminate() {
    return getProxy().canTerminate();
  }

  @Override
  public boolean isTerminated() {
    return getProxy().isTerminated();
  }

  @Override
  public void terminate() throws DebugException {
    getProxy().terminate();
  }

  @Override
  public <T> T getAdapter(Class<T> type) {
    return getProxy().getAdapter(type);
  }
}
