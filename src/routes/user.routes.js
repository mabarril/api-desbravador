import express from "express"
import { body, param, query } from "express-validator"
import {
  getAllUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  updatePassword,
  getProfile,
  updateProfile,
  updateMyPassword,
} from "../controllers/user.controller.js"
import { protect, restrictTo } from "../middleware/auth.js"
import validate from "../middleware/validate.js"

const router = express.Router()

// Protect all routes after this middleware
router.use(protect)

// Routes for current user profile
router.get("/profile", getProfile)
router.patch(
  "/profile",
  [
    body("name").optional().isString().withMessage("Name must be a string"),
    body("email").optional().isEmail().withMessage("Please provide a valid email"),
  ],
  validate,
  updateProfile,
)
router.patch(
  "/password",
  [
    body("currentPassword").notEmpty().withMessage("Current password is required"),
    body("newPassword")
      .isLength({ min: 8 })
      .withMessage("Password must be at least 8 characters long")
      .matches(/\d/)
      .withMessage("Password must contain a number")
      .matches(/[A-Z]/)
      .withMessage("Password must contain an uppercase letter"),
  ],
  validate,
  updateMyPassword,
)

// Admin only routes
router.use(restrictTo("admin"))

router
  .route("/")
  .get(
    [
      query("role")
        .optional()
        .isIn(["user", "admin", "director", "leader"])
        .withMessage("Role must be user, admin, director, or leader"),
      query("search").optional().isString().withMessage("Search term must be a string"),
    ],
    validate,
    getAllUsers,
  )
  .post(
    [
      body("name").notEmpty().withMessage("Name is required"),
      body("email").isEmail().withMessage("Please provide a valid email"),
      body("password")
        .isLength({ min: 8 })
        .withMessage("Password must be at least 8 characters long")
        .matches(/\d/)
        .withMessage("Password must contain a number")
        .matches(/[A-Z]/)
        .withMessage("Password must contain an uppercase letter"),
      body("role")
        .optional()
        .isIn(["user", "admin", "director", "leader"])
        .withMessage("Role must be user, admin, director, or leader"),
    ],
    validate,
    createUser,
  )

router
  .route("/:id")
  .get([param("id").isInt().withMessage("User ID must be an integer")], validate, getUser)
  .patch(
    [
      param("id").isInt().withMessage("User ID must be an integer"),
      body("name").optional().isString().withMessage("Name must be a string"),
      body("email").optional().isEmail().withMessage("Please provide a valid email"),
      body("role")
        .optional()
        .isIn(["user", "admin", "director", "leader"])
        .withMessage("Role must be user, admin, director, or leader"),
    ],
    validate,
    updateUser,
  )
  .delete([param("id").isInt().withMessage("User ID must be an integer")], validate, deleteUser)

router.patch(
  "/:id/password",
  [
    param("id").isInt().withMessage("User ID must be an integer"),
    body("currentPassword").notEmpty().withMessage("Current password is required"),
    body("newPassword")
      .isLength({ min: 8 })
      .withMessage("Password must be at least 8 characters long")
      .matches(/\d/)
      .withMessage("Password must contain a number")
      .matches(/[A-Z]/)
      .withMessage("Password must contain an uppercase letter"),
  ],
  validate,
  updatePassword,
)

export default router

