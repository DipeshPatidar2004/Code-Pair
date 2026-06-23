# CodePair: Deep-Dive Technical Architecture & Workflow

This document provides a highly detailed, low-level technical explanation of how CodePair operates under the hood. It is intended for developers who want to understand the exact data flows, state management, and network architectures used in the platform.

---

## 1. System Overview & Networking

CodePair utilizes a hybrid networking model:
1. **Client-Server (WebSockets)**: Used for all signaling, chat, cursor tracking, and file state synchronization. Powered by `Socket.IO`.
2. **Peer-to-Peer (WebRTC)**: Used exclusively for heavy media streaming (Audio/Video). Powered by `simple-peer`.
3. **HTTP/REST (Code Execution)**: Used by the Node server to communicate with external APIs (like JDoodle) when local compilers are unavailable.

### The Socket.IO State Management
The backend (`server/src/config/socket.js`) acts as the single source of truth for the session state. It stores:
- `userSocketMap`: A dictionary mapping `socket.id` to a `username`.
- `roomFiles`: A dictionary mapping `roomId` to an array of file objects.
- `roomChats`: A dictionary mapping `roomId` to an array of chat messages.
- `roomCallUsers`: A dictionary tracking exactly which `socket.id`s have actively joined the WebRTC voice channel.

When a user connects and emits `ACTIONS.JOIN`, the server joins their socket to a specific Socket.IO room (`socket.join(roomId)`). The server then immediately blasts out three synchronization payloads to the newly joined client:
1. `SYNC_FILES`: The latest state of the code and all files.
2. `sync-chat`: The full array of previous chat messages.
3. `sync-call-users`: The list of users currently active in the video call.

---

## 2. Multi-File Collaborative Editor (Monaco)

The core coding experience is powered by Microsoft's `Monaco Editor`.

### Code Synchronization
When User A types in the editor, the `onCodeChange` event fires.
1. The frontend aggressively updates its local state (Optimistic UI update) so typing feels instantaneous.
2. It emits an `ACTIONS.FILE_UPDATED` WebSocket event containing the `fileId` and the new `content`.
3. The server receives this, updates its in-memory `roomFiles` dictionary, and broadcasts the event to all *other* clients in the room using `socket.in(roomId).emit()`.
4. Other clients receive the event and update their React state, which triggers a re-render of their Monaco Editor with the new text.

### Remote Cursor Tracking
To display remote cursors, we tap into Monaco's `onDidChangeCursorPosition` API:
1. Every time a user moves their cursor, their X/Y coordinates (lineNumber and column) are captured.
2. We throttle this event (to prevent flooding the WebSocket network) and emit `ACTIONS.CURSOR_MOVED`.
3. When remote clients receive these coordinates, they use `monaco.editor.createDecorationsCollection()`.
4. We dynamically inject custom CSS `<style>` blocks into the DOM to generate a unique cursor color for that specific `socket.id`.
5. Monaco renders the remote cursor as a standard text decoration, complete with a floating "BeforeContent" pseudo-element containing the remote user's username.

---

## 3. Code Execution Engine

CodePair boasts a highly resilient, dual-layered code execution engine.

### Layer 1: Native Local Compilation (Zero Limits)
When the user clicks "Run Code", the frontend emits an `EXECUTE_CODE` socket event. The Node backend intercepts this:
1. It writes the current code content to a temporary physical file on the server's disk (e.g., `temp.cpp` or `temp.java`).
2. It uses Node.js's native `child_process.spawn()` to invoke system-level compilers.
   - For C++: It spawns `g++ temp.cpp -o temp.out` and then executes `./temp.out`.
   - For Java: It spawns `javac Main.java` and then executes `java Main`.
   - For JS: It spawns `node temp.js`.
3. The server captures the `stdout` and `stderr` streams, buffers the output, and sends it back to the client via `EXECUTION_RESULT`.

### Layer 2: JDoodle API Fallback
If the server detects that the host machine does not have `g++` or `javac` installed, it seamlessly fails over to the JDoodle Compiler API.
1. It maps our internal language tags (`cpp`, `java`) to JDoodle's schema (`cpp17`, `java`).
2. It fires a REST API `POST` request to `https://api.jdoodle.com/v1/execute` containing the source code and the developer's API credentials.
3. The API runs the code on a remote container and returns the output/CPU time, which is then forwarded back to the client.

---

## 4. WebRTC Video Mesh Network

The video calling system uses a strict Peer-to-Peer (P2P) Mesh architecture. The Node.js server *never* touches the video or audio packets; it is only used to relay connection offers (Signaling).

### Vite Node Polyfills (Critical Infrastructure)
Because we use `simple-peer` (which relies heavily on Node.js core modules like `events`, `process`, and `stream`), standard Vite setups will crash in the browser. We configured `vite.config.js` with `vite-plugin-node-polyfills` to shim these dependencies into the browser environment.

