const { GoogleGenerativeAI } = require('@google/generative-ai');

let genAI = null;
let model = null;
let openRouterApiKey = null;
let openRouterModel = 'google/gemini-2.0-flash';

function initAI() {
    openRouterApiKey = process.env.OPENROUTER_API_KEY;
    openRouterModel = process.env.OPENROUTER_MODEL || 'google/gemini-2.0-flash';

    if (openRouterApiKey) {
        console.log(`✅ OpenRouter AI initialized successfully. Model: ${openRouterModel}`);
        return true;
    }

    // Fallback to direct Gemini
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.warn('⚠️ No AI credentials (OPENROUTER_API_KEY or GEMINI_API_KEY) provided. AI features will be disabled.');
        return false;
    }
    try {
        genAI = new GoogleGenerativeAI(apiKey);
        model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
        console.log('✅ Gemini AI initialized successfully (fallback mode).');
        return true;
    } catch (err) {
        console.error('❌ Failed to initialize direct Gemini AI fallback:', err);
        return false;
    }
}

function isAvailable() {
    return !!openRouterApiKey || model !== null;
}

/**
 * Build a context string from all room files for the AI to reference.
 */
function buildCodeContext(files) {
    if (!files || files.length === 0) return 'No files in this room yet.';

    return files.map(f => {
        return `--- File: ${f.name} (${f.language}) ---\n${f.content || '(empty)'}\n--- End of ${f.name} ---`;
    }).join('\n\n');
}

/**
 * Chat with the AI assistant. Supports streaming via a callback.
 * @param {Array} conversationHistory - [{role: 'user'|'model', parts: [{text}]}]
 * @param {Array} files - Room files for context
 * @param {Function} onChunk - Called with each streamed text chunk
 * @returns {Promise<string>} Full response text
 */
