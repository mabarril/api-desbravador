import pool from "../config/database.js"
import catchAsync from "../utils/catchAsync.js"

export const getDashboardStats = catchAsync(async (req, res) => {
  // Get counts for various entities
  const [pathfinderCount] = await pool.query("SELECT COUNT(*) as count FROM pathfinders")
  const [unitCount] = await pool.query("SELECT COUNT(*) as count FROM units")
  const [eventCount] = await pool.query("SELECT COUNT(*) as count FROM events")
  const [userCount] = await pool.query("SELECT COUNT(*) as count FROM users")

  // Get upcoming events
  const today = new Date().toISOString().split("T")[0]
  const [upcomingEvents] = await pool.query(
    `SELECT id, name, start_date, end_date, location 
     FROM events 
     WHERE start_date >= ? 
     ORDER BY start_date 
     LIMIT 5`,
    [today],
  )

  // Get recent payments
  const [recentPayments] = await pool.query(
    `SELECT p.id, p.amount, p.payment_date, p.payment_method, pf.name as pathfinder_name 
     FROM payments p
     LEFT JOIN pathfinders pf ON p.pathfinder_id = pf.id
     ORDER BY p.payment_date DESC
     LIMIT 5`,
  )

  // Get financial summary for current month
  const currentMonth = new Date().getMonth() + 1
  const currentYear = new Date().getFullYear()
  const firstDayOfMonth = `${currentYear}-${currentMonth.toString().padStart(2, "0")}-01`
  const lastDayOfMonth = new Date(currentYear, currentMonth, 0).toISOString().split("T")[0]

  const [monthlyIncome] = await pool.query(
    `SELECT SUM(amount) as total 
     FROM cash_book 
     WHERE type = 'income' AND transaction_date BETWEEN ? AND ?`,
    [firstDayOfMonth, lastDayOfMonth],
  )

  const [monthlyExpense] = await pool.query(
    `SELECT SUM(amount) as total 
     FROM cash_book 
     WHERE type = 'expense' AND transaction_date BETWEEN ? AND ?`,
    [firstDayOfMonth, lastDayOfMonth],
  )

  // Get pathfinders by unit
  const [pathfindersByUnit] = await pool.query(
    `SELECT u.name as unit_name, COUNT(p.id) as pathfinder_count 
     FROM units u
     LEFT JOIN pathfinders p ON u.id = p.unit_id
     GROUP BY u.id
     ORDER BY pathfinder_count DESC`,
  )

  // Get pathfinders without a unit
  const [pathfindersWithoutUnit] = await pool.query(
    `SELECT COUNT(*) as count 
     FROM pathfinders 
     WHERE unit_id IS NULL`,
  )

  // Get class completion statistics
  const [classStats] = await pool.query(
    `SELECT c.name as class_name, 
            COUNT(pc.pathfinder_id) as total_assigned,
            SUM(CASE WHEN pc.status = 'completed' THEN 1 ELSE 0 END) as completed,
            SUM(CASE WHEN pc.status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
            SUM(CASE WHEN pc.status = 'not_started' THEN 1 ELSE 0 END) as not_started
     FROM classes c
     LEFT JOIN pathfinder_classes pc ON c.id = pc.class_id
     GROUP BY c.id
     ORDER BY total_assigned DESC`,
  )

  // Get monthly fee collection rate for current year
  const [monthlyFeeStats] = await pool.query(
    `SELECT month, 
            COUNT(*) as total,
            SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid,
            SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
            SUM(CASE WHEN status = 'waived' THEN 1 ELSE 0 END) as waived
     FROM monthly_fees
     WHERE year = ?
     GROUP BY month
     ORDER BY month`,
    [currentYear],
  )

  // Calculate collection rates
  const monthlyFeeCollection = monthlyFeeStats.map((month) => ({
    ...month,
    collectionRate: month.total > 0 ? ((month.paid / month.total) * 100).toFixed(2) : 0,
  }))

  // Get recent activities from audit log
  const [recentActivities] = await pool.query(
    `SELECT al.action, al.entity_type, al.created_at, u.name as user_name, u.role as user_role
     FROM audit_logs al
     LEFT JOIN users u ON al.user_id = u.id
     ORDER BY al.created_at DESC
     LIMIT 10`,
  )

  res.status(200).json({
    status: "success",
    data: {
      counts: {
        pathfinders: pathfinderCount[0].count,
        units: unitCount[0].count,
        events: eventCount[0].count,
        users: userCount[0].count,
      },
      upcomingEvents,
      recentPayments,
      financialSummary: {
        currentMonth: `${currentYear}-${currentMonth}`,
        income: monthlyIncome[0].total || 0,
        expense: monthlyExpense[0].total || 0,
        balance: (monthlyIncome[0].total || 0) - (monthlyExpense[0].total || 0),
      },
      pathfinderDistribution: {
        byUnit: pathfindersByUnit,
        withoutUnit: pathfindersWithoutUnit[0].count,
      },
      classStats,
      monthlyFeeCollection,
      recentActivities,
    },
  })
})

