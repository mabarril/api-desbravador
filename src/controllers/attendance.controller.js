import pool from "../config/database.js"
import AppError from "../utils/AppError.js"
import catchAsync from "../utils/catchAsync.js"
import { logAction } from "../utils/auditLogger.js"

export const getAttendanceRecords = catchAsync(async (req, res) => {
  const { pathfinderId, eventType, eventId, startDate, endDate, status } = req.query

  let query = `
    SELECT ar.*, 
      p.name as pathfinder_name, 
      u.name as recorded_by_name
    FROM attendance_records ar
    JOIN pathfinders p ON ar.pathfinder_id = p.id
    LEFT JOIN users u ON ar.recorded_by = u.id
    WHERE 1=1
  `

  const queryParams = []

  if (pathfinderId) {
    query += " AND ar.pathfinder_id = ?"
    queryParams.push(pathfinderId)
  }

  if (eventType) {
    query += " AND ar.event_type = ?"
    queryParams.push(eventType)
  }

  if (eventId) {
    query += " AND ar.event_id = ?"
    queryParams.push(eventId)
  }

  if (startDate) {
    query += " AND ar.event_date >= ?"
    queryParams.push(startDate)
  }

  if (endDate) {
    query += " AND ar.event_date <= ?"
    queryParams.push(endDate)
  }

  if (status) {
    query += " AND ar.status = ?"
    queryParams.push(status)
  }

  query += " ORDER BY ar.event_date DESC, p.name ASC"

  const [rows] = await pool.query(query, queryParams)

  res.status(200).json({
    status: "success",
    results: rows.length,
    data: {
      attendanceRecords: rows,
    },
  })
})

export const getAttendanceRecord = catchAsync(async (req, res, next) => {
  const { id } = req.params

  const [records] = await pool.query(
    `SELECT ar.*, 
      p.name as pathfinder_name, 
      u.name as recorded_by_name
    FROM attendance_records ar
    JOIN pathfinders p ON ar.pathfinder_id = p.id
    LEFT JOIN users u ON ar.recorded_by = u.id
    WHERE ar.id = ?`,
    [id],
  )

  if (records.length === 0) {
    return next(new AppError("Attendance record not found", 404))
  }

  res.status(200).json({
    status: "success",
    data: {
      attendanceRecord: records[0],
    },
  })
})

