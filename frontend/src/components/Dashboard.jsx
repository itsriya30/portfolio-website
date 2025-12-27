import { Link, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { PlusCircle, RefreshCw, LogOut, Eye, Download, Share2 } from 'lucide-react';
import axios from 'axios';
import { API_BASE } from '../config';

export default function Dashboard({ user, setUser }) {
    const navigate = useNavigate();
    const [portfolios, setPortfolios] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchPortfolios();
    }, []);

    const fetchPortfolios = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_BASE}/api/portfolio/my-portfolios`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setPortfolios(response.data);
        } catch (err) {
            console.error('Error fetching portfolios:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
        navigate('/');
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white shadow-sm">
                <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">Portify</h1>
                    <div className="flex items-center space-x-4">
                        <span className="text-gray-700">Welcome, {user?.name}</span>
                        <button
                            onClick={handleLogout}
                            className="flex items-center space-x-2 text-gray-600 hover:text-gray-800"
                        >
                            <LogOut className="w-5 h-5" />
                            <span>Logout</span>
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-6 py-12">
                <h2 className="text-4xl font-bold text-gray-800 mb-12">Your Dashboard</h2>

                {/* Action Cards */}
                <div className="grid md:grid-cols-2 gap-8 mb-16">
                    <Link
                        to="/create"
                        className="bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl p-8 text-white hover:shadow-2xl transition-shadow group"
                    >
                        <PlusCircle className="w-16 h-16 mb-4 group-hover:scale-110 transition-transform" />
                        <h3 className="text-3xl font-bold mb-3">Create New Portfolio</h3>
                        <p className="text-purple-100">
                            Start from scratch with AI guidance. Describe your vision and watch the magic happen.
                        </p>
                    </Link>

                    <Link
                        to="/redesign"
                        className="bg-gradient-to-br from-indigo-500 to-blue-500 rounded-2xl p-8 text-white hover:shadow-2xl transition-shadow group"
                    >
                        <RefreshCw className="w-16 h-16 mb-4 group-hover:rotate-180 transition-transform duration-500" />
                        <h3 className="text-3xl font-bold mb-3">Redesign Portfolio</h3>
                        <p className="text-blue-100">
                            Already have a portfolio? Paste the link and AI will transform it professionally.
                        </p>
                    </Link>
                </div>

                {/* My Portfolios Section */}
                <div>
                    <h3 className="text-2xl font-bold text-gray-800 mb-6">My Portfolios</h3>

                    {loading ? (
                        <div className="text-center py-12 text-gray-500">Loading your portfolios...</div>
                    ) : portfolios.length === 0 ? (
                        <div className="bg-white rounded-xl p-12 text-center">
                            <p className="text-gray-600 text-lg mb-6">You haven't created any portfolios yet.</p>
                            <Link
                                to="/create"
                                className="inline-block bg-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-purple-700"
                            >
                                Create Your First Portfolio
                            </Link>
                        </div>
                    ) : (
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {portfolios.map((portfolio) => (
                                <div key={portfolio._id} className="bg-white rounded-xl shadow-sm hover:shadow-lg transition-shadow p-6">
                                    <div className="mb-4">
                                        <h4 className="text-xl font-bold text-gray-800 mb-2">
                                            {portfolio.personalInfo?.name || 'Untitled Portfolio'}
                                        </h4>
                                        <p className="text-sm text-gray-500">
                                            Created {new Date(portfolio.createdAt).toLocaleDateString()}
                                        </p>
                                    </div>

                                    <div className="mt-6">
                                        <Link
                                            to={`/preview/${portfolio._id}`}
                                            className="w-full bg-purple-600 text-white px-4 py-3 rounded-lg font-medium hover:bg-purple-700 flex items-center justify-center space-x-2 transition-colors"
                                        >
                                            <Eye className="w-5 h-5" />
                                            <span>View & Manage</span>
                                        </Link>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
