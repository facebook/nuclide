/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

package com.facebook.nuclide.shim;

import org.eclipse.debug.core.model.IDebugElement;
import org.eclipse.jdt.debug.core.IJavaReferenceType;

public interface IEclipseDebugReference extends IJavaReferenceType, IDebugElement {}
