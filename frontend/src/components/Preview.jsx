import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Download, Share2, Rocket, Loader, FileText } from 'lucide-react';
import axios from 'axios';
import { API_BASE } from '../config';

export default function Preview({ user }) {
    const { id } = useParams();
    const navigate = useNavigate();
    const [portfolio, setPortfolio] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showDeployGuide, setShowDeployGuide] = useState(false);
    const [deploymentGuide, setDeploymentGuide] = useState('');
    const [generatingGuide, setGeneratingGuide] = useState(false);

    useEffect(() => {
        fetchPortfolio();
    }, [id]);

    const fetchPortfolio = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_BASE}/api/portfolio/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setPortfolio(response.data);
        } catch (err) {
            console.error('Error fetching portfolio:', err);
            alert('Failed to load portfolio');
            navigate('/dashboard');
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadHTML = () => {
        if (!portfolio?.generatedHTML) return;

        const blob = new Blob([portfolio.generatedHTML], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'portfolio.html';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleDownloadResume = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_BASE}/api/portfolio/${id}/resume`, {
                headers: { Authorization: `Bearer ${token}` },
                responseType: 'blob'
            });

            const url = URL.createObjectURL(response.data);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'resume.pdf';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Error downloading resume:', err);
            alert('Failed to download resume');
        }
    };

    const handleGenerateDeployGuide = async () => {
        setGeneratingGuide(true);
        setShowDeployGuide(true);

        try {
            const token = localStorage.getItem('token');
            const response = await axios.post(
                `${API_BASE}/api/ai/deployment-guide`,
                { portfolioId: id },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            setDeploymentGuide(response.data.guide);
        } catch (err) {
            console.error('Error generating deployment guide:', err);
            setDeploymentGuide('Failed to generate deployment guide. Please try again.');
        } finally {
            setGeneratingGuide(false);
        }
    };

    const handleShare = () => {
        if (portfolio?.shareableLink) {
            navigator.clipboard.writeText(portfolio.shareableLink);
            alert('Shareable link copied to clipboard!');
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <Loader className="w-12 h-12 text-purple-600 animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white shadow-sm">
                <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">Portify</h1>
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="text-gray-600 hover:text-gray-800"
                    >
                        ← Back to Dashboard
                    </button>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-6 py-8">
                {/* Action Buttons */}
                <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                    <h2 className="text-xl font-bold text-gray-800 mb-4">🎉 Your Portfolio is Ready!</h2>

                    <div className="grid md:grid-cols-4 gap-4">
                        <button
                            onClick={handleDownloadHTML}
                            className="flex items-center justify-center space-x-2 bg-purple-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-purple-700"
                        >
                            <Download className="w-5 h-5" />
                            <span>Download HTML</span>
                        </button>

                        <button
                            onClick={handleDownloadResume}
                            className="flex items-center justify-center space-x-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700"
                        >
                            <FileText className="w-5 h-5" />
                            <span>Download Resume</span>
                        </button>

                        <button
                            onClick={handleGenerateDeployGuide}
                            className="flex items-center justify-center space-x-2 bg-green-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-green-700"
                        >
                            <Rocket className="w-5 h-5" />
                            <span>Deploy Guide</span>
                        </button>

                        <button
                            onClick={handleShare}
                            disabled={!portfolio?.shareableLink}
                            className="flex items-center justify-center space-x-2 bg-orange-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                        >
                            <Share2 className="w-5 h-5" />
                            <span>Share Link</span>
                        </button>
                    </div>
                </div>

                {/* AI Deployment Guide (USP 2) */}
                {showDeployGuide && (
                    <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                        <h3 className="text-xl font-bold text-gray-800 mb-4">🚀 AI Deployment Guide</h3>

                        {generatingGuide ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader className="w-8 h-8 text-purple-600 animate-spin" />
                                <span className="ml-3 text-gray-600">Generating personalized deployment guide...</span>
                            </div>
                        ) : (
                            <div className="prose max-w-none">
                                <div
                                    className="bg-gray-50 p-6 rounded-lg whitespace-pre-wrap"
                                    dangerouslySetInnerHTML={{ __html: deploymentGuide.replace(/\n/g, '<br />') }}
                                />
                            </div>
                        )}
                    </div>
                )}

                {/* Portfolio Preview */}
                <div className="bg-white rounded-xl shadow-sm p-6">
                    <h3 className="text-xl font-bold text-gray-800 mb-4">Live Preview</h3>

                    <div className="border-4 border-gray-200 rounded-lg overflow-hidden" style={{ height: '800px' }}>
                        {portfolio?.generatedHTML ? (
                            <iframe
                                srcDoc={portfolio.generatedHTML}
                                className="w-full h-full"
                                title="Portfolio Preview"
                                sandbox="allow-scripts allow-same-origin"
                            />
                        ) : (
                            <div className="flex items-center justify-center h-full text-gray-500">
                                No preview available
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
