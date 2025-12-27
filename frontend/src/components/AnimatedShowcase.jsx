import React from 'react';
import { motion } from 'framer-motion';

export default function AnimatedShowcase() {
    return (
        <div className="relative w-full max-w-2xl mx-auto">
            {/* Background Glows */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full">
                <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl animate-pulse"></div>
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-pink-500/20 rounded-full blur-3xl animate-pulse delay-700"></div>
            </div>

            {/* Main Asset */}
            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1, ease: "easeOut" }}
                className="relative z-10"
            >
                {/* Floating Container */}
                <motion.div
                    animate={{
                        y: [0, -15, 0],
                        rotate: [0, 1, 0, -1, 0]
                    }}
                    transition={{
                        duration: 8,
                        repeat: Infinity,
                        ease: "easeInOut"
                    }}
                    className="relative cursor-pointer group"
                >
                    {/* The 3D Illustration */}
                    <img
                        src="/animated_hero.png"
                        alt="3D Portfolio Illustration"
                        className="rounded-3xl shadow-2xl border border-white/10 group-hover:shadow-purple-500/30 transition-shadow duration-500"
                    />

                    {/* Holographic Overlays (Simulated with CSS) */}
                    <div className="absolute inset-0 rounded-3xl bg-gradient-to-tr from-purple-500/10 to-transparent pointer-events-none"></div>

                    {/* Floating HUD Elements */}
                    <motion.div
                        animate={{ x: [0, 5, 0], y: [0, 5, 0] }}
                        transition={{ duration: 4, repeat: Infinity, delay: 0.5 }}
                        className="absolute -top-6 -right-6 bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/20 shadow-xl hidden lg:block"
                    >
                        <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500"></div>
                            <div className="space-y-1">
                                <div className="h-2 w-16 bg-white/40 rounded"></div>
                                <div className="h-1.5 w-10 bg-white/20 rounded"></div>
                            </div>
                        </div>
                    </motion.div>

                    <motion.div
                        animate={{ x: [0, -5, 0], y: [0, 10, 0] }}
                        transition={{ duration: 5, repeat: Infinity, delay: 1 }}
                        className="absolute -bottom-10 -left-10 bg-white/10 backdrop-blur-md p-6 rounded-2xl border border-white/20 shadow-xl hidden lg:block"
                    >
                        <div className="space-y-3">
                            <div className="h-2 w-24 bg-white/40 rounded"></div>
                            <div className="flex space-x-2">
                                <div className="h-8 w-8 bg-purple-500/40 rounded-lg"></div>
                                <div className="h-8 w-8 bg-pink-500/40 rounded-lg"></div>
                                <div className="h-8 w-8 bg-blue-500/40 rounded-lg"></div>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>

                {/* Reflection effect at bottom */}
                <div className="mt-12 h-px w-full bg-gradient-to-r from-transparent via-gray-200 to-transparent"></div>
                <div className="mt-2 text-center text-xs font-medium text-gray-400 tracking-widest uppercase">
                    Premium Interactive Design Engine
                </div>
            </motion.div>
        </div>
    );
}
