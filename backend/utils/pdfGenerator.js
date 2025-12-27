const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

class PDFGenerator {
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

    async generateResumePDF(resumeHTML) {
        try {
            const browser = await this.initialize();
            const page = await browser.newPage();

            // Set content
            await page.setContent(resumeHTML, {
                waitUntil: 'networkidle0'
            });

            // Generate PDF
            const pdf = await page.pdf({
                format: 'A4',
                printBackground: true,
                margin: {
                    top: '20px',
                    right: '20px',
                    bottom: '20px',
                    left: '20px'
                }
            });

            await page.close();
            return pdf;
        } catch (error) {
            console.error('PDF generation error:', error);
            throw error;
        }
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }
}

// Singleton instance
const pdfGenerator = new PDFGenerator();

module.exports = pdfGenerator;
