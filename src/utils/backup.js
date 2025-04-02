import { exec } from "child_process"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import dotenv from "dotenv"

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Create backups directory if it doesn't exist
const backupsDir = path.join(__dirname, "..", "..", "backups")
if (!fs.existsSync(backupsDir)) {
  fs.mkdirSync(backupsDir, { recursive: true })
}

/**
 * Create a database backup
 * @param {string} filename - The filename for the backup (without extension)
 * @returns {Promise<string>} - The path to the backup file
 */
export const createBackup = (filename = null) => {
  return new Promise((resolve, reject) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
    const backupFilename = filename ? `${filename}.sql` : `backup-${timestamp}.sql`
    const backupPath = path.join(backupsDir, backupFilename)

    const command = `mysqldump --host=${process.env.DB_HOST} --user=${process.env.DB_USER} --password=${process.env.DB_PASSWORD} ${process.env.DB_NAME} > ${backupPath}`

    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error creating backup: ${error.message}`)
        return reject(error)
      }
      if (stderr) {
        console.error(`Backup stderr: ${stderr}`)
      }

      console.log(`Backup created at ${backupPath}`)
      resolve(backupPath)
    })
  })
}

/**
 * Restore a database from a backup
 * @param {string} backupPath - The path to the backup file
 * @returns {Promise<boolean>} - Whether the restore was successful
 */
export const restoreBackup = (backupPath) => {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(backupPath)) {
      return reject(new Error(`Backup file not found: ${backupPath}`))
    }

    const command = `mysql --host=${process.env.DB_HOST} --user=${process.env.DB_USER} --password=${process.env.DB_PASSWORD} ${process.env.DB_NAME} < ${backupPath}`

    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error restoring backup: ${error.message}`)
        return reject(error)
      }
      if (stderr) {
        console.error(`Restore stderr: ${stderr}`)
      }

      console.log(`Backup restored from ${backupPath}`)
      resolve(true)
    })
  })
}

/**
 * Get a list of available backups
 * @returns {Promise<Array>} - The list of backups
 */
export const getBackups = () => {
  return new Promise((resolve, reject) => {
    fs.readdir(backupsDir, (error, files) => {
      if (error) {
        console.error(`Error reading backups directory: ${error.message}`)
        return reject(error)
      }

      const backups = files
        .filter((file) => file.endsWith(".sql"))
        .map((file) => {
          const filePath = path.join(backupsDir, file)
          const stats = fs.statSync(filePath)

          return {
            filename: file,
            path: filePath,
            size: stats.size,
            created: stats.mtime,
          }
        })
        .sort((a, b) => b.created - a.created) // Sort by date, newest first

      resolve(backups)
    })
  })
}

/**
 * Delete a backup
 * @param {string} filename - The filename of the backup to delete
 * @returns {Promise<boolean>} - Whether the delete was successful
 */
export const deleteBackup = (filename) => {
  return new Promise((resolve, reject) => {
    const backupPath = path.join(backupsDir, filename)

    if (!fs.existsSync(backupPath)) {
      return reject(new Error(`Backup file not found: ${backupPath}`))
    }

    fs.unlink(backupPath, (error) => {
      if (error) {
        console.error(`Error deleting backup: ${error.message}`)
        return reject(error)
      }

      console.log(`Backup deleted: ${backupPath}`)
      resolve(true)
    })
  })
}

/**
 * Schedule automatic backups
 * @param {number} intervalHours - The interval in hours between backups
 */
export const scheduleBackups = (intervalHours = 24) => {
  console.log(`Scheduling automatic backups every ${intervalHours} hours`)

  // Create an initial backup
  createBackup(`auto-backup-initial`)
    .then(() => console.log("Initial backup created"))
    .catch((error) => console.error("Error creating initial backup:", error))

  // Schedule regular backups
  setInterval(
    () => {
      const timestamp = new Date().toISOString().split("T")[0]
      createBackup(`auto-backup-${timestamp}`)
        .then(() => console.log(`Scheduled backup created: ${timestamp}`))
        .catch((error) => console.error("Error creating scheduled backup:", error))
    },
    intervalHours * 60 * 60 * 1000,
  )
}

