import pool from "../config/database.js"
import AppError from "../utils/AppError.js"
import catchAsync from "../utils/catchAsync.js"

export const getAllRegistrations = catchAsync(async (req, res) => {
  // Add filtering options
  const { pathfinderId, status, paymentStatus } = req.query

  let query = "SELECT * FROM registrations"
  const queryParams = []
  const conditions = []

  if (pathfinderId) {
    conditions.push("pathfinder_id = ?")
    queryParams.push(pathfinderId)
  }

  if (status) {
    conditions.push("status = ?")
    queryParams.push(status)
  }

  if (paymentStatus) {
    conditions.push("payment_status = ?")
    queryParams.push(paymentStatus)
  }

  if (conditions.length > 0) {
    query += " WHERE " + conditions.join(" AND ")
  }

  query += " ORDER BY registration_date DESC"

  const [rows] = await pool.query(query, queryParams)

  res.status(200).json({
    status: "success",
    results: rows.length,
    data: {
      registrations: rows,
    },
  })
})

export const getRegistration = catchAsync(async (req, res, next) => {
  const [rows] = await pool.query("SELECT * FROM registrations WHERE id = ?", [req.params.id])

  if (rows.length === 0) {
    return next(new AppError("No registration found with that ID", 404))
  }

  // Get pathfinder details
  const [pathfinder] = await pool.query("SELECT * FROM pathfinders WHERE id = ?", [rows[0].pathfinder_id])

  res.status(200).json({
    status: "success",
    data: {
      registration: {
        ...rows[0],
        pathfinder: pathfinder[0] || null,
      },
    },
  })
})

export const createRegistration = catchAsync(async (req, res, next) => {
  const { pathfinderId, registrationDate, status, paymentStatus, notes } = req.body

  // Check if the pathfinder exists
  const [pathfinder] = await pool.query("SELECT * FROM pathfinders WHERE id = ?", [pathfinderId])

  if (pathfinder.length === 0) {
    return next(new AppError("No pathfinder found with that ID", 404))
  }

  // Check if a registration for this pathfinder already exists
  const [existingRegistration] = await pool.query("SELECT * FROM registrations WHERE pathfinder_id = ?", [pathfinderId])

  if (existingRegistration.length > 0) {
    return next(new AppError("A registration for this pathfinder already exists", 400))
  }

  const [result] = await pool.query(
    `INSERT INTO registrations 
    (pathfinder_id, registration_date, status, payment_status, notes) 
    VALUES (?, ?, ?, ?, ?)`,
    [
      pathfinderId,
      registrationDate || new Date().toISOString().slice(0, 10),
      status || "pending",
      paymentStatus || "pending",
      notes,
    ],
  )

  const [newRegistration] = await pool.query("SELECT * FROM registrations WHERE id = ?", [result.insertId])

  res.status(201).json({
    status: "success",
    data: {
      registration: newRegistration[0],
    },
  })
})

