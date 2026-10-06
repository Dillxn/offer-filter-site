/* Offer Filter: one deterministic, narration-timed vector film.
 * The website plays it live in a canvas (player.js); tools/render-film.cjs renders the same frames to MP4.
 * Each aspect ratio is composed independently. Cuts and accents sit on the soundtrack's beat grid.
 */
(function(root) {
'use strict';
const A=root.OfferArt, TAU=Math.PI*2;
const C={ink:'#162844',cream:'#FFF7DF',blue:'#4385EB',sky:'#AFD0FF',pink:'#F29791',mint:'#B9E4BE',gold:'#F5C66F',purple:'#C3ABF7'};
const FOG='#3C5A8F';
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const ease=t=>1-Math.pow(1-clamp(t),3);
const smooth=t=>{t=clamp(t);return t*t*(3-2*t);};
const pop=t=>{t=clamp(t);return 1+3.4*Math.pow(t-1,3)+2.4*Math.pow(t-1,2);};
const DURATION=21, FPS=30, POSTER=20.6, XF=.22;
// "Your Time Matters" runs at 105.15 BPM: beat n of the take, in seconds.
const BEAT=.5706, beat=n=>.085+n*BEAT;
const SHOTS=[
 {from:0,to:beat(6),name:'time',city:1},
 {from:beat(6),to:beat(9),name:'minimums',city:0},
 {from:beat(9),to:beat(16),name:'decline',city:1},
 {from:beat(16),to:beat(19),name:'choose',city:1},
 {from:beat(19),to:beat(24),name:'perspective',city:0},
 {from:beat(24),to:beat(27),name:'direction',city:1},
 {from:beat(27),to:DURATION,name:'close',city:0},
];
// Timed from the narration's word boundaries; shared by the live player and the WebVTT file.
const CAPTIONS=[
 [0,1.05,'[Gentle electronic music]'],
 [1.08,3,'Your time matters.'],
 [3.6,5.4,'Set your minimums.'],
 [5.45,8.4,'Offer Filter declines the offers below them.'],
 [9.3,10.9,'You choose the good ones.'],
 [11.15,13.15,'See every offer in perspective.'],
 [14,15.5,'Find your next move.'],
 [15.85,18.4,'Free and open source.'],
 [18.4,20.4,'[Music resolves]'],
];
let bounds=[], scene='', timestamp=0, audit=true;
function box(c,x,y,w,h,r,fill,stroke){A.roundRect(c,x,y,w,h,r);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.stroke();}}
function dot(c,x,y,r,col){c.beginPath();c.arc(x,y,Math.max(.001,r),0,TAU);c.fillStyle=col;c.fill();}
function stroke(c,pts,col,w=2){c.beginPath();pts.forEach((p,i)=>i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]));c.strokeStyle=col;c.lineWidth=w;c.stroke();}
// Canvas shadows ignore the transform; scale them so every render size matches the 1080p composition.
function shade(c,blur,dy,col){const m=c.getTransform(),k=Math.hypot(m.a,m.b);c.shadowColor=col;c.shadowBlur=blur*k;c.shadowOffsetY=dy*k;}
// Measure the actual font, including ink overhang and descenders. Never use a
// fixed-height clipping rectangle or Canvas's horizontally squashed maxWidth.
function text(c,str,x,y,size,col=C.cream,opt={}) {
 const {align='left',family='Baloo 2',weight=700,maxWidth=Infinity,track=true}=opt;
 c.textAlign=align;c.textBaseline='alphabetic';c.fillStyle=col;
 c.font=`${weight} ${size}px "${family}"`;
 let m=c.measureText(str);
 if(m.width>maxWidth){size*=maxWidth/m.width;c.font=`${weight} ${size}px "${family}"`;m=c.measureText(str);}
 c.fillText(str,x,y);
 if(audit&&track&&c.globalAlpha>.1){
  const tr=c.getTransform(),left=x-m.actualBoundingBoxLeft,right=x+m.actualBoundingBoxRight;
  const top=y-m.actualBoundingBoxAscent,bottom=y+m.actualBoundingBoxDescent;
  const corners=[[left,top],[right,top],[right,bottom],[left,bottom]].map(([a,b])=>[tr.a*a+tr.c*b+tr.e,tr.b*a+tr.d*b+tr.f]);
  bounds.push({scene,timestamp,text:str,size,alpha:c.globalAlpha,left:Math.min(...corners.map(p=>p[0])),right:Math.max(...corners.map(p=>p[0])),top:Math.min(...corners.map(p=>p[1])),bottom:Math.max(...corners.map(p=>p[1]))});
 }
 return m;
}
function body(c,str,x,y,size,col=C.sky,opt={}){return text(c,str,x,y,size,col,{family:'Atkinson Hyperlegible',weight:400,...opt});}
// Fade and lift something into place, starting at local time lt=0.
function rise(c,lt,draw,dist=18){const p=ease(lt/.42);if(p<=0)return;c.save();c.globalAlpha*=p;c.translate(0,(1-p)*dist);draw();c.restore();}
function layout(w,h){
 const wide=w/h>1.25,square=w===h;
 return {w,h,wide,square,tx:wide?120:square?76:86,ty:wide?338:square?148:248,
  head:wide?120:square?101:134,headW:wide?810:w-(square?152:172),
  cx:wide?1360:w/2,cy:wide?552:square?615:1060,r:wide?298:square?235:330,
  k:wide?1:square?.82:1.08};
}
const dawn=T=>smooth((T-beat(24))/.8);
function heading(c,lines,l,t,times,day=0){
 const base=A.mix(C.cream,C.ink,day),accent=A.mix(C.sky,'#2772C4',day);
 lines.forEach((s,i)=>rise(c,t-times[i],()=>text(c,s,l.tx,l.ty+i*l.head*.98,l.head,i===1?accent:base,{maxWidth:l.headW}),22));
}
function supporting(c,str,l,lt,day=0){rise(c,lt,()=>body(c,str,l.tx,l.ty+l.head*2.25,l.square?30:36,A.mix(C.sky,'#426275',day),{maxWidth:l.headW}),10);}

