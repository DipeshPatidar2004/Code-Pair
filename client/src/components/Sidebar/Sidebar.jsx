import React, { useState } from 'react';
import Client from './Client';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiFile, FiPlus, FiCopy, FiLogOut, FiChevronDown, FiChevronRight, FiTrash2 } from 'react-icons/fi';
import { DiJavascript1, DiJava } from 'react-icons/di';
import { SiCplusplus } from 'react-icons/si';

const getFileIcon = (filename) => {
    const ext = filename.split('.').pop();
    if (ext === 'js') return <DiJavascript1 className="text-yellow-400 w-5 h-5 shrink-0" />;
    if (ext === 'cpp') return <SiCplusplus className="text-blue-500 w-4 h-4 shrink-0" />;
    if (ext === 'java') return <DiJava className="text-red-500 w-5 h-5 shrink-0" />;
    return <FiFile className="text-[#6B6B6B] w-4 h-4 shrink-0" />;
};

const Sidebar = ({ roomId, clients, files, activeFileId, setActiveFileId, onFileCreate, onDeleteFile, style }) => {
    const navigate = useNavigate();
    const [isCreatingFile, setIsCreatingFile] = useState(false);
    const [newFileName, setNewFileName] = useState('');
    const [explorerOpen, setExplorerOpen] = useState(true);
    const [participantsOpen, setParticipantsOpen] = useState(true);

    const copyRoomId = async () => {
        try {
            await navigator.clipboard.writeText(roomId);
            toast.success('Room ID copied');
        } catch (err) {
            toast.error('Could not copy Room ID');
        }
    };

    const handleCreateFileSubmit = (e) => {
        e.preventDefault();
        if (newFileName.trim()) {
            const ext = newFileName.split('.').pop();
            if (!['js', 'cpp', 'java', 'py'].includes(ext) || newFileName.indexOf('.') === -1) {
                toast.error('Only .js, .cpp, .java, and .py files are supported.');
                return;
            }
            onFileCreate(newFileName.trim());
            setNewFileName('');
            setIsCreatingFile(false);
        }
    };

    return (
        <div className="editor-sidebar w-full h-full" style={style}>
            <div className="editor-sidebar-header">
                <span className="editor-sidebar-logo">
                    <span className="logo-brackets">{'</>'}</span> CodePair
                </span>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
                {/* Explorer Section */}
                <div className="flex flex-col">
                    <div 
                        className="section-header"
                        onClick={() => setExplorerOpen(!explorerOpen)}
                    >
                        <div className="section-header-label">
                            {explorerOpen ? <FiChevronDown /> : <FiChevronRight />}
                            EXPLORER
                        </div>
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                setExplorerOpen(true);
                                setIsCreatingFile(true);
                            }}
                            className="section-header-action"
                            title="New File"
                        >
                            <FiPlus className="w-4 h-4" />
                        </button>
                    </div>

                    {explorerOpen && (
                        <div className="flex flex-col py-1">
                            {isCreatingFile && (
                                <form onSubmit={handleCreateFileSubmit} className="px-6 py-1 flex items-center gap-2">
                                    <FiFile className="text-[#6B6B6B] w-4 h-4 shrink-0" />
                                    <input 
                                        autoFocus
                                        type="text" 
                                        placeholder="filename.js"
                                        value={newFileName}
                                        onChange={(e) => setNewFileName(e.target.value)}
                                        onBlur={() => setIsCreatingFile(false)}
                                        className="w-full bg-[#1E1E1E] border border-[#00C8FF] text-white text-sm px-2 py-1 rounded outline-none focus:ring-1 focus:ring-[#00C8FF]"
                                    />
                                </form>
                            )}

                            {files.map(file => (
                                <div 
                                    key={file.id}
                                    onClick={() => setActiveFileId(file.id)}
                                    className={`file-tree-item group ${activeFileId === file.id ? 'active' : ''}`}
                                >
                                    {getFileIcon(file.name)}
                                    <span className="truncate">{file.name}</span>
                                    <button
                                        type="button"
                                        className="file-tree-delete-btn"
                                        title="Delete File"
                                        aria-label={`Delete ${file.name}`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onDeleteFile?.(file);
                                        }}
                                    >
                                        <FiTrash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Participants Section */}
                <div className="flex flex-col mt-1">
                    <div 
                        className="section-header"
                        onClick={() => setParticipantsOpen(!participantsOpen)}
                    >
                        <div className="section-header-label">
                            {participantsOpen ? <FiChevronDown /> : <FiChevronRight />}
                            PARTICIPANTS ({clients.length})
                        </div>
                    </div>

                    {participantsOpen && (
                        <div className="px-4 py-2 flex flex-wrap gap-3">
                            {clients.map((client) => (
                                <Client key={client.socketId} username={client.username} />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom Actions */}
            <div className="p-3 border-t border-border flex flex-col gap-2">
                <button 
                    onClick={copyRoomId} 
                    className="w-full premium-btn-secondary py-2 px-4 flex items-center justify-center gap-2 text-sm"
                >
                    <FiCopy className="w-4 h-4" /> Copy Room ID
                </button>
                <button 
                    onClick={() => navigate('/')} 
                    className="w-full py-2 px-4 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 bg-red-500/8 text-red-400 border border-red-500/15 hover:bg-red-500 hover:text-white transition-all"
                >
                    <FiLogOut className="w-4 h-4" /> Leave Room
                </button>
            </div>
        </div>
    );
};

export default Sidebar;
