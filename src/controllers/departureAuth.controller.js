import pool from "../config/database.js"
import AppError from "../utils/AppError.js"
import catchAsync from "../utils/catchAsync.js"

export const getAllDepartureAuths = catchAsync(async (req, res) => {
  // Add filtering options
  const { pathfinderId, startDate, endDate, authorized } = req.query

  let query = "SELECT * FROM departure_authorizations"
  const queryParams = []
  const conditions = []

  if (pathfinderId) {
    conditions.push("pathfinder_id = ?")
    queryParams.push(pathfinderId)
  }

  if (startDate) {
    conditions.push("departure_date >= ?")
    queryParams.push(startDate)
  }

  if (endDate) {
    conditions.push("return_date <= ?")
    queryParams.push(endDate)
  }

  if (authorized !== undefined) {
    if (authorized === "true") {
      conditions.push("authorized_by IS NOT NULL")
    } else {
      conditions.push("authorized_by IS NULL")
    }
  }

  if (conditions.length > 0) {
    query += " WHERE " + conditions.join(" AND ")
  }

  query += " ORDER BY departure_date DESC"

  const [rows] = await pool.query(query, queryParams)

  res.status(200).json({
    status: "success",
    results: rows.length,
    data: {
      departureAuthorizations: rows,
    },
  })
})

export const getDepartureAuth = catchAsync(async (req, res, next) => {
  const [rows] = await pool.query("SELECT * FROM departure_authorizations WHERE id = ?", [req.params.id])

  if (rows.length === 0) {
    return next(new AppError("No departure authorization found with that ID", 404))
  }

  // Get pathfinder details
  const [pathfinder] = await pool.query("SELECT id, name, email, phone FROM pathfinders WHERE id = ?", [
    rows[0].pathfinder_id,
  ])

  // Get authorizer details if authorized_by exists
  let authorizer = null
  if (rows[0].authorized_by) {
    const [authorizerRows] = await pool.query("SELECT id, name, email, role FROM users WHERE id = ?", [
      rows[0].authorized_by,
    ])
    if (authorizerRows.length > 0) {
      authorizer = authorizerRows[0]
    }
  }

  res.status(200).json({
    status: "success",
    data: {
      departureAuthorization: {
        ...rows[0],
        pathfinder: pathfinder[0] || null,
        authorizer,
      },
    },
  })
})

