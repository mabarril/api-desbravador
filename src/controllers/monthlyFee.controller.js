import pool from "../config/database.js"
import AppError from "../utils/AppError.js"
import catchAsync from "../utils/catchAsync.js"

export const getAllMonthlyFees = catchAsync(async (req, res) => {
  // Add filtering options
  const { pathfinderId, month, year, status } = req.query

  let query = "SELECT * FROM monthly_fees"
  const queryParams = []
  const conditions = []

  if (pathfinderId) {
    conditions.push("pathfinder_id = ?")
    queryParams.push(pathfinderId)
  }

  if (month) {
    conditions.push("month = ?")
    queryParams.push(month)
  }

  if (year) {
    conditions.push("year = ?")
    queryParams.push(year)
  }

  if (status) {
    conditions.push("status = ?")
    queryParams.push(status)
  }

  if (conditions.length > 0) {
    query += " WHERE " + conditions.join(" AND ")
  }

  query += " ORDER BY year DESC, month DESC"

  const [rows] = await pool.query(query, queryParams)

  res.status(200).json({
    status: "success",
    results: rows.length,
    data: {
      monthlyFees: rows,
    },
  })
})

export const getMonthlyFee = catchAsync(async (req, res, next) => {
  const [rows] = await pool.query("SELECT * FROM monthly_fees WHERE id = ?", [req.params.id])

  if (rows.length === 0) {
    return next(new AppError("No monthly fee found with that ID", 404))
  }

  // Get pathfinder details
  const [pathfinder] = await pool.query("SELECT id, name, email, phone FROM pathfinders WHERE id = ?", [
    rows[0].pathfinder_id,
  ])

  res.status(200).json({
    status: "success",
    data: {
      monthlyFee: {
        ...rows[0],
        pathfinder: pathfinder[0] || null,
      },
    },
  })
})

