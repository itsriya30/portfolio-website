// Simplified CreatePortfolio with AI Improve (No Voice Input)
import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Sparkles, Loader, Check, Upload, X, FileText } from 'lucide-react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000';

const CreatePortfolio = () => {
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // AI improvement loading state
    const [improving, setImproving] = useState(null);

    const [formData, setFormData] = useState({
        basicDetails: {
            fullName: '',
            professionalTitle: '',
            phoneNumber: '',
            email: '',
            location: '',
            profilePhoto: ''
        },
        aboutMe: '',
        skills: {
            technical: [],
            tools: [],
            softSkills: []
        },
        projects: [],
        achievements: [],
        experience: [],
        socialLinks: {
            linkedin: '',
            github: '',
            twitter: '',
            instagram: ''
        },
        template: ''
    });

    const [currentSkillInput, setCurrentSkillInput] = useState({
        technical: '',
        tools: '',
        softSkills: ''
    });

    const [currentProject, setCurrentProject] = useState({
        title: '',
        description: '',
        technologies: '',
        liveLink: '',
        githubLink: '',
        screenshot: ''
    });

    const [currentAchievement, setCurrentAchievement] = useState({
        description: '',
        certificate: ''
    });

    const [currentExperience, setCurrentExperience] = useState({
        role: '',
        company: '',
        duration: '',
        description: ''
    });

    // Update field value helper
    const updateFieldValue = (fieldPath, value) => {
        const keys = fieldPath.split('.');

        if (keys[0] === 'basicDetails') {
            setFormData(prev => ({
                ...prev,
                basicDetails: { ...prev.basicDetails, [keys[1]]: value }
            }));
        } else if (keys[0] === 'aboutMe') {
            setFormData(prev => ({ ...prev, aboutMe: value }));
        } else if (keys[0] === 'currentProject') {
            setCurrentProject(prev => ({ ...prev, [keys[1]]: value }));
        } else if (keys[0] === 'currentAchievement') {
            setCurrentAchievement(prev => ({ ...prev, [keys[1]]: value }));
        } else if (keys[0] === 'currentExperience') {
            setCurrentExperience(prev => ({ ...prev, [keys[1]]: value }));
        }
    };

    // Get field value helper
    const getFieldValue = (fieldPath) => {
        const keys = fieldPath.split('.');

        if (keys[0] === 'basicDetails') {
            return formData.basicDetails[keys[1]] || '';
        } else if (keys[0] === 'aboutMe') {
            return formData.aboutMe;
        } else if (keys[0] === 'currentProject') {
            return currentProject[keys[1]] || '';
        } else if (keys[0] === 'currentAchievement') {
            return currentAchievement[keys[1]] || '';
        } else if (keys[0] === 'currentExperience') {
            return currentExperience[keys[1]] || '';
        }
        return '';
    };

    // AI text improvement (ONLY for specific fields)
    const improveText = async (fieldPath, context = 'professional') => {
        const text = getFieldValue(fieldPath);

        if (!text || text.trim().length === 0) {
            alert('Please enter some text first before improving it.');
            return;
        }

        setImproving(fieldPath);

        try {
            const response = await axios.post(
                `${API_BASE}/api/ai/improve-text`,
                { text, context },
                { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
            );

            updateFieldValue(fieldPath, response.data.improvedText);
        } catch (err) {
            console.error('AI improvement error:', err);
            alert('Failed to improve text. Please try again.');
        } finally {
            setImproving(null);
        }
    };

    // File upload handler
    const handleFileUpload = async (file, fieldPath) => {
        if (!file) return;

        const formDataUpload = new FormData();
        formDataUpload.append('file', file);

        try {
            const response = await axios.post(
                `${API_BASE}/api/portfolio/upload`,
                formDataUpload,
                {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`,
                        'Content-Type': 'multipart/form-data'
                    }
                }
            );

            updateFieldValue(fieldPath, response.data.url);
        } catch (err) {
            console.error('File upload error:', err);
            alert('Failed to upload file. Please try again.');
        }
    };

    // AI Improve Button Component (only for specific fields)
    const AIImproveButton = ({ fieldPath, aiContext = 'professional' }) => {
        const isImproving = improving === fieldPath;

        return (
            <button
                type="button"
                onClick={() => improveText(fieldPath, aiContext)}
                disabled={isImproving}
                className="flex items-center gap-1 px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg text-sm font-medium hover:bg-purple-200 disabled:opacity-50 transition-all mt-2"
            >
                {isImproving ? <Loader className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {isImproving ? 'Improving...' : '✨ AI Improve'}
            </button>
        );
    };

    // Handle form submission
    const handleSubmit = async (templateSelected = null) => {
        const dataToSend = { ...formData };

        if (templateSelected) {
            dataToSend.template = templateSelected;
        }

        console.log('📤 Submitting portfolio data:', {
            hasBasicDetails: !!dataToSend.basicDetails,
            fullName: dataToSend.basicDetails?.fullName,
            professionalTitle: dataToSend.basicDetails?.professionalTitle,
            hasAboutMe: !!dataToSend.aboutMe,
            aboutMeLength: dataToSend.aboutMe?.length,
            projectsCount: dataToSend.projects?.length,
            template: dataToSend.template,
            skillsCount: {
                technical: dataToSend.skills?.technical?.length || 0,
                tools: dataToSend.skills?.tools?.length || 0,
                softSkills: dataToSend.skills?.softSkills?.length || 0
            }
        });

        // Validation
        if (!dataToSend.basicDetails?.fullName || !dataToSend.basicDetails?.professionalTitle) {
            setError('Name and title are required');
            setLoading(false);
            return;
        }

        if (!dataToSend.aboutMe) {
            setError('About Me is required');
            setLoading(false);
            return;
        }

        if (dataToSend.projects.length === 0) {
            setError('Please add at least one project');
            setLoading(false);
            return;
        }

        if (!dataToSend.template) {
            setError('Please select a template');
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            console.log('🚀 Sending request to backend...');
            const response = await axios.post(
                `${API_BASE}/api/portfolio/create`,
                dataToSend,
                {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
                }
            );

            console.log('✅ Portfolio created successfully:', response.data);

            if (response.data.portfolioId) {
                navigate(`/preview/${response.data.portfolioId}`);
            }
        } catch (err) {
            console.error('❌ Portfolio creation error:', err);
            console.error('Error response:', err.response?.data);
            setError(err.response?.data?.message || 'Error creating portfolio. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // Auto-generate when template selected
    const handleTemplateSelect = async (template) => {
        setFormData({ ...formData, template });
        setLoading(true);

        setTimeout(() => {
            handleSubmit(template);
        }, 300);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-8">
            <div className="max-w-4xl mx-auto">

                {/* Progress Bar */}
                <div className="mb-8">
                    <div className="flex items-center justify-between mb-4">
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                            <div key={s} className="flex items-center flex-1">
                                <div
                                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all ${s <= step
                                        ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                                        : 'bg-gray-300 text-gray-600'
                                        }`}
                                >
                                    {s < step ? <Check className="w-6 h-6" /> : s}
                                </div>
                                {s < 8 && (
                                    <div
                                        className={`flex-1 h-1 mx-2 transition-all ${s < step
                                            ? 'bg-gradient-to-r from-purple-600 to-pink-600'
                                            : 'bg-gray-300'
                                            }`}
                                    />
                                )}
                            </div>
                        ))}
                    </div>
                    <p className="text-center text-gray-600">
                        Step {step} of 8
                    </p>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-700">
                        {error}
                    </div>
                )}

                {/* STEP 1: Basic Details */}
                {step === 1 && (
                    <div className="bg-white rounded-xl shadow-sm p-8">
                        <h2 className="text-2xl font-bold text-gray-800 mb-6">👤 Basic Details</h2>

                        <div className="space-y-6">
                            {/* Full Name */}
                            <div>
                                <label className="block text-gray-700 font-semibold mb-2">Full Name *</label>
                                <input
                                    type="text"
                                    value={formData.basicDetails.fullName}
                                    onChange={(e) => setFormData({
                                        ...formData,
                                        basicDetails: { ...formData.basicDetails, fullName: e.target.value }
                                    })}
                                    placeholder="John Doe"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
                                />
                            </div>

                            {/* Professional Title - WITH AI IMPROVE */}
                            <div>
                                <label className="block text-gray-700 font-semibold mb-2">Professional Title *</label>
                                <input
                                    type="text"
                                    value={formData.basicDetails.professionalTitle}
                                    onChange={(e) => setFormData({
                                        ...formData,
                                        basicDetails: { ...formData.basicDetails, professionalTitle: e.target.value }
                                    })}
                                    placeholder="BE IT Student | Web Developer"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
                                />
                                <AIImproveButton fieldPath="basicDetails.professionalTitle" aiContext="professional" />
                            </div>

                            {/* Email */}
                            <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-gray-700 font-semibold mb-2">Email *</label>
                                    <input
                                        type="email"
                                        value={formData.basicDetails.email}
                                        onChange={(e) => setFormData({
                                            ...formData,
                                            basicDetails: { ...formData.basicDetails, email: e.target.value }
                                        })}
                                        placeholder="john@example.com"
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
                                    />
                                </div>
                            </div>

                            {/* Profile Photo */}
                            <div>
                                <label className="block text-gray-700 font-semibold mb-2">Profile Photo</label>
                                <div className="flex items-center gap-4">
                                    <label className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg cursor-pointer hover:bg-blue-200 transition-all">
                                        <Upload className="w-5 h-5" />
                                        Upload Photo
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={(e) => handleFileUpload(e.target.files[0], 'basicDetails.profilePhoto')}
                                            className="hidden"
                                        />
                                    </label>
                                    {formData.basicDetails.profilePhoto && (
                                        <div className="flex items-center gap-2">
                                            <img
                                                src={formData.basicDetails.profilePhoto}
                                                alt="Profile"
                                                className="w-16 h-16 rounded-full object-cover border-2 border-purple-300"
                                            />
                                            <button
                                                onClick={() => setFormData({
                                                    ...formData,
                                                    basicDetails: { ...formData.basicDetails, profilePhoto: '' }
                                                })}
                                                className="text-red-600 hover:text-red-800"
                                            >
                                                <X className="w-5 h-5" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* STEP 2: About Me - WITH AI IMPROVE */}
                {step === 2 && (
                    <div className="bg-white rounded-xl shadow-sm p-8">
                        <h2 className="text-2xl font-bold text-gray-800 mb-6">✍️ About Me (Very Important)</h2>

                        <textarea
                            value={formData.aboutMe}
                            onChange={(e) => setFormData({ ...formData, aboutMe: e.target.value })}
                            placeholder="Write a compelling bio about yourself, your experience, and what you're passionate about..."
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600 h-64"
                        />
                        <p className="text-gray-500 text-sm mt-2">{formData.aboutMe.length} / 1000 characters</p>

                        <AIImproveButton fieldPath="aboutMe" aiContext="bio" />
                    </div>
                )}

                {/* STEP 3: Skills */}
                {step === 3 && (
                    <div className="bg-white rounded-xl shadow-sm p-8">
                        <h2 className="text-2xl font-bold text-gray-800 mb-6">💻 Skills</h2>

                        {/* Technical Skills */}
                        <div className="mb-8">
                            <h3 className="text-lg font-semibold text-gray-700 mb-3">Technical Skills</h3>
                            <div className="flex gap-2 mb-3">
                                <input
                                    type="text"
                                    value={currentSkillInput.technical}
                                    onChange={(e) => setCurrentSkillInput({ ...currentSkillInput, technical: e.target.value })}
                                    placeholder="e.g., JavaScript, React, Node.js"
                                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
                                    onKeyPress={(e) => {
                                        if (e.key === 'Enter' && currentSkillInput.technical.trim()) {
                                            setFormData({
                                                ...formData,
                                                skills: {
                                                    ...formData.skills,
                                                    technical: [...formData.skills.technical, currentSkillInput.technical]
                                                }
                                            });
                                            setCurrentSkillInput({ ...currentSkillInput, technical: '' });
                                        }
                                    }}
                                />
                                <button
                                    onClick={() => {
                                        if (currentSkillInput.technical.trim()) {
                                            setFormData({
                                                ...formData,
                                                skills: {
                                                    ...formData.skills,
                                                    technical: [...formData.skills.technical, currentSkillInput.technical]
                                                }
                                            });
                                            setCurrentSkillInput({ ...currentSkillInput, technical: '' });
                                        }
                                    }}
                                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-semibold"
                                >
                                    Add
                                </button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {formData.skills.technical.map((skill, index) => (
                                    <span key={index} className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm flex items-center gap-2">
                                        {skill}
                                        <button
                                            onClick={() => setFormData({
                                                ...formData,
                                                skills: {
                                                    ...formData.skills,
                                                    technical: formData.skills.technical.filter((_, i) => i !== index)
                                                }
                                            })}
                                            className="text-purple-600 hover:text-purple-800 font-bold"
                                        >
                                            ✕
                                        </button>
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* Tools */}
                        <div className="mb-8">
                            <h3 className="text-lg font-semibold text-gray-700 mb-3">Tools & Technologies</h3>
                            <div className="flex gap-2 mb-3">
                                <input
                                    type="text"
                                    value={currentSkillInput.tools}
                                    onChange={(e) => setCurrentSkillInput({ ...currentSkillInput, tools: e.target.value })}
                                    placeholder="e.g., Git, Docker, AWS"
                                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
                                    onKeyPress={(e) => {
                                        if (e.key === 'Enter' && currentSkillInput.tools.trim()) {
                                            setFormData({
                                                ...formData,
                                                skills: {
                                                    ...formData.skills,
                                                    tools: [...formData.skills.tools, currentSkillInput.tools]
                                                }
                                            });
                                            setCurrentSkillInput({ ...currentSkillInput, tools: '' });
                                        }
                                    }}
                                />
                                <button
                                    onClick={() => {
                                        if (currentSkillInput.tools.trim()) {
                                            setFormData({
                                                ...formData,
                                                skills: {
                                                    ...formData.skills,
                                                    tools: [...formData.skills.tools, currentSkillInput.tools]
                                                }
                                            });
                                            setCurrentSkillInput({ ...currentSkillInput, tools: '' });
                                        }
                                    }}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
                                >
                                    Add
                                </button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {formData.skills.tools.map((tool, index) => (
                                    <span key={index} className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm flex items-center gap-2">
                                        {tool}
                                        <button
                                            onClick={() => setFormData({
                                                ...formData,
                                                skills: {
                                                    ...formData.skills,
                                                    tools: formData.skills.tools.filter((_, i) => i !== index)
                                                }
                                            })}
                                            className="text-blue-600 hover:text-blue-800 font-bold"
                                        >
                                            ✕
                                        </button>
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* Soft Skills */}
                        <div>
                            <h3 className="text-lg font-semibold text-gray-700 mb-3">Soft Skills</h3>
                            <div className="flex gap-2 mb-3">
                                <input
                                    type="text"
                                    value={currentSkillInput.softSkills}
                                    onChange={(e) => setCurrentSkillInput({ ...currentSkillInput, softSkills: e.target.value })}
                                    placeholder="e.g., Leadership, Communication, Problem Solving"
                                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
                                    onKeyPress={(e) => {
                                        if (e.key === 'Enter' && currentSkillInput.softSkills.trim()) {
                                            setFormData({
                                                ...formData,
                                                skills: {
                                                    ...formData.skills,
                                                    softSkills: [...formData.skills.softSkills, currentSkillInput.softSkills]
                                                }
                                            });
                                            setCurrentSkillInput({ ...currentSkillInput, softSkills: '' });
                                        }
                                    }}
                                />
                                <button
                                    onClick={() => {
                                        if (currentSkillInput.softSkills.trim()) {
                                            setFormData({
                                                ...formData,
                                                skills: {
                                                    ...formData.skills,
                                                    softSkills: [...formData.skills.softSkills, currentSkillInput.softSkills]
                                                }
                                            });
                                            setCurrentSkillInput({ ...currentSkillInput, softSkills: '' });
                                        }
                                    }}
                                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold"
                                >
                                    Add
                                </button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {formData.skills.softSkills.map((skill, index) => (
                                    <span key={index} className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm flex items-center gap-2">
                                        {skill}
                                        <button
                                            onClick={() => setFormData({
                                                ...formData,
                                                skills: {
                                                    ...formData.skills,
                                                    softSkills: formData.skills.softSkills.filter((_, i) => i !== index)
                                                }
                                            })}
                                            className="text-green-600 hover:text-green-800 font-bold"
                                        >
                                            ✕
                                        </button>
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* STEP 4: Projects - WITH AI IMPROVE ON DESCRIPTION */}
                {step === 4 && (
                    <div className="bg-white rounded-xl shadow-sm p-8">
                        <h2 className="text-2xl font-bold text-gray-800 mb-6">🚀 Projects</h2>

                        <div className="space-y-4 mb-6">
                            {/* Project Title */}
                            <div>
                                <label className="block text-gray-700 font-semibold mb-2">Project Title *</label>
                                <input
                                    type="text"
                                    value={currentProject.title}
                                    onChange={(e) => setCurrentProject({ ...currentProject, title: e.target.value })}
                                    placeholder="E-commerce Platform"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
                                />
                            </div>

                            {/* Project Description - WITH AI IMPROVE */}
                            <div>
                                <label className="block text-gray-700 font-semibold mb-2">Project Description *</label>
                                <textarea
                                    value={currentProject.description}
                                    onChange={(e) => setCurrentProject({ ...currentProject, description: e.target.value })}
                                    placeholder="Describe your project, its features, and impact..."
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600 h-24"
                                />
                                <AIImproveButton fieldPath="currentProject.description" aiContext="project" />
                            </div>

                            {/* Technologies */}
                            <div>
                                <label className="block text-gray-700 font-semibold mb-2">Technologies Used</label>
                                <input
                                    type="text"
                                    value={currentProject.technologies}
                                    onChange={(e) => setCurrentProject({ ...currentProject, technologies: e.target.value })}
                                    placeholder="React, Node.js, MongoDB"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
                                />
                            </div>

                            {/* Links */}
                            <div className="grid md:grid-cols-2 gap-4">
                                <input
                                    type="url"
                                    value={currentProject.liveLink}
                                    onChange={(e) => setCurrentProject({ ...currentProject, liveLink: e.target.value })}
                                    placeholder="Live Demo Link (optional)"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
                                />

                                <input
                                    type="url"
                                    value={currentProject.githubLink}
                                    onChange={(e) => setCurrentProject({ ...currentProject, githubLink: e.target.value })}
                                    placeholder="GitHub Link (optional)"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
                                />
                            </div>

                            {/* Screenshot Upload */}
                            <div>
                                <label className="block text-gray-700 font-semibold mb-2">Project Screenshot</label>
                                <div className="flex items-center gap-4">
                                    <label className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg cursor-pointer hover:bg-blue-200 transition-all">
                                        <Upload className="w-5 h-5" />
                                        Upload Screenshot
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={(e) => handleFileUpload(e.target.files[0], 'currentProject.screenshot')}
                                            className="hidden"
                                        />
                                    </label>
                                    {currentProject.screenshot && (
                                        <div className="flex items-center gap-2">
                                            <img
                                                src={currentProject.screenshot}
                                                alt="Project"
                                                className="w-20 h-20 rounded object-cover border-2 border-purple-300"
                                            />
                                            <button
                                                onClick={() => setCurrentProject({ ...currentProject, screenshot: '' })}
                                                className="text-red-600 hover:text-red-800"
                                            >
                                                <X className="w-5 h-5" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <button
                                onClick={() => {
                                    if (currentProject.title && currentProject.description) {
                                        setFormData({
                                            ...formData,
                                            projects: [...formData.projects, currentProject]
                                        });
                                        setCurrentProject({
                                            title: '',
                                            description: '',
                                            technologies: '',
                                            liveLink: '',
                                            githubLink: '',
                                            screenshot: ''
                                        });
                                    }
                                }}
                                className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-semibold"
                            >
                                + Add Project
                            </button>
                        </div>

                        {formData.projects.length > 0 && (
                            <div className="space-y-3">
                                {formData.projects.map((project, index) => (
                                    <div key={index} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                        <div className="flex justify-between items-start">
                                            <div className="flex-1">
                                                <h4 className="font-bold text-gray-800">{project.title}</h4>
                                                <p className="text-gray-600 text-sm">{project.description}</p>
                                                <p className="text-purple-600 text-sm mt-1">{project.technologies}</p>
                                                {project.screenshot && (
                                                    <img src={project.screenshot} alt={project.title} className="w-16 h-16 mt-2 rounded object-cover" />
                                                )}
                                            </div>
                                            <button
                                                onClick={() => setFormData({
                                                    ...formData,
                                                    projects: formData.projects.filter((_, i) => i !== index)
                                                })}
                                                className="text-red-600 hover:text-red-800 font-bold ml-4"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {formData.projects.length === 0 && (
                            <p className="text-red-600 text-center font-semibold">⚠️ Please add at least one project</p>
                        )}
                    </div>
                )}

                {/* STEP 5: Achievements - WITH AI IMPROVE ON DESCRIPTION */}
                {step === 5 && (
                    <div className="bg-white rounded-xl shadow-sm p-8">
                        <h2 className="text-2xl font-bold text-gray-800 mb-6">🏆 Achievements & Certifications</h2>
                        <p className="text-gray-600 mb-6">(Optional - Press Next to skip)</p>

                        <div className="space-y-4 mb-6">
                            {/* Achievement Description - WITH AI IMPROVE */}
                            <div>
                                <label className="block text-gray-700 font-semibold mb-2">Achievement Description</label>
                                <textarea
                                    value={currentAchievement.description}
                                    onChange={(e) => setCurrentAchievement({ ...currentAchievement, description: e.target.value })}
                                    placeholder="Describe your achievement or certification..."
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600 h-24"
                                />
                                <AIImproveButton fieldPath="currentAchievement.description" aiContext="achievement" />
                            </div>

                            {/* Certificate Upload */}
                            <div>
                                <label className="block text-gray-700 font-semibold mb-2">Certificate / Proof (PDF)</label>
                                <div className="flex items-center gap-4">
                                    <label className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg cursor-pointer hover:bg-blue-200 transition-all">
                                        <FileText className="w-5 h-5" />
                                        Upload Certificate
                                        <input
                                            type="file"
                                            accept=".pdf,image/*"
                                            onChange={(e) => handleFileUpload(e.target.files[0], 'currentAchievement.certificate')}
                                            className="hidden"
                                        />
                                    </label>
                                    {currentAchievement.certificate && (
                                        <div className="flex items-center gap-2">
                                            <span className="text-green-600 text-sm">✓ Uploaded</span>
                                            <button
                                                onClick={() => setCurrentAchievement({ ...currentAchievement, certificate: '' })}
                                                className="text-red-600 hover:text-red-800"
                                            >
                                                <X className="w-5 h-5" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <button
                                onClick={() => {
                                    if (currentAchievement.description) {
                                        setFormData({
                                            ...formData,
                                            achievements: [...formData.achievements, currentAchievement]
                                        });
                                        setCurrentAchievement({ description: '', certificate: '' });
                                    }
                                }}
                                className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-semibold"
                            >
                                + Add Achievement
                            </button>
                        </div>

                        {formData.achievements.length > 0 && (
                            <div className="space-y-3">
                                {formData.achievements.map((ach, index) => (
                                    <div key={index} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="text-gray-800">{ach.description}</p>
                                                {ach.certificate && <span className="text-green-600 text-sm">✓ Certificate attached</span>}
                                            </div>
                                            <button
                                                onClick={() => setFormData({
                                                    ...formData,
                                                    achievements: formData.achievements.filter((_, i) => i !== index)
                                                })}
                                                className="text-red-600 hover:text-red-800 font-bold"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* STEP 6: Experience - WITH AI IMPROVE ON DESCRIPTION */}
                {step === 6 && (
                    <div className="bg-white rounded-xl shadow-sm p-8">
                        <h2 className="text-2xl font-bold text-gray-800 mb-6">💼 Experience / Internship</h2>
                        <p className="text-gray-600 mb-6">(Optional - Press Next to skip)</p>

                        <div className="space-y-4 mb-6">
                            {/* Role */}
                            <div>
                                <label className="block text-gray-700 font-semibold mb-2">Role / Position</label>
                                <input
                                    type="text"
                                    value={currentExperience.role}
                                    onChange={(e) => setCurrentExperience({ ...currentExperience, role: e.target.value })}
                                    placeholder="Software Developer Intern"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
                                />
                            </div>

                            {/* Company & Duration */}
                            <div className="grid md:grid-cols-2 gap-4">
                                <input
                                    type="text"
                                    value={currentExperience.company}
                                    onChange={(e) => setCurrentExperience({ ...currentExperience, company: e.target.value })}
                                    placeholder="Company / Organization Name"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
                                />

                                <input
                                    type="text"
                                    value={currentExperience.duration}
                                    onChange={(e) => setCurrentExperience({ ...currentExperience, duration: e.target.value })}
                                    placeholder="Jan 2023 - Mar 2023"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
                                />
                            </div>

                            {/* Work Description - WITH AI IMPROVE */}
                            <div>
                                <label className="block text-gray-700 font-semibold mb-2">Work Description</label>
                                <textarea
                                    value={currentExperience.description}
                                    onChange={(e) => setCurrentExperience({ ...currentExperience, description: e.target.value })}
                                    placeholder="Describe your responsibilities and achievements..."
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600 h-24"
                                />
                                <AIImproveButton fieldPath="currentExperience.description" aiContext="experience" />
                            </div>

                            <button
                                onClick={() => {
                                    if (currentExperience.role && currentExperience.company) {
                                        setFormData({
                                            ...formData,
                                            experience: [...formData.experience, currentExperience]
                                        });
                                        setCurrentExperience({ role: '', company: '', duration: '', description: '' });
                                    }
                                }}
                                className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-semibold"
                            >
                                + Add Experience
                            </button>
                        </div>

                        {formData.experience.length > 0 && (
                            <div className="space-y-3">
                                {formData.experience.map((exp, index) => (
                                    <div key={index} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h4 className="font-bold text-gray-800">{exp.role}</h4>
                                                <p className="text-gray-600">{exp.company}</p>
                                                <p className="text-gray-500 text-sm">{exp.duration}</p>
                                                <p className="text-gray-700 text-sm mt-1">{exp.description}</p>
                                            </div>
                                            <button
                                                onClick={() => setFormData({
                                                    ...formData,
                                                    experience: formData.experience.filter((_, i) => i !== index)
                                                })}
                                                className="text-red-600 hover:text-red-800 font-bold"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* STEP 7: Social Links */}
                {step === 7 && (
                    <div className="bg-white rounded-xl shadow-sm p-8">
                        <h2 className="text-2xl font-bold text-gray-800 mb-6">🔗 Contact & Social Links</h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-gray-700 font-semibold mb-2">LinkedIn Profile</label>
                                <input
                                    type="url"
                                    value={formData.socialLinks.linkedin}
                                    onChange={(e) => setFormData({
                                        ...formData,
                                        socialLinks: { ...formData.socialLinks, linkedin: e.target.value }
                                    })}
                                    placeholder="https://linkedin.com/in/yourprofile"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
                                />
                            </div>

                            <div>
                                <label className="block text-gray-700 font-semibold mb-2">GitHub Profile</label>
                                <input
                                    type="url"
                                    value={formData.socialLinks.github}
                                    onChange={(e) => setFormData({
                                        ...formData,
                                        socialLinks: { ...formData.socialLinks, github: e.target.value }
                                    })}
                                    placeholder="https://github.com/yourprofile"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
                                />
                            </div>

                            <div>
                                <label className="block text-gray-700 font-semibold mb-2">Twitter Profile</label>
                                <input
                                    type="url"
                                    value={formData.socialLinks.twitter}
                                    onChange={(e) => setFormData({
                                        ...formData,
                                        socialLinks: { ...formData.socialLinks, twitter: e.target.value }
                                    })}
                                    placeholder="https://twitter.com/yourprofile"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
                                />
                            </div>

                            <div>
                                <label className="block text-gray-700 font-semibold mb-2">Instagram Profile</label>
                                <input
                                    type="url"
                                    value={formData.socialLinks.instagram}
                                    onChange={(e) => setFormData({
                                        ...formData,
                                        socialLinks: { ...formData.socialLinks, instagram: e.target.value }
                                    })}
                                    placeholder="https://instagram.com/yourprofile"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* STEP 8: Template Selection */}
                {step === 8 && (
                    <div className="bg-white rounded-xl shadow-sm p-8">
                        <h2 className="text-2xl font-bold text-gray-800 mb-2">🎨 Choose Your Design</h2>
                        <p className="text-gray-600 mb-8">
                            Select a template and your portfolio will be generated instantly! ✨
                        </p>

                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <TemplateCard
                                name="Minimalist White"
                                desc="Clean, simple & elegant"
                                bgColor="bg-white"
                                accentColor="bg-black"
                                selected={formData.template === 'MINIMAL_WHITE'}
                                onSelect={() => handleTemplateSelect('MINIMAL_WHITE')}
                                disabled={loading}
                            />

                            <TemplateCard
                                name="Modern Dark"
                                desc="Sleek & sophisticated"
                                bgColor="bg-gray-900"
                                accentColor="bg-blue-500"
                                selected={formData.template === 'MODERN_DARK'}
                                onSelect={() => handleTemplateSelect('MODERN_DARK')}
                                disabled={loading}
                            />

                            <TemplateCard
                                name="Creative Gradient"
                                desc="Bold & vibrant"
                                bgColor="bg-gradient-to-br from-pink-400 to-purple-600"
                                accentColor="bg-white"
                                selected={formData.template === 'CREATIVE_GRADIENT'}
                                onSelect={() => handleTemplateSelect('CREATIVE_GRADIENT')}
                                disabled={loading}
                            />

                            <TemplateCard
                                name="Corporate Blue"
                                desc="Professional & trustworthy"
                                bgColor="bg-gradient-to-br from-blue-600 to-blue-800"
                                accentColor="bg-white"
                                selected={formData.template === 'CORPORATE_BLUE'}
                                onSelect={() => handleTemplateSelect('CORPORATE_BLUE')}
                                disabled={loading}
                            />

                            <TemplateCard
                                name="Tech Green"
                                desc="Modern & fresh"
                                bgColor="bg-gradient-to-br from-green-400 to-emerald-600"
                                accentColor="bg-white"
                                selected={formData.template === 'TECH_GREEN'}
                                onSelect={() => handleTemplateSelect('TECH_GREEN')}
                                disabled={loading}
                            />

                            <TemplateCard
                                name="Elegant Purple"
                                desc="Sophisticated & creative"
                                bgColor="bg-gradient-to-br from-purple-500 to-violet-700"
                                accentColor="bg-white"
                                selected={formData.template === 'ELEGANT_PURPLE'}
                                onSelect={() => handleTemplateSelect('ELEGANT_PURPLE')}
                                disabled={loading}
                            />

                            <TemplateCard
                                name="Sunset Orange"
                                desc="Energetic & warm"
                                bgColor="bg-gradient-to-br from-orange-400 to-red-600"
                                accentColor="bg-white"
                                selected={formData.template === 'SUNSET_ORANGE'}
                                onSelect={() => handleTemplateSelect('SUNSET_ORANGE')}
                                disabled={loading}
                            />

                            <TemplateCard
                                name="Ocean Teal"
                                desc="Calm & professional"
                                bgColor="bg-gradient-to-br from-teal-400 to-cyan-600"
                                accentColor="bg-white"
                                selected={formData.template === 'OCEAN_TEAL'}
                                onSelect={() => handleTemplateSelect('OCEAN_TEAL')}
                                disabled={loading}
                            />

                            <TemplateCard
                                name="Monochrome"
                                desc="Timeless & minimal"
                                bgColor="bg-gradient-to-br from-gray-700 to-gray-900"
                                accentColor="bg-white"
                                selected={formData.template === 'MONOCHROME'}
                                onSelect={() => handleTemplateSelect('MONOCHROME')}
                                disabled={loading}
                            />

                            <TemplateCard
                                name="Neon Cyberpunk"
                                desc="Futuristic & bold"
                                bgColor="bg-gray-900"
                                accentColor="bg-cyan-400"
                                selected={formData.template === 'NEON_CYBERPUNK'}
                                onSelect={() => handleTemplateSelect('NEON_CYBERPUNK')}
                                disabled={loading}
                            />
                        </div>

                        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
                            <p className="text-blue-900 font-semibold">✨ Just click any template to instantly generate your portfolio!</p>
                            <p className="text-blue-800 text-sm mt-2">No more design steps needed - we'll create your professional portfolio right away.</p>
                        </div>
                    </div>
                )}

                {/* Navigation Buttons */}
                <div className="flex justify-between mt-8">
                    {step > 1 && (
                        <button
                            onClick={() => setStep(step - 1)}
                            disabled={loading}
                            className="flex items-center space-x-2 px-6 py-3 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                        >
                            <ArrowLeft className="w-5 h-5" />
                            <span>Previous</span>
                        </button>
                    )}

                    {step < 8 ? (
                        <button
                            onClick={() => {
                                if (step === 1 && (!formData.basicDetails.fullName || !formData.basicDetails.professionalTitle || !formData.basicDetails.email)) {
                                    setError('Please fill in all required fields');
                                    return;
                                }
                                if (step === 2 && !formData.aboutMe) {
                                    setError('Please write your about me section');
                                    return;
                                }
                                if (step === 4 && formData.projects.length === 0) {
                                    setError('Please add at least one project');
                                    return;
                                }
                                setError(null);
                                setStep(step + 1);
                            }}
                            disabled={loading}
                            className="flex items-center space-x-2 px-6 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 ml-auto disabled:opacity-50"
                        >
                            <span>Next</span>
                            <ArrowRight className="w-5 h-5" />
                        </button>
                    ) : (
                        <div className="text-right ml-auto">
                            <p className="text-sm text-gray-600 mb-2">Click any template to generate</p>
                            {loading && (
                                <div className="flex items-center gap-2 text-purple-600 font-semibold">
                                    <Loader className="w-5 h-5 animate-spin" />
                                    <span>Generating your portfolio...</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// Template Card Component
const TemplateCard = ({ name, desc, bgColor, accentColor, selected, onSelect, disabled }) => (
    <button
        onClick={onSelect}
        disabled={disabled}
        className={`text-left border-2 rounded-xl p-4 transition-all ${selected
            ? 'border-purple-500 bg-purple-50 shadow-lg scale-105'
            : 'border-gray-200 hover:border-purple-300 hover:shadow-md hover:scale-102'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
    >
        <div className={`w-full h-40 ${bgColor} rounded-lg mb-4 flex items-center justify-center overflow-hidden`}>
            <div className="text-center p-4">
                <div className={`w-12 h-12 ${accentColor} rounded-full mx-auto mb-2`}></div>
                <div className={`h-2 w-20 ${accentColor} mx-auto mb-1 rounded`}></div>
                <div className={`h-1 w-24 ${accentColor} mx-auto rounded opacity-60`}></div>
            </div>
        </div>
        <h3 className="font-bold text-gray-800 mb-1">{name}</h3>
        <p className="text-sm text-gray-600 mb-3">{desc}</p>

        {selected && (
            <div className="flex items-center gap-2 text-purple-600 font-semibold">
                <Check className="w-5 h-5" />
                <span>Generating...</span>
            </div>
        )}
    </button>
);

export default CreatePortfolio;
