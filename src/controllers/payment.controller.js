import pool from "../config/database.js"
import AppError from "../utils/AppError.js"
import catchAsync from "../utils/catchAsync.js"

export const getAllPayments = catchAsync(async (req, res) => {
  // Add filtering options
  const { pathfinderId, referenceType, startDate, endDate, paymentMethod } = req.query

  let query = "SELECT * FROM payments"
  const queryParams = []
  const conditions = []

  if (pathfinderId) {
    conditions.push("pathfinder_id = ?")
    queryParams.push(pathfinderId)
  }

  if (referenceType) {
    conditions.push("reference_type = ?")
    queryParams.push(referenceType)
  }

  if (startDate) {
    conditions.push("payment_date >= ?")
    queryParams.push(startDate)
  }

  if (endDate) {
    conditions.push("payment_date <= ?")
    queryParams.push(endDate)
  }

  if (paymentMethod) {
    conditions.push("payment_method = ?")
    queryParams.push(paymentMethod)
  }

  if (conditions.length > 0) {
    query += " WHERE " + conditions.join(" AND ")
  }

  query += " ORDER BY payment_date DESC"

  const [rows] = await pool.query(query, queryParams)

  res.status(200).json({
    status: "success",
    results: rows.length,
    data: {
      payments: rows,
    },
  })
})

export const getPayment = catchAsync(async (req, res, next) => {
  const [rows] = await pool.query("SELECT * FROM payments WHERE id = ?", [req.params.id])

  if (rows.length === 0) {
    return next(new AppError("No payment found with that ID", 404))
  }

  // Get pathfinder details if pathfinder_id exists
  let pathfinder = null
  if (rows[0].pathfinder_id) {
    const [pathfinderRows] = await pool.query("SELECT id, name, email, phone FROM pathfinders WHERE id = ?", [
      rows[0].pathfinder_id,
    ])
    if (pathfinderRows.length > 0) {
      pathfinder = pathfinderRows[0]
    }
  }

  // Get creator details if created_by exists
  let creator = null
  if (rows[0].created_by) {
    const [creatorRows] = await pool.query("SELECT id, name, email, role FROM users WHERE id = ?", [rows[0].created_by])
    if (creatorRows.length > 0) {
      creator = creatorRows[0]
    }
  }

  // Get reference details based on reference_type and reference_id
  let reference = null
  if (rows[0].reference_id && rows[0].reference_type) {
    let referenceTable
    let referenceFields

    switch (rows[0].reference_type) {
      case "registration":
        referenceTable = "registrations"
        referenceFields = "id, pathfinder_id, registration_date, status"
        break
      case "monthly_fee":
        referenceTable = "monthly_fees"
        referenceFields = "id, pathfinder_id, month, year, amount"
        break
      case "event":
        referenceTable = "events"
        referenceFields = "id, name, start_date, end_date, fee"
        break
      default:
        referenceTable = null
    }

    if (referenceTable) {
      const [referenceRows] = await pool.query(`SELECT ${referenceFields} FROM ${referenceTable} WHERE id = ?`, [
        rows[0].reference_id,
      ])
      if (referenceRows.length > 0) {
        reference = {
          type: rows[0].reference_type,
          data: referenceRows[0],
        }
      }
    }
  }

  res.status(200).json({
    status: "success",
    data: {
      payment: {
        ...rows[0],
        pathfinder,
        creator,
        reference,
      },
    },
  })
})

