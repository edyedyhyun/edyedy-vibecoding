const results = require('./economy-cases.js')(require('../economy.js'));
for(const r of results) console.log(`${r.passed?'PASS':'FAIL'} ${r.name}${r.error?': '+r.error:''}`);
if(results.some(r=>!r.passed)) process.exitCode=1;
