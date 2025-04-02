import express from "express"
import { query } from "express-validator"
import { searchAll, searchEntity } from "../controllers/search.controller.js"
import { protect } from "../middleware/auth.js"
import validate from "../middleware/validate.js"

const router = express.Router()

// Protect all routes after this middleware
router.use(protect)

router.get(
  "/",
  [
    query("query").notEmpty().withMessage("Search query is required"),
    query("limit").optional().isInt({ min: 1, max: 50 }).withMessage("Limit must be between 1 and 50"),
  ],
  validate,
  searchAll,
)

router.get(
  "/entity",
  [
    query("entity").notEmpty().withMessage("Entity type is required"),
    query("query").notEmpty().withMessage("Search query is required"),
    query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("Limit must be between 1 and 100"),
    query("offset").optional().isInt({ min: 0 }).withMessage("Offset must be a non-negative integer"),
  ],
  validate,
  searchEntity,
)

export default router

