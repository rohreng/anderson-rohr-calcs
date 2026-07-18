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
  console.log(`Expected conservative rejections: ${p.conservativeRejections}; accepted: ${p.accepted}`);
  console.log(`Max observed conservatism margin: ${(100*p.maxConservatism).toFixed(3)}%`);
} else {
  console.error(`FAIL: ${report.error.message}`);
  process.exitCode=1;
}
