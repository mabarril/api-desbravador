import pool from "../config/database.js"
import AppError from "../utils/AppError.js"
import catchAsync from "../utils/catchAsync.js"
import { logAction } from "../utils/auditLogger.js"

export const getAllPermissions = catchAsync(async (req, res) => {
  const [rows] = await pool.query("SELECT * FROM role_permissions ORDER BY role, resource")

  res.status(200).json({
    status: "success",
    results: rows.length,
    data: {
      permissions: rows,
    },
  })
})

export const getPermissionsByRole = catchAsync(async (req, res, next) => {
  const { role } = req.params

  // Validate role
  if (!["admin", "director", "leader", "user"].includes(role)) {
    return next(new AppError("Invalid role", 400))
  }

  const [rows] = await pool.query("SELECT * FROM role_permissions WHERE role = ? ORDER BY resource", [role])

  res.status(200).json({
    status: "success",
    results: rows.length,
    data: {
      role,
      permissions: rows,
    },
  })
})

export const createPermission = catchAsync(async (req, res, next) => {
  const { role, resource, action } = req.body

  // Check if permission already exists
  const [existingPermission] = await pool.query(
    "SELECT * FROM role_permissions WHERE role = ? AND resource = ? AND action = ?",
    [role, resource, action],
  )

  if (existingPermission.length > 0) {
    return next(new AppError("Permission already exists", 400))
  }

  // Create permission
  const [result] = await pool.query("INSERT INTO role_permissions (role, resource, action) VALUES (?, ?, ?)", [
    role,
    resource,
    action,
  ])

  // Log the action
  await logAction({
    userId: req.user.id,
    action: "create_permission",
    entityType: "permission",
    entityId: result.insertId,
    details: { role, resource, action },
    ipAddress: req.ip,
  })

  // Get the created permission
  const [permission] = await pool.query("SELECT * FROM role_permissions WHERE id = ?", [result.insertId])

  res.status(201).json({
    status: "success",
    data: {
      permission: permission[0],
    },
  })
})

export const deletePermission = catchAsync(async (req, res, next) => {
  const { id } = req.params

  // Check if permission exists
  const [existingPermission] = await pool.query("SELECT * FROM role_permissions WHERE id = ?", [id])

  if (existingPermission.length === 0) {
    return next(new AppError("Permission not found", 404))
  }

  // Delete permission
  await pool.query("DELETE FROM role_permissions WHERE id = ?", [id])

  // Log the action
  await logAction({
    userId: req.user.id,
    action: "delete_permission",
    entityType: "permission",
    entityId: id,
    details: {
      role: existingPermission[0].role,
      resource: existingPermission[0].resource,
      action: existingPermission[0].action,
    },
    ipAddress: req.ip,
  })

  res.status(204).json({
    status: "success",
    data: null,
  })
})

export const initializeDefaultPermissions = async () => {
  try {
    console.log("Initializing default permissions...")

    const defaultPermissions = [
      // Admin permissions - full access to everything
      { role: "admin", resource: "all", action: "manage" },

      // Director permissions
      { role: "director", resource: "pathfinder", action: "manage" },
      { role: "director", resource: "unit", action: "manage" },
      { role: "director", resource: "class", action: "manage" },
      { role: "director", resource: "specialty", action: "manage" },
      { role: "director", resource: "event", action: "manage" },
      { role: "director", resource: "calendar_event", action: "manage" },
      { role: "director", resource: "attendance", action: "manage" },
      { role: "director", resource: "cash_book", action: "manage" },
      { role: "director", resource: "payment", action: "manage" },
      { role: "director", resource: "report", action: "read" },
      { role: "director", resource: "document", action: "manage" },
      { role: "director", resource: "message", action: "manage" },
      { role: "director", resource: "user", action: "read" },

      // Leader permissions
      { role: "leader", resource: "pathfinder", action: "read" },
      { role: "leader", resource: "unit", action: "read" },
      { role: "leader", resource: "class", action: "read" },
      { role: "leader", resource: "specialty", action: "read" },
      { role: "leader", resource: "event", action: "read" },
      { role: "leader", resource: "calendar_event", action: "create" },
      { role: "leader", resource: "calendar_event", action: "read" },
      { role: "leader", resource: "attendance", action: "create" },
      { role: "leader", resource: "attendance", action: "read" },
      { role: "leader", resource: "document", action: "read" },
      { role: "leader", resource: "message", action: "manage" },

      // User permissions
      { role: "user", resource: "pathfinder", action: "read" },
      { role: "user", resource: "unit", action: "read" },
      { role: "user", resource: "class", action: "read" },
      { role: "user", resource: "specialty", action: "read" },
      { role: "user", resource: "event", action: "read" },
      { role: "user", resource: "calendar_event", action: "read" },
      { role: "user", resource: "document", action: "read" },
      { role: "user", resource: "message", action: "manage" },
    ]

    for (const permission of defaultPermissions) {
      // Check if permission already exists
      const [existingPermission] = await pool.query(
        "SELECT * FROM role_permissions WHERE role = ? AND resource = ? AND action = ?",
        [permission.role, permission.resource, permission.action],
      )

      if (existingPermission.length === 0) {
        // Create permission
        await pool.query("INSERT INTO role_permissions (role, resource, action) VALUES (?, ?, ?)", [
          permission.role,
          permission.resource,
          permission.action,
        ])
        console.log(`Created permission: ${permission.role} - ${permission.resource} - ${permission.action}`)
      }
    }

    console.log("Default permissions initialized")
  } catch (error) {
    console.error("Error initializing permissions:", error)
  }
}

// Check if a user has permission to perform an action on a resource
export const hasPermission = async (userId, resource, action) => {
  try {
    // Get user role
    const [user] = await pool.query("SELECT role FROM users WHERE id = ?", [userId])

    if (user.length === 0) {
      return false
    }

    const role = user[0].role

    // Admin has all permissions
    if (role === "admin") {
      return true
    }

    // Check for specific permission
    const [permission] = await pool.query(
      'SELECT * FROM role_permissions WHERE role = ? AND (resource = ? OR resource = "all") AND (action = ? OR action = "manage")',
      [role, resource, action],
    )

    return permission.length > 0
  } catch (error) {
    console.error("Error checking permission:", error)
    return false
  }
}

// Middleware to check permissions
export const checkPermission = (resource, action) => {
  return catchAsync(async (req, res, next) => {
    const hasAccess = await hasPermission(req.user.id, resource, action)

    if (!hasAccess) {
      return next(new AppError("You do not have permission to perform this action", 403))
    }

    next()
  })
}

