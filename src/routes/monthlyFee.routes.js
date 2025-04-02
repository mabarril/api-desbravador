import express from "express"
import { body, param, query } from "express-validator"
import {
  getAllMonthlyFees,
  getMonthlyFee,
  createMonthlyFee,
  updateMonthlyFee,
  deleteMonthlyFee,
  generateMonthlyFees,
  getMonthlyFeeStatistics,
} from "../controllers/monthlyFee.controller.js"
import { protect, restrictTo } from "../middleware/auth.js"
import validate from "../middleware/validate.js"

const router = express.Router()

// Protect all routes after this middleware
router.use(protect)

router
  .route("/")
  .get(
    [
      query("pathfinderId").optional().isInt().withMessage("Pathfinder ID must be an integer"),
      query("month").optional().isInt({ min: 1, max: 12 }).withMessage("Month must be between 1 and 12"),
      query("year").optional().isInt({ min: 2000, max: 2100 }).withMessage("Year must be between 2000 and 2100"),
      query("status")
        .optional()
        .isIn(["pending", "paid", "waived"])
        .withMessage("Status must be pending, paid, or waived"),
    ],
    validate,
    getAllMonthlyFees,
  )
  .post(
    [
      body("pathfinderId").isInt().withMessage("Pathfinder ID must be an integer"),
      body("month").isInt({ min: 1, max: 12 }).withMessage("Month must be between 1 and 12"),
      body("year").isInt({ min: 2000, max: 2100 }).withMessage("Year must be between 2000 and 2100"),
      body("amount").isFloat({ min: 0 }).withMessage("Amount must be a positive number"),
      body("status")
        .optional()
        .isIn(["pending", "paid", "waived"])
        .withMessage("Status must be pending, paid, or waived"),
      body("paymentDate").optional().isDate().withMessage("Payment date must be a valid date"),
      body("notes").optional().isString().withMessage("Notes must be a string"),
    ],
    validate,
    restrictTo("admin", "director"),
    createMonthlyFee,
  )

router.post(
  "/generate",
  [
    body("month").isInt({ min: 1, max: 12 }).withMessage("Month must be between 1 and 12"),
    body("year").isInt({ min: 2000, max: 2100 }).withMessage("Year must be between 2000 and 2100"),
    body("amount").isFloat({ min: 0 }).withMessage("Amount must be a positive number"),
    body("dueDate").optional().isDate().withMessage("Due date must be a valid date"),
  ],
  validate,
  restrictTo("admin", "director"),
  generateMonthlyFees,
)

router.get(
  "/statistics",
  [query("year").optional().isInt({ min: 2000, max: 2100 }).withMessage("Year must be between 2000 and 2100")],
  validate,
  restrictTo("admin", "director"),
  getMonthlyFeeStatistics,
)

router
  .route("/:id")
  .get([param("id").isInt().withMessage("Monthly fee ID must be an integer")], validate, getMonthlyFee)
  .patch(
    [
      param("id").isInt().withMessage("Monthly fee ID must be an integer"),
      body("pathfinderId").optional().isInt().withMessage("Pathfinder ID must be an integer"),
      body("month").optional().isInt({ min: 1, max: 12 }).withMessage("Month must be between 1 and 12"),
      body("year").optional().isInt({ min: 2000, max: 2100 }).withMessage("Year must be between 2000 and 2100"),
      body("amount").optional().isFloat({ min: 0 }).withMessage("Amount must be a positive number"),
      body("status")
        .optional()
        .isIn(["pending", "paid", "waived"])
        .withMessage("Status must be pending, paid, or waived"),
      body("paymentDate").optional().isDate().withMessage("Payment date must be a valid date"),
      body("notes").optional().isString().withMessage("Notes must be a string"),
    ],
    validate,
    restrictTo("admin", "director"),
    updateMonthlyFee,
  )
  .delete(
    [param("id").isInt().withMessage("Monthly fee ID must be an integer")],
    validate,
    restrictTo("admin", "director"),
    deleteMonthlyFee,
  )

export default router

