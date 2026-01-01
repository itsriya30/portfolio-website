const express = require('express');
const router = express.Router();
const Portfolio = require('../models/Portfolio');
const Groq = require('groq-sdk');
const config = require('../config');
const pdfGenerator = require('../utils/pdfGenerator');
const deploymentManager = require('../utils/deploymentManager');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure Multer
const upload = multer({ storage: multer.memoryStorage() });

const groq = new Groq({
    apiKey: config.GROQ_API_KEY
});

const authMiddleware = require('../middleware/auth');

// PUBLIC VIEW ROUTE - Host the portfolio instantly
// This is the "Option 2" solution for Hackathons
router.get('/view/:id', async (req, res) => {
    try {
        const portfolio = await Portfolio.findById(req.params.id);
        if (!portfolio || !portfolio.generatedHTML) {
            return res.status(404).send('<h1>Portfolio not found</h1>');
        }
        res.setHeader('Content-Type', 'text/html');
        res.send(portfolio.generatedHTML);
    } catch (error) {
        console.error('Error viewing portfolio:', error);
        res.status(500).send('<h1>Error loading portfolio</h1>');
    }
});

// UPLOAD ROUTE
router.post('/upload', authMiddleware, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

        // Upload to Cloudinary
        const result = await new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                { folder: 'portfolio_assets' },
                (error, result) => {
                    if (error) reject(error);
                    else resolve(result);
                }
            );
            uploadStream.end(req.file.buffer);
        });

        res.json({ url: result.secure_url });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ message: 'Upload failed', error: error.message });
    }
});

