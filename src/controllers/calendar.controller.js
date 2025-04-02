import pool from "../config/database.js"
import AppError from "../utils/AppError.js"
import catchAsync from "../utils/catchAsync.js"
import { logAction } from "../utils/auditLogger.js"
import { createNotification } from "../controllers/notification.controller.js"

export const getAllCalendarEvents = catchAsync(async (req, res) => {
  const { startDate, endDate, eventType, createdBy } = req.query

  let query = `
    SELECT ce.*, u.name as created_by_name 
    FROM calendar_events ce
    LEFT JOIN users u ON ce.created_by = u.id
    WHERE 1=1
  `

  const queryParams = []

  if (startDate) {
    query += " AND ce.start_datetime >= ?"
    queryParams.push(startDate)
  }

  if (endDate) {
    query += " AND ce.end_datetime <= ?"
    queryParams.push(endDate)
  }

  if (eventType) {
    query += " AND ce.event_type = ?"
    queryParams.push(eventType)
  }

  if (createdBy) {
    query += " AND ce.created_by = ?"
    queryParams.push(createdBy)
  }

  query += " ORDER BY ce.start_datetime"

  const [rows] = await pool.query(query, queryParams)

  res.status(200).json({
    status: "success",
    results: rows.length,
    data: {
      events: rows,
    },
  })
})

export const getCalendarEvent = catchAsync(async (req, res, next) => {
  const { id } = req.params

  const [events] = await pool.query(
    `SELECT ce.*, u.name as created_by_name 
     FROM calendar_events ce
     LEFT JOIN users u ON ce.created_by = u.id
     WHERE ce.id = ?`,
    [id],
  )

  if (events.length === 0) {
    return next(new AppError("Calendar event not found", 404))
  }

  // Get attendees
  const [attendees] = await pool.query(
    `SELECT cea.*, 
      u.name as user_name, u.email as user_email,
      p.name as pathfinder_name, p.email as pathfinder_email
     FROM calendar_event_attendees cea
     LEFT JOIN users u ON cea.user_id = u.id
     LEFT JOIN pathfinders p ON cea.pathfinder_id = p.id
     WHERE cea.calendar_event_id = ?`,
    [id],
  )

  res.status(200).json({
    status: "success",
    data: {
      event: events[0],
      attendees,
    },
  })
})