export const createAttendanceRecord = catchAsync(async (req, res, next) => {
  const { pathfinderId, eventDate, eventType, eventId, status, notes } = req.body

  // Check if pathfinder exists
  const [pathfinder] = await pool.query("SELECT * FROM pathfinders WHERE id = ?", [pathfinderId])

  if (pathfinder.length === 0) {
    return next(new AppError("Pathfinder not found", 404))
  }

  // Check if record already exists
  if (eventId) {
    const [existingRecord] = await pool.query(
      "SELECT * FROM attendance_records WHERE pathfinder_id = ? AND event_type = ? AND event_id = ?",
      [pathfinderId, eventType, eventId],
    )

    if (existingRecord.length > 0) {
      return next(new AppError("Attendance record already exists for this pathfinder and event", 400))
    }
  }

  // Create record
  const [result] = await pool.query(
    `INSERT INTO attendance_records 
    (pathfinder_id, event_date, event_type, event_id, status, notes, recorded_by) 
    VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [pathfinderId, eventDate, eventType, eventId, status, notes, req.user.id],
  )

  // Log the action
  await logAction({
    userId: req.user.id,
    action: "create_attendance_record",
    entityType: "attendance_record",
    entityId: result.insertId,
    details: { pathfinderId, eventDate, status },
    ipAddress: req.ip,
  })

  // Get the created record
  const [record] = await pool.query(
    `SELECT ar.*, 
      p.name as pathfinder_name, 
      u.name as recorded_by_name
    FROM attendance_records ar
    JOIN pathfinders p ON ar.pathfinder_id = p.id
    LEFT JOIN users u ON ar.recorded_by = u.id
    WHERE ar.id = ?`,
    [result.insertId],
  )

  res.status(201).json({
    status: "success",
    data: {
      attendanceRecord: record[0],
    },
  })
})

export const updateAttendanceRecord = catchAsync(async (req, res, next) => {
  const { id } = req.params
  const { eventDate, status, notes } = req.body

  // Check if record exists
  const [existingRecord] = await pool.query("SELECT * FROM attendance_records WHERE id = ?", [id])

  if (existingRecord.length === 0) {
    return next(new AppError("Attendance record not found", 404))
  }

  // Build update query
  let query = "UPDATE attendance_records SET "
  const values = []
  const updateFields = []

  if (eventDate !== undefined) {
    updateFields.push("event_date = ?")
    values.push(eventDate)
  }

  if (status !== undefined) {
    updateFields.push("status = ?")
    values.push(status)
  }

  if (notes !== undefined) {
    updateFields.push("notes = ?")
    values.push(notes)
  }

  // Add recorded_by and updated_at
  updateFields.push("recorded_by = ?")
  values.push(req.user.id)

  updateFields.push("updated_at = NOW()")

  // If no fields to update, return the existing record
  if (updateFields.length === 0) {
    return res.status(200).json({
      status: "success",
      data: {
        attendanceRecord: existingRecord[0],
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
    action: "update_attendance_record",
    entityType: "attendance_record",
    entityId: id,
    details: { status },
    ipAddress: req.ip,
  })

  // Get the updated record
  const [record] = await pool.query(
    `SELECT ar.*, 
      p.name as pathfinder_name, 
      u.name as recorded_by_name
    FROM attendance_records ar
    JOIN pathfinders p ON ar.pathfinder_id = p.id
    LEFT JOIN users u ON ar.recorded_by = u.id
    WHERE ar.id = ?`,
    [id],
  )

  res.status(200).json({
    status: "success",
    data: {
      attendanceRecord: record[0],
    },
  })
})

export const deleteAttendanceRecord = catchAsync(async (req, res, next) => {
  const { id } = req.params

  // Check if record exists
  const [existingRecord] = await pool.query("SELECT * FROM attendance_records WHERE id = ?", [id])

  if (existingRecord.length === 0) {
    return next(new AppError("Attendance record not found", 404))
  }

  // Delete record
  await pool.query("DELETE FROM attendance_records WHERE id = ?", [id])

  // Log the action
  await logAction({
    userId: req.user.id,
    action: "delete_attendance_record",
    entityType: "attendance_record",
    entityId: id,
    details: { pathfinderId: existingRecord[0].pathfinder_id },
    ipAddress: req.ip,
  })

  res.status(204).json({
    status: "success",
    data: null,
  })
})

export const bulkCreateAttendanceRecords = catchAsync(async (req, res, next) => {
  const { eventDate, eventType, eventId, records } = req.body

  if (!records || !Array.isArray(records) || records.length === 0) {
    return next(new AppError("Records array is required", 400))
  }

  // Begin transaction
  const connection = await pool.getConnection()
  await connection.beginTransaction()

  try {
    const createdRecords = []

    for (const record of records) {
      const { pathfinderId, status, notes } = record

      // Check if pathfinder exists
      const [pathfinder] = await connection.query("SELECT * FROM pathfinders WHERE id = ?", [pathfinderId])

      if (pathfinder.length === 0) {
        throw new AppError(`Pathfinder with ID ${pathfinderId} not found`, 404)
      }

      // Check if record already exists
      if (eventId) {
        const [existingRecord] = await connection.query(
          "SELECT * FROM attendance_records WHERE pathfinder_id = ? AND event_type = ? AND event_id = ?",
          [pathfinderId, eventType, eventId],
        )

        if (existingRecord.length > 0) {
          // Skip this record or update it
          continue
        }
      }

      // Create record
      const [result] = await connection.query(
        `INSERT INTO attendance_records 
        (pathfinder_id, event_date, event_type, event_id, status, notes, recorded_by) 
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [pathfinderId, eventDate, eventType, eventId, status, notes, req.user.id],
      )

      // Log the action
      await logAction({
        userId: req.user.id,
        action: "create_attendance_record",
        entityType: "attendance_record",
        entityId: result.insertId,
        details: { pathfinderId, eventDate, status },
        ipAddress: req.ip,
      })

      createdRecords.push(result.insertId)
    }

    // Commit transaction
    await connection.commit()

    // Get all created records
    const [records] = await pool.query(
      `SELECT ar.*, 
        p.name as pathfinder_name, 
        u.name as recorded_by_name
      FROM attendance_records ar
      JOIN pathfinders p ON ar.pathfinder_id = p.id
      LEFT JOIN users u ON ar.recorded_by = u.id
      WHERE ar.id IN (?)`,
      [createdRecords.length > 0 ? createdRecords : [0]],
    )

    res.status(201).json({
      status: "success",
      results: records.length,
      data: {
        attendanceRecords: records,
      },
    })
  } catch (error) {
    // Rollback transaction
    await connection.rollback()
    next(error)
  } finally {
    // Release connection
    connection.release()
  }
})