async function chatWithAI(conversationHistory, files, onChunk) {
    if (!isAvailable()) throw new Error('AI service not initialized');

    const codeContext = buildCodeContext(files);
    const systemInstruction = `You are CodePair AI, an expert pair programming assistant built into a real-time collaborative code editor. You have full access to every file in the current coding room.

CURRENT ROOM CODEBASE:
${codeContext}

RULES:
- You are helpful, concise, and technically precise.
- When referencing code, quote the exact file name and line.
- Format code using markdown fenced code blocks with the correct language tag.
- If asked to explain code, walk through the logic step by step.
- If asked to find bugs, identify specific issues and suggest fixes.
- If asked to improve code, explain what you'd change and why.
- Keep responses focused and actionable. Don't repeat the entire file unless asked.
- You can reference any file in the room by name.`;

    if (openRouterApiKey) {
        // Convert gemini history format to standard OpenAI messages format for OpenRouter
        const openRouterMessages = [
            { role: 'system', content: systemInstruction }
        ];

        for (const msg of conversationHistory) {
            openRouterMessages.push({
                role: msg.role === 'user' ? 'user' : 'assistant',
                content: msg.parts[0]?.text || ''
            });
        }

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${openRouterApiKey}`,
                'HTTP-Referer': 'http://localhost:5000',
                'X-Title': 'CodePair AI',
            },
            body: JSON.stringify({
                model: openRouterModel,
                messages: openRouterMessages,
                stream: true,
                temperature: 0.7,
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let fullText = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;
                if (trimmed === 'data: [DONE]') continue;
                if (trimmed.startsWith('data: ')) {
                    try {
                        const data = JSON.parse(trimmed.slice(6));
                        const content = data.choices?.[0]?.delta?.content;
                        if (content) {
                            fullText += content;
                            if (onChunk) onChunk(content);
                        }
                    } catch (e) {
                        // Ignore parse error
                    }
                }
            }
        }

        return fullText;
    } else {
        const chat = model.startChat({
            history: conversationHistory,
            systemInstruction: { role: 'user', parts: [{ text: systemInstruction }] },
            generationConfig: {
                temperature: 0.7,
                topP: 0.95,
                maxOutputTokens: 4096,
            },
        });

        const lastMessage = conversationHistory.length > 0
            ? conversationHistory[conversationHistory.length - 1].parts[0].text
            : '';

        const result = await chat.sendMessageStream(lastMessage);

        let fullText = '';
        for await (const chunk of result.stream) {
            const text = chunk.text();
            fullText += text;
            if (onChunk) onChunk(text);
        }

        return fullText;
    }
}

/**
 * Generate inline code based on an instruction at a specific cursor position.
 * @param {string} fileContent - The full file content
 * @param {number} cursorLine - 1-indexed line number where the cursor is
 * @param {string} instruction - What the user wants (e.g., "add error handling")
 * @param {string} language - Programming language
 * @returns {Promise<{code: string, explanation: string}>}
 */
async function generateInlineCode(fileContent, cursorLine, instruction, language) {
    if (!isAvailable()) throw new Error('AI service not initialized');

    const lines = fileContent.split('\n');
    const contextStart = Math.max(0, cursorLine - 15);
    const contextEnd = Math.min(lines.length, cursorLine + 15);
    const surroundingCode = lines.slice(contextStart, contextEnd).map((line, i) => {
        const lineNum = contextStart + i + 1;
        const marker = lineNum === cursorLine ? ' <<<CURSOR>>>' : '';
        return `${lineNum}: ${line}${marker}`;
    }).join('\n');

    const prompt = `You are a code generation engine inside a collaborative code editor. The user has their cursor at line ${cursorLine} in a ${language} file and wants you to: "${instruction}"

Here is the code around the cursor (the cursor line is marked with <<<CURSOR>>>):

\`\`\`${language}
${surroundingCode}
\`\`\`

Full file content:
\`\`\`${language}
${fileContent}
\`\`\`

RESPOND WITH ONLY A JSON OBJECT (no markdown fences, no extra text):
{
  "code": "the complete modified code for the ENTIRE file (not just the changed part)",
  "explanation": "1-2 sentence explanation of what was changed"
}

RULES:
- Return the ENTIRE file content with your modifications applied.
- Make minimal, targeted changes that accomplish the instruction.
- Maintain the existing code style and indentation.
- Do not add unnecessary comments or changes.`;

    let responseText = '';

    if (openRouterApiKey) {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${openRouterApiKey}`,
                'HTTP-Referer': 'http://localhost:5000',
                'X-Title': 'CodePair AI',
            },
            body: JSON.stringify({
                model: openRouterModel,
                messages: [
                    { role: 'user', content: prompt }
                ],
                temperature: 0.3,
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        responseText = (data.choices?.[0]?.message?.content || '').trim();
    } else {
        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.3,
                maxOutputTokens: 8192,
            },
        });

        responseText = result.response.text().trim();
    }

    // Try to parse the JSON response, handling potential markdown wrapping
    let parsed;
    try {
        parsed = JSON.parse(responseText);
    } catch {
        // Try extracting JSON from markdown code block
        const jsonMatch = responseText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
        if (jsonMatch) {
            parsed = JSON.parse(jsonMatch[1].trim());
        } else {
            // Last resort: try to find JSON object in the response
            const objectMatch = responseText.match(/\{[\s\S]*\}/);
            if (objectMatch) {
                parsed = JSON.parse(objectMatch[0]);
            } else {
                throw new Error('Failed to parse AI response as JSON');
            }
        }
    }

    return {
        code: parsed.code || '',
        explanation: parsed.explanation || 'Code generated successfully.',
    };
}

/**
 * Analyze time and space complexity of the given code.
 * @param {string} code - The code to analyze
 * @param {string} language - Programming language
 * @returns {Promise<{time: string, space: string, explanation: string, rating: string}>}
 */
async function analyzeComplexity(code, language) {
    if (!isAvailable()) throw new Error('AI service not initialized');

    const prompt = `You are an algorithm complexity analyzer. Analyze the following ${language} code and determine its time and space complexity.

\`\`\`${language}
${code}
\`\`\`

RESPOND WITH ONLY A JSON OBJECT (no markdown fences, no extra text):
{
  "time": "O(...) notation, e.g. O(n log n)",
  "space": "O(...) notation, e.g. O(n)",
  "explanation": "A clear 2-4 sentence explanation of WHY the code has this complexity. Mention the key operations that determine the complexity (loops, recursion, data structures).",
  "rating": "one of: excellent, good, moderate, poor"
}

Rating guide:
- "excellent": O(1) or O(log n)
- "good": O(n) or O(n log n)  
- "moderate": O(n²) or O(n² log n)
- "poor": O(2^n), O(n!), or worse`;

    let responseText = '';

    if (openRouterApiKey) {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${openRouterApiKey}`,
                'HTTP-Referer': 'http://localhost:5000',
                'X-Title': 'CodePair AI',
            },
            body: JSON.stringify({
                model: openRouterModel,
                messages: [
                    { role: 'user', content: prompt }
                ],
                temperature: 0.2,
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        responseText = (data.choices?.[0]?.message?.content || '').trim();
    } else {
        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 1024,
            },
        });

        responseText = result.response.text().trim();
    }

    let parsed;
    try {
        parsed = JSON.parse(responseText);
    } catch {
        const jsonMatch = responseText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
        if (jsonMatch) {
            parsed = JSON.parse(jsonMatch[1].trim());
        } else {
            const objectMatch = responseText.match(/\{[\s\S]*\}/);
            if (objectMatch) {
                parsed = JSON.parse(objectMatch[0]);
            } else {
                throw new Error('Failed to parse complexity analysis');
            }
        }
    }

    return {
        time: parsed.time || 'Unknown',
        space: parsed.space || 'Unknown',
        explanation: parsed.explanation || 'Unable to determine complexity.',
        rating: parsed.rating || 'moderate',
    };
}

module.exports = {
    initAI,
    isAvailable,
    chatWithAI,
    generateInlineCode,
    analyzeComplexity,
};
