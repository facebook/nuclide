exception Error {1: string message}

enum PollEventType {
  NEW_OUTPUT = 1,
  TIMEOUT = 2,
  NO_PTY = 3,
}

struct PollEvent {
  1: PollEventType eventType,
  2: binary chunk
  3: i16 exitCode,
  4: i16 exitSignal,
}

struct SpawnArguments {
  1: string command,  //  i.e. /bin/bash
  2: list<string> commandArgs,  // i.e. i.e. ['-l']
  3: map<string, string> envPatches,  // use remote environment patched with these values
  4: string cwd,   // i.e. '/tmp'
  5: string name,  // i.e. 'xterm-256color'
  6: i32 cols,
  7: i32 rows,
}

service ThriftPtyService {
  void disposeId(1: i32 id);
  PollEvent poll(1: i32 id, 2: i32 timeoutSec);
  void resize(1: i32 id, 2: i32 columns, 3: i32 rows);
  void setEncoding(1: i32 id, 2: string encoding);
  i32 spawn(1: SpawnArguments spawnArguments);
  void writeInput(1: i32 id, 2: string data);
}