### The Connection Flow (Strict Privacy)
To ensure spectators cannot see the video grid, we implemented strict signaling guardrails.
1. **Join Call**: When a user clicks "Join Call", they capture their `navigator.mediaDevices.getUserMedia()` stream.
2. They emit `JOIN_CALL` to the server, which adds them to the `roomCallUsers` array.
3. **Selective Initiation**: The client looks at the `callUsers` array. It loops through *only* the users actively in the call and creates a new `Peer({ initiator: true })` for each of them.
4. **Signaling**: The peer generates a WebRTC "Offer" signal. This is sent through WebSockets (`ACTIONS.WEBRTC_SIGNAL`) to the specific remote client.
5. **Answering**: The remote client receives the offer. *Crucially*, the remote client's `useWebRTC.jsx` hook checks if it has its own `localStream`. If it doesn't (meaning it hasn't clicked "Join Call"), it completely ignores the signal. If it *is* in the call, it generates an "Answer" signal and sends it back.
6. **Streaming**: Once the ICE connection is established, `peer.on('stream')` fires, and the video stream is injected into the React `remoteStreams` state.

### Dynamic Mesh Resizing (Peer.addStream)
If User A is in the call, and User B joins later, User B initiates to User A. User A *already* has a peer object for User B. Instead of destroying and recreating the WebRTC tunnel, User B simply uses `peer.addStream()` to inject their video track into the existing, live connection.

### Discord-Style Grid & Pinning
- The `VideoGrid.jsx` component dynamically counts the number of active streams and uses TailwindCSS grid utilities (`grid-cols-1`, `grid-cols-2`) to responsively layout the videos.
- **Pinning**: Clicking a `VideoBox` sets a `pinnedId` state in the grid. If `pinnedId` is active, the grid `.filter()`s out all other streams and strictly renders only the pinned video, allowing it to expand to full size.

---

## 5. Real-Time Chat

The Chat panel is designed to operate seamlessly alongside the editor.
1. **Message Transmission**: Users type a message and hit Send. The frontend immediately renders it locally (Optimistic update).
2. It fires `ACTIONS.CHAT_MESSAGE` to the server.
3. The server intercepts it, pushes the message object into the `roomChats[roomId]` array (persisting it in server memory), and broadcasts it to all other sockets.
4. **Auto-Scroll**: A React `useRef` tracks the bottom of the chat div. An effect triggers `.scrollIntoView({ behavior: 'smooth' })` every time the `messages` array changes.

---

## 6. Database & Persistent State (MongoDB)

To ensure sessions survive server restarts and users can revisit old rooms, CodePair uses MongoDB.

### Data Models
- **User Schema**: Stores `username`, `email`, hashed `password`, and arrays of `rooms` the user is a participant of.
- **Room Schema**: The master record of a collaborative session. It stores the `roomId`, the `creator`, a list of `participants`, the current array of `files` (including their content), and the full `chatHistory`.

### In-Memory vs Persistent State
To guarantee real-time, low-latency collaboration (which is impossible if writing to a DB on every keystroke), CodePair uses a **hybrid synchronization strategy**:
1. **In-Memory Speed**: All real-time typing, file creation, and chatting operates purely via WebSocket and the Node server's in-memory dictionaries (`roomFiles`, `roomChats`). This ensures zero lag.
2. **Periodic Flushing**: The server runs an aggressive `setInterval` loop that periodically scrapes the latest in-memory state of active rooms and executes batch `findOneAndUpdate` operations against MongoDB.
3. **Graceful Hydration**: When a user joins a room, the server first checks its in-memory RAM map. If the room isn't in RAM, it falls back to MongoDB, fetching the saved files and chats, loading them into RAM, and then piping them to the client.

---

## 7. Authentication & Dashboard

CodePair enforces robust, production-ready authentication and session management.

### Email OTP & JWT Handshake
1. **Registration**: When a user registers, their details are temporarily held in an `OTP` MongoDB collection. The server utilizes `NodeMailer` to blast a secure 6-digit pin to their email.
2. **Verification**: Once the user enters the OTP, their data is moved to the primary `User` collection.
3. **Tokenization**: The server generates a signed JSON Web Token (`jsonwebtoken`) embedding their `id` and `username`. This is passed to the client and stored in `localStorage`.

### Stateful Authorization
Every API request hitting the backend (e.g., fetching rooms, creating rooms, deleting rooms) runs through an `authMiddleware`.
1. The middleware parses the `Authorization: Bearer <token>` header.
2. It verifies the token signature against the `JWT_SECRET`.
3. If valid, the execution proceeds. If invalid, the frontend globally intercepts the `401 Unauthorized` response via Axios interceptors and aggressively ejects the user back to the login screen.

### The Dashboard
The User Dashboard dynamically queries the database for all `Room` documents where the user's `userId` exists within the `participants` array. To enforce security, a user can only physically delete a room from the database if their `userId` matches the room's `creator` property.
