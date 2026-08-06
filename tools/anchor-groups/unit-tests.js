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

  // ── Closed-form tributary construction (design path) ──────────────────────
  // Unclipped disc and single-chord clips must reduce to the analytic values.
  near(g.circleHalfPlanesArea(0,0,5,[]),Math.PI*25); count++;
  near(g.circleHalfPlanesArea(0,0,4,[{a:0,b:1,c:2}]),Math.PI*16-g.circSeg(4,2)); count++;
  near(g.tributaryApt({R:4,index:0,anchors:[{x:0,y:0},{x:6,y:0}]}),
    Math.PI*16-g.circSeg(4,3)); count++;
  // Exact tangency: a clip plane touching the circle must not change the area
  // (from either side). A tangent polygon edge's midpoint lies ON the circle;
  // it must classify as a sector, not a chord triangle.
  near(g.circleHalfPlanesArea(0,0,2.5,[{a:0,b:1,c:2.5}]),Math.PI*6.25,1e-9); count++;
  near(g.circleHalfPlanesArea(0,0,2.5,[{a:0,b:-1,c:-2.5}]),0,1e-9); count++;
  near(g.tributaryApt({R:2.5,index:0,anchors:[{x:0,y:0},{x:5,y:0}]}),Math.PI*6.25,1e-9); count++;

  // Corner regions beyond BOTH a face and a spacing midplane: independent
  // segment subtraction double-deducts them; the closed form must match the
  // integrator exactly and sit ABOVE the segment-subtraction lower bound.
  {
    const R=5, planes=[{a:0,b:-1,c:3},{a:1,b:0,c:2},{a:-1,b:0,c:2}];
    const cf=g.circleHalfPlanesArea(0,0,R,planes);
    const ex=g.exactTributaryAptDetail({R,index:0,anchors:[{x:0,y:0}],edges:planes});
    near(cf,ex.area,ex.epsilon+1e-9); count++;
    const lower=Math.PI*R*R-g.circSeg(R,3)-2*g.circSeg(R,2);
    assert.ok(cf>lower+0.01,`corner reclaim missing: ${cf} <= ${lower}`); count++;
  }

  // ── Handoff reproduction case (2026-08-05): 12" CMU, 2×3 group ───────────
  // Anchor order from buildTowDomain: row1 c1..c3 (idx 0-2), row2 c1..c3
  // (idx 3-5). R2C2 = index 4 governs. Tributary must match the oracle,
  // be ~45 in² at BOTH embedments, and never decrease as lb grows.
  {
    const geoOf=lb=>g.buildTowDomain({b:11.625,o1:3.5,g:5,rows:2,cols:3,s:8,lb});
    const t=(lb,i)=>{const dom=geoOf(lb);
      return g.tributaryApt({R:lb,index:i,anchors:dom.anchors,edges:dom.edges});};
    const domHi=geoOf(6.65625);
    let sumCf=0,sumEx=0,sumEps=0;
    for(let i=0;i<6;i++){
      const cf=t(6.65625,i);
      const ex=g.exactTributaryAptDetail({R:6.65625,index:i,anchors:domHi.anchors,edges:domHi.edges});
      near(cf,ex.area,ex.epsilon+1e-9);
      assert.ok(t(6.65625,i)>=t(5.0,i)-1e-9,`Apt inversion at anchor ${i}`);
      sumCf+=cf; sumEx+=ex.area; sumEps+=ex.epsilon;
      count+=2;
    }
    near(sumCf,sumEx,sumEps+1e-9); count++;      // Σ tributary = true union
    near(t(6.65625,4),44.98,0.15); count++;      // governing anchor ≈ flat
    near(t(5.0,4),45.04,0.15); count++;
  }
  return { passed:count, failed:0 };
}
module.exports={runUnitTests};
if(require.main===module) console.log(runUnitTests());
