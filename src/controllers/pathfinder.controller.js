import pool from "../config/database.js"
import AppError from "../utils/AppError.js"
import catchAsync from "../utils/catchAsync.js"

export const getAllPathfinders = catchAsync(async (req, res) => {
  const [rows] = await pool.query("SELECT * FROM pathfinders")

  res.status(200).json({
    status: "success",
    results: rows.length,
    data: {
      pathfinders: rows,
    },
  })
})

export const getPathfinder = catchAsync(async (req, res, next) => {
  const [rows] = await pool.query("SELECT * FROM pathfinders WHERE id = ?", [req.params.id])

  if (rows.length === 0) {
    return next(new AppError("No pathfinder found with that ID", 404))
  }

  res.status(200).json({
    status: "success",
    data: {
      pathfinder: rows[0],
    },
  })
})

export const createPathfinder = catchAsync(async (req, res) => {
  const { name, birthDate, gender, email, phone, address, unitId } = req.body

  const [result] = await pool.query(
    `INSERT INTO pathfinders 
    (name, birth_date, gender, email, phone, address, unit_id) 
    VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [name, birthDate, gender, email, phone, address, unitId],
  )

  const [newPathfinder] = await pool.query("SELECT * FROM pathfinders WHERE id = ?", [result.insertId])

  res.status(201).json({
    status: "success",
    data: {
      pathfinder: newPathfinder[0],
    },
  })
})

export const updatePathfinder = catchAsync(async (req, res, next) => {
  // First check if the pathfinder exists
  const [pathfinder] = await pool.query("SELECT * FROM pathfinders WHERE id = ?", [req.params.id])

  if (pathfinder.length === 0) {
    return next(new AppError("No pathfinder found with that ID", 404))
  }

  const { name, birthDate, gender, email, phone, address, unitId } = req.body

  // Build the query dynamically based on provided fields
  let query = "UPDATE pathfinders SET "
  const values = []
  const updateFields = []

  if (name !== undefined) {
    updateFields.push("name = ?")
    values.push(name)
  }
  if (birthDate !== undefined) {
    updateFields.push("birth_date = ?")
    values.push(birthDate)
  }
  if (gender !== undefined) {
    updateFields.push("gender = ?")
    values.push(gender)
  }
  if (email !== undefined) {
    updateFields.push("email = ?")
    values.push(email)
  }
  if (phone !== undefined) {
    updateFields.push("phone = ?")
    values.push(phone)
  }
  if (address !== undefined) {
    updateFields.push("address = ?")
    values.push(address)
  }
  if (unitId !== undefined) {
    updateFields.push("unit_id = ?")
    values.push(unitId)
  }

  // Add updated_at timestamp
  updateFields.push("updated_at = NOW()")

  // If no fields to update, return the existing pathfinder
  if (updateFields.length === 0) {
    return res.status(200).json({
      status: "success",
      data: {
        pathfinder: pathfinder[0],
      },
    })
  }

  query += updateFields.join(", ")
  query += " WHERE id = ?"
  values.push(req.params.id)

  await pool.query(query, values)

  // Get the updated pathfinder
  const [updatedPathfinder] = await pool.query("SELECT * FROM pathfinders WHERE id = ?", [req.params.id])

  res.status(200).json({
    status: "success",
    data: {
      pathfinder: updatedPathfinder[0],
    },
  })
})

export const deletePathfinder = catchAsync(async (req, res, next) => {
  const [result] = await pool.query("DELETE FROM pathfinders WHERE id = ?", [req.params.id])

  if (result.affectedRows === 0) {
    return next(new AppError("No pathfinder found with that ID", 404))
  }

  res.status(204).json({
    status: "success",
    data: null,
  })
})

