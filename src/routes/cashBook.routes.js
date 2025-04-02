import express from "express"
import { body, param, query } from "express-validator"
import {
  getAllCashBookEntries,
  getCashBookEntry,
  createCashBookEntry,
  updateCashBookEntry,
  deleteCashBookEntry,
  getCashBookSummary,
} from "../controllers/cashBook.controller.js"
import { protect, restrictTo } from "../middleware/auth.js"
import validate from "../middleware/validate.js"

const router = express.Router()

// Protect all routes after this middleware
router.use(protect)

// Restrict all cash book routes to admin and director
router.use(restrictTo("admin", "director"))

router
  .route("/")
  .get(
    [
      query("type").optional().isIn(["income", "expense"]).withMessage("Type must be income or expense"),
      query("startDate").optional().isDate().withMessage("Start date must be a valid date"),
      query("endDate").optional().isDate().withMessage("End date must be a valid date"),
      query("category").optional().isString().withMessage("Category must be a string"),
    ],
    validate,
    getAllCashBookEntries,
  )
  .post(
    [
      body("transactionDate").isDate().withMessage("Valid transaction date is required"),
      body("description").notEmpty().withMessage("Description is required"),
      body("amount").isFloat({ min: 0.01 }).withMessage("Amount must be a positive number"),
      body("type").isIn(["income", "expense"]).withMessage("Type must be income or expense"),
      body("category").optional().isString().withMessage("Category must be a string"),
      body("reference").optional().isString().withMessage("Reference must be a string"),
    ],
    validate,
    createCashBookEntry,
  )

router.get(
  "/summary",
  [
    query("startDate").optional().isDate().withMessage("Start date must be a valid date"),
    query("endDate").optional().isDate().withMessage("End date must be a valid date"),
    query("groupBy").optional().isIn(["category", "month"]).withMessage("Group by must be category or month"),
  ],
  validate,
  getCashBookSummary,
)

router
  .route("/:id")
  .get([param("id").isInt().withMessage("Cash book entry ID must be an integer")], validate, getCashBookEntry)
  .patch(
    [
      param("id").isInt().withMessage("Cash book entry ID must be an integer"),
      body("transactionDate").optional().isDate().withMessage("Valid transaction date is required"),
      body("description").optional().notEmpty().withMessage("Description is required"),
      body("amount").optional().isFloat({ min: 0.01 }).withMessage("Amount must be a positive number"),
      body("type").optional().isIn(["income", "expense"]).withMessage("Type must be income or expense"),
      body("category").optional().isString().withMessage("Category must be a string"),
      body("reference").optional().isString().withMessage("Reference must be a string"),
    ],
    validate,
    updateCashBookEntry,
  )
  .delete([param("id").isInt().withMessage("Cash book entry ID must be an integer")], validate, deleteCashBookEntry)

export default router

