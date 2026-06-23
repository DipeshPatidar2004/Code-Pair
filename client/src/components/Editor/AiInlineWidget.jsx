import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { FiCheck, FiX, FiZap, FiLoader, FiAlertTriangle } from 'react-icons/fi';
import { HiSparkles } from 'react-icons/hi2';

const SERVER_URL = import.meta.env.VITE_SERVER_URL;

// ─── Diffing Helper Functions ──────────────────────────────────────────────────

function getDiffLines(oldText, newText) {
    const oldLines = oldText.split('\n');
    const newLines = newText.split('\n');

    const dp = Array(oldLines.length + 1).fill(null).map(() => Array(newLines.length + 1).fill(0));
    for (let i = 1; i <= oldLines.length; i++) {
        for (let j = 1; j <= newLines.length; j++) {
            if (oldLines[i - 1] === newLines[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1] + 1;
            } else {
                dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
            }
        }
    }

    const diff = [];
    let i = oldLines.length;
    let j = newLines.length;

    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
            diff.unshift({ type: 'unchanged', oldLineNum: i, newLineNum: j, text: oldLines[i - 1] });
            i--;
            j--;
        } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
            diff.unshift({ type: 'added', oldLineNum: null, newLineNum: j, text: newLines[j - 1] });
            j--;
        } else {
            diff.unshift({ type: 'removed', oldLineNum: i, newLineNum: null, text: oldLines[i - 1] });
            i--;
        }
    }

    return diff;
}

function getCollapsedDiff(diff, context = 3) {
    const result = [];
    let i = 0;

    while (i < diff.length) {
        if (diff[i].type !== 'unchanged') {
            result.push(diff[i]);
            i++;
            continue;
        }

        let start = i;
        while (i < diff.length && diff[i].type === 'unchanged') {
            i++;
        }
        let count = i - start;

        if (count <= context * 2 + 1) {
            for (let k = start; k < i; k++) {
                result.push(diff[k]);
            }
        } else {
            // Context at the beginning
            for (let k = start; k < start + context; k++) {
                result.push(diff[k]);
            }

            // Collapse placeholder
            result.push({
                type: 'collapsed',
                count: count - context * 2,
                text: `... ${count - context * 2} unchanged lines ...`
            });

            // Context at the end
            for (let k = i - context; k < i; k++) {
                result.push(diff[k]);
            }
        }
    }
    return result;
}

// ─── Main Floating Content Widget ──────────────────────────────────────────────