export const createPayment = catchAsync(async (req, res, next) => {
  const { pathfinderId, amount, paymentDate, paymentMethod, description, referenceType, referenceId } = req.body

  // Validate pathfinder if provided
  if (pathfinderId) {
    const [pathfinder] = await pool.query("SELECT * FROM pathfinders WHERE id = ?", [pathfinderId])

    if (pathfinder.length === 0) {
      return next(new AppError("No pathfinder found with that ID", 404))
    }
  }

  // Validate reference if provided
  if (referenceType && referenceId) {
    let referenceTable

    switch (referenceType) {
      case "registration":
        referenceTable = "registrations"
        break
      case "monthly_fee":
        referenceTable = "monthly_fees"
        break
      case "event":
        referenceTable = "events"
        break
      case "other":
        // No validation needed for 'other' type
        referenceTable = null
        break
      default:
        return next(new AppError("Invalid reference type", 400))
    }

    if (referenceTable) {
      const [reference] = await pool.query(`SELECT * FROM ${referenceTable} WHERE id = ?`, [referenceId])

      if (reference.length === 0) {
        return next(new AppError(`No ${referenceType} found with that ID`, 404))
      }

      // If it's a pathfinder-related reference, ensure it matches the pathfinder
      if (pathfinderId && (referenceType === "registration" || referenceType === "monthly_fee")) {
        if (reference[0].pathfinder_id !== Number.parseInt(pathfinderId)) {
          return next(new AppError(`This ${referenceType} does not belong to the specified pathfinder`, 400))
        }
      }
    }
  }

  const [result] = await pool.query(
    `INSERT INTO payments 
    (pathfinder_id, amount, payment_date, payment_method, description, reference_type, reference_id, created_by) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [pathfinderId, amount, paymentDate, paymentMethod, description, referenceType, referenceId, req.user.id],
  )

  // Update the status of the referenced entity if applicable
  if (referenceType && referenceId) {
    if (referenceType === "registration") {
      await pool.query("UPDATE registrations SET payment_status = ? WHERE id = ?", ["paid", referenceId])
    } else if (referenceType === "monthly_fee") {
      await pool.query("UPDATE monthly_fees SET status = ?, payment_date = ? WHERE id = ?", [
        "paid",
        paymentDate,
        referenceId,
      ])
    } else if (referenceType === "event") {
      // For events, we need to update the event_participants table
      if (pathfinderId) {
        await pool.query("UPDATE event_participants SET payment_status = ? WHERE event_id = ? AND pathfinder_id = ?", [
          "paid",
          referenceId,
          pathfinderId,
        ])
      }
    }
  }

  // Create a cash book entry for this payment
  await pool.query(
    `INSERT INTO cash_book 
    (transaction_date, description, amount, type, category, reference, created_by) 
    VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      paymentDate,
      description || `Payment from ${pathfinderId ? "pathfinder" : "external source"}`,
      amount,
      "income",
      referenceType || "other",
      `payment_id:${result.insertId}`,
      req.user.id,
    ],
  )

  const [newPayment] = await pool.query("SELECT * FROM payments WHERE id = ?", [result.insertId])

  res.status(201).json({
    status: "success",
    data: {
      payment: newPayment[0],
    },
  })
})

export const updatePayment = catchAsync(async (req, res, next) => {
  // First check if the payment exists
  const [payment] = await pool.query("SELECT * FROM payments WHERE id = ?", [req.params.id])

  if (payment.length === 0) {
    return next(new AppError("No payment found with that ID", 404))
  }

  const { pathfinderId, amount, paymentDate, paymentMethod, description, referenceType, referenceId } = req.body

  // Validate pathfinder if provided
  if (pathfinderId) {
    const [pathfinder] = await pool.query("SELECT * FROM pathfinders WHERE id = ?", [pathfinderId])

    if (pathfinder.length === 0) {
      return next(new AppError("No pathfinder found with that ID", 404))
    }
  }

  // Validate reference if provided
  if (referenceType && referenceId) {
    let referenceTable

    switch (referenceType) {
      case "registration":
        referenceTable = "registrations"
        break
      case "monthly_fee":
        referenceTable = "monthly_fees"
        break
      case "event":
        referenceTable = "events"
        break
      case "other":
        // No validation needed for 'other' type
        referenceTable = null
        break
      default:
        return next(new AppError("Invalid reference type", 400))
    }

    if (referenceTable) {
      const [reference] = await pool.query(`SELECT * FROM ${referenceTable} WHERE id = ?`, [referenceId])

      if (reference.length === 0) {
        return next(new AppError(`No ${referenceType} found with that ID`, 404))
      }

      // If it's a pathfinder-related reference, ensure it matches the pathfinder
      if (pathfinderId && (referenceType === "registration" || referenceType === "monthly_fee")) {
        if (reference[0].pathfinder_id !== Number.parseInt(pathfinderId)) {
          return next(
            new AppError(
              `This ${referenceType} does not belong to the specified pathf  {
          return next(new AppError(\`This ${referenceType} does not belong to the specified pathfinder`,
              400,
            ),
          )
        }
      }
    }
  }

  // Build the query dynamically based on provided fields
  let query = "UPDATE payments SET "
  const values = []
  const updateFields = []

  if (pathfinderId !== undefined) {
    updateFields.push("pathfinder_id = ?")
    values.push(pathfinderId)
  }
  if (amount !== undefined) {
    updateFields.push("amount = ?")
    values.push(amount)
  }
  if (paymentDate !== undefined) {
    updateFields.push("payment_date = ?")
    values.push(paymentDate)
  }
  if (paymentMethod !== undefined) {
    updateFields.push("payment_method = ?")
    values.push(paymentMethod)
  }
  if (description !== undefined) {
    updateFields.push("description = ?")
    values.push(description)
  }
  if (referenceType !== undefined) {
    updateFields.push("reference_type = ?")
    values.push(referenceType)
  }
  if (referenceId !== undefined) {
    updateFields.push("reference_id = ?")
    values.push(referenceId)
  }

  // Add updated_at timestamp
  updateFields.push("updated_at = NOW()")

  // If no fields to update, return the existing payment
  if (updateFields.length === 0) {
    return res.status(200).json({
      status: "success",
      data: {
        payment: payment[0],
      },
    })
  }

  query += updateFields.join(", ")
  query += " WHERE id = ?"
  values.push(req.params.id)

  await pool.query(query, values)

  // Update the cash book entry if amount or date changed
  if (amount !== undefined || paymentDate !== undefined) {
    const [cashBookEntry] = await pool.query(`SELECT * FROM cash_book WHERE reference = ? AND type = 'income'`, [
      `payment_id:${req.params.id}`,
    ])

    if (cashBookEntry.length > 0) {
      const cashBookUpdateFields = []
      const cashBookValues = []

      if (amount !== undefined) {
        cashBookUpdateFields.push("amount = ?")
        cashBookValues.push(amount)
      }

      if (paymentDate !== undefined) {
        cashBookUpdateFields.push("transaction_date = ?")
        cashBookValues.push(paymentDate)
      }

      if (description !== undefined) {
        cashBookUpdateFields.push("description = ?")
        cashBookValues.push(description)
      }

      if (cashBookUpdateFields.length > 0) {
        const cashBookQuery = `UPDATE cash_book SET ${cashBookUpdateFields.join(", ")}, updated_at = NOW() WHERE reference = ? AND type = 'income'`
        cashBookValues.push(`payment_id:${req.params.id}`)

        await pool.query(cashBookQuery, cashBookValues)
      }
    }
  }

  // Get the updated payment
  const [updatedPayment] = await pool.query("SELECT * FROM payments WHERE id = ?", [req.params.id])

  res.status(200).json({
    status: "success",
    data: {
      payment: updatedPayment[0],
    },
  })
})

