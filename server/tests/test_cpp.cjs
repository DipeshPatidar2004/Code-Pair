const executeCode = require('../src/services/executeCode');
executeCode('cpp', 'main.cpp', '#include <iostream>\nusing namespace std;\nint main() { cout << "Hello C++ test!" << endl; return 0; }').then(console.log);
