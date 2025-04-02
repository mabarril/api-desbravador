import bcrypt from "bcryptjs"
import pool from "../config/database.js"
import AppError from "../utils/AppError.js"
import catchAsync from "../utils/catchAsync.js"

export const getAllUsers = catchAsync(async (req, res) => {
  // Add filtering options
  const { role, search } = req.query

  let query = "SELECT id, name, email, role, created_at, updated_at FROM users"
  const queryParams = []
  const conditions = []

  if (role) {
    conditions.push("role = ?")
    queryParams.push(role)
  }

  if (search) {
    conditions.push("(name LIKE ? OR email LIKE ?)")
    const searchTerm = `%${search}%`
    queryParams.push(searchTerm, searchTerm)
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
      users: rows,
    },
  })
})

export const getUser = catchAsync(async (req, res, next) => {
  const [rows] = await pool.query("SELECT id, name, email, role, created_at, updated_at FROM users WHERE id = ?", [
    req.params.id,
  ])

  if (rows.length === 0) {
    return next(new AppError("No user found with that ID", 404))
  }

  // Get units led by this user if they are a leader
  let units = []
  if (rows[0].role === "leader" || rows[0].role === "director") {
    const [unitRows] = await pool.query("SELECT * FROM units WHERE leader_id = ?", [rows[0].id])
    units = unitRows
  }

  res.status(200).json({
    status: "success",
    data: {
      user: {
        ...rows[0],
        units,
      },
    },
  })
})

export const createUser = catchAsync(async (req, res, next) => {
  const { name, email, password, role } = req.body

  // Check if user already exists
  const [existingUsers] = await pool.query("SELECT * FROM users WHERE email = ?", [email])

  if (existingUsers.length > 0) {
    return next(new AppError("User already exists with that email", 400))
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 12)

  // Create new user
  const [result] = await pool.query("INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)", [
    name,
    email,
    hashedPassword,
    role || "user",
  ])

  const [newUser] = await pool.query("SELECT id, name, email, role, created_at, updated_at FROM users WHERE id = ?", [
    result.insertId,
  ])

  res.status(201).json({
    status: "success",
    data: {
      user: newUser[0],
    },
  })
})

export const updateUser = catchAsync(async (req, res, next) => {
  // First check if the user exists
  const [user] = await pool.query("SELECT * FROM users WHERE id = ?", [req.params.id])

  if (user.length === 0) {
    return next(new AppError("No user found with that ID", 404))
  }

  const { name, email, role } = req.body

  // If changing email, check if it's already taken
  if (email && email !== user[0].email) {
    const [existingUsers] = await pool.query("SELECT * FROM users WHERE email = ?", [email])

    if (existingUsers.length > 0) {
      return next(new AppError("Email already in use", 400))
    }
  }

  // Build the query dynamically based on provided fields
  let query = "UPDATE users SET "
  const values = []
  const updateFields = []

  if (name !== undefined) {
    updateFields.push("name = ?")
    values.push(name)
  }
  if (email !== undefined) {
    updateFields.push("email = ?")
    values.push(email)
  }
  if (role !== undefined) {
    updateFields.push("role = ?")
    values.push(role)
  }

  // Add updated_at timestamp
  updateFields.push("updated_at = NOW()")

  // If no fields to update, return the existing user
  if (updateFields.length === 0) {
    return res.status(200).json({
      status: "success",
      data: {
        user: {
          id: user[0].id,
          name: user[0].name,
          email: user[0].email,
          role: user[0].role,
          created_at: user[0].created_at,
          updated_at: user[0].updated_at,
        },
      },
    })
  }

  query += updateFields.join(", ")
  query += " WHERE id = ?"
  values.push(req.params.id)

  await pool.query(query, values)

  // Get the updated user
  const [updatedUser] = await pool.query(
    "SELECT id, name, email, role, created_at, updated_at FROM users WHERE id = ?",
    [req.params.id],
  )

  res.status(200).json({
    status: "success",
    data: {
      user: updatedUser[0],
    },
  })
})

