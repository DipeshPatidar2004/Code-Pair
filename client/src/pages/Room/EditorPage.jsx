import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, Navigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import Sidebar from '../../components/Sidebar/Sidebar';
import Editor from '../../components/Editor/Editor';
import Loader from '../../components/Loader';
import OutputTerminal from '../../components/Terminal/OutputTerminal';
import ChatPanel from '../../components/Chat/ChatPanel';
import { ACTIONS } from '../../constants/Actions';
import { useSocket } from '../../context/SocketContext';
import { initSocket } from '../../services/socket';
import { useAuth } from '../../context/AuthContext';
import { useWebRTC } from '../../hooks/useWebRTC';
import AiPanel from '../../components/Editor/AiPanel';
import ComplexityBadge from '../../components/Editor/ComplexityBadge';
import { HiSparkles } from 'react-icons/hi2';
import {
    FiZap,
    FiLoader,
    FiPlay,
    FiPhoneCall,
    FiPhoneOff,
    FiTerminal,
    FiFile,
    FiClock,
    FiUsers,
    FiSidebar,
    FiMessageSquare,
} from 'react-icons/fi';
import { DiJavascript1, DiJava } from 'react-icons/di';
import { SiCplusplus } from 'react-icons/si';

const STORAGE_KEYS = {
    leftWidth: 'codepair.editor.leftWidth',
    rightWidth: 'codepair.editor.rightWidth',
    terminalHeight: 'codepair.editor.terminalHeight',
    terminalCollapsed: 'codepair.editor.terminalCollapsed',
};

