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

            // Extract profile photo (pass name for heuristic matching)
            const profilePhoto = this.extractProfilePhoto($, url, name);

            // Extract title/role
            const title = this.extractTitle($);

            // Extract bio
            const bio = this.extractBio($);

            // Extract hero intro (tagline)
            const heroIntro = this.extractHeroIntro($);

            // Extract email
            const email = this.extractEmail($, html);

            // Extract social links
            const socialLinks = this.extractSocialLinks($, html, url);

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

            // Extract achievements
            const achievements = this.extractAchievements($, url);

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
                profilePhoto,
                title,
                heroIntro,
                bio,
                email,
                socialLinks,
                headings,
                paragraphs: paragraphs.slice(0, 10),
                skills,
                projects,
                experience,
                education,
                achievements,
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

    extractHeroIntro($) {
        const hero = $('#home, #hero, .hero, .intro, header, .header').first();
        if (hero.length) {
            // Usually the first large paragraph or H2/H3 that isn't the name or a tiny role
            const intro = hero.find('p, h2, h3').filter((i, el) => {
                const text = $(el).text().trim();
                return text.length > 40 && text.length < 400;
            }).first().text().trim();
            if (intro) return intro;
        }
        return '';
    }

    extractProfilePhoto($, baseUrl, name) {
        // Look for common profile image selectors/attributes
        let bestCandidate = { url: '', score: -1 };

        try {
            // Collect all potential images from the body
            const allImages = $('img');

            allImages.each((i, img) => {
                const $img = $(img);
                let score = 0;

                // Get Attributes
                const src = $img.attr('src') || $img.attr('data-src') || $img.attr('srcset')?.split(' ')[0];
                if (!src || src.startsWith('data:') || src.includes('base64') || src.endsWith('.svg')) return;

                const alt = ($img.attr('alt') || '').toLowerCase();
                const srcLower = src.toLowerCase();
                const width = parseInt($img.attr('width')) || 0;
                const height = parseInt($img.attr('height')) || 0;

                // --- NEGATIVE SCORING (Disqualification) ---

                // 1. Exclude icons, logos, tracking pixels
                if (srcLower.includes('icon') || srcLower.includes('logo') || srcLower.includes('tracker')) score -= 50;
                if (width > 0 && width < 40) score -= 50; // Too small

                // 2. Exclude Project Images (Keywords)
                const exclusionTerms = ['project', 'screenshot', 'demo', 'preview', 'cover', 'banner', 'mockup', 'thumb'];
                if (exclusionTerms.some(term => srcLower.includes(term) || alt.includes(term))) score -= 100;

                // 3. Exclude Project Containers (Context)
                if ($img.closest('#projects, #portfolio, #work, .projects-section, .portfolio-section').length > 0) score -= 100;
                if ($img.closest('.project-card, .portfolio-item, .work-item').length > 0) score -= 100;

                // --- POSITIVE SCORING (Prioritization) ---

                // 1. Name Match (Highest Confidence)
                if (name) {
                    const cleanName = name.toLowerCase();
                    if (alt.includes(cleanName) || srcLower.includes(cleanName.replace(/\s/g, ''))) score += 60;
                }

                // 2. Cloudinary (User Hint)
                if (srcLower.includes('cloudinary') && !srcLower.includes('.pdf')) score += 50;

                // 3. Profile Keywords
                if (srcLower.includes('profile') || srcLower.includes('avatar') || srcLower.includes('me') ||
                    alt.includes('profile') || alt.includes('avatar') || alt.includes('me')) score += 40;

                // 4. Location Context (Hero/About)
                if ($img.closest('#hero, #about, header, .hero, .about, .intro').length > 0) score += 30;
                else if ($img.closest('nav, footer').length > 0) score -= 20; // Unlikely in footer

                // 5. Explicit ID/Class Match
                if ($img.is('#profile-pic, .profile-pic, .avatar, .hero-img')) score += 30;

                // 6. Aspect Ratio (Square = Good)
                if (width > 50 && height > 50) {
                    const ratio = width / height;
                    if (ratio > 0.8 && ratio < 1.2) score += 20;
                }

                // 7. Size (Bigger is often better for profile vs icons)
                if (width > 150) score += 10;

                console.log(`📸 Candidate: ${src.substring(0, 50)}... Score: ${score}`);

                if (score > bestCandidate.score) {
                    bestCandidate = { url: src, score: score };
                }
            });

            // Also check meta tags as a fallback or strong contender
            const metaImage = $('meta[property="og:image"]').attr('content') || $('meta[name="twitter:image"]').attr('content');
            if (metaImage && (metaImage.includes('profile') || metaImage.includes('avatar'))) {
                // Meta images are often good, but might be banners. Give it a decent score.
                if (45 > bestCandidate.score) {
                    bestCandidate = { url: metaImage, score: 45 };
                }
            }

            let photoUrl = bestCandidate.score > 0 ? bestCandidate.url : '';

            // Fix relative URLs
            if (photoUrl && !photoUrl.startsWith('http') && !photoUrl.startsWith('data:')) {
                // ... (existing URL fix logic)
                if (baseUrl && !baseUrl.startsWith('http')) {
                    baseUrl = 'https://' + baseUrl;
                }
                const cleanPath = photoUrl.startsWith('/') ? photoUrl.substring(1) : photoUrl;
                const base = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
                try {
                    photoUrl = new URL(cleanPath, base).href;
                } catch (e) { }
            }

            // Clean quotes
            if (photoUrl) photoUrl = photoUrl.replace(/['"]/g, '').trim();

            return photoUrl;

        } catch (e) {
            console.error('Error in extractProfilePhoto:', e);
            return '';
        }
    }

    extractTitle($) {
        const html = $.html().toLowerCase();
        if (html.includes('front end engineer')) return 'Front End Engineer';
        if (html.includes('frontend engineer')) return 'Front End Engineer';
        if (html.includes('software engineer')) return 'Software Engineer';
        if (html.includes('full stack developer')) return 'Full Stack Developer';

        // Exclude common section headers
        const exclusions = ['about', 'about me', 'contact', 'projects', 'skills', 'experience', 'education', 'home'];

        // 1. Check for specific role classes
        let subtitle = $('.subtitle, .role, .job-title, .tagline').first().text().trim();
        if (subtitle && !exclusions.includes(subtitle.toLowerCase())) return subtitle;

        // 2. Check for the first H2 (often the role/tagline)
        const firstH2 = $('h2').first().text().trim();
        if (firstH2 && firstH2.length > 5 && firstH2.length < 100 && !exclusions.includes(firstH2.toLowerCase())) {
            return firstH2;
        }

        // 3. Fallback to first H1's sibling or similar
        const firstH1 = $('h1').first();
        const nextElement = firstH1.next('p, h2, .subtitle');
        if (nextElement.length) {
            const text = nextElement.text().trim();
            if (text.length < 100 && !exclusions.includes(text.toLowerCase())) return text;
        }

        return 'Software Engineer';
    }

    extractBio($) {
        // Look for about section - Join ALL paragraphs
        const aboutSection = $('#about, .about, [class*="about"]');
        if (aboutSection.length) {
            const paragraphs = aboutSection.find('p').map((i, el) => $(el).text().trim()).get();
            const bio = paragraphs.filter(p => p.length > 20).join('\n\n');
            if (bio && bio.length > 30) return bio;
        }

        // Find all long paragraphs and join them as fallback
        let bioParas = [];
        $('p').each((i, el) => {
            const text = $(el).text().trim();
            if (text.length > 50 && text.length < 1000) {
                // Avoid capturing menu items or short bits
                bioParas.push(text);
            }
        });

        // Take top 3 longest paragraphs if they seem related
        bioParas.sort((a, b) => b.length - a.length);
        const topBio = bioParas.slice(0, 3).join('\n\n');

        return topBio || 'Passionate professional with diverse skills and experience.';
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

    extractSocialLinks($, html, baseUrl) {
        const socialLinks = {
            linkedin: '',
            github: '',
            twitter: '',
            instagram: ''
        };

        const exclusions = ['share', 'intent', 'intent/tweet', 'sharing', 'post', 'status', 'plugins'];

        // Helper for absolute URLs
        const toAbs = (url) => {
            if (!url) return '';
            try { return new URL(url, baseUrl).href; } catch (e) { return url; }
        };

        // Find all links
        $('a').each((i, el) => {
            const href = $(el).attr('href');
            if (!href) return;

            const lowerHref = href.toLowerCase();

            // Skip common non-profile links
            if (exclusions.some(exc => lowerHref.includes(exc))) return;

            if (lowerHref.includes('linkedin.com/in/') && !socialLinks.linkedin) {
                socialLinks.linkedin = toAbs(href);
            } else if (lowerHref.includes('linkedin.com/') && !socialLinks.linkedin) {
                socialLinks.linkedin = toAbs(href);
            } else if (lowerHref.includes('github.com/') && !lowerHref.includes('github.com/settings') && !socialLinks.github) {
                socialLinks.github = toAbs(href);
            } else if ((lowerHref.includes('twitter.com/') || lowerHref.includes('x.com/')) && !socialLinks.twitter) {
                socialLinks.twitter = toAbs(href);
            } else if (lowerHref.includes('instagram.com/') && !socialLinks.instagram) {
                socialLinks.instagram = toAbs(href);
            }
        });

        console.log('🔗 Social links extracted:', socialLinks);
        return socialLinks;
    }

    extractSkills($) {
        const skills = new Set();
        // Expanded keyword list
        const techKeywords = [
            'javascript', 'python', 'java', 'react', 'node.js', 'node', 'angular', 'vue',
            'html', 'html5', 'css', 'css3', 'typescript', 'mongodb', 'sql', 'mysql', 'postgresql',
            'aws', 'docker', 'git', 'github', 'api', 'rest', 'graphql', 'express', 'django', 'flask',
            'c++', 'c#', 'php', 'ruby', 'go', 'rust', 'swift', 'kotlin', 'flutter', 'dart',
            'redis', 'kubernetes', 'jenkins', 'figma', 'adobe', 'photoshop', 'illustrator',
            'bootstrap', 'tailwind', 'sass', 'scss', 'jquery', 'firebase', 'azure', 'gcp',
            'linux', 'bash', 'shell', 'agile', 'scrum', 'jira', 'trello'
        ];

        const bodyText = $('body').text().toLowerCase();

        // 1. Keyword search in full text (low confidence but broad coverage)
        techKeywords.forEach(keyword => {
            // Check for whole word match to avoid false positives (e.g., 'java' in 'javascript')
            // Escape special characters to prevent regex errors (e.g., c++, c#, .js)
            const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

            // Note: \b is not effective for symbols like + or #, so we rely on includes for those specific cases primarily
            // or we could use lookahead/lookbehind, but simply catching the error prevents the crash.
            let regex;
            try {
                // For words ending in symbols (c++, c#), \b boundary won't work as expected on the right side if followed by space
                if (['c++', 'c#', '.net'].includes(keyword)) {
                    regex = new RegExp(`(^|\\s)${escapedKeyword}($|\\s)`, 'i');
                } else {
                    regex = new RegExp(`\\b${escapedKeyword}\\b`, 'i');
                }
            } catch (e) {
                // Fallback if regex construction fails
                regex = { test: () => false };
            }

            if (regex.test(bodyText) || bodyText.includes(keyword)) {
                // Normalize casing
                const display = keyword === 'node' ? 'Node.js' : keyword.charAt(0).toUpperCase() + keyword.slice(1);
                skills.add(display);
            }
        });

        // 2. High confidence extraction from lists/tags
        $('.skill, .tag, .badge, .chip, li, [class*="skill"], [class*="tech"], [class*="stack"]').each((i, el) => {
            const text = $(el).text().trim();
            if (text && text.length < 25 && text.length > 1) { // Reasonable length for a skill
                // Check if it matches a keyword loosely
                if (techKeywords.some(k => text.toLowerCase().includes(k))) {
                    skills.add(text);
                }
            }
        });

        return Array.from(skills).slice(0, 25);
    }

    extractProjects($, baseUrl) {
        const projects = [];
        const seenTitles = new Set();
        const seenDescriptions = new Set();

        // Specific Item Selectors (Avoid generic "project" which matches inner content)
        const projectSelectors = [
            '.project', '.work-item', '.portfolio-item', '.card',
            '.featured-project', '.project-card', '.project-item',
            '[class*="project-card"]', '[class*="portfolio-card"]',
            'article', '.grid-item'
        ];

        // Search specifically within probable project containers first
        const containers = $('#projects, #portfolio, #work, .projects, .portfolio');

        let candidates = $();

        if (containers.length) {
            // If we found a project section, look inside it
            candidates = containers.find(projectSelectors.join(', '));
            // Also grab direct children if they look like items (fallback)
            if (candidates.length === 0) {
                candidates = containers.children();
            }
        } else {
            // Fallback to global search
            candidates = $(projectSelectors.join(', '));
        }

        candidates.each((i, el) => {
            if (projects.length >= 12) return false;

            const $el = $(el);

            // Skip if this element mostly likely contains OTHER project items
            // But be careful not to skip an item just because it has a class like "project-content" inside
            const hasNestedItems = $el.find(projectSelectors.join(', ')).length > 0;
            const isCard = $el.is('.card, .project-card, .featured-project, article');

            // If it has nested items AND it's not explicitly a card, assume it's a wrapper/container
            if (hasNestedItems && !isCard) return;

            // Extract content
            let title = $el.find('h3, h4, h5, .title, strong, b, .project-title').first().text().trim();
            let description = $el.find('p, .description, span, .project-description').first().text().trim();

            // Heuristic: If no explicit title, try first text node
            if (!title) title = $el.text().split('\n')[0].trim().substring(0, 50);

            if (!title && !description) return;
            if (title.length < 2) return; // Too short to be a real title

            // Strict deduplication
            if (seenTitles.has(title)) return;

            // Extract Link
            let link = $el.find('a').first().attr('href');
            // If element itself is a link
            if ($el.is('a') && !link) link = $el.attr('href');

            // Extract Image
            let imageUrl = null;
            const img = $el.find('img').first();
            if (img.length) {
                const src = img.attr('src') || img.attr('data-src') || img.attr('srcset')?.split(' ')[0];
                if (src && !src.includes('base64')) {
                    try {
                        let cleanSrc = src.replace(/['"]/g, '').trim();
                        if (baseUrl && !cleanSrc.startsWith('http')) {
                            const base = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
                            cleanSrc = cleanSrc.startsWith('/') ? cleanSrc.substring(1) : cleanSrc;
                            imageUrl = new URL(cleanSrc, base).href;
                        } else {
                            imageUrl = cleanSrc;
                        }
                    } catch (e) {
                        // ignore
                    }
                }
            }

            if (title) seenTitles.add(title);

            projects.push({
                name: title,
                description: description || 'Project details',
                link: link ? (link.startsWith('http') ? link : new URL(link, baseUrl).href) : null,
                image: imageUrl
            });
        });

        // Debug log
        if (projects.length === 0) {
            console.log('⚠️ No projects found with selectors. HTML structure might be unique.');
            console.log('Sample container html:', containers.first().html()?.substring(0, 200));
        } else {
            console.log(`✅ Extracted ${projects.length} projects.`);
        }

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

    extractAchievements($, baseUrl) {
        const achievements = [];
        const seenTitles = new Set();
        const keywords = ['certificate', 'certification', 'award', 'achievement', 'honor', 'winner', 'scholarship'];

        // Helper to extract from an element
        const extractFromEl = ($el) => {
            const text = $el.text().trim();
            if (!text || text.length < 5 || text.length > 500) return null;

            const title = text.split('\n')[0].trim();
            if (seenTitles.has(title)) return null;

            // Look for image
            let image = null;
            const img = $el.find('img').first();
            if (img.length) {
                const src = img.attr('src') || img.attr('data-src') || img.attr('data-original') || img.attr('srcset')?.split(' ')[0];
                if (src && !src.includes('base64')) {
                    try { image = new URL(src.replace(/['"]/g, '').trim(), baseUrl).href; } catch (e) { }
                }
            }

            // Look for link
            const link = $el.find('a').first().attr('href');
            let formattedLink = null;
            if (link) {
                try { formattedLink = new URL(link, baseUrl).href; } catch (e) { }
            }

            // Look for description (text after title)
            let description = '';
            const allText = $el.text().replace(/\s+/g, ' ').trim();
            if (allText.length > title.length) {
                description = allText.replace(title, '').trim();
            }

            if (title) {
                seenTitles.add(title);
                return { title, description, image, link: formattedLink };
            }
            return null;
        };

        // 1. Check sections by heading
        $('h1, h2, h3, h4').each((i, el) => {
            const headingText = $(el).text().toLowerCase();
            if (keywords.some(kw => headingText.includes(kw))) {
                const section = $(el).parent();
                section.find('li, .item, .card, [class*="item"]').each((j, item) => {
                    if (achievements.length >= 10) return false;
                    const result = extractFromEl($(item));
                    if (result) achievements.push(result);
                });
            }
        });

        // 2. Check elements by class/id if not enough found
        if (achievements.length < 5) {
            const selectors = [
                '[class*="achievement"]', '[id*="achievement"]',
                '[class*="certificate"]', '[id*="certificate"]',
                '[class*="award"]', '[id*="award"]',
                '.certification', '.honor', '.award-item'
            ];

            $(selectors.join(', ')).each((i, el) => {
                if (achievements.length >= 10) return false;
                const result = extractFromEl($(el));
                if (result) achievements.push(result);
            });
        }

        return achievements;
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
