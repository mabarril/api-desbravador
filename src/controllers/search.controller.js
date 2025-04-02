import pool from "../config/database.js"
import catchAsync from "../utils/catchAsync.js"

export const searchAll = catchAsync(async (req, res) => {
  const { query, limit } = req.query

  if (!query) {
    return res.status(400).json({
      status: "fail",
      message: "Search query is required",
    })
  }

  const searchLimit = limit ? Number.parseInt(limit) : 5
  const searchTerm = `%${query}%`

  // Search pathfinders
  const [pathfinders] = await pool.query(
    `SELECT id, name, email, phone, 'pathfinder' as entity_type 
     FROM pathfinders 
     WHERE name LIKE ? OR email LIKE ? OR phone LIKE ? 
     LIMIT ?`,
    [searchTerm, searchTerm, searchTerm, searchLimit],
  )

  // Search units
  const [units] = await pool.query(
    `SELECT id, name, description, 'unit' as entity_type 
     FROM units 
     WHERE name LIKE ? OR description LIKE ? 
     LIMIT ?`,
    [searchTerm, searchTerm, searchLimit],
  )

  // Search classes
  const [classes] = await pool.query(
    `SELECT id, name, description, 'class' as entity_type 
     FROM classes 
     WHERE name LIKE ? OR description LIKE ? 
     LIMIT ?`,
    [searchTerm, searchTerm, searchLimit],
  )

  // Search specialties
  const [specialties] = await pool.query(
    `SELECT id, name, description, 'specialty' as entity_type 
     FROM specialties 
     WHERE name LIKE ? OR description LIKE ? 
     LIMIT ?`,
    [searchTerm, searchTerm, searchLimit],
  )

  // Search events
  const [events] = await pool.query(
    `SELECT id, name, description, location, 'event' as entity_type 
     FROM events 
     WHERE name LIKE ? OR description LIKE ? OR location LIKE ? 
     LIMIT ?`,
    [searchTerm, searchTerm, searchTerm, searchLimit],
  )

  // Search minutes
  const [minutes] = await pool.query(
    `SELECT id, title, content, 'minute' as entity_type 
     FROM minutes 
     WHERE title LIKE ? OR content LIKE ? 
     LIMIT ?`,
    [searchTerm, searchTerm, searchLimit],
  )

  // Search acts
  const [acts] = await pool.query(
    `SELECT id, title, description, 'act' as entity_type 
     FROM acts 
     WHERE title LIKE ? OR description LIKE ? 
     LIMIT ?`,
    [searchTerm, searchTerm, searchLimit],
  )

  // Search assets
  const [assets] = await pool.query(
    `SELECT id, name, description, 'asset' as entity_type 
     FROM assets 
     WHERE name LIKE ? OR description LIKE ? 
     LIMIT ?`,
    [searchTerm, searchTerm, searchLimit],
  )

  // Search documents
  const [documents] = await pool.query(
    `SELECT id, title, description, 'document' as entity_type 
     FROM documents 
     WHERE (title LIKE ? OR description LIKE ?) AND (is_public = TRUE OR uploaded_by = ?) 
     LIMIT ?`,
    [searchTerm, searchTerm, req.user.id, searchLimit],
  )

  // Search users (admin and director only)
  let users = []
  if (req.user.role === "admin" || req.user.role === "director") {
    const [userResults] = await pool.query(
      `SELECT id, name, email, role, 'user' as entity_type 
       FROM users 
       WHERE name LIKE ? OR email LIKE ? 
       LIMIT ?`,
      [searchTerm, searchTerm, searchLimit],
    )
    users = userResults
  }

  // Combine all results
  const results = {
    pathfinders,
    units,
    classes,
    specialties,
    events,
    minutes,
    acts,
    assets,
    documents,
    users,
  }

  // Count total results
  const totalResults = Object.values(results).reduce((total, arr) => total + arr.length, 0)

  res.status(200).json({
    status: "success",
    results: totalResults,
    data: results,
  })
})

