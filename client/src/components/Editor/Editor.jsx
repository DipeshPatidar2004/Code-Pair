import React, { useRef, useEffect, useState } from 'react';
import MonacoEditor from '@monaco-editor/react';
import { ACTIONS } from '../../constants/Actions';
import AiInlineWidget from './AiInlineWidget';

// A simple hash function to assign colors to usernames
const stringToColor = (str) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = hash % 360;
    return `hsl(${hue}, 70%, 50%)`;
};

const Editor = ({ fileId, language, content, onCodeChange, socket, roomId, username }) => {
    const editorRef = useRef(null);
    const monacoRef = useRef(null);
    const decorationsRef = useRef(null);
    const remoteCursorsRef = useRef({}); // Store cursor info per socketId
    const [inlineWidget, setInlineWidget] = useState({ visible: false, lineNumber: 1, column: 1 });

    const handleEditorDidMount = (editor, monaco) => {
        editorRef.current = editor;
        monacoRef.current = monaco;
        decorationsRef.current = editor.createDecorationsCollection();

        // Register inline AI widget actions (keybinding & context menu)
        editor.addAction({
            id: 'trigger-inline-ai',
            label: 'Ask AI...',
            keybindings: [
                monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyI
            ],
            contextMenuGroupId: 'navigation',
            contextMenuOrder: 1.5,
            run: (ed) => {
                const pos = ed.getPosition();
                setInlineWidget({
                    visible: true,
                    lineNumber: pos.lineNumber,
                    column: pos.column,
                });
            }
        });

        // Listen for local cursor movement to broadcast
        editor.onDidChangeCursorPosition((e) => {
            if (!socket) return;
            const position = e.position;
            socket.emit(ACTIONS.CURSOR_MOVED, {
                roomId,
                cursorData: {
                    socketId: socket.id,
                    username,
                    position,
                    color: stringToColor(username),
                    fileId
                }
            });
        });
    };

    const handleEditorChange = (value) => {
        if (value !== undefined) {
            onCodeChange(fileId, value);
        }
    };

    // Listen for remote cursors
    useEffect(() => {
        if (!socket) return;

        const handleCursorMoved = (cursorData) => {
            if (cursorData.fileId !== fileId) return; // Ignore cursors from other files
            
            remoteCursorsRef.current[cursorData.socketId] = cursorData;
            
            // Re-render all decorations
            if (decorationsRef.current && monacoRef.current) {
                const monaco = monacoRef.current;
                const newDecorations = Object.values(remoteCursorsRef.current).map(cursor => {
                    return {
                        range: new monaco.Range(cursor.position.lineNumber, cursor.position.column, cursor.position.lineNumber, cursor.position.column),
                        options: {
                            className: 'remote-cursor',
                            hoverMessage: { value: cursor.username },
                            beforeContentClassName: `remote-cursor-tooltip tooltip-${cursor.socketId}`
                        }
                    };
                });
                
                decorationsRef.current.set(newDecorations);

                // Inject dynamic CSS for this user's cursor color
                let styleElement = document.getElementById(`cursor-style-${cursorData.socketId}`);
                if (!styleElement) {
                    styleElement = document.createElement('style');
                    styleElement.id = `cursor-style-${cursorData.socketId}`;
                    document.head.appendChild(styleElement);
                }
                
                styleElement.innerHTML = `
                    .tooltip-${cursorData.socketId} {
                        border-left: 2px solid ${cursorData.color};
                        position: absolute;
                        height: 100%;
                    }
                    .tooltip-${cursorData.socketId}::after {
                        content: '${cursorData.username}';
                        position: absolute;
                        top: -16px;
                        left: 0;
                        background: ${cursorData.color};
                        color: white;
                        font-size: 10px;
                        padding: 1px 4px;
                        border-radius: 2px;
                        white-space: nowrap;
                    }
                `;
            }
        };

        const handleUserDisconnected = ({ socketId }) => {
            if (remoteCursorsRef.current[socketId]) {
                delete remoteCursorsRef.current[socketId];
                // Remove style element
                const styleElement = document.getElementById(`cursor-style-${socketId}`);
                if (styleElement) styleElement.remove();
                
                // Clear their decoration
                if (decorationsRef.current && monacoRef.current) {
                    const monaco = monacoRef.current;
                    const newDecorations = Object.values(remoteCursorsRef.current).map(cursor => ({
                        range: new monaco.Range(cursor.position.lineNumber, cursor.position.column, cursor.position.lineNumber, cursor.position.column),
                        options: {
                            className: 'remote-cursor',
                            beforeContentClassName: `remote-cursor-tooltip tooltip-${cursor.socketId}`
                        }
                    }));
                    decorationsRef.current.set(newDecorations);
                }
            }
        };

        socket.on(ACTIONS.CURSOR_MOVED, handleCursorMoved);
        socket.on(ACTIONS.DISCONNECTED, handleUserDisconnected);

        return () => {
            socket.off(ACTIONS.CURSOR_MOVED, handleCursorMoved);
            socket.off(ACTIONS.DISCONNECTED, handleUserDisconnected);
        };
    }, [socket, fileId]);

    return (
        <div className="flex-1 h-full relative">
            <MonacoEditor
                height="100%"
                language={language}
                theme="vs-dark"
                value={content}
                onMount={handleEditorDidMount}
                onChange={handleEditorChange}
                path={fileId}
                options={{
                    automaticLayout: true,
                    wordWrap: "on",
                    minimap: { enabled: true },
                    fontSize: 16,
                    padding: { top: 20 },
                }}
            />
            {inlineWidget.visible && (
                <AiInlineWidget
                    editor={editorRef.current}
                    monaco={monacoRef.current}
                    position={{ lineNumber: inlineWidget.lineNumber, column: inlineWidget.column }}
                    onClose={() => setInlineWidget(prev => ({ ...prev, visible: false }))}
                    fileContent={content}
                    language={language}
                    roomId={roomId}
                    onAccept={(newContent) => {
                        handleEditorChange(newContent);
                        setInlineWidget({ visible: false, lineNumber: 1, column: 1 });
                    }}
                />
            )}
        </div>
    );
};

export default Editor;
