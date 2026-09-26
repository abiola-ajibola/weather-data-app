import { randomUUID, sign } from "node:crypto";
import { close, open, read, unlink, write } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Duplex, DuplexOptions } from "node:stream";
import { abortEmitter } from "./abortEventEmitter.js";

export class TempFileDuplexStream extends Duplex {
  #tempFilePath = "";
  #bytesRead: number;
  #bytesWritten: number;
  #fd: number | null = null;
  #writeFinished = false;

  constructor(options?: DuplexOptions) {
    super(options);
    this.#tempFilePath = join(
      tmpdir(),
      `weather-ingest-${randomUUID()}.tar.gz`,
    );
    this.#bytesRead = 0;
    this.#bytesWritten = 0;
  }

  _construct(callback: (error?: Error | null) => void): void {
    open(this.#tempFilePath, "a+", (err, fd) => {
      if (err) {
        callback(err);
      }
      this.#fd = fd;
      console.log({ fd });
      console.log({ tempFile: this.#tempFilePath });
      callback();
    });
  }

  _write(
    chunk: any,
    encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ): void {
    if (this.#fd === null) {
      callback(new Error("Temporary file is not open"));
      return;
    }

    const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding);

    write(
      this.#fd!,
      data,
      0,
      data.length,
      this.#bytesWritten,
      (err, bytesWritten) => {
        if (err) {
          callback(err);
          return;
        }
        this.#bytesWritten += bytesWritten;
        callback();
      },
    );
  }

  _read(size: number) {
    if (this.#fd == undefined) {
      this.destroy(new Error("Temporary file is not open"));
      return;
    }

    if (size <= 0) {
      return;
    }

    const buffer = Buffer.alloc(size);
    read(this.#fd, buffer, 0, size, this.#bytesRead, (err, bytesRead) => {
      if (err) {
        this.destroy(err);
        return;
      }
      if (bytesRead > 0) {
        // Push the read data into the internal read queue
        this.push(buffer.subarray(0, bytesRead));
        this.#bytesRead += bytesRead;
      } else {
        this.push("");
      }
      if (this.#writeFinished && this.#bytesRead >= this.#bytesWritten) {
        // Pushing null signals the end of the readable stream (EOF)
        this.push(null);
      }
    });
  }

  _final(callback: (error?: Error | null) => void): void {
    this.#writeFinished = true;
    callback();
  }

  _destroy(
    error: Error | null,
    callback: (error?: Error | null) => void,
  ): void {
    abortEmitter.removeAllListeners();
    const removeFile = (cleanupError?: Error | null): void => {
      unlink(this.#tempFilePath, (unlinkError) => {
        callback(error ?? cleanupError ?? unlinkError ?? null);
      });
    };

    if (this.#fd === null) {
      removeFile();
      return;
    }

    const fd = this.#fd;
    this.#fd = null;
    close(fd, (closeError) => {
      removeFile(closeError);
    });
  }
}