export const getDirectorDashboard = catchAsync(async (req, res) => {
  // Get counts for various entities
  const [pathfinderCount] = await pool.query("SELECT COUNT(*) as count FROM pathfinders")
  const [unitCount] = await pool.query("SELECT COUNT(*) as count FROM units")
  const [eventCount] = await pool.query("SELECT COUNT(*) as count FROM events")

  // Get upcoming events
  const today = new Date().toISOString().split("T")[0]
  const [upcomingEvents] = await pool.query(
    `SELECT id, name, start_date, end_date, location 
     FROM events 
     WHERE start_date >= ? 
     ORDER BY start_date 
     LIMIT 5`,
    [today],
  )

  // Get recent payments
  const [recentPayments] = await pool.query(
    `SELECT p.id, p.amount, p.payment_date, p.payment_method, pf.name as pathfinder_name 
     FROM payments p
     LEFT JOIN pathfinders pf ON p.pathfinder_id = pf.id
     ORDER BY p.payment_date DESC
     LIMIT 5`,
  )

  // Get financial summary for current month
  const currentMonth = new Date().getMonth() + 1
  const currentYear = new Date().getFullYear()
  const firstDayOfMonth = `${currentYear}-${currentMonth.toString().padStart(2, "0")}-01`
  const lastDayOfMonth = new Date(currentYear, currentMonth, 0).toISOString().split("T")[0]

  const [monthlyIncome] = await pool.query(
    `SELECT SUM(amount) as total 
     FROM cash_book 
     WHERE type = 'income' AND transaction_date BETWEEN ? AND ?`,
    [firstDayOfMonth, lastDayOfMonth],
  )

  const [monthlyExpense] = await pool.query(
    `SELECT SUM(amount) as total 
     FROM cash_book 
     WHERE type = 'expense' AND transaction_date BETWEEN ? AND ?`,
    [firstDayOfMonth, lastDayOfMonth],
  )

  // Get pending registrations
  const [pendingRegistrations] = await pool.query(
    `SELECT r.id, r.registration_date, p.name as pathfinder_name
     FROM registrations r
     JOIN pathfinders p ON r.pathfinder_id = p.id
     WHERE r.status = 'pending'
     ORDER BY r.registration_date DESC`,
  )

  // Get pending departure authorizations
  const [pendingAuthorizations] = await pool.query(
    `SELECT da.id, da.departure_date, da.return_date, da.destination, p.name as pathfinder_name
     FROM departure_authorizations da
     JOIN pathfinders p ON da.pathfinder_id = p.id
     WHERE da.authorized_by IS NULL
     ORDER BY da.departure_date`,
  )

  // Get monthly fee collection rate for current month
  const [monthlyFeeStats] = await pool.query(
    `SELECT 
       COUNT(*) as total,
       SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid,
       SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
       SUM(CASE WHEN status = 'waived' THEN 1 ELSE 0 END) as waived
     FROM monthly_fees
     WHERE year = ? AND month = ?`,
    [currentYear, currentMonth],
  )

  // Calculate collection rate
  const collectionRate =
    monthlyFeeStats[0].total > 0 ? ((monthlyFeeStats[0].paid / monthlyFeeStats[0].total) * 100).toFixed(2) : 0

  res.status(200).json({
    status: "success",
    data: {
      counts: {
        pathfinders: pathfinderCount[0].count,
        units: unitCount[0].count,
        events: eventCount[0].count,
      },
      upcomingEvents,
      recentPayments,
      financialSummary: {
        currentMonth: `${currentYear}-${currentMonth}`,
        income: monthlyIncome[0].total || 0,
        expense: monthlyExpense[0].total || 0,
        balance: (monthlyIncome[0].total || 0) - (monthlyExpense[0].total || 0),
      },
      pendingItems: {
        registrations: pendingRegistrations,
        authorizations: pendingAuthorizations,
      },
      monthlyFeeCollection: {
        month: currentMonth,
        year: currentYear,
        total: monthlyFeeStats[0].total,
        paid: monthlyFeeStats[0].paid,
        pending: monthlyFeeStats[0].pending,
        waived: monthlyFeeStats[0].waived,
        collectionRate,
      },
    },
  })
})

