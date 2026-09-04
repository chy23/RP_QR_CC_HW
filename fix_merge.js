const fs = require('fs');

let code = fs.readFileSync('js/main.js', 'utf8');

const regex = /<<<<<<< HEAD[\s\S]*?=======\n([\s\S]*?)>>>>>>> main/g;

code = code.replace(regex, '$1');

fs.writeFileSync('js/main.js', code, 'utf8');