export const createMonthlyFee = catchAsync(async (req, res, next) => {
  const { pathfinderId, month, year, amount, status, paymentDate, notes } = req.body

  // Check if the pathfinder exists
  const [pathfinder] = await pool.query("SELECT * FROM pathfinders WHERE id = ?", [pathfinderId])

  if (pathfinder.length === 0) {
    return next(new AppError("No pathfinder found with that ID", 404))
  }

  // Check if a fee for this pathfinder, month, and year already exists
  const [existingFee] = await pool.query(
    "SELECT * FROM monthly_fees WHERE pathfinder_id = ? AND month = ? AND year = ?",
    [pathfinderId, month, year],
  )

  if (existingFee.length > 0) {
    return next(new AppError("A monthly fee for this pathfinder, month, and year already exists", 400))
  }

  const [result] = await pool.query(
    `INSERT INTO monthly_fees 
    (pathfinder_id, month, year, amount, status, payment_date, notes) 
    VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [pathfinderId, month, year, amount, status || "pending", paymentDate, notes],
  )

  const [newFee] = await pool.query("SELECT * FROM monthly_fees WHERE id = ?", [result.insertId])

  res.status(201).json({
    status: "success",
    data: {
      monthlyFee: newFee[0],
    },
  })
})

export const updateMonthlyFee = catchAsync(async (req, res, next) => {
  // First check if the fee exists
  const [fee] = await pool.query("SELECT * FROM monthly_fees WHERE id = ?", [req.params.id])

  if (fee.length === 0) {
    return next(new AppError("No monthly fee found with that ID", 404))
  }

  const { pathfinderId, month, year, amount, status, paymentDate, notes } = req.body

  // If changing pathfinder, month, or year, check for duplicates
  if (
    (pathfinderId && pathfinderId !== fee[0].pathfinder_id) ||
    (month && month !== fee[0].month) ||
    (year && year !== fee[0].year)
  ) {
    const [existingFee] = await pool.query(
      "SELECT * FROM monthly_fees WHERE pathfinder_id = ? AND month = ? AND year = ?",
      [pathfinderId || fee[0].pathfinder_id, month || fee[0].month, year || fee[0].year],
    )

    if (existingFee.length > 0 && existingFee[0].id !== Number.parseInt(req.params.id)) {
      return next(new AppError("A monthly fee for this pathfinder, month, and year already exists", 400))
    }
  }

  // Build the query dynamically based on provided fields
  let query = "UPDATE monthly_fees SET "
  const values = []
  const updateFields = []

  if (pathfinderId !== undefined) {
    // Check if the pathfinder exists
    const [pathfinder] = await pool.query("SELECT * FROM pathfinders WHERE id = ?", [pathfinderId])

    if (pathfinder.length === 0) {
      return next(new AppError("No pathfinder found with that ID", 404))
    }

    updateFields.push("pathfinder_id = ?")
    values.push(pathfinderId)
  }
  if (month !== undefined) {
    updateFields.push("month = ?")
    values.push(month)
  }
  if (year !== undefined) {
    updateFields.push("year = ?")
    values.push(year)
  }
  if (amount !== undefined) {
    updateFields.push("amount = ?")
    values.push(amount)
  }
  if (status !== undefined) {
    updateFields.push("status = ?")
    values.push(status)
  }
  if (paymentDate !== undefined) {
    updateFields.push("payment_date = ?")
    values.push(paymentDate)
  }
  if (notes !== undefined) {
    updateFields.push("notes = ?")
    values.push(notes)
  }

  // Add updated_at timestamp
  updateFields.push("updated_at = NOW()")

  // If no fields to update, return the existing fee
  if (updateFields.length === 0) {
    return res.status(200).json({
      status: "success",
      data: {
        monthlyFee: fee[0],
      },
    })
  }

  query += updateFields.join(", ")
  query += " WHERE id = ?"
  values.push(req.params.id)

  await pool.query(query, values)

  // Get the updated fee
  const [updatedFee] = await pool.query("SELECT * FROM monthly_fees WHERE id = ?", [req.params.id])

  res.status(200).json({
    status: "success",
    data: {
      monthlyFee: updatedFee[0],
    },
  })
})

export const deleteMonthlyFee = catchAsync(async (req, res, next) => {
  const [result] = await pool.query("DELETE FROM monthly_fees WHERE id = ?", [req.params.id])

  if (result.affectedRows === 0) {
    return next(new AppError("No monthly fee found with that ID", 404))
  }

  res.status(204).json({
    status: "success",
    data: null,
  })
})

// Generate monthly fees for all pathfinders
export const generateMonthlyFees = catchAsync(async (req, res, next) => {
  const { month, year, amount, dueDate } = req.body

  // Validate month and year
  if (month < 1 || month > 12) {
    return next(new AppError("Month must be between 1 and 12", 400))
  }

  if (year < 2000 || year > 2100) {
    return next(new AppError("Year must be between 2000 and 2100", 400))
  }

  // Get all active pathfinders
  const [pathfinders] = await pool.query("SELECT id FROM pathfinders")

  if (pathfinders.length === 0) {
    return next(new AppError("No pathfinders found", 404))
  }

  // Begin a transaction
  const connection = await pool.getConnection()
  await connection.beginTransaction()

  try {
    let createdCount = 0
    let skippedCount = 0

    for (const pathfinder of pathfinders) {
      // Check if a fee for this pathfinder, month, and year already exists
      const [existingFee] = await connection.query(
        "SELECT * FROM monthly_fees WHERE pathfinder_id = ? AND month = ? AND year = ?",
        [pathfinder.id, month, year],
      )

      if (existingFee.length === 0) {
        // Create a new fee
        await connection.query(
          `INSERT INTO monthly_fees 
          (pathfinder_id, month, year, amount, status, notes) 
          VALUES (?, ?, ?, ?, ?, ?)`,
          [
            pathfinder.id,
            month,
            year,
            amount,
            "pending",
            `Auto-generated fee for ${month}/${year}. Due date: ${dueDate || "Not specified"}`,
          ],
        )
        createdCount++
      } else {
        skippedCount++
      }
    }

    // Commit the transaction
    await connection.commit()

    res.status(201).json({
      status: "success",
      message: `Monthly fees generated successfully. Created: ${createdCount}, Skipped: ${skippedCount}`,
      data: {
        created: createdCount,
        skipped: skippedCount,
        total: pathfinders.length,
      },
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

// Get monthly fee statistics
export const getMonthlyFeeStatistics = catchAsync(async (req, res) => {
  const { year } = req.query

  let yearFilter = ""
  const queryParams = []

  if (year) {
    yearFilter = "WHERE year = ?"
    queryParams.push(year)
  }

  // Total fees
  const [totalFees] = await pool.query(
    `SELECT 
      COUNT(*) as count, 
      SUM(amount) as total,
      SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) as paid,
      SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'waived' THEN amount ELSE 0 END) as waived
    FROM monthly_fees ${yearFilter}`,
    queryParams,
  )

  // Fees by month
  const [feesByMonth] = await pool.query(
    `SELECT 
      year,
      month,
      COUNT(*) as count,
      SUM(amount) as total,
      SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) as paid,
      SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'waived' THEN amount ELSE 0 END) as waived
    FROM monthly_fees
    ${yearFilter}
    GROUP BY year, month
    ORDER BY year DESC, month ASC`,
    queryParams,
  )

  // Collection rate by month
  const collectionRateByMonth = feesByMonth.map((month) => ({
    year: month.year,
    month: month.month,
    collectionRate: month.total > 0 ? ((month.paid / month.total) * 100).toFixed(2) : 0,
  }))

  res.status(200).json({
    status: "success",
    data: {
      totalFees: {
        count: totalFees[0].count,
        total: totalFees[0].total || 0,
        paid: totalFees[0].paid || 0,
        pending: totalFees[0].pending || 0,
        waived: totalFees[0].waived || 0,
        collectionRate: totalFees[0].total > 0 ? ((totalFees[0].paid / totalFees[0].total) * 100).toFixed(2) : 0,
      },
      feesByMonth,
      collectionRateByMonth,
    },
  })
})

