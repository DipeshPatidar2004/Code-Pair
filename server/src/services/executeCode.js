const axios = require('axios');

function executeCode(language, filename, content) {
    return new Promise(async (resolve, reject) => {
        try {
            // Map language aliases to standard names if needed
            let runLang = language;
            if (runLang === 'node') runLang = 'javascript';
            if (runLang === 'py') runLang = 'python';
            if (runLang === 'c++') runLang = 'cpp';

            const response = await axios.post('https://code-runner-production-d90c.up.railway.app/execute', {
                language: runLang,
                code: content
            });

            const data = response.data;

            let stdout = data.output || '';
            let stderr = data.error || '';

            return resolve({ error: null, stderr, stdout });
        } catch (err) {
            console.error("Internal Error Details:", err.response?.data || err.message);
            return resolve({
                error: err.message,
                stderr: err.response?.data?.error || err.message,
                stdout: ''
            });
        }
    });
}

module.exports = executeCode;
