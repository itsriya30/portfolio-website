module.exports = {
    PORT: process.env.PORT || 5000,
    MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/portfolio-builder',
    JWT_SECRET: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this',
    GROQ_API_KEY: process.env.GROQ_API_KEY || 'your-groq-api-key-here'
};
