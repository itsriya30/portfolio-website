const express = require('express');
const router = express.Router();
const Portfolio = require('../models/Portfolio');
const Groq = require('groq-sdk');
const config = require('../config');
const pdfGenerator = require('../utils/pdfGenerator');
const deploymentManager = require('../utils/deploymentManager');

const groq = new Groq({
    apiKey: config.GROQ_API_KEY
});

const authMiddleware = require('../middleware/auth');

// Helper function to call Groq API
async function callGroqAPI(prompt, maxTokens = 8000) {
    try {
        const completion = await groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: "You are an expert web developer. Generate clean, modern, responsive HTML/CSS/JS code."
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

// ===========================================
// FIX 1: PORTFOLIO CREATION (Shows ALL Data)
// ===========================================
router.post('/create', authMiddleware, async (req, res) => {
    try {
        const { personalInfo, skills, education, experience, projects, designVision } = req.body;
        const userId = req.userId;

        console.log('📝 CREATING PORTFOLIO - DATA RECEIVED:');
        console.log('Personal Info:', personalInfo);
        console.log('Skills:', skills?.length, 'items');
        console.log('Education:', education?.length, 'items');
        console.log('Experience:', experience?.length, 'items');
        console.log('Projects:', projects?.length, 'items');

        if (!personalInfo?.name || !personalInfo?.title || !designVision) {
            return res.status(400).json({
                message: 'Missing required fields: name, title, or design vision'
            });
        }

        const safeSkills = Array.isArray(skills) ? skills : [];
        const safeEducation = Array.isArray(education) ? education : [];
        const safeExperience = Array.isArray(experience) ? experience : [];
        const safeProjects = Array.isArray(projects) ? projects : [];

        const prompt = `Create a complete portfolio website. You MUST display ALL data provided.

DESIGN VISION: "${designVision}"

PERSONAL INFO:
Name: ${personalInfo.name}
Title: ${personalInfo.title}
Bio: ${personalInfo.bio || ''}
Email: ${personalInfo.email}
Phone: ${personalInfo.phone || ''}
LinkedIn: ${personalInfo.linkedin || ''}
GitHub: ${personalInfo.github || ''}

SKILLS (SHOW ALL ${safeSkills.length} SKILLS):
${safeSkills.map((s, i) => `${i + 1}. ${s}`).join('\n')}

EDUCATION (SHOW ALL ${safeEducation.length} ENTRIES):
${safeEducation.map((e, i) => `
Entry ${i + 1}:
- Degree: ${e.degree || 'Not specified'}
- Field: ${e.field || 'Not specified'}
- Institution: ${e.institution || 'Not specified'}
- Year: ${e.graduationYear || 'Not specified'}
- GPA: ${e.gpa || 'Not specified'}
`).join('\n')}

EXPERIENCE (SHOW ALL ${safeExperience.length} ENTRIES):
${safeExperience.map((e, i) => `
Entry ${i + 1}:
- Position: ${e.position || 'Not specified'}
- Company: ${e.company || 'Not specified'}
- Start: ${e.startDate || 'Not specified'}
- End: ${e.endDate || 'Not specified'}
- Description: ${e.description || 'Not specified'}
`).join('\n')}

PROJECTS (SHOW ALL ${safeProjects.length} ENTRIES):
${safeProjects.map((p, i) => `
Entry ${i + 1}:
- Name: ${p.name || 'Not specified'}
- Description: ${p.description || 'Not specified'}
- Technologies: ${p.technologies || 'Not specified'}
- Link: ${p.link || 'Not specified'}
- GitHub: ${p.github || 'Not specified'}
`).join('\n')}

CRITICAL REQUIREMENTS:
1. ONE complete HTML file (CSS in <style>, JS in <script>)
2. MUST show ALL sections with ALL data:
   - Hero section with name, title, bio, social links
   - About section with full bio
   - Skills section: ALL ${safeSkills.length} skills displayed
   - Education section: ALL ${safeEducation.length} entries with complete details
   - Experience section: ALL ${safeExperience.length} entries with full descriptions
   - Projects section: ALL ${safeProjects.length} projects with links
   - Contact section with email, phone, LinkedIn, GitHub
3. Fixed navigation with smooth scroll
4. Responsive design (mobile, tablet, desktop)
5. External links: target="_blank" rel="noopener noreferrer"
6. Font Awesome CDN: https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css
7. Google Fonts for typography
8. Match design vision exactly
9. If a section has 0 items, show "No items added yet" message
10. Professional, modern, production-ready code

DATA VERIFICATION:
- Count all items before rendering
- Ensure each item has proper HTML structure
- Display all fields for each entry
- No truncation, no hiding of data

Return ONLY HTML code. No markdown, no explanations.`;

        let generatedHTML = await callGroqAPI(prompt, 8000);
        generatedHTML = generatedHTML.replace(/```html\n?/g, '').replace(/```\n?/g, '').trim();

        // If AI fails, use guaranteed fallback
        if (!generatedHTML.includes('<!DOCTYPE') || !generatedHTML.includes('<html')) {
            console.log('⚠️ AI failed, using guaranteed fallback');
            generatedHTML = generateGuaranteedHTML(personalInfo, safeSkills, safeEducation, safeExperience, safeProjects, designVision);
        }

        generatedHTML = ensureExternalLinksOpenNewTab(generatedHTML);

        // Verify data in HTML
        console.log('✅ PORTFOLIO HTML GENERATED');
        console.log('- Contains skills section:', generatedHTML.includes('id="skills"'));
        console.log('- Contains education section:', generatedHTML.includes('id="education"'));
        console.log('- Contains experience section:', generatedHTML.includes('id="experience"'));
        console.log('- Contains projects section:', generatedHTML.includes('id="projects"'));

        const portfolio = new Portfolio({
            userId,
            personalInfo,
            skills: safeSkills,
            education: safeEducation,
            experience: safeExperience,
            projects: safeProjects,
            designVision,
            generatedHTML,
            shareableLink: `https://portfolio-${userId}-${Date.now()}.netlify.app`,
            isRedesign: false
        });

        await portfolio.save();

        console.log('💾 PORTFOLIO SAVED TO DATABASE');
        console.log('Portfolio ID:', portfolio._id);
        console.log('Data counts:', {
            skills: portfolio.skills.length,
            education: portfolio.education.length,
            experience: portfolio.experience.length,
            projects: portfolio.projects.length
        });

        res.status(201).json({
            message: 'Portfolio created successfully',
            portfolioId: portfolio._id,
            dataIncluded: {
                skills: safeSkills.length,
                education: safeEducation.length,
                experience: safeExperience.length,
                projects: safeProjects.length
            }
        });
    } catch (error) {
        console.error('❌ Portfolio creation error:', error);
        res.status(500).json({ message: 'Failed to create portfolio', error: error.message });
    }
});

// Helper function to ensure external links open in new tabs
function ensureExternalLinksOpenNewTab(html) {
    // Add target="_blank" to links that don't start with #
    html = html.replace(/<a\s+href="(?!#)([^"]+)"(?!\s+target)/gi, '<a href="$1" target="_blank" rel="noopener noreferrer"');
    return html;
}

// ===========================================
// FIX 3: GUARANTEED PORTFOLIO HTML (FALLBACK)
// ===========================================
function generateGuaranteedHTML(personalInfo, skills, education, experience, projects, designVision) {
    const visionLower = (designVision || '').toLowerCase();
    const isDark = visionLower.includes('dark');
    const bgColor = isDark ? '#0f172a' : '#ffffff';
    const textColor = isDark ? '#e2e8f0' : '#1e293b';
    const accentColor = visionLower.includes('purple') ? '#9333ea' :
        visionLower.includes('green') ? '#10b981' :
            visionLower.includes('red') ? '#ef4444' : '#3b82f6';

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${personalInfo.name || 'Portfolio'}</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html { scroll-behavior: smooth; }
        body { font-family: 'Inter', sans-serif; background: ${bgColor}; color: ${textColor}; line-height: 1.6; }
        nav { position: fixed; top: 0; width: 100%; background: ${isDark ? 'rgba(15,23,42,0.95)' : 'rgba(255,255,255,0.95)'}; backdrop-filter: blur(10px); padding: 1rem 2rem; z-index: 1000; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        nav ul { list-style: none; display: flex; justify-content: center; gap: 2rem; flex-wrap: wrap; }
        nav a { color: ${textColor}; text-decoration: none; font-weight: 500; transition: all 0.3s; }
        nav a:hover { color: ${accentColor}; }
        section { min-height: 100vh; padding: 6rem 2rem 2rem; max-width: 1200px; margin: 0 auto; }
        h1 { font-size: 3.5rem; font-weight: 700; margin-bottom: 1rem; color: ${accentColor}; }
        h2 { font-size: 2.5rem; font-weight: 600; margin-bottom: 2rem; color: ${accentColor}; }
        h3 { font-size: 1.5rem; font-weight: 600; color: ${accentColor}; margin-bottom: 0.5rem; }
        #home { display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; }
        .subtitle { font-size: 1.5rem; color: ${isDark ? '#94a3b8' : '#64748b'}; margin-bottom: 2rem; }
        .social-links { display: flex; gap: 1.5rem; font-size: 1.5rem; margin-top: 2rem; }
        .social-links a { color: ${textColor}; transition: all 0.3s; }
        .social-links a:hover { color: ${accentColor}; transform: scale(1.2); }
        .content-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem; margin-top: 2rem; }
        .card { background: ${isDark ? '#1e293b' : '#f8fafc'}; padding: 1.5rem; border-radius: 12px; transition: all 0.3s; border: 2px solid ${isDark ? '#334155' : '#e2e8f0'}; }
        .card:hover { transform: translateY(-5px); box-shadow: 0 10px 30px rgba(0,0,0,0.15); }
        .tag { display: inline-block; background: ${accentColor}; color: white; padding: 0.5rem 1rem; border-radius: 20px; margin: 0.25rem; font-size: 0.9rem; }
        .links { display: flex; gap: 1rem; margin-top: 1rem; }
        .links a { color: ${accentColor}; text-decoration: none; }
        @media (max-width: 768px) { h1 { font-size: 2.5rem; } h2 { font-size: 2rem; } nav ul { flex-direction: column; align-items: center; gap: 1rem; } section { padding: 5rem 1rem 1rem; } }
    </style>
</head>
<body>
    <nav>
        <ul>
            <li><a href="#home">Home</a></li>
            <li><a href="#about">About</a></li>
            <li><a href="#skills">Skills</a></li>
            <li><a href="#education">Education</a></li>
            <li><a href="#experience">Experience</a></li>
            <li><a href="#projects">Projects</a></li>
            <li><a href="#contact">Contact</a></li>
        </ul>
    </nav>
    <section id="home">
        <h1>${personalInfo.name || 'Your Name'}</h1>
        <p class="subtitle">${personalInfo.title || 'Professional Title'}</p>
        <p style="max-width: 600px;">${personalInfo.bio || 'Welcome to my portfolio'}</p>
        <div class="social-links">
            ${personalInfo.linkedin ? `<a href="${personalInfo.linkedin}" target="_blank" rel="noopener noreferrer"><i class="fab fa-linkedin"></i></a>` : ''}
            ${personalInfo.github ? `<a href="${personalInfo.github}" target="_blank" rel="noopener noreferrer"><i class="fab fa-github"></i></a>` : ''}
            <a href="mailto:${personalInfo.email || ''}"><i class="fas fa-envelope"></i></a>
        </div>
    </section>
    <section id="about">
        <h2>About Me</h2>
        <p style="font-size: 1.1rem; line-height: 1.8;">${personalInfo.bio || ''}</p>
    </section>
    <section id="skills">
        <h2>Skills (${skills.length})</h2>
        ${skills.length > 0 ? `<div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">${skills.map(s => `<span class="tag">${s}</span>`).join('')}</div>` : '<p>No skills yet</p>'}
    </section>
    <section id="education">
        <h2>Education (${education.length})</h2>
        ${education.length > 0 ? `<div class="content-grid">${education.map(e => `<div class="card"><h3>${e.degree || ''}${e.field ? ' in ' + e.field : ''}</h3><p>${e.institution || ''}</p><p style="color: ${accentColor};">${e.graduationYear || ''} ${e.gpa ? '• GPA: ' + e.gpa : ''}</p></div>`).join('')}</div>` : '<p>No education yet</p>'}
    </section>
    <section id="experience">
        <h2>Experience (${experience.length})</h2>
        ${experience.length > 0 ? `<div class="content-grid">${experience.map(e => `<div class="card"><h3>${e.position || ''}</h3><p>${e.company || ''}</p><p style="color: ${accentColor};">${e.startDate || ''} - ${e.endDate || ''}</p><p style="margin-top: 0.5rem;">${e.description || ''}</p></div>`).join('')}</div>` : '<p>No experience yet</p>'}
    </section>
    <section id="projects">
        <h2>Projects (${projects.length})</h2>
        ${projects.length > 0 ? `<div class="content-grid">${projects.map(p => `<div class="card"><h3>${p.name || ''}</h3><p>${p.description || ''}</p><p style="color: ${accentColor}; margin-top: 1rem;"><strong>Tech:</strong> ${p.technologies || ''}</p><div class="links">${p.link ? `<a href="${p.link}" target="_blank" rel="noopener noreferrer">Live</a>` : ''} ${p.github ? `<a href="${p.github}" target="_blank" rel="noopener noreferrer">GitHub</a>` : ''}</div></div>`).join('')}</div>` : '<p>No projects yet</p>'}
    </section>
    <section id="contact">
        <h2>Contact</h2>
        <p><i class="fas fa-envelope"></i> <a href="mailto:${personalInfo.email || ''}" style="color: ${accentColor};">${personalInfo.email || ''}</a></p>
        ${personalInfo.phone ? `<p style="margin-top: 0.5rem;"><i class="fas fa-phone"></i> ${personalInfo.phone}</p>` : ''}
    </section>
    <script>document.querySelectorAll('a[href^="#"]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); document.querySelector(a.getAttribute('href'))?.scrollIntoView({ behavior: 'smooth' }); }));</script>
</body>
</html>`;
}

// USP 3: Redesign Portfolio (PRESERVE ALL CONTENT)
router.post('/redesign', authMiddleware, async (req, res) => {
    try {
        const { originalUrl, analysisData, redesignInstructions } = req.body;
        const userId = req.user._id;

        const scrapedData = analysisData.scrapedData || {};

        // Build comprehensive content from scraped data
        const content = {
            name: scrapedData.name || 'Portfolio Owner',
            title: scrapedData.title || 'Professional',
            bio: scrapedData.bio || (scrapedData.sections?.about || 'Passionate professional with diverse skills and experience.'),
            email: scrapedData.email || 'contact@example.com',
            phone: scrapedData.phone || '',
            linkedin: scrapedData.linkedin || '',
            github: scrapedData.github || '',
            skills: scrapedData.skills || [],
            projects: scrapedData.projects || [],
            experience: scrapedData.experience || [],
            education: scrapedData.education || []
        };

        const prompt = `You are an expert web designer. Redesign this portfolio with a NEW DESIGN STYLE but keep ALL the original content.

ORIGINAL PORTFOLIO URL: ${originalUrl}

ORIGINAL CONTENT (PRESERVE EXACTLY):
Name: ${content.name}
Title: ${content.title}
Bio: ${content.bio}
Email: ${content.email}
${content.phone ? 'Phone: ' + content.phone : ''}
${content.linkedin ? 'LinkedIn: ' + content.linkedin : ''}
${content.github ? 'GitHub: ' + content.github : ''}

Skills (INCLUDE ALL): ${content.skills.join(', ') || 'Various technical skills'}

Projects (INCLUDE ALL ${content.projects.length}):
${content.projects.map((p, i) => `${i + 1}. ${p.name || 'Project ' + (i + 1)}: ${p.description || 'No description'}`).join('\n')}

Experience:
${content.experience?.length > 0 ? content.experience.map(e => `${e.position} at ${e.company}: ${e.description || ''}`).join('\n') : 'Various professional experiences'}

Education:
${content.education?.length > 0 ? content.education.map(e => `${e.degree} from ${e.institution}`).join('\n') : 'Educational background'}

USER'S REDESIGN INSTRUCTIONS (ONLY CHANGE DESIGN/STYLE):
"${redesignInstructions}"

CRITICAL REQUIREMENTS:
1. Generate ONE complete HTML file with smooth navigation
2. KEEP ALL ORIGINAL CONTENT - name, bio, projects, skills, experience exactly as provided above
3. ONLY CHANGE the design elements based on redesign instructions:
   - Colors and color scheme
   - Layout and spacing
   - Typography and fonts
   - Animations and effects
   - Overall visual style
4. Include sections: Home, About, Skills, Experience, Projects, Contact
5. Make it fully responsive and modern
6. MATCH DESIGN VISION EXACTLY - if they specify layout structure, implement it
7. ALL navigation and external links must have target="_blank" rel="noopener noreferrer"
8. Use Font Awesome CDN for icons
9. Use Google Fonts for typography

Return ONLY the complete HTML code. No explanations, just pure HTML.`;

        let generatedHTML = await callGroqAPI(prompt, 8000);
        generatedHTML = generatedHTML.replace(/```html\n?/g, '').replace(/```\n?/g, '').trim();

        // If AI fails, use fallback with original content
        if (!generatedHTML.includes('<!DOCTYPE')) {
            generatedHTML = generateGuaranteedHTML(
                {
                    name: content.name,
                    title: content.title,
                    bio: content.bio,
                    email: content.email,
                    phone: content.phone,
                    linkedin: content.linkedin,
                    github: content.github
                },
                content.skills,
                content.education,
                content.experience,
                content.projects,
                redesignInstructions
            );
        }

        // Ensure all external links have target="_blank"
        generatedHTML = ensureExternalLinksOpenNewTab(generatedHTML);

        // Save redesigned portfolio
        const portfolio = new Portfolio({
            userId,
            personalInfo: {
                name: content.name,
                title: content.title,
                bio: content.bio,
                email: content.email,
                phone: content.phone,
                linkedin: content.linkedin,
                github: content.github
            },
            skills: content.skills,
            projects: content.projects,
            experience: content.experience,
            education: content.education,
            designVision: redesignInstructions,
            generatedHTML,
            shareableLink: `https://portfolio-${userId}-${Date.now()}.netlify.app`,
            isRedesign: true,
            originalUrl
        });

        await portfolio.save();

        res.status(201).json({
            message: 'Portfolio redesigned successfully with original content preserved',
            portfolioId: portfolio._id
        });
    } catch (error) {
        console.error('Redesign error:', error);
        res.status(500).json({
            message: 'Failed to redesign portfolio',
            error: error.message
        });
    }
});

