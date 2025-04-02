import jwt from "jsonwebtoken"
import AppError from "../utils/AppError.js"
import catchAsync from "../utils/catchAsync.js"
import pool from "../config/database.js"

export const protect = catchAsync(async (req, res, next) => {
  // 1) Get token and check if it exists
  let token
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1]
  }

  if (!token) {
    return next(new AppError("You are not logged in. Please log in to get access.", 401))
  }

  // 2) Verify token
  const decoded = jwt.verify(token, process.env.JWT_SECRET)

  // 3) Check if user still exists
  const [rows] = await pool.query("SELECT * FROM users WHERE id = ?", [decoded.id])

  const currentUser = rows[0]
  if (!currentUser) {
    return next(new AppError("The user belonging to this token no longer exists.", 401))
  }

  // GRANT ACCESS TO PROTECTED ROUTE
  req.user = currentUser
  next()
})

export const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(new AppError("You do not have permission to perform this action", 403))
    }
    next()
  }
}

