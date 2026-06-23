require('dotenv').config();
const executeCode = require('../src/services/executeCode');

async function run() {
    console.log("Running with JDoodle...");
    const result = await executeCode('javascript', 'index.js', 'console.log("Hello from JDoodle API!");');
    console.log(result);
}
run();
