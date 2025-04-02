import { createBackup, restoreBackup, getBackups, deleteBackup } from "../utils/backup.js"
import catchAsync from "../utils/catchAsync.js"
import AppError from "../utils/AppError.js"
import { logAction } from "../utils/auditLogger.js"

export const createDatabaseBackup = catchAsync(async (req, res, next) => {
  const { filename } = req.body

  try {
    const backupPath = await createBackup(filename)

    // Log the action
    await logAction({
      userId: req.user.id,
      action: "create_backup",
      entityType: "backup",
      entityId: null,
      details: { filename, path: backupPath },
      ipAddress: req.ip,
    })

    res.status(200).json({
      status: "success",
      message: "Backup created successfully",
      data: {
        path: backupPath,
      },
    })
  } catch (error) {
    return next(new AppError(`Failed to create backup: ${error.message}`, 500))
  }
})

export const restoreDatabaseFromBackup = catchAsync(async (req, res, next) => {
  const { filename } = req.params

  try {
    const backups = await getBackups()
    const backup = backups.find((b) => b.filename === filename)

    if (!backup) {
      return next(new AppError("Backup not found", 404))
    }

    await restoreBackup(backup.path)

    // Log the action
    await logAction({
      userId: req.user.id,
      action: "restore_backup",
      entityType: "backup",
      entityId: null,
      details: { filename, path: backup.path },
      ipAddress: req.ip,
    })

    res.status(200).json({
      status: "success",
      message: "Database restored successfully",
    })
  } catch (error) {
    return next(new AppError(`Failed to restore backup: ${error.message}`, 500))
  }
})

export const getAllBackups = catchAsync(async (req, res, next) => {
  try {
    const backups = await getBackups()

    res.status(200).json({
      status: "success",
      results: backups.length,
      data: {
        backups,
      },
    })
  } catch (error) {
    return next(new AppError(`Failed to get backups: ${error.message}`, 500))
  }
})

export const deleteBackupFile = catchAsync(async (req, res, next) => {
  const { filename } = req.params

  try {
    await deleteBackup(filename)

    // Log the action
    await logAction({
      userId: req.user.id,
      action: "delete_backup",
      entityType: "backup",
      entityId: null,
      details: { filename },
      ipAddress: req.ip,
    })

    res.status(200).json({
      status: "success",
      message: "Backup deleted successfully",
    })
  } catch (error) {
    return next(new AppError(`Failed to delete backup: ${error.message}`, 500))
  }
})

