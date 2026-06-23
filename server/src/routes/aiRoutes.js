const express = require('express');
const router = express.Router();
const Room = require('../models/Room');
const aiService = require('../services/aiService');

// ─── Rate Limiter ──────────────────────────────────────────────────────────────
// Simple per-room rate limiter: max 20 requests per minute
const rateLimitMap = new Map(); // roomId -> { count, resetAt }
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60 * 1000;

function checkRateLimit(roomId) {
    const now = Date.now();
    const entry = rateLimitMap.get(roomId);

    if (!entry || now > entry.resetAt) {
        rateLimitMap.set(roomId, { count: 1, resetAt: now + RATE_WINDOW_MS });
        return true;
    }

    if (entry.count >= RATE_LIMIT) {
        return false;
    }

    entry.count++;
    return true;
}

// Clean up stale entries every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of rateLimitMap) {
        if (now > value.resetAt) rateLimitMap.delete(key);
    }
}, 5 * 60 * 1000);

// Helper to determine if an error is due to API rate limits or quota exhaustion
function isAIQuotaError(err) {
    if (err.status === 429 || err.statusCode === 429) return true;
    const msg = (err.message || '').toLowerCase();
    if (
        msg.includes('quota') || 
        msg.includes('limit') || 
        msg.includes('exhausted') || 
        msg.includes('429') ||
        msg.includes('credit') ||
        msg.includes('balance')
    ) {
        return true;
    }
    return false;
}

// ─── Middleware ─────────────────────────────────────────────────────────────────

function requireAI(req, res, next) {
    if (!aiService.isAvailable()) {
        return res.status(503).json({
            error: 'AI service not configured',
            message: 'The server does not have AI credentials (OPENROUTER_API_KEY or GEMINI_API_KEY) configured. AI features are unavailable.',
        });
    }
    next();
}

function requireRateLimit(req, res, next) {
    const roomId = req.body.roomId;
    if (!roomId) {
        return res.status(400).json({ error: 'roomId is required' });
    }
    if (!checkRateLimit(roomId)) {
        return res.status(429).json({
            error: 'Rate limit exceeded',
            message: 'Too many AI requests. Please wait a moment before trying again.',
        });
    }
    next();
}

// ─── POST /api/ai/chat (Server-Sent Events) ────────────────────────────────────

router.post('/chat', requireAI, requireRateLimit, async (req, res) => {
    const { roomId, messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'messages array is required' });
    }

    try {
        // Fetch room files for context
        const room = await Room.findOne({ roomId });
        const files = room ? room.files : [];

        // Set up SSE headers
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no',
        });

        // Convert our message format to Gemini's format
        // We only pass the conversation history up to (but not including) the last message
        // because chatWithAI sends the last message via sendMessageStream
        const geminiHistory = messages.slice(0, -1).map(msg => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.content }],
        }));

        // Append the last user message to history so chatWithAI can extract it
        if (messages.length > 0) {
            const lastMsg = messages[messages.length - 1];
            geminiHistory.push({
                role: lastMsg.role === 'user' ? 'user' : 'model',
                parts: [{ text: lastMsg.content }],
            });
        }

        let fullText = '';
        await aiService.chatWithAI(geminiHistory, files, (chunk) => {
            fullText += ''; // tracking handled inside service
            res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
        });

        res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
        res.end();
    } catch (err) {
        console.error('AI Chat Error:', err);
        const isQuota = isAIQuotaError(err);
        const errorMessage = isQuota 
            ? 'AI key quota/rate limit exceeded. Please check your account balance, plan/billing details, or try again later.'
            : err.message;

        // If headers already sent, send error as SSE event
        if (res.headersSent) {
            res.write(`data: ${JSON.stringify({ type: 'error', isQuota, content: errorMessage })}\n\n`);
            res.end();
        } else {
            res.status(isQuota ? 429 : 500).json({ 
                error: 'AI request failed', 
                isQuota, 
                message: errorMessage 
            });
        }
    }
});

// ─── POST /api/ai/inline ────────────────────────────────────────────────────────

router.post('/inline', requireAI, requireRateLimit, async (req, res) => {
    const { roomId, fileContent, cursorLine, instruction, language } = req.body;

    if (!fileContent || !instruction || !language) {
        return res.status(400).json({ error: 'fileContent, instruction, and language are required' });
    }

    try {
        const result = await aiService.generateInlineCode(
            fileContent,
            cursorLine || 1,
            instruction,
            language
        );
        res.json(result);
    } catch (err) {
        console.error('AI Inline Error:', err);
        const isQuota = isAIQuotaError(err);
        const errorMessage = isQuota 
            ? 'AI key quota/rate limit exceeded. Please check your account balance, plan/billing details, or try again later.'
            : err.message;
        res.status(isQuota ? 429 : 500).json({ 
            error: 'Inline generation failed', 
            isQuota,
            message: errorMessage 
        });
    }
});

// ─── POST /api/ai/complexity ────────────────────────────────────────────────────

router.post('/complexity', requireAI, requireRateLimit, async (req, res) => {
    const { roomId, code, language } = req.body;

    if (!code || !language) {
        return res.status(400).json({ error: 'code and language are required' });
    }

    try {
        const result = await aiService.analyzeComplexity(code, language);
        res.json(result);
    } catch (err) {
        console.error('AI Complexity Error:', err);
        const isQuota = isAIQuotaError(err);
        const errorMessage = isQuota 
            ? 'AI key quota/rate limit exceeded. Please check your account balance, plan/billing details, or try again later.'
            : err.message;
        res.status(isQuota ? 429 : 500).json({ 
            error: 'Complexity analysis failed', 
            isQuota,
            message: errorMessage 
        });
    }
});

module.exports = router;
