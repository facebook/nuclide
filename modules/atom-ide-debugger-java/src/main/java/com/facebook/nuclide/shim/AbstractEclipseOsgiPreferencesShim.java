/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

package com.facebook.nuclide.shim;

import org.osgi.service.prefs.BackingStoreException;
import org.osgi.service.prefs.Preferences;

public abstract class AbstractEclipseOsgiPreferencesShim extends AbstractEclipseShim<Preferences>
    implements Preferences {

  @Override
  public void put(String string, String string1) {
    getProxy().put(string, string1);
  }

  @Override
  public String get(String string, String string1) {
    return getProxy().get(string, string1);
  }

  @Override
  public void remove(String string) {
    getProxy().remove(string);
  }

  @Override
  public void clear() throws BackingStoreException {
    getProxy().clear();
  }

  @Override
  public void putInt(String string, int i) {
    getProxy().putInt(string, i);
  }

  @Override
  public int getInt(String string, int i) {
    return getProxy().getInt(string, i);
  }

  @Override
  public void putLong(String string, long l) {
    getProxy().putLong(string, l);
  }

  @Override
  public long getLong(String string, long l) {
    return getProxy().getLong(string, l);
  }

  @Override
  public void putBoolean(String string, boolean bln) {
    getProxy().putBoolean(string, bln);
  }

  @Override
  public boolean getBoolean(String string, boolean bln) {
    return getProxy().getBoolean(string, bln);
  }

  @Override
  public void putFloat(String string, float f) {
    getProxy().putFloat(string, f);
  }

  @Override
  public float getFloat(String string, float f) {
    return getProxy().getFloat(string, f);
  }

  @Override
  public void putDouble(String string, double d) {
    getProxy().putDouble(string, d);
  }

  @Override
  public double getDouble(String string, double d) {
    return getProxy().getDouble(string, d);
  }

  @Override
  public void putByteArray(String string, byte[] bytes) {
    getProxy().putByteArray(string, bytes);
  }

  @Override
  public byte[] getByteArray(String string, byte[] bytes) {
    return getProxy().getByteArray(string, bytes);
  }

  @Override
  public String[] keys() throws BackingStoreException {
    return getProxy().keys();
  }

  @Override
  public String[] childrenNames() throws BackingStoreException {
    return getProxy().childrenNames();
  }

  @Override
  public Preferences parent() {
    return getProxy().parent();
  }

  @Override
  public Preferences node(String string) {
    return getProxy().node(string);
  }

  @Override
  public boolean nodeExists(String string) throws BackingStoreException {
    return getProxy().nodeExists(string);
  }

  @Override
  public void removeNode() throws BackingStoreException {
    getProxy().removeNode();
  }

  @Override
  public String name() {
    return getProxy().name();
  }

  @Override
  public String absolutePath() {
    return getProxy().absolutePath();
  }

  @Override
  public void flush() throws BackingStoreException {
    getProxy().flush();
  }

  @Override
  public void sync() throws BackingStoreException {
    getProxy().sync();
  }
}
