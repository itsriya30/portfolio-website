import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Loader, ArrowRight, ArrowLeft } from 'lucide-react';
import axios from 'axios';

export default function CreatePortfolio({ user }) {
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [aiLoading, setAiLoading] = useState(false);

    // Form data
    const [formData, setFormData] = useState({
        personalInfo: {
            name: user?.name || '',
            title: '',
            bio: '',
            email: user?.email || '',
            phone: '',
            linkedin: '',
            github: '',
            portfolio: ''
        },
        skills: [],
        education: [],
        experience: [],
        projects: [],
        designVision: ''
    });

    // Temporary inputs
    const [skillInput, setSkillInput] = useState('');
    const [currentEducation, setCurrentEducation] = useState({
        institution: '',
        degree: '',
        field: '',
        graduationYear: ''
    });
    const [currentExperience, setCurrentExperience] = useState({
        company: '',
        position: '',
        startDate: '',
        endDate: '',
        description: ''
    });
    const [currentProject, setCurrentProject] = useState({
        name: '',
        description: '',
        technologies: '',
        link: '',
        github: ''
    });

    const handlePersonalInfoChange = (e) => {
        setFormData({
            ...formData,
            personalInfo: {
                ...formData.personalInfo,
                [e.target.name]: e.target.value
            }
        });
    };

    const addSkill = () => {
        if (skillInput.trim()) {
            setFormData({
                ...formData,
                skills: [...formData.skills, skillInput.trim()]
            });
            setSkillInput('');
        }
    };

    const removeSkill = (index) => {
        setFormData({
            ...formData,
            skills: formData.skills.filter((_, i) => i !== index)
        });
    };

    const addEducation = () => {
        if (currentEducation.institution && currentEducation.degree) {
            setFormData({
                ...formData,
                education: [...formData.education, currentEducation]
            });
            setCurrentEducation({
                institution: '',
                degree: '',
                field: '',
                graduationYear: ''
            });
        }
    };

    const addExperience = () => {
        if (currentExperience.company && currentExperience.position) {
            setFormData({
                ...formData,
                experience: [...formData.experience, currentExperience]
            });
            setCurrentExperience({
                company: '',
                position: '',
                startDate: '',
                endDate: '',
                description: ''
            });
        }
    };

    const addProject = () => {
        if (currentProject.name && currentProject.description) {
            setFormData({
                ...formData,
                projects: [...formData.projects, currentProject]
            });
            setCurrentProject({
                name: '',
                description: '',
                technologies: '',
                link: '',
                github: ''
            });
        }
    };

    // AI Content Improvement (USP 1)
    const improveContent = async (field, content) => {
        setAiLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await axios.post(
                'http://localhost:5000/api/ai/improve-content',
                { field, content },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            return response.data.improvedContent;
        } catch (err) {
            console.error('Error improving content:', err);
            return content;
        } finally {
            setAiLoading(false);
        }
    };

    const handleImproveBio = async () => {
        const improved = await improveContent('bio', formData.personalInfo.bio);
        setFormData({
            ...formData,
            personalInfo: {
                ...formData.personalInfo,
                bio: improved
            }
        });
    };

    const handleImproveProjectDescription = async (index) => {
        const improved = await improveContent('project', formData.projects[index].description);
        const newProjects = [...formData.projects];
        newProjects[index].description = improved;
        setFormData({
            ...formData,
            projects: newProjects
        });
    };

    const handleSubmit = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await axios.post(
                'http://localhost:5000/api/portfolio/create',
                formData,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            // Navigate to preview
            navigate(`/preview/${response.data.portfolioId}`);
        } catch (err) {
            console.error('Error creating portfolio:', err);
            alert('Failed to create portfolio. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white shadow-sm">
                <div className="max-w-5xl mx-auto px-6 py-4 flex justify-between items-center">
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">Portify</h1>
                    <span className="text-gray-500 font-medium">Create New Portfolio</span>
                </div>
            </header>

            <div className="max-w-5xl mx-auto px-6 py-12">
                {/* Progress Bar */}
                <div className="mb-12">
                    <div className="flex items-center justify-between mb-4">
                        {['Personal Info', 'Skills & Education', 'Experience', 'Projects', 'Design Vision'].map((label, index) => (
                            <div key={index} className="flex flex-col items-center">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${step > index + 1 ? 'bg-green-500 text-white' :
                                    step === index + 1 ? 'bg-purple-600 text-white' :
                                        'bg-gray-300 text-gray-600'
                                    }`}>
                                    {step > index + 1 ? '✓' : index + 1}
                                </div>
                                <span className="text-xs mt-2 text-gray-600">{label}</span>
                            </div>
                        ))}
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                            className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${(step / 5) * 100}%` }}
                        />
                    </div>
                </div>

                {/* Step 1: Personal Information */}
                {step === 1 && (
                    <div className="bg-white rounded-xl shadow-sm p-8">
                        <h2 className="text-2xl font-bold text-gray-800 mb-6">Personal Information</h2>

                        <div className="space-y-6">
                            <div className="grid md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-gray-700 font-medium mb-2">Full Name *</label>
                                    <input
                                        type="text"
                                        name="name"
                                        value={formData.personalInfo.name}
                                        onChange={handlePersonalInfoChange}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                        placeholder="John Doe"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-gray-700 font-medium mb-2">Professional Title *</label>
                                    <input
                                        type="text"
                                        name="title"
                                        value={formData.personalInfo.title}
                                        onChange={handlePersonalInfoChange}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                        placeholder="Full Stack Developer"
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="block text-gray-700 font-medium">Bio / About Me *</label>
                                    <button
                                        onClick={handleImproveBio}
                                        disabled={!formData.personalInfo.bio || aiLoading}
                                        className="flex items-center space-x-2 text-purple-600 hover:text-purple-700 disabled:text-gray-400 disabled:cursor-not-allowed"
                                    >
                                        <Sparkles className="w-4 h-4" />
                                        <span className="text-sm font-medium">
                                            {aiLoading ? 'Improving...' : 'AI Improve'}
                                        </span>
                                    </button>
                                </div>
                                <textarea
                                    name="bio"
                                    value={formData.personalInfo.bio}
                                    onChange={handlePersonalInfoChange}
                                    rows="4"
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                    placeholder="Tell us about yourself, your passion, and what you do..."
                                    required
                                />
                                <p className="text-sm text-gray-500 mt-2">
                                    💡 Tip: Write a draft and use AI to make it more compelling!
                                </p>
                            </div>

                            <div className="grid md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-gray-700 font-medium mb-2">Email *</label>
                                    <input
                                        type="email"
                                        name="email"
                                        value={formData.personalInfo.email}
                                        onChange={handlePersonalInfoChange}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                        placeholder="your@email.com"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-gray-700 font-medium mb-2">Phone</label>
                                    <input
                                        type="tel"
                                        name="phone"
                                        value={formData.personalInfo.phone}
                                        onChange={handlePersonalInfoChange}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                        placeholder="+1 234 567 8900"
                                    />
                                </div>
                            </div>

                            <div className="grid md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-gray-700 font-medium mb-2">LinkedIn URL</label>
                                    <input
                                        type="url"
                                        name="linkedin"
                                        value={formData.personalInfo.linkedin}
                                        onChange={handlePersonalInfoChange}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                        placeholder="https://linkedin.com/in/yourprofile"
                                    />
                                </div>

                                <div>
                                    <label className="block text-gray-700 font-medium mb-2">GitHub URL</label>
                                    <input
                                        type="url"
                                        name="github"
                                        value={formData.personalInfo.github}
                                        onChange={handlePersonalInfoChange}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                        placeholder="https://github.com/yourusername"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Step 2: Skills & Education */}
                {step === 2 && (
                    <div className="bg-white rounded-xl shadow-sm p-8">
                        <h2 className="text-2xl font-bold text-gray-800 mb-6">Skills & Education</h2>

                        {/* Skills Section */}
                        <div className="mb-8">
                            <h3 className="text-xl font-semibold text-gray-800 mb-4">Technical Skills</h3>
                            <div className="flex space-x-2 mb-4">
                                <input
                                    type="text"
                                    value={skillInput}
                                    onChange={(e) => setSkillInput(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSkill())}
                                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                    placeholder="e.g., React, Python, Node.js"
                                />
                                <button
                                    onClick={addSkill}
                                    className="bg-purple-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-purple-700"
                                >
                                    Add
                                </button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {formData.skills.map((skill, index) => (
                                    <span
                                        key={index}
                                        className="bg-purple-100 text-purple-700 px-4 py-2 rounded-full flex items-center space-x-2"
                                    >
                                        <span>{skill}</span>
                                        <button
                                            onClick={() => removeSkill(index)}
                                            className="text-purple-900 hover:text-purple-700"
                                        >
                                            ×
                                        </button>
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* Education Section */}
                        <div>
                            <h3 className="text-xl font-semibold text-gray-800 mb-4">Education</h3>
                            <div className="space-y-4 mb-4">
                                <div className="grid md:grid-cols-2 gap-4">
                                    <input
                                        type="text"
                                        value={currentEducation.institution}
                                        onChange={(e) => setCurrentEducation({ ...currentEducation, institution: e.target.value })}
                                        className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                        placeholder="University Name"
                                    />
                                    <input
                                        type="text"
                                        value={currentEducation.degree}
                                        onChange={(e) => setCurrentEducation({ ...currentEducation, degree: e.target.value })}
                                        className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                        placeholder="Degree (e.g., B.Tech)"
                                    />
                                </div>
                                <div className="grid md:grid-cols-2 gap-4">
                                    <input
                                        type="text"
                                        value={currentEducation.field}
                                        onChange={(e) => setCurrentEducation({ ...currentEducation, field: e.target.value })}
                                        className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                        placeholder="Field of Study"
                                    />
                                    <input
                                        type="text"
                                        value={currentEducation.graduationYear}
                                        onChange={(e) => setCurrentEducation({ ...currentEducation, graduationYear: e.target.value })}
                                        className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                        placeholder="Graduation Year"
                                    />
                                </div>
                                <button
                                    onClick={addEducation}
                                    className="bg-purple-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-purple-700"
                                >
                                    Add Education
                                </button>
                            </div>

                            {/* Display added education */}
                            {formData.education.map((edu, index) => (
                                <div key={index} className="bg-gray-50 p-4 rounded-lg mb-2">
                                    <h4 className="font-semibold text-gray-800">{edu.degree} in {edu.field}</h4>
                                    <p className="text-gray-600">{edu.institution} • {edu.graduationYear}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Step 3: Experience */}
                {step === 3 && (
                    <div className="bg-white rounded-xl shadow-sm p-8">
                        <h2 className="text-2xl font-bold text-gray-800 mb-6">Work Experience</h2>

                        <div className="space-y-4 mb-4">
                            <div className="grid md:grid-cols-2 gap-4">
                                <input
                                    type="text"
                                    value={currentExperience.company}
                                    onChange={(e) => setCurrentExperience({ ...currentExperience, company: e.target.value })}
                                    className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                    placeholder="Company Name"
                                />
                                <input
                                    type="text"
                                    value={currentExperience.position}
                                    onChange={(e) => setCurrentExperience({ ...currentExperience, position: e.target.value })}
                                    className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                    placeholder="Position/Role"
                                />
                            </div>
                            <div className="grid md:grid-cols-2 gap-4">
                                <input
                                    type="text"
                                    value={currentExperience.startDate}
                                    onChange={(e) => setCurrentExperience({ ...currentExperience, startDate: e.target.value })}
                                    className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                    placeholder="Start Date (e.g., Jan 2023)"
                                />
                                <input
                                    type="text"
                                    value={currentExperience.endDate}
                                    onChange={(e) => setCurrentExperience({ ...currentExperience, endDate: e.target.value })}
                                    className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                    placeholder="End Date (or 'Present')"
                                />
                            </div>
                            <textarea
                                value={currentExperience.description}
                                onChange={(e) => setCurrentExperience({ ...currentExperience, description: e.target.value })}
                                rows="3"
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                placeholder="Describe your responsibilities and achievements..."
                            />
                            <button
                                onClick={addExperience}
                                className="bg-purple-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-purple-700"
                            >
                                Add Experience
                            </button>
                        </div>

                        {/* Display added experience */}
                        {formData.experience.map((exp, index) => (
                            <div key={index} className="bg-gray-50 p-4 rounded-lg mb-2">
                                <h4 className="font-semibold text-gray-800">{exp.position}</h4>
                                <p className="text-gray-600">{exp.company} • {exp.startDate} - {exp.endDate}</p>
                                <p className="text-gray-700 mt-2">{exp.description}</p>
                            </div>
                        ))}

                        <p className="text-sm text-gray-500 mt-4">
                            💡 Tip: You can skip this if you don't have work experience yet
                        </p>
                    </div>
                )}

                {/* Step 4: Projects */}
                {step === 4 && (
                    <div className="bg-white rounded-xl shadow-sm p-8">
                        <h2 className="text-2xl font-bold text-gray-800 mb-6">Projects</h2>

                        <div className="space-y-4 mb-4">
                            <input
                                type="text"
                                value={currentProject.name}
                                onChange={(e) => setCurrentProject({ ...currentProject, name: e.target.value })}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                placeholder="Project Name"
                            />
                            <div>
                                <textarea
                                    value={currentProject.description}
                                    onChange={(e) => setCurrentProject({ ...currentProject, description: e.target.value })}
                                    rows="3"
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                    placeholder="Project description..."
                                />
                            </div>
                            <input
                                type="text"
                                value={currentProject.technologies}
                                onChange={(e) => setCurrentProject({ ...currentProject, technologies: e.target.value })}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                placeholder="Technologies used (comma separated)"
                            />
                            <div className="grid md:grid-cols-2 gap-4">
                                <input
                                    type="url"
                                    value={currentProject.link}
                                    onChange={(e) => setCurrentProject({ ...currentProject, link: e.target.value })}
                                    className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                    placeholder="Live Demo URL (optional)"
                                />
                                <input
                                    type="url"
                                    value={currentProject.github}
                                    onChange={(e) => setCurrentProject({ ...currentProject, github: e.target.value })}
                                    className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                    placeholder="GitHub URL (optional)"
                                />
                            </div>
                            <button
                                onClick={addProject}
                                className="bg-purple-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-purple-700"
                            >
                                Add Project
                            </button>
                        </div>

                        {/* Display added projects */}
                        {formData.projects.map((project, index) => (
                            <div key={index} className="bg-gray-50 p-4 rounded-lg mb-2">
                                <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                        <h4 className="font-semibold text-gray-800">{project.name}</h4>
                                        <p className="text-gray-700 mt-2">{project.description}</p>
                                        <p className="text-purple-600 text-sm mt-2">{project.technologies}</p>
                                    </div>
                                    <button
                                        onClick={() => handleImproveProjectDescription(index)}
                                        disabled={aiLoading}
                                        className="flex items-center space-x-2 text-purple-600 hover:text-purple-700 disabled:text-gray-400"
                                    >
                                        <Sparkles className="w-4 h-4" />
                                        <span className="text-sm">{aiLoading ? 'Improving...' : 'AI Improve'}</span>
                                    </button>
                                </div>
                            </div>
                        ))}

                        <p className="text-sm text-gray-500 mt-4">
                            💡 Tip: Add at least 2-3 projects to make your portfolio stand out
                        </p>
                    </div>
                )}

                {/* Step 5: Design Vision (USP 4) */}
                {step === 5 && (
                    <div className="bg-white rounded-xl shadow-sm p-8">
                        <h2 className="text-2xl font-bold text-gray-800 mb-6">Describe Your Design Vision</h2>

                        <div className="mb-6">
                            <p className="text-gray-600 mb-4">
                                This is where the magic happens! Describe exactly how you want your portfolio to look and feel.
                                Be as detailed or simple as you like—our AI will bring your vision to life.
                            </p>

                            <textarea
                                value={formData.designVision}
                                onChange={(e) => setFormData({ ...formData, designVision: e.target.value })}
                                rows="8"
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                placeholder="Example: I want a dark navy blue background with gold accents. Big bold white headings. My projects should be shown as cards with hover effects that lift them up slightly. I want smooth scrolling and fade-in animations when sections come into view. Professional but modern vibe."
                                required
                            />
                        </div>

                        {/* Examples */}
                        <div className="bg-purple-50 p-6 rounded-lg">
                            <h3 className="font-semibold text-purple-900 mb-3">💡 Need inspiration? Try these:</h3>
                            <div className="space-y-2 text-sm text-purple-800">
                                <button
                                    onClick={() => setFormData({ ...formData, designVision: "Minimalist design with pure black and white. Lots of whitespace. Simple typography. Projects in a clean vertical list. No fancy animations, just clean and professional. Like Apple's website." })}
                                    className="block w-full text-left p-3 bg-white rounded hover:bg-purple-100 transition"
                                >
                                    <strong>Minimalist:</strong> "Minimalist design with pure black and white. Lots of whitespace..."
                                </button>
                                <button
                                    onClick={() => setFormData({ ...formData, designVision: "Bright white background with pastel pink and blue accents. Playful and fun, like a designer's portfolio. Large images for my projects in a masonry grid. Rounded corners everywhere. Cute icons for my skills." })}
                                    className="block w-full text-left p-3 bg-white rounded hover:bg-purple-100 transition"
                                >
                                    <strong>Creative:</strong> "Bright white background with pastel pink and blue accents. Playful and fun..."
                                </button>
                                <button
                                    onClick={() => setFormData({ ...formData, designVision: "Futuristic tech vibe. Dark background with glowing cyan and purple gradients. Geometric shapes. Glassmorphism effect on cards. Smooth parallax scrolling. Tech-y monospace font for headings." })}
                                    className="block w-full text-left p-3 bg-white rounded hover:bg-purple-100 transition"
                                >
                                    <strong>Tech/Futuristic:</strong> "Futuristic tech vibe. Dark background with glowing cyan..."
                                </button>
                                <button
                                    onClick={() => setFormData({ ...formData, designVision: "Professional corporate style. Navy blue and white color scheme. Clean grid layout for projects. Subtle animations. LinkedIn-style professional look but more modern." })}
                                    className="block w-full text-left p-3 bg-white rounded hover:bg-purple-100 transition"
                                >
                                    <strong>Professional:</strong> "Professional corporate style. Navy blue and white color scheme..."
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Navigation Buttons */}
                <div className="flex justify-between mt-8">
                    {step > 1 && (
                        <button
                            onClick={() => setStep(step - 1)}
                            className="flex items-center space-x-2 px-6 py-3 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50"
                        >
                            <ArrowLeft className="w-5 h-5" />
                            <span>Previous</span>
                        </button>
                    )}

                    {step < 5 ? (
                        <button
                            onClick={() => setStep(step + 1)}
                            className="flex items-center space-x-2 px-6 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 ml-auto"
                        >
                            <span>Next</span>
                            <ArrowRight className="w-5 h-5" />
                        </button>
                    ) : (
                        <button
                            onClick={handleSubmit}
                            disabled={loading || !formData.designVision}
                            className="flex items-center space-x-2 px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-pink-700 ml-auto disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <>
                                    <Loader className="w-5 h-5 animate-spin" />
                                    <span>Creating Your Portfolio...</span>
                                </>
                            ) : (
                                <>
                                    <Sparkles className="w-5 h-5" />
                                    <span>Generate Portfolio</span>
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
