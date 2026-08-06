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
  // Design path is the closed-form Voronoi tributary partition. It must
  // (a) match the adaptive-integrator oracle TWO-SIDED within the oracle's
  //     own error bound — not merely sit below it (the old one-sided
  //     assertion passed geometries where the pairwise design value was
  //     0.2% of the exact area, which is how the A_pt inversion shipped);
  // (b) stay strictly positive (no "conservative rejections" — a rejected
  //     geometry is a failure now, not an expected outcome);
  // (c) be monotone non-decreasing in the cone radius.
  for(let i=0;i<domain.anchors.length;i++) {
    // Apv side neighbors are bolts on the same row; cross-row/diagonal anchors are Apt-only.
    const peers=domain.anchors.filter(a=>Math.abs(a.y-domain.anchors[i].y)<1e-9);
    const peerIndex=peers.indexOf(domain.anchors[i]);
    const apt=g.tributaryApt({R:domain.R,index:i,anchors:domain.anchors,edges:domain.edges});
    const apv=g.tributaryApv({R_lbe:domain.R_lbe,index:peerIndex,anchors:peers,
      edges:domain.apvEdges||[],direction:domain.direction});
    const ad=g.exactTributaryAptDetail({R:domain.R,index:i,anchors:domain.anchors,edges:domain.edges});
    const vd=g.exactTributaryApvDetail({R_lbe:domain.R_lbe,index:peerIndex,anchors:peers,
      edges:domain.apvEdges||[],direction:domain.direction});
    for(const [cf,exact,eps,label] of [[apt,ad.area,ad.epsilon,'Apt'],[apv,vd.area,vd.epsilon,'Apv']]) {
      assert.ok(Number.isFinite(cf)&&cf>0,`${domain.type} ${label} not positive: ${cf}`);
      assert.ok(Math.abs(cf-exact)<=eps+1e-9,`${domain.type} ${label}: |${cf} - ${exact}| > ${eps}`);
      if(exact>0) stats.maxDeviation=Math.max(stats.maxDeviation,Math.abs(cf-exact)/exact);
      stats.anchorAssertions++;
    }
    const aptUp=g.tributaryApt({R:domain.R*1.1,index:i,anchors:domain.anchors,edges:domain.edges});
    const apvUp=g.tributaryApv({R_lbe:domain.R_lbe*1.1,index:peerIndex,anchors:peers,
      edges:domain.apvEdges||[],direction:domain.direction});
    assert.ok(aptUp>=apt-1e-9,`${domain.type} Apt inversion: R↑ ${domain.R}→ area ${apt}→${aptUp}`);
    assert.ok(apvUp>=apv-1e-9,`${domain.type} Apv inversion: R↑ ${domain.R_lbe}→ area ${apv}→${apvUp}`);
    stats.anchorAssertions+=2;
  }
  stats.accepted++;
}

function runPropertyTests() {
  const stats={seed:SEED,geometries:0,accepted:0,anchorAssertions:0,maxDeviation:0,byDomain:{}};
  for(const type of ['tow','embed','sd']) {
    const before={accepted:stats.accepted};
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
    stats.byDomain[type]={geometries:500,accepted:stats.accepted-before.accepted};
  }
  assert.strictEqual(stats.accepted,stats.geometries);
  return stats;
}
module.exports={runPropertyTests,mulberry32};
if(require.main===module) console.log(runPropertyTests());
