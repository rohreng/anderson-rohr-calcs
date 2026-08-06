'use strict';

const PI = Math.PI;

function circSeg(R, d) {
  if (!(R > 0) || d >= R) return 0;
  if (d <= -R) return PI * R * R;
  return R * R * Math.acos(d / R) - d * Math.sqrt(Math.max(0, R * R - d * d));
}

function distance(p, q) { return Math.hypot(p.x - q.x, p.y - q.y); }

function perAnchorPairwiseApt({ R, index, anchors }) {
  const a = anchors[index];
  let area = PI * R * R;
  for (const d of a.boundaries || []) if (d < R) area -= circSeg(R, d);
  for (let j = 0; j < anchors.length; j++) {
    if (j === index) continue;
    const c = distance(a, anchors[j]);
    if (c < 2 * R) area -= circSeg(R, c / 2);
  }
  return area;
}

function perAnchorPairwiseApv({ R_lbe, index, anchors, sideNeighborDistances }) {
  let area = PI * R_lbe * R_lbe / 2;
  const ds = sideNeighborDistances || anchors
    .map((a, j) => j === index ? Infinity : distance(anchors[index], a));
  for (const s of ds) if (s < 2 * R_lbe) area -= 0.5 * circSeg(R_lbe, s / 2);
  return area;
}

function epsilonRule(R, area) {
  return Math.max(0.01, Math.min(0.005 * PI * R * R, 0.02 * Math.max(0, area)));
}

// Adaptive square integration. All tests except the circle are linear half-planes,
// so a cell is certified in/out by evaluating its four corners. Uncertain cell area
// is the rigorous integration error bound when its midpoint estimate is used.
function integrateRegion({ center, R, halfPlanes, halfCone }) {
  const x0 = center.x - R, y0 = center.y - R, size = 2 * R;
  let cells = [{ x: x0, y: y0, s: size }];
  let inside = 0, uncertain = size * size;
  const maxDepth = 20;

  function classify(cell) {
    const { x, y, s } = cell;
    const corners = [[x,y], [x+s,y], [x,y+s], [x+s,y+s]];
    let allIn = true;
    for (const [px, py] of corners) {
      const circle = (px-center.x) ** 2 + (py-center.y) ** 2 <= R * R;
      const planes = halfPlanes.every(h => h.a * px + h.b * py <= h.c + 1e-12);
      const cone = !halfCone || halfCone.a * px + halfCone.b * py <= halfCone.c + 1e-12;
      allIn = allIn && circle && planes && cone;
    }
    if (allIn) return 1;
    // Certified outside if the box misses the circle or lies wholly beyond a plane.
    const nx = Math.max(x, Math.min(center.x, x+s));
    const ny = Math.max(y, Math.min(center.y, y+s));
    if ((nx-center.x) ** 2 + (ny-center.y) ** 2 >= R * R) return -1;
    for (const h of halfPlanes.concat(halfCone ? [halfCone] : [])) {
      if (corners.every(([px,py]) => h.a*px+h.b*py > h.c)) return -1;
    }
    return 0;
  }

  for (let depth = 0; depth <= maxDepth; depth++) {
    let next = [], nextUncertain = 0;
    for (const cell of cells) {
      const k = classify(cell), a = cell.s * cell.s;
      if (k === 1) inside += a;
      else if (k === 0) {
        if (depth === maxDepth) { inside += a / 2; nextUncertain += a; }
        else {
          const h = cell.s / 2;
          next.push({x:cell.x,y:cell.y,s:h},{x:cell.x+h,y:cell.y,s:h},
            {x:cell.x,y:cell.y+h,s:h},{x:cell.x+h,y:cell.y+h,s:h});
          nextUncertain += a;
        }
      }
    }
    cells = next; uncertain = nextUncertain;
    const estimate = inside + uncertain / 2;
    if (uncertain / 2 <= epsilonRule(R, estimate)) {
      return { area: estimate, epsilon: uncertain / 2, depth };
    }
  }
  return { area: inside, epsilon: uncertain / 2, depth: maxDepth };
}

