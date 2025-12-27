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

// CREATE PORTFOLIO - FORCE AI TO INCLUDE ALL DATA
router.post('/create', authMiddleware, async (req, res) => {
    try {
        const { personalInfo, skills, education, experience, projects, designVision } = req.body;
        const userId = req.user._id;

        if (!personalInfo?.name || !personalInfo?.title || !designVision) {
            return res.status(400).json({
                message: 'Missing required fields'
            });
        }

        // Build detailed data strings
        const skillsList = skills && skills.length > 0 ? skills.join(', ') : 'HTML, CSS, JavaScript';

        const educationList = education && education.length > 0
            ? education.map(e => `${e.degree} in ${e.field} from ${e.institution} (${e.graduationYear})`).join('\n')
            : 'Bachelor of Technology in Computer Science from University (2024)';

        const experienceList = experience && experience.length > 0
            ? experience.map(e => `${e.position} at ${e.company} (${e.startDate} - ${e.endDate})\n${e.description}`).join('\n\n')
            : 'Software Developer Intern at Tech Company (Jan 2023 - Jun 2023)\nWorked on web development projects';

        const projectsList = projects && projects.length > 0
            ? projects.map(p => `PROJECT: ${p.name}\nDESCRIPTION: ${p.description}\nTECH: ${p.technologies}\nLINK: ${p.link || 'N/A'}\nGITHUB: ${p.github || 'N/A'}`).join('\n\n')
            : 'PROJECT: Sample Project\nDESCRIPTION: A web application built with modern technologies\nTECH: React, Node.js, MongoDB';

        const prompt = `⚠️ CRITICAL REQUIREMENT: You MUST display EVERY SINGLE piece of data listed below. DO NOT omit, truncate, or hide ANY data.

Create a complete portfolio website following this design vision:
"${designVision}"

📋 USER DATA - DISPLAY ALL OF THIS EXACTLY AS PROVIDED:

===== PERSONAL INFO (MANDATORY) =====
Name: ${personalInfo.name}
Title: ${personalInfo.title}
Bio: ${personalInfo.bio}
Email: ${personalInfo.email}
Phone: ${personalInfo.phone || 'Not provided'}
LinkedIn: ${personalInfo.linkedin || 'Not provided'}
GitHub: ${personalInfo.github || 'Not provided'}

===== SKILLS - DISPLAY ALL ${skills?.length || 0} SKILLS =====
${skillsList}
⚠️ YOU MUST SHOW ALL ${skills?.length || 0} SKILLS - NO EXCEPTIONS

===== EDUCATION - DISPLAY ALL ${education?.length || 0} ENTRIES =====
${educationList}
⚠️ YOU MUST SHOW ALL ${education?.length || 0} EDUCATION ENTRIES - NO EXCEPTIONS

===== EXPERIENCE - DISPLAY ALL ${experience?.length || 0} ENTRIES =====
${experienceList}
⚠️ YOU MUST SHOW ALL ${experience?.length || 0} WORK EXPERIENCES - NO EXCEPTIONS

===== PROJECTS - DISPLAY ALL ${projects?.length || 0} PROJECTS =====
${projectsList}
⚠️ YOU MUST SHOW ALL ${projects?.length || 0} PROJECTS - NO EXCEPTIONS

🎯 MANDATORY STRUCTURE (IN THIS ORDER):
1. HERO/HOME SECTION:
   - Display: ${personalInfo.name}
   - Display: ${personalInfo.title}
   - Display: ${personalInfo.bio}
   - Social icons for: Email, ${personalInfo.linkedin ? 'LinkedIn, ' : ''}${personalInfo.github ? 'GitHub, ' : ''}${personalInfo.phone ? 'Phone' : ''}

2. ABOUT SECTION:
   - Full bio text: ${personalInfo.bio}

3. SKILLS SECTION:
   - Title: "Technical Skills" or "Skills"
   - Display ALL ${skills?.length || 0} skills as badges/tags/cards
   - Skills to show: ${skillsList}

4. EDUCATION SECTION:
   - Title: "Education"
   - Show ALL ${education?.length || 0} entries
   - Each entry must show: Degree, Field, Institution, Year

5. EXPERIENCE SECTION:
   - Title: "Work Experience" or "Experience"
   - Show ALL ${experience?.length || 0} entries
   - Each entry must show: Position, Company, Dates, Full Description

6. PROJECTS SECTION:
   - Title: "Projects"
   - Show ALL ${projects?.length || 0} projects
   - Each project must show: Name, Description, Technologies, Links

7. CONTACT SECTION:
   - Email: ${personalInfo.email}
   - Phone: ${personalInfo.phone || 'N/A'}
   - LinkedIn link (if provided)
   - GitHub link (if provided)

🔧 TECHNICAL REQUIREMENTS:
✅ ONE complete HTML file with embedded <style> and <script>
✅ Fixed navigation bar with smooth scroll
✅ Navigation links use href="#section" (NO target="_blank" on nav)
✅ External links (LinkedIn, GitHub, project URLs) MUST have target="_blank" rel="noopener noreferrer"
✅ Fully responsive (mobile, tablet, desktop)
✅ Font Awesome CDN: https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css
✅ Google Fonts for typography
✅ Follow design vision for colors, animations, layout style
✅ NO placeholder content - use ACTUAL data above

📝 EXAMPLE CODE STRUCTURE:
<section id="skills">
  <h2>Technical Skills</h2>
  <div class="skills-grid">
    ${skills?.map(s => `<div class="skill-tag">${s}</div>`).join('\n    ') || '<div class="skill-tag">Sample Skill</div>'}
  </div>
</section>

<section id="projects">
  <h2>Projects</h2>
  <div class="projects-grid">
    ${projects?.map(p => `
    <div class="project-card">
      <h3>${p.name}</h3>
      <p>${p.description}</p>
      <p>Tech: ${p.technologies}</p>
      ${p.link ? `<a href="${p.link}" target="_blank" rel="noopener noreferrer">View Live</a>` : ''}
      ${p.github ? `<a href="${p.github}" target="_blank" rel="noopener noreferrer">GitHub</a>` : ''}
    </div>`).join('\n    ') || '<div class="project-card"><h3>Sample Project</h3></div>'}
  </div>
</section>

⚠️ FINAL VERIFICATION CHECKLIST:
□ Hero shows: ${personalInfo.name}, ${personalInfo.title}, ${personalInfo.bio}
□ About shows: Full bio
□ Skills shows: ALL ${skills?.length || 0} skills
□ Education shows: ALL ${education?.length || 0} entries
□ Experience shows: ALL ${experience?.length || 0} entries
□ Projects shows: ALL ${projects?.length || 0} projects
□ Contact shows: Email, phone, social links

Return ONLY the complete HTML code. No markdown formatting, no explanations.`;

        // TEMPORARY FIX: Skip AI and use guaranteed fallback to ensure data accuracy
        // The AI sometimes generates its own content instead of using user data
        console.log('🎨 Generating portfolio with guaranteed fallback HTML');
        let generatedHTML = generateCompletePortfolio(personalInfo, skills, education, experience, projects, designVision);

        /* ORIGINAL AI CODE - Disabled temporarily
        let generatedHTML = await callGroqAPI(prompt, 8000);
        generatedHTML = generatedHTML.replace(/```html\n?/g, '').replace(/```\n?/g, '').trim();

        // If AI fails, use guaranteed fallback
        if (!generatedHTML.includes('<!DOCTYPE') && !generatedHTML.includes('<html')) {
            console.log('⚠️ AI generation failed, using guaranteed fallback');
            generatedHTML = generateCompletePortfolio(personalInfo, skills, education, experience, projects, designVision);
        }
        */

        // Ensure external links open in new tabs
        generatedHTML = ensureExternalLinksOpenNewTab(generatedHTML);

        console.log('✅ Portfolio HTML generated successfully');
        console.log('📊 Data included:', {
            name: personalInfo.name,
            skills: skills?.length || 0,
            education: education?.length || 0,
            experience: experience?.length || 0,
            projects: projects?.length || 0
        });

        const portfolio = new Portfolio({
            userId,
            personalInfo,
            skills: skills || [],
            education: education || [],
            experience: experience || [],
            projects: projects || [],
            designVision,
            generatedHTML,
            shareableLink: `https://portfolio-${userId}-${Date.now()}.netlify.app`,
            isRedesign: false
        });

        await portfolio.save();

        res.status(201).json({
            message: 'Portfolio created successfully',
            portfolioId: portfolio._id
        });
    } catch (error) {
        console.error('❌ Portfolio creation error:', error);
        res.status(500).json({
            message: 'Failed to create portfolio',
            error: error.message
        });
    }
});