export const deleteUser = catchAsync(async (req, res, next) => {
  // Check if user is trying to delete themselves
  if (req.params.id === req.user.id.toString()) {
    return next(new AppError("You cannot delete your own account", 400))
  }

  const [result] = await pool.query("DELETE FROM users WHERE id = ?", [req.params.id])

  if (result.affectedRows === 0) {
    return next(new AppError("No user found with that ID", 404))
  }

  res.status(204).json({
    status: "success",
    data: null,
  })
})

export const updatePassword = catchAsync(async (req, res, next) => {
  const { currentPassword, newPassword } = req.body

  // Get user with password
  const [user] = await pool.query("SELECT * FROM users WHERE id = ?", [req.params.id])

  if (user.length === 0) {
    return next(new AppError("No user found with that ID", 404))
  }

  // Check if current password is correct
  const isPasswordCorrect = await bcrypt.compare(currentPassword, user[0].password)

  if (!isPasswordCorrect) {
    return next(new AppError("Current password is incorrect", 401))
  }

  // Hash new password
  const hashedPassword = await bcrypt.hash(newPassword, 12)

  // Update password
  await pool.query("UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?", [hashedPassword, req.params.id])

  res.status(200).json({
    status: "success",
    message: "Password updated successfully",
  })
})

// Get user profile (for current user)
export const getProfile = catchAsync(async (req, res, next) => {
  const [rows] = await pool.query("SELECT id, name, email, role, created_at, updated_at FROM users WHERE id = ?", [
    req.user.id,
  ])

  // Get units led by this user if they are a leader
  let units = []
  if (rows[0].role === "leader" || rows[0].role === "director") {
    const [unitRows] = await pool.query("SELECT * FROM units WHERE leader_id = ?", [rows[0].id])
    units = unitRows
  }

  res.status(200).json({
    status: "success",
    data: {
      user: {
        ...rows[0],
        units,
      },
    },
  })
})

// Update user profile (for current user)
export const updateProfile = catchAsync(async (req, res, next) => {
  const { name, email } = req.body

  // If changing email, check if it's already taken
  if (email && email !== req.user.email) {
    const [existingUsers] = await pool.query("SELECT * FROM users WHERE email = ?", [email])

    if (existingUsers.length > 0) {
      return next(new AppError("Email already in use", 400))
    }
  }

  // Build the query dynamically based on provided fields
  let query = "UPDATE users SET "
  const values = []
  const updateFields = []

  if (name !== undefined) {
    updateFields.push("name = ?")
    values.push(name)
  }
  if (email !== undefined) {
    updateFields.push("email = ?")
    values.push(email)
  }

  // Add updated_at timestamp
  updateFields.push("updated_at = NOW()")

  // If no fields to update, return the existing user
  if (updateFields.length === 0) {
    return res.status(200).json({
      status: "success",
      data: {
        user: {
          id: req.user.id,
          name: req.user.name,
          email: req.user.email,
          role: req.user.role,
        },
      },
    })
  }

  query += updateFields.join(", ")
  query += " WHERE id = ?"
  values.push(req.user.id)

  await pool.query(query, values)

  // Get the updated user
  const [updatedUser] = await pool.query(
    "SELECT id, name, email, role, created_at, updated_at FROM users WHERE id = ?",
    [req.user.id],
  )

  res.status(200).json({
    status: "success",
    data: {
      user: updatedUser[0],
    },
  })
})

// Update current user password
export const updateMyPassword = catchAsync(async (req, res, next) => {
  const { currentPassword, newPassword } = req.body

  // Get user with password
  const [user] = await pool.query("SELECT * FROM users WHERE id = ?", [req.user.id])

  // Check if current password is correct
  const isPasswordCorrect = await bcrypt.compare(currentPassword, user[0].password)

  if (!isPasswordCorrect) {
    return next(new AppError("Current password is incorrect", 401))
  }

  // Hash new password
  const hashedPassword = await bcrypt.hash(newPassword, 12)

  // Update password
  await pool.query("UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?", [hashedPassword, req.user.id])

  res.status(200).json({
    status: "success",
    message: "Password updated successfully",
  })
})