// ── Closed-form tributary areas (design path) ────────────────────────────────
// Exact area of disc ∩ (∩ half-planes {a·x + b·y ≤ c}), with no numerical
// integration and no tolerance. The half-plane intersection is built by
// Sutherland–Hodgman clipping of a bounding box; the resulting convex polygon
// is intersected with the disc edge-by-edge: each edge is split at its circle
// crossings — sub-edges inside the disc contribute a triangle (with the
// center), sub-edges outside contribute a circular sector.
// These three functions are ported VERBATIM into the calc HTML files (ES5
// syntax on purpose); keep both copies identical.
function clipPolyHalfPlane(poly, hp){
  var out=[], n=poly.length;
  for(var i=0;i<n;i++){
    var P=poly[i], Q=poly[(i+1)%n];
    var dp=hp.a*P.x+hp.b*P.y-hp.c, dq=hp.a*Q.x+hp.b*Q.y-hp.c;
    if(dp<=0){
      out.push(P);
      if(dq>0){ var t=dp/(dp-dq); out.push({x:P.x+t*(Q.x-P.x), y:P.y+t*(Q.y-P.y)}); }
    } else if(dq<=0){
      var t2=dp/(dp-dq); out.push({x:P.x+t2*(Q.x-P.x), y:P.y+t2*(Q.y-P.y)});
    }
  }
  return out;
}
function circlePolyArea(cx, cy, R, poly){
  var total=0, n=poly.length;
  if(n<3||!(R>0)) return 0;
  for(var i=0;i<n;i++){
    var p1={x:poly[i].x-cx, y:poly[i].y-cy};
    var p2={x:poly[(i+1)%n].x-cx, y:poly[(i+1)%n].y-cy};
    var dx=p2.x-p1.x, dy=p2.y-p1.y;
    var A=dx*dx+dy*dy;
    if(A<=0) continue;
    // Split the edge at its circle crossings (quadratic in the edge parameter).
    var B=2*(p1.x*dx+p1.y*dy), C=p1.x*p1.x+p1.y*p1.y-R*R;
    var ts=[0,1], disc=B*B-4*A*C;
    if(disc>0){
      var sq=Math.sqrt(disc), tA=(-B-sq)/(2*A), tB=(-B+sq)/(2*A);
      if(tA>0&&tA<1) ts.push(tA);
      if(tB>0&&tB<1) ts.push(tB);
      ts.sort(function(u,v){return u-v;});
    }
    for(var k=0;k+1<ts.length;k++){
      var ax=p1.x+dx*ts[k],   ay=p1.y+dy*ts[k];
      var bx=p1.x+dx*ts[k+1], by=p1.y+dy*ts[k+1];
      var mx=(ax+bx)/2, my=(ay+by)/2;
      // Strict test: a sub-edge whose midpoint sits ON the circle is a tangent
      // touch from outside (a true chord's midpoint is strictly interior), so
      // boundary ties must fall to the sector branch. The relative epsilon is
      // continuous — near-tangent chords give the same area either way.
      if(mx*mx+my*my<R*R*(1-1e-12)){
        total+=(ax*by-ay*bx)/2;                 // chord sub-edge: triangle with center
      } else {
        var da=Math.atan2(by,bx)-Math.atan2(ay,ax);
        if(da>Math.PI) da-=2*Math.PI;
        if(da<-Math.PI) da+=2*Math.PI;
        total+=R*R*da/2;                        // outside sub-edge: circular sector
      }
    }
  }
  return Math.abs(total);
}
function circleHalfPlanesArea(cx, cy, R, halfPlanes){
  var m=R*1.125+1;                              // bounding box comfortably containing the disc
  var poly=[{x:cx-m,y:cy-m},{x:cx+m,y:cy-m},{x:cx+m,y:cy+m},{x:cx-m,y:cy+m}];
  for(var i=0;i<halfPlanes.length;i++){
    poly=clipPolyHalfPlane(poly, halfPlanes[i]);
    if(poly.length<3) return 0;
  }
  return circlePolyArea(cx, cy, R, poly);
}

