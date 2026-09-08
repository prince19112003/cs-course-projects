import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { pipeline } from 'node:stream/promises';

export class ArchiveUtils {
  /**
   * Compresses a file using gzip.
   */
  static async gzipFile(sourcePath: string, destPath: string): Promise<void> {
    const readStream = fs.createReadStream(sourcePath);
    const writeStream = fs.createWriteStream(destPath);
    const gzip = zlib.createGzip({ level: 9 });

    await pipeline(readStream, gzip, writeStream);
  }

  /**
   * Decompresses a gzip-compressed file.
   */
  static async gunzipFile(sourcePath: string, destPath: string): Promise<void> {
    const readStream = fs.createReadStream(sourcePath);
    const writeStream = fs.createWriteStream(destPath);
    const gunzip = zlib.createGunzip();

    await pipeline(readStream, gunzip, writeStream);
  }

  /**
   * Computes the SHA-256 checksum of a file.
   */
  static async computeFileSha256(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);

      stream.on('data', (data) => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', (err) => reject(err));
    });
  }

  /**
   * Computes the SHA-256 checksum of an in-memory buffer.
   */
  static computeBufferSha256(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Packages data.db and manifest.json into a single compressed portable .nexus container.
   * Format:
   * [MAGIC 24 bytes] "NEXUS_PKG_V1.0.0_STREAM\n"
   * [MANIFEST_LEN 4 bytes uint32 BE]
   * [MANIFEST_JSON_BYTES]
   * [DATA_GZIPPED_PAYLOAD]
   */
  static async createNexusPackage(
    dataDbPath: string,
    manifest: Record<string, any>,
    outputPath: string
  ): Promise<void> {
    const magic = Buffer.from('NEXUS_PKG_V1.0.0_STREAM\n', 'utf-8');

    // Ensure database checksum is recorded in manifest
    const dbHash = await this.computeFileSha256(dataDbPath);
    manifest.integrity = {
      algorithm: 'SHA-256',
      dataHash: dbHash,
    };

    const manifestStr = JSON.stringify(manifest, null, 2);
    const manifestBuf = Buffer.from(manifestStr, 'utf-8');
    const manifestLenBuf = Buffer.alloc(4);
    manifestLenBuf.writeUInt32BE(manifestBuf.length, 0);

    // Compress data.db in-memory or streamed
    const dbData = fs.readFileSync(dataDbPath);
    const gzippedDb = zlib.gzipSync(dbData, { level: 9 });

    const parentDir = path.dirname(outputPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    const outputBuffer = Buffer.concat([magic, manifestLenBuf, manifestBuf, gzippedDb]);
    fs.writeFileSync(outputPath, outputBuffer);
  }

  /**
   * Extracts a .nexus container into an isolated directory and validates integrity.
   */
  static async extractNexusPackage(
    packagePath: string,
    extractDir: string
  ): Promise<{ manifest: any; dataDbPath: string }> {
    if (!fs.existsSync(packagePath)) {
      throw new Error(`PACKAGE_NOT_FOUND: Package file '${packagePath}' does not exist.`);
    }

    if (!fs.existsSync(extractDir)) {
      fs.mkdirSync(extractDir, { recursive: true });
    }

    const packageBuffer = fs.readFileSync(packagePath);
    const magicStr = 'NEXUS_PKG_V1.0.0_STREAM\n';
    const magicLen = Buffer.byteLength(magicStr, 'utf-8');

    if (packageBuffer.length < magicLen + 4) {
      throw new Error('INVALID_PACKAGE: File is too small or corrupted.');
    }

    const fileMagic = packageBuffer.subarray(0, magicLen).toString('utf-8');
    if (fileMagic !== magicStr) {
      throw new Error('INVALID_FORMAT: File is not a valid .nexus portable container package.');
    }

    const manifestLen = packageBuffer.readUInt32BE(magicLen);
    const manifestStart = magicLen + 4;
    const manifestEnd = manifestStart + manifestLen;

    if (packageBuffer.length < manifestEnd) {
      throw new Error('CORRUPTED_PACKAGE: Manifest payload is truncated.');
    }

    const manifestJsonStr = packageBuffer.subarray(manifestStart, manifestEnd).toString('utf-8');
    let manifest: any;
    try {
      manifest = JSON.parse(manifestJsonStr);
    } catch {
      throw new Error('CORRUPTED_MANIFEST: Failed to parse package manifest JSON.');
    }

    const gzippedDbPayload = packageBuffer.subarray(manifestEnd);
    if (gzippedDbPayload.length === 0) {
      throw new Error('CORRUPTED_PACKAGE: Database payload is missing.');
    }

    let uncompressedDb: Buffer;
    try {
      uncompressedDb = zlib.gunzipSync(gzippedDbPayload);
    } catch (err) {
      throw new Error(`DECOMPRESSION_FAILED: ${(err as Error).message}`);
    }

    const targetDbPath = path.join(extractDir, 'data.db');
    fs.writeFileSync(targetDbPath, uncompressedDb);

    // Verify SHA-256 checksum
    const computedHash = this.computeBufferSha256(uncompressedDb);
    if (manifest.integrity?.dataHash && computedHash !== manifest.integrity.dataHash) {
      fs.unlinkSync(targetDbPath);
      throw new Error(
        `CHECKSUM_MISMATCH: Computed hash '${computedHash}' does not match manifest hash '${manifest.integrity.dataHash}'. Package may be corrupted or tampered with.`
      );
    }

    // Save manifest file in extract dir for reference
    fs.writeFileSync(path.join(extractDir, 'manifest.json'), manifestJsonStr, 'utf-8');

    return {
      manifest,
      dataDbPath: targetDbPath,
    };
  }

  /**
   * Validates and asserts that a path is safely located within a base directory,
   * preventing path traversal attacks (e.g. "../../../Windows/System32").
   */
  static assertSafeFilePath(baseDir: string, userPath: string): string {
    const resolvedBase = path.resolve(baseDir);
    const resolvedPath = path.resolve(baseDir, userPath);

    if (!resolvedPath.startsWith(resolvedBase)) {
      throw new Error(`PATH_TRAVERSAL_DETECTED: Access to '${userPath}' is forbidden.`);
    }

    return resolvedPath;
  }
}