// Helper function to call Groq API
async function callGroqAPI(prompt, maxTokens = 8000) {
    try {
        const completion = await groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: "You are an expert web developer. Generate complete, functional HTML/CSS/JS code that displays ALL user data. NEVER omit or truncate any data provided."
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

// CREATE PORTFOLIO - With New Form Structure & Template Selection
router.post('/create', authMiddleware, async (req, res) => {
    try {
        console.log('📥 Received portfolio creation request');
        console.log('Request body keys:', Object.keys(req.body));
        console.log('Basic Details:', req.body.basicDetails);
        console.log('About Me length:', req.body.aboutMe?.length);
        console.log('Projects count:', req.body.projects?.length);
        console.log('Template:', req.body.template);

        const { basicDetails, aboutMe, skills, projects, achievements, experience, socialLinks, template } = req.body;
        const userId = req.user ? req.user._id : null;

        console.log('🔑 Authenticated User ID:', userId);

        if (!userId) {
            console.log('❌ Authentication failed - User ID missing');
            return res.status(401).json({ message: 'User not authenticated' });
        }

        // Validate required fields
        if (!basicDetails?.fullName || !basicDetails?.professionalTitle || !aboutMe || !template) {
            console.log('❌ Validation failed - missing required fields');
            return res.status(400).json({
                message: 'Missing required fields: Full Name, Professional Title, About Me, or Template'
            });
        }

        if (!projects || projects.length === 0) {
            console.log('❌ Validation failed - no projects');
            return res.status(400).json({
                message: 'Please add at least one project'
            });
        }

        console.log('✅ Validation passed, proceeding with portfolio generation...');

        // Combine all skills into arrays
        const allSkills = {
            technical: skills?.technical || [],
            tools: skills?.tools || [],
            softSkills: skills?.softSkills || []
        };

        // Generate template-based prompt
        const templateDescriptions = {
            'MINIMAL_WHITE': 'Clean minimalist design with maximum white space, black and white color scheme, simple elegant typography',
            'MODERN_DARK': 'Sleek dark theme (#1a1a1a background) with vibrant blue (#3b82f6) and cyan (#06b6d4) accents, modern tech-focused design',
            'CREATIVE_GRADIENT': 'Bold gradient backgrounds from pink to purple to indigo, vibrant and eye-catching, perfect for creative professionals',
            'CORPORATE_BLUE': 'Professional business theme with navy blue (#1e40af) and white, corporate and trustworthy design',
            'TECH_GREEN': 'Fresh green theme (#10b981) with modern touches, great for startups and tech roles',
            'ELEGANT_PURPLE': 'Sophisticated purple (#9333ea) theme with elegant design elements, creative professional look',
            'SUNSET_ORANGE': 'Warm orange (#f97316) and red gradients, energetic and vibrant design',
            'OCEAN_TEAL': 'Calm teal (#14b8a6) and cyan colors, professional data science aesthetic',
            'MONOCHROME': 'Timeless black, white and gray design, ultra-professional and minimal',
            'NEON_CYBERPUNK': 'Dark background with glowing neon cyan, pink and purple effects, futuristic design with shadows',
            'PASTEL_DREAM': 'Soft pastel pink, blue and purple colors, gentle and creative design',
            'AUTO': 'Modern professional design that matches the user\'s field and content'
        };

        const selectedTemplate = templateDescriptions[template] || templateDescriptions['AUTO'];

        const prompt = `Create a complete professional portfolio website using this EXACT template style.

TEMPLATE STYLE (FOLLOW EXACTLY):
${selectedTemplate}

PERSONAL INFORMATION:
Full Name: ${basicDetails.fullName}
Professional Title: ${basicDetails.professionalTitle}
Email: ${basicDetails.email}
Profile Photo URL: ${basicDetails.profilePhoto || 'Not provided'}

ABOUT ME:
${aboutMe}

TECHNICAL SKILLS (${allSkills.technical.length}):
${allSkills.technical.join(', ')}

TOOLS (${allSkills.tools.length}):
${allSkills.tools.join(', ')}

SOFT SKILLS (${allSkills.softSkills.length}):
${allSkills.softSkills.join(', ')}

PROJECTS (${projects.length}):
${projects.map((p, i) => `
${i + 1}. ${p.title}
   Description: ${p.description}
   Technologies: ${p.technologies}
   ${p.liveLink ? 'Live Demo: ' + p.liveLink : ''}
   ${p.githubLink ? 'GitHub: ' + p.githubLink : ''}
   ${p.screenshot ? 'Project Image URL: ' + p.screenshot : ''}
`).join('\n')}

EXPERIENCE (${experience?.length || 0}):
${experience?.map(e => `${e.role} at ${e.company} (${e.duration})\n${e.description}`).join('\n\n') || 'No experience added'}

ACHIEVEMENTS (${achievements?.length || 0}):
${achievements?.map(a => `${a.description}\n${a.certificate ? 'Proof URL: ' + a.certificate : ''}`).join('\n') || 'No achievements added'}

SOCIAL LINKS (Use icons only, do not display URL text):
LinkedIn: ${socialLinks?.linkedin || 'Not provided'}
Twitter: ${socialLinks?.twitter || 'Not provided'}
GitHub: ${socialLinks?.github || 'Not provided'}
Instagram: ${socialLinks?.instagram || 'Not provided'}

CRITICAL REQUIREMENTS:
1. Generate ONE complete HTML file with embedded CSS and JavaScript
2. Follow the template style EXACTLY (colors, layout, fonts)
3. Include ALL sections: Hero/Home, About, Skills (Technical, Tools, Soft Skills separately), Projects, Experience, Achievements, Contact
4. Make fully responsive (mobile, tablet, desktop)
5. DO NOT include a navigation header/navbar - sections should flow naturally without a sticky/fixed navigation menu
6. Include Font Awesome CDN for icons: https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css
7. Use Google Fonts CDN for typography
8. PROJECTS LAYOUT: Display ALL ${projects.length} projects in a HORIZONTAL GRID (3 columns on desktop, responsive on mobile)
9. Show skills in separate categories (Technical, Tools, Soft Skills)
10. All external links must open in new tabs (target="_blank" rel="noopener noreferrer")
11. Professional, modern, and recruiter-ready
12. NO placeholder content - use actual data provided
13. ACHIEVEMENTS LAYOUT (CRITICAL): Display achievements in a HORIZONTAL GRID with this EXACT structure for each card:
    - Certificate Image at the top (if provided)
    - Achievement description/title
    - "View Certificate" button at bottom (if Proof URL provided) with target="_blank"
    Example structure:
    <div class="achievement-card">
      <img src="[certificate URL]" alt="Achievement">
      <p>[description]</p>
      <a href="[Proof URL]" target="_blank" rel="noopener noreferrer">View Certificate</a>
    </div>
14. FOR SOCIAL LINKS in Contact/Home sections: Use a horizontal row of Font Awesome icons (e.g., <i class="fab fa-linkedin"></i>). Do NOT display the full URL text.

IMPORTANT: Return ONLY the HTML code, no explanations, no markdown formatting.`;

        console.log('🤖 Calling Groq API for portfolio generation...');
        let generatedHTML = await callGroqAPI(prompt, 8000);

        // Safety check for generatedHTML
        if (typeof generatedHTML !== 'string') {
            console.warn('⚠️ generatedHTML is not a string, forcing to empty string');
            generatedHTML = '';
        }

        // Clean up markdown formatting
        generatedHTML = generatedHTML.replace(/```html\n?/g, '').replace(/```\n?/g, '').trim();

        // If AI fails, use guaranteed fallback
        if (!generatedHTML || (!generatedHTML.includes('<!DOCTYPE') && !generatedHTML.includes('<html'))) {
            console.log('⚠️ AI generation failed, using template-based fallback');
            generatedHTML = generateTemplatePortfolio(basicDetails, aboutMe, allSkills, projects, experience, [], achievements, socialLinks, template, template);
        } else {
            console.log('✅ AI generation successful');
        }

        // Ensure external links open in new tabs
        generatedHTML = ensureExternalLinksOpenNewTab(generatedHTML);

        console.log('📝 HTML length:', generatedHTML.length);
        console.log('💾 Saving portfolio to database...');
        console.log('User ID from auth:', userId);

        // Convert skills arrays to objects with 'name' field for schema compatibility
        const skillsForDB = [
            ...allSkills.technical.map(skill => ({ name: skill, category: 'Other' })),
            ...allSkills.tools.map(tool => ({ name: tool, category: 'Tools' })),
            ...allSkills.softSkills.map(skill => ({ name: skill, category: 'Soft Skills' }))
        ];

        console.log('Skills formatted for DB:', skillsForDB.length, 'items');

        // Save to database with new structure
        const portfolio = new Portfolio({
            userId: userId,
            personalInfo: {
                name: basicDetails.fullName,
                title: basicDetails.professionalTitle,
                bio: aboutMe,
                email: basicDetails.email,
                phone: basicDetails.phoneNumber || '',
                location: basicDetails.location || '',
                photo: basicDetails.profilePhoto || '',
                socialLinks: {
                    linkedin: socialLinks?.linkedin || '',
                    github: socialLinks?.github || '',
                    twitter: socialLinks?.twitter || '',
                    instagram: socialLinks?.instagram || ''
                }
            },
            skills: skillsForDB,
            projects: projects.map(p => ({
                title: p.title,
                description: p.description,
                technologies: p.technologies || '',
                link: p.liveLink || '',
                githubLink: p.githubLink || '',
                imageUrl: p.screenshot || ''
            })),
            achievements: (achievements || []).map(a => ({
                title: '',
                description: a.description,
                date: '',
                proofUrl: a.certificate || '',
                imageUrl: a.certificate || ''
            })),
            experience: (experience || []).map(e => ({
                company: e.company,
                role: e.role,
                duration: e.duration,
                description: e.description
            })),
            designVision: `Template: ${template}`,
            generatedHTML,
            shareableLink: null
        });

        await portfolio.save();

        console.log('✅ Portfolio saved successfully with ID:', portfolio._id);

        res.status(201).json({
            message: 'Portfolio created successfully',
            portfolioId: portfolio._id
        });
    } catch (error) {
        console.error('❌ SEVERE Portfolio creation error:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({
            message: 'Failed to create portfolio',
            error: error.message,
            stack: error.stack
        });
    }
});

// TEMPLATE-BASED FALLBACK GENERATOR
function generateTemplatePortfolio(basicDetails, aboutMe, skills, projects, experience, education, achievements, socialLinks, template, vision = '') {
    // Template color schemes
    const templates = {
        'MINIMAL_WHITE': { bg: '#ffffff', text: '#000000', primary: '#000000', secondary: '#666666' },
        'MODERN_DARK': { bg: '#1a1a1a', text: '#e2e8f0', primary: '#3b82f6', secondary: '#06b6d4' },
        'CREATIVE_GRADIENT': { bg: 'linear-gradient(135deg, #ec4899 0%, #9333ea 50%, #4f46e5 100%)', text: '#ffffff', primary: '#ec4899', secondary: '#9333ea' },
        'CORPORATE_BLUE': { bg: '#f8fafc', text: '#1e293b', primary: '#1e40af', secondary: '#3b82f6' },
        'TECH_GREEN': { bg: '#f0fdf4', text: '#14532d', primary: '#10b981', secondary: '#059669' },
        'ELEGANT_PURPLE': { bg: '#faf5ff', text: '#4c1d95', primary: '#9333ea', secondary: '#7c3aed' },
        'SUNSET_ORANGE': { bg: '#fff7ed', text: '#7c2d12', primary: '#f97316', secondary: '#ea580c' },
        'OCEAN_TEAL': { bg: '#f0fdfa', text: '#134e4a', primary: '#14b8a6', secondary: '#0d9488' },
        'MONOCHROME': { bg: '#ffffff', text: '#000000', primary: '#000000', secondary: '#404040' },
        'NEON_CYBERPUNK': {
            bg: vision.includes('green') ? '#003300' : '#0a0a0a',
            text: '#e0e0e0',
            primary: '#00ff00', // Neon Green
            secondary: vision.includes('green') ? '#00ff00' : '#ff00ff'
        },
        'PASTEL_DREAM': { bg: '#fef3f8', text: '#831843', primary: '#f9a8d4', secondary: '#c084fc' },
        'AUTO': { bg: '#ffffff', text: '#1e293b', primary: '#9333ea', secondary: '#7c3aed' }
    };

    const colors = templates[template] || templates['AUTO'];
    const isDark = template === 'MODERN_DARK' || template === 'NEON_CYBERPUNK' || template === 'MONOCHROME';
    const isGradient = template === 'CREATIVE_GRADIENT';

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${basicDetails.fullName} - Portfolio</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600;700&display=swap" rel="stylesheet">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        html {
            scroll-behavior: smooth;
        }
        
        body {
            font-family: 'Poppins', sans-serif;
            ${isGradient ? `background: ${colors.bg};` : `background-color: ${colors.bg};`}
            color: ${colors.text};
            line-height: 1.6;
        }
        
        nav {
            position: fixed;
            top: 0;
            width: 100%;
            background: ${isDark ? 'rgba(26, 26, 26, 0.95)' : 'rgba(255, 255, 255, 0.95)'};
            backdrop-filter: blur(10px);
            padding: 1rem 2rem;
            z-index: 1000;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        
        nav ul {
            list-style: none;
            display: flex;
            justify-content: center;
            gap: 2rem;
            flex-wrap: wrap;
        }
        
        nav a {
            color: ${colors.text};
            text-decoration: none;
            font-weight: 500;
            transition: color 0.3s;
        }
        
        nav a:hover {
            color: ${colors.primary};
        }
        
        section {
            min-height: 100vh;
            padding: 6rem 2rem 2rem;
            max-width: 1200px;
            margin: 0 auto;
        }
        
        h1 {
            font-size: 3.5rem;
            font-weight: 700;
            margin-bottom: 1rem;
            color: ${colors.primary};
        }
        
        h2 {
            font-size: 2.5rem;
            font-weight: 600;
            margin-bottom: 2rem;
            color: ${colors.primary};
            border-bottom: 3px solid ${colors.primary};
            padding-bottom: 0.5rem;
            display: inline-block;
        }
        
        h3 {
            font-size: 1.5rem;
            font-weight: 600;
            color: ${colors.primary};
            margin-bottom: 0.5rem;
        }
        
        #home {
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            text-align: center;
        }
        
        .subtitle {
            font-size: 1.5rem;
            color: ${colors.secondary};
            margin-bottom: 2rem;
        }
        
        .social-links {
            display: flex;
            gap: 1.5rem;
            font-size: 2rem;
            margin-top: 2rem;
        }
        
        .social-links a {
            color: ${colors.text};
            transition: all 0.3s;
            ${template === 'NEON_CYBERPUNK' ? `text-shadow: 0 0 10px ${colors.primary}, 0 0 20px ${colors.primary};` : ''}
        }
        
        .social-links a:hover {
            color: ${colors.primary};
            transform: scale(1.2);
        }
        
        .skills-container {
            margin-bottom: 3rem;
        }
        
        .skills-category {
            margin-bottom: 2rem;
        }
        
        .skills-category h3 {
            font-size: 1.3rem;
            margin-bottom: 1rem;
            color: ${colors.secondary};
        }
        
        .skills-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 1rem;
        }
        
        .skill-tag {
            background: ${colors.primary};
            color: #ffffff;
            padding: 1rem;
            border-radius: 10px;
            text-align: center;
            font-weight: 500;
            transition: transform 0.3s;
            ${template === 'NEON_CYBERPUNK' ? `box-shadow: 0 0 15px ${colors.primary}, 0 0 30px ${colors.primary};` : ''}
        }
        
        .skill-tag:hover {
            transform: translateY(-5px);
        }
        
        .timeline-item {
            background: ${isDark ? '#2a2a2a' : '#f8fafc'};
            padding: 2rem;
            border-radius: 10px;
            margin-bottom: 2rem;
            border-left: 4px solid ${colors.primary};
        }
        
        .timeline-meta {
            color: ${colors.secondary};
            font-size: 0.9rem;
            margin-bottom: 0.5rem;
        }
        
        .projects-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 2rem;
            margin-top: 2rem;
        }
        
        .project-card {
            background: ${isDark ? '#2a2a2a' : '#f8fafc'};
            padding: 2rem;
            border-radius: 15px;
            transition: transform 0.3s, box-shadow 0.3s;
            border: 2px solid ${isDark ? '#3a3a3a' : '#e2e8f0'};
            ${template === 'NEON_CYBERPUNK' ? `box-shadow: 0 0 20px rgba(0, 255, 255, 0.3);` : ''}
        }
        
        .project-card:hover {
            transform: translateY(-10px);
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        }
        
        .project-links {
            display: flex;
            gap: 1rem;
            margin-top: 1rem;
            flex-wrap: wrap;
        }
        
        .project-links a {
            color: ${colors.primary};
            text-decoration: none;
            font-weight: 500;
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
        }
        
        .project-links a:hover {
            text-decoration: underline;
        }
        
        .contact-info {
            display: flex;
            flex-direction: column;
            gap: 1.5rem;
            font-size: 1.2rem;
            margin-top: 2rem;
        }
        
        .contact-info a {
            color: ${colors.primary};
            text-decoration: none;
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
        }
        
        .contact-info a:hover {
            transform: translateX(10px);
        }
        
        @media (max-width: 768px) {
            h1 { font-size: 2.2rem; }
            h2 { font-size: 1.8rem; }
            nav { padding: 0.5rem 1rem; }
            nav ul { 
                gap: 0.8rem;
                justify-content: center;
            }
            nav a { font-size: 0.9rem; }
            
            section {
                padding: 5rem 1.5rem 1.5rem;
            }

            .featured-project {
                grid-template-columns: 1fr;
                margin-bottom: 3rem;
                align-items: flex-start;
            }

            .project-content {
                grid-column: 1 / -1;
                padding: 2rem 1.5rem;
                text-align: left;
                align-items: flex-start;
            }
            
            .featured-project:nth-of-type(even) .project-content {
                grid-column: 1 / -1;
                text-align: left;
                align-items: flex-start;
            }

            .project-image {
                grid-column: 1 / -1;
                height: 250px;
                opacity: 0.25;
                z-index: 1;
            }
            
            .featured-project:hover .project-image {
                opacity: 0.4;
            }
            
            .project-description {
                background: transparent;
                padding: 0;
                box-shadow: none;
            }
            
            .project-tech-list {
                justify-content: flex-start;
            }
            
            .featured-project:nth-of-type(even) .project-tech-list {
                justify-content: flex-start;
            }
            
            .project-links {
                justify-content: flex-start;
            }
             .featured-project:nth-of-type(even) .project-links {
                justify-content: flex-start;
            }
        }
        
        .featured-project {
            display: grid;
            gap: 10px;
            grid-template-columns: repeat(12, 1fr);
            align-items: center;
            margin-bottom: 100px;
        }

        .project-content {
            position: relative;
            grid-column: 1 / 8;
            grid-row: 1 / -1;
            text-align: left; /* Default left for odd */
            z-index: 2;
            pointer-events: none; /* Allow clicks to pass through empty areas */
        }
        
        .project-content > * {
            pointer-events: auto; /* Re-enable clicks on content */
        }

        .featured-project:nth-of-type(even) .project-content {
            grid-column: 6 / -1;
            text-align: right;
            align-items: flex-end;
        }

        .project-label {
            ${colors.primary === '#000000' && !isDark ? `color: ${colors.primary};` : `color: ${colors.primary};`}
            font-family: monospace;
            margin-bottom: 8px;
            font-size: 14px;
        }

        .project-title {
            margin-bottom: 20px;
        }

        .project-title a {
            color: ${colors.text};
            font-size: 28px;
            font-weight: 600;
            text-decoration: none;
            transition: color 0.3s;
        }

        .project-title a:hover {
            color: ${colors.primary};
        }

        .project-description {
            box-shadow: 0 10px 30px -15px rgba(0, 0, 0, 0.2);
            transition: all 0.25s cubic-bezier(0.645, 0.045, 0.355, 1);
            position: relative;
            z-index: 2;
            padding: 25px;
            border-radius: 4px;
            background-color: ${isDark ? '#112240' : '#ffffff'};
            color: ${isDark ? '#a8b2d1' : '#495670'};
            font-size: 16px;
            line-height: 1.6;
        }
        
        .featured-project:nth-of-type(even) .project-description {
            text-align: right;
        }

        .project-tech-list {
            display: flex;
            flex-wrap: wrap;
            position: relative;
            z-index: 2;
            margin: 25px 0 10px;
            padding: 0;
            list-style: none;
            gap: 15px;
            color: ${colors.secondary};
            font-family: monospace;
            font-size: 14px;
            justify-content: flex-start; /* Default left */
        }

        .featured-project:nth-of-type(even) .project-tech-list {
            justify-content: flex-end;
        }
        
        .project-links {
             display: flex;
             align-items: center;
             position: relative;
             margin-top: 10px;
             margin-left: -10px;
             color: ${colors.text};
             justify-content: flex-start;
        }
        
        .featured-project:nth-of-type(even) .project-links {
            justify-content: flex-end;
            margin-left: 0;
            margin-right: -10px;
        }

        .project-links a {
            padding: 10px;
            color: ${colors.text};
            transition: color 0.3s;
        }
        
        .project-links a:hover {
            color: ${colors.primary};
            transform: translateY(-3px);
        }

        .project-image {
            grid-column: 6 / -1;
            grid-row: 1 / -1;
            position: relative;
            z-index: 1;
            border-radius: 4px;
            overflow: hidden;
            height: 100%;
            min-height: 300px; /* Ensure visibility */
            box-shadow: 0 10px 30px -15px rgba(0, 0, 0, 0.2);
            transition: all 0.25s cubic-bezier(0.645, 0.045, 0.355, 1);
            cursor: pointer;
        }
        
        .project-image img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            filter: grayscale(100%) contrast(1) brightness(90%);
            transition: all 0.25s cubic-bezier(0.645, 0.045, 0.355, 1);
            border-radius: 4px;
        }

        .featured-project:nth-of-type(even) .project-image {
            grid-column: 1 / 8;
        }
        
        .project-image:hover {
            z-index: 10; /* Bring to front on hover if desired, but content is usually important */
            box-shadow: 0 20px 30px -15px rgba(0, 0, 0, 0.2);
        }
        
        .project-image:hover img {
            filter: none;
        }

         /* Clean Grid for other items if needed, but overridden for Projects */
        .simple-grid {
             display: grid;
             grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
             gap: 20px;
        }
    </style>
