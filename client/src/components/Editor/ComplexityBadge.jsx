import React, { useState } from 'react';
import { FiChevronDown, FiChevronUp, FiX, FiCheckCircle } from 'react-icons/fi';
import { HiSparkles } from 'react-icons/hi2';

const RATING_STYLES = {
    excellent: {
        color: 'text-green-400',
        bg: 'bg-green-500/10',
        border: 'border-green-500/20',
        barColor: 'bg-green-500',
        percent: 100,
        label: 'Optimized'
    },
    good: {
        color: 'text-emerald-300',
        bg: 'bg-emerald-500/10',
        border: 'border-emerald-500/20',
        barColor: 'bg-emerald-500',
        percent: 80,
        label: 'Efficient'
    },
    moderate: {
        color: 'text-amber-400',
        bg: 'bg-amber-500/10',
        border: 'border-amber-500/20',
        barColor: 'bg-amber-500',
        percent: 50,
        label: 'Sub-optimal'
    },
    poor: {
        color: 'text-red-400',
        bg: 'bg-red-500/10',
        border: 'border-red-500/20',
        barColor: 'bg-red-500',
        percent: 20,
        label: 'Inefficient'
    }
};

const ComplexityBadge = ({ result, onClose }) => {
    const [isExpanded, setIsExpanded] = useState(true);

    if (!result) return null;

    const { time, space, explanation, rating = 'moderate' } = result;
    const style = RATING_STYLES[rating] || RATING_STYLES.moderate;

    return (
        <div className="complexity-badge m-4 bg-sidebar/60 border border-border rounded-xl backdrop-blur-md overflow-hidden transition-all shadow-lg">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-black/20 border-b border-border/50">
                <div className="flex items-center gap-2">
                    <HiSparkles className="w-4 h-4 text-purple-400" />
                    <span className="text-xs font-semibold text-text uppercase tracking-wider">AI Complexity Analysis</span>
                </div>
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => setIsExpanded(!isExpanded)} 
                        className="text-gray-400 hover:text-white p-1 rounded hover:bg-white/5 transition-all"
                    >
                        {isExpanded ? <FiChevronUp className="w-4 h-4" /> : <FiChevronDown className="w-4 h-4" />}
                    </button>
                    {onClose && (
                        <button 
                            onClick={onClose} 
                            className="text-gray-400 hover:text-white p-1 rounded hover:bg-white/5 transition-all"
                        >
                            <FiX className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            {/* Content */}
            {isExpanded && (
                <div className="p-4 flex flex-col gap-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Time Complexity */}
                        <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-black/30 border border-white/5">
                            <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Time Complexity</span>
                            <div className="flex items-baseline gap-2">
                                <span className={`text-xl font-bold font-mono ${style.color}`}>
                                    {time}
                                </span>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${style.bg} ${style.color} border ${style.border}`}>
                                    {style.label}
                                </span>
                            </div>
                        </div>

                        {/* Space Complexity */}
                        <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-black/30 border border-white/5">
                            <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Space Complexity</span>
                            <div className="flex items-baseline gap-2">
                                <span className="text-xl font-bold font-mono text-cyan-300">
                                    {space}
                                </span>
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 font-medium">
                                    Memory
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Efficiency Gauge */}
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-400">Efficiency Score</span>
                            <span className={`font-semibold ${style.color}`}>{style.percent}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden border border-white/5">
                            <div 
                                className={`h-full ${style.barColor} rounded-full transition-all duration-500`} 
                                style={{ width: `${style.percent}%` }}
                            />
                        </div>
                    </div>

                    {/* Explanation */}
                    {explanation && (
                        <div className="flex flex-col gap-1.5 bg-black/20 p-3 rounded-lg border border-white/5">
                            <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider flex items-center gap-1">
                                <FiCheckCircle className="w-3.5 h-3.5 text-purple-400" /> Explanation
                            </span>
                            <p className="text-xs text-gray-300 leading-relaxed font-sans">
                                {explanation}
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ComplexityBadge;
