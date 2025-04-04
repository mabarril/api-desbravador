import mysql from "mysql2/promise"
import dotenv from "dotenv"

dotenv.config()

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
})

export const connectToDatabase = async () => {
  try {
    const connection = await pool.getConnection()
    console.log("Connected to MySQL database")
    connection.release()
  } catch (error) {
    console.error("Database connection failed:", error.message)
    process.exit(1)
  }
}

export default pool

