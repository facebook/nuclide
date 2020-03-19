package com.facebook.nuclide.shim;

import com.facebook.nuclide.debugger.ContextManager;
import com.sun.jdi.ReferenceType;
import com.sun.jdi.VirtualMachine;
import java.util.List;
import org.eclipse.debug.core.DebugException;
import org.eclipse.jdt.debug.core.IJavaType;
import org.eclipse.jdt.debug.core.IJavaValue;

public class EclipseDebugTargetShim extends AbstractEclipseDebugTargetShim {
  private final VirtualMachine _vm;
  private final ContextManager _contextManager;

  public EclipseDebugTargetShim(ContextManager contextManager) {
    _contextManager = contextManager;
    _vm = contextManager.getVirtualMachine();
  }

  @Override
  public String getDefaultStratum() {
    // Just pass through to the JVM.
    return _vm.getDefaultStratum();
  }

  @Override
  public void setDefaultStratum(String string) {
    // No-op. Not supported.
  }

  @Override
  public IJavaValue voidValue() {
    return new EclipseJavaValueShim(_vm.mirrorOfVoid());
  }

  @Override
  public IJavaValue nullValue() {
    return new EclipseJavaValueShim(null);
  }

  @Override
  public IJavaValue newValue(String string) {
    return new EclipseJavaValueShim(_vm.mirrorOf(string));
  }

  @Override
  public IJavaValue newValue(short s) {
    return new EclipseJavaValueShim(_vm.mirrorOf(s));
  }

  @Override
  public IJavaValue newValue(long l) {
    return new EclipseJavaValueShim(_vm.mirrorOf(l));
  }

  @Override
  public IJavaValue newValue(int i) {
    return new EclipseJavaValueShim(_vm.mirrorOf(i));
  }

  @Override
  public IJavaValue newValue(float f) {
    return new EclipseJavaValueShim(_vm.mirrorOf(f));
  }

  @Override
  public IJavaValue newValue(double d) {
    return new EclipseJavaValueShim(_vm.mirrorOf(d));
  }

  @Override
  public IJavaValue newValue(char c) {
    return new EclipseJavaValueShim(_vm.mirrorOf(c));
  }

  @Override
  public IJavaValue newValue(byte b) {
    return new EclipseJavaValueShim(_vm.mirrorOf(b));
  }

  @Override
  public IJavaValue newValue(boolean bln) {
    return new EclipseJavaValueShim(_vm.mirrorOf(bln));
  }

  @Override
  public IJavaType[] getJavaTypes(String string) throws DebugException {
    List<ReferenceType> types = _vm.classesByName(string);
    return types
        .stream()
        .map(referenceType -> new EclipseJavaReferenceTypeShim(referenceType, _contextManager))
        .toArray(IJavaType[]::new);
  }
}
