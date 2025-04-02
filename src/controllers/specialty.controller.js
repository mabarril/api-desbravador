import pool from "../config/database.js"
import AppError from "../utils/AppError.js"
import catchAsync from "../utils/catchAsync.js"

export const getAllSpecialties = catchAsync(async (req, res) => {
  const [rows] = await pool.query("SELECT * FROM specialties")

  res.status(200).json({
    status: "success",
    results: rows.length,
    data: {
      specialties: rows,
    },
  })
})

export const getSpecialty = catchAsync(async (req, res, next) => {
  const [rows] = await pool.query("SELECT * FROM specialties WHERE id = ?", [req.params.id])

  if (rows.length === 0) {
    return next(new AppError("No specialty found with that ID", 404))
  }

  // Get pathfinders who have earned this specialty
  const [pathfinders] = await pool.query(
    `
    SELECT p.*, ps.completion_date, ps.status 
    FROM pathfinders p
    JOIN pathfinder_specialties ps ON p.id = ps.pathfinder_id
    WHERE ps.specialty_id = ?
  `,
    [req.params.id],
  )

  res.status(200).json({
    status: "success",
    data: {
      specialty: {
        ...rows[0],
        pathfinders,
      },
    },
  })
})

export const createSpecialty = catchAsync(async (req, res) => {
  const { name, description, requirements } = req.body

  const [result] = await pool.query("INSERT INTO specialties (name, description, requirements) VALUES (?, ?, ?)", [
    name,
    description,
    requirements,
  ])

  const [newSpecialty] = await pool.query("SELECT * FROM specialties WHERE id = ?", [result.insertId])

  res.status(201).json({
    status: "success",
    data: {
      specialty: newSpecialty[0],
    },
  })
})

export const updateSpecialty = catchAsync(async (req, res, next) => {
  // First check if the specialty exists
  const [specialty] = await pool.query("SELECT * FROM specialties WHERE id = ?", [req.params.id])

  if (specialty.length === 0) {
    return next(new AppError("No specialty found with that ID", 404))
  }

  const { name, description, requirements } = req.body

  // Build the query dynamically based on provided fields
  let query = "UPDATE specialties SET "
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

  // If no fields to update, return the existing specialty
  if (updateFields.length === 0) {
    return res.status(200).json({
      status: "success",
      data: {
        specialty: specialty[0],
      },
    })
  }

  query += updateFields.join(", ")
  query += " WHERE id = ?"
  values.push(req.params.id)

  await pool.query(query, values)

  // Get the updated specialty
  const [updatedSpecialty] = await pool.query("SELECT * FROM specialties WHERE id = ?", [req.params.id])

  res.status(200).json({
    status: "success",
    data: {
      specialty: updatedSpecialty[0],
    },
  })
})

export const deleteSpecialty = catchAsync(async (req, res, next) => {
  const [result] = await pool.query("DELETE FROM specialties WHERE id = ?", [req.params.id])

  if (result.affectedRows === 0) {
    return next(new AppError("No specialty found with that ID", 404))
  }

  res.status(204).json({
    status: "success",
    data: null,
  })
})

// Assign a specialty to a pathfinder
export const assignSpecialtyToPathfinder = catchAsync(async (req, res, next) => {
  const { pathfinderId, status } = req.body
  const specialtyId = req.params.id

  // Check if the specialty exists
  const [specialty] = await pool.query("SELECT * FROM specialties WHERE id = ?", [specialtyId])

  if (specialty.length === 0) {
    return next(new AppError("No specialty found with that ID", 404))
  }

  // Check if the pathfinder exists
  const [pathfinder] = await pool.query("SELECT * FROM pathfinders WHERE id = ?", [pathfinderId])

  if (pathfinder.length === 0) {
    return next(new AppError("No pathfinder found with that ID", 404))
  }

  // Check if the assignment already exists
  const [existingAssignment] = await pool.query(
    "SELECT * FROM pathfinder_specialties WHERE pathfinder_id = ? AND specialty_id = ?",
    [pathfinderId, specialtyId],
  )

  if (existingAssignment.length > 0) {
    return next(new AppError("This pathfinder is already assigned to this specialty", 400))
  }

  // Create the assignment
  const completionDate = status === "completed" ? new Date().toISOString().slice(0, 10) : null

  await pool.query(
    "INSERT INTO pathfinder_specialties (pathfinder_id, specialty_id, status, completion_date) VALUES (?, ?, ?, ?)",
    [pathfinderId, specialtyId, status || "not_started", completionDate],
  )

  res.status(201).json({
    status: "success",
    message: "Specialty assigned to pathfinder successfully",
  })
})

// Update a pathfinder's specialty status
export const updatePathfinderSpecialtyStatus = catchAsync(async (req, res, next) => {
  const { pathfinderId, status } = req.body
  const specialtyId = req.params.id

  // Check if the assignment exists
  const [existingAssignment] = await pool.query(
    "SELECT * FROM pathfinder_specialties WHERE pathfinder_id = ? AND specialty_id = ?",
    [pathfinderId, specialtyId],
  )

  if (existingAssignment.length === 0) {
    return next(new AppError("This pathfinder is not assigned to this specialty", 404))
  }

  // Update the status
  const completionDate = status === "completed" ? new Date().toISOString().slice(0, 10) : null

  await pool.query(
    "UPDATE pathfinder_specialties SET status = ?, completion_date = ?, updated_at = NOW() WHERE pathfinder_id = ? AND specialty_id = ?",
    [status, completionDate, pathfinderId, specialtyId],
  )

  res.status(200).json({
    status: "success",
    message: "Specialty status updated successfully",
  })
})

// Remove a pathfinder from a specialty
export const removePathfinderFromSpecialty = catchAsync(async (req, res, next) => {
  const { pathfinderId } = req.params
  const specialtyId = req.params.id

  const [result] = await pool.query("DELETE FROM pathfinder_specialties WHERE pathfinder_id = ? AND specialty_id = ?", [
    pathfinderId,
    specialtyId,
  ])

  if (result.affectedRows === 0) {
    return next(new AppError("This pathfinder is not assigned to this specialty", 404))
  }

  res.status(204).json({
    status: "success",
    data: null,
  })
})