export const createCalendarEvent = catchAsync(async (req, res, next) => {
  const {
    title,
    description,
    startDatetime,
    endDatetime,
    allDay,
    location,
    color,
    eventType,
    relatedEntityType,
    relatedEntityId,
    attendees,
  } = req.body

  // Validate dates
  if (new Date(endDatetime) < new Date(startDatetime)) {
    return next(new AppError("End date cannot be before start date", 400))
  }

  // Create event
  const [result] = await pool.query(
    `INSERT INTO calendar_events 
    (title, description, start_datetime, end_datetime, all_day, location, color, event_type, related_entity_type, related_entity_id, created_by) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      title,
      description,
      startDatetime,
      endDatetime,
      allDay || false,
      location,
      color,
      eventType || "other",
      relatedEntityType,
      relatedEntityId,
      req.user.id,
    ],
  )

  const eventId = result.insertId

  // Add attendees if provided
  if (attendees && attendees.length > 0) {
    const attendeeValues = []
    const attendeeParams = []

    for (const attendee of attendees) {
      if (attendee.userId) {
        attendeeValues.push("(?, ?, NULL, ?)")
        attendeeParams.push(eventId, attendee.userId, attendee.responseStatus || "pending")

        // Create notification for user
        await createNotification(
          attendee.userId,
          "New Calendar Event",
          `You have been invited to "${title}" on ${new Date(startDatetime).toLocaleDateString()}`,
          "info",
          "calendar_event",
          eventId,
        )
      } else if (attendee.pathfinderId) {
        attendeeValues.push("(?, NULL, ?, ?)")
        attendeeParams.push(eventId, attendee.pathfinderId, attendee.responseStatus || "pending")
      }
    }

    if (attendeeValues.length > 0) {
      await pool.query(
        `INSERT INTO calendar_event_attendees 
        (calendar_event_id, user_id, pathfinder_id, response_status) 
        VALUES ${attendeeValues.join(", ")}`,
        attendeeParams,
      )
    }
  }

  // Log the action
  await logAction({
    userId: req.user.id,
    action: "create_calendar_event",
    entityType: "calendar_event",
    entityId: eventId,
    details: { title, startDatetime, endDatetime },
    ipAddress: req.ip,
  })

  // Get the created event with attendees
  const [event] = await pool.query(
    `SELECT ce.*, u.name as created_by_name 
     FROM calendar_events ce
     LEFT JOIN users u ON ce.created_by = u.id
     WHERE ce.id = ?`,
    [eventId],
  )

  const [attendeesList] = await pool.query(
    `SELECT cea.*, 
      u.name as user_name, u.email as user_email,
      p.name as pathfinder_name, p.email as pathfinder_email
     FROM calendar_event_attendees cea
     LEFT JOIN users u ON cea.user_id = u.id
     LEFT JOIN pathfinders p ON cea.pathfinder_id = p.id
     WHERE cea.calendar_event_id = ?`,
    [eventId],
  )

  res.status(201).json({
    status: "success",
    data: {
      event: event[0],
      attendees: attendeesList,
    },
  })
})

export const updateCalendarEvent = catchAsync(async (req, res, next) => {
  const { id } = req.params
  const {
    title,
    description,
    startDatetime,
    endDatetime,
    allDay,
    location,
    color,
    eventType,
    relatedEntityType,
    relatedEntityId,
  } = req.body

  // Check if event exists
  const [existingEvent] = await pool.query("SELECT * FROM calendar_events WHERE id = ?", [id])

  if (existingEvent.length === 0) {
    return next(new AppError("Calendar event not found", 404))
  }

  // Check if user has permission to update
  if (existingEvent[0].created_by !== req.user.id && !["admin", "director"].includes(req.user.role)) {
    return next(new AppError("You do not have permission to update this event", 403))
  }

  // Validate dates if both are provided
  if (startDatetime && endDatetime && new Date(endDatetime) < new Date(startDatetime)) {
    return next(new AppError("End date cannot be before start date", 400))
  }

  // Build update query
  let query = "UPDATE calendar_events SET "
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

  if (startDatetime !== undefined) {
    updateFields.push("start_datetime = ?")
    values.push(startDatetime)
  }

  if (endDatetime !== undefined) {
    updateFields.push("end_datetime = ?")
    values.push(endDatetime)
  }

  if (allDay !== undefined) {
    updateFields.push("all_day = ?")
    values.push(allDay)
  }

  if (location !== undefined) {
    updateFields.push("location = ?")
    values.push(location)
  }

  if (color !== undefined) {
    updateFields.push("color = ?")
    values.push(color)
  }

  if (eventType !== undefined) {
    updateFields.push("event_type = ?")
    values.push(eventType)
  }

  if (relatedEntityType !== undefined) {
    updateFields.push("related_entity_type = ?")
    values.push(relatedEntityType)
  }

  if (relatedEntityId !== undefined) {
    updateFields.push("related_entity_id = ?")
    values.push(relatedEntityId)
  }

  // Add updated_at timestamp
  updateFields.push("updated_at = NOW()")

  // If no fields to update, return the existing event
  if (updateFields.length === 0) {
    return res.status(200).json({
      status: "success",
      data: {
        event: existingEvent[0],
      },
    })
  }

  query += updateFields.join(", ")
  query += " WHERE id = ?"
  values.push(id)

  await pool.query(query, values)

  // Log the action
  await logAction({
    userId: req.user.id,
    action: "update_calendar_event",
    entityType: "calendar_event",
    entityId: id,
    details: { title },
    ipAddress: req.ip,
  })

  // Get the updated event
  const [updatedEvent] = await pool.query(
    `SELECT ce.*, u.name as created_by_name 
     FROM calendar_events ce
     LEFT JOIN users u ON ce.created_by = u.id
     WHERE ce.id = ?`,
    [id],
  )

  res.status(200).json({
    status: "success",
    data: {
      event: updatedEvent[0],
    },
  })
})

export const deleteCalendarEvent = catchAsync(async (req, res, next) => {
  const { id } = req.params

  // Check if event exists
  const [existingEvent] = await pool.query("SELECT * FROM calendar_events WHERE id = ?", [id])

  if (existingEvent.length === 0) {
    return next(new AppError("Calendar event not found", 404))
  }

  // Check if user has permission to delete
  if (existingEvent[0].created_by !== req.user.id && !["admin", "director"].includes(req.user.role)) {
    return next(new AppError("You do not have permission to delete this event", 403))
  }

  // Delete event
  await pool.query("DELETE FROM calendar_events WHERE id = ?", [id])

  // Log the action
  await logAction({
    userId: req.user.id,
    action: "delete_calendar_event",
    entityType: "calendar_event",
    entityId: id,
    details: { title: existingEvent[0].title },
    ipAddress: req.ip,
  })

  res.status(204).json({
    status: "success",
    data: null,
  })
})

export const addEventAttendee = catchAsync(async (req, res, next) => {
  const { id } = req.params
  const { userId, pathfinderId, responseStatus } = req.body

  // Check if event exists
  const [existingEvent] = await pool.query("SELECT * FROM calendar_events WHERE id = ?", [id])

  if (existingEvent.length === 0) {
    return next(new AppError("Calendar event not found", 404))
  }

  // Check if user has permission to add attendees
  if (existingEvent[0].created_by !== req.user.id && !["admin", "director"].includes(req.user.role)) {
    return next(new AppError("You do not have permission to add attendees to this event", 403))
  }

  // Validate that either userId or pathfinderId is provided
  if (!userId && !pathfinderId) {
    return next(new AppError("Either userId or pathfinderId must be provided", 400))
  }

  // Check if attendee already exists
  const [existingAttendee] = await pool.query(
    "SELECT * FROM calendar_event_attendees WHERE calendar_event_id = ? AND (user_id = ? OR pathfinder_id = ?)",
    [id, userId || null, pathfinderId || null],
  )

  if (existingAttendee.length > 0) {
    return next(new AppError("Attendee already exists for this event", 400))
  }

  // Add attendee
  await pool.query(
    "INSERT INTO calendar_event_attendees (calendar_event_id, user_id, pathfinder_id, response_status) VALUES (?, ?, ?, ?)",
    [id, userId || null, pathfinderId || null, responseStatus || "pending"],
  )

  // Create notification for user if userId is provided
  if (userId) {
    await createNotification(
      userId,
      "New Calendar Event",
      `You have been invited to "${existingEvent[0].title}" on ${new Date(existingEvent[0].start_datetime).toLocaleDateString()}`,
      "info",
      "calendar_event",
      id,
    )
  }

  // Log the action
  await logAction({
    userId: req.user.id,
    action: "add_calendar_event_attendee",
    entityType: "calendar_event",
    entityId: id,
    details: { userId, pathfinderId },
    ipAddress: req.ip,
  })

  // Get all attendees for this event
  const [attendees] = await pool.query(
    `SELECT cea.*, 
      u.name as user_name, u.email as user_email,
      p.name as pathfinder_name, p.email as pathfinder_email
     FROM calendar_event_attendees cea
     LEFT JOIN users u ON cea.user_id = u.id
     LEFT JOIN pathfinders p ON cea.pathfinder_id = p.id
     WHERE cea.calendar_event_id = ?`,
    [id],
  )

  res.status(201).json({
    status: "success",
    data: {
      attendees,
    },
  })
})

export const updateAttendeeResponse = catchAsync(async (req, res, next) => {
  const { id, attendeeId } = req.params
  const { responseStatus } = req.body

  // Check if event exists
  const [existingEvent] = await pool.query("SELECT * FROM calendar_events WHERE id = ?", [id])

  if (existingEvent.length === 0) {
    return next(new AppError("Calendar event not found", 404))
  }

  // Check if attendee exists
  const [existingAttendee] = await pool.query(
    "SELECT * FROM calendar_event_attendees WHERE id = ? AND calendar_event_id = ?",
    [attendeeId, id],
  )

  if (existingAttendee.length === 0) {
    return next(new AppError("Attendee not found for this event", 404))
  }

  // Check if user has permission to update response
  // Users can update their own response, or admins/directors/event creators can update any response
  const isOwnResponse = existingAttendee[0].user_id === req.user.id
  const hasPermission = ["admin", "director"].includes(req.user.role) || existingEvent[0].created_by === req.user.id

  if (!isOwnResponse && !hasPermission) {
    return next(new AppError("You do not have permission to update this response", 403))
  }

  // Update response
  await pool.query("UPDATE calendar_event_attendees SET response_status = ?, updated_at = NOW() WHERE id = ?", [
    responseStatus,
    attendeeId,
  ])

  // Log the action
  await logAction({
    userId: req.user.id,
    action: "update_calendar_event_response",
    entityType: "calendar_event",
    entityId: id,
    details: { attendeeId, responseStatus },
    ipAddress: req.ip,
  })

  // Get updated attendee
  const [updatedAttendee] = await pool.query(
    `SELECT cea.*, 
      u.name as user_name, u.email as user_email,
      p.name as pathfinder_name, p.email as pathfinder_email
     FROM calendar_event_attendees cea
     LEFT JOIN users u ON cea.user_id = u.id
     LEFT JOIN pathfinders p ON cea.pathfinder_id = p.id
     WHERE cea.id = ?`,
    [attendeeId],
  )

  res.status(200).json({
    status: "success",
    data: {
      attendee: updatedAttendee[0],
    },
  })
})

export const removeEventAttendee = catchAsync(async (req, res, next) => {
  const { id, attendeeId } = req.params

  // Check if event exists
  const [existingEvent] = await pool.query("SELECT * FROM calendar_events WHERE id = ?", [id])

  if (existingEvent.length === 0) {
    return next(new AppError("Calendar event not found", 404))
  }

  // Check if attendee exists
  const [existingAttendee] = await pool.query(
    "SELECT * FROM calendar_event_attendees WHERE id = ? AND calendar_event_id = ?",
    [attendeeId, id],
  )

  if (existingAttendee.length === 0) {
    return next(new AppError("Attendee not found for this event", 404))
  }

  // Check if user has permission to remove attendee
  // Users can remove themselves, or admins/directors/event creators can remove any attendee
  const isOwnAttendee = existingAttendee[0].user_id === req.user.id
  const hasPermission = ["admin", "director"].includes(req.user.role) || existingEvent[0].created_by === req.user.id

  if (!isOwnAttendee && !hasPermission) {
    return next(new AppError("You do not have permission to remove this attendee", 403))
  }

  // Remove attendee
  await pool.query("DELETE FROM calendar_event_attendees WHERE id = ?", [attendeeId])

  // Log the action
  await logAction({
    userId: req.user.id,
    action: "remove_calendar_event_attendee",
    entityType: "calendar_event",
    entityId: id,
    details: { attendeeId },
    ipAddress: req.ip,
  })

  res.status(204).json({
    status: "success",
    data: null,
  })
})

export const getUserEvents = catchAsync(async (req, res) => {
  const { startDate, endDate } = req.query
  const userId = req.user.id

  let query = `
    SELECT ce.*, u.name as created_by_name, cea.response_status
    FROM calendar_events ce
    JOIN calendar_event_attendees cea ON ce.id = cea.calendar_event_id
    LEFT JOIN users u ON ce.created_by = u.id
    WHERE cea.user_id = ?
  `

  const queryParams = [userId]

  if (startDate) {
    query += " AND ce.start_datetime >= ?"
    queryParams.push(startDate)
  }

  if (endDate) {
    query += " AND ce.end_datetime <= ?"
    queryParams.push(endDate)
  }

  query += " ORDER BY ce.start_datetime"

  const [rows] = await pool.query(query, queryParams)

  res.status(200).json({
    status: "success",
    results: rows.length,
    data: {
      events: rows,
    },
  })
})

