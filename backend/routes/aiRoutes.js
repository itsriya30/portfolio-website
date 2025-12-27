const express = require('express');
const router = express.Router();
const Groq = require('groq-sdk');
const config = require('../config');
const portfolioScraper = require('../utils/portfolioScraper');

const groq = new Groq({
    apiKey: config.GROQ_API_KEY
});

const authMiddleware = require('../middleware/auth');

// Helper function to call Groq API
async function callGroqAPI(prompt, maxTokens = 1000) {
    try {
        const completion = await groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: "You are an expert professional and content writer. Provide clear, concise responses that strictly maintain the user's core intent and specific field of interest."
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
            model: "llama-3.3-70b-versatile",
            temperature: 0.7,
            max_tokens: maxTokens,
        });

        return completion.choices[0]?.message?.content || '';
    } catch (error) {
        console.error('Groq API Error:', error);
        throw error;
    }
}

// USP 1: AI Content Improvement
router.post('/improve-content', authMiddleware, async (req, res) => {
    try {
        const { field, content } = req.body;

        if (!content || content.trim().length === 0) {
            return res.status(400).json({ message: 'Content cannot be empty' });
        }

        let prompt = '';
        if (field === 'bio') {
            prompt = `Improve this portfolio bio. Make it compelling, professional, and engaging. Keep it 2-3 sentences. Focus on impact.
            
⚠️ CRITICAL: NEVER change the user's core field of interest (e.g., if they mention App Development, do NOT change it to Web Development).

Original: "${content}"

Return ONLY the improved bio, nothing else.`;
        } else if (field === 'project') {
            prompt = `Improve this project description. Highlight impact, technical skills, and results. Make it compelling for recruiters.

⚠️ CRITICAL: NEVER change the user's core field of interest (e.g., if they mention App Development, do NOT change it to Web Development).

Original: "${content}"

Return ONLY the improved description, nothing else.`;
        }

        const improvedContent = await callGroqAPI(prompt, 300);

        res.json({ improvedContent: improvedContent.trim() });
    } catch (error) {
        console.error('AI content improvement error:', error);
        res.status(500).json({
            message: 'Failed to improve content',
            error: error.message
        });
    }
});

// USP 2: AI Deployment Guide
router.post('/deployment-guide', authMiddleware, async (req, res) => {
    try {
        const prompt = `Generate a detailed, step-by-step deployment guide for a portfolio website. Include:

1. Deploy to GitHub Pages (detailed steps with commands)
2. Deploy to Netlify (detailed steps)
3. Deploy to Vercel (detailed steps)
4. Custom domain setup
5. Maintenance tips
6. SEO optimization basics

Make it beginner-friendly with clear instructions. Use simple language and include actual commands.`;

        const guide = await callGroqAPI(prompt, 2000);

        res.json({ guide });
    } catch (error) {
        console.error('Deployment guide error:', error);
        res.status(500).json({ message: 'Failed to generate guide' });
    }
});

// USP 3: Analyze Portfolio for Redesign (ENHANCED)
router.post('/analyze-portfolio', authMiddleware, async (req, res) => {
    try {
        const { url } = req.body;

        console.log('🔍 Analyzing portfolio URL:', url);

        // Scrape the portfolio
        let scrapedData;
        try {
            scrapedData = await portfolioScraper.scrapePortfolio(url);

            console.log('✅ Scraping successful!');
            console.log('Extracted data:', {
                name: scrapedData.name,
                title: scrapedData.title,
                skills: scrapedData.skills?.length || 0,
                projects: scrapedData.projects?.length || 0,
                experience: scrapedData.experience?.length || 0,
                education: scrapedData.education?.length || 0
            });

        } catch (scrapeError) {
            console.error('❌ Scraping failed:', scrapeError.message);

            // Return error to user instead of using fallback
            return res.status(400).json({
                message: 'Failed to scrape portfolio',
                error: scrapeError.message,
                suggestion: 'Please ensure the URL is correct and the portfolio is publicly accessible. The URL should not be a 404 page or require authentication.'
            });
        }

        const prompt = `Analyze this portfolio and provide design improvement suggestions:

URL: ${url}
Name: ${scrapedData.name}
Title: ${scrapedData.title}
Skills: ${scrapedData.skills?.join(', ') || 'Various'}
Projects: ${scrapedData.projects?.length || 0}

Provide brief analysis:
1. Current design style
2. Content summary
3. Design improvement suggestions (colors, layout, style)

Keep it concise (3-4 sentences total).`;

        const analysis = await callGroqAPI(prompt, 500);

        res.json({
            currentStyle: scrapedData.designAnalysis?.isDarkMode ? 'Dark mode design' : 'Light mode design',
            contentSummary: `Found: ${scrapedData.projects?.length || 0} projects, ${scrapedData.skills?.length || 0} skills`,
            analysis,
            scrapedData: {
                name: scrapedData.name,
                title: scrapedData.title,
                bio: scrapedData.bio,
                email: scrapedData.email,
                phone: scrapedData.phone || '',
                linkedin: scrapedData.linkedin || '',
                github: scrapedData.github || '',
                skills: scrapedData.skills || [],
                projects: scrapedData.projects || [],
                experience: scrapedData.experience || [],
                education: scrapedData.education || [],
                sections: scrapedData.sections || {},
                designAnalysis: scrapedData.designAnalysis || {}
            }
        });
    } catch (error) {
        console.error('Portfolio analysis error:', error);
        res.status(500).json({
            message: 'Failed to analyze portfolio',
            error: error.message
        });
    }
});

module.exports = router;
