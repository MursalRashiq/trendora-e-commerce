const dotenv = require("dotenv").config();
const mongoose = require("mongoose");

// MongoDB connection function
const connectDB = async () => {
  try {
    const mongodb = process.env.MONGODB_URI;
    await mongoose.connect(mongodb);
    console.log("MongoDB Connected...");
  } catch (error) {
    console.error("DB Connection error:", error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