</head>
<body>
    <nav>
        <ul>
            <li><a href="#home">Home</a></li>
            <li><a href="#about">About</a></li>
            <li><a href="#skills">Skills</a></li>
            ${experience && experience.length > 0 ? '<li><a href="#experience">Experience</a></li>' : ''}
            ${education && education.length > 0 ? '<li><a href="#education">Education</a></li>' : ''}
            <li><a href="#projects">Projects</a></li>
            ${achievements && achievements.length > 0 ? '<li><a href="#achievements">Achievements</a></li>' : ''}
            <li><a href="#contact">Contact</a></li>
        </ul>
    </nav>

    <!-- HOME -->
    <section id="home">
        ${basicDetails.profilePhoto ? `<img src="${basicDetails.profilePhoto}" alt="${basicDetails.fullName}" style="width: 150px; height: 150px; border-radius: 50%; object-fit: cover; margin-bottom: 1.5rem; border: 4px solid ${colors.primary}; box-shadow: 0 5px 15px rgba(0,0,0,0.2);">` : ''}
        <h1>${basicDetails.fullName}</h1>
        <p class="subtitle">${basicDetails.professionalTitle}</p>
        <p style="max-width: 600px; font-size: 1.1rem;">${aboutMe.substring(0, 200)}...</p>
        <div class="social-links">
            ${socialLinks?.linkedin ? `<a href="${socialLinks.linkedin}" target="_blank" rel="noopener noreferrer" title="LinkedIn"><i class="fab fa-linkedin"></i></a>` : ''}
            ${socialLinks?.github ? `<a href="${socialLinks.github}" target="_blank" rel="noopener noreferrer" title="GitHub"><i class="fab fa-github"></i></a>` : ''}
            <a href="mailto:${basicDetails.email}" title="Email"><i class="fas fa-envelope"></i></a>
            ${socialLinks?.twitter ? `<a href="${socialLinks.twitter}" target="_blank" rel="noopener noreferrer" title="Twitter"><i class="fab fa-twitter"></i></a>` : ''}
            ${socialLinks?.instagram ? `<a href="${socialLinks.instagram}" target="_blank" rel="noopener noreferrer" title="Instagram"><i class="fab fa-instagram"></i></a>` : ''}
        </div>
    </section>

    <!-- ABOUT -->
    <section id="about">
        <h2>About Me</h2>
        <p style="font-size: 1.1rem; line-height: 1.8; max-width: 800px;">${aboutMe}</p>
    </section>

    <!-- SKILLS -->
    <section id="skills">
        <h2>Skills & Expertise</h2>
        
        <div class="skills-container">
            ${skills.technical && skills.technical.length > 0 ? `
            <div class="skills-category">
                <h3><i class="fas fa-code"></i> Technical Skills</h3>
                <div class="skills-grid">
                    ${skills.technical.map(skill => `<div class="skill-tag">${skill}</div>`).join('')}
                </div>
            </div>
            ` : ''}
            
            ${skills.tools && skills.tools.length > 0 ? `
            <div class="skills-category">
                <h3><i class="fas fa-tools"></i> Tools & Technologies</h3>
                <div class="skills-grid">
                    ${skills.tools.map(tool => `<div class="skill-tag">${tool}</div>`).join('')}
                </div>
            </div>
            ` : ''}
            
            ${skills.softSkills && skills.softSkills.length > 0 ? `
            <div class="skills-category">
                <h3><i class="fas fa-users"></i> Soft Skills</h3>
                <div class="skills-grid">
                    ${skills.softSkills.map(skill => `<div class="skill-tag">${skill}</div>`).join('')}
                </div>
            </div>
            ` : ''}
        </div>
    </section>

    ${experience && experience.length > 0 ? `
    <!-- EXPERIENCE -->
    <section id="experience">
        <h2>Experience</h2>
        ${experience.map(exp => `
        <div class="timeline-item">
            <h3>${exp.role}</h3>
            <p class="timeline-meta">${exp.company} | ${exp.duration}</p>
            <p style="margin-top: 1rem;">${exp.description}</p>
        </div>
        `).join('')}
    </section>
    ` : ''}

    ${education && education.length > 0 ? `
    <!-- EDUCATION -->
    <section id="education">
        <h2>Education</h2>
        ${education.map(edu => `
        <div class="timeline-item">
            <h3>${edu.degree || edu.school}</h3>
            <p class="timeline-meta">${edu.school || edu.institution} | ${edu.year || edu.duration || ''}</p>
            <p style="margin-top: 1rem;">${edu.description || ''}</p>
        </div>
        `).join('')}
    </section>
    ` : ''}

    <!-- PROJECTS -->
    <section id="projects">
        <h2 style="margin-bottom: 3rem;">Projects</h2>
        <div class="projects-container">
            ${projects.map((proj, index) => `
            <div class="featured-project">
                <div class="project-content">
                    <p class="project-label">Featured Project</p>
                    <h3 class="project-title"><a href="${proj.liveLink || '#'}" target="_blank" rel="noopener noreferrer">${proj.title}</a></h3>
                    <div class="project-description">
                        <p>${proj.description}</p>
                    </div>
                    <ul class="project-tech-list">
                        ${proj.technologies && typeof proj.technologies === 'string' ? proj.technologies.split(',').map(tech => `<li>${tech.trim()}</li>`).join('') : ''}
                    </ul>
                    <div class="project-links">
                        ${proj.githubLink ? `<a href="${proj.githubLink}" target="_blank" rel="noopener noreferrer" title="GitHub"><i class="fab fa-github" style="font-size: 22px;"></i></a>` : ''}
                        ${proj.liveLink ? `<a href="${proj.liveLink}" target="_blank" rel="noopener noreferrer" title="External Link"><i class="fas fa-external-link-alt" style="font-size: 20px;"></i></a>` : ''}
                    </div>
                </div>
                <div class="project-image" onclick="window.open('${proj.liveLink || proj.githubLink || '#'}', '_blank')">
                   ${proj.screenshot ? `<img src="${proj.screenshot}" alt="${proj.title}">` : '<div style="width:100%; height:100%; background: #ccc; display:flex; align-items:center; justify-content:center;">No Image</div>'}
                </div>
            </div>`).join('')}
        </div>
    </section>

    ${achievements && achievements.length > 0 ? `
    <!-- ACHIEVEMENTS -->
    <section id="achievements">
        <h2 style="margin-bottom: 3rem;">Achievements & Certifications</h2>
        <div class="projects-container">
            ${achievements.map((ach, index) => {
        const certImage = ach.certificate || ach.link || ach.image;
        const title = ach.title || ach.description;
        const desc = ach.description || ach.title;
        const link = ach.link || ach.certificate;

        return `
            <div class="featured-project">
                <div class="project-content">
                    <p class="project-label">Certification</p>
                    <h3 class="project-title" style="font-size: 24px;">${title}</h3>
                    <div class="project-description">
                        <p>${desc}</p>
                         ${link ? `<button style="margin-top: 10px; background: ${colors.primary}; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;" onclick="window.open('${link}', '_blank')"><i class="fas fa-external-link-alt"></i> View Certificate</button>` : ''}
                    </div>
                </div>
                <div class="project-image" onclick="window.open('${link || '#'}', '_blank')">
                     ${certImage ? `<img src="${certImage}" alt="Certificate">` : '<div style="width:100%; height:100%; background: #ccc; display:flex; align-items:center; justify-content:center;">No Image</div>'}
                </div>
            </div>
            `;
    }).join('')}
        </div>
    </section>
    ` : ''}

    <!-- CONTACT -->
    <section id="contact">
        <h2>Get In Touch</h2>
        <div class="contact-info">
            <a href="mailto:${basicDetails.email}"><i class="fas fa-envelope"></i> ${basicDetails.email}</a>
            ${basicDetails.phoneNumber ? `<a href="tel:${basicDetails.phoneNumber}"><i class="fas fa-phone"></i> ${basicDetails.phoneNumber}</a>` : ''}
            
            <div class="social-links" style="margin-top: 1rem; justify-content: flex-start;">
                ${socialLinks?.linkedin ? `<a href="${socialLinks.linkedin}" target="_blank" rel="noopener noreferrer" title="LinkedIn"><i class="fab fa-linkedin"></i></a>` : ''}
                ${socialLinks?.github ? `<a href="${socialLinks.github}" target="_blank" rel="noopener noreferrer" title="GitHub"><i class="fab fa-github"></i></a>` : ''}
                ${socialLinks?.twitter ? `<a href="${socialLinks.twitter}" target="_blank" rel="noopener noreferrer" title="Twitter"><i class="fab fa-twitter"></i></a>` : ''}
                ${socialLinks?.instagram ? `<a href="${socialLinks.instagram}" target="_blank" rel="noopener noreferrer" title="Instagram"><i class="fab fa-instagram"></i></a>` : ''}
            </div>
        </div>
    </section>

    <script>
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                e.preventDefault();
                const targetId = this.getAttribute('href');
                if (targetId === '#home') {
                    window.scrollTo({
                        top: 0,
                        behavior: 'smooth'
                    });
                } else {
                    document.querySelector(targetId).scrollIntoView({
                        behavior: 'smooth'
                    });
                }
            });
        });
    </script>
