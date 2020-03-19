/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

package com.facebook.nuclide.shim;

import org.eclipse.core.runtime.CoreException;
import org.eclipse.debug.core.ILaunchConfiguration;
import org.eclipse.debug.core.model.IStackFrame;
import org.eclipse.debug.core.sourcelookup.ISourceContainer;
import org.eclipse.debug.core.sourcelookup.ISourceContainerType;
import org.eclipse.debug.core.sourcelookup.ISourceLookupParticipant;
import org.eclipse.debug.core.sourcelookup.ISourcePathComputer;

public abstract class AbstractEclipseSourceLocatorShim
    extends AbstractEclipseShim<IEclipseSourceLocator> implements IEclipseSourceLocator {

  @Override
  public Object getSourceElement(IStackFrame isf) {
    return getProxy().getSourceElement(isf);
  }

  @Override
  public ILaunchConfiguration getLaunchConfiguration() {
    return getProxy().getLaunchConfiguration();
  }

  @Override
  public ISourceLookupParticipant[] getParticipants() {
    return getProxy().getParticipants();
  }

  @Override
  public ISourceContainer[] getSourceContainers() {
    return getProxy().getSourceContainers();
  }

  @Override
  public void setSourceContainers(ISourceContainer[] iscs) {
    getProxy().setSourceContainers(iscs);
  }

  @Override
  public boolean isFindDuplicates() {
    return getProxy().isFindDuplicates();
  }

  @Override
  public void setFindDuplicates(boolean bln) {
    getProxy().setFindDuplicates(bln);
  }

  @Override
  public void initializeParticipants() {
    getProxy().initializeParticipants();
  }

  @Override
  public boolean supportsSourceContainerType(ISourceContainerType isct) {
    return getProxy().supportsSourceContainerType(isct);
  }

  @Override
  public void clearSourceElements(Object o) {
    getProxy().clearSourceElements(o);
  }

  @Override
  public void addParticipants(ISourceLookupParticipant[] islps) {
    getProxy().addParticipants(islps);
  }

  @Override
  public void removeParticipants(ISourceLookupParticipant[] islps) {
    getProxy().removeParticipants(islps);
  }

  @Override
  public String getId() {
    return getProxy().getId();
  }

  @Override
  public ISourcePathComputer getSourcePathComputer() {
    return getProxy().getSourcePathComputer();
  }

  @Override
  public void setSourcePathComputer(ISourcePathComputer ispc) {
    getProxy().setSourcePathComputer(ispc);
  }

  @Override
  public Object[] findSourceElements(Object o) throws CoreException {
    return getProxy().findSourceElements(o);
  }

  @Override
  public Object getSourceElement(Object o) {
    return getProxy().getSourceElement(o);
  }

  @Override
  public void initializeFromMemento(String string, ILaunchConfiguration ilc) throws CoreException {
    getProxy().initializeFromMemento(string, ilc);
  }

  @Override
  public void dispose() {
    getProxy().dispose();
  }

  @Override
  public String getMemento() throws CoreException {
    return getProxy().getMemento();
  }

  @Override
  public void initializeFromMemento(String string) throws CoreException {
    getProxy().initializeFromMemento(string);
  }

  @Override
  public void initializeDefaults(ILaunchConfiguration ilc) throws CoreException {
    getProxy().initializeDefaults(ilc);
  }
}
