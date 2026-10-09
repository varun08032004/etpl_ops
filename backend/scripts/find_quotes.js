const fs = require('fs');
const sql = fs.readFileSync('db/060_jira_comprehensive.sql', 'utf8');
const lines = sql.split('\n');
lines.forEach((line, i) => {
    if (line.includes("\\'")) {
        console.log(i+1, line.trim());
    }
});