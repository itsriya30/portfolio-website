import { Link } from 'react-router-dom';
import { Sparkles, Code, Palette, Rocket, CheckCircle, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import AnimatedShowcase from './AnimatedShowcase';

export default function LandingPage() {
    const fadeInUp = {
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.6 }
    };

    const stagger = {
        animate: {
            transition: {
                staggerChildren: 0.1
            }
        }
    };

    return (
        <div className="min-h-screen bg-white font-sans">
            {/* Navigation */}
            <nav className="fixed w-full bg-white/80 backdrop-blur-md z-50 border-b border-gray-100">
                <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent"
                    >
                        Portify
                    </motion.div>
                    <div className="hidden md:flex space-x-8 text-gray-600 font-medium">
                        <a href="#features" className="hover:text-purple-600 transition">Features</a>
                        <a href="#how-it-works" className="hover:text-purple-600 transition">How it works</a>
                        <Link to="/login" className="hover:text-purple-600 transition">Login</Link>
                    </div>
                    <Link
                        to="/signup"
                        className="bg-purple-600 text-white px-6 py-2 rounded-full font-medium hover:bg-purple-700 transition transform hover:scale-105"
                    >
                        Get Started
                    </Link>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="pt-32 pb-20 px-6">
                <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
                    <motion.div
                        initial="initial"
                        animate="animate"
                        variants={stagger}
                        className="space-y-8"
                    >
                        <motion.div variants={fadeInUp} className="inline-flex items-center space-x-2 bg-purple-50 text-purple-700 px-4 py-2 rounded-full font-medium">
                            <Sparkles className="w-4 h-4" />
                            <span>AI-Powered Portfolio Builder</span>
                        </motion.div>

                        <motion.h1 variants={fadeInUp} className="text-5xl lg:text-6xl font-black text-gray-900 leading-tight">
                            Craft Your Perfect Profile with <span className="text-purple-600">AI Magic</span>
                        </motion.h1>

                        <motion.p variants={fadeInUp} className="text-xl text-gray-600 leading-relaxed">
                            Stop struggling with code or complex designs. Describe yourself, answer a few questions, and let our AI build a stunning, professional portfolio in seconds.
                        </motion.p>

                        <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row gap-4">
                            <Link
                                to="/signup"
                                className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-8 py-4 rounded-full font-bold text-lg hover:shadow-lg hover:shadow-purple-500/30 transition transform hover:-translate-y-1 flex items-center justify-center space-x-2"
                            >
                                <Rocket className="w-5 h-5" />
                                <span>Build Now - It's Free</span>
                            </Link>
                            <a
                                href="#how-it-works"
                                className="bg-white text-gray-700 border border-gray-200 px-8 py-4 rounded-full font-bold text-lg hover:bg-gray-50 transition flex items-center justify-center"
                            >
                                See Examples
                            </a>
                        </motion.div>

                        <motion.div variants={fadeInUp} className="flex items-center space-x-8 text-sm text-gray-500 font-medium">
                            <div className="flex items-center space-x-2">
                                <CheckCircle className="w-4 h-4 text-green-500" />
                                <span>No Credit Card Required</span>
                            </div>
                            <div className="flex items-center space-x-2">
                                <CheckCircle className="w-4 h-4 text-green-500" />
                                <span>AI Design Generation</span>
                            </div>
                        </motion.div>
                    </motion.div>

                    {/* Animated Hero Image Showcase */}
                    <div className="relative">
                        <AnimatedShowcase />
                    </div>
                </div>
            </section>

            {/* Features Grid */}
            <section id="features" className="py-20 bg-gray-50">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="text-center max-w-2xl mx-auto mb-16">
                        <h2 className="text-3xl font-bold text-gray-900 mb-4">Everything You Need to Shine</h2>
                        <p className="text-gray-600 text-lg">Our platform combines powerful AI with intuitive tools to help you stand out in the job market.</p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        {[
                            {
                                icon: <Code className="w-8 h-8 text-purple-600" />,
                                title: "Zero Coding Required",
                                desc: "Focus on your content. We'll handle the HTML, CSS, and deployment logic."
                            },
                            {
                                icon: <Palette className="w-8 h-8 text-pink-600" />,
                                title: "AI Design System",
                                desc: "Simply describe your vibe (e.g., 'minimalist dark mode'), and watch the magic happen."
                            },
                            {
                                icon: <Sparkles className="w-8 h-8 text-blue-600" />,
                                title: "Content Enhancement",
                                desc: "Our AI helps polish your bio and project descriptions to sound more professional."
                            }
                        ].map((feature, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.1 }}
                                className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-xl transition duration-300 border border-gray-100"
                            >
                                <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mb-6">
                                    {feature.icon}
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 mb-3">{feature.title}</h3>
                                <p className="text-gray-600 leading-relaxed">{feature.desc}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* How it Works */}
            <section id="how-it-works" className="py-20 px-6">
                <div className="max-w-7xl mx-auto">
                    <div className="grid md:grid-cols-2 gap-16 items-center">
                        <div>
                            <h2 className="text-3xl font-bold text-gray-900 mb-8">From Zero to Portfolio in Minutes</h2>
                            <div className="space-y-8">
                                {[
                                    { step: "01", title: "Sign Up", desc: "Create your free account to get started." },
                                    { step: "02", title: "Input Details", desc: "Add your projects, skills, and experience." },
                                    { step: "03", title: "AI Magic", desc: "Let AI write your bio and design your layout." },
                                    { step: "04", title: "Publish", desc: "Download your code or deploy instantly." }
                                ].map((item, i) => (
                                    <motion.div
                                        key={i}
                                        initial={{ opacity: 0, x: -20 }}
                                        whileInView={{ opacity: 1, x: 0 }}
                                        viewport={{ once: true }}
                                        transition={{ delay: i * 0.1 }}
                                        className="flex items-start space-x-6"
                                    >
                                        <div className="text-3xl font-black text-purple-200">{item.step}</div>
                                        <div>
                                            <h4 className="text-xl font-bold text-gray-900 mb-2">{item.title}</h4>
                                            <p className="text-gray-600">{item.desc}</p>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            viewport={{ once: true }}
                            className="bg-gray-900 rounded-2xl p-8 relative overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 w-64 h-64 bg-purple-600 rounded-full mix-blend-overlay filter blur-3xl opacity-20"></div>
                            <div className="absolute bottom-0 left-0 w-64 h-64 bg-pink-600 rounded-full mix-blend-overlay filter blur-3xl opacity-20"></div>

                            <div className="relative z-10 space-y-4">
                                <div className="h-4 bg-gray-700 rounded w-1/3"></div>
                                <div className="h-8 bg-gray-600 rounded w-3/4"></div>
                                <div className="h-32 bg-gray-800 rounded-xl border border-gray-700 p-4">
                                    <div className="flex space-x-2 mb-4">
                                        <div className="w-3 h-3 rounded-full bg-red-500"></div>
                                        <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="h-2 bg-gray-700 rounded w-full"></div>
                                        <div className="h-2 bg-gray-700 rounded w-5/6"></div>
                                        <div className="h-2 bg-gray-700 rounded w-4/6"></div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section className="py-20 px-6">
                <div className="max-w-4xl mx-auto bg-gradient-to-r from-purple-600 to-pink-600 rounded-3xl p-12 text-center text-white relative overflow-hidden">
                    <div className="relative z-10">
                        <h2 className="text-4xl font-bold mb-6">Ready to Boost Your Career?</h2>
                        <p className="text-lg text-purple-100 mb-8 max-w-2xl mx-auto">Join thousands of developers and designers who have already built their dream portfolios.</p>
                        <Link
                            to="/signup"
                            className="inline-flex items-center space-x-2 bg-white text-purple-600 px-8 py-4 rounded-full font-bold text-lg hover:bg-gray-50 transition transform hover:scale-105"
                        >
                            <span>Get Started Now</span>
                            <ArrowRight className="w-5 h-5" />
                        </Link>
                    </div>
                </div>
            </section>
        </div>
    );
}