// GUARANTEED FALLBACK - SHOWS ALL DATA
function generateCompletePortfolio(personalInfo, skills, education, experience, projects, designVision) {
    const isDark = designVision?.toLowerCase().includes('dark');
    const bgColor = isDark ? '#0f172a' : '#ffffff';
    const textColor = isDark ? '#e2e8f0' : '#1e293b';

    // Determine accent color from vision
    let accentColor = '#9333ea'; // default purple
    if (designVision?.toLowerCase().includes('blue')) accentColor = '#3b82f6';
    else if (designVision?.toLowerCase().includes('green')) accentColor = '#10b981';
    else if (designVision?.toLowerCase().includes('red')) accentColor = '#ef4444';
    else if (designVision?.toLowerCase().includes('orange')) accentColor = '#f97316';
    else if (designVision?.toLowerCase().includes('pink')) accentColor = '#ec4899';

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
            background: ${isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)'};
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
    html = html.replace(/<a\s+href="(?!#|mailto:|tel:)([^"]+)"(?!\s+target)/gi, '<a href="$1" target="_blank" rel="noopener noreferrer"');
    return html;
}

// REDESIGN - PRESERVE ALL DATA
router.post('/redesign', authMiddleware, async (req, res) => {
    try {
        const { originalUrl, analysisData, redesignInstructions } = req.body;
        const userId = req.user._id;

        console.log('🔄 REDESIGN REQUEST:');
        console.log('Original URL:', originalUrl);
        console.log('Redesign Instructions:', redesignInstructions);

        const scrapedData = analysisData.scrapedData || {};

        console.log('📊 SCRAPED DATA RECEIVED:');
        console.log('Name:', scrapedData.name);
        console.log('Title:', scrapedData.title);
        console.log('Bio:', scrapedData.bio?.substring(0, 50) + '...');
        console.log('Email:', scrapedData.email);
        console.log('Skills:', scrapedData.skills?.length || 0, 'items');
        console.log('Projects:', scrapedData.projects?.length || 0, 'items');
        console.log('Experience:', scrapedData.experience?.length || 0, 'items');
        console.log('Education:', scrapedData.education?.length || 0, 'items');

        const content = {
            name: scrapedData.name || 'Portfolio Owner',
            title: scrapedData.title || 'Professional',
            bio: scrapedData.bio || 'Professional with diverse experience',
            email: scrapedData.email || 'contact@example.com',
            phone: scrapedData.phone || '',
            linkedin: scrapedData.linkedin || '',
            github: scrapedData.github || '',
            skills: scrapedData.skills || [],
            projects: scrapedData.projects || [],
            experience: scrapedData.experience || [],
            education: scrapedData.education || []
        };

        const prompt = `⚠️ CRITICAL: Redesign portfolio keeping ALL content EXACTLY. Change ONLY design/colors/style.

CONTENT TO PRESERVE (DO NOT CHANGE):
Name: ${content.name}
Title: ${content.title}
Bio: ${content.bio}
Skills (${content.skills.length}): ${content.skills.join(', ')}
Projects (${content.projects.length}): ${content.projects.map(p => p.name).join(', ')}
Experience (${content.experience.length}): ${content.experience.map(e => e.position).join(', ')}
Education (${content.education.length}): ${content.education.map(e => e.degree).join(', ')}

REDESIGN INSTRUCTIONS (ONLY CHANGE DESIGN):
"${redesignInstructions}"

YOU MUST:
✅ Keep ALL ${content.skills.length} skills
✅ Keep ALL ${content.projects.length} projects
✅ Keep ALL ${content.experience.length} experiences
✅ Keep ALL ${content.education.length} education entries
✅ Only change: colors, fonts, layout, animations, spacing

Generate complete HTML showing ALL content with new design.`;

        // TEMPORARY FIX: Skip AI and use guaranteed fallback to ensure data accuracy
        console.log('🎨 Redesigning portfolio with guaranteed fallback HTML');
        console.log('📊 Scraped data:', {
            name: content.name,
            skills: content.skills.length,
            education: content.education.length,
            experience: content.experience.length,
            projects: content.projects.length
        });

        let generatedHTML = generateCompletePortfolio(
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

        /* ORIGINAL AI CODE - Disabled temporarily
        let generatedHTML = await callGroqAPI(prompt, 8000);
        generatedHTML = generatedHTML.replace(/```html\n?/g, '').replace(/```\n?/g, '').trim();

        if (!generatedHTML.includes('<!DOCTYPE')) {
            generatedHTML = generateCompletePortfolio(
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
        */

        generatedHTML = ensureExternalLinksOpenNewTab(generatedHTML);

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
            res.send(pdfBuffer);
        } catch (pdfError) {
            console.log('PDF generation failed, sending HTML:', pdfError.message);
            res.setHeader('Content-Type', 'text/html');
            res.setHeader('Content-Disposition', `attachment; filename="${portfolio.personalInfo.name || 'Resume'}.html"`);
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
    <!-- HEADER -->
    <header>
        <h1>${personalInfo.name || 'Your Name'}</h1>
        <div class="title">${personalInfo.title || 'Professional Title'}</div>
        <div class="contact">
            ${personalInfo.email || 'email@example.com'}
            ${personalInfo.phone ? ' • ' + personalInfo.phone : ''}
            ${personalInfo.linkedin ? ' • <a href="' + personalInfo.linkedin + '" target="_blank">LinkedIn</a>' : ''}
            ${personalInfo.github ? ' • <a href="' + personalInfo.github + '" target="_blank">GitHub</a>' : ''}
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
            ${skills.map(skill => `<span class="skill-tag">${skill}</span>`).join('')}
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
    </section>` : ''}${projects && projects.length > 0 ? `
    <!-- PROJECTS -->
    <section>
        <h2>Projects</h2>
        ${projects.map(proj => `
        <div class="item">
            <div class="item-title">${proj.name || 'Project Name'}</div>
            ${proj.description ? `<div class="item-description">${proj.description}</div>` : ''}
            ${proj.technologies ? `<div class="item-description"><strong>Technologies:</strong> ${proj.technologies}</div>` : ''}
            <div class="project-links">
                ${proj.link ? `<a href="${proj.link}" target="_blank">🔗 Live Demo</a>` : ''}
                ${proj.github ? `<a href="${proj.github}" target="_blank">💻 GitHub</a>` : ''}
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
