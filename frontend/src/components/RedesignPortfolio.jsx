import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, Loader, Link as LinkIcon } from 'lucide-react';
import axios from 'axios';

export default function RedesignPortfolio({ user }) {
    const navigate = useNavigate();
    const [portfolioUrl, setPortfolioUrl] = useState('');
    const [redesignInstructions, setRedesignInstructions] = useState('');
    const [analyzing, setAnalyzing] = useState(false);
    const [analyzed, setAnalyzed] = useState(false);
    const [analysisData, setAnalysisData] = useState(null);
    const [generating, setGenerating] = useState(false);

    const handleAnalyze = async () => {
        if (!portfolioUrl) {
            alert('Please enter a portfolio URL');
            return;
        }

        setAnalyzing(true);
        try {
            const token = localStorage.getItem('token');
            const response = await axios.post(
                'http://localhost:5000/api/ai/analyze-portfolio',
                { url: portfolioUrl },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            setAnalysisData(response.data);
            setAnalyzed(true);
        } catch (err) {
            console.error('Error analyzing portfolio:', err);
            const errorMessage = err.response?.data?.error || err.response?.data?.message || err.message;
            const suggestion = err.response?.data?.suggestion;
            alert(`Failed to analyze portfolio: ${errorMessage}${suggestion ? '\n\nSuggestion: ' + suggestion : ''}`);
        } finally {
            setAnalyzing(false);
        }
    };

    const handleRedesign = async () => {
        if (!redesignInstructions) {
            alert('Please describe how you want to redesign your portfolio');
            return;
        }
        setGenerating(true);
        try {
            const token = localStorage.getItem('token');
            const response = await axios.post(
                'http://localhost:5000/api/portfolio/redesign',
                {
                    originalUrl: portfolioUrl,
                    analysisData,
                    redesignInstructions
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            navigate(`/preview/${response.data.portfolioId}`);
        } catch (err) {
            console.error('Error redesigning portfolio:', err);
            alert('Failed to redesign portfolio. Please try again.');
        } finally {
            setGenerating(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white shadow-sm">
                <div className="max-w-5xl mx-auto px-6 py-4 flex justify-between items-center">
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">Portify</h1>
                    <span className="text-gray-500 font-medium">Redesign Your Portfolio</span>
                </div>
            </header>
            <div className="max-w-5xl mx-auto px-6 py-12">
                {/* Step 1: Enter Portfolio URL */}
                {!analyzed && (
                    <div className="bg-white rounded-xl shadow-sm p-8">
                        <div className="flex items-center space-x-3 mb-6">
                            <LinkIcon className="w-8 h-8 text-purple-600" />
                            <h2 className="text-2xl font-bold text-gray-800">Step 1: Enter Your Portfolio URL</h2>
                        </div>

                        <p className="text-gray-600 mb-6">
                            Paste the link to your existing portfolio. Our AI will analyze its content and design,
                            then help you transform it into something amazing.
                        </p>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-gray-700 font-medium mb-2">Portfolio URL</label>
                                <input
                                    type="url"
                                    value={portfolioUrl}
                                    onChange={(e) => setPortfolioUrl(e.target.value)}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                    placeholder="https://yourportfolio.com or https://github.com/username"
                                />
                            </div>

                            <button
                                onClick={handleAnalyze}
                                disabled={analyzing || !portfolioUrl}
                                className="w-full bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                            >
                                {analyzing ? (
                                    <>
                                        <Loader className="w-5 h-5 animate-spin" />
                                        <span>Analyzing Your Portfolio...</span>
                                    </>
                                ) : (
                                    <>
                                        <RefreshCw className="w-5 h-5" />
                                        <span>Analyze Portfolio</span>
                                    </>
                                )}
                            </button>
                        </div>

                        {/* Examples */}
                        <div className="mt-8 bg-blue-50 p-6 rounded-lg">
                            <h3 className="font-semibold text-blue-900 mb-3">💡 Supported Platforms:</h3>
                            <ul className="space-y-2 text-sm text-blue-800">
                                <li>• GitHub Pages (username.github.io)</li>
                                <li>• Personal websites (any URL)</li>
                                <li>• Netlify/Vercel hosted sites</li>
                                <li>• Behance portfolios</li>
                                <li>• Wix/Squarespace sites</li>
                            </ul>
                        </div>
                    </div>
                )}

                {/* Step 2: Analysis Results & Redesign Instructions */}
                {analyzed && (
                    <div className="space-y-6">
                        {/* Analysis Summary */}
                        <div className="bg-white rounded-xl shadow-sm p-8">
                            <h2 className="text-2xl font-bold text-gray-800 mb-6">✅ Portfolio Analyzed!</h2>

                            <div className="bg-green-50 p-6 rounded-lg mb-6">
                                <h3 className="font-semibold text-green-900 mb-3">What we found:</h3>
                                <ul className="space-y-2 text-green-800">
                                    <li>✓ Extracted content and structure</li>
                                    <li>✓ Identified current design style</li>
                                    <li>✓ Analyzed color scheme and layout</li>
                                    <li>✓ Ready for transformation</li>
                                </ul>
                            </div>

                            {analysisData && (
                                <div className="grid md:grid-cols-2 gap-4 mb-6">
                                    <div className="bg-gray-50 p-4 rounded-lg">
                                        <h4 className="font-semibold text-gray-800 mb-2">Current Style</h4>
                                        <p className="text-gray-600">{analysisData.currentStyle || 'Standard layout'}</p>
                                    </div>
                                    <div className="bg-gray-50 p-4 rounded-lg">
                                        <h4 className="font-semibold text-gray-800 mb-2">Content Found</h4>
                                        <p className="text-gray-600">{analysisData.contentSummary || 'Projects, bio, and contact info'}</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Redesign Instructions */}
                        <div className="bg-white rounded-xl shadow-sm p-8">
                            <div className="flex items-center space-x-3 mb-6">
                                <RefreshCw className="w-8 h-8 text-purple-600" />
                                <h2 className="text-2xl font-bold text-gray-800">Step 2: Describe Your Redesign</h2>
                            </div>

                            <p className="text-gray-600 mb-6">
                                Tell us how you want to transform your portfolio. Be specific about colors, layout,
                                style, animations, or anything else you'd like to change.
                            </p>

                            <textarea
                                value={redesignInstructions}
                                onChange={(e) => setRedesignInstructions(e.target.value)}
                                rows="8"
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent mb-6"
                                placeholder="Example: Keep my content but make it way more modern. Use a dark background with neon green accents. Make project cards have a glass effect. Add smooth scrolling animations. Change to a single-page layout. Make it feel like a tech startup's website."
                            />

                            {/* Quick Redesign Options */}
                            <div className="bg-purple-50 p-6 rounded-lg mb-6">
                                <h3 className="font-semibold text-purple-900 mb-3">💡 Quick redesign ideas:</h3>
                                <div className="grid md:grid-cols-2 gap-2">
                                    <button
                                        onClick={() => setRedesignInstructions("Make it more modern with dark mode, smooth animations, and a cleaner layout")}
                                        className="text-left p-3 bg-white rounded hover:bg-purple-100 transition text-sm text-purple-800"
                                    >
                                        🌙 Modernize with dark mode
                                    </button>
                                    <button
                                        onClick={() => setRedesignInstructions("Add vibrant colors and playful animations, make it more creative and fun")}
                                        className="text-left p-3 bg-white rounded hover:bg-purple-100 transition text-sm text-purple-800"
                                    >
                                        🎨 Make it more colorful & creative
                                    </button>
                                    <button
                                        onClick={() => setRedesignInstructions("Keep content but simplify the design. Minimalist, lots of whitespace, clean typography")}
                                        className="text-left p-3 bg-white rounded hover:bg-purple-100 transition text-sm text-purple-800"
                                    >
                                        ✨ Simplify to minimalist
                                    </button>
                                    <button
                                        onClick={() => setRedesignInstructions("Make it more professional and corporate. Use blue color scheme, clean grid layout")}
                                        className="text-left p-3 bg-white rounded hover:bg-purple-100 transition text-sm text-purple-800"
                                    >
                                        💼 More professional look
                                    </button>
                                </div>
                            </div>

                            <div className="flex space-x-4">
                                <button
                                    onClick={() => setAnalyzed(false)}
                                    className="px-6 py-3 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50"
                                >
                                    ← Change URL
                                </button>
                                <button
                                    onClick={handleRedesign}
                                    disabled={generating || !redesignInstructions}
                                    className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                                >
                                    {generating ? (
                                        <>
                                            <Loader className="w-5 h-5 animate-spin" />
                                            <span>Redesigning Your Portfolio...</span>
                                        </>
                                    ) : (
                                        <>
                                            <RefreshCw className="w-5 h-5" />
                                            <span>Generate Redesigned Portfolio</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