</body>
</html>`;
}


// GUARANTEED FALLBACK - SHOWS ALL DATA
function generateCompletePortfolio(personalInfo, skills, education, experience, projects, designVision) {
    const vision = designVision?.toLowerCase() || '';

    // Check for various dark theme triggers including typos
    const isNavy = vision.includes('navy') || vision.includes('nav');
    const isMidnight = vision.includes('midnight') || vision.includes('night') || vision.includes('minimize'); // "minimize" often typo for midnight
    const isBlueBg = vision.includes('blue background') || (vision.includes('blue') && vision.includes('bg'));
    const isDark = vision.includes('dark') || vision.includes('black') || isNavy || isMidnight || isBlueBg;

    // Theme Colors
    let bgColor = '#ffffff';
    let textColor = '#1e293b';
    let cardBg = '#f8fafc';
    let navBg = 'rgba(255, 255, 255, 0.95)';

    if (isDark) {
        if (isNavy || isMidnight || isBlueBg) {
            bgColor = '#0a192f'; // Deep Navy/Midnight Blue
            cardBg = '#112240';
            navBg = 'rgba(10, 25, 47, 0.95)';
        } else {
            bgColor = '#0f172a'; // Standard Dark Slate
            cardBg = '#1e293b';
            navBg = 'rgba(15, 23, 42, 0.95)';
        }
        textColor = '#e2e8f0';
    }

    // Determine accent color
    let accentColor = '#9333ea'; // default purple
    if (vision.includes('blue') || vision.includes('navy')) accentColor = '#3b82f6';
    if (vision.includes('cyan') || vision.includes('teal')) accentColor = '#06b6d4';
    if (vision.includes('green') || vision.includes('emerald')) accentColor = '#10b981';
    if (vision.includes('red') || vision.includes('rose')) accentColor = '#ef4444';
    if (vision.includes('orange') || vision.includes('amber')) accentColor = '#f97316';
    if (vision.includes('pink') || vision.includes('fuschia')) accentColor = '#ec4899';
    if (vision.includes('gold') || vision.includes('yellow')) accentColor = '#eab308';
    if (vision.includes('violet') || vision.includes('indigo')) accentColor = '#6366f1';

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${personalInfo.name} - Portfolio</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600;700&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html { scroll-behavior: smooth; }
        body {
            font-family: 'Poppins', sans-serif;
            background: ${bgColor};
            color: ${textColor};
            line-height: 1.6;
        }
        nav {
            position: fixed;
            top: 0;
            width: 100%;
            background: ${navBg};
            backdrop-filter: blur(10px);
            padding: 1rem 2rem;
            z-index: 1000;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        nav ul {
            list-style: none;
            display: flex;
            justify-content: center;
            gap: 2rem;
            flex-wrap: wrap;
        }
        nav a {
            color: ${textColor};
            text-decoration: none;
            font-weight: 500;
            transition: color 0.3s;
        }
        nav a:hover { color: ${accentColor}; }
        section {
            min-height: 100vh;
            padding: 8rem 2rem 2rem;
            max-width: 1200px;
            margin: 0 auto;
        }
        h1 { font-size: 3.5rem; font-weight: 700; margin-bottom: 1rem; color: ${accentColor}; }
        h2 {
            font-size: 2.5rem;
            font-weight: 600;
            margin-bottom: 2rem;
            color: ${accentColor};
            border-bottom: 3px solid ${accentColor};
            padding-bottom: 0.5rem;
            display: inline-block;
        }
        h3 { font-size: 1.5rem; font-weight: 600; color: ${accentColor}; margin-bottom: 0.5rem; }
        #home {
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            text-align: center;
        }
        .subtitle {
            font-size: 1.5rem;
            color: ${isDark ? '#94a3b8' : '#64748b'};
            margin-bottom: 2rem;
        }
        .social-links {
            display: flex;
            gap: 1.5rem;
            font-size: 2rem;
            margin-top: 2rem;
        }
        .social-links a {
            color: ${textColor};
            transition: all 0.3s;
        }
        .social-links a:hover {
            color: ${accentColor};
            transform: scale(1.2);
        }
        .skills-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 1rem;
            margin-top: 2rem;
        }
        .skill-tag {
            background: ${accentColor};
            color: white;
            padding: 1rem;
            border-radius: 10px;
            text-align: center;
            font-weight: 500;
            transition: transform 0.3s;
        }
        .skill-tag:hover { transform: translateY(-5px); }
        .timeline-item {
            background: ${isDark ? '#1e293b' : '#f8fafc'};
            padding: 2rem;
            border-radius: 10px;
            margin-bottom: 2rem;
            border-left: 4px solid ${accentColor};
        }
        .timeline-meta {
            color: ${isDark ? '#94a3b8' : '#64748b'};
            font-size: 0.9rem;
            margin-bottom: 0.5rem;
        }
        .projects-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 2rem;
            margin-top: 2rem;
        }
        .project-card {
            background: ${isDark ? '#1e293b' : '#f8fafc'};
            padding: 2rem;
            border-radius: 15px;
            transition: transform 0.3s, box-shadow 0.3s;
            border: 2px solid ${isDark ? '#334155' : '#e2e8f0'};
        }
        .project-card:hover {
            transform: translateY(-10px);
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        }
        .project-links {
            display: flex;
            gap: 1rem;
            margin-top: 1rem;
            flex-wrap: wrap;
        }
        .project-links a {
            color: ${accentColor};
            text-decoration: none;
            font-weight: 500;
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
        }
        .project-links a:hover { text-decoration: underline; }
        .contact-info {
            display: flex;
            flex-direction: column;
            gap: 1.5rem;
            font-size: 1.2rem;
            margin-top: 2rem;
        }
        .contact-info a {
            color: ${accentColor};
            text-decoration: none;
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
        }
        .contact-info a:hover { transform: translateX(10px); }
        @media (max-width: 768px) {
            h1 { font-size: 2.5rem; }
            h2 { font-size: 2rem; }
            nav ul { flex-direction: column; align-items: center; gap: 1rem; }
            section { padding: 5rem 1rem 1rem; }
        }
    </style>
</head>
<body>
    <nav>
        <ul>
            <li><a href="#home">Home</a></li>
            <li><a href="#about">About Me</a></li>
            ${skills && skills.length > 0 ? '<li><a href="#skills">Skills</a></li>' : ''}
            ${education && education.length > 0 ? '<li><a href="#education">Education</a></li>' : ''}
            ${experience && experience.length > 0 ? '<li><a href="#experience">Experience</a></li>' : ''}
            ${projects && projects.length > 0 ? '<li><a href="#projects">Projects</a></li>' : ''}
            <li><a href="#contact">Contact</a></li>
        </ul>
    </nav>
    <section id="home">
        <h1>${personalInfo.name}</h1>
        <p class="subtitle">${personalInfo.title}</p>
        <p style="max-width: 600px; font-size: 1.1rem;">${personalInfo.bio}</p>
        <div class="social-links">
            ${personalInfo.linkedin ? `<a href="${personalInfo.linkedin}" target="_blank" rel="noopener noreferrer" title="LinkedIn"><i class="fab fa-linkedin"></i></a>` : ''}
            ${personalInfo.github ? `<a href="${personalInfo.github}" target="_blank" rel="noopener noreferrer" title="GitHub"><i class="fab fa-github"></i></a>` : ''}
            <a href="mailto:${personalInfo.email}" title="Email"><i class="fas fa-envelope"></i></a>
            ${personalInfo.phone ? `<a href="tel:${personalInfo.phone}" title="Phone"><i class="fas fa-phone"></i></a>` : ''}
        </div>
    </section>
    <section id="about">
        <h2>About Me</h2>
        <p style="font-size: 1.1rem; line-height: 1.8; max-width: 800px;">${personalInfo.bio}</p>
    </section>${skills && skills.length > 0 ? `
    <section id="skills">
        <h2>Technical Skills</h2>
        <div class="skills-grid">
            ${skills.map(skill => `<div class="skill-tag">${skill}</div>`).join('')}
        </div>
    </section>` : ''}${education && education.length > 0 ? `
    <section id="education">
        <h2>Education</h2>
        ${education.map(edu => `
            <div class="timeline-item">
                <h3>${edu.degree}${edu.field ? ' in ' + edu.field : ''}</h3>
                <p class="timeline-meta">${edu.institution} | Graduated: ${edu.graduationYear}</p>
            </div>`).join('')}
    </section>` : ''}${experience && experience.length > 0 ? `
    <section id="experience">
        <h2>Work Experience</h2>
        ${experience.map(exp => `
            <div class="timeline-item">
                <h3>${exp.position}</h3>
                <p class="timeline-meta">${exp.company} | ${exp.startDate} - ${exp.endDate}</p>
                <p style="margin-top: 1rem;">${exp.description}</p>
            </div>`).join('')}
    </section>` : ''}${projects && projects.length > 0 ? `
    <section id="projects">
        <h2>Projects</h2>
        <div class="projects-grid">
            ${projects.map(proj => `
                <div class="project-card">
                    <h3>${proj.name}</h3>
                    <p style="margin: 1rem 0;">${proj.description}</p>
                    <p style="color: ${accentColor}; font-weight: 500;"><i class="fas fa-code"></i> Tech: ${proj.technologies || 'Various'}</p>
                    <div class="project-links">
                        ${proj.link ? `<a href="${proj.link}" target="_blank" rel="noopener noreferrer"><i class="fas fa-external-link-alt"></i> Live Demo</a>` : ''}
                        ${proj.github ? `<a href="${proj.github}" target="_blank" rel="noopener noreferrer"><i class="fab fa-github"></i> GitHub</a>` : ''}
                    </div>
                </div>`).join('')}
        </div>
    </section>` : ''}
    <section id="contact">
        <h2>Get In Touch</h2>
        <div class="contact-info">
            <a href="mailto:${personalInfo.email}"><i class="fas fa-envelope"></i> ${personalInfo.email}</a>
            ${personalInfo.phone ? `<a href="tel:${personalInfo.phone}"><i class="fas fa-phone"></i> ${personalInfo.phone}</a>` : ''}
            ${personalInfo.linkedin ? `<a href="${personalInfo.linkedin}" target="_blank" rel="noopener noreferrer"><i class="fab fa-linkedin"></i> LinkedIn Profile</a>` : ''}
            ${personalInfo.github ? `<a href="${personalInfo.github}" target="_blank" rel="noopener noreferrer"><i class="fab fa-github"></i> GitHub Profile</a>` : ''}
        </div>
    </section>
    <script>
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                e.preventDefault();
                document.querySelector(this.getAttribute('href')).scrollIntoView({
                    behavior: 'smooth'
                });
            });
        });
    </script>
</body>
</html>`;
}

