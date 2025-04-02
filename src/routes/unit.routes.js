import express from "express"
import { body, param } from "express-validator"
import { getAllUnits, getUnit, createUnit, updateUnit, deleteUnit } from "../controllers/unit.controller.js"
import { protect, restrictTo } from "../middleware/auth.js"
import validate from "../middleware/validate.js"

const router = express.Router()

// Protect all routes after this middleware
router.use(protect)

router
  .route("/")
  .get(getAllUnits)
  .post(
    [
      body("name").notEmpty().withMessage("Name is required"),
      body("description").optional().isString().withMessage("Description must be a string"),
      body("leaderId").optional().isInt().withMessage("Leader ID must be an integer"),
    ],
    validate,
    restrictTo("admin", "director"),
    createUnit,
  )

router
  .route("/:id")
  .get([param("id").isInt().withMessage("Unit ID must be an integer")], validate, getUnit)
  .patch(
    [
      param("id").isInt().withMessage("Unit ID must be an integer"),
      body("name").optional().isString().withMessage("Name must be a string"),
      body("description").optional().isString().withMessage("Description must be a string"),
      body("leaderId").optional().isInt().withMessage("Leader ID must be an integer"),
    ],
    validate,
    restrictTo("admin", "director"),
    updateUnit,
  )
  .delete(
    [param("id").isInt().withMessage("Unit ID must be an integer")],
    validate,
    restrictTo("admin", "director"),
    deleteUnit,
  )

export default router

