const axios = require('axios');

async function testWandbox() {
    try {
        const res = await axios.post('https://wandbox.org/api/compile.json', {
            code: 'console.log("Hello from Wandbox!");',
            compiler: 'nodejs' // Or try a specific version?
        });
        console.log("Success:", res.data);
    } catch (e) {
        console.error("Error:", e.response ? e.response.data : e.message);
    }
}
testWandbox();
