import pool from "../config/database.js"
import AppError from "../utils/AppError.js"
import catchAsync from "../utils/catchAsync.js"

export const getAllUnits = catchAsync(async (req, res) => {
  const [rows] = await pool.query("SELECT * FROM units")

  res.status(200).json({
    status: "success",
    results: rows.length,
    data: {
      units: rows,
    },
  })
})

export const getUnit = catchAsync(async (req, res, next) => {
  const [rows] = await pool.query("SELECT * FROM units WHERE id = ?", [req.params.id])

  if (rows.length === 0) {
    return next(new AppError("No unit found with that ID", 404))
  }

  // Get pathfinders in this unit
  const [pathfinders] = await pool.query("SELECT * FROM pathfinders WHERE unit_id = ?", [req.params.id])

  // Get unit leader details if leader_id exists
  let leader = null
  if (rows[0].leader_id) {
    const [leaderRows] = await pool.query("SELECT id, name, email, role FROM users WHERE id = ?", [rows[0].leader_id])
    if (leaderRows.length > 0) {
      leader = leaderRows[0]
    }
  }

  res.status(200).json({
    status: "success",
    data: {
      unit: {
        ...rows[0],
        leader,
        pathfinders,
      },
    },
  })
})

export const createUnit = catchAsync(async (req, res, next) => {
  const { name, description, leaderId } = req.body

  // If leaderId is provided, check if the user exists and has appropriate role
  if (leaderId) {
    const [leaderRows] = await pool.query(
      'SELECT * FROM users WHERE id = ? AND role IN ("admin", "director", "leader")',
      [leaderId],
    )

    if (leaderRows.length === 0) {
      return next(new AppError("Leader not found or does not have appropriate role", 404))
    }
  }

  const [result] = await pool.query("INSERT INTO units (name, description, leader_id) VALUES (?, ?, ?)", [
    name,
    description,
    leaderId,
  ])

  const [newUnit] = await pool.query("SELECT * FROM units WHERE id = ?", [result.insertId])

  res.status(201).json({
    status: "success",
    data: {
      unit: newUnit[0],
    },
  })
})

export const updateUnit = catchAsync(async (req, res, next) => {
  // First check if the unit exists
  const [unit] = await pool.query("SELECT * FROM units WHERE id = ?", [req.params.id])

  if (unit.length === 0) {
    return next(new AppError("No unit found with that ID", 404))
  }

  const { name, description, leaderId } = req.body

  // If leaderId is provided, check if the user exists and has appropriate role
  if (leaderId) {
    const [leaderRows] = await pool.query(
      'SELECT * FROM users WHERE id = ? AND role IN ("admin", "director", "leader")',
      [leaderId],
    )

    if (leaderRows.length === 0) {
      return next(new AppError("Leader not found or does not have appropriate role", 404))
    }
  }

  // Build the query dynamically based on provided fields
  let query = "UPDATE units SET "
  const values = []
  const updateFields = []

  if (name !== undefined) {
    updateFields.push("name = ?")
    values.push(name)
  }
  if (description !== undefined) {
    updateFields.push("description = ?")
    values.push(description)
  }
  if (leaderId !== undefined) {
    updateFields.push("leader_id = ?")
    values.push(leaderId)
  }

  // Add updated_at timestamp
  updateFields.push("updated_at = NOW()")

  // If no fields to update, return the existing unit
  if (updateFields.length === 0) {
    return res.status(200).json({
      status: "success",
      data: {
        unit: unit[0],
      },
    })
  }

  query += updateFields.join(", ")
  query += " WHERE id = ?"
  values.push(req.params.id)

  await pool.query(query, values)

  // Get the updated unit
  const [updatedUnit] = await pool.query("SELECT * FROM units WHERE id = ?", [req.params.id])

  res.status(200).json({
    status: "success",
    data: {
      unit: updatedUnit[0],
    },
  })
})

export const deleteUnit = catchAsync(async (req, res, next) => {
  const [result] = await pool.query("DELETE FROM units WHERE id = ?", [req.params.id])

  if (result.affectedRows === 0) {
    return next(new AppError("No unit found with that ID", 404))
  }

  res.status(204).json({
    status: "success",
    data: null,
  })
})