function ensureExternalLinksOpenNewTab(html) {
    // Exclude links starting with # (even with space), mailto:, tel:, or potential javascript:
    html = html.replace(/<a\s+([^>]*?)href="\s*(?!#|mailto:|tel:|javascript:)([^"]+)"(?![^>]*?target=)([^>]*?)>/gi, '<a $1href="$2" target="_blank" rel="noopener noreferrer"$3>');
    return html;
}

// REDESIGN - PRESERVE ALL DATA
router.post('/redesign', authMiddleware, async (req, res) => {
    try {
        const { originalUrl, analysisData, redesignInstructions } = req.body;
        const userId = req.user._id;

        console.log('🔄 REDESIGN REQUEST:');
        console.log('Original URL:', originalUrl);
        console.log('Instructions:', redesignInstructions);

        // MAP INSTRUCTIONS TO TEMPLATE
        let selectedTemplate = 'AUTO';
        const instructions = redesignInstructions.toLowerCase();

        if (instructions.includes('dark') || instructions.includes('black') || instructions.includes('night')) selectedTemplate = 'MODERN_DARK';
        if (instructions.includes('blue') || instructions.includes('corporate')) selectedTemplate = 'CORPORATE_BLUE';
        if (instructions.includes('creative') || instructions.includes('gradient')) selectedTemplate = 'CREATIVE_GRADIENT';
        if (instructions.includes('minimal') || instructions.includes('white') || instructions.includes('clean')) selectedTemplate = 'MINIMAL_WHITE';
        if (instructions.includes('neon green') || (instructions.includes('green') && instructions.includes('neon'))) selectedTemplate = 'NEON_CYBERPUNK'; // This theme has neon green elements
        else if (instructions.includes('green') || instructions.includes('nature')) selectedTemplate = 'TECH_GREEN';
        if (instructions.includes('purple') || instructions.includes('elegant')) selectedTemplate = 'ELEGANT_PURPLE';
        if (instructions.includes('orange') || instructions.includes('warm')) selectedTemplate = 'SUNSET_ORANGE';
        if (instructions.includes('teal') || instructions.includes('ocean')) selectedTemplate = 'OCEAN_TEAL';
        if (instructions.includes('pink') || instructions.includes('pastel')) selectedTemplate = 'PASTEL_DREAM';
        if (instructions.includes('neon') && !instructions.includes('green')) selectedTemplate = 'NEON_CYBERPUNK';

        console.log('🎨 Selected logic based on instructions:', selectedTemplate);

        const content = {
            name: analysisData.scrapedData.name || 'Portfolio Owner',
            title: analysisData.scrapedData.title || 'Professional',
            bio: analysisData.scrapedData.bio || 'Professional with diverse experience',
            email: analysisData.scrapedData.email || 'contact@example.com',
            phone: analysisData.scrapedData.phone || '',
            profilePhoto: analysisData.scrapedData.profilePhoto || '',
            socialLinks: {
                linkedin: analysisData.scrapedData.linkedin || (analysisData.scrapedData.socialLinks && analysisData.scrapedData.socialLinks.linkedin) || '',
                github: analysisData.scrapedData.github || (analysisData.scrapedData.socialLinks && analysisData.scrapedData.socialLinks.github) || '',
                twitter: analysisData.scrapedData.twitter || (analysisData.scrapedData.socialLinks && analysisData.scrapedData.socialLinks.twitter) || '',
                instagram: analysisData.scrapedData.instagram || (analysisData.scrapedData.socialLinks && analysisData.scrapedData.socialLinks.instagram) || ''
            },
            skills: analysisData.scrapedData.skills || [],
            projects: analysisData.scrapedData.projects || [],
            experience: analysisData.scrapedData.experience || [],
            education: analysisData.scrapedData.education || [],
            achievements: analysisData.scrapedData.achievements || []
        };

        const prompt = `You are a Senior UI/UX Designer and Frontend Engineer. 
TASK: Redesign the user's portfolio website into a PREMIUM, MODERN, and STUNNING custom experience.

TARGET VISION: "${redesignInstructions}"

CORE CONTENT (YOU MUST INCLUDE EVERY ITEM BELOW - NO EXCEPTIONS):
- Name: ${content.name}
- Role: ${content.title}
- Bio: ${content.bio}
- Photo URL: ${content.profilePhoto} (MANDATORY: If this URL exists, display it as a professional 200px circular avatar in the Hero section.)
- Socials: ${Object.entries(content.socialLinks).filter(([_, url]) => !!url).map(([platform, url]) => `${platform}: ${url}`).join(' | ') || 'None found'}
- Skills: ${content.skills.join(', ')}
- Achievements: ${content.achievements.map(a => `${a.title || a.description}${a.link ? ' - Certificate: ' + a.link : ''}`).join(' | ')}
- Projects: ${content.projects.map(p => `[Project: ${p.name}, Description: ${p.description}, Image: ${p.image}, Link: ${p.link}]`).join(' | ')}
- Experience: ${content.experience.map(e => `${e.company}: ${e.position} (${e.startDate || 'Present'} - ${e.endDate || 'Present'}) - ${e.description}`).join(' | ')}
- Education: ${content.education.map(e => `${e.degree} at ${e.institution}`).join(' | ')}

TASK: Redesign portfolio HTML. Change ONLY colors/fonts/spacing. Keep ALL text EXACTLY as provided.

FORBIDDEN: Do NOT add ANY text not listed below. Do NOT add extra words, sentences, or descriptions.

DATA (USE EXACTLY - NO CHANGES):
Name: ${content.name}
Title: ${content.title}
Bio: ${content.bio}
Email: ${content.email}
Skills: ${content.skills.join(', ')}

PROJECTS (${content.projects.length} total - SHOW ALL):
${content.projects.map((p, i) => `${i + 1}. Name: ${p.name} | Desc: ${p.description} | Image: ${p.image} | Link: ${p.link}`).join('\n')}

EXPERIENCE (${content.experience.length} total):
${content.experience.map(e => `${e.company} - ${e.position} (${e.startDate || ''} to ${e.endDate || ''}): ${e.description}`).join('\n')}

EDUCATION (${content.education.length} total):
${content.education.map(e => `${e.degree} at ${e.institution}`).join('\n')}

ACHIEVEMENTS (${content.achievements.length} total):
${content.achievements.map((a, i) => `${i + 1}. ${a.title || a.description} | Link: ${a.link || 'none'} | Image: ${a.image || 'none'}`).join('\n')}

SOCIAL: ${Object.entries(content.socialLinks).filter(([_, url]) => !!url).map(([p, u]) => `${p}: ${u}`).join(' | ')}

LAYOUT RULES:
1. Hero: Show name, title, bio. MANDATORY: If profile photo URL exists, you MUST render it using this EXACT HTML: <img src="${content.profilePhoto}" alt="Profile" style="width:200px;height:200px;border-radius:50%;object-fit:cover;display:block;"> (DO NOT output the URL as text).
2. Projects: HORIZONTAL grid (3 columns). Each card: image (use <img src="..."> tag), name, description, link
3. Achievements: HORIZONTAL grid. Each card: 
   - Top: Image (MANDATORY: If image URL exists, use <img src="..." alt="Certificate" style="max-width:100%;height:auto;"> tag)
   - Middle: Title/Description
   - Bottom: "View Certificate" link (if link provided)
4. Social: FontAwesome icons (fa-brands fa-linkedin, fa-github, fa-x-twitter, fa-instagram) in hero AND contact
5. Hide empty sections
6. All links: target="_blank" rel="noopener noreferrer"

STYLING: Apply "${redesignInstructions}" for colors/fonts only

Include: <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">

OUTPUT: HTML with embedded CSS. Use ONLY text from DATA section above.`;

        console.log('📊 Redesign content prepared:', {
            name: content.name,
            title: content.title,
            profilePhoto: content.profilePhoto,
            projects: content.projects.length,
            achievements: content.achievements.length,
            hasProfilePhoto: !!content.profilePhoto,
            socialsFound: Object.values(content.socialLinks).filter(s => !!s).length
        });

        console.log('🖼️ Profile Photo URL being sent to AI:', content.profilePhoto);

        console.log('🤖 Calling AI for Custom Redesign Vision...');
        let generatedHTML = '';
        try {
            generatedHTML = await callGroqAPI(prompt, 12000); // Increased from 8000 to allow more content
            generatedHTML = generatedHTML.replace(/```html\n?/g, '').replace(/```\n?/g, '').trim();
            console.log('✅ AI generation successful (length:', generatedHTML.length, ')');

            // Validate that AI included the data
            const hasProjects = content.projects.length === 0 || content.projects.some(p => generatedHTML.includes(p.name));
            const hasAchievements = content.achievements.length === 0 || content.achievements.some(a => generatedHTML.includes(a.title));

            if (!hasProjects || !hasAchievements) {
                console.warn('⚠️ AI generated HTML but missing data. Forcing fallback template.');
                generatedHTML = ''; // Force fallback
            }

            // FORCE PROFILE PHOTO INJECTION if missing or not properly displayed
            // We check if the EXACT photo URL is used in an <img src="..."> tag
            const hasProfilePhotoImg = content.profilePhoto && generatedHTML.includes(`<img`) && generatedHTML.includes(content.profilePhoto);

            if (content.profilePhoto && !hasProfilePhotoImg) {
                console.warn('⚠️ AI missed profile photo or showed as text - FORCE INJECTING...');

                const imgTag = `<div style="text-align: center; margin-bottom: 20px;">
                    <img src="${content.profilePhoto}" alt="${content.name}" style="width: 200px; height: 200px; border-radius: 50%; object-fit: cover; display: inline-block; border: 4px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.15);">
                </div>`;

                // Try to inject before the name <h1> or <div class="name">
                const nameRegex = new RegExp(`(<h1[^>]*>\\s*${content.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*</h1>)`, 'i');
                const heroSectionRegex = /(<section[^>]*id="hero"[^>]*>)/i;
                const bodyStartRegex = /(<body[^>]*>)/i;

                if (nameRegex.test(generatedHTML)) {
                    // Inject BEFORE the name
                    console.log('✅ Injecting profile photo before name');
                    generatedHTML = generatedHTML.replace(nameRegex, `${imgTag}$1`);
                } else if (heroSectionRegex.test(generatedHTML)) {
                    // Inject at start of hero section
                    console.log('✅ Injecting profile photo in hero section');
                    generatedHTML = generatedHTML.replace(heroSectionRegex, `$1${imgTag}`);
                } else {
                    // Fallback: Force prepend to body content
                    console.warn('⚠️ Could not find name or hero to inject photo. Prepending to body.');
                    // Try to find the opening body tag
                    if (bodyStartRegex.test(generatedHTML)) {
                        generatedHTML = generatedHTML.replace(bodyStartRegex, `$1${imgTag}`);
                    } else if (!generatedHTML.trim().toLowerCase().startsWith('<!doctype') && !generatedHTML.trim().toLowerCase().startsWith('<html')) {
                        // Only prepend if it's likely a fragment
                        generatedHTML = imgTag + generatedHTML;
                    } else {
                        // It's a full document but regex failed? Try harder to find body or just inject after first >
                        // This is safer than prepending to DOCTYPE
                        const firstTagClose = generatedHTML.indexOf('>');
                        if (firstTagClose > -1 && generatedHTML.toLowerCase().includes('<body')) {
                            // If body exists but regex failed (maybe attributes?), try simple search
                            const bodyIdx = generatedHTML.toLowerCase().indexOf('<body');
                            const bodyEndIdx = generatedHTML.indexOf('>', bodyIdx) + 1;
                            if (bodyIdx > -1 && bodyEndIdx > 0) {
                                generatedHTML = generatedHTML.slice(0, bodyEndIdx) + imgTag + generatedHTML.slice(bodyEndIdx);
                            }
                        }
                    }
                }
            }
        } catch (aiError) {
            console.error('❌ AI Redesign failed:', aiError.message);
            generatedHTML = ''; // Trigger fallback
        }

        if (!generatedHTML || !generatedHTML.includes('<!DOCTYPE')) {
            console.log('🎨 AI failed or returned invalid HTML, using guaranteed fallback template');
            generatedHTML = generateTemplatePortfolio(
                {
                    fullName: content.name,
                    professionalTitle: content.title,
                    email: content.email,
                    phone: content.phone,
                    location: '',
                    profilePhoto: content.profilePhoto,
                },
                content.bio,
                {
                    technical: content.skills,
                    tools: [],
                    softSkills: []
                },
                content.projects.map(p => ({
                    title: p.name || p.title,
                    description: p.description,
                    technologies: p.technologies ? p.technologies.join(', ') : '',
                    githubLink: p.github,
                    liveLink: p.link || p.url,
                    screenshot: p.image || p.imageUrl // Support both mappings
                })),
                content.experience.map(e => ({
                    role: e.role || e.title,
                    company: e.company,
                    duration: e.period || e.duration,
                    description: e.description
                })),
                content.education.map(e => ({
                    school: e.school || e.institution,
                    degree: e.degree,
                    year: e.year || e.period,
                    description: e.description
                })),
                content.achievements, // PASS ACHIEVEMENTS
                content.socialLinks,
                selectedTemplate,
                redesignInstructions
            );
        }

        generatedHTML = ensureExternalLinksOpenNewTab(generatedHTML);

        const portfolio = new Portfolio({
            userId,
            personalInfo: {
                name: content.name,
                title: content.title,
                bio: content.bio,
                email: content.email,
                phone: content.phone,
                photo: content.profilePhoto, // ADD THIS
                linkedin: content.socialLinks.linkedin || '',
                github: content.socialLinks.github || '',
                twitter: content.socialLinks.twitter || '',
                instagram: content.socialLinks.instagram || ''
            },
            skills: content.skills.map(s => ({ name: s, category: 'Other' })),
            projects: content.projects.map(p => ({
                title: p.name || p.title || 'Project',
                description: p.description || '',
                technologies: Array.isArray(p.technologies) ? p.technologies.join(', ') : (p.technologies || ''),
                link: p.url || p.link || '',
                githubLink: p.github || '',
                imageUrl: p.image || ''
            })),
            experience: content.experience.map(e => ({
                company: e.company || 'Company',
                role: e.position || e.role || e.title || 'Position',
                duration: e.duration || (e.startDate ? `${e.startDate} - ${e.endDate || 'Present'}` : 'Present'),
                description: e.description || ''
            })),
            education: content.education.map(e => ({
                school: e.institution || e.school || 'Institution',
                degree: e.degree || 'Degree',
                year: e.graduationYear || e.year || e.period || '',
                description: e.description || ''
            })),
            achievements: content.achievements.map(a => ({
                title: (typeof a === 'object' ? a.title : a) || 'Achievement',
                description: (typeof a === 'object' ? a.description : '') || 'Certified/Awarded achievement',
                proofUrl: (typeof a === 'object' ? a.link : '') || '',
                imageUrl: (typeof a === 'object' ? a.image : '') || ''
            })),
            designVision: redesignInstructions,
            generatedHTML,
            shareableLink: `/view/${userId}/${Date.now()}`, // More standard path
            isRedesign: true,
            originalUrl
        });

        await portfolio.save();

        console.log('✅ Redesigned Portfolio saved:', portfolio._id);

        res.status(201).json({
            message: 'Portfolio redesigned successfully',
            portfolioId: portfolio._id
        });
    } catch (error) {
        console.error('Redesign error:', error);
        res.status(500).json({ message: 'Failed to redesign', error: error.message });
    }
});



