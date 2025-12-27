const mongoose = require('mongoose');

const portfolioSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    personalInfo: {
        name: String,
        email: String,
        role: String,
        bio: String,
        location: String,
        socialLinks: {
            github: String,
            linkedin: String,
            twitter: String
        }
    },
    skills: [String],
    education: [
        {
            institution: String,
            degree: String,
            year: String
        }
    ],
    experience: [
        {
            company: String,
            role: String,
            duration: String,
            description: String
        }
    ],
    projects: [
        {
            title: String,
            description: String,
            techStack: [String],
            link: String
        }
    ],
    designVision: {
        vision: String,
        colorScheme: String,
        layoutType: String
    },
    generatedHTML: {
        type: String,
        required: true
    },
    shareableLink: {
        type: String
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Portfolio', portfolioSchema);
