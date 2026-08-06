'use strict';
const fs=require('fs'), path=require('path');
const {runUnitTests}=require('./unit-tests');
const {runPropertyTests}=require('./property-tests');
const report={startedAt:new Date().toISOString(),node:process.version,pass:false};
try {
  report.unit=runUnitTests();
  report.property=runPropertyTests();
  report.pass=true;
} catch(error) {
  report.error={message:error.message,stack:error.stack};
}
report.finishedAt=new Date().toISOString();
fs.writeFileSync(path.join(__dirname,'report.json'),JSON.stringify(report,null,2)+'\n');
if(report.pass) {
  const p=report.property;
  console.log(`PASS: ${report.unit.passed} unit checks; ${p.geometries} property geometries (${p.anchorAssertions} anchor-area assertions)`);
  console.log(`All geometries accepted: ${p.accepted} (tributary areas are always positive — rejections are failures now)`);
  console.log(`Max closed-form vs oracle deviation: ${(100*p.maxDeviation).toFixed(4)}% (bounded by the oracle's own epsilon)`);
} else {
  console.error(`FAIL: ${report.error.message}`);
  process.exitCode=1;
}
