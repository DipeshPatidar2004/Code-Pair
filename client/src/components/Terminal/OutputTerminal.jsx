import React from 'react';
import { FiX, FiTerminal, FiChevronDown, FiChevronUp } from 'react-icons/fi';

const OutputTerminal = ({ result, onClose, collapsed = false, onToggleCollapse, style }) => {
    return (
        <div className="output-terminal h-full w-full" style={style}>
            <div className="output-terminal-header">
                <div className="flex items-center gap-2 text-[#B3B3B3] font-semibold text-sm">
                    <FiTerminal className="text-[#00C8FF]" /> Output
                    {result.status === 'running' && <span className="text-yellow-500 animate-pulse text-xs ml-2">Running...</span>}
                    {result.status === 'success' && <span className="text-[#6A9955] text-xs ml-2">Success</span>}
                    {result.status === 'error' && <span className="text-red-400 text-xs ml-2">Error</span>}
                </div>
                <div className="flex items-center gap-1">
                    {onToggleCollapse && (
                        <button
                            onClick={onToggleCollapse}
                            className="text-[#6B6B6B] hover:text-white transition-colors p-1 rounded hover:bg-[rgba(255,255,255,0.04)]"
                            title={collapsed ? 'Expand terminal' : 'Collapse terminal'}
                        >
                            {collapsed ? <FiChevronUp /> : <FiChevronDown />}
                        </button>
                    )}
                    <button onClick={onClose} className="text-[#6B6B6B] hover:text-white transition-colors p-1 rounded hover:bg-[rgba(255,255,255,0.04)]">
                        <FiX />
                    </button>
                </div>
            </div>
            {!collapsed && (
                <div className="output-terminal-content custom-scrollbar">
                    <span className={result.status === 'error' ? 'text-red-400' : 'text-[#B3B3B3]'}>
                        {result.output}
                    </span>
                </div>
            )}
        </div>
    );
};

export default OutputTerminal;
