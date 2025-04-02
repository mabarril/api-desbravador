import express from "express"
import { body, param, query } from "express-validator"
import {
  getAllDocuments,
  getDocument,
  uploadDocument,
  updateDocument,
  deleteDocument,
  downloadDocument,
  addDocumentPermission,
  removeDocumentPermission,
  upload,
} from "../controllers/document.controller.js"
import { protect } from "../middleware/auth.js"
import validate from "../middleware/validate.js"

const router = express.Router()

// Protect all routes after this middleware
router.use(protect)

router
  .route("/")
  .get(
    [
      query("category").optional().isString().withMessage("Category must be a string"),
      query("isPublic").optional().isBoolean().withMessage("Is public must be a boolean"),
      query("search").optional().isString().withMessage("Search term must be a string"),
    ],
    validate,
    getAllDocuments,
  )
  .post(
    upload.single("file"),
    [
      body("title").notEmpty().withMessage("Title is required"),
      body("description").optional().isString().withMessage("Description must be a string"),
      body("category").optional().isString().withMessage("Category must be a string"),
      body("tags").optional().isString().withMessage("Tags must be a string"),
      body("isPublic").optional().isBoolean().withMessage("Is public must be a boolean"),
    ],
    validate,
    uploadDocument,
  )

router
  .route("/:id")
  .get([param("id").isInt().withMessage("Document ID must be an integer")], validate, getDocument)
  .patch(
    [
      param("id").isInt().withMessage("Document ID must be an integer"),
      body("title").optional().notEmpty().withMessage("Title is required"),
      body("description").optional().isString().withMessage("Description must be a string"),
      body("category").optional().isString().withMessage("Category must be a string"),
      body("tags").optional().isString().withMessage("Tags must be a string"),
      body("isPublic").optional().isBoolean().withMessage("Is public must be a boolean"),
    ],
    validate,
    updateDocument,
  )
  .delete([param("id").isInt().withMessage("Document ID must be an integer")], validate, deleteDocument)

router.get(
  "/:id/download",
  [param("id").isInt().withMessage("Document ID must be an integer")],
  validate,
  downloadDocument,
)

router.post(
  "/:id/permissions",
  [
    param("id").isInt().withMessage("Document ID must be an integer"),
    body("userId").optional().isInt().withMessage("User ID must be an integer"),
    body("role")
      .optional()
      .isIn(["admin", "director", "leader", "user"])
      .withMessage("Role must be admin, director, leader, or user"),
    body("permissionType")
      .isIn(["view", "edit", "delete"])
      .withMessage("Permission type must be view, edit, or delete"),
  ],
  validate,
  addDocumentPermission,
)

router.delete(
  "/:id/permissions/:permissionId",
  [
    param("id").isInt().withMessage("Document ID must be an integer"),
    param("permissionId").isInt().withMessage("Permission ID must be an integer"),
  ],
  validate,
  removeDocumentPermission,
)

export default router

