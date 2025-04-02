import pool from "../config/database.js"
import AppError from "../utils/AppError.js"
import catchAsync from "../utils/catchAsync.js"

export const getAllNotifications = catchAsync(async (req, res) => {
  const { isRead } = req.query

  let query = "SELECT * FROM notifications WHERE user_id = ?"
  const queryParams = [req.user.id]

  if (isRead !== undefined) {
    query += " AND is_read = ?"
    queryParams.push(isRead === "true")
  }

  query += " ORDER BY created_at DESC"

  const [rows] = await pool.query(query, queryParams)

  // Count unread notifications
  const [unreadCount] = await pool.query(
    "SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = FALSE",
    [req.user.id],
  )

  res.status(200).json({
    status: "success",
    results: rows.length,
    unreadCount: unreadCount[0].count,
    data: {
      notifications: rows,
    },
  })
})

export const getNotification = catchAsync(async (req, res, next) => {
  const [rows] = await pool.query("SELECT * FROM notifications WHERE id = ? AND user_id = ?", [
    req.params.id,
    req.user.id,
  ])

  if (rows.length === 0) {
    return next(new AppError("No notification found with that ID", 404))
  }

  res.status(200).json({
    status: "success",
    data: {
      notification: rows[0],
    },
  })
})

export const markNotificationAsRead = catchAsync(async (req, res, next) => {
  const [result] = await pool.query("UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?", [
    req.params.id,
    req.user.id,
  ])

  if (result.affectedRows === 0) {
    return next(new AppError("No notification found with that ID", 404))
  }

  res.status(200).json({
    status: "success",
    message: "Notification marked as read",
  })
})

export const markAllNotificationsAsRead = catchAsync(async (req, res) => {
  await pool.query("UPDATE notifications SET is_read = TRUE WHERE user_id = ?", [req.user.id])

  res.status(200).json({
    status: "success",
    message: "All notifications marked as read",
  })
})

export const deleteNotification = catchAsync(async (req, res, next) => {
  const [result] = await pool.query("DELETE FROM notifications WHERE id = ? AND user_id = ?", [
    req.params.id,
    req.user.id,
  ])

  if (result.affectedRows === 0) {
    return next(new AppError("No notification found with that ID", 404))
  }

  res.status(204).json({
    status: "success",
    data: null,
  })
})

export const deleteAllNotifications = catchAsync(async (req, res) => {
  await pool.query("DELETE FROM notifications WHERE user_id = ?", [req.user.id])

  res.status(204).json({
    status: "success",
    data: null,
  })
})

// Create a notification (for internal use)
export const createNotification = async (
  userId,
  title,
  message,
  type = "info",
  relatedType = null,
  relatedId = null,
) => {
  try {
    await pool.query(
      `INSERT INTO notifications 
      (user_id, title, message, type, related_type, related_id) 
      VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, title, message, type, relatedType, relatedId],
    )
    return true
  } catch (error) {
    console.error("Error creating notification:", error)
    return false
  }
}

// Create notifications for multiple users (for internal use)
export const createNotificationForUsers = async (
  userIds,
  title,
  message,
  type = "info",
  relatedType = null,
  relatedId = null,
) => {
  try {
    const connection = await pool.getConnection()
    await connection.beginTransaction()

    try {
      for (const userId of userIds) {
        await connection.query(
          `INSERT INTO notifications 
          (user_id, title, message, type, related_type, related_id) 
          VALUES (?, ?, ?, ?, ?, ?)`,
          [userId, title, message, type, relatedType, relatedId],
        )
      }

      await connection.commit()
      return true
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  } catch (error) {
    console.error("Error creating notifications for users:", error)
    return false
  }
}

// Create notifications for all users with specific roles (for internal use)
export const createNotificationForRoles = async (
  roles,
  title,
  message,
  type = "info",
  relatedType = null,
  relatedId = null,
) => {
  try {
    // Get all users with the specified roles
    const [users] = await pool.query("SELECT id FROM users WHERE role IN (?)", [roles])

    const userIds = users.map((user) => user.id)

    if (userIds.length > 0) {
      return await createNotificationForUsers(userIds, title, message, type, relatedType, relatedId)
    }

    return true
  } catch (error) {
    console.error("Error creating notifications for roles:", error)
    return false
  }
}