/* The shared backdrop: sky, stars and hills keep moving through every cut; only the city fades in and out. */
function backdrop(c,l,T,city){
 const {w,h}=l,day=dawn(T);
 const g=c.createLinearGradient(0,0,w*.3,h);g.addColorStop(0,A.mix('#0C1732','#CFE7ED',day));g.addColorStop(.57,A.mix('#263753','#F0DFBB',day));g.addColorStop(1,A.mix('#354260','#F8B27E',day));c.fillStyle=g;c.fillRect(0,0,w,h);
 if(day<1){
  const halo=c.createRadialGradient(w*.75,h*.4,0,w*.75,h*.4,w*.65);halo.addColorStop(0,`rgba(121,166,235,${.19*(1-day)})`);halo.addColorStop(1,'rgba(121,166,235,0)');c.fillStyle=halo;c.fillRect(0,0,w,h);
  for(let i=0;i<75;i++){const x=((i*367)%997)/997*w,y=((i*151)%787)/787*h*.75;dot(c,x,y,.8+(i%3)*.6,`rgba(255,245,218,${(1-day)*(.15+.14*Math.sin(i+T))})`);}
 }
 if(city>.01){c.save();c.globalAlpha*=city;skyline(c,l,day);c.restore();}
 const colors=[['#2C4260','#B9C8BA'],['#253B56','#7FA99E'],['#1B3049','#477E85']];
 for(let j=0;j<3;j++){c.beginPath();c.moveTo(0,h);for(let x=0;x<=w+20;x+=20)c.lineTo(x,h*(.82+j*.085)+Math.sin(x/w*5.8+j*1.5+T*.025)*h*.035);c.lineTo(w,h);c.closePath();c.fillStyle=A.mix(colors[j][0],colors[j][1],day);c.fill();}
}
// Solid, hazy buildings behind the first hill: lit windows at night, quiet ones by day.
// The city never moves, so its shapes are built once per format and filled in three calls.
const CITY={};
function skyline(c,l,day){
 const {w,h}=l,key=w+'x'+h;
 if(!CITY[key]){const u=(w+h)/2160,base=h*.87,city={blocks:new Path2D(),lit:new Path2D(),dark:new Path2D()};
  for(let i=0;i<17;i++){const bw=(29+i*11%36)*u,x=i*w/16-15*u,bh=(60+i*67%135)*u;
   city.blocks.roundRect?city.blocks.roundRect(x,base-bh,bw,bh,5*u):city.blocks.rect(x,base-bh,bw,bh);
   for(let row=0;row<bh/(20*u)-1;row++)for(let col=0;col<bw/(14*u)-1;col++)((i*7+row*3+col*5)%9<4?city.lit:city.dark).rect(x+8*u+col*14*u,base-bh+10*u+row*20*u,4*u,6*u);}
  CITY[key]=city;}
 const city=CITY[key];
 c.fillStyle=A.mix('#33496C','#D5DBD2',day);c.fill(city.blocks);
 c.fillStyle=A.mix('#E9C98A','#E9ECE3',day);c.fill(city.lit);
 c.fillStyle=A.mix('#2A3D5C','#CAD2C9',day);c.fill(city.dark);
}
function drive(c,l,t,T,x){
 const {w,h}=l,day=dawn(T),y=h*.915,s=l.wide?2.3:l.square?1.75:2.15;
 c.fillStyle=A.mix('#15293F','#396B78',day);c.fillRect(0,y,w,h-y);
 c.setLineDash([40,60]);c.lineDashOffset=-t*115;stroke(c,[[0,y+h*.042],[w,y+h*.042]],A.mix('#677D94','#DDCCA1',day),3);c.setLineDash([]);
 const cy=y+(l.wide?62:l.square?56:72);
 if(day<1){const hx=x+46*s,hy=cy-24*s,len=210*s,g=c.createLinearGradient(hx,0,hx+len,0);g.addColorStop(0,`rgba(255,227,160,${.2*(1-day)})`);g.addColorStop(1,'rgba(255,227,160,0)');
  c.fillStyle=g;c.beginPath();c.moveTo(hx,hy-5*s);c.lineTo(hx+len,hy-30*s);c.lineTo(hx+len,hy+38*s);c.lineTo(hx,hy+6*s);c.closePath();c.fill();}
 A.car(c,x,cy,s,-Math.abs(Math.sin(t*9))*1.5);
}
function ticket(c,x,y,s,rot,o){
 const fog=o.fog||0,f=col=>fog?A.mix(col,FOG,fog):col;
 c.save();c.globalAlpha*=o.alpha==null?1:o.alpha;c.translate(x,y);c.rotate(rot);c.scale(s,s);
 if(fog<.3)shade(c,20,12,`rgba(5,18,40,${.22*(1-fog)})`);box(c,-157,-89,314,178,19,f(C.cream));c.shadowColor='transparent';
 const col=o.kind==='decline'?C.pink:o.kind==='pass'?C.mint:C.sky;box(c,-157,-89,58,178,19,f(col));c.fillStyle=f(C.cream);c.fillRect(-113,-89,22,178);
 c.setLineDash([4,6]);stroke(c,[[-100,-74],[-100,74]],f('#B4BCB3'),1.4);c.setLineDash([]);
 c.save();c.translate(-128,0);c.rotate(-Math.PI/2);body(c,'OFFER',0,7,17,f(C.ink),{align:'center',track:false});c.restore();
 text(c,o.pay,-79,6,58,f(C.ink),{maxWidth:216,track:!!o.track});body(c,o.info,-78,45,22,f('#49616C'),{maxWidth:214,track:!!o.track});
 dot(c,-100,-89,6,f('#2C415D'));dot(c,-100,89,6,f('#2C415D'));
 // A stamp travels with its ticket, so it never covers the route text.
 if(o.stamp>0){const k=pop(o.stamp);c.save();c.translate(157,-89);c.rotate(-rot*.5);icon(c,0,0,30*k,o.kind==='pass'?'check':'cross',o.kind==='pass'?C.mint:C.pink);c.restore();}
 c.restore();
}
function mascot(c,x,y,s,t,ring=1,o={}){
 c.save();c.translate(x,y+Math.sin(t*1.4)*5);if(o.tilt)c.rotate(o.tilt);A.enso(c,0,0,97*s,ring,C.blue,8*s);
 A.mascot(c,0,-8,s,{mood:o.mood||(Math.floor(t*2)%13===11?'blink':'happy'),wave:12+Math.sin(t*2)*7,breathe:Math.sin(t*2)});c.restore();
}
function icon(c,x,y,r,kind,col){
 shade(c,10,4,'rgba(5,18,40,.18)');dot(c,x,y,r,col);c.shadowColor='transparent';
 const p=kind==='check'?[[-.44,.01],[-.1,.35],[.45,-.33]]:[[-.3,-.3],[.3,.3]];
 stroke(c,p.map(([a,b])=>[x+a*r,y+b*r]),C.ink,r*.13);
 if(kind!=='check')stroke(c,[[x+r*.3,y-r*.3],[x-r*.3,y+r*.3]],C.ink,r*.13);
}

