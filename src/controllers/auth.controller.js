import jwt from "jsonwebtoken"
import bcrypt from "bcryptjs"
import crypto from "crypto"
import pool from "../config/database.js"
import AppError from "../utils/AppError.js"
import catchAsync from "../utils/catchAsync.js"

const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  })
}

const createSendToken = (user, statusCode, res) => {
  const token = signToken(user.id)

  // Remove password from output
  user.password = undefined

  res.status(statusCode).json({
    status: "success",
    token,
    data: {
      user,
    },
  })
}

export const register = catchAsync(async (req, res, next) => {
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

  const [newUser] = await pool.query("SELECT id, name, email, role FROM users WHERE id = ?", [result.insertId])

  createSendToken(newUser[0], 201, res)
})

export const login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body

  // Check if email and password exist
  if (!email || !password) {
    return next(new AppError("Please provide email and password", 400))
  }

  // Check if user exists && password is correct
  const [users] = await pool.query("SELECT * FROM users WHERE email = ?", [email])

  if (users.length === 0 || !(await bcrypt.compare(password, users[0].password))) {
    return next(new AppError("Incorrect email or password", 401))
  }

  // If everything ok, send token to client
  createSendToken(users[0], 200, res)
})

export const forgotPassword = catchAsync(async (req, res, next) => {
  // 1) Get user based on POSTed email
  const [users] = await pool.query("SELECT * FROM users WHERE email = ?", [req.body.email])

  if (users.length === 0) {
    return next(new AppError("There is no user with that email address.", 404))
  }

  // 2) Generate the random reset token
  const resetToken = crypto.randomBytes(32).toString("hex")
  const passwordResetToken = crypto.createHash("sha256").update(resetToken).digest("hex")

  const passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000).toISOString().slice(0, 19).replace("T", " ")

  await pool.query("UPDATE users SET password_reset_token = ?, password_reset_expires = ? WHERE email = ?", [
    passwordResetToken,
    passwordResetExpires,
    req.body.email,
  ])

  // 3) Send it to user's email (in a real app)
  const resetURL = `${req.protocol}://${req.get("host")}/api/auth/reset-password/${resetToken}`

  try {
    // In a real app, you would send an email here
    console.log(`Reset URL: ${resetURL}`)

    res.status(200).json({
      status: "success",
      message: "Token sent to email!",
    })
  } catch (err) {
    await pool.query("UPDATE users SET password_reset_token = NULL, password_reset_expires = NULL WHERE email = ?", [
      req.body.email,
    ])

    return next(new AppError("There was an error sending the email. Try again later!", 500))
  }
})

export const resetPassword = catchAsync(async (req, res, next) => {
  // 1) Get user based on the token
  const hashedToken = crypto.createHash("sha256").update(req.params.token).digest("hex")

  const [users] = await pool.query(
    "SELECT * FROM users WHERE password_reset_token = ? AND password_reset_expires > ?",
    [hashedToken, new Date().toISOString().slice(0, 19).replace("T", " ")],
  )

  // 2) If token has not expired, and there is user, set the new password
  if (users.length === 0) {
    return next(new AppError("Token is invalid or has expired", 400))
  }

  const user = users[0]

  // 3) Update password
  const hashedPassword = await bcrypt.hash(req.body.password, 12)

  await pool.query(
    "UPDATE users SET password = ?, password_reset_token = NULL, password_reset_expires = NULL WHERE id = ?",
    [hashedPassword, user.id],
  )

  // 4) Log the user in, send JWT
  createSendToken(user, 200, res)
})

