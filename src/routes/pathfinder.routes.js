import express from "express"
import { body, param } from "express-validator"
import {
  getAllPathfinders,
  getPathfinder,
  createPathfinder,
  updatePathfinder,
  deletePathfinder,
} from "../controllers/pathfinder.controller.js"
import { protect, restrictTo } from "../middleware/auth.js"
import validate from "../middleware/validate.js"

const router = express.Router()

// Protect all routes after this middleware
router.use(protect)

router
  .route("/")
  .get(getAllPathfinders)
  .post(
    [
      body("name").notEmpty().withMessage("Name is required"),
      body("birthDate").isDate().withMessage("Valid birth date is required"),
      body("gender").isIn(["male", "female", "other"]).withMessage("Gender must be male, female, or other"),
      body("email").optional().isEmail().withMessage("Valid email is required"),
      body("phone").optional().isMobilePhone().withMessage("Valid phone number is required"),
      body("address").optional().isString().withMessage("Address must be a string"),
      body("unitId").optional().isInt().withMessage("Unit ID must be an integer"),
    ],
    validate,
    createPathfinder,
  )

router
  .route("/:id")
  .get([param("id").isInt().withMessage("Pathfinder ID must be an integer")], validate, getPathfinder)
  .patch(
    [
      param("id").isInt().withMessage("Pathfinder ID must be an integer"),
      body("name").optional().isString().withMessage("Name must be a string"),
      body("birthDate").optional().isDate().withMessage("Valid birth date is required"),
      body("gender").optional().isIn(["male", "female", "other"]).withMessage("Gender must be male, female, or other"),
      body("email").optional().isEmail().withMessage("Valid email is required"),
      body("phone").optional().isMobilePhone().withMessage("Valid phone number is required"),
      body("address").optional().isString().withMessage("Address must be a string"),
      body("unitId").optional().isInt().withMessage("Unit ID must be an integer"),
    ],
    validate,
    updatePathfinder,
  )
  .delete(
    [param("id").isInt().withMessage("Pathfinder ID must be an integer")],
    validate,
    restrictTo("admin", "director"),
    deletePathfinder,
  )

export default router