export const updateRegistration = catchAsync(async (req, res, next) => {
  // First check if the registration exists
  const [registration] = await pool.query("SELECT * FROM registrations WHERE id = ?", [req.params.id])

  if (registration.length === 0) {
    return next(new AppError("No registration found with that ID", 404))
  }

  const { pathfinderId, registrationDate, status, paymentStatus, notes } = req.body

  // If changing pathfinder, check for duplicates
  if (pathfinderId && pathfinderId !== registration[0].pathfinder_id) {
    // Check if the pathfinder exists
    const [pathfinder] = await pool.query("SELECT * FROM pathfinders WHERE id = ?", [pathfinderId])

    if (pathfinder.length === 0) {
      return next(new AppError("No pathfinder found with that ID", 404))
    }

    // Check if a registration for this pathfinder already exists
    const [existingRegistration] = await pool.query("SELECT * FROM registrations WHERE pathfinder_id = ?", [
      pathfinderId,
    ])

    if (existingRegistration.length > 0) {
      return next(new AppError("A registration for this pathfinder already exists", 400))
    }
  }

  // Build the query dynamically based on provided fields
  let query = "UPDATE registrations SET "
  const values = []
  const updateFields = []

  if (pathfinderId !== undefined) {
    updateFields.push("pathfinder_id = ?")
    values.push(pathfinderId)
  }
  if (registrationDate !== undefined) {
    updateFields.push("registration_date = ?")
    values.push(registrationDate)
  }
  if (status !== undefined) {
    updateFields.push("status = ?")
    values.push(status)
  }
  if (paymentStatus !== undefined) {
    updateFields.push("payment_status = ?")
    values.push(paymentStatus)
  }
  if (notes !== undefined) {
    updateFields.push("notes = ?")
    values.push(notes)
  }

  // Add updated_at timestamp
  updateFields.push("updated_at = NOW()")

  // If no fields to update, return the existing registration
  if (updateFields.length === 0) {
    return res.status(200).json({
      status: "success",
      data: {
        registration: registration[0],
      },
    })
  }

  query += updateFields.join(", ")
  query += " WHERE id = ?"
  values.push(req.params.id)

  await pool.query(query, values)

  // Get the updated registration
  const [updatedRegistration] = await pool.query("SELECT * FROM registrations WHERE id = ?", [req.params.id])

  res.status(200).json({
    status: "success",
    data: {
      registration: updatedRegistration[0],
    },
  })
})

export const deleteRegistration = catchAsync(async (req, res, next) => {
  const [result] = await pool.query("DELETE FROM registrations WHERE id = ?", [req.params.id])

  if (result.affectedRows === 0) {
    return next(new AppError("No registration found with that ID", 404))
  }

  res.status(204).json({
    status: "success",
    data: null,
  })
})

// Approve a registration
export const approveRegistration = catchAsync(async (req, res, next) => {
  const { id } = req.params

  // Check if the registration exists
  const [registration] = await pool.query("SELECT * FROM registrations WHERE id = ?", [id])

  if (registration.length === 0) {
    return next(new AppError("No registration found with that ID", 404))
  }

  // Update the registration status
  await pool.query("UPDATE registrations SET status = ?, updated_at = NOW() WHERE id = ?", ["approved", id])

  // Get the updated registration
  const [updatedRegistration] = await pool.query("SELECT * FROM registrations WHERE id = ?", [id])

  res.status(200).json({
    status: "success",
    data: {
      registration: updatedRegistration[0],
    },
  })
})

// Reject a registration
export const rejectRegistration = catchAsync(async (req, res, next) => {
  const { id } = req.params
  const { reason } = req.body

  // Check if the registration exists
  const [registration] = await pool.query("SELECT * FROM registrations WHERE id = ?", [id])

  if (registration.length === 0) {
    return next(new AppError("No registration found with that ID", 404))
  }

  // Update the registration status and notes
  await pool.query(
    'UPDATE registrations SET status = ?, notes = CONCAT(IFNULL(notes, ""), ?), updated_at = NOW() WHERE id = ?',
    ["rejected", reason ? `\nRejection reason: ${reason}` : "\nRejected without specific reason", id],
  )

  // Get the updated registration
  const [updatedRegistration] = await pool.query("SELECT * FROM registrations WHERE id = ?", [id])

  res.status(200).json({
    status: "success",
    data: {
      registration: updatedRegistration[0],
    },
  })
})

// Mark registration as paid
export const markRegistrationAsPaid = catchAsync(async (req, res, next) => {
  const { id } = req.params

  // Check if the registration exists
  const [registration] = await pool.query("SELECT * FROM registrations WHERE id = ?", [id])

  if (registration.length === 0) {
    return next(new AppError("No registration found with that ID", 404))
  }

  // Update the registration payment status
  await pool.query("UPDATE registrations SET payment_status = ?, updated_at = NOW() WHERE id = ?", ["paid", id])

  // Get the updated registration
  const [updatedRegistration] = await pool.query("SELECT * FROM registrations WHERE id = ?", [id])

  res.status(200).json({
    status: "success",
    data: {
      registration: updatedRegistration[0],
    },
  })
})

