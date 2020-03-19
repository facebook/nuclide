namespace java com.facebook.nuclide.remotefs
namespace java.swift com.facebook.nuclide.remotefs
namespace cpp2 facebook.nuclide.remotefs
namespace php nuclide_remotefs
namespace go nuclide.remotefs

/**
 * Standard libc error codes. Add more to this enum and ErrorStrings if needed.
 * Refer to: http://www.gnu.org/software/libc/manual/html_node/Error-Codes.html
 */
enum ErrorCode {
  EPERM     = 1,
  ENOENT    = 2,
  EIO       = 5,
  EBADF     = 9,
  EACCES    = 13,
  EBUSY     = 16,
  EEXIST    = 17,
  ENOTDIR   = 20,
  EISDIR    = 21,
  EINVAL    = 22,
  EFBIG     = 27,
  ENOSPC    = 28,
  EROFS     = 30,
  ENOTEMPTY = 39,
  ENOTSUP   = 95,
  EUNKNOWN  = 97,
}

const map<ErrorCode, string> ERROR_MAP = {
  ErrorCode.EPERM: 'Operation not permitted.',
  ErrorCode.ENOENT: 'No such file or directory.',
  ErrorCode.EIO: 'Input/output error.',
  ErrorCode.EBADF: 'Bad file descriptor.',
  ErrorCode.EACCES: 'Permission denied.',
  ErrorCode.EBUSY: 'Resource busy or locked.',
  ErrorCode.EEXIST: 'File exists.',
  ErrorCode.ENOTDIR: 'File is not a directory.',
  ErrorCode.EISDIR: 'File is a directory.',
  ErrorCode.EINVAL: 'Invalid argument.',
  ErrorCode.EFBIG: 'File is too big.',
  ErrorCode.ENOSPC: 'No space left on disk.',
  ErrorCode.EROFS: 'Cannot modify a read-only file system.',
  ErrorCode.ENOTEMPTY: 'Directory is not empty.',
  ErrorCode.ENOTSUP: 'Operation is not supported.',
}

exception Error {
  1: ErrorCode numericErrorCode,
  2: string message,
  3: string details, /* Json.stringify */
  4: string code,
}

/**
* File change types may be different on different platforms. Need to write
* converter methods to convert file change events on different platforms.
*/
enum FileChangeEventType {
  UNKNOWN = 1,
  ADD = 2,
  DELETE = 3,
  UPDATE = 4,
}

/**
* Possible file types include:
*
*  b: block special file
*  c: character special file
*  d: directory
*  f: regular file
*  p: named pipe (fifo)
*  l: symbolic link
*  s: socket
*  D: Solaris Door
*
* and so on. Here our file system service is only interested in: regular file,
* directory, symbolic link and all other types will be labeled as unknown types
*/
enum FileType {
  UNKNOWN = 0,
  FILE = 1,
  DIRECTORY = 2,
  SYMLINK = 3
}

struct FileChangeEvent {
  1: FileChangeEventType eventType,
  2: string fname,
}

/**
* Refer to: https://nodejs.org/api/fs.html#fs_class_fs_stats
*/
struct FileStat {
  1: i32 dev,
  2: i32 mode,
  3: i32 nlink,
  4: i32 uid,
  5: i32 gid,
  6: i32 rdev,
  7: i32 blksize,
  8: i32 ino,
  9: i32 size,
  10: i32 blocks,
  11: string atime,
  12: string mtime,
  13: string ctime,
  14: string birthtime,
  15: FileType ftype,
}

struct FileEntry {
  1: string fname,
  2: FileType ftype,
  3: FileStat fstat,
  // ftype/fstat data may represent what symlink points to, so add additional
  // field
  4: bool isSymbolicLink,
}

struct WatchOpt {
  1: bool recursive,
  2: list<string> excludes,
 }

struct WriteFileOpt {
  1: bool create,
  2: bool overwrite,
  3: string encoding,
  4: i32 mode,
  5: string flag,
 }

struct DeleteOpt {
  1: bool recursive,
}

struct RenameOpt {
  1: bool overwrite,
}

struct CopyOpt{
  1: bool overwrite,
}


