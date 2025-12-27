const { Octokit } = require('@octokit/rest');
const simpleGit = require('simple-git');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

class DeploymentManager {
    constructor() {
        this.tempDir = path.join(__dirname, '../temp');
    }

    // Deploy to GitHub Pages
    async deployToGitHub(githubToken, repoName, htmlContent, userName) {
        try {
            const octokit = new Octokit({ auth: githubToken });

            // Create repository
            let repo;
            try {
                repo = await octokit.repos.createForAuthenticatedUser({
                    name: repoName,
                    description: 'My Portfolio Website',
                    homepage: `https://${userName}.github.io/${repoName}`,
                    auto_init: true,
                    private: false
                });
            } catch (error) {
                if (error.status === 422) {
                    // Repository already exists, get it
                    repo = await octokit.repos.get({
                        owner: userName,
                        repo: repoName
                    });
                } else {
                    throw error;
                }
            }

            // Create/Update index.html
            const content = Buffer.from(htmlContent).toString('base64');

            try {
                // Check if file exists
                const { data: existingFile } = await octokit.repos.getContent({
                    owner: userName,
                    repo: repoName,
                    path: 'index.html'
                });

                // Update existing file
                await octokit.repos.createOrUpdateFileContents({
                    owner: userName,
                    repo: repoName,
                    path: 'index.html',
                    message: 'Update portfolio',
                    content,
                    sha: existingFile.sha
                });
            } catch (error) {
                // Create new file
                await octokit.repos.createOrUpdateFileContents({
                    owner: userName,
                    repo: repoName,
                    path: 'index.html',
                    message: 'Initial commit - Portfolio',
                    content
                });
            }

            // Enable GitHub Pages
            try {
                await octokit.repos.createPagesSite({
                    owner: userName,
                    repo: repoName,
                    source: {
                        branch: 'main',
                        path: '/'
                    }
                });
            } catch (error) {
                // Pages might already be enabled
                console.log('GitHub Pages already enabled or error:', error.message);
            }

            const deployedUrl = `https://${userName}.github.io/${repoName}`;

            return {
                success: true,
                url: deployedUrl,
                repository: `https://github.com/${userName}/${repoName}`,
                message: 'Successfully deployed to GitHub Pages'
            };
        } catch (error) {
            console.error('GitHub deployment error:', error);
            throw new Error(`GitHub deployment failed: ${error.message}`);
        }
    }

    // Deploy to Netlify
    async deployToNetlify(netlifyToken, siteName, htmlContent) {
        try {
            // Create a temporary directory
            const deployDir = path.join(this.tempDir, `deploy-${Date.now()}`);
            await fs.mkdir(deployDir, { recursive: true });

            // Write HTML file
            const htmlPath = path.join(deployDir, 'index.html');
            await fs.writeFile(htmlPath, htmlContent);

            // Deploy using Netlify API
            const FormData = require('form-data');
            const archiver = require('archiver');
            const stream = require('stream');

            // Create zip archive
            const archive = archiver('zip', { zlib: { level: 9 } });
            const buffers = [];

            // We need to wait for the archive to finish writing to the buffer
            const zipBuffer = await new Promise((resolve, reject) => {
                archive.on('data', (chunk) => buffers.push(chunk));
                archive.on('end', () => resolve(Buffer.concat(buffers)));
                archive.on('error', reject);

                archive.directory(deployDir, false);
                archive.finalize();
            });

            // Create site on Netlify
            const response = await axios.post(
                'https://api.netlify.com/api/v1/sites',
                {
                    name: siteName,
                    custom_domain: null
                },
                {
                    headers: {
                        'Authorization': `Bearer ${netlifyToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            const siteId = response.data.id;

            // Upload files
            await axios.post(
                `https://api.netlify.com/api/v1/sites/${siteId}/deploys`,
                zipBuffer,
                {
                    headers: {
                        'Authorization': `Bearer ${netlifyToken}`,
                        'Content-Type': 'application/zip'
                    }
                }
            );

            // Cleanup
            await fs.rm(deployDir, { recursive: true, force: true });

            return {
                success: true,
                url: response.data.ssl_url || response.data.url,
                siteId,
                message: 'Successfully deployed to Netlify'
            };
        } catch (error) {
            console.error('Netlify deployment error:', error);
            throw new Error(`Netlify deployment failed: ${error.message}`);
        }
    }

    // Deploy to Vercel
    async deployToVercel(vercelToken, projectName, htmlContent) {
        try {
            // Create deployment
            const files = [
                {
                    file: 'index.html',
                    data: htmlContent
                }
            ];

            const response = await axios.post(
                'https://api.vercel.com/v13/deployments',
                {
                    name: projectName,
                    files: files.map(f => ({
                        file: f.file,
                        data: Buffer.from(f.data).toString('base64')
                    })),
                    projectSettings: {
                        framework: null
                    }
                },
                {
                    headers: {
                        'Authorization': `Bearer ${vercelToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            return {
                success: true,
                url: `https://${response.data.url}`,
                deploymentId: response.data.id,
                message: 'Successfully deployed to Vercel'
            };
        } catch (error) {
            console.error('Vercel deployment error:', error);
            throw new Error(`Vercel deployment failed: ${error.message}`);
        }
    }
}

const deploymentManager = new DeploymentManager();

module.exports = deploymentManager;