const AiInlineWidget = ({ editor, monaco, position, onClose, fileContent, language, roomId, onAccept }) => {
    const [domNode] = useState(() => {
        const div = document.createElement('div');
        div.className = 'ai-inline-widget z-50 p-4 w-[500px] flex flex-col gap-3';
        return div;
    });

    const [prompt, setPrompt] = useState('');
    const [status, setStatus] = useState('input'); // 'input' | 'generating' | 'preview' | 'error'
    const [errorMessage, setErrorMessage] = useState('');
    const [result, setResult] = useState(null); // { code, explanation }
    const [diffLinesData, setDiffLinesData] = useState([]);
    const inputRef = useRef(null);

    // Register with Monaco as content widget
    useEffect(() => {
        if (!editor || !monaco) return;

        const widget = {
            getId: () => 'ai.inline.widget',
            getDomNode: () => domNode,
            getPosition: () => ({
                position: position,
                preference: [monaco.editor.ContentWidgetPositionPreference.BELOW]
            })
        };

        editor.addContentWidget(widget);
        
        // Focus the text input
        setTimeout(() => {
            if (inputRef.current) inputRef.current.focus();
        }, 50);

        // Escape key listener to close widget
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && status === 'input') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            editor.removeContentWidget(widget);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [editor, monaco, domNode, position, onClose, status]);

    const handleGenerate = async (e) => {
        if (e) e.preventDefault();
        if (!prompt.trim()) return;

        setStatus('generating');
        setErrorMessage('');

        try {
            const response = await fetch(`${SERVER_URL}/api/ai/inline`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    roomId,
                    fileContent,
                    cursorLine: position.lineNumber,
                    instruction: prompt.trim(),
                    language
                })
            });

            if (response.status === 503) {
                setStatus('error');
                setErrorMessage('Gemini API key is not configured on the server.');
                return;
            }

            if (response.status === 429) {
                setStatus('error');
                let displayMsg = 'Rate limit reached. Please try again in a minute.';
                try {
                    const errData = await response.json();
                    if (errData.isQuota) {
                        displayMsg = 'Gemini API key quota exceeded on the server. Please verify your API key in server/.env or wait for the quota to reset.';
                    } else if (errData.message) {
                        displayMsg = errData.message;
                    }
                } catch {}
                setErrorMessage(displayMsg);
                return;
            }

            if (!response.ok) {
                let errMsg = 'AI generation failed';
                try {
                    const errData = await response.json();
                    errMsg = errData.message || errMsg;
                } catch {}
                throw new Error(errMsg);
            }

            const data = await response.json();
            setResult(data);

            // Calculate diff
            const diff = getDiffLines(fileContent, data.code);
            const collapsed = getCollapsedDiff(diff);
            setDiffLinesData(collapsed);

            setStatus('preview');
        } catch (err) {
            console.error('Inline AI Error:', err);
            setStatus('error');
            const displayMsg = err.message.includes('quota') || err.message.includes('limit')
                ? 'Gemini API key quota exceeded on the server. Please check your API key in server/.env.'
                : (err.message || 'An error occurred during generation.');
            setErrorMessage(displayMsg);
        }
    };

    const handleApply = () => {
        if (result && result.code) {
            onAccept(result.code);
        }
    };

    // Render inside Monaco widget using portal
    return ReactDOM.createPortal(
        <>
            {status === 'input' && (
                <form onSubmit={handleGenerate} className="flex flex-col gap-3">
                    <div className="flex items-center gap-2 text-purple-400">
                        <HiSparkles className="w-4 h-4" />
                        <span className="text-xs font-semibold uppercase tracking-wider">AI Edit Instruction</span>
                    </div>
                    <div className="flex gap-2">
                        <input
                            ref={inputRef}
                            type="text"
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="e.g. add try-catch block here, optimize this search"
                            className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-purple-500/50"
                        />
                        <button
                            type="submit"
                            disabled={!prompt.trim()}
                            className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-800 disabled:text-gray-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5"
                        >
                            <FiZap className="w-3.5 h-3.5" />
                            Generate
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="border border-white/10 hover:bg-white/5 text-gray-400 px-3 py-2 rounded-lg text-sm transition-all"
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            )}

            {status === 'generating' && (
                <div className="flex flex-col items-center justify-center py-4 gap-2">
                    <FiLoader className="w-6 h-6 text-purple-400 animate-spin" />
                    <span className="text-xs text-gray-400 font-medium">Generating suggested changes...</span>
                </div>
            )}

            {status === 'error' && (
                <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2 text-red-400">
                        <FiAlertTriangle className="w-4 h-4" />
                        <span className="text-xs font-semibold uppercase tracking-wider">Generation Failed</span>
                    </div>
                    <p className="text-xs text-gray-400 leading-relaxed">{errorMessage}</p>
                    <div className="flex justify-end gap-2 mt-1">
                        <button
                            onClick={() => setStatus('input')}
                            className="bg-white/10 hover:bg-white/15 text-text px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                        >
                            Try Again
                        </button>
                        <button
                            onClick={onClose}
                            className="border border-white/10 hover:bg-white/5 text-gray-400 px-3 py-1.5 rounded-lg text-xs transition-all"
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}

            {status === 'preview' && (
                <div className="flex flex-col gap-3 max-h-[350px]">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-green-400">
                            <HiSparkles className="w-4 h-4" />
                            <span className="text-xs font-semibold uppercase tracking-wider">AI Code Suggestion</span>
                        </div>
                        <span className="text-[10px] bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded font-mono">
                            Line {position.lineNumber}
                        </span>
                    </div>

                    {result?.explanation && (
                        <p className="text-xs text-gray-400 italic bg-white/5 p-2 rounded border border-white/5">
                            {result.explanation}
                        </p>
                    )}

                    {/* Diff Viewer */}
                    <div className="flex-1 min-h-[120px] max-h-[220px] overflow-y-auto border border-white/10 rounded-lg bg-black/40 font-mono text-xs leading-relaxed select-text">
                        {diffLinesData.map((line, index) => {
                            if (line.type === 'collapsed') {
                                return (
                                    <div key={index} className="text-gray-500 text-center py-1 bg-white/5 border-y border-white/5 text-[11px]">
                                        {line.text}
                                    </div>
                                );
                            }

                            const isAdded = line.type === 'added';
                            const isRemoved = line.type === 'removed';
                            const lineBg = isAdded ? 'bg-green-500/15 text-green-300' : isRemoved ? 'bg-red-500/15 text-red-300' : 'text-gray-400 hover:bg-white/5';
                            const prefix = isAdded ? '+' : isRemoved ? '-' : ' ';

                            return (
                                <div key={index} className={`flex ${lineBg} px-2 py-0.5 transition-colors`}>
                                    <div className="w-8 text-right pr-2 text-[10px] text-gray-600 select-none border-r border-white/5 shrink-0">
                                        {line.oldLineNum || ''}
                                    </div>
                                    <div className="w-8 text-right pr-2 text-[10px] text-gray-600 select-none border-r border-white/5 shrink-0">
                                        {line.newLineNum || ''}
                                    </div>
                                    <div className="pl-2 pr-1 select-none text-gray-600 shrink-0">{prefix}</div>
                                    <pre className="m-0 font-mono text-xs whitespace-pre overflow-x-auto select-text flex-1">
                                        {line.text || ' '}
                                    </pre>
                                </div>
                            );
                        })}
                    </div>

                    <div className="flex justify-end gap-2 mt-1">
                        <button
                            onClick={handleApply}
                            className="bg-green-600 hover:bg-green-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
                        >
                            <FiCheck className="w-3.5 h-3.5" />
                            Accept Change
                        </button>
                        <button
                            onClick={() => setStatus('input')}
                            className="bg-white/10 hover:bg-white/15 text-text px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                        >
                            Back
                        </button>
                        <button
                            onClick={onClose}
                            className="border border-white/10 hover:bg-white/5 text-gray-400 px-3 py-1.5 rounded-lg text-xs transition-all"
                        >
                            Discard
                        </button>
                    </div>
                </div>
            )}
        </>,
        domNode
    );
};

export default AiInlineWidget;