// GET PORTFOLIOS
router.get('/my-portfolios', authMiddleware, async (req, res) => {
    try {
        const portfolios = await Portfolio.find({ userId: req.user._id })
            .sort({ createdAt: -1 })
            .select('-generatedHTML');
        res.json(portfolios);
    } catch (error) {
        console.error('Fetch portfolios error:', error);
        res.status(500).json({ message: 'Failed to fetch portfolios' });
    }
});

// GET SINGLE PORTFOLIO
router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const portfolio = await Portfolio.findOne({
            _id: req.params.id,
            userId: req.user._id
        });

        if (!portfolio) {
            return res.status(404).json({ message: 'Portfolio not found' });
        }

        res.json(portfolio);
    } catch (error) {
        console.error('Fetch portfolio error:', error);
        res.status(500).json({ message: 'Failed to fetch portfolio' });
    }
});

// DOWNLOAD RESUME PDF
router.get('/:id/resume', authMiddleware, async (req, res) => {
    try {
        const portfolio = await Portfolio.findOne({
            _id: req.params.id,
            userId: req.user._id
        });

        if (!portfolio) {
            return res.status(404).json({ message: 'Portfolio not found' });
        }

        const resumeHTML = generateResumeHTML(portfolio);

        try {
            const pdfBuffer = await pdfGenerator.generateResumePDF(resumeHTML);
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${portfolio.personalInfo.name || 'Resume'}.pdf"`);
            res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
            console.log(`📄 Sending PDF resume for ${portfolio.personalInfo.name}`);
            res.send(pdfBuffer);
        } catch (pdfError) {
            console.warn('⚠️ PDF generation failed, falling back to HTML:', pdfError.message);
            if (pdfError.stack) console.error(pdfError.stack);
            res.setHeader('Content-Type', 'text/html');
            res.setHeader('Content-Disposition', `attachment; filename="${portfolio.personalInfo.name || 'Resume'}.html"`);
            res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
            res.send(resumeHTML);
        }
    } catch (error) {
        console.error('Resume generation error:', error);
        res.status(500).json({ message: 'Failed to generate resume' });
    }
});