export const getPathfinderAttendance = catchAsync(async (req, res, next) => {
  const { pathfinderId } = req.params
  const { startDate, endDate, eventType } = req.query

  // Check if pathfinder exists
  const [pathfinder] = await pool.query("SELECT * FROM pathfinders WHERE id = ?", [pathfinderId])

  if (pathfinder.length === 0) {
    return next(new AppError("Pathfinder not found", 404))
  }

  // Build query
  let query = `
    SELECT ar.*, 
      u.name as recorded_by_name
    FROM attendance_records ar
    LEFT JOIN users u ON ar.recorded_by = u.id
    WHERE ar.pathfinder_id = ?
  `

  const queryParams = [pathfinderId]

  if (startDate) {
    query += " AND ar.event_date >= ?"
    queryParams.push(startDate)
  }

  if (endDate) {
    query += " AND ar.event_date <= ?"
    queryParams.push(endDate)
  }

  if (eventType) {
    query += " AND ar.event_type = ?"
    queryParams.push(eventType)
  }

  query += " ORDER BY ar.event_date DESC"

  const [records] = await pool.query(query, queryParams)

  // Calculate statistics
  const totalRecords = records.length
  const presentCount = records.filter((r) => r.status === "present").length
  const absentCount = records.filter((r) => r.status === "absent").length
  const excusedCount = records.filter((r) => r.status === "excused").length
  const lateCount = records.filter((r) => r.status === "late").length

  const attendanceRate = totalRecords > 0 ? (((presentCount + lateCount) / totalRecords) * 100).toFixed(2) : 0

  res.status(200).json({
    status: "success",
    data: {
      pathfinder: pathfinder[0],
      statistics: {
        totalRecords,
        presentCount,
        absentCount,
        excusedCount,
        lateCount,
        attendanceRate,
      },
      records,
    },
  })
})

export const getEventAttendance = catchAsync(async (req, res, next) => {
  const { eventType, eventId } = req.params

  // Check if event exists if eventId is provided
  if (eventId && eventId !== "null") {
    let eventTable

    switch (eventType) {
      case "event":
        eventTable = "events"
        break
      case "calendar_event":
        eventTable = "calendar_events"
        break
      default:
        // No validation needed for other event types
        break
    }

    if (eventTable) {
      const [event] = await pool.query(`SELECT * FROM ${eventTable} WHERE id = ?`, [eventId])

      if (event.length === 0) {
        return next(new AppError(`${eventType} not found`, 404))
      }
    }
  }

  // Get attendance records
  let query = `
    SELECT ar.*, 
      p.name as pathfinder_name, p.unit_id,
      u.name as recorded_by_name,
      un.name as unit_name
    FROM attendance_records ar
    JOIN pathfinders p ON ar.pathfinder_id = p.id
    LEFT JOIN users u ON ar.recorded_by = u.id
    LEFT JOIN units un ON p.unit_id = un.id
    WHERE ar.event_type = ?
  `

  const queryParams = [eventType]

  if (eventId && eventId !== "null") {
    query += " AND ar.event_id = ?"
    queryParams.push(eventId)
  }

  query += " ORDER BY un.name, p.name"

  const [records] = await pool.query(query, queryParams)

  // Get all pathfinders
  const [pathfinders] = await pool.query(`
    SELECT p.*, u.name as unit_name
    FROM pathfinders p
    LEFT JOIN units u ON p.unit_id = u.id
    ORDER BY u.name, p.name
  `)

  // Create a map of pathfinder attendance
  const attendanceMap = {}

  pathfinders.forEach((pathfinder) => {
    attendanceMap[pathfinder.id] = {
      pathfinder,
      attendance: null,
    }
  })

  records.forEach((record) => {
    if (attendanceMap[record.pathfinder_id]) {
      attendanceMap[record.pathfinder_id].attendance = record
    }
  })

  // Calculate statistics
  const totalPathfinders = pathfinders.length
  const presentCount = records.filter((r) => r.status === "present").length
  const absentCount = records.filter((r) => r.status === "absent").length
  const excusedCount = records.filter((r) => r.status === "excused").length
  const lateCount = records.filter((r) => r.status === "late").length
  const notRecordedCount = totalPathfinders - records.length

  const attendanceRate = totalPathfinders > 0 ? (((presentCount + lateCount) / totalPathfinders) * 100).toFixed(2) : 0

  // Group by unit
  const unitStats = {}

  records.forEach((record) => {
    const unitId = record.unit_id || "none"
    const unitName = record.unit_name || "No Unit"

    if (!unitStats[unitId]) {
      unitStats[unitId] = {
        unitId,
        unitName,
        totalPathfinders: 0,
        presentCount: 0,
        absentCount: 0,
        excusedCount: 0,
        lateCount: 0,
        attendanceRate: 0,
      }
    }

    unitStats[unitId].totalPathfinders++

    if (record.status === "present") unitStats[unitId].presentCount++
    if (record.status === "absent") unitStats[unitId].absentCount++
    if (record.status === "excused") unitStats[unitId].excusedCount++
    if (record.status === "late") unitStats[unitId].lateCount++
  })

  // Calculate attendance rate for each unit
  Object.values(unitStats).forEach((unit) => {
    unit.attendanceRate =
      unit.totalPathfinders > 0 ? (((unit.presentCount + unit.lateCount) / unit.totalPathfinders) * 100).toFixed(2) : 0
  })

  res.status(200).json({
    status: "success",
    data: {
      eventType,
      eventId,
      statistics: {
        totalPathfinders,
        presentCount,
        absentCount,
        excusedCount,
        lateCount,
        notRecordedCount,
        attendanceRate,
      },
      unitStats: Object.values(unitStats),
      records,
      attendanceMap: Object.values(attendanceMap),
    },
  })
})

