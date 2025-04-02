import pool from "../config/database.js"
import AppError from "../utils/AppError.js"
import catchAsync from "../utils/catchAsync.js"
import { logAction } from "../utils/auditLogger.js"

export const getAllSettings = catchAsync(async (req, res) => {
  // Determine which settings to return based on user role
  let query = "SELECT * FROM settings"

  if (req.user.role !== "admin") {
    query += " WHERE is_public = TRUE"
  }

  const [rows] = await pool.query(query)

  res.status(200).json({
    status: "success",
    results: rows.length,
    data: {
      settings: rows,
    },
  })
})

export const getSetting = catchAsync(async (req, res, next) => {
  const { key } = req.params

  // Determine which settings to return based on user role
  let query = "SELECT * FROM settings WHERE setting_key = ?"
  const queryParams = [key]

  if (req.user.role !== "admin") {
    query += " AND is_public = TRUE"
  }

  const [rows] = await pool.query(query, queryParams)

  if (rows.length === 0) {
    return next(new AppError("Setting not found or you do not have permission to access it", 404))
  }

  res.status(200).json({
    status: "success",
    data: {
      setting: rows[0],
    },
  })
})

export const createSetting = catchAsync(async (req, res, next) => {
  const { key, value, description, isPublic } = req.body

  // Check if setting already exists
  const [existingSetting] = await pool.query("SELECT * FROM settings WHERE setting_key = ?", [key])

  if (existingSetting.length > 0) {
    return next(new AppError("Setting with this key already exists", 400))
  }

  // Create setting
  const [result] = await pool.query(
    "INSERT INTO settings (setting_key, setting_value, description, is_public) VALUES (?, ?, ?, ?)",
    [key, value, description, isPublic],
  )

  // Log the action
  await logAction({
    userId: req.user.id,
    action: "create_setting",
    entityType: "setting",
    entityId: result.insertId,
    details: { key, isPublic },
    ipAddress: req.ip,
  })

  // Get the created setting
  const [setting] = await pool.query("SELECT * FROM settings WHERE id = ?", [result.insertId])

  res.status(201).json({
    status: "success",
    data: {
      setting: setting[0],
    },
  })
})

export const updateSetting = catchAsync(async (req, res, next) => {
  const { key } = req.params
  const { value, description, isPublic } = req.body

  // Check if setting exists
  const [existingSetting] = await pool.query("SELECT * FROM settings WHERE setting_key = ?", [key])

  if (existingSetting.length === 0) {
    return next(new AppError("Setting not found", 404))
  }

  // Update setting
  await pool.query(
    "UPDATE settings SET setting_value = ?, description = ?, is_public = ?, updated_at = NOW() WHERE setting_key = ?",
    [value, description, isPublic, key],
  )

  // Log the action
  await logAction({
    userId: req.user.id,
    action: "update_setting",
    entityType: "setting",
    entityId: existingSetting[0].id,
    details: { key, isPublic },
    ipAddress: req.ip,
  })

  // Get the updated setting
  const [setting] = await pool.query("SELECT * FROM settings WHERE setting_key = ?", [key])

  res.status(200).json({
    status: "success",
    data: {
      setting: setting[0],
    },
  })
})

export const deleteSetting = catchAsync(async (req, res, next) => {
  const { key } = req.params

  // Check if setting exists
  const [existingSetting] = await pool.query("SELECT * FROM settings WHERE setting_key = ?", [key])

  if (existingSetting.length === 0) {
    return next(new AppError("Setting not found", 404))
  }

  // Delete setting
  await pool.query("DELETE FROM settings WHERE setting_key = ?", [key])

  // Log the action
  await logAction({
    userId: req.user.id,
    action: "delete_setting",
    entityType: "setting",
    entityId: existingSetting[0].id,
    details: { key },
    ipAddress: req.ip,
  })

  res.status(204).json({
    status: "success",
    data: null,
  })
})

// Initialize default settings
export const initializeSettings = async () => {
  try {
    console.log("Initializing default settings...")

    const defaultSettings = [
      {
        key: "club_name",
        value: "Pathfinder Club",
        description: "The name of the Pathfinder club",
        isPublic: true,
      },
      {
        key: "club_email",
        value: "contact@pathfinderclub.org",
        description: "The contact email for the Pathfinder club",
        isPublic: true,
      },
      {
        key: "registration_fee",
        value: "50.00",
        description: "The registration fee amount in USD",
        isPublic: true,
      },
      {
        key: "monthly_fee",
        value: "10.00",
        description: "The monthly fee amount in USD",
        isPublic: true,
      },
      {
        key: "allow_registrations",
        value: "true",
        description: "Whether to allow new registrations",
        isPublic: false,
      },
      {
        key: "maintenance_mode",
        value: "false",
        description: "Whether the system is in maintenance mode",
        isPublic: false,
      },
    ]

    for (const setting of defaultSettings) {
      // Check if setting already exists
      const [existingSetting] = await pool.query("SELECT * FROM settings WHERE setting_key = ?", [setting.key])

      if (existingSetting.length === 0) {
        // Create setting
        await pool.query(
          "INSERT INTO settings (setting_key, setting_value, description, is_public) VALUES (?, ?, ?, ?)",
          [setting.key, setting.value, setting.description, setting.isPublic],
        )
        console.log(`Created setting: ${setting.key}`)
      }
    }

    console.log("Default settings initialized")
  } catch (error) {
    console.error("Error initializing settings:", error)
  }
}