// RESUME HTML GENERATOR - INCLUDES ALL DATA
function generateResumeHTML(portfolio) {
    const { personalInfo = {}, skills = [], education = [], experience = [], projects = [] } = portfolio;

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${personalInfo.name || 'Resume'} - Resume</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Georgia', serif;
            line-height: 1.6;
            color: #333;
            max-width: 850px;
            margin: 0 auto;
            padding: 40px 20px;
            background: #fff;
        }
        header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 3px solid #2563eb;
            padding-bottom: 20px;
        }
        h1 {
            font-size: 36px;
            color: #1e40af;
            margin-bottom: 8px;
            font-weight: 700;
        }
        .title {
            font-size: 20px;
            color: #666;
            margin-bottom: 12px;
            font-weight: 500;
        }
        .contact {
            font-size: 14px;
            color: #666;
            line-height: 1.8;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 8px;
        }
        .contact-row {
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 15px;
            flex-wrap: wrap;
        }
        .contact a {
            color: #2563eb;
            text-decoration: none;
            display: inline-flex;
            align-items: center;
            gap: 5px;
        }
        .social-icons-row {
            display: flex;
            gap: 20px;
            margin-top: 5px;
            font-size: 18px;
        }
        .social-icons-row a {
            color: #333;
            transition: color 0.3s;
        }
        .social-icons-row a:hover {
            color: #2563eb;
        }
        section {
            margin-bottom: 30px;
        }
        h2 {
            font-size: 22px;
            color: #1e40af;
            border-bottom: 2px solid #93c5fd;
            padding-bottom: 8px;
            margin-bottom: 18px;
            font-weight: 600;
        }
        .item {
            margin-bottom: 24px;
            page-break-inside: avoid;
        }
        .item-header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
            align-items: flex-start;
        }
        .item-title {
            font-weight: 700;
            color: #1e40af;
            font-size: 16px;
        }
        .item-subtitle {
            color: #666;
            font-style: italic;
            font-size: 15px;
            margin-top: 2px;
        }
        .item-date {
            color: #666;
            font-size: 14px;
            white-space: nowrap;
            margin-left: 20px;
        }
        .item-description {
            color: #333;
            margin-top: 8px;
            line-height: 1.7;
        }
        .skills-container {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
        }
        .skill-tag {
            background: #dbeafe;
            color: #1e40af;
            padding: 6px 14px;
            border-radius: 16px;
            font-size: 14px;
            font-weight: 500;
        }
        .project-links {
            margin-top: 6px;
            font-size: 14px;
        }
        .project-links a {
            color: #2563eb;
            text-decoration: none;
            margin-right: 15px;
        }
        .empty-message {
            color: #999;
            font-style: italic;
            padding: 10px 0;
        }
        @media print {
            body { padding: 20px; }
            section { page-break-inside: avoid; }
        }
    </style>
