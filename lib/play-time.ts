// Union of execution intervals; supplementary to the required sum of record minutes.
export function playMinutes(records: {start_at:string;end_at:string}[]) {
 const intervals=records.map(r=>[Date.parse(r.start_at),Date.parse(r.end_at)]).filter(([a,b])=>Number.isFinite(a)&&Number.isFinite(b)&&b>a).sort((a,b)=>a[0]-b[0]);
 let total=0,start=0,end=0;
 for(const [a,b] of intervals){if(a>end){total+=end-start;start=a;end=b}else end=Math.max(end,b)}
 return Math.round((total+end-start)/60000);
}