/* 1 · Your time matters: a steady rain of offers, far ones lost in the night haze. */
const RAIN=(()=>{const r=A.rnd(23),o=[['$3.50','9.2 mi'],['$4.25','12.4 mi'],['$2.75','7.8 mi'],['$18.40','4.1 mi'],['$5.10','10.6 mi'],['$3.90','8.3 mi']],out=[];
 for(let z=0;z<3;z++)for(let j=0;j<5;j++){const n=out.length;out.push({z,x:(j+.5+(r()-.5)*.45+z*.33)/5%1,y:(j*.618+z*.29)%1,spin:r()*2-1,phase:r()*TAU,pay:o[n%6][0],info:o[(n+2)%6][1]});}
 return out;})();
function time(c,l,t,T){
 const {w,h,wide}=l,x0=wide?980:90,x1=wide?w-110:w-90,top=wide?-360:l.ty+l.head*1.2,bottom=h*.86,k=wide?1:l.square?.85:1.2;
 for(const p of RAIN){
  const s=[.42,.6,.82][p.z]*k,speed=[70,110,165][p.z]*h/1080,span=bottom-top+220*s;
  const y=top-110*s+(p.y*span+speed*t)%span,x=lerp(x0,x1,p.x)+Math.sin(t*.8+p.phase)*18;
  const seen=clamp((y-95*s-top)/(70*s))*clamp((bottom-y)/(90*s));
  if(seen>0)ticket(c,x,y,s,p.spin*.22+Math.sin(t*.9+p.phase)*.07,{pay:p.pay,info:p.info,fog:1-(1-[.42,.18,0][p.z])*seen,alpha:clamp(seen*4)});
 }
 drive(c,l,t,T,lerp(w*.5,w*.58,smooth(t/3.6)));
 heading(c,['Your time','matters.'],l,t,[1.1,1.92]);
}
/* 2 · Set your minimums: the four-spoke constellation opens, then the per-mile knob moves with the word. */
function minimums(c,l,t){
 heading(c,['Set your','minimums.'],l,t,[0,beat(7)-beat(6)]);
 const r=l.r*.9,cx=l.cx,cy=l.cy,angs=[-2.35,-.79,.79,2.35],grow=ease(t/.5),knob=smooth((t-.62)/.75);
 const vals=[.63,lerp(.43,.82,knob),.68,.53].map(v=>v*grow);
 for(let k=1;k<=4;k++){c.save();c.globalAlpha*=ease((t-k*.05)/.3);c.beginPath();c.arc(cx,cy,r*k/4,0,TAU);c.strokeStyle=k===4?'#769DCF':'#3E587B';c.lineWidth=k===4?2.6:1.6;c.stroke();c.restore();}
 const points=vals.map((v,i)=>[cx+Math.cos(angs[i])*r*v,cy+Math.sin(angs[i])*r*v]),size=l.square?27:32;
 angs.forEach((a,i)=>{stroke(c,[[cx,cy],[cx+Math.cos(a)*r,cy+Math.sin(a)*r]],'#557399',2);
  rise(c,t-.15-i*.05,()=>body(c,['$','/mi','/min','/stop'][i],cx+Math.cos(a)*r*1.21,cy+Math.sin(a)*r*1.21+10,size,C.cream,{align:'center'}),6);});
 c.beginPath();points.forEach((p,i)=>i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]));c.closePath();c.fillStyle='rgba(91,154,249,.3)';c.fill();c.strokeStyle=C.sky;c.lineWidth=5;c.stroke();points.forEach(p=>dot(c,p[0],p[1],10,C.sky));
 const p=points[1];dot(c,p[0],p[1],(24+Math.sin(t*3)*4)*grow,'rgba(161,205,255,.23)');
 rise(c,t-.3,()=>text(c,`$${lerp(2,3,knob).toFixed(2)}/mi`,cx,cy+r+76,l.square?36:42,C.sky,{align:'center'}),8);
 supporting(c,'You set the pace.',l,t-.75);
}
/* 3 · Low offers? Declined: three offers arrive, take a stamp on the beat and are flicked away. */
function decline(c,l,t){
 const hits=[11,13,15].map(n=>beat(n)-beat(9));
 heading(c,['Low offers?','Declined.'],l,t,[0,hits[0]]);
 const shake=hits.reduce((a,h)=>{const d=t-h;return d>0&&d<.4?a+Math.sin(d*42)*.045*(1-d/.4):a;},0);
 mascot(c,l.cx,l.cy,l.r/97,t+3,ease(t/.6),{tilt:shake});
 const offers=[['$3.50','9.2 mi · 34 min'],['$4.25','12.4 mi · 38 min'],['$2.75','7.8 mi · 31 min']],s=l.square?.75:.94,hy=l.cy-l.r*.98;
 hits.forEach((hit,i)=>{
  const p=ease((t-hit+.8)/.7),q=clamp((t-hit)/.75);if(p<=0||q>=1)return;
  const x=lerp(l.cx+l.r*1.6,l.cx,p)+q*l.r*.85*(1+q),y=lerp(hy-l.r*1.25,hy,p)-Math.sin(q*Math.PI)*l.r*.3+q*q*l.r*.6;
  ticket(c,x,y,s,lerp(.35,-.04,p)+q*(1.1+i*.2),{pay:offers[i][0],info:offers[i][1],kind:'decline',alpha:1-q*q,stamp:(t-hit)/.3,track:p>.95&&q<=0});
 });
 supporting(c,'Below your rules.',l,t-hits[0]-.45);
}
/* 4 · The good ones? Your call: a fair offer passes through the filter and waits for the driver. */
function choose(c,l,t){
 const call=beat(18)-beat(16);
 heading(c,['The good ones?','Your call.'],l,t,[0,call]);
 const s=l.r/97*(l.square?.83:.91),my=l.cy-(l.square?20:45);
 mascot(c,l.cx,my,s,t+6,1,{mood:t>call&&t<call+.8?'cheer':undefined});
 const p=ease((t-.12)/.7),ty=l.cy+(l.square?218:350),ts=l.square?1.12:1.36;
 ticket(c,l.cx,lerp(my+60*s,ty,p),ts*lerp(.45,1,p),0,{pay:'$18.40',info:'4.1 mi · 22 min',kind:'pass',alpha:clamp(p*2),stamp:(t-call)/.3,track:p>.95});
 supporting(c,'Ready for your decision.',l,t-.55);
}
/* 5 · Every offer, in perspective: the history rises like a little skyline of its own. */
function perspective(c,l,t){
 const turn=beat(21)-beat(19);
 heading(c,['Every offer.','In perspective.'],l,t,[0,turn]);
 const width=l.wide?660:l.square?830:870,x0=l.cx-width/2,base=l.wide?842:l.square?883:1540,scale=l.wide?1:l.square?.83:1.27;
 const heights=[86,122,294,138,198,243,105,165,314,144];
 heights.forEach((hh,i)=>{const p=pop((t-.15-i*.07)/.55),bw=width/10-12,x=x0+i*width/10,pass=[2,5,8].includes(i),bh=hh*scale*p,col=pass?C.mint:C.pink;
  if(p<=0)return;box(c,x,base-bh,bw,bh,6,col);for(let row=0;row<Math.floor((bh-20)/28);row++)for(let k=0;k<2;k++){c.fillStyle='rgba(23,44,59,.24)';c.fillRect(x+12+k*(bw-31),base-bh+14+row*28,7,10);}
  const b=(t-.55-i*.07)/.3;if(b>0)icon(c,x+bw/2,base-bh-29,17*pop(b),pass?'check':'cross',col);
 });
 stroke(c,[[x0-10,base+2],[x0+width,base+2]],'#6D94BA',2);
 const ky=base-314*scale-95,ks=l.square?31:37;
 rise(c,t-turn,()=>{body(c,'ILLUSTRATIVE OFFERS',x0,ky-56,l.square?20:22,C.sky);
  dot(c,x0+9,ky-11,9,C.mint);body(c,'3 passed',x0+30,ky,ks,C.mint);
  dot(c,x0+width*.45+9,ky-11,9,C.pink);body(c,'7 declined',x0+width*.45+30,ky,ks,C.pink);},10);
}
/* 6 · Find your next move: dawn breaks on the downbeat and the route draws itself on the map. */
function map(c,l,t){
 const cx=l.cx,cy=l.cy+15,r=l.r*(l.square?1.04:1.08)*lerp(.9,1,ease(t/.45));
 c.save();c.globalAlpha*=ease(t/.3);c.beginPath();c.arc(cx,cy,r,0,TAU);c.save();c.clip();dot(c,cx,cy,r,'#C8D6BD');
 for(let k=-3;k<=3;k++){stroke(c,[[cx-r,cy+k*98-r*.12],[cx+r,cy+k*98+r*.1]],'#E6E3BF',l.square?15:23);stroke(c,[[cx+k*113,cy-r],[cx+k*113+70,cy+r]],'#E6E3BF',l.square?15:23);}
 const pts=[[cx-r*.59,cy+r*.38],[cx-r*.16,cy+r*.4],[cx-r*.11,cy-r*.07],[cx+r*.38,cy-r*.11],[cx+r*.43,cy-r*.49]],end=pts[pts.length-1];
 for(const [x,y,s] of [[-.65,-.4,18],[.63,.44,22],[.2,.67,15],[-.62,.64,12]]){dot(c,cx+x*r,cy+y*r,s,'#739B80');dot(c,cx+x*r+9,cy+y*r-10,s*.8,'#8BAE87');}
 stroke(c,pts,'#FFF5DB',18);c.save();c.setLineDash([2000]);c.lineDashOffset=2000*(1-smooth((t-.35)/.8));stroke(c,pts,'#317BCA',10);c.restore();
 dot(c,pts[0][0],pts[0][1],18,C.blue);dot(c,pts[0][0],pts[0][1],7,C.cream);
 const k=pop((t-1.1)/.35);if(k>0){dot(c,end[0],end[1],29*k,C.gold);dot(c,end[0],end[1],12*k,'#B98236');}
 c.restore();c.beginPath();c.arc(cx,cy,r,0,TAU);c.strokeStyle='#FBF1D4';c.lineWidth=8;c.stroke();c.restore();
}
function direction(c,l,t,T){
 const day=dawn(T);
 heading(c,['Find your','next move.'],l,t,[0,beat(25)-beat(24)],day);
 map(c,l,t);drive(c,l,t,T,lerp(l.w*.3,l.w*.6,ease(t/1.9)));
 supporting(c,'Guided by your offer history.',l,t-.75,day);
}
/* 7 · Offer Filter: the name, then "Free" and "& open source" land with the voice; sparkles take the last hits. */
function android(c,x,y,s,col){c.save();c.translate(x,y);c.scale(s,s);c.lineCap='round';stroke(c,[[-11,-14],[-17,-24]],col,3);stroke(c,[[11,-14],[17,-24]],col,3);c.beginPath();c.arc(0,0,24,Math.PI,TAU);c.lineTo(24,5);c.lineTo(-24,5);c.closePath();c.fillStyle=col;c.fill();dot(c,-10,-6,2.6,C.cream);dot(c,10,-6,2.6,C.cream);c.restore();}
function close(c,l,t,T,emblem){
 const {w,wide,square:sq}=l,at=n=>beat(n)-beat(27);
 // Wide: a paired illustration and type column. Stacked: one shared centerline.
 const mx=wide?1390:540,my=wide?530:sq?250:520,ms=wide?3.45:sq?1.72:3.2,grow=pop(t/.6);
 c.save();c.globalAlpha*=clamp(t/.2);mascot(c,mx,my,ms*(.9+.1*grow),t+8,ease(t/.8),{mood:t>at(28)&&t<at(28)+.8?'cheer':undefined});c.restore();
 for(let i=0;i<4;i++){const k=pop((t-at(32+i))/.35);if(k<=0)continue;const a=i*TAU/4+.3;A.sparkle(c,mx+Math.cos(a)*ms*115,my+Math.sin(a)*ms*107,(wide?16:12)*k*(1+.12*Math.sin(t*2+i)),i%2?C.gold:'#7AADE3');}
 const tx=wide?165:w/2,align=wide?'left':'center';
 rise(c,t-.05,()=>text(c,'Offer Filter',tx,wide?395:sq?529:990,wide?146:sq?109:145,C.ink,{align,maxWidth:wide?850:910}),24);
 const fy=wide?510:sq?590:1100,size=wide?38:sq?34:43,green='#315B54';
 c.font=`400 ${size}px "Atkinson Hyperlegible"`;const lead=c.measureText('Free ').width,fx=wide?tx+48:(w-c.measureText('Free & open source').width)/2+25;
 rise(c,t-at(28),()=>{android(c,fx-38,fy-5,.75,green);body(c,'Free',fx,fy,size,green);},12);
 rise(c,t-at(30),()=>body(c,'& open source',fx+lead,fy,size,green),12);
 rise(c,t-at(31),()=>text(c,'offerfilter.org',tx,wide?594:sq?657:1193,wide?52:sq?48:56,'#276BAE',{align}),12);
 // A quiet signature on the same alignment, without a filled badge. The
 // emblem arrives pre-tinted: only its ink is colored, its alpha silhouette is unchanged.
 const mw=wide?224:sq?198:270,mh=mw*emblem.height/emblem.width,ex=wide?tx:(w-mw)/2,ey=wide?698:sq?704:1324;
 c.save();c.globalAlpha*=ease((t-at(32))/.6);c.drawImage(emblem,ex,ey,mw,mh);c.restore();
 rise(c,t-at(33),()=>body(c,'Independent app. Not affiliated with DoorDash.',wide?165:w/2,wide?992:sq?1008:1818,wide?26:sq?22:27,'#183D4E',{align,maxWidth:wide?920:sq?690:928}),8);
}
const DRAW=[time,minimums,decline,choose,perspective,direction,close];
// t is film time in seconds. Draws into (0,0)-(w,h) of the current transform, so callers may scale it.
function frame(c,t,w,h,emblem,opt){
 bounds=[];timestamp=t;audit=!opt||opt.audit!==false;t=clamp(t,0,DURATION-1/FPS);
 const l=layout(w,h);let i=SHOTS.findIndex(s=>t<s.to);if(i<0)i=SHOTS.length-1;
 // The backdrop never cuts; outgoing and incoming foregrounds overlap briefly instead of a hard cut.
 const shot=SHOTS[i],prev=SHOTS[i-1],x=prev?smooth((t-shot.from)/XF):1;
 c.save();c.lineJoin='round';c.lineCap='round';
 backdrop(c,l,t,prev?lerp(prev.city,shot.city,x):shot.city);
 if(x<1){scene=prev.name;c.save();c.globalAlpha=1-x;DRAW[i-1](c,l,t-prev.from,t,emblem);c.restore();}
 scene=shot.name;c.save();c.globalAlpha=x;DRAW[i](c,l,t-shot.from,t,emblem);c.restore();
 c.restore();
 return bounds;
}
root.OfferFilm={DURATION,FPS,POSTER,BEAT,SHOTS,CAPTIONS,frame};
})(typeof window!=='undefined'?window:globalThis);