// Get user's portfolios
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

// Get single portfolio
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

// ===========================================
// FIX 2: RESUME GENERATION (Shows ALL Data)
// ===========================================
router.get('/:id/resume', authMiddleware, async (req, res) => {
    try {
        const portfolio = await Portfolio.findById(req.params.id);

        if (!portfolio) {
            return res.status(404).json({ message: 'Portfolio not found' });
        }

        console.log('📄 GENERATING RESUME - DATA FROM DATABASE:');
        console.log('Personal Info:', portfolio.personalInfo);
        console.log('Skills:', portfolio.skills?.length, 'items');
        console.log('Education:', portfolio.education?.length, 'items');
        console.log('Experience:', portfolio.experience?.length, 'items');
        console.log('Projects:', portfolio.projects?.length, 'items');

        const resumeHTML = generateResumeHTML(portfolio);

        console.log('✅ RESUME HTML GENERATED');
        console.log('- Contains skills:', resumeHTML.includes('Technical Skills'));
        console.log('- Contains education:', resumeHTML.includes('Education'));
        console.log('- Contains experience:', resumeHTML.includes('Work Experience'));
        console.log('- Contains projects:', resumeHTML.includes('Projects'));

        res.setHeader('Content-Type', 'text/html');
        res.send(resumeHTML);
    } catch (error) {
        console.error('❌ Resume generation error:', error);
        res.status(500).json({ message: 'Failed to generate resume', error: error.message });
    }
});

