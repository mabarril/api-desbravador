import pool from "../config/database.js"
import AppError from "../utils/AppError.js"
import catchAsync from "../utils/catchAsync.js"

export const getAllClasses = catchAsync(async (req, res) => {
  const [rows] = await pool.query("SELECT * FROM classes")

  res.status(200).json({
    status: "success",
    results: rows.length,
    data: {
      classes: rows,
    },
  })
})

export const getClass = catchAsync(async (req, res, next) => {
  const [rows] = await pool.query("SELECT * FROM classes WHERE id = ?", [req.params.id])

  if (rows.length === 0) {
    return next(new AppError("No class found with that ID", 404))
  }

  // Get pathfinders enrolled in this class
  const [pathfinders] = await pool.query(
    `
    SELECT p.*, pc.completion_date, pc.status 
    FROM pathfinders p
    JOIN pathfinder_classes pc ON p.id = pc.pathfinder_id
    WHERE pc.class_id = ?
  `,
    [req.params.id],
  )

  res.status(200).json({
    status: "success",
    data: {
      class: {
        ...rows[0],
        pathfinders,
      },
    },
  })
})

export const createClass = catchAsync(async (req, res) => {
  const { name, description, requirements } = req.body

  const [result] = await pool.query("INSERT INTO classes (name, description, requirements) VALUES (?, ?, ?)", [
    name,
    description,
    requirements,
  ])

  const [newClass] = await pool.query("SELECT * FROM classes WHERE id = ?", [result.insertId])

  res.status(201).json({
    status: "success",
    data: {
      class: newClass[0],
    },
  })
})

export const updateClass = catchAsync(async (req, res, next) => {
  // First check if the class exists
  const [classRow] = await pool.query("SELECT * FROM classes WHERE id = ?", [req.params.id])

  if (classRow.length === 0) {
    return next(new AppError("No class found with that ID", 404))
  }

  const { name, description, requirements } = req.body

  // Build the query dynamically based on provided fields
  let query = "UPDATE classes SET "
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
  if (requirements !== undefined) {
    updateFields.push("requirements = ?")
    values.push(requirements)
  }

  // Add updated_at timestamp
  updateFields.push("updated_at = NOW()")

  // If no fields to update, return the existing class
  if (updateFields.length === 0) {
    return res.status(200).json({
      status: "success",
      data: {
        class: classRow[0],
      },
    })
  }

  query += updateFields.join(", ")
  query += " WHERE id = ?"
  values.push(req.params.id)

  await pool.query(query, values)

  // Get the updated class
  const [updatedClass] = await pool.query("SELECT * FROM classes WHERE id = ?", [req.params.id])

  res.status(200).json({
    status: "success",
    data: {
      class: updatedClass[0],
    },
  })
})

export const deleteClass = catchAsync(async (req, res, next) => {
  const [result] = await pool.query("DELETE FROM classes WHERE id = ?", [req.params.id])

  if (result.affectedRows === 0) {
    return next(new AppError("No class found with that ID", 404))
  }

  res.status(204).json({
    status: "success",
    data: null,
  })
})

// Assign a class to a pathfinder
export const assignClassToPathfinder = catchAsync(async (req, res, next) => {
  const { pathfinderId, status } = req.body
  const classId = req.params.id

  // Check if the class exists
  const [classRow] = await pool.query("SELECT * FROM classes WHERE id = ?", [classId])

  if (classRow.length === 0) {
    return next(new AppError("No class found with that ID", 404))
  }

  // Check if the pathfinder exists
  const [pathfinder] = await pool.query("SELECT * FROM pathfinders WHERE id = ?", [pathfinderId])

  if (pathfinder.length === 0) {
    return next(new AppError("No pathfinder found with that ID", 404))
  }

  // Check if the assignment already exists
  const [existingAssignment] = await pool.query(
    "SELECT * FROM pathfinder_classes WHERE pathfinder_id = ? AND class_id = ?",
    [pathfinderId, classId],
  )

  if (existingAssignment.length > 0) {
    return next(new AppError("This pathfinder is already assigned to this class", 400))
  }

  // Create the assignment
  const completionDate = status === "completed" ? new Date().toISOString().slice(0, 10) : null

  await pool.query(
    "INSERT INTO pathfinder_classes (pathfinder_id, class_id, status, completion_date) VALUES (?, ?, ?, ?)",
    [pathfinderId, classId, status || "not_started", completionDate],
  )

  res.status(201).json({
    status: "success",
    message: "Class assigned to pathfinder successfully",
  })
})

// Update a pathfinder's class status
export const updatePathfinderClassStatus = catchAsync(async (req, res, next) => {
  const { pathfinderId, status } = req.body
  const classId = req.params.id

  // Check if the assignment exists
  const [existingAssignment] = await pool.query(
    "SELECT * FROM pathfinder_classes WHERE pathfinder_id = ? AND class_id = ?",
    [pathfinderId, classId],
  )

  if (existingAssignment.length === 0) {
    return next(new AppError("This pathfinder is not assigned to this class", 404))
  }

  // Update the status
  const completionDate = status === "completed" ? new Date().toISOString().slice(0, 10) : null

  await pool.query(
    "UPDATE pathfinder_classes SET status = ?, completion_date = ?, updated_at = NOW() WHERE pathfinder_id = ? AND class_id = ?",
    [status, completionDate, pathfinderId, classId],
  )

  res.status(200).json({
    status: "success",
    message: "Class status updated successfully",
  })
})

// Remove a pathfinder from a class
export const removePathfinderFromClass = catchAsync(async (req, res, next) => {
  const { pathfinderId } = req.params
  const classId = req.params.id

  const [result] = await pool.query("DELETE FROM pathfinder_classes WHERE pathfinder_id = ? AND class_id = ?", [
    pathfinderId,
    classId,
  ])

  if (result.affectedRows === 0) {
    return next(new AppError("This pathfinder is not assigned to this class", 404))
  }

  res.status(204).json({
    status: "success",
    data: null,
  })
})

