'use strict';
const assert = require('assert');
const g = require('./geometry');
const near = (a,b,t=1e-9) => assert.ok(Math.abs(a-b)<=t, `${a} != ${b} (tol ${t})`);

function runUnitTests() {
  let count=0;
  near(g.circSeg(3,0), 4.5*Math.PI); count++;
  near(g.circSeg(3,3), 0); count++;
  near(g.circSeg(2,1), 4*Math.PI/3-Math.sqrt(3)); count++;

  const lb=4,b=6;
  const tow=g.buildTowDomain({b,o1:b/2,rows:1,cols:1,lb});
  near(g.perAnchorPairwiseApt({R:lb,index:0,anchors:tow.anchors}),
    Math.PI*lb*lb-2*g.circSeg(lb,b/2)); count++;

  for (const s of [8,6]) {
    const anchors=[{x:0,y:0},{x:s,y:0}];
    const pair=g.perAnchorPairwiseApt({R:4,index:0,anchors});
    const lens=s<8?2*g.circSeg(4,s/2):0;
    near(pair,Math.PI*16-lens/2); count++;
    const analytic=Math.PI*16-lens/2;
    const detail=g.exactTributaryAptDetail({R:4,index:0,anchors});
    near(detail.area,analytic,detail.epsilon+1e-9); count++;
  }

  const aa=[{x:0,y:0},{x:6,y:0}];
  near(g.perAnchorPairwiseApv({R_lbe:4,index:0,anchors:aa,sideNeighborDistances:[6]}),
    Math.PI*8-0.5*g.circSeg(4,3)); count++;
  near(g.perAnchorPairwiseApv({R_lbe:4,index:0,anchors:[aa[0]],sideNeighborDistances:[]}),Math.PI*8); count++;

  const d=g.exactTributaryAptDetail({R:5,index:0,anchors:[{x:0,y:0}]});
  near(d.area,Math.PI*25,d.epsilon+1e-9);
  assert.ok(d.epsilon<=g.epsilonRule(5,d.area)); count+=2;
  return { passed:count, failed:0 };
}
module.exports={runUnitTests};
if(require.main===module) console.log(runUnitTests());
