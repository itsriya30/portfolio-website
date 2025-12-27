const mongoose = require('mongoose');
const config = require('./config');

const connectDB = async () => {
    try {
        const uri = config.MONGODB_URI;
        console.log(`Attempting to connect to: ${uri.split('@')[1] || 'localhost'}`);
        const conn = await mongoose.connect(uri);
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
};

module.exports = connectDB;