service ThriftFileSystemService {

  void chmod(1: string path, 2: i32 mode)
    throws(1: Error error);

  void chown(1: string path, 2: i32 uid, 3: i32 gid)
    throws(1: Error error);

  void close(1: i32 fd)
    throws(1: Error error);

  /**
   * Copy files or folders.
   *
   * @param source The existing file.
   * @param destination The destination location.
   * @param options Defines if existing files should be overwriten.
   */
  void copy(1: string source, 2: string destination, 3: CopyOpt options)
    throws(1: Error error);

  /**
   * Create a new directory.
   *
   * @param uri The uri of the new folder.
   */
  void createDirectory(1: string uri) throws(1: Error error);

  /**
   * Delete a file or a directory.
   *
   * @param uri The resource that is to be deleted.
   * @param options Defines if deletion of folders is recursive.
   */
  void deletePath(1: string uri, 2: DeleteOpt options) throws(1: Error error);

  /**
   * Returns the specified file path with the home dir ~/ expanded.
   */
  string expandHomeDir(1: string uri) throws(1: Error error);

  void fsync(1: i32 fd) throws(1: Error error);

  FileStat fstat(1: i32 fd) throws(1: Error error);

  void ftruncate(1: i32 fd, 2: i32 len) throws(1: Error error);

  /**
   * Do not follow symlinks, the link itself is stat-ed, not the file
   * that it refers to.
   *
   * @param uri The uri of the file to retrieve metadata about.
   * @return The file metadata about the file.
   */
  FileStat lstat(1: string uri) throws(1: Error error);

  /**
   * Runs the equivalent of `mkdir -p` with the given path.
   *
   * Like most implementations of mkdirp, if it fails, it is possible that
   * directories were created for some prefix of the given path.
   * @return true if the path was created; false if it already existed.
   */
  bool mkdirp(1: string path) throws(1: Error error);

  i32 open(1: string path, 2: i32 permissionFlags, 3: i32 mode)
    throws(1: Error error);

  /**
   * Collect and send file change events to client.
   *
   * The client will periodically call this function to poll file change Events
   * in the watched file/directory. The server will keep a list of file change
   * events and send them all to the client and then clear the list for future
   * changes.
   */
  list<FileChangeEvent> pollFileChanges(1: string watchId) throws(1: Error error);

  /**
   * Retrieve all entries of a directory.
   *
   * @param uri The uri of the folder.
   * @return An array of file entries
   */
  list<FileEntry> readDirectory(1: string uri) throws(1: Error error);

  /**
   * Read the entire contents of a file.
   *
   * @param uri The uri of the file.
   * @return the content of file, binary byte array
   */
  binary readFile(1: string uri) throws(1: Error error);

  /**
   * Gets the real path of a file path.
   * It could be different than the given path if the file is a symlink
   * or exists in a symlinked directory.
   */
  string realpath(1: string uri) throws(1: Error error);

  /**
   * Gets the real path of a file path, while expanding tilde paths and symlinks
   * like: ~/abc to its absolute path format.
   */
  string resolveRealPath(1: string uri) throws(1: Error error);

  /**
   * Rename a file or folder.
   *
   * @param oldUri The existing file.
   * @param newUri The new location.
   * @param options Defines if existing files should be overwriten.
   */
  void rename(1: string oldUri, 2: string newUri, 3: RenameOpt options)
    throws(1: Error error);

  /**
   * Retrieve metadata about a file.
   *
   * Follow symlinks to fetch metadata of the files the symlinks refer to.
   *
   * @param uri The uri of the file to retrieve metadata about.
   * @return The file metadata about the file.
   */
  FileStat stat(1: string uri) throws(1: Error error);

  /**
   * Stop watching target file or directory.
   *
   * @param watchId unique watch id
   */
  void unwatch(1: string watchId) throws(1: Error error);

  void utimes(1: string path, 2: i32 atime, 3: i32 mtime)
    throws(1: Error error);

  /**
   * Initialize watcher for target file or directory.
   *
   * The client will call this function to set watch for target files and
   * folders. The options contains more details about watcher behavior, such
   * as, what files/folders to exclude from watching and if subfolders,
   * sub-subfolder, etc. should be watched (`recursive`).
   *

   * @param uri The uri of the file/directory to be watched.
   * @param options Configures the watch function.
   * @return unique watch id
   */
  string watch(1: string uri, 2: WatchOpt options) throws(1: Error error);


  /**
   * Write data to a file, replacing its entire contents.
   *
   * @param uri The uri of the file.
   * @param content The new content of the file.
   * @param options More details like if missing files should or must be created
   */
  void writeFile(1: string uri, 2: binary content, 3: WriteFileOpt options)
    throws(1: Error error);

}
