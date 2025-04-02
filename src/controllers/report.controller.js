import pool from "../config/database.js"
import catchAsync from "../utils/catchAsync.js"

// Pathfinder attendance report
export const getAttendanceReport = catchAsync(async (req, res) => {
  const { startDate, endDate, unitId } = req.query

  // Validate date range
  if (!startDate || !endDate) {
    return res.status(400).json({
      status: "fail",
      message: "Start date and end date are required",
    })
  }

  // Build query conditions
  let unitCondition = ""
  const queryParams = [startDate, endDate]

  if (unitId) {
    unitCondition = "AND p.unit_id = ?"
    queryParams.push(unitId)
  }

  // Get events in the date range
  const [events] = await pool.query(
    `SELECT id, name, start_date, end_date 
     FROM events 
     WHERE start_date BETWEEN ? AND ? 
     ORDER BY start_date`,
    [startDate, endDate],
  )

  // Get pathfinders (optionally filtered by unit)
  const [pathfinders] = await pool.query(
    `SELECT p.id, p.name, u.name as unit_name 
     FROM pathfinders p
     LEFT JOIN units u ON p.unit_id = u.id
     ${unitId ? "WHERE p.unit_id = ?" : ""}
     ORDER BY u.name, p.name`,
    unitId ? [unitId] : [],
  )

  // Get attendance data
  const attendanceData = []

  for (const pathfinder of pathfinders) {
    const pathfinderAttendance = {
      pathfinderId: pathfinder.id,
      pathfinderName: pathfinder.name,
      unitName: pathfinder.unit_name || "No Unit",
      events: [],
    }

    for (const event of events) {
      const [attendance] = await pool.query(
        `SELECT attendance_status 
         FROM event_participants 
         WHERE pathfinder_id = ? AND event_id = ?`,
        [pathfinder.id, event.id],
      )

      pathfinderAttendance.events.push({
        eventId: event.id,
        eventName: event.name,
        eventDate: event.start_date,
        status: attendance.length > 0 ? attendance[0].attendance_status : "not_registered",
      })
    }

    // Calculate attendance rate
    const totalEvents = events.length
    const attendedEvents = pathfinderAttendance.events.filter((e) => e.status === "attended").length
    pathfinderAttendance.attendanceRate = totalEvents > 0 ? ((attendedEvents / totalEvents) * 100).toFixed(2) : 0

    attendanceData.push(pathfinderAttendance)
  }

  // Calculate overall statistics
  const totalPathfinders = pathfinders.length
  const totalEvents = events.length
  let totalAttendances = 0
  const possibleAttendances = totalPathfinders * totalEvents

  attendanceData.forEach((pathfinder) => {
    pathfinder.events.forEach((event) => {
      if (event.status === "attended") {
        totalAttendances++
      }
    })
  })

  const overallAttendanceRate =
    possibleAttendances > 0 ? ((totalAttendances / possibleAttendances) * 100).toFixed(2) : 0

  res.status(200).json({
    status: "success",
    data: {
      dateRange: {
        startDate,
        endDate,
      },
      events,
      statistics: {
        totalPathfinders,
        totalEvents,
        totalAttendances,
        possibleAttendances,
        overallAttendanceRate,
      },
      attendanceData,
    },
  })
})