export const deletePayment = catchAsync(async (req, res, next) => {
  // First check if the payment exists
  const [payment] = await pool.query("SELECT * FROM payments WHERE id = ?", [req.params.id])

  if (payment.length === 0) {
    return next(new AppError("No payment found with that ID", 404))
  }

  // Begin a transaction
  const connection = await pool.getConnection()
  await connection.beginTransaction()

  try {
    // Delete the payment
    await connection.query("DELETE FROM payments WHERE id = ?", [req.params.id])

    // Delete the corresponding cash book entry
    await connection.query(`DELETE FROM cash_book WHERE reference = ? AND type = 'income'`, [
      `payment_id:${req.params.id}`,
    ])

    // If the payment was for a reference, update its status
    if (payment[0].reference_type && payment[0].reference_id) {
      if (payment[0].reference_type === "registration") {
        await connection.query("UPDATE registrations SET payment_status = ? WHERE id = ?", [
          "pending",
          payment[0].reference_id,
        ])
      } else if (payment[0].reference_type === "monthly_fee") {
        await connection.query("UPDATE monthly_fees SET status = ?, payment_date = NULL WHERE id = ?", [
          "pending",
          payment[0].reference_id,
        ])
      } else if (payment[0].reference_type === "event" && payment[0].pathfinder_id) {
        await connection.query(
          "UPDATE event_participants SET payment_status = ? WHERE event_id = ? AND pathfinder_id = ?",
          ["pending", payment[0].reference_id, payment[0].pathfinder_id],
        )
      }
    }

    // Commit the transaction
    await connection.commit()

    res.status(204).json({
      status: "success",
      data: null,
    })
  } catch (error) {
    // Rollback the transaction in case of error
    await connection.rollback()
    next(error)
  } finally {
    // Release the connection
    connection.release()
  }
})

// Get payment statistics
export const getPaymentStatistics = catchAsync(async (req, res) => {
  const { startDate, endDate } = req.query

  let dateFilter = ""
  const queryParams = []

  if (startDate && endDate) {
    dateFilter = "WHERE payment_date BETWEEN ? AND ?"
    queryParams.push(startDate, endDate)
  } else if (startDate) {
    dateFilter = "WHERE payment_date >= ?"
    queryParams.push(startDate)
  } else if (endDate) {
    dateFilter = "WHERE payment_date <= ?"
    queryParams.push(endDate)
  }

  // Total payments
  const [totalPayments] = await pool.query(
    `SELECT COUNT(*) as count, SUM(amount) as total FROM payments ${dateFilter}`,
    queryParams,
  )

  // Payments by method
  const [paymentsByMethod] = await pool.query(
    `SELECT payment_method, COUNT(*) as count, SUM(amount) as total 
     FROM payments 
     ${dateFilter} 
     GROUP BY payment_method`,
    queryParams,
  )

  // Payments by reference type
  const [paymentsByReferenceType] = await pool.query(
    `SELECT reference_type, COUNT(*) as count, SUM(amount) as total 
     FROM payments 
     ${dateFilter} 
     GROUP BY reference_type`,
    queryParams,
  )

  // Payments by month
  const [paymentsByMonth] = await pool.query(
    `SELECT 
       DATE_FORMAT(payment_date, '%Y-%m') as month,
       COUNT(*) as count,
       SUM(amount) as total
     FROM payments
     ${dateFilter}
     GROUP BY DATE_FORMAT(payment_date, '%Y-%m')
     ORDER BY month`,
    queryParams,
  )

  res.status(200).json({
    status: "success",
    data: {
      totalPayments: {
        count: totalPayments[0].count,
        amount: totalPayments[0].total || 0,
      },
      paymentsByMethod,
      paymentsByReferenceType,
      paymentsByMonth,
    },
  })
})