function tributaryApt({ R, index, anchors, edges = [] }) {
  const p = anchors[index];
  return circleHalfPlanesArea(p.x, p.y, R, edges.concat(voronoiPlanes(index, anchors)));
}
function tributaryApv({ R_lbe, index, anchors, edges = [], direction = {x:0,y:-1} }) {
  const p = anchors[index];
  const halfCone = { a: -direction.x, b: -direction.y,
    c: -direction.x * p.x - direction.y * p.y };
  return circleHalfPlanesArea(p.x, p.y, R_lbe,
    edges.concat(voronoiPlanes(index, anchors)).concat([halfCone]));
}

function voronoiPlanes(index, anchors) {
  const p = anchors[index];
  return anchors.flatMap((q, j) => j === index ? [] : [{
    a: 2 * (q.x - p.x), b: 2 * (q.y - p.y),
    c: q.x*q.x + q.y*q.y - p.x*p.x - p.y*p.y
  }]);
}

function exactTributaryAptDetail({ R, index, anchors, edges = [] }) {
  return integrateRegion({ center: anchors[index], R,
    halfPlanes: edges.concat(voronoiPlanes(index, anchors)) });
}
function exactTributaryApt(args) { return exactTributaryAptDetail(args).area; }

function exactTributaryApvDetail({ R_lbe, R, index, anchors, edges = [], direction = {x:0,y:-1} }) {
  const radius = R_lbe || R;
  const p = anchors[index];
  // The half-cone is the half disk in the named shear direction through its center.
  const halfCone = { a: -direction.x, b: -direction.y,
    c: -direction.x * p.x - direction.y * p.y };
  return integrateRegion({ center:p, R:radius,
    halfPlanes: edges.concat(voronoiPlanes(index, anchors)), halfCone });
}
function exactTributaryApv(args) { return exactTributaryApvDetail(args).area; }

function withBoundaryDistances(anchors, edges) {
  return anchors.map(p => ({ ...p, boundaries: edges.map(e =>
    (e.c - e.a*p.x - e.b*p.y) / Math.hypot(e.a, e.b)) }));
}

function buildTowDomain({ b, o1, g = 0, rows = 1, cols = 1, s = 0, lb }) {
  const edges = [{a:0,b:1,c:0},{a:0,b:-1,c:b}];
  const ys = rows === 1 ? [-o1] : [-o1, -o1-g];
  const anchors = [];
  for (const y of ys) for (let col=0; col<cols; col++) anchors.push({x:col*s,y});
  return { type:'tow', R:lb, edges, anchors:withBoundaryDistances(anchors, edges) };
}

function buildEmbedDomain({ edgeDistance, rows=1, cols=1, d=0, Sx=0, Lb }) {
  const edges = [{a:0,b:-1,c:edgeDistance}]; // free edge below y=-edgeDistance
  const anchors=[];
  for(let row=0;row<rows;row++) for(let col=0;col<cols;col++) anchors.push({x:col*Sx,y:row*d});
  return { type:'embed', R:Lb, edges, anchors:withBoundaryDistances(anchors, edges) };
}

function buildSdDomain({ bolts=1, s=0, lbe, lb, aptEdges=[] }) {
  const anchors=Array.from({length:bolts},(_,i)=>({x:i*s,y:0}));
  return { type:'sd', R:lb, R_lbe:lbe, edges:aptEdges,
    anchors:withBoundaryDistances(anchors, aptEdges), apvEdges:[], direction:{x:0,y:-1} };
}

module.exports = { circSeg, perAnchorPairwiseApt, perAnchorPairwiseApv,
  clipPolyHalfPlane, circlePolyArea, circleHalfPlanesArea, tributaryApt, tributaryApv,
  exactTributaryApt, exactTributaryApv, exactTributaryAptDetail,
  exactTributaryApvDetail, epsilonRule, buildTowDomain, buildEmbedDomain, buildSdDomain };
