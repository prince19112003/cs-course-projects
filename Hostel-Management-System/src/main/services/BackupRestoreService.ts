import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import { BackupRepository } from '../database/repositories/BackupRepository.js';
import { AuditRepository } from '../database/repositories/AuditRepository.js';
import { ArchiveUtils } from '../utils/archive-utils.js';
import {
  closeDatabase,
  initDatabaseAsync,
  getSqlite,
  getDefaultDatabasePath,
  checkDatabaseHealth,
} from '../database/connection.js';
import { applyMigrations, getAppliedMigrations } from '../database/migrator.js';
import {
  SessionUser,
  BackupMetadata,
  BackupCreateInput,
  BackupCreateResult,
  RestoreInput,
  RestoreResult,
  PortableExportInput,
  PortableExportResult,
  PortableImportInput,
  PortableImportResult,
  DatabaseDiagnosticsDto,
  MigrationStatusDto,
} from '../../shared/types.js';

function verifyPermission(user: SessionUser, requiredPermission: string) {
  const hasWildcard = user.permissions.includes('*');
  const hasSpecific = user.permissions.includes(requiredPermission);
  if (!hasWildcard && !hasSpecific) {
    throw new Error(`FORBIDDEN: User lacks required permission '${requiredPermission}'.`);
  }
}

