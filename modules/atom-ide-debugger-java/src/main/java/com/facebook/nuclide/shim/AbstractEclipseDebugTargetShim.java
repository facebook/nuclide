/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

package com.facebook.nuclide.shim;

import org.eclipse.core.resources.IMarkerDelta;
import org.eclipse.debug.core.DebugException;
import org.eclipse.debug.core.ILaunch;
import org.eclipse.debug.core.model.IBreakpoint;
import org.eclipse.debug.core.model.IDebugTarget;
import org.eclipse.debug.core.model.IMemoryBlock;
import org.eclipse.debug.core.model.IProcess;
import org.eclipse.debug.core.model.IThread;
import org.eclipse.jdt.debug.core.IJavaDebugTarget;
import org.eclipse.jdt.debug.core.IJavaHotCodeReplaceListener;
import org.eclipse.jdt.debug.core.IJavaThreadGroup;
import org.eclipse.jdt.debug.core.IJavaType;
import org.eclipse.jdt.debug.core.IJavaValue;
import org.eclipse.jdt.debug.core.IJavaVariable;

public abstract class AbstractEclipseDebugTargetShim extends AbstractEclipseShim<IJavaDebugTarget>
    implements IJavaDebugTarget {

  @Override
  public void setStepFiltersEnabled(boolean bln) {
    getProxy().setStepFiltersEnabled(bln);
  }

  @Override
  public boolean isStepFiltersEnabled() {
    return getProxy().isStepFiltersEnabled();
  }

  @Override
  public boolean supportsStepFilters() {
    return getProxy().supportsStepFilters();
  }

  @Override
  public IMemoryBlock getMemoryBlock(long l, long l1) throws DebugException {
    return getProxy().getMemoryBlock(l, l1);
  }

  @Override
  public boolean supportsStorageRetrieval() {
    return getProxy().supportsStorageRetrieval();
  }

  @Override
  public boolean isDisconnected() {
    return getProxy().isDisconnected();
  }

  @Override
  public void disconnect() throws DebugException {
    getProxy().disconnect();
  }

  @Override
  public boolean canDisconnect() {
    return getProxy().canDisconnect();
  }

  @Override
  public void breakpointChanged(IBreakpoint ib, IMarkerDelta imd) {
    getProxy().breakpointChanged(ib, imd);
  }

  @Override
  public void breakpointRemoved(IBreakpoint ib, IMarkerDelta imd) {
    getProxy().breakpointRemoved(ib, imd);
  }

  @Override
  public void breakpointAdded(IBreakpoint ib) {
    getProxy().breakpointAdded(ib);
  }

  @Override
  public void suspend() throws DebugException {
    getProxy().suspend();
  }

  @Override
  public void resume() throws DebugException {
    getProxy().resume();
  }

  @Override
  public boolean isSuspended() {
    return getProxy().isSuspended();
  }

  @Override
  public boolean canSuspend() {
    return getProxy().canSuspend();
  }

  @Override
  public boolean canResume() {
    return getProxy().canResume();
  }

  @Override
  public void terminate() throws DebugException {
    getProxy().terminate();
  }

  @Override
  public boolean isTerminated() {
    return getProxy().isTerminated();
  }

  @Override
  public boolean canTerminate() {
    return getProxy().canTerminate();
  }

  @Override
  public <T> T getAdapter(Class<T> type) {
    return getProxy().getAdapter(type);
  }

  @Override
  public ILaunch getLaunch() {
    return getProxy().getLaunch();
  }

  @Override
  public IDebugTarget getDebugTarget() {
    return getProxy().getDebugTarget();
  }

  @Override
  public String getModelIdentifier() {
    return getProxy().getModelIdentifier();
  }

  @Override
  public boolean supportsBreakpoint(IBreakpoint ib) {
    return getProxy().supportsBreakpoint(ib);
  }

  @Override
  public String getName() throws DebugException {
    return getProxy().getName();
  }

  @Override
  public boolean hasThreads() throws DebugException {
    return getProxy().hasThreads();
  }

  @Override
  public IThread[] getThreads() throws DebugException {
    return getProxy().getThreads();
  }

  @Override
  public IProcess getProcess() {
    return getProxy().getProcess();
  }

  @Override
  public void removeHotCodeReplaceListener(IJavaHotCodeReplaceListener il) {
    getProxy().removeHotCodeReplaceListener(il);
  }

  @Override
  public void addHotCodeReplaceListener(IJavaHotCodeReplaceListener il) {
    getProxy().addHotCodeReplaceListener(il);
  }

  @Override
  public byte[] sendCommand(byte b, byte b1, byte[] bytes) throws DebugException {
    return getProxy().sendCommand(b, b1, bytes);
  }

  @Override
  public void refreshState() throws DebugException {
    getProxy().refreshState();
  }

  @Override
  public String getVersion() throws DebugException {
    return getProxy().getVersion();
  }

  @Override
  public String getVMName() throws DebugException {
    return getProxy().getVMName();
  }

  @Override
  public boolean supportsSelectiveGarbageCollection() {
    return getProxy().supportsSelectiveGarbageCollection();
  }

  @Override
  public boolean supportsForceReturn() {
    return getProxy().supportsForceReturn();
  }

  @Override
  public boolean supportsInstanceRetrieval() {
    return getProxy().supportsInstanceRetrieval();
  }

  @Override
  public IJavaThreadGroup[] getAllThreadGroups() throws DebugException {
    return getProxy().getAllThreadGroups();
  }

  @Override
  public IJavaThreadGroup[] getRootThreadGroups() throws DebugException {
    return getProxy().getRootThreadGroups();
  }

  @Override
  public String getDefaultStratum() {
    return getProxy().getDefaultStratum();
  }

  @Override
  public void setDefaultStratum(String string) {
    getProxy().setDefaultStratum(string);
  }

  @Override
  public boolean supportsModificationWatchpoints() {
    return getProxy().supportsModificationWatchpoints();
  }

  @Override
  public boolean supportsAccessWatchpoints() {
    return getProxy().supportsAccessWatchpoints();
  }

  @Override
  public boolean supportsMonitorInformation() {
    return getProxy().supportsMonitorInformation();
  }

  @Override
  public int getRequestTimeout() {
    return getProxy().getRequestTimeout();
  }

  @Override
  public void setRequestTimeout(int i) {
    getProxy().setRequestTimeout(i);
  }

  @Override
  public boolean supportsRequestTimeout() {
    return getProxy().supportsRequestTimeout();
  }

  @Override
  public boolean isStepThruFilters() {
    return getProxy().isStepThruFilters();
  }

  @Override
  public void setStepThruFilters(boolean bln) {
    getProxy().setStepThruFilters(bln);
  }

  @Override
  public void setStepFilters(String[] strings) {
    getProxy().setStepFilters(strings);
  }

  @Override
  public String[] getStepFilters() {
    return getProxy().getStepFilters();
  }

  @Override
  public void setFilterConstructors(boolean bln) {
    getProxy().setFilterConstructors(bln);
  }

  @Override
  public boolean isFilterConstructors() {
    return getProxy().isFilterConstructors();
  }

  @Override
  public void setFilterStaticInitializers(boolean bln) {
    getProxy().setFilterStaticInitializers(bln);
  }

  @Override
  public boolean isFilterStaticInitializers() {
    return getProxy().isFilterStaticInitializers();
  }

  @Override
  public void setFilterSetters(boolean bln) {
    getProxy().setFilterSetters(bln);
  }

  @Override
  public boolean isFilterSetters() {
    return getProxy().isFilterSetters();
  }

  @Override
  public void setFilterGetters(boolean bln) {
    getProxy().setFilterGetters(bln);
  }

  @Override
  public boolean isFilterGetters() {
    return getProxy().isFilterGetters();
  }

  @Override
  public void setFilterSynthetics(boolean bln) {
    getProxy().setFilterSynthetics(bln);
  }

  @Override
  public boolean isFilterSynthetics() {
    return getProxy().isFilterSynthetics();
  }

  @Override
  public boolean supportsInstanceBreakpoints() {
    return getProxy().supportsInstanceBreakpoints();
  }

  @Override
  public boolean isPerformingHotCodeReplace() {
    return getProxy().isPerformingHotCodeReplace();
  }

  @Override
  public boolean supportsHotCodeReplace() {
    return getProxy().supportsHotCodeReplace();
  }

  @Override
  public boolean mayBeOutOfSynch() throws DebugException {
    return getProxy().mayBeOutOfSynch();
  }

  @Override
  public boolean isOutOfSynch() throws DebugException {
    return getProxy().isOutOfSynch();
  }

  @Override
  public IJavaValue voidValue() {
    return getProxy().voidValue();
  }

  @Override
  public IJavaValue nullValue() {
    return getProxy().nullValue();
  }

  @Override
  public IJavaValue newValue(String string) {
    return getProxy().newValue(string);
  }

  @Override
  public IJavaValue newValue(short s) {
    return getProxy().newValue(s);
  }

  @Override
  public IJavaValue newValue(long l) {
    return getProxy().newValue(l);
  }

  @Override
  public IJavaValue newValue(int i) {
    return getProxy().newValue(i);
  }

  @Override
  public IJavaValue newValue(float f) {
    return getProxy().newValue(f);
  }

  @Override
  public IJavaValue newValue(double d) {
    return getProxy().newValue(d);
  }

  @Override
  public IJavaValue newValue(char c) {
    return getProxy().newValue(c);
  }

  @Override
  public IJavaValue newValue(byte b) {
    return getProxy().newValue(b);
  }

  @Override
  public IJavaValue newValue(boolean bln) {
    return getProxy().newValue(bln);
  }

  @Override
  public IJavaType[] getJavaTypes(String string) throws DebugException {
    return getProxy().getJavaTypes(string);
  }

  @Override
  public IJavaVariable findVariable(String string) throws DebugException {
    return getProxy().findVariable(string);
  }
}
