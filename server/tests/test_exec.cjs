const executeCode = require('../src/services/executeCode');
executeCode('javascript', 'test.js', 'console.log("hello test");').then(res => console.log(res));
