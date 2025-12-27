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

// USP 4: Generate Portfolio with Custom Structure (FIXED)
router.post('/create', authMiddleware, async (req, res) => {
  try {
    const { personalInfo, skills, education, experience, projects, designVision } = req.body;
    const userId = req.user._id;

    // Validate required fields
    if (!personalInfo?.name || !personalInfo?.title || !designVision) {
      return res.status(400).json({
        message: 'Missing required fields: name, title, or design vision'
      });
    }

    const prompt = `Generate a complete single-page portfolio website with smooth navigation. Must be ONE complete HTML file.

DESIGN VISION (FOLLOW THIS EXACTLY - CHANGE LAYOUT/STRUCTURE IF REQUESTED): 
"${designVision}"

IMPORTANT: If the user mentions specific layout preferences like "grid layout", "vertical timeline", "cards", "minimal single column", etc., implement that exact structure. If they say "modern", "creative", "professional" without specific layout, use your best judgment for an appropriate structure.

PERSONAL INFO:
Name: ${personalInfo.name}
Title: ${personalInfo.title}
Bio: ${personalInfo.bio}
Email: ${personalInfo.email}
${personalInfo.phone ? `Phone: ${personalInfo.phone}` : ''}
${personalInfo.linkedin ? `LinkedIn: ${personalInfo.linkedin}` : ''}
${personalInfo.github ? `GitHub: ${personalInfo.github}` : ''}

SKILLS: ${skills.join(', ')}

EDUCATION:
${education.map(e => `${e.degree} in ${e.field}, ${e.institution} (${e.graduationYear})`).join('\n')}

EXPERIENCE:
${experience.map(e => `${e.position} at ${e.company} (${e.startDate} - ${e.endDate}): ${e.description}`).join('\n')}

PROJECTS:
${projects.map(p => `${p.name}: ${p.description}. Technologies: ${p.technologies}. ${p.link ? 'Link: ' + p.link : ''} ${p.github ? 'GitHub: ' + p.github : ''}`).join('\n')}

CRITICAL REQUIREMENTS:
1. ONE complete HTML file with CSS and JS embedded
2. Sections: Hero/Home, About, Skills, Experience, Projects, Contact
3. Fixed navigation bar with smooth scroll - ALL nav links must have target="_blank" rel="noopener noreferrer" to open in new tabs
4. Fully responsive design (mobile, tablet, desktop)
5. Match design vision EXACTLY - if they specify layout structure, implement it
6. Use Font Awesome CDN: https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css
7. Use Google Fonts CDN for typography
8. NO placeholder images - use gradients/colors/icons
9. Modern, professional, clean code
10. ALL content properly displayed
11. Social links (LinkedIn, GitHub, Email) must open in new tabs with target="_blank"
12. Project links must open in new tabs with target="_blank"

NAVIGATION LINKS EXAMPLE:
<nav>
  <a href="#home">Home</a>
  <a href="#about">About</a>
  <a href="#skills">Skills</a>
  <a href="#experience">Experience</a>
  <a href="#projects">Projects</a>
  <a href="#contact">Contact</a>
</nav>

EXTERNAL LINKS EXAMPLE:
<a href="${personalInfo.linkedin}" target="_blank" rel="noopener noreferrer"><i class="fab fa-linkedin"></i></a>
<a href="${personalInfo.github}" target="_blank" rel="noopener noreferrer"><i class="fab fa-github"></i></a>
<a href="${projects[0]?.link}" target="_blank" rel="noopener noreferrer">View Project</a>

Return ONLY the HTML code, no explanations, no markdown.`;

    let generatedHTML = await callGroqAPI(prompt, 8000);

    // Clean up markdown formatting
    generatedHTML = generatedHTML
      .replace(/```html\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    // If HTML doesn't start with <!DOCTYPE, use fallback
    if (!generatedHTML.includes('<!DOCTYPE') && !generatedHTML.includes('<html')) {
      generatedHTML = generateFallbackHTML(personalInfo, skills, education, experience, projects, designVision);
    }

    // Ensure all external links have target="_blank"
    generatedHTML = ensureExternalLinksOpenNewTab(generatedHTML);

    // Save to database
    const portfolio = new Portfolio({
      userId,
      personalInfo,
      skills,
      education,
      experience,
      projects,
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
    console.error('Portfolio creation error:', error);
    res.status(500).json({
      message: 'Failed to create portfolio',
      error: error.message
    });
  }
});

// Helper function to ensure external links open in new tabs
function ensureExternalLinksOpenNewTab(html) {
  // Add target="_blank" to links that don't start with #
  html = html.replace(/<a\s+href="(?!#)([^"]+)"(?!\s+target)/gi, '<a href="$1" target="_blank" rel="noopener noreferrer"');
  return html;
}

// Fallback HTML generator if AI fails
// Fallback HTML generator if AI fails
function generateFallbackHTML(personalInfo, skills, education, experience, projects, designVision) {
  const isDark = designVision.toLowerCase().includes('dark');
  const bgColor = isDark ? '#0f172a' : '#ffffff';
  const textColor = isDark ? '#e2e8f0' : '#1e293b';
  const accentColor = designVision.toLowerCase().includes('purple') ? '#9333ea' :
    designVision.toLowerCase().includes('blue') ? '#3b82f6' :
      designVision.toLowerCase().includes('green') ? '#10b981' : '#9333ea';

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${personalInfo.name} - Portfolio</title>
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
            background: ${bgColor};
            color: ${textColor};
            line-height: 1.6;
        }
        
        /* Navigation */
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
        
        nav a:hover {
            color: ${accentColor};
        }
        
        /* Sections */
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
            color: ${accentColor};
        }
        
        h2 {
            font-size: 2.5rem;
            font-weight: 600;
            margin-bottom: 2rem;
            color: ${accentColor};
        }
        
        h3 {
            font-size: 1.5rem;
            font-weight: 600;
            color: ${accentColor};
            margin-bottom: 0.5rem;
        }
        
        /* Hero Section */
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
            font-size: 1.5rem;
            margin-top: 2rem;
        }
        
        .social-links a {
            color: ${textColor};
            transition: color 0.3s, transform 0.3s;
        }
        
        .social-links a:hover {
            color: ${accentColor};
            transform: scale(1.2);
        }
        
        /* Skills */
        .skills-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
            gap: 1rem;
        }
        
        .skill-tag {
            background: ${accentColor};
            color: white;
            padding: 0.75rem 1.5rem;
            border-radius: 25px;
            text-align: center;
            font-weight: 500;
            transition: transform 0.3s;
        }
        
        .skill-tag:hover {
            transform: translateY(-5px);
        }
        
        /* Projects */
        .projects-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 2rem;
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
        
        .project-card h3 {
            color: ${accentColor};
            margin-bottom: 1rem;
        }
        
        .project-links {
            display: flex;
            gap: 1rem;
            margin-top: 1rem;
        }
        
        .project-links a {
            color: ${accentColor};
            text-decoration: none;
            font-weight: 500;
        }
        
        .project-links a:hover {
            text-decoration: underline;
        }
        
        /* Experience & Education */
        .timeline-item {
            background: ${isDark ? '#1e293b' : '#f8fafc'};
            padding: 1.5rem;
            border-radius: 10px;
            margin-bottom: 1.5rem;
            border-left: 4px solid ${accentColor};
        }
        
        .timeline-item h3 {
            color: ${accentColor};
        }
        
        .timeline-meta {
            color: ${isDark ? '#94a3b8' : '#64748b'};
            font-size: 0.9rem;
            margin-bottom: 0.5rem;
        }
        
        /* Contact */
        .contact-info {
            display: flex;
            flex-direction: column;
            gap: 1rem;
            font-size: 1.2rem;
        }
        
        .contact-info a {
            color: ${accentColor};
            text-decoration: none;
            transition: transform 0.3s;
            display: inline-block;
        }
        
        .contact-info a:hover {
            transform: translateX(10px);
        }
        
        /* Responsive */
        @media (max-width: 768px) {
            h1 { font-size: 2.5rem; }
            h2 { font-size: 2rem; }
            nav ul { 
                flex-direction: column; 
                align-items: center; 
                gap: 1rem; 
            }
            section {
                padding: 5rem 1rem 1rem;
            }
        }
    </style>
</head>
<body>
    <nav>
        <ul>
            <li><a href="#home">Home</a></li>
            <li><a href="#about">About</a></li>
            <li><a href="#skills">Skills</a></li>
            <li><a href="#experience">Experience</a></li>
            <li><a href="#projects">Projects</a></li>
            <li><a href="#contact">Contact</a></li>
        </ul>
    </nav>

    <!-- Hero Section -->
    <section id="home">
        <h1>${personalInfo.name}</h1>
        <p class="subtitle">${personalInfo.title}</p>
        <p style="max-width: 600px;">${personalInfo.bio}</p>
        <div class="social-links">
            ${personalInfo.linkedin ? `<a href="${personalInfo.linkedin}" target="_blank" rel="noopener noreferrer" title="LinkedIn"><i class="fab fa-linkedin"></i></a>` : ''}
            ${personalInfo.github ? `<a href="${personalInfo.github}" target="_blank" rel="noopener noreferrer" title="GitHub"><i class="fab fa-github"></i></a>` : ''}
            <a href="mailto:${personalInfo.email}" title="Email"><i class="fas fa-envelope"></i></a>
            ${personalInfo.phone ? `<a href="tel:${personalInfo.phone}" title="Phone"><i class="fas fa-phone"></i></a>` : ''}
        </div>
    </section>

    <!-- About Section -->
    <section id="about">
        <h2>About Me</h2>
        <p style="font-size: 1.1rem; max-width: 800px; line-height: 1.8;">${personalInfo.bio}</p>
    </section>

    <!-- Skills Section -->
    <section id="skills">
        <h2>Technical Skills</h2>
        <div class="skills-grid">
            ${skills && skills.length > 0 ? skills.map(skill => `<div class="skill-tag">${skill}</div>`).join('') : '<p>Skills will be displayed here</p>'}
        </div>
    </section>

    <!-- Experience & Education Section -->
    <section id="experience">
        <h2>Experience & Education</h2>
        
        ${experience && experience.length > 0 ? `
        <h3 style="margin-top: 2rem; margin-bottom: 1rem;">Work Experience</h3>
        ${experience.map(exp => `
            <div class="timeline-item">
                <h3>${exp.position}</h3>
                <p class="timeline-meta">${exp.company} | ${exp.startDate} - ${exp.endDate}</p>
                <p>${exp.description}</p>
            </div>
        `).join('')}
        ` : ''}
        
        ${education && education.length > 0 ? `
        <h3 style="margin-top: 2rem; margin-bottom: 1rem;">Education</h3>
        ${education.map(edu => `
            <div class="timeline-item">
                <h3>${edu.degree}${edu.field ? ' in ' + edu.field : ''}</h3>
                <p class="timeline-meta">${edu.institution} | ${edu.graduationYear}</p>
            </div>
        `).join('')}
        ` : ''}
    </section>

    <!-- Projects Section -->
    <section id="projects">
        <h2>Projects</h2>
        <div class="projects-grid">
            ${projects && projects.length > 0 ? projects.map(proj => `
                <div class="project-card">
                    <h3>${proj.name}</h3>
                    <p>${proj.description}</p>
                    <p style="color: ${accentColor}; margin-top: 1rem; font-size: 0.9rem;"><strong>Tech Stack:</strong> ${proj.technologies}</p>
                    <div class="project-links">
                        ${proj.link ? `<a href="${proj.link}" target="_blank" rel="noopener noreferrer"><i class="fas fa-external-link-alt"></i> Live Demo</a>` : ''}
                        ${proj.github ? `<a href="${proj.github}" target="_blank" rel="noopener noreferrer"><i class="fab fa-github"></i> GitHub</a>` : ''}
                    </div>
                </div>
            `).join('') : '<p>Projects will be displayed here</p>'}
        </div>
    </section>

    <!-- Contact Section -->
    <section id="contact">
        <h2>Get In Touch</h2>
        <div class="contact-info">
            <p><i class="fas fa-envelope"></i> <a href="mailto:${personalInfo.email}">${personalInfo.email}</a></p>
            ${personalInfo.phone ? `<p><i class="fas fa-phone"></i> <a href="tel:${personalInfo.phone}">${personalInfo.phone}</a></p>` : ''}
            ${personalInfo.linkedin ? `<p><i class="fab fa-linkedin"></i> <a href="${personalInfo.linkedin}" target="_blank" rel="noopener noreferrer">LinkedIn Profile</a></p>` : ''}
            ${personalInfo.github ? `<p><i class="fab fa-github"></i> <a href="${personalInfo.github}" target="_blank" rel="noopener noreferrer">GitHub Profile</a></p>` : ''}
        </div>
    </section>

    <script>
        // Smooth scrolling for navigation links
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                e.preventDefault();
                const target = document.querySelector(this.getAttribute('href'));
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            });
        });
        
        // Active section highlighting
        const sections = document.querySelectorAll('section');
        const navLinks = document.querySelectorAll('nav a');
        
        window.addEventListener('scroll', () => {
            let current = '';
            sections.forEach(section => {
                const sectionTop = section.offsetTop;
                const sectionHeight = section.clientHeight;
                if (scrollY >= sectionTop - 200) {
                    current = section.getAttribute('id');
                }
            });
            
            navLinks.forEach(link => {
                link.style.color = '';
                if (link.getAttribute('href').slice(1) === current) {
                    link.style.color = '${accentColor}';
                }
            });
        });
    </script>
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
      generatedHTML = generateFallbackHTML(
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

// Download Resume as PDF
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

    // Try to generate PDF, fallback to HTML if puppeteer fails
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

function generateResumeHTML(portfolio) {
  const { personalInfo, skills, education, experience, projects } = portfolio;

  // Ensure we have data even if undefined
  const safePersonalInfo = personalInfo || {};
  const safeSkills = skills || [];
  const safeEducation = education || [];
  const safeExperience = experience || [];
  const safeProjects = projects || [];

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${safePersonalInfo.name || 'Resume'} - Resume</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Arial', sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 40px 20px;
        }
        header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 3px solid #2563eb;
            padding-bottom: 20px;
        }
        h1 {
            font-size: 32px;
            color: #1e40af;
            margin-bottom: 5px;
        }
        .title {
            font-size: 18px;
            color: #666;
            margin-bottom: 10px;
        }
        .contact {
            font-size: 14px;
            color: #666;
        }
        .contact a {
            color: #2563eb;
            text-decoration: none;
        }
        section {
            margin-bottom: 30px;
        }
        h2 {
            font-size: 20px;
            color: #1e40af;
            border-bottom: 2px solid #93c5fd;
            padding-bottom: 5px;
            margin-bottom: 15px;
        }
        .item {
            margin-bottom: 20px;
        }
        .item-header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 5px;
            flex-wrap: wrap;
        }
        .item-title {
            font-weight: bold;
            color: #1e40af;
        }
        .item-subtitle {
            color: #666;
            font-style: italic;
        }
        .item-date {
            color: #666;
            font-size: 14px;
        }
        .skills {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
        }
        .skill-tag {
            background: #dbeafe;
            color: #1e40af;
            padding: 5px 12px;
            border-radius: 15px;
            font-size: 14px;
        }
        @media print {
            body { padding: 0; }
        }
    </style>
</head>
<body>
    <header>
        <h1>${safePersonalInfo.name || 'Your Name'}</h1>
        <div class="title">${safePersonalInfo.title || 'Professional Title'}</div>
        <div class="contact">
            ${safePersonalInfo.email || 'email@example.com'}
            ${safePersonalInfo.phone ? ' • ' + safePersonalInfo.phone : ''}
            ${safePersonalInfo.linkedin ? ' • <a href="' + safePersonalInfo.linkedin + '">LinkedIn</a>' : ''}
            ${safePersonalInfo.github ? ' • <a href="' + safePersonalInfo.github + '">GitHub</a>' : ''}
        </div>
    </header>

    ${safePersonalInfo.bio ? `
    <section>
        <h2>Professional Summary</h2>
        <p>${safePersonalInfo.bio}</p>
    </section>
    ` : ''}

    ${safeSkills.length > 0 ? `
    <section>
        <h2>Technical Skills</h2>
        <div class="skills">
            ${safeSkills.map(skill => `<span class="skill-tag">${skill}</span>`).join('')}
        </div>
    </section>
    ` : ''}

    ${safeEducation.length > 0 ? `
    <section>
        <h2>Education</h2>
        ${safeEducation.map(edu => `
        <div class="item">
            <div class="item-header">
                <div>
                    <div class="item-title">${edu.degree || 'Degree'}${edu.field ? ' in ' + edu.field : ''}</div>
                    <div class="item-subtitle">${edu.institution || 'Institution'}</div>
                </div>
                <div class="item-date">${edu.graduationYear || ''}</div>
            </div>
        </div>
        `).join('')}
    </section>
    ` : ''}

    ${safeExperience.length > 0 ? `
    <section>
        <h2>Work Experience</h2>
        ${safeExperience.map(exp => `
        <div class="item">
            <div class="item-header">
                <div>
                    <div class="item-title">${exp.position || 'Position'}</div>
                    <div class="item-subtitle">${exp.company || 'Company'}</div>
                </div>
                <div class="item-date">${exp.startDate || ''} - ${exp.endDate || ''}</div>
            </div>
            ${exp.description ? `<p>${exp.description}</p>` : ''}
        </div>
        `).join('')}
    </section>
    ` : ''}

    ${safeProjects.length > 0 ? `
    <section>
        <h2>Projects</h2>
        ${safeProjects.map(proj => `
        <div class="item">
            <div class="item-title">${proj.name || 'Project'}</div>
            ${proj.description ? `<p>${proj.description}</p>` : ''}
            ${proj.technologies ? `<p><strong>Technologies:</strong> ${proj.technologies}</p>` : ''}
            ${proj.link ? `<p><a href="${proj.link}">View Project</a></p>` : ''}
            ${proj.github ? `<p><a href="${proj.github}">GitHub Repository</a></p>` : ''}
        </div>
        `).join('')}
    </section>
    ` : ''}
</body>
</html>`;
}

module.exports = router;