export const getLeaderDashboard = catchAsync(async (req, res) => {
  // Get units led by this leader
  const [units] = await pool.query("SELECT id, name FROM units WHERE leader_id = ?", [req.user.id])

  const unitIds = units.map((unit) => unit.id)

  // If leader doesn't lead any units, return empty data
  if (unitIds.length === 0) {
    return res.status(200).json({
      status: "success",
      data: {
        units: [],
        pathfinderCount: 0,
        upcomingEvents: [],
        pathfinders: [],
        classProgress: [],
      },
    })
  }

  // Get pathfinder count for these units
  const [pathfinderCount] = await pool.query("SELECT COUNT(*) as count FROM pathfinders WHERE unit_id IN (?)", [
    unitIds,
  ])

  // Get upcoming events
  const today = new Date().toISOString().split("T")[0]
  const [upcomingEvents] = await pool.query(
    `SELECT id, name, start_date, end_date, location 
     FROM events 
     WHERE start_date >= ? 
     ORDER BY start_date 
     LIMIT 5`,
    [today],
  )

  // Get pathfinders in these units
  const [pathfinders] = await pool.query(
    `SELECT p.id, p.name, p.birth_date, p.gender, p.email, p.phone, u.name as unit_name
     FROM pathfinders p
     JOIN units u ON p.unit_id = u.id
     WHERE p.unit_id IN (?)
     ORDER BY u.name, p.name`,
    [unitIds],
  )

  // Get class progress for pathfinders in these units
  const pathfinderIds = pathfinders.map((p) => p.id)

  let classProgress = []
  if (pathfinderIds.length > 0) {
    const [progress] = await pool.query(
      `SELECT 
         p.id as pathfinder_id, 
         p.name as pathfinder_name,
         c.id as class_id,
         c.name as class_name,
         pc.status,
         pc.completion_date
       FROM pathfinders p
       JOIN pathfinder_classes pc ON p.id = pc.pathfinder_id
       JOIN classes c ON pc.class_id = c.id
       WHERE p.id IN (?)
       ORDER BY p.name, c.name`,
      [pathfinderIds],
    )

    classProgress = progress
  }

  // Get attendance for recent events
  const [recentEvents] = await pool.query(
    `SELECT id, name, start_date FROM events 
     WHERE start_date <= ? 
     ORDER BY start_date DESC 
     LIMIT 3`,
    [today],
  )

  let attendance = []
  if (recentEvents.length > 0 && pathfinderIds.length > 0) {
    const eventIds = recentEvents.map((e) => e.id)

    const [attendanceData] = await pool.query(
      `SELECT 
         ep.pathfinder_id,
         ep.event_id,
         e.name as event_name,
         e.start_date as event_date,
         ep.attendance_status
       FROM event_participants ep
       JOIN events e ON ep.event_id = e.id
       WHERE ep.pathfinder_id IN (?) AND ep.event_id IN (?)`,
      [pathfinderIds, eventIds],
    )

    attendance = attendanceData
  }

  res.status(200).json({
    status: "success",
    data: {
      units,
      pathfinderCount: pathfinderCount[0].count,
      upcomingEvents,
      pathfinders,
      classProgress,
      recentEvents,
      attendance,
    },
  })
})