const DEFAULT_LAYOUT = {
    leftWidth: 284,
    rightWidth: 360,
    terminalHeight: 220,
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const readStoredNumber = (key, fallback) => {
    if (typeof window === 'undefined') return fallback;
    const raw = window.sessionStorage.getItem(key);
    const value = Number(raw);
    return Number.isFinite(value) ? value : fallback;
};

const readStoredBoolean = (key, fallback) => {
    if (typeof window === 'undefined') return fallback;
    const raw = window.sessionStorage.getItem(key);
    if (raw === null) return fallback;
    return raw === 'true';
};

const getFileIcon = (filename) => {
    const ext = filename.split('.').pop();
    if (ext === 'js') return <DiJavascript1 className="w-4 h-4 text-yellow-400 shrink-0" />;
    if (ext === 'cpp') return <SiCplusplus className="w-4 h-4 text-blue-400 shrink-0" />;
    if (ext === 'java') return <DiJava className="w-4 h-4 text-orange-400 shrink-0" />;
    return <FiFile className="w-4 h-4 text-[#8A8A8A] shrink-0" />;
};

const EditorPage = () => {
    const location = useLocation();
    const { roomId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { socket, setSocket, connectedUsers, setConnectedUsers } = useSocket();
    const [callUsers, setCallUsers] = useState([]);

    const [isConnecting, setIsConnecting] = useState(true);
    const [files, setFiles] = useState([]);
    const [activeFileId, setActiveFileId] = useState(null);
    const [executionResult, setExecutionResult] = useState(null);
    const [complexityResult, setComplexityResult] = useState(null);
    const [isAnalyzingComplexity, setIsAnalyzingComplexity] = useState(false);
    const [leftPanelOpen, setLeftPanelOpen] = useState(() => typeof window !== 'undefined' ? window.innerWidth > 1200 : true);
    const [rightPanelOpen, setRightPanelOpen] = useState(() => typeof window !== 'undefined' ? window.innerWidth > 1200 : true);
    const [rightPanelView, setRightPanelView] = useState('chat');
    const [leftSidebarWidth, setLeftSidebarWidth] = useState(DEFAULT_LAYOUT.leftWidth);
    const [rightSidebarWidth, setRightSidebarWidth] = useState(DEFAULT_LAYOUT.rightWidth);
    const [terminalHeight, setTerminalHeight] = useState(() => readStoredNumber(`${STORAGE_KEYS.terminalHeight}.${roomId}`, DEFAULT_LAYOUT.terminalHeight));
    const [terminalCollapsed, setTerminalCollapsed] = useState(() => readStoredBoolean(`${STORAGE_KEYS.terminalCollapsed}.${roomId}`, false));
    const [pendingDeleteFile, setPendingDeleteFile] = useState(null);

    const { localStream, remoteStreams, joinCall, leaveCall } = useWebRTC(socket, roomId, location.state?.username, connectedUsers, callUsers);

    const socketRef = useRef(null);
    const filesRef = useRef(files);
    const activeFileIdRef = useRef(activeFileId);

    if (!location.state?.username || !user) {
        return <Navigate to="/" />;
    }

    const username = location.state.username;
    const isChatView = rightPanelOpen && rightPanelView === 'chat';
    const isAiView = rightPanelOpen && rightPanelView === 'ai';

    useEffect(() => {
        filesRef.current = files;
    }, [files]);

    useEffect(() => {
        activeFileIdRef.current = activeFileId;
    }, [activeFileId]);

    useEffect(() => {
        try {
                window.sessionStorage.setItem(`${STORAGE_KEYS.terminalHeight}.${roomId}`, String(terminalHeight));
                window.sessionStorage.setItem(`${STORAGE_KEYS.terminalCollapsed}.${roomId}`, String(terminalCollapsed));
            } catch {}
    }, [terminalHeight, terminalCollapsed, roomId]);

    useEffect(() => {
        const init = async () => {
            try {
                socketRef.current = await initSocket();
                setSocket(socketRef.current);
                const currentSocket = socketRef.current;

                const handleErrors = (e) => {
                    console.log('socket error', e);
                    toast.error('Socket connection failed, try again later.');
                    navigate('/');
                };

                currentSocket.on('connect_error', handleErrors);
                currentSocket.on('connect_failed', handleErrors);
                currentSocket.on(ACTIONS.ERROR, ({ message }) => {
                    toast.error(message);
                    navigate('/');
                });

                currentSocket.emit(ACTIONS.JOIN, {
                    roomId,
                    username,
                    userId: user.id
                });

                currentSocket.on(ACTIONS.JOINED, ({ clients, username: joinedUsername, socketId }) => {
                    if (joinedUsername !== username) {
                        toast.success(`${joinedUsername} joined the room.`);
                    }
                    setConnectedUsers(clients);
                });

                currentSocket.on('sync-call-users', ({ callUsers }) => {
                    setCallUsers(callUsers);
                });

                currentSocket.on('USER_JOINED_CALL', ({ socketId }) => {
                    setCallUsers(prev => prev.includes(socketId) ? prev : [...prev, socketId]);
                });

                currentSocket.on('USER_LEFT_CALL', ({ socketId }) => {
                    setCallUsers(prev => prev.filter(id => id !== socketId));
                });

                currentSocket.on(ACTIONS.SYNC_FILES, ({ files }) => {
                    setFiles(files);
                    if (files.length > 0) {
                        setActiveFileId(files[0].id);
                    }
                });

                currentSocket.on(ACTIONS.FILE_CREATED, ({ file }) => {
                    setFiles((prev) => [...prev, file]);
                });

                currentSocket.on(ACTIONS.FILE_UPDATED, ({ fileId, content }) => {
                    setFiles((prev) => prev.map(f => f.id === fileId ? { ...f, content } : f));
                });

                currentSocket.on(ACTIONS.FILE_DELETED, ({ fileId }) => {
                    deleteFile(fileId, { emit: false });
                });

                currentSocket.on(ACTIONS.FILE_RENAMED, ({ fileId, newName, newLanguage }) => {
                    setFiles((prev) => prev.map(f => f.id === fileId ? { ...f, name: newName, language: newLanguage } : f));
                });

                currentSocket.on(ACTIONS.EXECUTION_RESULT, (result) => {
                    setExecutionResult(result);
                });

                currentSocket.on(ACTIONS.DISCONNECTED, ({ socketId, username: leftUsername }) => {
                    toast(`${leftUsername} left the room.`, { icon: '👋' });
                    setConnectedUsers((prev) => prev.filter((client) => client.socketId !== socketId));
                });

                setIsConnecting(false);
            } catch (err) {
                toast.error('Failed to connect');
                navigate('/');
            }
        };

        init();

        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current.removeAllListeners();
            }
        };
    }, []);

    useEffect(() => {
        if (files.length > 0 && !files.find(f => f.id === activeFileId)) {
            setActiveFileId(files[0].id);
        }
    }, [files, activeFileId]);

    const activeFile = files.find(f => f.id === activeFileId);

    const handleCodeChange = (fileId, newCode) => {
        setFiles(prev => prev.map(f => f.id === fileId ? { ...f, content: newCode } : f));
        if (socketRef.current) {
            socketRef.current.emit(ACTIONS.FILE_UPDATED, { roomId, fileId, content: newCode });
        }
    };

    const handleFileCreate = (name) => {
        const ext = name.split('.').pop();
        let language = 'javascript';
        if (ext === 'cpp') language = 'cpp';
        else if (ext === 'java') language = 'java';
        else if (ext === 'py') language = 'python';

        const newFile = {
            id: Date.now().toString(),
            name,
            language,
            content: ''
        };
        setFiles(prev => [...prev, newFile]);
        setActiveFileId(newFile.id);
        if (socketRef.current) {
            socketRef.current.emit(ACTIONS.FILE_CREATED, { roomId, file: newFile });
        }
    };

    const deleteFile = (fileId, { emit = true } = {}) => {
        const currentFiles = filesRef.current;
        if (currentFiles.length <= 1) {
            toast.error('At least one file must remain in the workspace.');
            return false;
        }

        const deletedIndex = currentFiles.findIndex((file) => file.id === fileId);
        if (deletedIndex === -1) {
            return false;
        }

        const nextFiles = currentFiles.filter((file) => file.id !== fileId);
        setFiles(nextFiles);

        if (activeFileIdRef.current === fileId) {
            const replacementFile = nextFiles[Math.min(deletedIndex, nextFiles.length - 1)];
            setActiveFileId(replacementFile?.id ?? null);
        }

        if (emit && socketRef.current) {
            socketRef.current.emit(ACTIONS.FILE_DELETED, { roomId, fileId });
        }

        return true;
    };

    const requestDeleteFile = (file) => {
        if (filesRef.current.length <= 1) {
            toast.error('At least one file must remain in the workspace.');
            return;
        }
        setPendingDeleteFile(file);
    };

    const confirmDeleteFile = () => {
        if (!pendingDeleteFile) return;
        deleteFile(pendingDeleteFile.id);
        setPendingDeleteFile(null);
    };

    const runCode = () => {
        try {
            if (!activeFileId) {
                alert("Error: No file selected!");
                return;
            }

            setTimeout(() => {
                setExecutionResult({ status: 'running', output: 'Sending request...' });
                if (!socketRef.current) {
                    alert("Error: Socket is disconnected!");
                    return;
                }
                socketRef.current.emit(ACTIONS.EXECUTE_CODE, { roomId, fileId: activeFileId });
            }, 0);
        } catch (err) {
            alert("Error in runCode: " + err.message);
        }
    };

    const runComplexityAnalysis = async () => {
        if (!activeFile) {
            toast.error("No active file to analyze.");
            return;
        }
        setIsAnalyzingComplexity(true);
        setComplexityResult(null);
        try {
            const response = await fetch(`${import.meta.env.VITE_SERVER_URL}/api/ai/complexity`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    roomId,
                    code: activeFile.content,
                    language: activeFile.language
                })
            });

            if (response.status === 503) {
                toast.error("Complexity analysis not configured. Gemini API key is missing on the server.");
                return;
            }

            if (response.status === 429) {
                let displayMsg = "Rate limit reached. Please wait a moment.";
                try {
                    const errData = await response.json();
                    if (errData.isQuota) {
                        displayMsg = "Gemini API key quota exceeded on the server. Please verify your API key in server/.env.";
                    } else if (errData.message) {
                        displayMsg = errData.message;
                    }
                } catch {}
                toast.error(displayMsg);
                return;
            }

            if (!response.ok) {
                let errMsg = "Failed to analyze complexity";
                try {
                    const errData = await response.json();
                    errMsg = errData.message || errMsg;
                } catch {}
                throw new Error(errMsg);
            }

            const data = await response.json();
            setComplexityResult(data);
        } catch (err) {
            console.error(err);
            const displayMsg = err.message.includes('quota') || err.message.includes('limit')
                ? "Gemini API key quota exceeded on the server. Please check your API key in server/.env."
                : (err.message || "Failed to analyze complexity.");
            toast.error(displayMsg);
        } finally {
            setIsAnalyzingComplexity(false);
        }
    };

    const beginResize = (edge) => (event) => {
        event.preventDefault();
        event.stopPropagation();

        const startX = event.clientX;
        const startY = event.clientY;
        const startLeft = leftSidebarWidth;
        const startRight = rightSidebarWidth;
        const startTerminal = terminalHeight;
        
        let finalLeft = startLeft;
        let finalRight = startRight;

        document.body.classList.add('panel-resizing');

        const onMove = (moveEvent) => {
            if (edge === 'left') {
                finalLeft = clamp(
                    startLeft + (moveEvent.clientX - startX),
                    0,
                    Math.max(220, window.innerWidth - startRight - 560)
                );
                setLeftSidebarWidth(finalLeft);
            }

            if (edge === 'right') {
                finalRight = clamp(
                    startRight - (moveEvent.clientX - startX),
                    0,
                    Math.max(300, window.innerWidth - startLeft - 560)
                );
                setRightSidebarWidth(finalRight);
            }

            if (edge === 'terminal') {
                const next = clamp(
                    startTerminal - (moveEvent.clientY - startY),
                    160,
                    Math.min(420, Math.max(160, Math.round(window.innerHeight * 0.5)))
                );
                setTerminalHeight(next);
            }
        };

        const onUp = () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            document.body.classList.remove('panel-resizing');
            
            if (edge === 'left') {
                if (finalLeft < 100) {
                    setLeftPanelOpen(false);
                    setLeftSidebarWidth(DEFAULT_LAYOUT.leftWidth);
                } else if (finalLeft < 220) {
                    setLeftSidebarWidth(220);
                }
            }
            
            if (edge === 'right') {
                if (finalRight < 150) {
                    setRightPanelOpen(false);
                    setRightSidebarWidth(DEFAULT_LAYOUT.rightWidth);
                } else if (finalRight < 300) {
                    setRightSidebarWidth(300);
                }
            }
        };

        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
    };

    if (isConnecting || !socket) {
        return <Loader />;
    }

    const fileCount = files.length;
    const collaboratorCount = connectedUsers.length;

    return (
        <div className="editor-workbench">
            <div className="workspace-stage">
                <aside
                    className={`workspace-panel workspace-panel-left ${leftPanelOpen ? 'is-open' : 'is-closed'}`}
                    style={{ width: leftPanelOpen ? leftSidebarWidth : 0 }}
                >
                    <Sidebar
                        roomId={roomId}
                        clients={connectedUsers}
                        files={files}
                        activeFileId={activeFileId}
                        setActiveFileId={setActiveFileId}
                        onFileCreate={handleFileCreate}
                        onDeleteFile={requestDeleteFile}
                        style={{ width: '100%' }}
                    />
                </aside>

                {leftPanelOpen && (
                    <div
                        className="panel-resizer panel-resizer-vertical"
                        onPointerDown={beginResize('left')}
                        aria-hidden="true"
                    />
                )}

                <main className="workspace-center">
                    <div className="editor-tabs-bar">
                        <div className="editor-tabs" role="tablist" aria-label="Files">
                            {files.length > 0 ? (
                                files.map((file) => {
                                    const isActive = file.id === activeFileId;
                                    return (
                                        <button
                                            key={file.id}
                                            type="button"
                                            role="tab"
                                            aria-selected={isActive}
                                            onClick={() => setActiveFileId(file.id)}
                                            className={`editor-tab ${isActive ? 'active' : ''}`}
                                            title={file.name}
                                        >
                                            {getFileIcon(file.name)}
                                            <span className="editor-tab-label">{file.name}</span>
                                        </button>
                                    );
                                })
                            ) : (
                                <div className="editor-tab editor-tab-empty">
                                    <FiFile className="w-4 h-4 text-[#8A8A8A]" />
                                    <span className="editor-tab-label">No files open</span>
                                </div>
                            )}
                        </div>

                        <div className="editor-toolbar-actions">
                            {!localStream ? (
                                <button
                                    onClick={joinCall}
                                    className="toolbar-btn toolbar-btn-call-join"
                                >
                                    <FiPhoneCall className="w-3.5 h-3.5" />
                                    Join Call
                                </button>
                            ) : (
                                <button
                                    onClick={leaveCall}
                                    className="toolbar-btn toolbar-btn-call-leave"
                                >
                                    <FiPhoneOff className="w-3.5 h-3.5" />
                                    Leave Call
                                </button>
                            )}
                            <button
                                onClick={runCode}
                                className="toolbar-btn toolbar-btn-run"
                            >
                                <FiPlay className="w-3.5 h-3.5" />
                                Run Code
                            </button>
                            <button
                                onClick={() => setLeftPanelOpen(prev => !prev)}
                                className={`toolbar-btn ${leftPanelOpen ? 'toolbar-btn-ai active' : 'toolbar-btn-secondary'}`}
                                title={leftPanelOpen ? 'Hide file explorer' : 'Show file explorer'}
                            >
                                <FiSidebar className="w-3.5 h-3.5" />
                                Explorer
                            </button>
                            <button
                                onClick={() => {
                                    if (isChatView) {
                                        setRightPanelOpen(false);
                                        return;
                                    }
                                    setRightPanelOpen(true);
                                    setRightPanelView('chat');
                                }}
                                className={`toolbar-btn ${isChatView ? 'toolbar-btn-ai active' : 'toolbar-btn-secondary'}`}
                                title={isChatView ? 'Hide chat panel' : 'Show chat panel'}
                            >
                                <FiMessageSquare className="w-3.5 h-3.5" />
                                Chat
                            </button>
                            <button
                                onClick={runComplexityAnalysis}
                                disabled={isAnalyzingComplexity}
                                className="toolbar-btn toolbar-btn-complexity"
                            >
                                {isAnalyzingComplexity ? (
                                    <FiLoader className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                    <FiZap className="w-3.5 h-3.5" />
                                )}
                                Analyze
                            </button>
                            <button
                                onClick={() => {
                                    if (isAiView) {
                                        setRightPanelView('chat');
                                        return;
                                    }
                                    setRightPanelOpen(true);
                                    setRightPanelView('ai');
                                }}
                                className={`toolbar-btn toolbar-btn-ai ${isAiView ? 'active' : ''}`}
                            >
                                <HiSparkles className="w-3.5 h-3.5" />
                                {isAiView ? 'Hide AI' : 'AI Assistant'}
                            </button>
                        </div>
                    </div>

                    <div className="workspace-editor-shell">
                        <div className="workspace-editor-surface">
                            {activeFile ? (
                                <Editor
                                    fileId={activeFile.id}
                                    language={activeFile.language}
                                    content={activeFile.content}
                                    onCodeChange={handleCodeChange}
                                    socket={socket}
                                    roomId={roomId}
                                    username={username}
                                />
                            ) : (
                                <div className="workspace-empty-state">
                                    <div className="workspace-empty-card premium-glass-card">
                                        <FiTerminal className="w-6 h-6 text-[#00C8FF]" />
                                        <div className="space-y-2">
                                            <h3 className="text-sm font-semibold text-white">Select a file to start coding</h3>
                                            <p className="text-xs text-[#8F8F8F]">
                                                Create or pick a file from the explorer to open it in the editor.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {complexityResult && (
                            <ComplexityBadge result={complexityResult} onClose={() => setComplexityResult(null)} />
                        )}

                        {executionResult && (
                            <div
                                className={`terminal-dock ${terminalCollapsed ? 'terminal-dock-collapsed' : ''}`}
                                style={{ height: terminalCollapsed ? 44 : terminalHeight }}
                            >
                                <div
                                    className="panel-resizer panel-resizer-horizontal"
                                    onPointerDown={beginResize('terminal')}
                                    aria-hidden="true"
                                />
                                <OutputTerminal
                                    result={executionResult}
                                    onClose={() => setExecutionResult(null)}
                                    collapsed={terminalCollapsed}
                                    onToggleCollapse={() => setTerminalCollapsed(prev => !prev)}
                                    style={{ height: '100%' }}
                                />
                            </div>
                        )}
                    </div>
                </main>

                {rightPanelOpen && (
                    <div
                        className="panel-resizer panel-resizer-vertical"
                        onPointerDown={beginResize('right')}
                        aria-hidden="true"
                    />
                )}

                <aside
                    className={`workspace-panel workspace-panel-right ${rightPanelOpen ? 'is-open' : 'is-closed'}`}
                    style={{ width: rightPanelOpen ? rightSidebarWidth : 0 }}
                >
                    <div className="workspace-right-panel-stack">
                        <div className={`workspace-right-panel-view ${isChatView ? 'is-active' : ''}`}>
                            <ChatPanel
                                roomId={roomId}
                                username={username}
                                localStream={localStream}
                                remoteStreams={remoteStreams}
                                connectedUsers={connectedUsers}
                                style={{ width: '100%', height: '100%' }}
                            />
                        </div>

                        <div className={`workspace-right-panel-view ${isAiView ? 'is-active' : ''}`}>
                            <AiPanel
                                isOpen={isAiView}
                                onClose={() => setRightPanelView('chat')}
                                files={files}
                                activeFile={activeFile}
                                roomId={roomId}
                            />
                        </div>
                    </div>
                </aside>
            </div>

            <div className="status-bar">
                <div className="status-bar-group">
                    <span className="status-pill status-pill-accent">Room {roomId}</span>
                    <span className="status-pill">{activeFile?.language || 'No file'}</span>
                    <span className="status-pill">{fileCount} files</span>
                </div>
                <div className="status-bar-group">
                    <span className="status-pill">
                        <FiClock className="w-3.5 h-3.5" />
                        Session active
                    </span>
                    <span className="status-pill">
                        <FiUsers className="w-3.5 h-3.5" />
                        {collaboratorCount} connected
                    </span>
                </div>
            </div>

            {pendingDeleteFile && (
                <div className="file-delete-modal-backdrop" role="presentation" onClick={() => setPendingDeleteFile(null)}>
                    <div
                        className="file-delete-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="file-delete-title"
                        aria-describedby="file-delete-description"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="file-delete-modal-icon">
                            <FiFile className="w-5 h-5 text-red-300" />
                        </div>
                        <div className="space-y-2">
                            <h3 id="file-delete-title" className="text-base font-semibold text-white">
                                Delete file?
                            </h3>
                            <p id="file-delete-description" className="text-sm text-[#AAB2BD]">
                                Are you sure you want to delete this file?
                            </p>
                            <p className="text-sm font-medium text-white break-all">
                                {pendingDeleteFile.name}
                            </p>
                        </div>
                        <div className="file-delete-modal-actions">
                            <button
                                type="button"
                                className="toolbar-btn toolbar-btn-secondary"
                                onClick={() => setPendingDeleteFile(null)}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="toolbar-btn file-delete-confirm-btn"
                                onClick={confirmDeleteFile}
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EditorPage;
