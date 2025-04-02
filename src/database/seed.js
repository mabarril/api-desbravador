import bcrypt from "bcryptjs"
import pool from "../config/database.js"

const seedDatabase = async () => {
  try {
    console.log("Seeding database...")

    // Create admin user
    const hashedPassword = await bcrypt.hash("admin123", 12)
    await pool.query("INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)", [
      "Admin User",
      "admin@example.com",
      hashedPassword,
      "admin",
    ])

    // Create director user
    const directorPassword = await bcrypt.hash("director123", 12)
    await pool.query("INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)", [
      "Director User",
      "director@example.com",
      directorPassword,
      "director",
    ])

    // Create leader user
    const leaderPassword = await bcrypt.hash("leader123", 12)
    const [leaderResult] = await pool.query("INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)", [
      "Leader User",
      "leader@example.com",
      leaderPassword,
      "leader",
    ])
    const leaderId = leaderResult.insertId

    // Create units
    const [unit1Result] = await pool.query("INSERT INTO units (name, description, leader_id) VALUES (?, ?, ?)", [
      "Eagles",
      "The Eagles unit",
      leaderId,
    ])
    const unit1Id = unit1Result.insertId

    await pool.query("INSERT INTO units (name, description) VALUES (?, ?)", ["Lions", "The Lions unit"])

    // Create pathfinders
    const pathfinders = [
      {
        name: "John Doe",
        birthDate: "2010-05-15",
        gender: "male",
        email: "john@example.com",
        phone: "1234567890",
        address: "123 Main St",
        unitId: unit1Id,
      },
      {
        name: "Jane Smith",
        birthDate: "2011-08-22",
        gender: "female",
        email: "jane@example.com",
        phone: "0987654321",
        address: "456 Oak Ave",
        unitId: unit1Id,
      },
      {
        name: "Michael Johnson",
        birthDate: "2009-03-10",
        gender: "male",
        email: "michael@example.com",
        phone: "5551234567",
        address: "789 Pine Rd",
        unitId: null,
      },
    ]

    for (const pathfinder of pathfinders) {
      await pool.query(
        `INSERT INTO pathfinders 
        (name, birth_date, gender, email, phone, address, unit_id) 
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          pathfinder.name,
          pathfinder.birthDate,
          pathfinder.gender,
          pathfinder.email,
          pathfinder.phone,
          pathfinder.address,
          pathfinder.unitId,
        ],
      )
    }

    // Create classes
    const classes = [
      {
        name: "Friend",
        description: "Entry level class for Pathfinders",
        requirements: "Age 10-11",
      },
      {
        name: "Companion",
        description: "Second level class for Pathfinders",
        requirements: "Completed Friend class",
      },
      {
        name: "Explorer",
        description: "Third level class for Pathfinders",
        requirements: "Completed Companion class",
      },
    ]

    for (const classItem of classes) {
      await pool.query("INSERT INTO classes (name, description, requirements) VALUES (?, ?, ?)", [
        classItem.name,
        classItem.description,
        classItem.requirements,
      ])
    }

    // Create specialties
    const specialties = [
      {
        name: "First Aid",
        description: "Learn basic first aid skills",
        requirements: "Complete all required tasks",
      },
      {
        name: "Camping",
        description: "Learn camping skills",
        requirements: "Participate in at least one camping trip",
      },
      {
        name: "Swimming",
        description: "Learn swimming techniques",
        requirements: "Demonstrate swimming abilities",
      },
    ]

    for (const specialty of specialties) {
      await pool.query("INSERT INTO specialties (name, description, requirements) VALUES (?, ?, ?)", [
        specialty.name,
        specialty.description,
        specialty.requirements,
      ])
    }

    // Create events
    const events = [
      {
        name: "Summer Camp",
        description: "Annual summer camping trip",
        startDate: "2023-07-15",
        endDate: "2023-07-22",
        location: "Pine Forest Campground",
        fee: 150.0,
        maxParticipants: 50,
        createdBy: 1,
      },
      {
        name: "Community Service Day",
        description: "Helping at the local food bank",
        startDate: "2023-06-10",
        endDate: "2023-06-10",
        location: "City Food Bank",
        fee: 0.0,
        maxParticipants: 30,
        createdBy: 1,
      },
    ]

    for (const event of events) {
      await pool.query(
        `INSERT INTO events 
        (name, description, start_date, end_date, location, fee, max_participants, created_by) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          event.name,
          event.description,
          event.startDate,
          event.endDate,
          event.location,
          event.fee,
          event.maxParticipants,
          event.createdBy,
        ],
      )
    }

    // Create cash book entries
    const cashBookEntries = [
      {
        transactionDate: "2023-01-15",
        description: "Monthly dues collection",
        amount: 500.0,
        type: "income",
        category: "dues",
        reference: "January 2023",
        createdBy: 1,
      },
      {
        transactionDate: "2023-01-20",
        description: "Purchase of camping supplies",
        amount: 250.0,
        type: "expense",
        category: "equipment",
        reference: "Receipt #12345",
        createdBy: 1,
      },
      {
        transactionDate: "2023-02-15",
        description: "Monthly dues collection",
        amount: 450.0,
        type: "income",
        category: "dues",
        reference: "February 2023",
        createdBy: 1,
      },
    ]

    for (const entry of cashBookEntries) {
      await pool.query(
        `INSERT INTO cash_book 
        (transaction_date, description, amount, type, category, reference, created_by) 
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          entry.transactionDate,
          entry.description,
          entry.amount,
          entry.type,
          entry.category,
          entry.reference,
          entry.createdBy,
        ],
      )
    }

    console.log("Database seeded successfully")
  } catch (error) {
    console.error("Error seeding database:", error)
    process.exit(1)
  } finally {
    pool.end()
  }
}

seedDatabase()

