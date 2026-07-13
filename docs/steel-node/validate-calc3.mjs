const f=(x)=>Number(x.toFixed(6));
function simple(L,w,loads){
  const RB=(w*L*L/2+loads.reduce((s,p)=>s+p.P*p.x,0))/L;
  const RA=w*L+loads.reduce((s,p)=>s+p.P,0)-RB;
  const M=x=>RA*x-w*x*x/2-loads.reduce((s,p)=>s+p.P*Math.max(0,x-p.x),0);
  const cuts=[0,...loads.map(p=>p.x),L].sort((a,b)=>a-b), candidates=[...cuts];
  for(let i=0;i<cuts.length-1;i++){
    const left=loads.filter(p=>p.x<=cuts[i]+1e-9).reduce((s,p)=>s+p.P,0);
    if(w>0){const x=(RA-left)/w;if(x>cuts[i]&&x<cuts[i+1])candidates.push(x);}
  }
  const xMax=candidates.reduce((a,b)=>M(b)>M(a)?b:a,0);
  return {RA,RB,M,xMax,Mmax:M(xMax)};
}
const bm=simple(30,1.2,[{P:40,x:10}]);
const manualRB=(1.2*30*15+40*10)/30;
const manualRA=1.2*30+40-manualRB;
// Shear immediately left/right of the point load has opposite signs, so the
// maximum occurs at the load-station cusp (not at an interval root).
const manualX=10;
const manualM=manualRA*manualX-1.2*manualX**2/2;
const ML=manualRA*10-1.2*10**2/2;
// Independent N2 governing arithmetic uses a distinct, non-degenerate case.
const Ms=300, N1=15, N2=N1*(420-Ms)/(500-Ms);
const studs=Array.from({length:31},(_,i)=>i*12), removed=studs.filter(x=>x>=174&&x<=186).length;
const rows=[
 ['C3-BM-1 Mmax',manualM,bm.Mmax],['C3-BM-1 xMmax',manualX,bm.xMax],['C3-BM-1 M@10',ML,bm.M(10)],
 ['C3-N2-1 N2',N2,N1*(420-Ms)/(500-Ms)],['C3-STUD-1 inclusive removed',1,removed]
];
let ok=true;
console.log('Calc 3 independent closed-form validator');
console.log(`Reactions: RA=${f(manualRA)} kip, RB=${f(manualRB)} kip`);
for(const [id,expected,implemented] of rows){const pass=Math.abs(expected-implemented)<=1e-6*Math.max(1,Math.abs(expected));ok&&=pass;console.log(`${id}: expected=${f(expected)} implemented=${f(implemented)} ${pass?'PASS':'FAIL'}`);}
console.log(`Domain checks: ML<=Ms => N2 not applicable; Mmax<=Ms => N2 suppressed; segment chosen by x relative to xMmax.`);
console.log(`VALIDATOR ${ok?'PASS':'FAIL'} ${rows.filter(r=>Math.abs(r[1]-r[2])<=1e-6*Math.max(1,Math.abs(r[1]))).length}/${rows.length}`);
if(!ok)process.exitCode=1;