</head>
<body>
    <!-- HEADER -->
    <header>
        <h1>${personalInfo.name || 'Your Name'}</h1>
        <div class="title">${personalInfo.title || 'Professional Title'}</div>
        <div class="contact">
            <div class="contact-row">
                <a href="mailto:${personalInfo.email}"><i class="fas fa-envelope"></i> ${personalInfo.email}</a>
                ${personalInfo.phone ? `<span>•</span><a href="tel:${personalInfo.phone}"><i class="fas fa-phone"></i> ${personalInfo.phone}</a>` : ''}
            </div>
            
            <div class="social-icons-row">
                ${personalInfo.socialLinks?.linkedin || personalInfo.linkedin ? `<a href="${personalInfo.socialLinks?.linkedin || personalInfo.linkedin}" target="_blank"><i class="fab fa-linkedin"></i></a>` : ''}
                ${personalInfo.socialLinks?.github || personalInfo.github ? `<a href="${personalInfo.socialLinks?.github || personalInfo.github}" target="_blank"><i class="fab fa-github"></i></a>` : ''}
                ${personalInfo.socialLinks?.twitter ? `<a href="${personalInfo.socialLinks.twitter}" target="_blank"><i class="fab fa-twitter"></i></a>` : ''}
                ${personalInfo.socialLinks?.instagram ? `<a href="${personalInfo.socialLinks.instagram}" target="_blank"><i class="fab fa-instagram"></i></a>` : ''}
            </div>
        </div>
    </header>

    <!-- PROFESSIONAL SUMMARY -->
    ${personalInfo.bio ? `
    <section>
        <h2>Professional Summary</h2>
        <p>${personalInfo.bio}</p>
    </section>` : ''}${skills && skills.length > 0 ? `
    <!-- TECHNICAL SKILLS -->
    <section>
        <h2>Technical Skills</h2>
        <div class="skills-container">
            ${skills.map(skill => {
        const skillName = typeof skill === 'object' ? skill.name : skill;
        // Handle comma-separated skills in a single entry
        return skillName.split(',').map(s =>
            `<span class="skill-tag">${s.trim()}</span>`
        ).join('');
    }).join('')}
        </div>
    </section>` : ''}${education && education.length > 0 ? `
    <!-- EDUCATION -->
    <section>
        <h2>Education</h2>
        ${education.map(edu => `
        <div class="item">
            <div class="item-header">
                <div>
                    <div class="item-title">${edu.degree || 'Degree'}${edu.field ? ' in ' + edu.field : ''}</div>
                    <div class="item-subtitle">${edu.institution || 'Institution'}</div>
                    ${edu.gpa ? `<div style="color: #666; font-size: 14px; margin-top: 4px;">GPA: ${edu.gpa}</div>` : ''}
                </div>
                <div class="item-date">${edu.graduationYear || ''}</div>
            </div>
        </div>`).join('')}
    </section>` : ''}${experience && experience.length > 0 ? `
    <!-- WORK EXPERIENCE -->
    <section>
        <h2>Work Experience</h2>
        ${experience.map(exp => `
        <div class="item">
            <div class="item-header">
                <div>
                    <div class="item-title">${exp.position || 'Position'}</div>
                    <div class="item-subtitle">${exp.company || 'Company'}</div>
                </div>
                <div class="item-date">${exp.startDate || ''} - ${exp.endDate || 'Present'}</div>
            </div>
            ${exp.description ? `<div class="item-description">${exp.description}</div>` : ''}
        </div>`).join('')}
    </section>` : ''}${achievements && achievements.length > 0 ? `
    <!-- ACHIEVEMENTS -->
    <section>
        <h2>Achievements & Certifications</h2>
        <ul style="list-style: none;">
            ${achievements.map(award => `
            <li class="item" style="display: flex; gap: 10px; align-items: flex-start;">
                <i class="fas fa-certificate" style="color: #2563eb; margin-top: 5px;"></i>
                <div>${award}</div>
            </li>`).join('')}
        </ul>
    </section>` : ''}${projects && projects.length > 0 ? `
    <!-- PROJECTS -->
    <section>
        <h2>Projects</h2>
        ${projects.map(proj => `
        <div class="item">
            <div class="item-title">${proj.name || proj.title || 'Project Name'}</div>
            ${proj.description ? `<div class="item-description">${proj.description}</div>` : ''}
            ${proj.technologies ? `<div class="item-description"><strong>Technologies:</strong> ${Array.isArray(proj.technologies) ? proj.technologies.join(', ') : proj.technologies}</div>` : ''}
            <div class="project-links">
                ${proj.link ? `<a href="${proj.link}" target="_blank">🔗 Live Demo</a>` : ''}
                ${proj.github || proj.githubLink ? `<a href="${proj.github || proj.githubLink}" target="_blank">💻 GitHub</a>` : ''}
            </div>
        </div>`).join('')}
    </section>` : ''}
</body>
</html>`;
}

// DEPLOY TO GITHUB
router.post('/:id/deploy/github', authMiddleware, async (req, res) => {
    try {
        const { githubToken, repoName, userName } = req.body;
        const portfolio = await Portfolio.findOne({ _id: req.params.id, userId: req.user._id });

        if (!portfolio) {
            return res.status(404).json({ message: 'Portfolio not found' });
        }

        const result = await deploymentManager.deployToGitHub(githubToken, repoName, portfolio.generatedHTML, userName);
        portfolio.shareableLink = result.url;
        await portfolio.save();

        res.json(result);
    } catch (error) {
        console.error('GitHub deployment error:', error);
        res.status(500).json({ message: error.message });
    }
});

// DEPLOY TO NETLIFY
router.post('/:id/deploy/netlify', authMiddleware, async (req, res) => {
    try {
        const { netlifyToken, siteName } = req.body;
        const portfolio = await Portfolio.findOne({ _id: req.params.id, userId: req.user._id });

        if (!portfolio) {
            return res.status(404).json({ message: 'Portfolio not found' });
        }

        const result = await deploymentManager.deployToNetlify(netlifyToken, siteName, portfolio.generatedHTML);
        portfolio.shareableLink = result.url;
        await portfolio.save();

        res.json(result);
    } catch (error) {
        console.error('Netlify deployment error:', error);
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
