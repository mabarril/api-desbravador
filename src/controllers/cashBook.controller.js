import pool from "../config/database.js"
import AppError from "../utils/AppError.js"
import catchAsync from "../utils/catchAsync.js"

export const getAllCashBookEntries = catchAsync(async (req, res) => {
  // Add filtering options
  const { type, startDate, endDate, category } = req.query

  let query = "SELECT * FROM cash_book"
  const queryParams = []
  const conditions = []

  if (type) {
    conditions.push("type = ?")
    queryParams.push(type)
  }

  if (startDate) {
    conditions.push("transaction_date >= ?")
    queryParams.push(startDate)
  }

  if (endDate) {
    conditions.push("transaction_date <= ?")
    queryParams.push(endDate)
  }

  if (category) {
    conditions.push("category = ?")
    queryParams.push(category)
  }

  if (conditions.length > 0) {
    query += " WHERE " + conditions.join(" AND ")
  }

  query += " ORDER BY transaction_date DESC"

  const [rows] = await pool.query(query, queryParams)

  // Calculate totals
  let totalIncome = 0
  let totalExpense = 0

  rows.forEach((entry) => {
    if (entry.type === "income") {
      totalIncome += Number.parseFloat(entry.amount)
    } else {
      totalExpense += Number.parseFloat(entry.amount)
    }
  })

  const balance = totalIncome - totalExpense

  res.status(200).json({
    status: "success",
    results: rows.length,
    data: {
      cashBook: rows,
      summary: {
        totalIncome,
        totalExpense,
        balance,
      },
    },
  })
})

export const getCashBookEntry = catchAsync(async (req, res, next) => {
  const [rows] = await pool.query("SELECT * FROM cash_book WHERE id = ?", [req.params.id])

  if (rows.length === 0) {
    return next(new AppError("No cash book entry found with that ID", 404))
  }

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
      cashBookEntry: {
        ...rows[0],
        creator,
      },
    },
  })
})

export const createCashBookEntry = catchAsync(async (req, res) => {
  const { transactionDate, description, amount, type, category, reference } = req.body

  const [result] = await pool.query(
    `INSERT INTO cash_book 
    (transaction_date, description, amount, type, category, reference, created_by) 
    VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [transactionDate, description, amount, type, category, reference, req.user.id],
  )

  const [newEntry] = await pool.query("SELECT * FROM cash_book WHERE id = ?", [result.insertId])

  res.status(201).json({
    status: "success",
    data: {
      cashBookEntry: newEntry[0],
    },
  })
})

export const updateCashBookEntry = catchAsync(async (req, res, next) => {
  // First check if the entry exists
  const [entry] = await pool.query("SELECT * FROM cash_book WHERE id = ?", [req.params.id])

  if (entry.length === 0) {
    return next(new AppError("No cash book entry found with that ID", 404))
  }

  const { transactionDate, description, amount, type, category, reference } = req.body

  // Build the query dynamically based on provided fields
  let query = "UPDATE cash_book SET "
  const values = []
  const updateFields = []

  if (transactionDate !== undefined) {
    updateFields.push("transaction_date = ?")
    values.push(transactionDate)
  }
  if (description !== undefined) {
    updateFields.push("description = ?")
    values.push(description)
  }
  if (amount !== undefined) {
    updateFields.push("amount = ?")
    values.push(amount)
  }
  if (type !== undefined) {
    updateFields.push("type = ?")
    values.push(type)
  }
  if (category !== undefined) {
    updateFields.push("category = ?")
    values.push(category)
  }
  if (reference !== undefined) {
    updateFields.push("reference = ?")
    values.push(reference)
  }

  // Add updated_at timestamp
  updateFields.push("updated_at = NOW()")

  // If no fields to update, return the existing entry
  if (updateFields.length === 0) {
    return res.status(200).json({
      status: "success",
      data: {
        cashBookEntry: entry[0],
      },
    })
  }

  query += updateFields.join(", ")
  query += " WHERE id = ?"
  values.push(req.params.id)

  await pool.query(query, values)

  // Get the updated entry
  const [updatedEntry] = await pool.query("SELECT * FROM cash_book WHERE id = ?", [req.params.id])

  res.status(200).json({
    status: "success",
    data: {
      cashBookEntry: updatedEntry[0],
    },
  })
})

export const deleteCashBookEntry = catchAsync(async (req, res, next) => {
  const [result] = await pool.query("DELETE FROM cash_book WHERE id = ?", [req.params.id])

  if (result.affectedRows === 0) {
    return next(new AppError("No cash book entry found with that ID", 404))
  }

  res.status(204).json({
    status: "success",
    data: null,
  })
})

// Get cash book summary
export const getCashBookSummary = catchAsync(async (req, res) => {
  const { startDate, endDate, groupBy } = req.query

  let dateFilter = ""
  const queryParams = []

  if (startDate && endDate) {
    dateFilter = "WHERE transaction_date BETWEEN ? AND ?"
    queryParams.push(startDate, endDate)
  } else if (startDate) {
    dateFilter = "WHERE transaction_date >= ?"
    queryParams.push(startDate)
  } else if (endDate) {
    dateFilter = "WHERE transaction_date <= ?"
    queryParams.push(endDate)
  }

  // Default summary
  const [totalIncome] = await pool.query(
    `SELECT SUM(amount) as total FROM cash_book WHERE type = 'income' ${dateFilter ? dateFilter : ""}`,
    queryParams,
  )

  const [totalExpense] = await pool.query(
    `SELECT SUM(amount) as total FROM cash_book WHERE type = 'expense' ${dateFilter ? dateFilter : ""}`,
    [...queryParams],
  )

  // Group by summary if requested
  let groupedData = []

  if (groupBy === "category") {
    const [incomeByCategory] = await pool.query(
      `SELECT category, SUM(amount) as total 
       FROM cash_book 
       WHERE type = 'income' ${dateFilter ? dateFilter : ""} 
       GROUP BY category`,
      queryParams,
    )

    const [expenseByCategory] = await pool.query(
      `SELECT category, SUM(amount) as total 
       FROM cash_book 
       WHERE type = 'expense' ${dateFilter ? dateFilter : ""} 
       GROUP BY category`,
      [...queryParams],
    )

    groupedData = {
      incomeByCategory,
      expenseByCategory,
    }
  } else if (groupBy === "month") {
    const [byMonth] = await pool.query(
      `SELECT 
         DATE_FORMAT(transaction_date, '%Y-%m') as month,
         SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
         SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expense,
         SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END) as balance
       FROM cash_book
       ${dateFilter ? dateFilter : ""}
       GROUP BY DATE_FORMAT(transaction_date, '%Y-%m')
       ORDER BY month`,
      queryParams,
    )

    groupedData = byMonth
  }

  res.status(200).json({
    status: "success",
    data: {
      summary: {
        totalIncome: totalIncome[0].total || 0,
        totalExpense: totalExpense[0].total || 0,
        balance: (totalIncome[0].total || 0) - (totalExpense[0].total || 0),
      },
      groupedData: groupedData.length > 0 ? groupedData : undefined,
    },
  })
})

