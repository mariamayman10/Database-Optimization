import pkg from "pg";
import dotenv from "dotenv";
dotenv.config();
const { Pool } = pkg;


console.log("Database URL:", process.env.DATABASE_URL);
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
});
