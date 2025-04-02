import pool from "../config/database.js"
import AppError from "../utils/AppError.js"
import catchAsync from "../utils/catchAsync.js"

export const getAllEvents = catchAsync(async (req, res) => {
  const [rows] = await pool.query("SELECT * FROM events ORDER BY start_date DESC")

  res.status(200).json({
    status: "success",
    results: rows.length,
    data: {
      events: rows,
    },
  })
})

export const getEvent = catchAsync(async (req, res, next) => {
  const [rows] = await pool.query("SELECT * FROM events WHERE id = ?", [req.params.id])

  if (rows.length === 0) {
    return next(new AppError("No event found with that ID", 404))
  }

  // Get participants for this event
  const [participants] = await pool.query(
    `
    SELECT p.*, ep.registration_date, ep.payment_status, ep.attendance_status, ep.notes 
    FROM pathfinders p
    JOIN event_participants ep ON p.id = ep.pathfinder_id
    WHERE ep.event_id = ?
  `,
    [req.params.id],
  )

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
      event: {
        ...rows[0],
        creator,
        participants,
      },
    },
  })
})

export const createEvent = catchAsync(async (req, res) => {
  const { name, description, startDate, endDate, location, fee, maxParticipants } = req.body

  const [result] = await pool.query(
    `INSERT INTO events 
    (name, description, start_date, end_date, location, fee, max_participants, created_by) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [name, description, startDate, endDate, location, fee || 0, maxParticipants, req.user.id],
  )

  const [newEvent] = await pool.query("SELECT * FROM events WHERE id = ?", [result.insertId])

  res.status(201).json({
    status: "success",
    data: {
      event: newEvent[0],
    },
  })
})

export const updateEvent = catchAsync(async (req, res, next) => {
  // First check if the event exists
  const [event] = await pool.query("SELECT * FROM events WHERE id = ?", [req.params.id])

  if (event.length === 0) {
    return next(new AppError("No event found with that ID", 404))
  }

  const { name, description, startDate, endDate, location, fee, maxParticipants } = req.body

  // Build the query dynamically based on provided fields
  let query = "UPDATE events SET "
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
  if (startDate !== undefined) {
    updateFields.push("start_date = ?")
    values.push(startDate)
  }
  if (endDate !== undefined) {
    updateFields.push("end_date = ?")
    values.push(endDate)
  }
  if (location !== undefined) {
    updateFields.push("location = ?")
    values.push(location)
  }
  if (fee !== undefined) {
    updateFields.push("fee = ?")
    values.push(fee)
  }
  if (maxParticipants !== undefined) {
    updateFields.push("max_participants = ?")
    values.push(maxParticipants)
  }

  // Add updated_at timestamp
  updateFields.push("updated_at = NOW()")

  // If no fields to update, return the existing event
  if (updateFields.length === 0) {
    return res.status(200).json({
      status: "success",
      data: {
        event: event[0],
      },
    })
  }

  query += updateFields.join(", ")
  query += " WHERE id = ?"
  values.push(req.params.id)

  await pool.query(query, values)

  // Get the updated event
  const [updatedEvent] = await pool.query("SELECT * FROM events WHERE id = ?", [req.params.id])

  res.status(200).json({
    status: "success",
    data: {
      event: updatedEvent[0],
    },
  })
})

export const deleteEvent = catchAsync(async (req, res, next) => {
  const [result] = await pool.query("DELETE FROM events WHERE id = ?", [req.params.id])

  if (result.affectedRows === 0) {
    return next(new AppError("No event found with that ID", 404))
  }

  res.status(204).json({
    status: "success",
    data: null,
  })
})

// Register a pathfinder for an event
export const registerPathfinderForEvent = catchAsync(async (req, res, next) => {
  const { pathfinderId, paymentStatus, notes } = req.body
  const eventId = req.params.id

  // Check if the event exists
  const [event] = await pool.query("SELECT * FROM events WHERE id = ?", [eventId])

  if (event.length === 0) {
    return next(new AppError("No event found with that ID", 404))
  }

  // Check if the pathfinder exists
  const [pathfinder] = await pool.query("SELECT * FROM pathfinders WHERE id = ?", [pathfinderId])

  if (pathfinder.length === 0) {
    return next(new AppError("No pathfinder found with that ID", 404))
  }

  // Check if the registration already exists
  const [existingRegistration] = await pool.query(
    "SELECT * FROM event_participants WHERE pathfinder_id = ? AND event_id = ?",
    [pathfinderId, eventId],
  )

  if (existingRegistration.length > 0) {
    return next(new AppError("This pathfinder is already registered for this event", 400))
  }

  // Check if the event has reached its maximum participants
  if (event[0].max_participants) {
    const [participantCount] = await pool.query("SELECT COUNT(*) as count FROM event_participants WHERE event_id = ?", [
      eventId,
    ])

    if (participantCount[0].count >= event[0].max_participants) {
      return next(new AppError("This event has reached its maximum number of participants", 400))
    }
  }

  // Register the pathfinder
  const registrationDate = new Date().toISOString().slice(0, 10)

  await pool.query(
    `INSERT INTO event_participants 
    (event_id, pathfinder_id, registration_date, payment_status, notes) 
    VALUES (?, ?, ?, ?, ?)`,
    [eventId, pathfinderId, registrationDate, paymentStatus || "pending", notes],
  )

  res.status(201).json({
    status: "success",
    message: "Pathfinder registered for event successfully",
  })
})

// Update a pathfinder's event registration
export const updatePathfinderEventRegistration = catchAsync(async (req, res, next) => {
  const { pathfinderId, paymentStatus, attendanceStatus, notes } = req.body
  const eventId = req.params.id

  // Check if the registration exists
  const [existingRegistration] = await pool.query(
    "SELECT * FROM event_participants WHERE pathfinder_id = ? AND event_id = ?",
    [pathfinderId, eventId],
  )

  if (existingRegistration.length === 0) {
    return next(new AppError("This pathfinder is not registered for this event", 404))
  }

  // Build the query dynamically based on provided fields
  let query = "UPDATE event_participants SET "
  const values = []
  const updateFields = []

  if (paymentStatus !== undefined) {
    updateFields.push("payment_status = ?")
    values.push(paymentStatus)
  }
  if (attendanceStatus !== undefined) {
    updateFields.push("attendance_status = ?")
    values.push(attendanceStatus)
  }
  if (notes !== undefined) {
    updateFields.push("notes = ?")
    values.push(notes)
  }

  // Add updated_at timestamp
  updateFields.push("updated_at = NOW()")

  // If no fields to update, return success
  if (updateFields.length === 0) {
    return res.status(200).json({
      status: "success",
      message: "No changes made to registration",
    })
  }

  query += updateFields.join(", ")
  query += " WHERE pathfinder_id = ? AND event_id = ?"
  values.push(pathfinderId, eventId)

  await pool.query(query, values)

  res.status(200).json({
    status: "success",
    message: "Event registration updated successfully",
  })
})

// Remove a pathfinder from an event
export const removePathfinderFromEvent = catchAsync(async (req, res, next) => {
  const { pathfinderId } = req.params
  const eventId = req.params.id

  const [result] = await pool.query("DELETE FROM event_participants WHERE pathfinder_id = ? AND event_id = ?", [
    pathfinderId,
    eventId,
  ])

  if (result.affectedRows === 0) {
    return next(new AppError("This pathfinder is not registered for this event", 404))
  }

  res.status(204).json({
    status: "success",
    data: null,
  })
})

