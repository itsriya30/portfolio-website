const express = require('express');
const router = express.Router();
const deploymentManager = require('../utils/deploymentManager');
const Portfolio = require('../models/Portfolio');
const { protect } = require('../middleware/authMiddleware');

// @route   POST /api/deploy/github
// @desc    Deploy portfolio to GitHub Pages
router.post('/github', protect, async (req, res) => {
    const { portfolioId, githubToken, repoName, userName } = req.body;

    try {
        const portfolio = await Portfolio.findById(portfolioId);
        if (!portfolio || portfolio.userId.toString() !== req.user._id.toString()) {
            return res.status(404).json({ message: 'Portfolio not found' });
        }

        const result = await deploymentManager.deployToGitHub(
            githubToken,
            repoName,
            portfolio.generatedHTML,
            userName
        );

        res.json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   POST /api/deploy/netlify
// @desc    Deploy portfolio to Netlify
router.post('/netlify', protect, async (req, res) => {
    const { portfolioId, netlifyToken, siteName } = req.body;

    try {
        const portfolio = await Portfolio.findById(portfolioId);
        if (!portfolio || portfolio.userId.toString() !== req.user._id.toString()) {
            return res.status(404).json({ message: 'Portfolio not found' });
        }

        const result = await deploymentManager.deployToNetlify(
            netlifyToken,
            siteName,
            portfolio.generatedHTML
        );

        res.json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   POST /api/deploy/vercel
// @desc    Deploy portfolio to Vercel
router.post('/vercel', protect, async (req, res) => {
    const { portfolioId, vercelToken, projectName } = req.body;

    try {
        const portfolio = await Portfolio.findById(portfolioId);
        if (!portfolio || portfolio.userId.toString() !== req.user._id.toString()) {
            return res.status(404).json({ message: 'Portfolio not found' });
        }

        const result = await deploymentManager.deployToVercel(
            vercelToken,
            projectName,
            portfolio.generatedHTML
        );

        res.json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
