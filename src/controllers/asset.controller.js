import pool from "../config/database.js"
import AppError from "../utils/AppError.js"
import catchAsync from "../utils/catchAsync.js"

export const getAllAssets = catchAsync(async (req, res) => {
  // Add filtering options
  const { condition, search } = req.query

  let query = "SELECT * FROM assets"
  const queryParams = []
  const conditions = []

  if (condition) {
    conditions.push("condition = ?")
    queryParams.push(condition)
  }

  if (search) {
    conditions.push("(name LIKE ? OR description LIKE ? OR location LIKE ?)")
    const searchTerm = `%${search}%`
    queryParams.push(searchTerm, searchTerm, searchTerm)
  }

  if (conditions.length > 0) {
    query += " WHERE " + conditions.join(" AND ")
  }

  query += " ORDER BY name ASC"

  const [rows] = await pool.query(query, queryParams)

  res.status(200).json({
    status: "success",
    results: rows.length,
    data: {
      assets: rows,
    },
  })
})

export const getAsset = catchAsync(async (req, res, next) => {
  const [rows] = await pool.query("SELECT * FROM assets WHERE id = ?", [req.params.id])

  if (rows.length === 0) {
    return next(new AppError("No asset found with that ID", 404))
  }

  res.status(200).json({
    status: "success",
    data: {
      asset: rows[0],
    },
  })
})

export const createAsset = catchAsync(async (req, res) => {
  const { name, description, acquisitionDate, value, condition, location } = req.body

  const [result] = await pool.query(
    `INSERT INTO assets 
    (name, description, acquisition_date, value, condition, location) 
    VALUES (?, ?, ?, ?, ?, ?)`,
    [name, description, acquisitionDate, value, condition || "good", location],
  )

  const [newAsset] = await pool.query("SELECT * FROM assets WHERE id = ?", [result.insertId])

  res.status(201).json({
    status: "success",
    data: {
      asset: newAsset[0],
    },
  })
})

export const updateAsset = catchAsync(async (req, res, next) => {
  // First check if the asset exists
  const [asset] = await pool.query("SELECT * FROM assets WHERE id = ?", [req.params.id])

  if (asset.length === 0) {
    return next(new AppError("No asset found with that ID", 404))
  }

  const { name, description, acquisitionDate, value, condition, location } = req.body

  // Build the query dynamically based on provided fields
  let query = "UPDATE assets SET "
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
  if (acquisitionDate !== undefined) {
    updateFields.push("acquisition_date = ?")
    values.push(acquisitionDate)
  }
  if (value !== undefined) {
    updateFields.push("value = ?")
    values.push(value)
  }
  if (condition !== undefined) {
    updateFields.push("condition = ?")
    values.push(condition)
  }
  if (location !== undefined) {
    updateFields.push("location = ?")
    values.push(location)
  }

  // Add updated_at timestamp
  updateFields.push("updated_at = NOW()")

  // If no fields to update, return the existing asset
  if (updateFields.length === 0) {
    return res.status(200).json({
      status: "success",
      data: {
        asset: asset[0],
      },
    })
  }

  query += updateFields.join(", ")
  query += " WHERE id = ?"
  values.push(req.params.id)

  await pool.query(query, values)

  // Get the updated asset
  const [updatedAsset] = await pool.query("SELECT * FROM assets WHERE id = ?", [req.params.id])

  res.status(200).json({
    status: "success",
    data: {
      asset: updatedAsset[0],
    },
  })
})

export const deleteAsset = catchAsync(async (req, res, next) => {
  const [result] = await pool.query("DELETE FROM assets WHERE id = ?", [req.params.id])

  if (result.affectedRows === 0) {
    return next(new AppError("No asset found with that ID", 404))
  }

  res.status(204).json({
    status: "success",
    data: null,
  })
})

// Get asset statistics
export const getAssetStatistics = catchAsync(async (req, res) => {
  // Total assets and value
  const [totalAssets] = await pool.query("SELECT COUNT(*) as count, SUM(value) as totalValue FROM assets")

  // Assets by condition
  const [assetsByCondition] = await pool.query(
    "SELECT condition, COUNT(*) as count, SUM(value) as totalValue FROM assets GROUP BY condition",
  )

  // Assets by location
  const [assetsByLocation] = await pool.query(
    "SELECT location, COUNT(*) as count, SUM(value) as totalValue FROM assets GROUP BY location",
  )

  // Assets by acquisition year
  const [assetsByYear] = await pool.query(
    `SELECT 
       YEAR(acquisition_date) as year,
       COUNT(*) as count,
       SUM(value) as totalValue
     FROM assets
     WHERE acquisition_date IS NOT NULL
     GROUP BY YEAR(acquisition_date)
     ORDER BY year DESC`,
  )

  res.status(200).json({
    status: "success",
    data: {
      totalAssets: {
        count: totalAssets[0].count,
        totalValue: totalAssets[0].totalValue || 0,
      },
      assetsByCondition,
      assetsByLocation,
      assetsByYear,
    },
  })
})

