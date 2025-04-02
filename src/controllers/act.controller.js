import pool from "../config/database.js"
import AppError from "../utils/AppError.js"
import catchAsync from "../utils/catchAsync.js"

export const getAllActs = catchAsync(async (req, res) => {
  // Add filtering options
  const { startDate, endDate, search } = req.query

  let query = "SELECT * FROM acts"
  const queryParams = []
  const conditions = []

  if (startDate) {
    conditions.push("act_date >= ?")
    queryParams.push(startDate)
  }

  if (endDate) {
    conditions.push("act_date <= ?")
    queryParams.push(endDate)
  }

  if (search) {
    conditions.push("(title LIKE ? OR description LIKE ? OR location LIKE ? OR participants LIKE ?)")
    const searchTerm = `%${search}%`
    queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm)
  }

  if (conditions.length > 0) {
    query += " WHERE " + conditions.join(" AND ")
  }

  query += " ORDER BY act_date DESC"

  const [rows] = await pool.query(query, queryParams)

  res.status(200).json({
    status: "success",
    results: rows.length,
    data: {
      acts: rows,
    },
  })
})

export const getAct = catchAsync(async (req, res, next) => {
  const [rows] = await pool.query("SELECT * FROM acts WHERE id = ?", [req.params.id])

  if (rows.length === 0) {
    return next(new AppError("No act found with that ID", 404))
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
      act: {
        ...rows[0],
        creator,
      },
    },
  })
})

export const createAct = catchAsync(async (req, res) => {
  const { title, description, actDate, location, participants } = req.body

  const [result] = await pool.query(
    `INSERT INTO acts 
    (title, description, act_date, location, participants, created_by) 
    VALUES (?, ?, ?, ?, ?, ?)`,
    [title, description, actDate, location, participants, req.user.id],
  )

  const [newAct] = await pool.query("SELECT * FROM acts WHERE id = ?", [result.insertId])

  res.status(201).json({
    status: "success",
    data: {
      act: newAct[0],
    },
  })
})

export const updateAct = catchAsync(async (req, res, next) => {
  // First check if the act exists
  const [act] = await pool.query("SELECT * FROM acts WHERE id = ?", [req.params.id])

  if (act.length === 0) {
    return next(new AppError("No act found with that ID", 404))
  }

  const { title, description, actDate, location, participants } = req.body

  // Build the query dynamically based on provided fields
  let query = "UPDATE acts SET "
  const values = []
  const updateFields = []

  if (title !== undefined) {
    updateFields.push("title = ?")
    values.push(title)
  }
  if (description !== undefined) {
    updateFields.push("description = ?")
    values.push(description)
  }
  if (actDate !== undefined) {
    updateFields.push("act_date = ?")
    values.push(actDate)
  }
  if (location !== undefined) {
    updateFields.push("location = ?")
    values.push(location)
  }
  if (participants !== undefined) {
    updateFields.push("participants = ?")
    values.push(participants)
  }

  // Add updated_at timestamp
  updateFields.push("updated_at = NOW()")

  // If no fields to update, return the existing act
  if (updateFields.length === 0) {
    return res.status(200).json({
      status: "success",
      data: {
        act: act[0],
      },
    })
  }

  query += updateFields.join(", ")
  query += " WHERE id = ?"
  values.push(req.params.id)

  await pool.query(query, values)

  // Get the updated act
  const [updatedAct] = await pool.query("SELECT * FROM acts WHERE id = ?", [req.params.id])

  res.status(200).json({
    status: "success",
    data: {
      act: updatedAct[0],
    },
  })
})

export const deleteAct = catchAsync(async (req, res, next) => {
  const [result] = await pool.query("DELETE FROM acts WHERE id = ?", [req.params.id])

  if (result.affectedRows === 0) {
    return next(new AppError("No act found with that ID", 404))
  }

  res.status(204).json({
    status: "success",
    data: null,
  })
})

// Search acts
export const searchActs = catchAsync(async (req, res) => {
  const { query } = req.query

  if (!query) {
    return res.status(400).json({
      status: "fail",
      message: "Search query is required",
    })
  }

  const searchTerm = `%${query}%`

  const [rows] = await pool.query(
    `SELECT * FROM acts 
     WHERE title LIKE ? OR description LIKE ? OR location LIKE ? OR participants LIKE ? 
     ORDER BY act_date DESC`,
    [searchTerm, searchTerm, searchTerm, searchTerm],
  )

  res.status(200).json({
    status: "success",
    results: rows.length,
    data: {
      acts: rows,
    },
  })
})

