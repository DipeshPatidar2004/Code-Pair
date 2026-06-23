import React, { useState, useRef, useEffect, useCallback } from 'react';
import { FiX, FiSend, FiCopy, FiCheck, FiZap, FiCode, FiSearch, FiAlertTriangle } from 'react-icons/fi';
import { HiSparkles } from 'react-icons/hi2';

const SERVER_URL = import.meta.env.VITE_SERVER_URL;

// ─── Simple Markdown Renderer ──────────────────────────────────────────────────
// Renders AI markdown responses with code blocks, inline code, bold, lists, etc.

function renderMarkdown(text) {
    if (!text) return null;

    const blocks = [];
    const lines = text.split('\n');
    let i = 0;

    while (i < lines.length) {
        // Fenced code block
        if (lines[i].startsWith('```')) {
            const lang = lines[i].slice(3).trim();
            const codeLines = [];
            i++;
            while (i < lines.length && !lines[i].startsWith('```')) {
                codeLines.push(lines[i]);
                i++;
            }
            i++; // skip closing ```
            blocks.push({ type: 'code', lang, content: codeLines.join('\n') });
        } else {
            blocks.push({ type: 'text', content: lines[i] });
            i++;
        }
    }

    return blocks.map((block, idx) => {
        if (block.type === 'code') {
            return <CodeBlock key={idx} code={block.content} language={block.lang} />;
        }
        return <TextLine key={idx} text={block.content} />;
    });
}

function TextLine({ text }) {
    if (!text.trim()) return <div className="h-2" />;

    // Headers
    if (text.startsWith('### ')) return <h3 className="text-sm font-semibold text-text mt-3 mb-1">{renderInline(text.slice(4))}</h3>;
    if (text.startsWith('## ')) return <h2 className="text-base font-semibold text-text mt-3 mb-1">{renderInline(text.slice(3))}</h2>;
    if (text.startsWith('# ')) return <h1 className="text-lg font-bold text-text mt-3 mb-1">{renderInline(text.slice(2))}</h1>;

    // Unordered list
    if (text.match(/^[\s]*[-*]\s/)) {
        const indent = text.match(/^(\s*)/)[1].length;
        const content = text.replace(/^[\s]*[-*]\s/, '');
        return <div className="flex gap-2" style={{ paddingLeft: indent * 4 + 8 }}><span className="text-purple-400 mt-0.5">•</span><span className="text-sm text-gray-300 leading-relaxed">{renderInline(content)}</span></div>;
    }

    // Ordered list
    if (text.match(/^\d+\.\s/)) {
        const num = text.match(/^(\d+)\./)[1];
        const content = text.replace(/^\d+\.\s/, '');
        return <div className="flex gap-2 pl-2"><span className="text-purple-400 text-sm font-medium">{num}.</span><span className="text-sm text-gray-300 leading-relaxed">{renderInline(content)}</span></div>;
    }

    return <p className="text-sm text-gray-300 leading-relaxed">{renderInline(text)}</p>;
}

