const mongoose = require('mongoose');

/**
 * Connect to MongoDB database
 */
const connectDB = async () => {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }
  if (mongoose.connection.readyState === 2) {
    await mongoose.connection.asPromise();
    return mongoose.connection;
  }

  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;

  if (!mongoUri) {
    const errorMsg = 'MONGODB_URI is not defined in environment variables. A valid MongoDB Atlas connection string is required.';
    console.error(`[MongoDB] Configuration error: ${errorMsg}`);
    throw new Error(errorMsg);
  }

  try {
    const conn = await mongoose.connect(mongoUri);
    console.log(`[MongoDB] Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`[MongoDB] Connection error: ${error.message}`);
    throw error;
  }
};

module.exports = connectDB;
