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
  exactTributaryApt, exactTributaryApv, exactTributaryAptDetail,
  exactTributaryApvDetail, epsilonRule, buildTowDomain, buildEmbedDomain, buildSdDomain };
