import express from "express"
import { body, param } from "express-validator"
import {
  getAllPermissions,
  getPermissionsByRole,
  createPermission,
  deletePermission,
} from "../controllers/permission.controller.js"
import { protect, restrictTo } from "../middleware/auth.js"
import validate from "../middleware/validate.js"

const router = express.Router()

// Protect all routes after this middleware
router.use(protect)
router.use(restrictTo("admin"))

router
  .route("/")
  .get(getAllPermissions)
  .post(
    [
      body("role")
        .isIn(["admin", "director", "leader", "user"])
        .withMessage("Role must be admin, director, leader, or user"),
      body("resource").notEmpty().withMessage("Resource is required"),
      body("action")
        .isIn(["create", "read", "update", "delete", "manage"])
        .withMessage("Action must be create, read, update, delete, or manage"),
    ],
    validate,
    createPermission,
  )

router.get(
  "/role/:role",
  [
    param("role")
      .isIn(["admin", "director", "leader", "user"])
      .withMessage("Role must be admin, director, leader, or user"),
  ],
  validate,
  getPermissionsByRole,
)

router.delete("/:id", [param("id").isInt().withMessage("Permission ID must be an integer")], validate, deletePermission)

export default router

