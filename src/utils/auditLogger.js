import pool from "../config/database.js"

/**
 * Log an action to the audit log
 * @param {Object} options - The options for the audit log
 * @param {number} options.userId - The ID of the user who performed the action
 * @param {string} options.action - The action that was performed
 * @param {string} options.entityType - The type of entity that was affected
 * @param {number} options.entityId - The ID of the entity that was affected
 * @param {Object} options.details - Additional details about the action
 * @param {string} options.ipAddress - The IP address of the user
 * @returns {Promise<boolean>} - Whether the log was created successfully
 */
export const logAction = async ({ userId, action, entityType, entityId, details, ipAddress }) => {
  try {
    await pool.query(
      `INSERT INTO audit_logs 
      (user_id, action, entity_type, entity_id, details, ip_address) 
      VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, action, entityType, entityId, details ? JSON.stringify(details) : null, ipAddress],
    )
    return true
  } catch (error) {
    console.error("Error creating audit log:", error)
    return false
  }
}

/**
 * Create a middleware to log actions
 * @param {string} action - The action that was performed
 * @param {string} entityType - The type of entity that was affected
 * @param {Function} getEntityId - A function that returns the entity ID from the request
 * @param {Function} getDetails - A function that returns additional details from the request
 * @returns {Function} - The middleware function
 */
export const createAuditLogMiddleware = (action, entityType, getEntityId, getDetails = null) => {
  return (req, res, next) => {
    // Store the original end method
    const originalEnd = res.end

    // Override the end method
    res.end = (chunk, encoding) => {
      // Restore the original end method
      res.end = originalEnd

      // Call the original end method
      res.end(chunk, encoding)

      // Only log successful operations (2xx status codes)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const entityId = getEntityId(req)
        const details = getDetails ? getDetails(req, res) : null

        logAction({
          userId: req.user.id,
          action,
          entityType,
          entityId,
          details,
          ipAddress: req.ip,
        }).catch((err) => console.error("Error logging action:", err))
      }
    }

    next()
  }
}

/**
 * Get audit logs
 * @param {Object} options - The options for retrieving audit logs
 * @param {number} options.userId - Filter by user ID
 * @param {string} options.action - Filter by action
 * @param {string} options.entityType - Filter by entity type
 * @param {number} options.entityId - Filter by entity ID
 * @param {string} options.startDate - Filter by start date
 * @param {string} options.endDate - Filter by end date
 * @param {number} options.limit - Limit the number of results
 * @param {number} options.offset - Offset for pagination
 * @returns {Promise<Array>} - The audit logs
 */
export const getAuditLogs = async ({
  userId,
  action,
  entityType,
  entityId,
  startDate,
  endDate,
  limit = 100,
  offset = 0,
}) => {
  try {
    let query = "SELECT * FROM audit_logs"
    const queryParams = []
    const conditions = []

    if (userId) {
      conditions.push("user_id = ?")
      queryParams.push(userId)
    }

    if (action) {
      conditions.push("action = ?")
      queryParams.push(action)
    }

    if (entityType) {
      conditions.push("entity_type = ?")
      queryParams.push(entityType)
    }

    if (entityId) {
      conditions.push("entity_id = ?")
      queryParams.push(entityId)
    }

    if (startDate) {
      conditions.push("created_at >= ?")
      queryParams.push(startDate)
    }

    if (endDate) {
      conditions.push("created_at <= ?")
      queryParams.push(endDate)
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ")
    }

    query += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
    queryParams.push(limit, offset)

    const [rows] = await pool.query(query, queryParams)

    // Parse details JSON
    rows.forEach((row) => {
      if (row.details) {
        try {
          row.details = JSON.parse(row.details)
        } catch (error) {
          console.error("Error parsing audit log details:", error)
        }
      }
    })

    return rows
  } catch (error) {
    console.error("Error getting audit logs:", error)
    return []
  }
}

