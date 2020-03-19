/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

package com.facebook.nuclide.shim;

import java.io.InputStream;
import java.io.OutputStream;
import org.eclipse.core.runtime.CoreException;
import org.eclipse.core.runtime.IStatus;
import org.eclipse.core.runtime.preferences.IEclipsePreferences;
import org.eclipse.core.runtime.preferences.IExportedPreferences;
import org.eclipse.core.runtime.preferences.IPreferenceFilter;
import org.eclipse.core.runtime.preferences.IPreferencesService;
import org.eclipse.core.runtime.preferences.IScopeContext;
import org.osgi.service.prefs.Preferences;

public abstract class AbstractEclipsePreferencesServiceShim
    extends AbstractEclipseShim<IPreferencesService> implements IPreferencesService {

  @Override
  public String get(String string, String string1, Preferences[] ps) {
    return getProxy().get(string, string1, ps);
  }

  @Override
  public boolean getBoolean(String string, String string1, boolean bln, IScopeContext[] iscs) {
    return getProxy().getBoolean(string, string1, bln, iscs);
  }

  @Override
  public byte[] getByteArray(String string, String string1, byte[] bytes, IScopeContext[] iscs) {
    return getProxy().getByteArray(string, string1, bytes, iscs);
  }

  @Override
  public double getDouble(String string, String string1, double d, IScopeContext[] iscs) {
    return getProxy().getDouble(string, string1, d, iscs);
  }

  @Override
  public float getFloat(String string, String string1, float f, IScopeContext[] iscs) {
    return getProxy().getFloat(string, string1, f, iscs);
  }

  @Override
  public int getInt(String string, String string1, int i, IScopeContext[] iscs) {
    return getProxy().getInt(string, string1, i, iscs);
  }

  @Override
  public long getLong(String string, String string1, long l, IScopeContext[] iscs) {
    return getProxy().getLong(string, string1, l, iscs);
  }

  @Override
  public String getString(String string, String string1, String string2, IScopeContext[] iscs) {
    return getProxy().getString(string, string1, string2, iscs);
  }

  @Override
  public IEclipsePreferences getRootNode() {
    return getProxy().getRootNode();
  }

  @Override
  public IStatus exportPreferences(IEclipsePreferences iep, OutputStream out, String[] strings)
      throws CoreException {
    return getProxy().exportPreferences(iep, out, strings);
  }

  @Override
  public IStatus importPreferences(InputStream in) throws CoreException {
    return getProxy().importPreferences(in);
  }

  @Override
  public IStatus applyPreferences(IExportedPreferences iep) throws CoreException {
    return getProxy().applyPreferences(iep);
  }

  @Override
  public IExportedPreferences readPreferences(InputStream in) throws CoreException {
    return getProxy().readPreferences(in);
  }

  @Override
  public String[] getDefaultLookupOrder(String string, String string1) {
    return getProxy().getDefaultLookupOrder(string, string1);
  }

  @Override
  public String[] getLookupOrder(String string, String string1) {
    return getProxy().getLookupOrder(string, string1);
  }

  @Override
  public void setDefaultLookupOrder(String string, String string1, String[] strings) {
    getProxy().setDefaultLookupOrder(string, string1, strings);
  }

  @Override
  public void exportPreferences(IEclipsePreferences iep, IPreferenceFilter[] ipfs, OutputStream out)
      throws CoreException {
    getProxy().exportPreferences(iep, ipfs, out);
  }

  @Override
  public IPreferenceFilter[] matches(IEclipsePreferences iep, IPreferenceFilter[] ipfs)
      throws CoreException {
    return getProxy().matches(iep, ipfs);
  }

  @Override
  public void applyPreferences(IEclipsePreferences iep, IPreferenceFilter[] ipfs)
      throws CoreException {
    getProxy().applyPreferences(iep, ipfs);
  }
}
