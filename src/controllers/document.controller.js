import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import multer from "multer"
import pool from "../config/database.js"
import AppError from "../utils/AppError.js"
import catchAsync from "../utils/catchAsync.js"
import { logAction } from "../utils/auditLogger.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, "..", "..", "uploads", "documents")
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9)
    const ext = path.extname(file.originalname)
    cb(null, file.fieldname + "-" + uniqueSuffix + ext)
  },
})

const fileFilter = (req, file, cb) => {
  // Accept common document types
  const allowedTypes = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "text/plain",
    "image/jpeg",
    "image/png",
    "image/gif",
  ]

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new AppError("Invalid file type. Only documents, images, and common office files are allowed.", 400), false)
  }
}

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
})

export const getAllDocuments = catchAsync(async (req, res) => {
  const { category, isPublic, search } = req.query

  // Build query based on user role and permissions
  let query = `
    SELECT d.*, u.name as uploaded_by_name 
    FROM documents d
    LEFT JOIN users u ON d.uploaded_by = u.id
    WHERE (d.is_public = TRUE`

  const queryParams = []

  // If user is not admin or director, add permission check
  if (req.user.role !== "admin" && req.user.role !== "director") {
    query += ` OR d.uploaded_by = ? OR EXISTS (
      SELECT 1 FROM document_permissions dp 
      WHERE dp.document_id = d.id AND (dp.user_id = ? OR dp.role = ?)
    )`
    queryParams.push(req.user.id, req.user.id, req.user.role)
  }

  query += ")"

  // Add filters
  if (category) {
    query += " AND d.category = ?"
    queryParams.push(category)
  }

  if (isPublic !== undefined) {
    query += " AND d.is_public = ?"
    queryParams.push(isPublic === "true")
  }

  if (search) {
    query += " AND (d.title LIKE ? OR d.description LIKE ? OR d.tags LIKE ?)"
    const searchTerm = `%${search}%`
    queryParams.push(searchTerm, searchTerm, searchTerm)
  }

  query += " ORDER BY d.created_at DESC"

  const [rows] = await pool.query(query, queryParams)

  res.status(200).json({
    status: "success",
    results: rows.length,
    data: {
      documents: rows,
    },
  })
})

export const getDocument = catchAsync(async (req, res, next) => {
  const { id } = req.params

  // Get document with permission check
  let query = `
    SELECT d.*, u.name as uploaded_by_name 
    FROM documents d
    LEFT JOIN users u ON d.uploaded_by = u.id
    WHERE d.id = ? AND (d.is_public = TRUE`

  const queryParams = [id]

  // If user is not admin or director, add permission check
  if (req.user.role !== "admin" && req.user.role !== "director") {
    query += ` OR d.uploaded_by = ? OR EXISTS (
      SELECT 1 FROM document_permissions dp 
      WHERE dp.document_id = d.id AND (dp.user_id = ? OR dp.role = ?)
    )`
    queryParams.push(req.user.id, req.user.id, req.user.role)
  }

  query += ")"

  const [rows] = await pool.query(query, queryParams)

  if (rows.length === 0) {
    return next(new AppError("Document not found or you do not have permission to access it", 404))
  }

  // Get permissions for this document
  const [permissions] = await pool.query(
    `SELECT dp.*, u.name as user_name 
     FROM document_permissions dp
     LEFT JOIN users u ON dp.user_id = u.id
     WHERE dp.document_id = ?`,
    [id],
  )

  res.status(200).json({
    status: "success",
    data: {
      document: rows[0],
      permissions,
    },
  })
})