export const createDepartureAuth = catchAsync(async (req, res, next) => {
  const { pathfinderId, departureDate, returnDate, destination, purpose, parentAuthorization, notes } = req.body

  // Check if the pathfinder exists
  const [pathfinder] = await pool.query("SELECT * FROM pathfinders WHERE id = ?", [pathfinderId])

  if (pathfinder.length === 0) {
    return next(new AppError("No pathfinder found with that ID", 404))
  }

  // Validate dates
  if (new Date(returnDate) < new Date(departureDate)) {
    return next(new AppError("Return date cannot be before departure date", 400))
  }

  const [result] = await pool.query(
    `INSERT INTO departure_authorizations 
    (pathfinder_id, departure_date, return_date, destination, purpose, parent_authorization, notes) 
    VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [pathfinderId, departureDate, returnDate, destination, purpose, parentAuthorization || false, notes],
  )

  const [newAuth] = await pool.query("SELECT * FROM departure_authorizations WHERE id = ?", [result.insertId])

  res.status(201).json({
    status: "success",
    data: {
      departureAuthorization: newAuth[0],
    },
  })
})

export const updateDepartureAuth = catchAsync(async (req, res, next) => {
  // First check if the authorization exists
  const [auth] = await pool.query("SELECT * FROM departure_authorizations WHERE id = ?", [req.params.id])

  if (auth.length === 0) {
    return next(new AppError("No departure authorization found with that ID", 404))
  }

  const {
    pathfinderId,
    departureDate,
    returnDate,
    destination,
    purpose,
    authorizedBy,
    parentAuthorization,
    authorizationDate,
    notes,
  } = req.body

  // If changing pathfinder, check if the pathfinder exists
  if (pathfinderId && pathfinderId !== auth[0].pathfinder_id) {
    const [pathfinder] = await pool.query("SELECT * FROM pathfinders WHERE id = ?", [pathfinderId])

    if (pathfinder.length === 0) {
      return next(new AppError("No pathfinder found with that ID", 404))
    }
  }

  // If changing dates, validate them
  if (departureDate && returnDate && new Date(returnDate) < new Date(departureDate)) {
    return next(new AppError("Return date cannot be before departure date", 400))
  }
  if (departureDate && !returnDate && new Date(departureDate) > new Date(auth[0].return_date)) {
    return next(new AppError("Departure date cannot be after return date", 400))
  }
  if (returnDate && !departureDate && new Date(returnDate) < new Date(auth[0].departure_date)) {
    return next(new AppError("Return date cannot be before departure date", 400))
  }

  // If authorizing, check if the user exists
  if (authorizedBy) {
    const [user] = await pool.query("SELECT * FROM users WHERE id = ?", [authorizedBy])

    if (user.length === 0) {
      return next(new AppError("No user found with that ID", 404))
    }
  }

  // Build the query dynamically based on provided fields
  let query = "UPDATE departure_authorizations SET "
  const values = []
  const updateFields = []

  if (pathfinderId !== undefined) {
    updateFields.push("pathfinder_id = ?")
    values.push(pathfinderId)
  }
  if (departureDate !== undefined) {
    updateFields.push("departure_date = ?")
    values.push(departureDate)
  }
  if (returnDate !== undefined) {
    updateFields.push("return_date = ?")
    values.push(returnDate)
  }
  if (destination !== undefined) {
    updateFields.push("destination = ?")
    values.push(destination)
  }
  if (purpose !== undefined) {
    updateFields.push("purpose = ?")
    values.push(purpose)
  }
  if (authorizedBy !== undefined) {
    updateFields.push("authorized_by = ?")
    values.push(authorizedBy)
  }
  if (parentAuthorization !== undefined) {
    updateFields.push("parent_authorization = ?")
    values.push(parentAuthorization)
  }
  if (authorizationDate !== undefined) {
    updateFields.push("authorization_date = ?")
    values.push(authorizationDate)
  }
  if (notes !== undefined) {
    updateFields.push("notes = ?")
    values.push(notes)
  }

  // Add updated_at timestamp
  updateFields.push("updated_at = NOW()")

  // If no fields to update, return the existing authorization
  if (updateFields.length === 0) {
    return res.status(200).json({
      status: "success",
      data: {
        departureAuthorization: auth[0],
      },
    })
  }

  query += updateFields.join(", ")
  query += " WHERE id = ?"
  values.push(req.params.id)

  await pool.query(query, values)

  // Get the updated authorization
  const [updatedAuth] = await pool.query("SELECT * FROM departure_authorizations WHERE id = ?", [req.params.id])

  res.status(200).json({
    status: "success",
    data: {
      departureAuthorization: updatedAuth[0],
    },
  })
})

export const deleteDepartureAuth = catchAsync(async (req, res, next) => {
  const [result] = await pool.query("DELETE FROM departure_authorizations WHERE id = ?", [req.params.id])

  if (result.affectedRows === 0) {
    return next(new AppError("No departure authorization found with that ID", 404))
  }

  res.status(204).json({
    status: "success",
    data: null,
  })
})

// Authorize a departure
export const authorizeDeparture = catchAsync(async (req, res, next) => {
  const { id } = req.params

  // Check if the authorization exists
  const [auth] = await pool.query("SELECT * FROM departure_authorizations WHERE id = ?", [id])

  if (auth.length === 0) {
    return next(new AppError("No departure authorization found with that ID", 404))
  }

  // Update the authorization
  await pool.query(
    "UPDATE departure_authorizations SET authorized_by = ?, authorization_date = NOW(), updated_at = NOW() WHERE id = ?",
    [req.user.id, id],
  )

  // Get the updated authorization
  const [updatedAuth] = await pool.query("SELECT * FROM departure_authorizations WHERE id = ?", [id])

  res.status(200).json({
    status: "success",
    data: {
      departureAuthorization: updatedAuth[0],
    },
  })
})

// Set parent authorization
export const setParentAuthorization = catchAsync(async (req, res, next) => {
  const { id } = req.params
  const { parentAuthorization } = req.body

  // Check if the authorization exists
  const [auth] = await pool.query("SELECT * FROM departure_authorizations WHERE id = ?", [id])

  if (auth.length === 0) {
    return next(new AppError("No departure authorization found with that ID", 404))
  }

  // Update the parent authorization status
  await pool.query("UPDATE departure_authorizations SET parent_authorization = ?, updated_at = NOW() WHERE id = ?", [
    parentAuthorization,
    id,
  ])

  // Get the updated authorization
  const [updatedAuth] = await pool.query("SELECT * FROM departure_authorizations WHERE id = ?", [id])

  res.status(200).json({
    status: "success",
    data: {
      departureAuthorization: updatedAuth[0],
    },
  })
})