function renderInline(text) {
    // Process inline code, bold, italic
    const parts = [];
    let remaining = text;
    let key = 0;

    while (remaining.length > 0) {
        // Inline code
        const codeMatch = remaining.match(/`([^`]+)`/);
        // Bold
        const boldMatch = remaining.match(/\*\*([^*]+)\*\*/);

        let firstMatch = null;
        let firstIndex = Infinity;

        if (codeMatch && codeMatch.index < firstIndex) {
            firstMatch = { type: 'code', match: codeMatch };
            firstIndex = codeMatch.index;
        }
        if (boldMatch && boldMatch.index < firstIndex) {
            firstMatch = { type: 'bold', match: boldMatch };
            firstIndex = boldMatch.index;
        }

        if (!firstMatch) {
            parts.push(<span key={key++}>{remaining}</span>);
            break;
        }

        if (firstIndex > 0) {
            parts.push(<span key={key++}>{remaining.slice(0, firstIndex)}</span>);
        }

        if (firstMatch.type === 'code') {
            parts.push(
                <code key={key++} className="bg-purple-500/15 border border-purple-500/20 rounded px-1.5 py-0.5 text-xs text-purple-300 font-mono">
                    {firstMatch.match[1]}
                </code>
            );
        } else if (firstMatch.type === 'bold') {
            parts.push(<strong key={key++} className="text-purple-200 font-semibold">{firstMatch.match[1]}</strong>);
        }

        remaining = remaining.slice(firstIndex + firstMatch.match[0].length);
    }

    return parts;
}

function CodeBlock({ code, language }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        await navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="ai-code-block my-2 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-3 py-1.5 bg-black/40 border-b border-white/5">
                <span className="text-[11px] text-gray-500 font-mono">{language || 'code'}</span>
                <button onClick={handleCopy} className="copy-btn !opacity-100 !static flex items-center gap-1 text-[11px]">
                    {copied ? <><FiCheck className="w-3 h-3 text-green-400" /> Copied</> : <><FiCopy className="w-3 h-3" /> Copy</>}
                </button>
            </div>
            <pre className="!m-0 !rounded-none !border-0 px-3 py-3 text-[13px] leading-5 overflow-x-auto">
                <code className="text-gray-300">{code}</code>
            </pre>
        </div>
    );
}

// ─── Quick Action Presets ──────────────────────────────────────────────────────

const QUICK_ACTIONS = [
    { label: 'Explain this code', icon: FiSearch, prompt: 'Explain what the code in the currently active file does, step by step.' },
    { label: 'Find bugs', icon: FiAlertTriangle, prompt: 'Review all files for potential bugs, edge cases, or issues. List each one with the file name and line.' },
    { label: 'Suggest improvements', icon: FiZap, prompt: 'Suggest improvements to the code quality, performance, and best practices across all files.' },
    { label: 'Write tests', icon: FiCode, prompt: 'Write unit tests for the main functions in the currently active file.' },
];

// ─── Main Component ────────────────────────────────────────────────────────────

const AiPanel = ({ isOpen, onClose, files, activeFile, roomId }) => {
    const [messages, setMessages] = useState([]);
    const [inputValue, setInputValue] = useState('');
    const [isStreaming, setIsStreaming] = useState(false);
    const [aiAvailable, setAiAvailable] = useState(true);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);
    const abortControllerRef = useRef(null);

    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages, scrollToBottom]);

    useEffect(() => {
        if (isOpen && inputRef.current) {
            setTimeout(() => inputRef.current?.focus(), 300);
        }
    }, [isOpen]);

    const sendMessage = async (text) => {
        if (!text.trim() || isStreaming) return;

        const userMsg = { role: 'user', content: text.trim() };
        const newMessages = [...messages, userMsg];
        setMessages(newMessages);
        setInputValue('');
        setIsStreaming(true);

        // Add placeholder AI message for streaming
        const aiMsgIndex = newMessages.length;
        setMessages(prev => [...prev, { role: 'assistant', content: '', streaming: true }]);

        try {
            abortControllerRef.current = new AbortController();

            const res = await fetch(`${SERVER_URL}/api/ai/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    roomId,
                    messages: newMessages.map(m => ({ role: m.role, content: m.content })),
                }),
                signal: abortControllerRef.current.signal,
            });

            if (res.status === 503) {
                setAiAvailable(false);
                setMessages(prev => prev.slice(0, -1));
                setIsStreaming(false);
                return;
            }

            if (res.status === 429) {
                let displayMsg = '⏳ Rate limit reached. Please wait a moment and try again.';
                try {
                    const errData = await res.json();
                    if (errData.isQuota) {
                        displayMsg = '⚠️ Gemini API key quota exceeded on the server. Please verify your API key in your server\'s .env file or wait for the quota to reset.';
                    } else if (errData.message) {
                        displayMsg = errData.message;
                    }
                } catch {}
                setMessages(prev => {
                    const updated = [...prev];
                    updated[aiMsgIndex] = { role: 'assistant', content: displayMsg, streaming: false };
                    return updated;
                });
                setIsStreaming(false);
                return;
            }

            if (!res.ok) {
                let errMsg = 'AI request failed';
                try {
                    const errData = await res.json();
                    errMsg = errData.message || errMsg;
                } catch {}
                throw new Error(errMsg);
            }

            // Read SSE stream
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    try {
                        const data = JSON.parse(line.slice(6));
                        if (data.type === 'chunk') {
                            setMessages(prev => {
                                const updated = [...prev];
                                const msg = updated[aiMsgIndex];
                                updated[aiMsgIndex] = { ...msg, content: msg.content + data.content };
                                return updated;
                            });
                        } else if (data.type === 'error') {
                            setMessages(prev => {
                                const updated = [...prev];
                                const errorText = data.isQuota
                                    ? '\n\n⚠️ Gemini API key quota exceeded on the server. Please verify your API key in your server\'s .env file.'
                                    : '\n\n❌ Error: ' + data.content;
                                updated[aiMsgIndex] = { ...updated[aiMsgIndex], content: updated[aiMsgIndex].content + errorText, streaming: false };
                                return updated;
                            });
                        }
                    } catch {}
                }
            }

            // Mark streaming complete
            setMessages(prev => {
                const updated = [...prev];
                if (updated[aiMsgIndex]) {
                    updated[aiMsgIndex] = { ...updated[aiMsgIndex], streaming: false };
                }
                return updated;
            });
        } catch (err) {
            if (err.name !== 'AbortError') {
                setMessages(prev => {
                    const updated = [...prev];
                    if (updated[aiMsgIndex]) {
                        const content = err.message.includes('quota') || err.message.includes('limit')
                            ? '⚠️ Gemini API key quota exceeded on the server. Please check your API key in the server\'s .env file.'
                            : '❌ Failed to get AI response: ' + err.message;
                        updated[aiMsgIndex] = { role: 'assistant', content, streaming: false };
                    }
                    return updated;
                });
            }
        }

        setIsStreaming(false);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        sendMessage(inputValue);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage(inputValue);
        }
    };

    const stopStreaming = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        setIsStreaming(false);
        setMessages(prev => {
            const updated = [...prev];
            const lastMsg = updated[updated.length - 1];
            if (lastMsg?.streaming) {
                updated[updated.length - 1] = { ...lastMsg, streaming: false, content: lastMsg.content + '\n\n*(Stopped)*' };
            }
            return updated;
        });
    };

    const clearChat = () => {
        setMessages([]);
    };

    return (
        <div
            className={`ai-panel h-full w-full flex flex-col min-w-0 ${isOpen ? 'is-active' : 'is-hidden'}`}
            aria-hidden={!isOpen}
        >
            {/* Header */}
            <div className="ai-panel-header ai-gradient-border px-4 py-3 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5">
                    <div className="ai-sparkle">
                        <HiSparkles className="w-5 h-5 text-purple-400 ai-sparkle-icon" />
                    </div>
                    <span className="font-semibold text-text text-sm">AI Assistant</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-400 border border-purple-500/20 font-medium">
                        Gemini
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    {messages.length > 0 && (
                        <button onClick={clearChat} className="text-gray-500 hover:text-gray-300 text-xs transition-colors">
                            Clear
                        </button>
                    )}
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors p-1 rounded hover:bg-white/5">
                        <FiX className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Context Indicator */}
            <div className="px-4 py-2 border-b border-border/50 flex items-center gap-2 shrink-0">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></div>
                <span className="text-[11px] text-gray-500">
                    Context: {files?.length || 0} files loaded
                    {activeFile && <span className="text-gray-400"> · Active: {activeFile.name}</span>}
                </span>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto ai-scrollbar px-4 py-4 flex flex-col gap-4 min-h-0">
                {!aiAvailable ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-8">
                        <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center mb-4">
                            <FiAlertTriangle className="w-6 h-6 text-red-400" />
                        </div>
                        <h3 className="text-sm font-semibold text-text mb-2">AI Not Configured</h3>
                        <p className="text-xs text-gray-500 leading-relaxed">
                            Add a <code className="bg-purple-500/15 text-purple-400 px-1 rounded text-[11px]">GEMINI_API_KEY</code> to the server's <code className="bg-purple-500/15 text-purple-400 px-1 rounded text-[11px]">.env</code> file to enable AI features.
                        </p>
                    </div>
                ) : messages.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/20 to-cyan-500/10 flex items-center justify-center mb-5 animate-pulse-glow">
                            <HiSparkles className="w-8 h-8 text-purple-400" />
                        </div>
                        <h3 className="text-base font-semibold text-text mb-2">AI Pair Programmer</h3>
                        <p className="text-xs text-gray-500 leading-relaxed mb-6 max-w-[260px]">
                            I can see all the files in your room. Ask me to explain, debug, refactor, or write code.
                        </p>
                        <div className="flex flex-wrap gap-2 justify-center">
                            {QUICK_ACTIONS.map((action, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => sendMessage(action.prompt)}
                                    className="ai-quick-action flex items-center gap-1.5"
                                >
                                    <action.icon className="w-3 h-3" />
                                    {action.label}
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    messages.map((msg, idx) => (
                        <div key={idx} className={`ai-message ${msg.role === 'user' ? 'flex justify-end' : ''}`}>
                            {msg.role === 'user' ? (
                                <div className="bg-purple-600/20 border border-purple-500/20 rounded-xl rounded-br-sm px-3.5 py-2.5 max-w-[85%]">
                                    <p className="text-sm text-gray-200 whitespace-pre-wrap">{msg.content}</p>
                                </div>
                            ) : (
                                <div className="flex gap-2.5">
                                    <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-purple-500/30 to-cyan-500/20 flex items-center justify-center shrink-0 mt-0.5">
                                        <HiSparkles className="w-3.5 h-3.5 text-purple-400" />
                                    </div>
                                    <div className="flex-1 min-w-0 overflow-hidden">
                                        {renderMarkdown(msg.content)}
                                        {msg.streaming && <span className="ai-cursor" />}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            {aiAvailable && (
                <div className="px-3 py-3 border-t border-border/50 shrink-0">
                    {isStreaming ? (
                        <button
                            onClick={stopStreaming}
                            className="w-full py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium hover:bg-red-500/20 transition-colors flex items-center justify-center gap-2"
                        >
                            <div className="w-3 h-3 rounded-sm bg-red-400"></div>
                            Stop generating
                        </button>
                    ) : (
                        <form onSubmit={handleSubmit} className="flex gap-2">
                            <textarea
                                ref={inputRef}
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Ask about your code..."
                                rows={1}
                                className="flex-1 bg-black/30 border border-border text-text text-sm rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 resize-none transition-all placeholder-gray-600"
                                style={{ minHeight: '40px', maxHeight: '120px' }}
                                onInput={(e) => {
                                    e.target.style.height = 'auto';
                                    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                                }}
                            />
                            <button
                                type="submit"
                                disabled={!inputValue.trim()}
                                className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-800 disabled:text-gray-600 text-white p-2.5 rounded-xl flex items-center justify-center transition-all self-end shrink-0"
                            >
                                <FiSend className="w-4 h-4" />
                            </button>
                        </form>
                    )}
                </div>
            )}
        </div>
    );
};

export default AiPanel;
