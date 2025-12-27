const puppeteer = require('puppeteer');
const cheerio = require('cheerio');

class PortfolioScraper {
    constructor() {
        this.browser = null;
    }

    async initialize() {
        if (!this.browser) {
            this.browser = await puppeteer.launch({
                headless: 'new',
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
        }
        return this.browser;
    }

    async scrapePortfolio(url) {
        try {
            const browser = await this.initialize();
            const page = await browser.newPage();

            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

            // Navigate and check response status
            console.log(`🚀 Navigating to: ${url}`);
            let response;
            try {
                // Try networkidle2 first as it's the most thorough
                response = await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
            } catch (error) {
                console.warn(`⚠️ Navigation 'networkidle2' failed, falling back to 'load': ${error.message}`);
                try {
                    response = await page.goto(url, { waitUntil: 'load', timeout: 20000 });
                } catch (loadError) {
                    console.error(`❌ Navigation 'load' also failed: ${loadError.message}`);
                    throw new Error(`Failed to connect to the portfolio: ${loadError.message}`);
                }
            }

            if (!response) {
                throw new Error('No response from the server. The site might be down or blocking us.');
            }

            console.log(`📡 Status: ${response.status()}`);

            // Check if page returned 404 or other error
            if (response.status() === 404) {
                await page.close();
                throw new Error('Page not found (404). Please check the URL and try again.');
            }

            if (response.status() >= 400) {
                await page.close();
                throw new Error(`Page returned error ${response.status()}. Please check the URL.`);
            }

            // Puppeteer v24+ fix for waitForTimeout
            await new Promise(resolve => setTimeout(resolve, 3000));

            const html = await page.content();
            console.log(`📄 Scraped HTML length: ${html.length}`);
            const $ = cheerio.load(html);

            // Detect common error pages
            const bodyText = $('body').text().toLowerCase();
            const errorIndicators = [
                'page not found',
                'site not found',
                '404',
                'broken link',
                "doesn't exist on netlify",
                'this page could not be found',
                'the page you are looking for',
                'error 404'
            ];

            const hasErrorIndicator = errorIndicators.some(indicator => bodyText.includes(indicator));

            if (hasErrorIndicator && bodyText.length < 1000) {
                await page.close();
                throw new Error('This appears to be an error page (404). Please enter a valid portfolio URL.');
            }

            // Extract name (from title, h1, or meta)
            const name = this.extractName($);

            // Extract title/role
            const title = this.extractTitle($);

            // Extract bio
            const bio = this.extractBio($);

            // Extract email
            const email = this.extractEmail($, html);

            // Extract headings
            const headings = [];
            $('h1, h2, h3').each((i, el) => {
                const text = $(el).text().trim();
                if (text) headings.push(text);
            });

            // Extract paragraphs
            const paragraphs = [];
            $('p').each((i, el) => {
                const text = $(el).text().trim();
                if (text && text.length > 20) paragraphs.push(text);
            });

            // Extract skills
            const skills = this.extractSkills($);

            // Extract projects (ENHANCED)
            const projects = this.extractProjects($, url);

            // Extract experience
            const experience = this.extractExperience($);

            // Extract education
            const education = this.extractEducation($);

            // Analyze design
            const designAnalysis = await this.analyzeDesign(page);

            await page.close();

            // Final validation - ensure we got some meaningful data
            if (!name || name === 'Portfolio Owner') {
                if (skills.length === 0 && projects.length === 0 && experience.length === 0) {
                    throw new Error('Could not extract portfolio data from this URL. Please ensure it\'s a valid portfolio website.');
                }
            }

            console.log('✅ Successfully scraped portfolio:');
            console.log('- Name:', name);
            console.log('- Skills:', skills.length);
            console.log('- Projects:', projects.length);
            console.log('- Experience:', experience.length);
            console.log('- Education:', education.length);

            return {
                url,
                name,
                title,
                bio,
                email,
                headings,
                paragraphs: paragraphs.slice(0, 10),
                skills,
                projects,
                experience,
                education,
                designAnalysis,
                sections: this.detectSections($, paragraphs, headings),
                scrapedAt: new Date().toISOString()
            };
        } catch (error) {
            console.error('Portfolio scraping error:', error);
            throw new Error(`Failed to scrape portfolio: ${error.message}`);
        }
    }

    extractName($) {
        // Try multiple methods to find name
        let name = $('title').text().split('-')[0].trim();

        if (!name || name.length > 50) {
            name = $('h1').first().text().trim();
        }

        if (!name || name.length > 50) {
            name = $('meta[property="og:title"]').attr('content');
        }

        return name || 'Portfolio Owner';
    }

    extractTitle($) {
        // Look for subtitle, role, or job title
        const subtitle = $('.subtitle, .role, .job-title, .tagline').first().text().trim();
        if (subtitle) return subtitle;

        // Check for patterns like "Full Stack Developer" after name
        const firstH1 = $('h1').first();
        const nextElement = firstH1.next('p, h2, .subtitle');
        if (nextElement.length) {
            const text = nextElement.text().trim();
            if (text.length < 100) return text;
        }

        return 'Professional';
    }

    extractBio($) {
        // Look for about section
        const aboutSection = $('#about, .about, [class*="about"]').find('p').first().text().trim();
        if (aboutSection && aboutSection.length > 30) return aboutSection;

        // Find longest paragraph (likely bio)
        let longestPara = '';
        $('p').each((i, el) => {
            const text = $(el).text().trim();
            if (text.length > longestPara.length && text.length > 50 && text.length < 500) {
                longestPara = text;
            }
        });

        return longestPara || 'Passionate professional with diverse skills and experience.';
    }

    extractEmail($, html) {
        // Look for email in mailto links
        const mailtoLink = $('a[href^="mailto:"]').first().attr('href');
        if (mailtoLink) return mailtoLink.replace('mailto:', '');

        // Search for email pattern in text
        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
        const matches = html.match(emailRegex);
        if (matches && matches.length > 0) return matches[0];

        return 'contact@example.com';
    }

    extractSkills($) {
        const skills = new Set();
        const techKeywords = [
            'javascript', 'python', 'java', 'react', 'node', 'angular', 'vue',
            'html', 'css', 'typescript', 'mongodb', 'sql', 'aws', 'docker',
            'git', 'api', 'rest', 'graphql', 'express', 'django', 'flask',
            'c++', 'c#', 'php', 'ruby', 'go', 'rust', 'swift', 'kotlin',
            'postgresql', 'redis', 'kubernetes', 'jenkins', 'figma', 'adobe'
        ];

        const bodyText = $('body').text().toLowerCase();

        techKeywords.forEach(keyword => {
            if (bodyText.includes(keyword)) {
                skills.add(keyword.charAt(0).toUpperCase() + keyword.slice(1));
            }
        });

        // Also check skill tags/badges
        $('.skill, .tag, [class*="skill"]').each((i, el) => {
            const skill = $(el).text().trim();
            if (skill && skill.length < 30) {
                skills.add(skill);
            }
        });

        return Array.from(skills).slice(0, 20); // Limit to 20 skills
    }

    extractProjects($, baseUrl) {
        const projects = [];

        // Look for project sections
        $('[class*="project"], [id*="project"], .card, .work-item, .portfolio-item').each((i, el) => {
            if (projects.length >= 10) return false;

            const $el = $(el);
            const title = $el.find('h1, h2, h3, h4, .title, .name').first().text().trim();
            const description = $el.find('p, .description, .desc').first().text().trim();
            const link = $el.find('a').first().attr('href');

            if (title || description) {
                projects.push({
                    name: title || `Project ${projects.length + 1}`,
                    description: description || 'An interesting project showcasing technical skills.',
                    link: link ? new URL(link, baseUrl).href : null
                });
            }
        });

        return projects;
    }

    extractExperience($) {
        const experience = [];

        $('[class*="experience"], [class*="work"], .job, .position').each((i, el) => {
            if (experience.length >= 5) return false;

            const $el = $(el);
            const position = $el.find('h3, h4, .title, .role').first().text().trim();
            const company = $el.find('.company, .org, .employer').first().text().trim();
            const description = $el.find('p, .description').first().text().trim();

            if (position) {
                experience.push({
                    position: position || 'Position',
                    company: company || 'Company',
                    description: description || 'Professional experience',
                    startDate: 'Start',
                    endDate: 'End'
                });
            }
        });

        return experience;
    }

    extractEducation($) {
        const education = [];

        $('[class*="education"], .degree, .school').each((i, el) => {
            if (education.length >= 5) return false;

            const $el = $(el);
            const degree = $el.find('h3, h4, .degree, .title').first().text().trim();
            const institution = $el.find('.school, .university, .institution').first().text().trim();

            if (degree || institution) {
                education.push({
                    degree: degree || 'Degree',
                    institution: institution || 'Institution',
                    field: '',
                    graduationYear: ''
                });
            }
        });

        return education;
    }

    detectSections($, paragraphs, headings) {
        const sections = {
            about: null,
            projects: null,
            experience: null,
            contact: null,
            skills: null
        };

        const allText = [...headings, ...paragraphs].join(' ').toLowerCase();

        if (allText.includes('about')) sections.about = 'detected';
        if (allText.includes('project') || allText.includes('portfolio')) sections.projects = 'detected';
        if (allText.includes('experience') || allText.includes('work')) sections.experience = 'detected';
        if (allText.includes('contact')) sections.contact = 'detected';
        if (allText.includes('skill') || allText.includes('technology')) sections.skills = 'detected';

        return sections;
    }

    async analyzeDesign(page) {
        try {
            const analysis = await page.evaluate(() => {
                const body = document.body;
                const computedStyle = window.getComputedStyle(body);

                return {
                    backgroundColor: computedStyle.backgroundColor,
                    textColor: computedStyle.color,
                    hasNavbar: !!document.querySelector('nav, header'),
                    hasFooter: !!document.querySelector('footer'),
                    isDarkMode: computedStyle.backgroundColor.includes('rgb(') &&
                        parseInt(computedStyle.backgroundColor.split(',')[0].slice(4)) < 50
                };
            });

            return analysis;
        } catch (error) {
            return { error: 'Could not analyze design' };
        }
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }
}

const portfolioScraper = new PortfolioScraper();

module.exports = portfolioScraper;
