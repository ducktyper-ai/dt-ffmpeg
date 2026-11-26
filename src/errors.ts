/** A graph that cannot be built or compiled. */
export class GraphError extends Error {
  override name = "GraphError";
}

export interface FFmpegFailure {
  argv: string[];
  exitCode?: number | null;
  signal?: NodeJS.Signals | null;
  /** The end of the process's stderr. */
  stderr?: Buffer;
  cause?: unknown;
}

/** ffmpeg or ffprobe failed, could not be started, or was stopped. */
export class FFmpegError extends Error {
  override name = "FFmpegError";
  readonly argv: string[];
  readonly exitCode: number | null;
  readonly signal: NodeJS.Signals | null;
  readonly stderr: Buffer;

  constructor(message: string, failure: FFmpegFailure) {
    super(message, { cause: failure.cause });
    this.argv = failure.argv;
    this.exitCode = failure.exitCode ?? null;
    this.signal = failure.signal ?? null;
    this.stderr = failure.stderr ?? Buffer.alloc(0);
  }
}

export class BinaryNotFoundError extends FFmpegError {
  override name = "BinaryNotFoundError";
}

export class FFmpegTimeoutError extends FFmpegError {
  override name = "FFmpegTimeoutError";
}

export class FFmpegAbortError extends FFmpegError {
  override name = "FFmpegAbortError";
}
