import { getAuditLogs } from "../utils/auditLogger.js"
import catchAsync from "../utils/catchAsync.js"
import pool from "../config/database.js"

export const getAuditLogEntries = catchAsync(async (req, res) => {
  const { userId, action, entityType, entityId, startDate, endDate, limit, offset } = req.query

  const logs = await getAuditLogs({
    userId: userId ? Number.parseInt(userId) : null,
    action,
    entityType,
    entityId: entityId ? Number.parseInt(entityId) : null,
    startDate,
    endDate,
    limit: limit ? Number.parseInt(limit) : 100,
    offset: offset ? Number.parseInt(offset) : 0,
  })

  // Get user details for each log
  const userIds = [...new Set(logs.filter((log) => log.user_id).map((log) => log.user_id))]

  let users = {}
  if (userIds.length > 0) {
    const [userRows] = await pool.query("SELECT id, name, email, role FROM users WHERE id IN (?)", [userIds])

    users = userRows.reduce((acc, user) => {
      acc[user.id] = user
      return acc
    }, {})
  }

  // Add user details to logs
  const logsWithUserDetails = logs.map((log) => ({
    ...log,
    user: log.user_id ? users[log.user_id] : null,
  }))

  res.status(200).json({
    status: "success",
    results: logsWithUserDetails.length,
    data: {
      logs: logsWithUserDetails,
    },
  })
})

export const getEntityAuditLog = catchAsync(async (req, res) => {
  const { entityType, entityId } = req.params

  const logs = await getAuditLogs({
    entityType,
    entityId: Number.parseInt(entityId),
  })

  // Get user details for each log
  const userIds = [...new Set(logs.filter((log) => log.user_id).map((log) => log.user_id))]

  let users = {}
  if (userIds.length > 0) {
    const [userRows] = await pool.query("SELECT id, name, email, role FROM users WHERE id IN (?)", [userIds])

    users = userRows.reduce((acc, user) => {
      acc[user.id] = user
      return acc
    }, {})
  }

  // Add user details to logs
  const logsWithUserDetails = logs.map((log) => ({
    ...log,
    user: log.user_id ? users[log.user_id] : null,
  }))

  res.status(200).json({
    status: "success",
    results: logsWithUserDetails.length,
    data: {
      entityType,
      entityId: Number.parseInt(entityId),
      logs: logsWithUserDetails,
    },
  })
})

export const getUserAuditLog = catchAsync(async (req, res) => {
  const { userId } = req.params

  const logs = await getAuditLogs({
    userId: Number.parseInt(userId),
  })

  // Get user details
  const [userRows] = await pool.query("SELECT id, name, email, role FROM users WHERE id = ?", [userId])

  if (userRows.length === 0) {
    return res.status(404).json({
      status: "fail",
      message: "No user found with that ID",
    })
  }

  res.status(200).json({
    status: "success",
    results: logs.length,
    data: {
      user: userRows[0],
      logs,
    },
  })
})

