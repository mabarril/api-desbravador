import pool from "../config/database.js"
import AppError from "../utils/AppError.js"
import catchAsync from "../utils/catchAsync.js"
import { createNotification } from "./notification.controller.js"

export const getAllMessages = catchAsync(async (req, res, next) => {
  const { folder } = req.query
  const userId = req.user.id

  let query
  let queryParams

  if (folder === "sent") {
    query = `
      SELECT m.*, 
        u.name as recipient_name, u.email as recipient_email,
        NULL as sender_name, NULL as sender_email
      FROM messages m
      JOIN users u ON m.recipient_id = u.id
      WHERE m.sender_id = ? AND m.parent_id IS NULL
      ORDER BY m.created_at DESC
    `
    queryParams = [userId]
  } else if (folder === "inbox") {
    query = `
      SELECT m.*, 
        NULL as recipient_name, NULL as recipient_email,
        u.name as sender_name, u.email as sender_email
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.recipient_id = ? AND m.parent_id IS NULL
      ORDER BY m.created_at DESC
    `
    queryParams = [userId]
  } else {
    return next(new AppError("Invalid folder specified", 400))
  }

  const [rows] = await pool.query(query, queryParams)

  res.status(200).json({
    status: "success",
    results: rows.length,
    data: {
      messages: rows,
    },
  })
})

export const getMessage = catchAsync(async (req, res, next) => {
  const { id } = req.params
  const userId = req.user.id

  // Get the main message
  const [messages] = await pool.query(
    `SELECT m.*, 
      CASE WHEN m.recipient_id = ? THEN NULL ELSE u_recipient.name END as recipient_name,
      CASE WHEN m.recipient_id = ? THEN NULL ELSE u_recipient.email END as recipient_email,
      CASE WHEN m.sender_id = ? THEN NULL ELSE u_sender.name END as sender_name,
      CASE WHEN m.sender_id = ? THEN NULL ELSE u_sender.email END as sender_email
    FROM messages m
    JOIN users u_sender ON m.sender_id = u_sender.id
    JOIN users u_recipient ON m.recipient_id = u_recipient.id
    WHERE m.id = ? AND (m.sender_id = ? OR m.recipient_id = ?)`,
    [userId, userId, userId, userId, id, userId, userId],
  )

  if (messages.length === 0) {
    return next(new AppError("Message not found or you do not have permission to view it", 404))
  }

  // Mark as read if recipient is viewing
  if (messages[0].recipient_id === userId && !messages[0].is_read) {
    await pool.query("UPDATE messages SET is_read = TRUE WHERE id = ?", [id])
    messages[0].is_read = true
  }

  // Get thread messages (replies)
  const [thread] = await pool.query(
    `SELECT m.*, 
      CASE WHEN m.recipient_id = ? THEN NULL ELSE u_recipient.name END as recipient_name,
      CASE WHEN m.recipient_id = ? THEN NULL ELSE u_recipient.email END as recipient_email,
      CASE WHEN m.sender_id = ? THEN NULL ELSE u_sender.name END as sender_name,
      CASE WHEN m.sender_id = ? THEN NULL ELSE u_sender.email END as sender_email
    FROM messages m
    JOIN users u_sender ON m.sender_id = u_sender.id
    JOIN users u_recipient ON m.recipient_id = u_recipient.id
    WHERE (m.id = ? OR m.parent_id = ?) AND (m.sender_id = ? OR m.recipient_id = ?)
    ORDER BY m.created_at ASC`,
    [userId, userId, userId, userId, id, id, userId, userId],
  )

  res.status(200).json({
    status: "success",
    data: {
      message: messages[0],
      thread,
    },
  })
})

export const sendMessage = catchAsync(async (req, res, next) => {
  const { recipientId, subject, content, parentId } = req.body
  const senderId = req.user.id

  // Check if recipient exists
  const [recipient] = await pool.query("SELECT * FROM users WHERE id = ?", [recipientId])

  if (recipient.length === 0) {
    return next(new AppError("Recipient not found", 404))
  }

  // Check if parent message exists if parentId is provided
  if (parentId) {
    const [parentMessage] = await pool.query(
      "SELECT * FROM messages WHERE id = ? AND (sender_id = ? OR recipient_id = ?)",
      [parentId, senderId, senderId],
    )

    if (parentMessage.length === 0) {
      return next(new AppError("Parent message not found or you do not have permission to reply to it", 404))
    }
  }

  // Send message
  const [result] = await pool.query(
    "INSERT INTO messages (sender_id, recipient_id, subject, content, parent_id) VALUES (?, ?, ?, ?, ?)",
    [senderId, recipientId, subject, content, parentId],
  )

  // Create notification for recipient
  await createNotification(
    recipientId,
    "New Message",
    `You have received a new message${subject ? ": " + subject : ""}`,
    "info",
    "message",
    result.insertId,
  )

  // Get the sent message
  const [message] = await pool.query(
    `SELECT m.*, 
      u.name as recipient_name, u.email as recipient_email,
      NULL as sender_name, NULL as sender_email
    FROM messages m
    JOIN users u ON m.recipient_id = u.id
    WHERE m.id = ?`,
    [result.insertId],
  )

  res.status(201).json({
    status: "success",
    data: {
      message: message[0],
    },
  })
})

export const deleteMessage = catchAsync(async (req, res, next) => {
  const { id } = req.params
  const userId = req.user.id

  // Check if message exists and belongs to user
  const [message] = await pool.query("SELECT * FROM messages WHERE id = ? AND (sender_id = ? OR recipient_id = ?)", [
    id,
    userId,
    userId,
  ])

  if (message.length === 0) {
    return next(new AppError("Message not found or you do not have permission to delete it", 404))
  }

  // Delete message
  await pool.query("DELETE FROM messages WHERE id = ?", [id])

  res.status(204).json({
    status: "success",
    data: null,
  })
})

export const getUnreadCount = catchAsync(async (req, res) => {
  const userId = req.user.id

  const [result] = await pool.query(
    "SELECT COUNT(*) as count FROM messages WHERE recipient_id = ? AND is_read = FALSE",
    [userId],
  )

  res.status(200).json({
    status: "success",
    data: {
      unreadCount: result[0].count,
    },
  })
})

export const markAsRead = catchAsync(async (req, res, next) => {
  const { id } = req.params
  const userId = req.user.id

  // Check if message exists and user is the recipient
  const [message] = await pool.query("SELECT * FROM messages WHERE id = ? AND recipient_id = ?", [id, userId])

  if (message.length === 0) {
    return next(new AppError("Message not found or you are not the recipient", 404))
  }

  // Mark as read
  await pool.query("UPDATE messages SET is_read = TRUE WHERE id = ?", [id])

  res.status(200).json({
    status: "success",
    message: "Message marked as read",
  })
})

export const markAllAsRead = catchAsync(async (req, res) => {
  const userId = req.user.id

  // Mark all messages as read
  await pool.query("UPDATE messages SET is_read = TRUE WHERE recipient_id = ? AND is_read = FALSE", [userId])

  res.status(200).json({
    status: "success",
    message: "All messages marked as read",
  })
})