// RESUME HTML GENERATOR (GUARANTEED TO SHOW ALL DATA)
function generateResumeHTML(portfolio) {
    const { personalInfo, skills, education, experience, projects } = portfolio;

    const safePersonalInfo = personalInfo || {};
    const safeSkills = Array.isArray(skills) ? skills : [];
    const safeEducation = Array.isArray(education) ? education : [];
    const safeExperience = Array.isArray(experience) ? experience : [];
    const safeProjects = Array.isArray(projects) ? projects : [];

    console.log('📋 Resume data counts:', {
        skills: safeSkills.length,
        education: safeEducation.length,
        experience: safeExperience.length,
        projects: safeProjects.length
    });

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${safePersonalInfo.name || 'Resume'} - Resume</title>
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
        }
        .contact a {
            color: #2563eb;
            text-decoration: none;
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
    <!-- HEADER SECTION -->
    <header>
        <h1>${safePersonalInfo.name || 'Your Name'}</h1>
        <div class="title">${safePersonalInfo.title || 'Professional Title'}</div>
        <div class="contact">
            ${safePersonalInfo.email || 'email@example.com'}
            ${safePersonalInfo.phone ? ' • ' + safePersonalInfo.phone : ''}
            ${safePersonalInfo.linkedin ? ' • <a href="' + safePersonalInfo.linkedin + '" target="_blank">LinkedIn</a>' : ''}
            ${safePersonalInfo.github ? ' • <a href="' + safePersonalInfo.github + '" target="_blank">GitHub</a>' : ''}
        </div>
    </header>

    <!-- PROFESSIONAL SUMMARY -->
    ${safePersonalInfo.bio ? `
    <section>
        <h2>Professional Summary</h2>
        <p>${safePersonalInfo.bio}</p>
    </section>
    ` : ''}

    <!-- TECHNICAL SKILLS -->
    <section>
        <h2>Technical Skills</h2>
        ${safeSkills.length > 0 ? `
            <div class="skills-container">
                ${safeSkills.map(skill => `<span class="skill-tag">${skill}</span>`).join('')}
            </div>
        ` : '<p class="empty-message">No skills added yet</p>'}
    </section>

    <!-- EDUCATION -->
    <section>
        <h2>Education</h2>
        ${safeEducation.length > 0 ? `
            ${safeEducation.map(edu => `
            <div class="item">
                <div class="item-header">
                    <div>
                        <div class="item-title">${edu.degree || 'Degree'}${edu.field ? ' in ' + edu.field : ''}</div>
                        <div class="item-subtitle">${edu.institution || 'Institution'}</div>
                        ${edu.gpa ? `<div style="color: #666; font-size: 14px; margin-top: 4px;">GPA: ${edu.gpa}</div>` : ''}
                    </div>
                    <div class="item-date">${edu.graduationYear || ''}</div>
                </div>
            </div>
            `).join('')}
        ` : '<p class="empty-message">No education entries added yet</p>'}
    </section>

    <!-- WORK EXPERIENCE -->
    <section>
        <h2>Work Experience</h2>
        ${safeExperience.length > 0 ? `
            ${safeExperience.map(exp => `
            <div class="item">
                <div class="item-header">
                    <div>
                        <div class="item-title">${exp.position || 'Position'}</div>
                        <div class="item-subtitle">${exp.company || 'Company'}</div>
                    </div>
                    <div class="item-date">${exp.startDate || ''} - ${exp.endDate || 'Present'}</div>
                </div>
                ${exp.description ? `<div class="item-description">${exp.description}</div>` : ''}
            </div>
            `).join('')}
        ` : '<p class="empty-message">No work experience added yet</p>'}
    </section>

    <!-- PROJECTS -->
    <section>
        <h2>Projects</h2>
        ${safeProjects.length > 0 ? `
            ${safeProjects.map(proj => `
            <div class="item">
                <div class="item-title">${proj.name || 'Project Name'}</div>
                ${proj.description ? `<div class="item-description">${proj.description}</div>` : ''}
                ${proj.technologies ? `<div class="item-description"><strong>Technologies:</strong> ${proj.technologies}</div>` : ''}
                <div class="project-links">
                    ${proj.link ? `<a href="${proj.link}" target="_blank">🔗 Live Demo</a>` : ''}
                    ${proj.github ? `<a href="${proj.github}" target="_blank">💻 GitHub</a>` : ''}
                </div>
            </div>
            `).join('')}
        ` : '<p class="empty-message">No projects added yet</p>'}
    </section>
</body>
</html>`;
}

// Deploy endpoints
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