export class BackupRestoreService {
  private static getBaseBackupDir(): string {
    const base = app?.getPath ? app.getPath('appData') : process.env.APPDATA || './';
    const dir = path.join(base, 'NexusHostel', 'backups');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  private static getTempStagingDir(): string {
    const base = app?.getPath ? app.getPath('appData') : process.env.APPDATA || './';
    const dir = path.join(base, 'NexusHostel', 'temp', 'staging');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  // 1. Manual Backup Creation
  static async createBackup(
    user: SessionUser,
    input: BackupCreateInput = {}
  ): Promise<BackupCreateResult> {
    verifyPermission(user, 'backup:create');

    const backupDir = this.getBaseBackupDir();
    const stagingDir = this.getTempStagingDir();
    const now = new Date();
    const timestampStr = now
      .toISOString()
      .replace(/[-:]/g, '')
      .replace('T', '_')
      .split('.')[0];
    const cleanLabel = (input.label || 'manual').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `manual_backup_${timestampStr}_v1_${cleanLabel}.db.gz`;
    const targetFilePath = input.targetPath
      ? path.resolve(input.targetPath, filename)
      : path.join(backupDir, filename);

    // Staging temporary SQLite file
    const tempRawDbPath = path.join(stagingDir, `raw_backup_${Date.now()}.db`);

    try {
      // Create raw backup online
      await BackupRepository.createRawBackup(tempRawDbPath);

      // Verify integrity of raw backup before compressing
      const check = BackupRepository.runIntegrityCheck(tempRawDbPath);
      if (!check.ok) {
        throw new Error(`BACKUP_INTEGRITY_CHECK_FAILED: ${check.errors.join('; ')}`);
      }

      // Compress to .db.gz
      await ArchiveUtils.gzipFile(tempRawDbPath, targetFilePath);

      // Compute SHA-256
      const checksum = await ArchiveUtils.computeFileSha256(targetFilePath);
      const stats = fs.statSync(targetFilePath);
      const metrics = await BackupRepository.getRecordMetrics();

      const metadata: BackupMetadata = {
        filename,
        filePath: targetFilePath,
        sizeBytes: stats.size,
        createdAt: now.getTime(),
        backupType: 'manual',
        label: input.label || 'Manual Snapshot',
        schemaVersion: 1,
        appVersion: '1.0.0',
        checksum,
        isValid: true,
        metrics: metrics as any,
      };

      // Save manifest file alongside backup
      const manifestPath = `${targetFilePath}.json`;
      fs.writeFileSync(manifestPath, JSON.stringify(metadata, null, 2), 'utf-8');

      await AuditRepository.createLog({
        userId: user.id,
        userRole: user.role,
        action: 'BACKUP_CREATED',
        entityType: 'backup',
        changesSummary: {
          filename,
          sizeBytes: stats.size,
          checksum,
          label: input.label,
        },
      });

      return {
        success: true,
        backup: metadata,
      };
    } finally {
      if (fs.existsSync(tempRawDbPath)) {
        try {
          fs.unlinkSync(tempRawDbPath);
        } catch {}
      }
    }
  }

  // 2. Automated Daily Rolling Backup
  static async createAutoBackup(): Promise<BackupMetadata | null> {
    const backupDir = this.getBaseBackupDir();
    const stagingDir = this.getTempStagingDir();
    const now = new Date();
    const timestampStr = now
      .toISOString()
      .replace(/[-:]/g, '')
      .replace('T', '_')
      .split('.')[0];
    const filename = `auto_backup_${timestampStr}_v1.db.gz`;
    const targetFilePath = path.join(backupDir, filename);
    const tempRawDbPath = path.join(stagingDir, `auto_raw_${Date.now()}.db`);

    try {
      await BackupRepository.createRawBackup(tempRawDbPath);
      const check = BackupRepository.runIntegrityCheck(tempRawDbPath);
      if (!check.ok) return null;

      await ArchiveUtils.gzipFile(tempRawDbPath, targetFilePath);
      const checksum = await ArchiveUtils.computeFileSha256(targetFilePath);
      const stats = fs.statSync(targetFilePath);
      const metrics = await BackupRepository.getRecordMetrics();

      const metadata: BackupMetadata = {
        filename,
        filePath: targetFilePath,
        sizeBytes: stats.size,
        createdAt: now.getTime(),
        backupType: 'auto',
        label: 'Automated Daily Backup',
        schemaVersion: 1,
        appVersion: '1.0.0',
        checksum,
        isValid: true,
        metrics: metrics as any,
      };

      fs.writeFileSync(`${targetFilePath}.json`, JSON.stringify(metadata, null, 2), 'utf-8');

      // Prune auto backups older than 14 days
      this.pruneOldAutoBackups(14);

      return metadata;
    } catch (err) {
      console.error('Failed creating automated backup:', err);
      return null;
    } finally {
      if (fs.existsSync(tempRawDbPath)) {
        try {
          fs.unlinkSync(tempRawDbPath);
        } catch {}
      }
    }
  }

  // Prune automated backups older than maxDays
  private static pruneOldAutoBackups(maxDays: number): void {
    const backupDir = this.getBaseBackupDir();
    const cutoffTime = Date.now() - maxDays * 24 * 60 * 60 * 1000;

    try {
      const files = fs.readdirSync(backupDir);
      for (const file of files) {
        if (file.startsWith('auto_backup_') && file.endsWith('.db.gz')) {
          const filePath = path.join(backupDir, file);
          const stats = fs.statSync(filePath);
          if (stats.mtimeMs < cutoffTime) {
            fs.unlinkSync(filePath);
            const manifest = `${filePath}.json`;
            if (fs.existsSync(manifest)) fs.unlinkSync(manifest);
          }
        }
      }
    } catch (err) {
      console.error('Error pruning old backups:', err);
    }
  }

  // 3. List Backup Catalog
  static async listBackups(user: SessionUser): Promise<BackupMetadata[]> {
    verifyPermission(user, 'backup:view');
    const backupDir = this.getBaseBackupDir();
    const results: BackupMetadata[] = [];

    if (!fs.existsSync(backupDir)) return [];

    const files = fs.readdirSync(backupDir);

    for (const file of files) {
      if (file.endsWith('.db.gz') || file.endsWith('.nexus')) {
        const filePath = path.join(backupDir, file);
        const manifestPath = `${filePath}.json`;
        const stats = fs.statSync(filePath);

        if (fs.existsSync(manifestPath)) {
          try {
            const raw = fs.readFileSync(manifestPath, 'utf-8');
            const parsed = JSON.parse(raw);
            results.push({
              ...parsed,
              filePath,
              sizeBytes: stats.size,
            });
            continue;
          } catch {}
        }

        // Fallback metadata if manifest is missing
        const isAuto = file.startsWith('auto_');
        const isPreRestore = file.startsWith('pre_restore_');
        const isPreMigration = file.startsWith('pre_migration_');
        const backupType = isAuto
          ? 'auto'
          : isPreRestore
          ? 'pre_restore'
          : isPreMigration
          ? 'pre_migration'
          : 'manual';

        results.push({
          filename: file,
          filePath,
          sizeBytes: stats.size,
          createdAt: stats.mtimeMs,
          backupType,
          schemaVersion: 1,
          appVersion: '1.0.0',
          checksum: 'UNVERIFIED',
          isValid: true,
        });
      }
    }

    return results.sort((a, b) => b.createdAt - a.createdAt);
  }

  // 4. Delete a Backup
  static async deleteBackup(user: SessionUser, filename: string): Promise<{ success: boolean }> {
    verifyPermission(user, 'backup:delete');
    const backupDir = this.getBaseBackupDir();
    const targetFile = ArchiveUtils.assertSafeFilePath(backupDir, filename);

    if (fs.existsSync(targetFile)) {
      fs.unlinkSync(targetFile);
      const manifest = `${targetFile}.json`;
      if (fs.existsSync(manifest)) fs.unlinkSync(manifest);

      await AuditRepository.createLog({
        userId: user.id,
        userRole: user.role,
        action: 'BACKUP_DELETED',
        entityType: 'backup',
        changesSummary: { filename },
      });
      return { success: true };
    }

    throw new Error(`FILE_NOT_FOUND: Backup file '${filename}' does not exist.`);
  }

  // 5. Pre-Flight Staged Backup Validation
  static async validateBackupFile(
    backupPath: string
  ): Promise<{ isValid: boolean; metadata?: Partial<BackupMetadata>; error?: string }> {
    if (!fs.existsSync(backupPath)) {
      return { isValid: false, error: 'Backup file does not exist on disk.' };
    }

    const stagingDir = this.getTempStagingDir();
    const tempDecompressed = path.join(stagingDir, `inspect_${Date.now()}.db`);

    try {
      if (backupPath.endsWith('.db.gz')) {
        await ArchiveUtils.gunzipFile(backupPath, tempDecompressed);
      } else if (backupPath.endsWith('.db')) {
        fs.copyFileSync(backupPath, tempDecompressed);
      } else if (backupPath.endsWith('.nexus')) {
        const extracted = await ArchiveUtils.extractNexusPackage(backupPath, stagingDir);
        return {
          isValid: true,
          metadata: {
            appVersion: extracted.manifest.appVersion,
            schemaVersion: extracted.manifest.schemaVersion,
            metrics: extracted.manifest.metrics,
            checksum: extracted.manifest.integrity?.dataHash,
          },
        };
      } else {
        return { isValid: false, error: 'Unsupported backup file extension.' };
      }

      const check = BackupRepository.runIntegrityCheck(tempDecompressed);
      if (!check.ok) {
        return { isValid: false, error: `Integrity check failed: ${check.errors.join('; ')}` };
      }

      const checksum = await ArchiveUtils.computeFileSha256(backupPath);
      const stats = fs.statSync(backupPath);

      return {
        isValid: true,
        metadata: {
          filename: path.basename(backupPath),
          filePath: backupPath,
          sizeBytes: stats.size,
          checksum,
          isValid: true,
        },
      };
    } catch (err) {
      return { isValid: false, error: (err as Error).message };
    } finally {
      if (fs.existsSync(tempDecompressed)) {
        try {
          fs.unlinkSync(tempDecompressed);
        } catch {}
      }
    }
  }

  // 6. Resilient Database Restore Pipeline
  static async restoreBackup(user: SessionUser, input: RestoreInput): Promise<RestoreResult> {
    verifyPermission(user, 'backup:restore');

    const backupPath = input.backupFilePath;
    if (!fs.existsSync(backupPath)) {
      throw new Error(`BACKUP_NOT_FOUND: Selected backup file does not exist.`);
    }

    // Step 1: Pre-flight staged validation
    const validation = await this.validateBackupFile(backupPath);
    if (!validation.isValid) {
      throw new Error(`INVALID_BACKUP: Validation failed. ${validation.error}`);
    }

    const activeDbPath = getDefaultDatabasePath();
    const backupDir = this.getBaseBackupDir();
    const stagingDir = this.getTempStagingDir();
    const now = Date.now();

    // Step 2: MANDATORY PRE-RESTORE SAFETY SNAPSHOT
    const safetyFilename = `pre_restore_safety_${now}.db.gz`;
    const safetySnapshotPath = path.join(backupDir, safetyFilename);

    try {
      const tempSafetyDb = path.join(stagingDir, `safety_raw_${now}.db`);
      await BackupRepository.createRawBackup(tempSafetyDb);
      await ArchiveUtils.gzipFile(tempSafetyDb, safetySnapshotPath);
      if (fs.existsSync(tempSafetyDb)) fs.unlinkSync(tempSafetyDb);
    } catch (err) {
      throw new Error(
        `SAFETY_BACKUP_FAILED: Failed creating mandatory pre-restore safety snapshot: ${(err as Error).message}. Restore operation aborted.`
      );
    }

    // Step 3: Decompress target database into staging
    const stagedNewDb = path.join(stagingDir, `target_restore_${now}.db`);
    try {
      if (backupPath.endsWith('.db.gz')) {
        await ArchiveUtils.gunzipFile(backupPath, stagedNewDb);
      } else if (backupPath.endsWith('.nexus')) {
        const ext = await ArchiveUtils.extractNexusPackage(backupPath, stagingDir);
        fs.copyFileSync(ext.dataDbPath, stagedNewDb);
      } else {
        fs.copyFileSync(backupPath, stagedNewDb);
      }
    } catch (err) {
      throw new Error(`DECOMPRESSION_FAILED: ${(err as Error).message}`);
    }

    // Step 4: Close active connection pool
    closeDatabase();

    // Step 5: Atomic file swap
    const quarantineDb = path.join(stagingDir, `quarantine_${now}.db`);
    try {
      if (fs.existsSync(activeDbPath)) {
        fs.renameSync(activeDbPath, quarantineDb);
      }
      // Clean up WAL and SHM
      const wal = `${activeDbPath}-wal`;
      const shm = `${activeDbPath}-shm`;
      if (fs.existsSync(wal)) fs.unlinkSync(wal);
      if (fs.existsSync(shm)) fs.unlinkSync(shm);

      // Move staged database into active destination
      fs.copyFileSync(stagedNewDb, activeDbPath);
    } catch (swapErr) {
      // ROLLBACK: Revert immediately from quarantine
      console.error('Swap failed, attempting rollback:', swapErr);
      if (fs.existsSync(quarantineDb)) {
        fs.copyFileSync(quarantineDb, activeDbPath);
      }
      await initDatabaseAsync({ autoMigrate: false });
      throw new Error(`ATOMIC_SWAP_FAILED: Restored original active database. Error: ${(swapErr as Error).message}`);
    }

    // Step 6: Reconnect database & apply any pending migrations
    let recordMetrics: Record<string, number> = {};
    try {
      await initDatabaseAsync({ autoMigrate: true });
      const check = BackupRepository.runIntegrityCheck();
      if (!check.ok) {
        throw new Error(`Integrity issues in restored database: ${check.errors.join('; ')}`);
      }
      recordMetrics = await BackupRepository.getRecordMetrics();
    } catch (initErr) {
      // ROLLBACK TO SAFETY COPY
      console.error('Restored database initialization failed. Rolling back to pre-restore safety copy:', initErr);
      closeDatabase();
      await ArchiveUtils.gunzipFile(safetySnapshotPath, activeDbPath);
      await initDatabaseAsync({ autoMigrate: false });
      throw new Error(`RESTORE_INITIALIZATION_FAILED: Safely reverted to pre-restore snapshot. ${(initErr as Error).message}`);
    } finally {
      // Cleanup staging
      if (fs.existsSync(stagedNewDb)) fs.unlinkSync(stagedNewDb);
      if (fs.existsSync(quarantineDb)) fs.unlinkSync(quarantineDb);
    }

    // Step 7: Audit log
    await AuditRepository.createLog({
      userId: user.id,
      userRole: user.role,
      action: 'DATABASE_RESTORED',
      entityType: 'database',
      changesSummary: {
        sourceBackup: path.basename(backupPath),
        safetyBackup: safetyFilename,
        restoredMetrics: recordMetrics,
      },
    });

    return {
      success: true,
      safetyBackupPath: safetySnapshotPath,
      restoredAt: now,
      schemaVersion: 1,
      recordCounts: recordMetrics,
    };
  }

  // 7. Cross-Station Data Portability: Export .nexus Package
  static async exportPortablePackage(
    user: SessionUser,
    input: PortableExportInput = {}
  ): Promise<PortableExportResult> {
    verifyPermission(user, 'backup:create');

    const backupDir = this.getBaseBackupDir();
    const stagingDir = this.getTempStagingDir();
    const now = new Date();
    const timestampStr = now
      .toISOString()
      .replace(/[-:]/g, '')
      .replace('T', '_')
      .split('.')[0];
    const filename = `nexus_export_${timestampStr}.nexus`;
    const targetPath = input.targetPath
      ? path.resolve(input.targetPath, filename)
      : path.join(backupDir, filename);

    const snapshotDbPath = path.join(stagingDir, `snapshot_${now.getTime()}.db`);

    try {
      // Clean VACUUM INTO snapshot
      await BackupRepository.createSnapshotDb(snapshotDbPath);

      const metrics = await BackupRepository.getRecordMetrics();
      const manifest = {
        formatVersion: '1.0',
        appVersion: '1.0.0',
        schemaVersion: 1,
        exportedAt: now.toISOString(),
        exportedBy: {
          userId: user.id,
          name: user.name,
          email: user.email,
        },
        institution: {
          code: 'NEXUS-01',
          name: 'Nexus Tech University',
        },
        metrics,
      };

      await ArchiveUtils.createNexusPackage(snapshotDbPath, manifest, targetPath);
      const stats = fs.statSync(targetPath);

      await AuditRepository.createLog({
        userId: user.id,
        userRole: user.role,
        action: 'PORTABLE_PACKAGE_EXPORTED',
        entityType: 'portability',
        changesSummary: {
          packagePath: targetPath,
          sizeBytes: stats.size,
          metrics,
        },
      });

      return {
        success: true,
        packagePath: targetPath,
        manifest,
        sizeBytes: stats.size,
      };
    } finally {
      if (fs.existsSync(snapshotDbPath)) {
        try {
          fs.unlinkSync(snapshotDbPath);
        } catch {}
      }
    }
  }

  // 8. Cross-Station Data Portability: Import .nexus Package
  static async importPortablePackage(
    user: SessionUser,
    input: PortableImportInput
  ): Promise<PortableImportResult> {
    verifyPermission(user, 'backup:restore');

    const stagingDir = this.getTempStagingDir();
    const extractDir = path.join(stagingDir, `pkg_import_${Date.now()}`);

    try {
      // Extract and verify checksum
      const extracted = await ArchiveUtils.extractNexusPackage(input.packagePath, extractDir);

      // Schema version check
      if (extracted.manifest.schemaVersion > 1) {
        throw new Error(
          `APP_UPDATE_REQUIRED: Package requires database schema v${extracted.manifest.schemaVersion}, but current application supports up to v1. Please update application first.`
        );
      }

      if (input.strategy === 'full_overwrite') {
        // Full overwrite delegates to safe restore pipeline
        const restoreRes = await this.restoreBackup(user, {
          backupFilePath: extracted.dataDbPath,
        });
        return {
          success: true,
          importedRecords: restoreRes.recordCounts,
          safetyBackupPath: restoreRes.safetyBackupPath,
        };
      } else {
        // Branch merge reconciles students, rooms, beds using natural keys
        // Safety snapshot first
        const safety = await this.createBackup(user, { label: 'Pre-Branch-Merge Safety' });
        const mergeResult = await BackupRepository.reconcileBranchMerge(
          extracted.dataDbPath,
          input.conflictPolicy || 'skip'
        );

        await AuditRepository.createLog({
          userId: user.id,
          userRole: user.role,
          action: 'PORTABLE_PACKAGE_IMPORTED',
          entityType: 'portability',
          changesSummary: {
            package: path.basename(input.packagePath),
            strategy: 'branch_merge',
            merged: mergeResult,
          },
        });

        return {
          success: true,
          importedRecords: {
            importedCount: mergeResult.importedCount,
            updatedCount: mergeResult.updatedCount,
            skippedCount: mergeResult.skippedCount,
          },
          conflictsResolved: mergeResult.updatedCount + mergeResult.skippedCount,
          safetyBackupPath: safety.backup.filePath,
        };
      }
    } finally {
      if (fs.existsSync(extractDir)) {
        try {
          fs.rmSync(extractDir, { recursive: true, force: true });
        } catch {}
      }
    }
  }

  // 9. Database Health & Diagnostics
  static async getDatabaseDiagnostics(user: SessionUser): Promise<DatabaseDiagnosticsDto> {
    verifyPermission(user, 'backup:view');
    const health = checkDatabaseHealth();
    const activePath = getDefaultDatabasePath();
    let sizeBytes = 0;

    if (fs.existsSync(activePath)) {
      sizeBytes = fs.statSync(activePath).size;
    }

    const metrics = await BackupRepository.getRecordMetrics();
    const migrations = health.appliedMigrations || [];

    return {
      ok: health.ok,
      integrity: health.integrity,
      foreignKeysOk: health.foreignKeys,
      journalMode: health.journalMode,
      tableCounts: metrics,
      sizeBytes,
      dbPath: activePath,
      driver: health.driver || 'better-sqlite3',
      appliedMigrationsCount: migrations.length,
    };
  }

  // 10. Database Optimization & Vacuum
  static async runDatabaseOptimization(
    user: SessionUser
  ): Promise<{ beforeSizeBytes: number; afterSizeBytes: number; reclaimedBytes: number }> {
    verifyPermission(user, 'backup:create');
    const activePath = getDefaultDatabasePath();
    const beforeSizeBytes = fs.existsSync(activePath) ? fs.statSync(activePath).size : 0;

    const sqlite = getSqlite();
    if (sqlite && typeof sqlite.exec === 'function') {
      sqlite.exec('VACUUM; PRAGMA optimize;');
    }

    const afterSizeBytes = fs.existsSync(activePath) ? fs.statSync(activePath).size : 0;
    const reclaimedBytes = Math.max(0, beforeSizeBytes - afterSizeBytes);

    await AuditRepository.createLog({
      userId: user.id,
      userRole: user.role,
      action: 'DATABASE_OPTIMIZED',
      entityType: 'database',
      changesSummary: { beforeSizeBytes, afterSizeBytes, reclaimedBytes },
    });

    return { beforeSizeBytes, afterSizeBytes, reclaimedBytes };
  }

  // 11. Schema Migrations Status
  static async getMigrationStatus(user: SessionUser): Promise<MigrationStatusDto> {
    verifyPermission(user, 'backup:view');
    const sqlite = getSqlite();
    const applied = getAppliedMigrations(sqlite).map((m: any) => m.name);
    // Registered migrations in migrator.ts
    const registered = ['0001_initial_schema', '0002_roles_and_permissions'];
    const pending = registered.filter((r) => !applied.includes(r));

    return {
      currentVersion: applied.length,
      appliedMigrations: applied,
      pendingMigrations: pending,
    };
  }

  // 12. Run Pending Migrations
  static async runPendingMigrations(
    user: SessionUser
  ): Promise<{ appliedCount: number; migrations: string[] }> {
    verifyPermission(user, 'migrations:run');
    const sqlite = getSqlite();
    const result = applyMigrations(sqlite);

    await AuditRepository.createLog({
      userId: user.id,
      userRole: user.role,
      action: 'MIGRATIONS_EXECUTED',
      entityType: 'migrations',
      changesSummary: { appliedCount: result.appliedCount, migrations: result.migrations },
    });

    return result;
  }
}