export const uploadDocument = catchAsync(async (req, res, next) => {
  if (!req.file) {
    return next(new AppError("Please upload a file", 400))
  }

  const { title, description, category, tags, isPublic } = req.body

  // Insert document into database
  const [result] = await pool.query(
    `INSERT INTO documents 
    (title, description, file_path, file_type, file_size, category, tags, is_public, uploaded_by) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      title,
      description,
      req.file.path,
      req.file.mimetype,
      req.file.size,
      category,
      tags,
      isPublic === "true",
      req.user.id,
    ],
  )

  const documentId = result.insertId

  // Log the action
  await logAction({
    userId: req.user.id,
    action: "upload_document",
    entityType: "document",
    entityId: documentId,
    details: { title, filePath: req.file.path },
    ipAddress: req.ip,
  })

  // Get the created document
  const [document] = await pool.query("SELECT * FROM documents WHERE id = ?", [documentId])

  res.status(201).json({
    status: "success",
    data: {
      document: document[0],
    },
  })
})

export const updateDocument = catchAsync(async (req, res, next) => {
  const { id } = req.params
  const { title, description, category, tags, isPublic } = req.body

  // Check if document exists and user has permission
  const [document] = await pool.query(
    `SELECT * FROM documents 
     WHERE id = ? AND (uploaded_by = ? OR ? IN ('admin', 'director'))`,
    [id, req.user.id, req.user.role],
  )

  if (document.length === 0) {
    return next(new AppError("Document not found or you do not have permission to update it", 404))
  }

  // Update document
  await pool.query(
    `UPDATE documents 
     SET title = ?, description = ?, category = ?, tags = ?, is_public = ?, updated_at = NOW() 
     WHERE id = ?`,
    [title, description, category, tags, isPublic === "true", id],
  )

  // Log the action
  await logAction({
    userId: req.user.id,
    action: "update_document",
    entityType: "document",
    entityId: id,
    details: { title },
    ipAddress: req.ip,
  })

  // Get the updated document
  const [updatedDocument] = await pool.query("SELECT * FROM documents WHERE id = ?", [id])

  res.status(200).json({
    status: "success",
    data: {
      document: updatedDocument[0],
    },
  })
})

export const deleteDocument = catchAsync(async (req, res, next) => {
  const { id } = req.params

  // Check if document exists and user has permission
  const [document] = await pool.query(
    `SELECT * FROM documents 
     WHERE id = ? AND (uploaded_by = ? OR ? IN ('admin', 'director'))`,
    [id, req.user.id, req.user.role],
  )

  if (document.length === 0) {
    return next(new AppError("Document not found or you do not have permission to delete it", 404))
  }

  // Delete the file
  try {
    fs.unlinkSync(document[0].file_path)
  } catch (error) {
    console.error("Error deleting file:", error)
    // Continue even if file deletion fails
  }

  // Delete document from database
  await pool.query("DELETE FROM documents WHERE id = ?", [id])

  // Log the action
  await logAction({
    userId: req.user.id,
    action: "delete_document",
    entityType: "document",
    entityId: id,
    details: { title: document[0].title },
    ipAddress: req.ip,
  })

  res.status(204).json({
    status: "success",
    data: null,
  })
})

export const downloadDocument = catchAsync(async (req, res, next) => {
  const { id } = req.params

  // Get document with permission check
  let query = `
    SELECT * FROM documents
    WHERE id = ? AND (is_public = TRUE`

  const queryParams = [id]

  // If user is not admin or director, add permission check
  if (req.user.role !== "admin" && req.user.role !== "director") {
    query += ` OR uploaded_by = ? OR EXISTS (
      SELECT 1 FROM document_permissions dp 
      WHERE dp.document_id = id AND (dp.user_id = ? OR dp.role = ?)
    )`
    queryParams.push(req.user.id, req.user.id, req.user.role)
  }

  query += ")"

  const [rows] = await pool.query(query, queryParams)

  if (rows.length === 0) {
    return next(new AppError("Document not found or you do not have permission to access it", 404))
  }

  const document = rows[0]

  // Check if file exists
  if (!fs.existsSync(document.file_path)) {
    return next(new AppError("Document file not found", 404))
  }

  // Log the action
  await logAction({
    userId: req.user.id,
    action: "download_document",
    entityType: "document",
    entityId: id,
    details: { title: document.title },
    ipAddress: req.ip,
  })

  // Send the file
  res.download(document.file_path, document.title + path.extname(document.file_path))
})

export const addDocumentPermission = catchAsync(async (req, res, next) => {
  const { id } = req.params
  const { userId, role, permissionType } = req.body

  // Check if document exists and user has permission to manage it
  const [document] = await pool.query(
    `SELECT * FROM documents 
     WHERE id = ? AND (uploaded_by = ? OR ? IN ('admin', 'director'))`,
    [id, req.user.id, req.user.role],
  )

  if (document.length === 0) {
    return next(new AppError("Document not found or you do not have permission to manage it", 404))
  }

  // Validate user if userId is provided
  if (userId) {
    const [user] = await pool.query("SELECT id FROM users WHERE id = ?", [userId])
    if (user.length === 0) {
      return next(new AppError("User not found", 404))
    }
  }

  // Check if permission already exists
  const [existingPermission] = await pool.query(
    "SELECT * FROM document_permissions WHERE document_id = ? AND user_id = ? AND role = ?",
    [id, userId, role],
  )

  if (existingPermission.length > 0) {
    // Update existing permission
    await pool.query("UPDATE document_permissions SET permission_type = ? WHERE id = ?", [
      permissionType,
      existingPermission[0].id,
    ])
  } else {
    // Create new permission
    await pool.query(
      "INSERT INTO document_permissions (document_id, user_id, role, permission_type) VALUES (?, ?, ?, ?)",
      [id, userId, role, permissionType],
    )
  }

  // Log the action
  await logAction({
    userId: req.user.id,
    action: "add_document_permission",
    entityType: "document",
    entityId: id,
    details: { userId, role, permissionType },
    ipAddress: req.ip,
  })

  // Get all permissions for this document
  const [permissions] = await pool.query(
    `SELECT dp.*, u.name as user_name 
     FROM document_permissions dp
     LEFT JOIN users u ON dp.user_id = u.id
     WHERE dp.document_id = ?`,
    [id],
  )

  res.status(200).json({
    status: "success",
    data: {
      permissions,
    },
  })
})

export const removeDocumentPermission = catchAsync(async (req, res, next) => {
  const { id, permissionId } = req.params

  // Check if document exists and user has permission to manage it
  const [document] = await pool.query(
    `SELECT * FROM documents 
     WHERE id = ? AND (uploaded_by = ? OR ? IN ('admin', 'director'))`,
    [id, req.user.id, req.user.role],
  )

  if (document.length === 0) {
    return next(new AppError("Document not found or you do not have permission to manage it", 404))
  }

  // Check if permission exists
  const [permission] = await pool.query("SELECT * FROM document_permissions WHERE id = ? AND document_id = ?", [
    permissionId,
    id,
  ])

  if (permission.length === 0) {
    return next(new AppError("Permission not found", 404))
  }

  // Delete permission
  await pool.query("DELETE FROM document_permissions WHERE id = ?", [permissionId])

  // Log the action
  await logAction({
    userId: req.user.id,
    action: "remove_document_permission",
    entityType: "document",
    entityId: id,
    details: { permissionId },
    ipAddress: req.ip,
  })

  res.status(204).json({
    status: "success",
    data: null,
  })
})