// Class progress report
export const getClassProgressReport = catchAsync(async (req, res) => {
  const { unitId, classId } = req.query

  // Build query conditions
  const conditions = []
  const queryParams = []

  if (unitId) {
    conditions.push("p.unit_id = ?")
    queryParams.push(unitId)
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""

  // Get all classes
  const [classes] = await pool.query("SELECT id, name FROM classes ORDER BY name")

  // Filter to specific class if requested
  const filteredClasses = classId ? classes.filter((c) => c.id === Number.parseInt(classId)) : classes

  // Get pathfinders (optionally filtered by unit)
  const [pathfinders] = await pool.query(
    `SELECT p.id, p.name, u.name as unit_name 
     FROM pathfinders p
     LEFT JOIN units u ON p.unit_id = u.id
     ${whereClause}
     ORDER BY u.name, p.name`,
    queryParams,
  )

  // Get progress data
  const progressData = []

  for (const pathfinder of pathfinders) {
    const pathfinderProgress = {
      pathfinderId: pathfinder.id,
      pathfinderName: pathfinder.name,
      unitName: pathfinder.unit_name || "No Unit",
      classes: [],
    }

    for (const classItem of filteredClasses) {
      const [progress] = await pool.query(
        `SELECT status, completion_date 
         FROM pathfinder_classes 
         WHERE pathfinder_id = ? AND class_id = ?`,
        [pathfinder.id, classItem.id],
      )

      pathfinderProgress.classes.push({
        classId: classItem.id,
        className: classItem.name,
        status: progress.length > 0 ? progress[0].status : "not_started",
        completionDate: progress.length > 0 ? progress[0].completion_date : null,
      })
    }

    // Calculate completion rate
    const totalClasses = filteredClasses.length
    const completedClasses = pathfinderProgress.classes.filter((c) => c.status === "completed").length
    const inProgressClasses = pathfinderProgress.classes.filter((c) => c.status === "in_progress").length

    pathfinderProgress.completionRate = totalClasses > 0 ? ((completedClasses / totalClasses) * 100).toFixed(2) : 0
    pathfinderProgress.completedClasses = completedClasses
    pathfinderProgress.inProgressClasses = inProgressClasses
    pathfinderProgress.notStartedClasses = totalClasses - completedClasses - inProgressClasses

    progressData.push(pathfinderProgress)
  }

  // Calculate overall statistics
  const totalPathfinders = pathfinders.length
  const totalClasses = filteredClasses.length
  let totalCompletions = 0
  let totalInProgress = 0
  const possibleCompletions = totalPathfinders * totalClasses

  progressData.forEach((pathfinder) => {
    totalCompletions += pathfinder.completedClasses
    totalInProgress += pathfinder.inProgressClasses
  })

  const overallCompletionRate =
    possibleCompletions > 0 ? ((totalCompletions / possibleCompletions) * 100).toFixed(2) : 0

  res.status(200).json({
    status: "success",
    data: {
      classes: filteredClasses,
      statistics: {
        totalPathfinders,
        totalClasses,
        totalCompletions,
        totalInProgress,
        possibleCompletions,
        overallCompletionRate,
      },
      progressData,
    },
  })
})

// Financial report
export const getFinancialReport = catchAsync(async (req, res) => {
  const { startDate, endDate, groupBy } = req.query

  // Validate date range
  if (!startDate || !endDate) {
    return res.status(400).json({
      status: "fail",
      message: "Start date and end date are required",
    })
  }

  // Get income data
  const [income] = await pool.query(
    `SELECT 
      transaction_date, 
      category, 
      SUM(amount) as total 
     FROM cash_book 
     WHERE type = 'income' AND transaction_date BETWEEN ? AND ? 
     GROUP BY ${groupBy === "category" ? "category" : 'DATE_FORMAT(transaction_date, "%Y-%m")'}
     ORDER BY ${groupBy === "category" ? "total DESC" : "transaction_date"}`,
    [startDate, endDate],
  )

  // Get expense data
  const [expenses] = await pool.query(
    `SELECT 
      transaction_date, 
      category, 
      SUM(amount) as total 
     FROM cash_book 
     WHERE type = 'expense' AND transaction_date BETWEEN ? AND ? 
     GROUP BY ${groupBy === "category" ? "category" : 'DATE_FORMAT(transaction_date, "%Y-%m")'}
     ORDER BY ${groupBy === "category" ? "total DESC" : "transaction_date"}`,
    [startDate, endDate],
  )

  // Get summary data
  const [summary] = await pool.query(
    `SELECT 
      SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as totalIncome,
      SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as totalExpense
     FROM cash_book 
     WHERE transaction_date BETWEEN ? AND ?`,
    [startDate, endDate],
  )

  // Calculate balance
  const balance = (summary[0].totalIncome || 0) - (summary[0].totalExpense || 0)

  // Get monthly data for chart
  const [monthlyData] = await pool.query(
    `SELECT 
      DATE_FORMAT(transaction_date, '%Y-%m') as month,
      SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
      SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expense,
      SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END) as balance
     FROM cash_book 
     WHERE transaction_date BETWEEN ? AND ?
     GROUP BY DATE_FORMAT(transaction_date, '%Y-%m')
     ORDER BY month`,
    [startDate, endDate],
  )

  res.status(200).json({
    status: "success",
    data: {
      dateRange: {
        startDate,
        endDate,
      },
      summary: {
        totalIncome: summary[0].totalIncome || 0,
        totalExpense: summary[0].totalExpense || 0,
        balance,
      },
      income,
      expenses,
      monthlyData,
    },
  })
})

// Pathfinder activity report
export const getPathfinderActivityReport = catchAsync(async (req, res) => {
  const { pathfinderId } = req.params

  // Get pathfinder details
  const [pathfinder] = await pool.query(
    `SELECT p.*, u.name as unit_name 
     FROM pathfinders p
     LEFT JOIN units u ON p.unit_id = u.id
     WHERE p.id = ?`,
    [pathfinderId],
  )

  if (pathfinder.length === 0) {
    return res.status(404).json({
      status: "fail",
      message: "No pathfinder found with that ID",
    })
  }

  // Get classes
  const [classes] = await pool.query(
    `SELECT c.*, pc.status, pc.completion_date 
     FROM classes c
     LEFT JOIN pathfinder_classes pc ON c.id = pc.class_id AND pc.pathfinder_id = ?
     ORDER BY c.name`,
    [pathfinderId],
  )

  // Get specialties
  const [specialties] = await pool.query(
    `SELECT s.*, ps.status, ps.completion_date 
     FROM specialties s
     LEFT JOIN pathfinder_specialties ps ON s.id = ps.specialty_id AND ps.pathfinder_id = ?
     ORDER BY s.name`,
    [pathfinderId],
  )

  // Get events
  const [events] = await pool.query(
    `SELECT e.*, ep.registration_date, ep.payment_status, ep.attendance_status 
     FROM events e
     LEFT JOIN event_participants ep ON e.id = ep.event_id AND ep.pathfinder_id = ?
     ORDER BY e.start_date DESC`,
    [pathfinderId],
  )

  // Get monthly fees
  const [monthlyFees] = await pool.query(
    `SELECT * FROM monthly_fees 
     WHERE pathfinder_id = ?
     ORDER BY year DESC, month DESC`,
    [pathfinderId],
  )

  // Get payments
  const [payments] = await pool.query(
    `SELECT * FROM payments 
     WHERE pathfinder_id = ?
     ORDER BY payment_date DESC`,
    [pathfinderId],
  )

  // Calculate statistics
  const completedClasses = classes.filter((c) => c.status === "completed").length
  const completedSpecialties = specialties.filter((s) => s.status === "completed").length
  const attendedEvents = events.filter((e) => e.attendance_status === "attended").length
  const paidFees = monthlyFees.filter((f) => f.status === "paid").length
  const totalFees = monthlyFees.length
  const feePaymentRate = totalFees > 0 ? ((paidFees / totalFees) * 100).toFixed(2) : 0

  res.status(200).json({
    status: "success",
    data: {
      pathfinder: pathfinder[0],
      statistics: {
        completedClasses,
        totalClasses: classes.length,
        completedSpecialties,
        totalSpecialties: specialties.length,
        attendedEvents,
        totalEvents: events.length,
        paidFees,
        totalFees,
        feePaymentRate,
      },
      classes,
      specialties,
      events,
      monthlyFees,
      payments,
    },
  })
})