export const searchEntity = catchAsync(async (req, res) => {
  const { entity, query, limit, offset } = req.query

  if (!query || !entity) {
    return res.status(400).json({
      status: "fail",
      message: "Entity type and search query are required",
    })
  }

  const searchLimit = limit ? Number.parseInt(limit) : 20
  const searchOffset = offset ? Number.parseInt(offset) : 0
  const searchTerm = `%${query}%`

  let results = []
  let totalCount = 0

  switch (entity) {
    case "pathfinder":
      const [pathfinders, pathfinderCount] = await Promise.all([
        pool.query(
          `SELECT p.*, u.name as unit_name 
           FROM pathfinders p
           LEFT JOIN units u ON p.unit_id = u.id
           WHERE p.name LIKE ? OR p.email LIKE ? OR p.phone LIKE ? 
           LIMIT ? OFFSET ?`,
          [searchTerm, searchTerm, searchTerm, searchLimit, searchOffset],
        ),
        pool.query(
          `SELECT COUNT(*) as count 
           FROM pathfinders 
           WHERE name LIKE ? OR email LIKE ? OR phone LIKE ?`,
          [searchTerm, searchTerm, searchTerm],
        ),
      ])
      results = pathfinders[0]
      totalCount = pathfinderCount[0][0].count
      break

    case "unit":
      const [units, unitCount] = await Promise.all([
        pool.query(
          `SELECT u.*, COUNT(p.id) as pathfinder_count 
           FROM units u
           LEFT JOIN pathfinders p ON u.id = p.unit_id
           WHERE u.name LIKE ? OR u.description LIKE ? 
           GROUP BY u.id
           LIMIT ? OFFSET ?`,
          [searchTerm, searchTerm, searchLimit, searchOffset],
        ),
        pool.query(
          `SELECT COUNT(*) as count 
           FROM units 
           WHERE name LIKE ? OR description LIKE ?`,
          [searchTerm, searchTerm],
        ),
      ])
      results = units[0]
      totalCount = unitCount[0][0].count
      break

    case "class":
      const [classes, classCount] = await Promise.all([
        pool.query(
          `SELECT * FROM classes 
           WHERE name LIKE ? OR description LIKE ? 
           LIMIT ? OFFSET ?`,
          [searchTerm, searchTerm, searchLimit, searchOffset],
        ),
        pool.query(
          `SELECT COUNT(*) as count 
           FROM classes 
           WHERE name LIKE ? OR description LIKE ?`,
          [searchTerm, searchTerm],
        ),
      ])
      results = classes[0]
      totalCount = classCount[0][0].count
      break

    case "specialty":
      const [specialties, specialtyCount] = await Promise.all([
        pool.query(
          `SELECT * FROM specialties 
           WHERE name LIKE ? OR description LIKE ? 
           LIMIT ? OFFSET ?`,
          [searchTerm, searchTerm, searchLimit, searchOffset],
        ),
        pool.query(
          `SELECT COUNT(*) as count 
           FROM specialties 
           WHERE name LIKE ? OR description LIKE ?`,
          [searchTerm, searchTerm],
        ),
      ])
      results = specialties[0]
      totalCount = specialtyCount[0][0].count
      break

    case "event":
      const [events, eventCount] = await Promise.all([
        pool.query(
          `SELECT * FROM events 
           WHERE name LIKE ? OR description LIKE ? OR location LIKE ? 
           LIMIT ? OFFSET ?`,
          [searchTerm, searchTerm, searchTerm, searchLimit, searchOffset],
        ),
        pool.query(
          `SELECT COUNT(*) as count 
           FROM events 
           WHERE name LIKE ? OR description LIKE ? OR location LIKE ?`,
          [searchTerm, searchTerm, searchTerm],
        ),
      ])
      results = events[0]
      totalCount = eventCount[0][0].count
      break

    case "minute":
      const [minutes, minuteCount] = await Promise.all([
        pool.query(
          `SELECT * FROM minutes 
           WHERE title LIKE ? OR content LIKE ? 
           LIMIT ? OFFSET ?`,
          [searchTerm, searchTerm, searchLimit, searchOffset],
        ),
        pool.query(
          `SELECT COUNT(*) as count 
           FROM minutes 
           WHERE title LIKE ? OR content LIKE ?`,
          [searchTerm, searchTerm],
        ),
      ])
      results = minutes[0]
      totalCount = minuteCount[0][0].count
      break

    case "act":
      const [acts, actCount] = await Promise.all([
        pool.query(
          `SELECT * FROM acts 
           WHERE title LIKE ? OR description LIKE ? 
           LIMIT ? OFFSET ?`,
          [searchTerm, searchTerm, searchLimit, searchOffset],
        ),
        pool.query(
          `SELECT COUNT(*) as count 
           FROM acts 
           WHERE title LIKE ? OR description LIKE ?`,
          [searchTerm, searchTerm],
        ),
      ])
      results = acts[0]
      totalCount = actCount[0][0].count
      break

    case "asset":
      const [assets, assetCount] = await Promise.all([
        pool.query(
          `SELECT * FROM assets 
           WHERE name LIKE ? OR description LIKE ? 
           LIMIT ? OFFSET ?`,
          [searchTerm, searchTerm, searchLimit, searchOffset],
        ),
        pool.query(
          `SELECT COUNT(*) as count 
           FROM assets 
           WHERE name LIKE ? OR description LIKE ?`,
          [searchTerm, searchTerm],
        ),
      ])
      results = assets[0]
      totalCount = assetCount[0][0].count
      break

    case "document":
      const [documents, documentCount] = await Promise.all([
        pool.query(
          `SELECT d.*, u.name as uploaded_by_name 
           FROM documents d
           LEFT JOIN users u ON d.uploaded_by = u.id
           WHERE (d.title LIKE ? OR d.description LIKE ?) 
             AND (d.is_public = TRUE OR d.uploaded_by = ? OR ? IN ('admin', 'director'))
           LIMIT ? OFFSET ?`,
          [searchTerm, searchTerm, req.user.id, req.user.role, searchLimit, searchOffset],
        ),
        pool.query(
          `SELECT COUNT(*) as count 
           FROM documents 
           WHERE (title LIKE ? OR description LIKE ?) 
             AND (is_public = TRUE OR uploaded_by = ? OR ? IN ('admin', 'director'))`,
          [searchTerm, searchTerm, req.user.id, req.user.role],
        ),
      ])
      results = documents[0]
      totalCount = documentCount[0][0].count
      break

    case "user":
      // Only admin and director can search users
      if (req.user.role !== "admin" && req.user.role !== "director") {
        return res.status(403).json({
          status: "fail",
          message: "You do not have permission to search users",
        })
      }

      const [users, userCount] = await Promise.all([
        pool.query(
          `SELECT id, name, email, role, created_at 
           FROM users 
           WHERE name LIKE ? OR email LIKE ? 
           LIMIT ? OFFSET ?`,
          [searchTerm, searchTerm, searchLimit, searchOffset],
        ),
        pool.query(
          `SELECT COUNT(*) as count 
           FROM users 
           WHERE name LIKE ? OR email LIKE ?`,
          [searchTerm, searchTerm],
        ),
      ])
      results = users[0]
      totalCount = userCount[0][0].count
      break

    default:
      return res.status(400).json({
        status: "fail",
        message: "Invalid entity type",
      })
  }

  res.status(200).json({
    status: "success",
    results: results.length,
    totalCount,
    data: {
      [entity]: results,
    },
  })
})

