'use strict';
const assert = require('assert');
const g = require('./geometry');
const SEED = 0x5eedc0de;
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const rnd=mulberry32(SEED);
const ri=(a,b)=>Math.floor(a+rnd()*(b-a+1));
const rf=(a,b)=>a+rnd()*(b-a);

function sideDistances(anchors,i) { return anchors.flatMap((a,j)=>j===i?[]:[Math.hypot(a.x-anchors[i].x,a.y-anchors[i].y)]); }

function checkDomain(domain, stats) {
  const apt=[], apv=[], apvGroups=[];
  for(let i=0;i<domain.anchors.length;i++) {
    apt.push(g.perAnchorPairwiseApt({R:domain.R,index:i,anchors:domain.anchors}));
    // Apv side neighbors are bolts on the same row; cross-row/diagonal anchors are Apt-only.
    const peers=domain.anchors.filter(a=>Math.abs(a.y-domain.anchors[i].y)<1e-9);
    const peerIndex=peers.indexOf(domain.anchors[i]);
    apvGroups.push({anchors:peers,index:peerIndex});
    apv.push(g.perAnchorPairwiseApv({R_lbe:domain.R_lbe,index:peerIndex,anchors:peers,
      sideNeighborDistances:sideDistances(peers,peerIndex)}));
  }
  // Exactly one branch is taken for each generated geometry.
  if(apt.some(a=>a<=0)||apv.some(a=>a<=0)) { stats.conservativeRejections++; return; }
  for(let i=0;i<domain.anchors.length;i++) {
    const ad=g.exactTributaryAptDetail({R:domain.R,index:i,anchors:domain.anchors,edges:domain.edges});
    const vg=apvGroups[i];
    const vd=g.exactTributaryApvDetail({R_lbe:domain.R_lbe,index:vg.index,anchors:vg.anchors,
      edges:domain.apvEdges||[],direction:domain.direction});
    for(const [pair,exact,eps,label] of [[apt[i],ad.area,ad.epsilon,'Apt'],[apv[i],vd.area,vd.epsilon,'Apv']]) {
      assert.ok(Number.isFinite(pair)&&pair>=0,`${domain.type} ${label} invalid: ${pair}`);
      assert.ok(pair<=exact+eps+1e-10,`${domain.type} ${label}: ${pair} > ${exact} + ${eps}`);
      if(exact>0) stats.maxConservatism=Math.max(stats.maxConservatism,(exact-pair)/exact);
      stats.anchorAssertions++;
    }
  }
  stats.accepted++;
}

function runPropertyTests() {
  const stats={seed:SEED,geometries:0,accepted:0,conservativeRejections:0,anchorAssertions:0,maxConservatism:0,byDomain:{}};
  for(const type of ['tow','embed','sd']) {
    const before={accepted:stats.accepted,rejected:stats.conservativeRejections};
    for(let n=0;n<500;n++) {
      let d;
      if(type==='tow') {
        const b=rf(7.625,12), dia=rf(0.375,0.75), head=rf(0.75,1.25), cover=rf(0.25,0.75), min=head/2+cover;
        const rows=ri(1,2), cols=ri(1,6), gauge=rows===2?rf(Math.max(2,min*2),Math.max(2.01,b-2*min)):0;
        const o1=rows===1?rf(min,b-min):rf(min,b-min-gauge);
        const lb=rf(2.5,8), s=cols===1?0:rf(Math.max(4*dia,head+0.5),12);
        d=g.buildTowDomain({b,o1,g:gauge,rows,cols,s,lb}); d.R_lbe=rf(2,Math.min(6,b)); d.apvEdges=[]; d.direction={x:0,y:-1};
      } else if(type==='embed') {
        const rows=ri(1,2),cols=ri(1,3),dia=rf(0.375,0.75),head=rf(0.75,1.25),minSpace=Math.max(4*dia,head+0.5);
        d=g.buildEmbedDomain({edgeDistance:rf(1.5,8),rows,cols,d:rows===2?rf(minSpace,12):0,
          Sx:cols===1?0:rf(minSpace,14),Lb:rf(2.5,9)});
        d.R_lbe=rf(2,7); d.apvEdges=[]; d.direction={x:0,y:-1};
      } else {
        const bolts=ri(1,6),dia=rf(0.5,1.25),minSpace=Math.max(4*dia,dia+0.5);
        d=g.buildSdDomain({bolts,s:bolts===1?0:rf(minSpace,14),lbe:rf(2,8),lb:rf(2.5,9)});
      }
      checkDomain(d,stats); stats.geometries++;
    }
    stats.byDomain[type]={geometries:500,accepted:stats.accepted-before.accepted,
      conservativeRejections:stats.conservativeRejections-before.rejected};
  }
  assert.strictEqual(stats.accepted+stats.conservativeRejections,stats.geometries);
  return stats;
}
module.exports={runPropertyTests,mulberry32};
if(require.main===module) console.log(runPropertyTests());
