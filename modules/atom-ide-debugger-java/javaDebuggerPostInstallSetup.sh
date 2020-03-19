#!/bin/sh

# 1. Run `mvn package` and expect it to fail.
mvn package
LOCALMAVENREPO=$(mvn -X | grep 'local repository' | rev | cut -d' ' -f1 | rev)

# 2. Run `./scripts/grab-tools-jar.py`.
./scripts/grab-tools-jar.py

# 3. Move the output jar (`tools-1.0.0.jar`) to `~/.m2/repository/com/sun/tools/1.0.0/`.
LOCALTOOLSJARLOCATION=$LOCALMAVENREPO/com/sun/tools/1.0.0
mkdir -p "$LOCALTOOLSJARLOCATION"
mv tools-1.0.0.jar "$LOCALTOOLSJARLOCATION"

# 4. Manually download `org.eclipse.jdt:org.eclipse.jdt.debug:jar:3.10.1` from a central maven repository into your current directory.
curl https://repo1.maven.org/maven2/org/eclipse/jdt/org.eclipse.jdt.debug/3.10.1/org.eclipse.jdt.debug-3.10.1.jar > org.eclipse.jdt.debug-3.10.1.jar

# 5. Run `./scripts/extract-model-jar.py org.eclipse.jdt.debug-3.10.1.jar`.
./scripts/extract-model-jar.py org.eclipse.jdt.debug-3.10.1.jar

# 6. Move the output jar (`org.eclipse.jdt.debug.jdimodel-3.10.1.jar`) to `~/.m2/repository/org/eclipse/jdt/org.eclipse.jdt.debug.jdimodel/3.10.1/`.
LOCALJDIMODELJARLOCATION=$LOCALMAVENREPO/org/eclipse/jdt/org.eclipse.jdt.debug.jdimodel/3.10.1
mkdir -p "$LOCALJDIMODELJARLOCATION"
mv org.eclipse.jdt.debug.jdimodel-3.10.1.jar "$LOCALJDIMODELJARLOCATION"

# 7. Run `mvn package`. This time it should succeed.
mvn package

# 8. Move the output jar into the Build folder by running `mv target/nuclide-java-debugger-0.7.2.jar Build/java_debugger_server.jar`.
mkdir -p Build
mv target/nuclide-java-debugger-0.7.2.jar Build/java_debugger_server.jar

if [ ! -f Build/java_debugger_server.jar ]; then
    echo "Java Debugger failed to build."
    exit 1
else
  exit 0
fi
