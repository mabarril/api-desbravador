import pool from "../config/database.js"
import AppError from "../utils/AppError.js"
import catchAsync from "../utils/catchAsync.js"

export const getAllMinutes = catchAsync(async (req, res) => {
  // Add filtering options
  const { startDate, endDate, search } = req.query

  let query = "SELECT * FROM minutes"
  const queryParams = []
  const conditions = []

  if (startDate) {
    conditions.push("meeting_date >= ?")
    queryParams.push(startDate)
  }

  if (endDate) {
    conditions.push("meeting_date <= ?")
    queryParams.push(endDate)
  }

  if (search) {
    conditions.push("(title LIKE ? OR content LIKE ? OR attendees LIKE ? OR decisions LIKE ?)")
    const searchTerm = `%${search}%`
    queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm)
  }

  if (conditions.length > 0) {
    query += " WHERE " + conditions.join(" AND ")
  }

  query += " ORDER BY meeting_date DESC"

  const [rows] = await pool.query(query, queryParams)

  res.status(200).json({
    status: "success",
    results: rows.length,
    data: {
      minutes: rows,
    },
  })
})

export const getMinute = catchAsync(async (req, res, next) => {
  const [rows] = await pool.query("SELECT * FROM minutes WHERE id = ?", [req.params.id])

  if (rows.length === 0) {
    return next(new AppError("No minutes found with that ID", 404))
  }

  // Get creator details if created_by exists
  let creator = null
  if (rows[0].created_by) {
    const [creatorRows] = await pool.query("SELECT id, name, email, role FROM users WHERE id = ?", [rows[0].created_by])
    if (creatorRows.length > 0) {
      creator = creatorRows[0]
    }
  }

  res.status(200).json({
    status: "success",
    data: {
      minute: {
        ...rows[0],
        creator,
      },
    },
  })
})

export const createMinute = catchAsync(async (req, res) => {
  const { title, meetingDate, content, attendees, decisions } = req.body

  const [result] = await pool.query(
    `INSERT INTO minutes 
    (title, meeting_date, content, attendees, decisions, created_by) 
    VALUES (?, ?, ?, ?, ?, ?)`,
    [title, meetingDate, content, attendees, decisions, req.user.id],
  )

  const [newMinute] = await pool.query("SELECT * FROM minutes WHERE id = ?", [result.insertId])

  res.status(201).json({
    status: "success",
    data: {
      minute: newMinute[0],
    },
  })
})

export const updateMinute = catchAsync(async (req, res, next) => {
  // First check if the minutes exist
  const [minute] = await pool.query("SELECT * FROM minutes WHERE id = ?", [req.params.id])

  if (minute.length === 0) {
    return next(new AppError("No minutes found with that ID", 404))
  }

  const { title, meetingDate, content, attendees, decisions } = req.body

  // Build the query dynamically based on provided fields
  let query = "UPDATE minutes SET "
  const values = []
  const updateFields = []

  if (title !== undefined) {
    updateFields.push("title = ?")
    values.push(title)
  }
  if (meetingDate !== undefined) {
    updateFields.push("meeting_date = ?")
    values.push(meetingDate)
  }
  if (content !== undefined) {
    updateFields.push("content = ?")
    values.push(content)
  }
  if (attendees !== undefined) {
    updateFields.push("attendees = ?")
    values.push(attendees)
  }
  if (decisions !== undefined) {
    updateFields.push("decisions = ?")
    values.push(decisions)
  }

  // Add updated_at timestamp
  updateFields.push("updated_at = NOW()")

  // If no fields to update, return the existing minutes
  if (updateFields.length === 0) {
    return res.status(200).json({
      status: "success",
      data: {
        minute: minute[0],
      },
    })
  }

  query += updateFields.join(", ")
  query += " WHERE id = ?"
  values.push(req.params.id)

  await pool.query(query, values)

  // Get the updated minutes
  const [updatedMinute] = await pool.query("SELECT * FROM minutes WHERE id = ?", [req.params.id])

  res.status(200).json({
    status: "success",
    data: {
      minute: updatedMinute[0],
    },
  })
})

export const deleteMinute = catchAsync(async (req, res, next) => {
  const [result] = await pool.query("DELETE FROM minutes WHERE id = ?", [req.params.id])

  if (result.affectedRows === 0) {
    return next(new AppError("No minutes found with that ID", 404))
  }

  res.status(204).json({
    status: "success",
    data: null,
  })
})

// Search minutes
export const searchMinutes = catchAsync(async (req, res) => {
  const { query } = req.query

  if (!query) {
    return res.status(400).json({
      status: "fail",
      message: "Search query is required",
    })
  }

  const searchTerm = `%${query}%`

  const [rows] = await pool.query(
    `SELECT * FROM minutes 
     WHERE title LIKE ? OR content LIKE ? OR attendees LIKE ? OR decisions LIKE ? 
     ORDER BY meeting_date DESC`,
    [searchTerm, searchTerm, searchTerm, searchTerm],
  )

  res.status(200).json({
    status: "success",
    results: rows.length,
    data: {
      minutes: rows,
    },
  })
})

