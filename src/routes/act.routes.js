import express from "express"
import { body, param, query } from "express-validator"
import { getAllActs, getAct, createAct, updateAct, deleteAct, searchActs } from "../controllers/act.controller.js"
import { protect, restrictTo } from "../middleware/auth.js"
import validate from "../middleware/validate.js"

const router = express.Router()

// Protect all routes after this middleware
router.use(protect)

router
  .route("/")
  .get(
    [
      query("startDate").optional().isDate().withMessage("Start date must be a valid date"),
      query("endDate").optional().isDate().withMessage("End date must be a valid date"),
      query("search").optional().isString().withMessage("Search term must be a string"),
    ],
    validate,
    getAllActs,
  )
  .post(
    [
      body("title").notEmpty().withMessage("Title is required"),
      body("actDate").isDate().withMessage("Act date must be a valid date"),
      body("description").optional().isString().withMessage("Description must be a string"),
      body("location").optional().isString().withMessage("Location must be a string"),
      body("participants").optional().isString().withMessage("Participants must be a string"),
    ],
    validate,
    restrictTo("admin", "director"),
    createAct,
  )

router.get("/search", [query("query").notEmpty().withMessage("Search query is required")], validate, searchActs)

router
  .route("/:id")
  .get([param("id").isInt().withMessage("Act ID must be an integer")], validate, getAct)
  .patch(
    [
      param("id").isInt().withMessage("Act ID must be an integer"),
      body("title").optional().notEmpty().withMessage("Title is required"),
      body("actDate").optional().isDate().withMessage("Act date must be a valid date"),
      body("description").optional().isString().withMessage("Description must be a string"),
      body("location").optional().isString().withMessage("Location must be a string"),
      body("participants").optional().isString().withMessage("Participants must be a string"),
    ],
    validate,
    restrictTo("admin", "director"),
    updateAct,
  )
  .delete(
    [param("id").isInt().withMessage("Act ID must be an integer")],
    validate,
    restrictTo("admin", "director"),
    deleteAct,
  )

export default router

