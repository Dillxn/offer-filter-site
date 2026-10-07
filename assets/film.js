/* Offer Filter: one deterministic, narration-timed film in two layers. The art is 3D (OfferGL with OfferModels): the
 * sky and its stars, three hills and a town, the rain of offers, the road and the car, the phone's body, the mascot
 * and its sparkles. Over it, a flat layer carries every word, the emblem and the app's own screen.
 * The website plays it live (player.js); tools/render-film.cjs renders the same frames to MP4 in Chromium.
 * Each aspect ratio is composed independently. Cuts and accents sit on the soundtrack's beat grid.
 */
(function(root) {
'use strict';
const GL=root.OfferGL, TAU=Math.PI*2;
const C={ink:'#162844',cream:'#FFF7DF',blue:'#4385EB',sky:'#AFD0FF',pink:'#F29791',mint:'#B9E4BE',gold:'#F5C66F',purple:'#C3ABF7'};
const FOG='#3C5A8F';
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const ease=t=>1-Math.pow(1-clamp(t),3);
const smooth=t=>{t=clamp(t);return t*t*(3-2*t);};
const pop=t=>{t=clamp(t);return 1+3.4*Math.pow(t-1,3)+2.4*Math.pow(t-1,2);};
// Two '#rrggbb' colors mixed: as CSS for the flat layer, as numbers for the 3D one.
const mix=(a,b,t)=>{const c=GL.mix(a,b,t);return `rgb(${Math.round(c[0]*255)},${Math.round(c[1]*255)},${Math.round(c[2]*255)})`;};
const mix3=(a,b,t)=>GL.mix(a,b,t);
const rnd=seed=>{let s=seed>>>0;return()=>((s=(s*1664525+1013904223)>>>0)/4294967296);};
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
 return {w,h,wide,square,f:h/2/Math.tan(FOV/2),tx:wide?120:square?76:86,ty:wide?338:square?148:248,
  head:wide?120:square?101:134,headW:wide?810:w-(square?152:172)};
}
const dawn=T=>smooth((T-beat(24))/.8);
function heading(c,lines,l,t,times,day=0){
 const base=mix(C.cream,C.ink,day),accent=mix(C.sky,'#2772C4',day);
 lines.forEach((s,i)=>rise(c,t-times[i],()=>text(c,s,l.tx,l.ty+i*l.head*.98,l.head,i===1?accent:base,{maxWidth:l.headW}),22));
}
function supporting(c,str,l,lt,day=0){rise(c,lt,()=>body(c,str,l.tx,l.ty+l.head*2.25,l.square?30:36,mix(C.sky,'#426275',day),{maxWidth:l.headW}),10);}

/* The sky, night to dawn: behind the 3D layer, and in the flat strips that blend the phone into it. */
const SKY=[['#0C1732','#CFE7ED'],['#263753','#F0DFBB'],['#354260','#F8B27E']],HALO=[121,166,235];
function sky(c,l,T,x,y,w,h){
 const day=dawn(T),g=c.createLinearGradient(0,0,l.w*.3,l.h);
 SKY.forEach(([n,d],i)=>g.addColorStop([0,.57,1][i],mix(n,d,day)));c.fillStyle=g;c.fillRect(x,y,w,h);
 // The night's glow fades out with the square of the distance, as the 3D sky's does.
 if(day<1){const halo=c.createRadialGradient(l.w*.75,l.h*.4,0,l.w*.75,l.h*.4,l.w*.65);
  for(let k=0;k<=4;k++)halo.addColorStop(k/4,`rgba(${HALO},${.19*(1-day)*(1-k/4)**2})`);c.fillStyle=halo;c.fillRect(x,y,w,h);}
}

/* ---- The 3D layer ----
 * A level camera with a 30° field (vertically): f, its focal length in frame px, makes a thing px pixels tall at depth D
 * px / f * D world units tall. Each piece stands where the flat composition drew it, at a depth that keeps its size;
 * the camera drifts slowly right all film long, so near hills pass far ones and the town. */
const FOV=30*Math.PI/180;
const at=(l,sx,sy,D,dx=0)=>[dx+(sx-l.w/2)/l.f*D,(l.h/2-sy)/l.f*D,-D];
const per=(l,px,D)=>px/l.f*D;
const drift=(l,T)=>T*.8*l.w/l.f;
// Turns that show a thing drawn at (sx, sy) to the camera as its design view does: square on, or from `above` (radians).
const facing=(l,sx,sy,above=0)=>{const X=(sx-l.w/2)/l.f,Y=(l.h/2-sy)/l.f;return [Math.atan2(-X,1),above+Math.asin(Y/Math.hypot(X,Y,1))];};
// The land's light, moonlit to dawn; the story's things keep a soft studio light whatever the hour.
const NIGHT={dir:[-.3,.62,.72],color:[.26,.27,.31],sky:[.8,.82,.88],ground:[.54,.56,.62],rim:[.16,.2,.28]};
const DAWN={dir:[.62,.42,.66],color:[.5,.42,.32],sky:[.74,.76,.76],ground:[.62,.58,.52],rim:[.3,.27,.22]};
const STUDIO={dir:[-.45,.5,.75],color:[.42,.41,.39],sky:[.86,.88,.92],ground:[.8,.76,.74],rim:[.45,.5,.58],gloss:[-.8,-.05,.55],fogNear:1e4,fogFar:2e4};
function landLight(day){const o={gloss:[0,0,0],fog:mix3(...SKY[1],day),fogNear:260,fogFar:2400};for(const k in NIGHT)o[k]=NIGHT[k].map((v,n)=>lerp(v,DAWN[k][n],day));return o;}
// The hills, far to near: the depth of each crest, its night and dawn colors (the flat film's).
const HILLS=[[300,'#2C4260','#B9C8BA'],[190,'#253B56','#7FA99E'],[110,'#1B3049','#477E85']];
const IDENT=GL.M.ident(),once=make=>{let v=null;return()=>v||(v=make());};
function rrect(c,x,y,w,h,r){c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath();}
// The meshes, built on a renderer's first frame of each format, each piece only once a shot needs it.
const WORLDS=new WeakMap();
function world(r,l){
 let all=WORLDS.get(r);
 if(!all)WORLDS.set(r,all=props(r));
 const key=l.w+'x'+l.h;
 return all[key]||(all[key]=land(r,l,all));
}
function props(r){
 const all={art:root.OfferModels.build(r)},quad=once(()=>r.mesh(GL.G.plane(1,1,'#ffffff')));
 // The rain's six faces, as the flat film paired its pays and distances.
 all.faces=once(()=>{const o=RAIN_OFFERS;all.art.setTickets(o.map((p,n)=>({pay:p[0],info:o[(n+2)%6][1]})));return true;});
 // A headlight's beam: a glowing wedge, bright at the lamp and gone 210 px on (the flat film's).
 all.beam=once(()=>{const cv=document.createElement('canvas');cv.width=128;cv.height=64;
  const b=cv.getContext('2d'),g=b.createLinearGradient(0,0,128,0);g.addColorStop(0,'#fff');g.addColorStop(1,'rgba(255,255,255,0)');
  b.fillStyle=g;b.beginPath();b.moveTo(0,64*25/68);b.lineTo(128,0);b.lineTo(128,64);b.lineTo(0,64*36/68);b.closePath();b.fill();
  return {tex:r.texture(cv),quad:quad()};});
 // The phone's soft shadow: its outline blurred 60 dp, once, on a quad 640 x 1280 dp.
 all.shadow=once(()=>{const cv=document.createElement('canvas');cv.width=128;cv.height=256;const s=cv.getContext('2d');
  s.shadowColor='#fff';s.shadowBlur=12;s.shadowOffsetX=256;s.fillStyle='#fff';rrect(s,(128-86.8)/2-256,(256-187.4)/2,86.8,187.4,10.8);s.fill();
  return {tex:r.texture(cv),quad:quad()};});
 return all;
}
function land(r,l,all){
 const {M,G}=GL,{w,h}=l,O=root.OfferModels,set={art:all.art};
 // Three long rounded ridges, each crest where the flat film drew it, falling gently behind and further in front.
 set.hills=once(()=>HILLS.map(([D],j)=>{
  const crest=sx=>(h/2-h*(.82+j*.085)-Math.sin(sx/w*5.8+j*1.5)*h*.035-Math.sin(sx/w*17+j*2.3)*h*.006)/l.f*D;
  const y=(x,z)=>{const u=(z+D)/D;return crest(x/D*l.f+w/2)-D*(u>0?.09*(u/.3)**2:.05*(u/.12)**2);};
  const tone=(x,z)=>{const v=.965+.035*Math.sin(x/D*l.f/w*21+j)*Math.sin(z/D*55);return [v,v,v,0];};
  return r.mesh(G.terrain(per(l,-.58*w,D),per(l,.75*w,D),-D*1.12,-D*.7,150,14,y,tone));
 }));
 set.stars=once(()=>r.points(Array.from({length:75},(_,i)=>[...at(l,((i*367)%997)/997*w,((i*151)%787)/787*h*.75,1500),(.8+(i%3)*.6)*2.6,(i*.77)%6,1])));
 // The town behind the first hill: the flat film's blocks (and two more for the drift), their windows lit by night.
 set.city=once(()=>{
  const u=(w+h)/2160,base=h*.87,D=420,walls=new G.Geo(),lit=new G.Geo(),dark=new G.Geo();let tall=0;
  for(let i=0;i<19;i++){
   const bw=(29+i*11%36)*u,x=i*w/16-15*u,bh=(60+i*67%135)*u,cols=Math.max(1,Math.ceil(bw/(14*u)-1)),rows=Math.max(1,Math.ceil(bh/(20*u)-1));
   const b=O.buildingParts(per(l,bw,D),per(l,bh,D),per(l,bw,D)*.8,{seed:i*7+3,cols,rows,round:.09,win:[.3,.32]}),m=M.trs(at(l,x+bw/2,base,D));
   walls.add(b.walls,m);lit.add(b.lit,m);dark.add(b.dark,m);tall=Math.max(tall,bh);
  }
  return {walls:r.mesh(walls),lit:r.mesh(lit),dark:r.mesh(dark),sink:per(l,tall+8*u,D)};
 });
 // The first shot's road, its far edge 26 deep where the flat film's began, a curb along it, dashes 40 px long every 100.
 set.road=once(()=>{
  const Yg=per(l,h*.415,26),DD=Yg*l.f/(h*.457),len=per(l,40,DD),gap=per(l,100,DD),thick=per(l,3.4,DD)*DD/Yg,road=new G.Geo(),dashes=new G.Geo();
  road.add(G.plane(34,6,'#ffffff',true),M.trs([2,-Yg,-23]));
  const curb=new G.Geo().add(G.box(34,.07,.22,.03,'#ffffff',2),M.trs([2,-Yg+.035,-25.89]));
  for(let k=-18;k<=30;k++)dashes.add(G.box(len,.01,thick,0,'#ffffff',1),M.trs([k*gap,-Yg+.006,-DD]));
  return {Yg,road:r.mesh(road),curb:r.mesh(curb),dashes:r.mesh(dashes)};
 });
 return set;
}

/* 1 · Your time matters: a steady rain of offers, far ones lost in the night haze, over the car on the road. */
const RAIN_OFFERS=[['$3.50','9.2 mi'],['$4.25','12.4 mi'],['$2.75','7.8 mi'],['$18.40','4.1 mi'],['$5.10','10.6 mi'],['$3.90','8.3 mi']];
const RAIN=(()=>{const r=rnd(23),out=[];
 for(let z=0;z<3;z++)for(let j=0;j<5;j++){const n=out.length;out.push({z,face:n%6,x:(j+.5+(r()-.5)*.45+z*.33)/5%1,y:(j*.618+z*.29)%1,spin:r()*2-1,phase:r()*TAU});}
 return out;})();
function road3d(r,set,l,t,day,alpha){
 const {M}=GL,k=set.road(),I=M.ident();
 r.draw(k.road,I,{tint:mix3('#15293F','#396B78',day),rim:0,spec:.08,shine:14,alpha,cull:false});
 r.draw(k.curb,I,{tint:mix3('#2B4664','#5B8C93',day),rim:.2,spec:.06,alpha});
 r.draw(k.dashes,I,{tint:mix3('#677D94','#DDCCA1',day),rim:0,spec:0,alpha});
}
function time3d(r,set,all,l,t,day,dx,alpha){
 const {M}=GL,{w,h,wide}=l,art=set.art,q=art.carSize;
 // The car rolls on in its lane, a little right of centre, its lamps lit by night.
 const s=wide?2.3:l.square?1.75:2.15,cx=lerp(w*.5,w*.58,smooth(t/3.6)),cy=h*.915+(wide?62:l.square?56:72),D=set.road().Yg*l.f/(cy-h/2);
 const p=at(l,cx,cy,D,dx);p[1]+=Math.abs(Math.sin(t*9))*per(l,1.5,D);
 const car=M.trs(p,[-.22,0,0],per(l,92*s,D)/(92*q));
 r.faded(alpha,()=>art.car(car,{wheel:t*6,lights:1-day}));
 if(day<1){const b=all.beam(),look={tex:b.tex,texAlpha:true,additive:true,unlit:true,tint:'#FFE3A0',alpha:.17*(1-day)*alpha,cull:false,fog:false};
  r.draw(b.quad,M.mul(car,M.trs([151*q,20*q,0],null,[210*q,68*q,1])),look);
  r.draw(b.quad,M.mul(car,M.trs([151*q,22*q,0],[0,-Math.PI/2,0],[210*q,60*q,1])),look);}
 // The offers fall far to near, turning as they go: each where the flat film drew it, at a depth that keeps its size.
 all.faces();
 const x0=wide?980:90,x1=wide?w-110:w-90,top=wide?-360:l.ty+l.head*1.2,bottom=h*.86,k=wide?1:l.square?.85:1.2;
 for(const o of RAIN){
  const s=[.42,.6,.82][o.z]*k,speed=[70,110,165][o.z]*h/1080,span=bottom-top+220*s;
  const y=top-110*s+(o.y*span+speed*t)%span,x=lerp(x0,x1,o.x)+Math.sin(t*.8+o.phase)*18;
  const seen=clamp((y-95*s-top)/(70*s))*clamp((bottom-y)/(90*s));
  if(seen<=0)continue;
  const Dz=[64,48,36][o.z],[yaw,pitch]=facing(l,x,y);
  const m=M.trs(at(l,x,y,Dz,dx),[yaw+Math.sin(t*.7+o.phase)*.45,pitch+Math.sin(t*.55+o.phase*1.7)*.3,-(o.spin*.22+Math.sin(t*.9+o.phase)*.07)],per(l,s*100,Dz));
  art.ticket(m,o.face,{alpha:alpha*clamp(seen*4),haze:1-(1-[.42,.18,0][o.z])*seen,fog:false,fogColor:FOG});
 }
}
function time(c,l,t){heading(c,['Your time','matters.'],l,t,[1.1,1.92]);}
/* 2–6 · The app itself: the phone layer (below) carries the picture; these shots set the words beside it. Square
 * frames give the phone the room under the heading, so their supporting lines rest. */
function aside(c,str,l,lt,day){if(!l.square)supporting(c,str,l,lt,day);}
function minimums(c,l,t){
 heading(c,['Set your','minimums.'],l,t,[0,beat(7)-beat(6)]);
 aside(c,'You set the pace.',l,t-.75);
}
function decline(c,l,t){
 heading(c,['Low offers?','Declined.'],l,t,[0,beat(11)-beat(9)]);
 aside(c,'Below your rules.',l,t-beat(11)+beat(9)-.45);
}
function choose(c,l,t){
 heading(c,['The good ones?','Your call.'],l,t,[0,beat(18)-beat(16)]);
 aside(c,'Ready for your decision.',l,t-.55);
}
function perspective(c,l,t){
 heading(c,['Every offer.','In perspective.'],l,t,[0,beat(21)-beat(19)]);
 aside(c,'Every decision, kept for you.',l,t-1.4);
}
function direction(c,l,t,T){
 const day=dawn(T);
 heading(c,['Find your','next move.'],l,t,[0,beat(25)-beat(24)],day);
 aside(c,'Guided by your offer history.',l,t-.75,day);
}
/* 7 · Offer Filter: the name, then "Free" and "& open source" land with the voice; sparkles take the last hits. */
const cue=n=>beat(n)-beat(27);
// Wide: a paired illustration and type column. Stacked: one shared centerline.
function closing(c,l){
 const {w,wide,square:sq}=l,tx=wide?165:w/2,fy=wide?510:sq?590:1100,size=wide?38:sq?34:43;
 c.font=`400 ${size}px "Atkinson Hyperlegible"`;
 return {mx:wide?1390:540,my:wide?530:sq?250:520,ms:wide?3.45:sq?1.72:3.2,tx,align:wide?'left':'center',fy,size,
  lead:c.measureText('Free ').width,fx:wide?tx+48:(w-c.measureText('Free & open source').width)/2+25};
}
function close3d(r,set,l,c,t,dx,alpha){
 const {M}=GL,art=set.art,q=closing(c,l),D=40,tm=t+8;
 // The mascot grows in as its ensō is brushed round it, bobbing, breathing, waving; it cheers at "Free".
 const ms=q.ms*(.9+.1*pop(t/.6)),sx=q.mx,sy=q.my+Math.sin(tm*1.4)*5-8,[yaw,pitch]=facing(l,sx,sy,12*Math.PI/180);
 const model=M.trs(at(l,sx,sy,D,dx),[yaw+Math.sin(tm*.7)*.12,pitch,0],per(l,62*ms,D));
 const mood=t>cue(28)&&t<cue(28)+.8?'cheer':Math.floor(tm*2)%13===11?'blink':'happy';
 r.faded(alpha*clamp(t/.2),()=>art.mascot(model,{mood,wave:12+Math.sin(tm*2)*7,breathe:Math.sin(tm*2),ring:ease(t/.8)}));
 for(let i=0;i<4;i++){
  const k=pop((t-cue(32+i))/.35);if(k<=0)continue;
  const a=i*TAU/4+.3,px=q.mx+Math.cos(a)*q.ms*115,py=q.my+Math.sin(a)*q.ms*107,[sy2,sp2]=facing(l,px,py);
  art.sparkle(M.trs(at(l,px,py,D,dx),[sy2+Math.sin(t*1.6+i)*.5,sp2,0],per(l,(l.wide?16:12)*k*(1+.12*Math.sin(t*2+i)),D)),i%2?C.gold:'#7AADE3',alpha);
 }
 // The Android head beside "Free" rises with the word.
 const p=ease((t-cue(28))/.42);
 if(p>0){const ax=q.fx-38,ay=q.fy-5+(1-p)*12,[ay2,ap2]=facing(l,ax,ay,.15);
  art.android(M.trs(at(l,ax,ay,D,dx),[ay2+Math.sin(t*1.3)*.35,ap2,0],per(l,18,D)),'#315B54',alpha*p);}
}
function close(c,l,t,T,emblem){
 const {w,wide,square:sq}=l,{tx,align,fy,size,lead,fx}=closing(c,l),green='#315B54';
 rise(c,t-.05,()=>text(c,'Offer Filter',tx,wide?395:sq?529:990,wide?146:sq?109:145,C.ink,{align,maxWidth:wide?850:910}),24);
 rise(c,t-cue(28),()=>body(c,'Free',fx,fy,size,green),12);
 rise(c,t-cue(30),()=>body(c,'& open source',fx+lead,fy,size,green),12);
 rise(c,t-cue(31),()=>text(c,'offerfilter.org',tx,wide?594:sq?657:1193,wide?52:sq?48:56,'#276BAE',{align}),12);
 // A quiet signature on the same alignment, without a filled badge. The
 // emblem arrives pre-tinted: only its ink is colored, its alpha silhouette is unchanged.
 const mw=wide?224:sq?198:270,mh=mw*emblem.height/emblem.width,ex=wide?tx:(w-mw)/2,ey=wide?698:sq?704:1324;
 c.save();c.globalAlpha*=ease((t-cue(32))/.6);c.drawImage(emblem,ex,ey,mw,mh);c.restore();
 rise(c,t-cue(33),()=>body(c,'Independent app. Not affiliated with DoorDash.',wide?165:w/2,wide?992:sq?1008:1818,wide?26:sq?22:27,'#183D4E',{align,maxWidth:wide?920:sq?690:928}),8);
}
/* The phone: the app's own main page (assets/app/, ported from its Java drawing code) in one continuous layer from
 * "Set your minimums" until the close, so it never flickers through a crossfade: its body in 3D, in front of the first
 * shot's falling offers; its screen in the flat layer, under the later shots' words. */
const ENTER=beat(6)-.15,EXIT=beat(27)-.25;
// The offers are invented (no real customer data): this evening's history, then four that land on the beat. Each
// needed the most of $4.00, $1.50 a mile ($1.85 once the knob is dragged) and $0.30 a minute, as the app works it out.
const OFFERS=[
 [20,52,700,3.8,19,1,131,'KEEP'],[20,57,350,9.2,28,2,54,'DECLINE'],[21,3,425,12.4,35,2,49,'DECLINE'],
 [21,8,975,5.6,24,2,142,'KEEP'],[21,12,275,7.8,26,1,47,'DECLINE'],[21,17,680,null,21,2,-1,'REVIEW'],
 [21,21,510,10.6,33,2,63,'DECLINE'],[21,26,390,8.3,27,1,58,'DECLINE'],[21,31,450,7.4,25,2,66,'DECLINE'],
 [21,38,325,6.8,24,1,52,'DECLINE',11],[21,39,550,9.4,31,2,61,'DECLINE',13],[21,40,475,7.2,26,1,57,'DECLINE',15],
 [21,41,1840,4.2,22,2,248,'KEEP',18]
].map(([h,m,pay,miles,minutes,stops,score,result,n])=>({at:Date.UTC(2026,9,6,h,m),pay,miles,minutes,stops,score,result,
 required:Math.max(400,miles==null?0:Math.round((n?185:150)*miles),30*minutes),lands:n?beat(n):-1}));
const HISTORY=9,GOOD=OFFERS[OFFERS.length-1],KIND={KEEP:'passed',DECLINE:'declined',REVIEW:'review'},OUTCOME={KEEP:'PASSED',DECLINE:'DECLINED',REVIEW:'REVIEW'};
// The cues: a finger on the per-mile knob drags it from $1.50 to $1.85; the alert for the good offer; its building
// tapped and its ticket opened, then closed before dawn.
const PRESS=beat(7)-.2,DRAG=[beat(7),beat(8)+.05],LIFT=beat(8)+.25,ALERT=[beat(16)+.25,beat(19)+.2],TAP=beat(21)-.05,SHEET=[beat(21)+.07,beat(23)+.45];
const perMile=T=>150+5*Math.round(7*smooth((T-DRAG[0])/(DRAG[1]-DRAG[0])));
const known=T=>{let n=HISTORY;while(n<OFFERS.length&&T>=OFFERS[n].lands)n++;return n;};
const star=(n,T)=>({rules:{pay:400,perMile:perMile(T),perMinute:30,maxStops:3,adaptive:true},learned:{pay:576,perMile:172,perMinute:38,perStop:310},
 offers:OFFERS.slice(0,n).reverse().map(e=>({pay:e.pay,miles:e.miles,minutes:e.minutes,stops:e.stops,result:KIND[e.result],id:e.at})),selected:-1});
// A finger lands in .12 s and lifts in .25 s.
const press=(T,down,up)=>T<down?0:T<up?ease((T-down)/.12):1-ease((T-up)/.25);
function story(T,App){
 const n=known(T),seen=OFFERS.slice(0,n),newest=seen[n-1],fresh=newest.lands>0&&T-newest.lands<.7,count=r=>seen.filter(e=>e.result===r).length;
 const s={t:T,split:true,mode:'AUTO',time:'9:41',watching:true,place:'Downtown',wait:'Next match: about 7 min',
  caption:App.caption(newest,{entries:seen}),map:App.areaMap.demo,
  star:Object.assign(star(n,T),fresh?{glide:{from:star(n-1,T),since:newest.lands}}:{}),
  skyline:{entries:seen.map(e=>Object.assign({},e,{riseSince:e.lands>0?e.lands:null})),selected:n-1,selectedSince:newest.lands>0?newest.lands:null,
   payoutCents:400,minimumScalePercent:100,scoreByArea:false},
  // The mascot plays each new offer out so its badge pops on the beat: caught on the sieve .83 s in, out of the spout 1.63 s in.
  hero:{state:'ON',dashLabel:'This dash',passed:count('KEEP'),filtered:count('DECLINE'),review:count('REVIEW'),totals:[39+count('KEEP'),111+count('DECLINE'),8+count('REVIEW')],
   offers:OFFERS.slice(HISTORY).map(e=>({outcome:OUTCOME[e.result],since:e.lands-(e.result==='KEEP'?1.6276:.832)}))},
  touches:[]};
 if(T<LIFT+.3){const p=press(T,PRESS,LIFT);if(p>0)s.touches.push({knob:'perMile',press:p});if(T>=PRESS&&T<LIFT)Object.assign(s.star,T<DRAG[0]?{press:'perMile'}:{drag:{axis:'perMile',value:perMile(T)}});}
 if(T>ALERT[0]-.1&&T<ALERT[1]+.4){const sum=`Pay ${App.caption.money(GOOD.pay)}, miles ${GOOD.miles}, minutes ${GOOD.minutes}, stops ${GOOD.stops}; KEEP: required at least ${App.caption.money(GOOD.required)} (meets enabled rules)`;
  s.notification={show:T<ALERT[1]?ease((T-ALERT[0])/.35):1-smooth((T-ALERT[1])/.35),title:'Corner Café offer meets your rules',body:sum};}
 const tap=press(T,TAP,TAP+.16);if(tap>0)s.touches.push({flag:OFFERS.length-1,press:tap});
 if(T>SHEET[0]&&T<SHEET[1]+.4){s.star.open=0;s.sheet={open:T<SHEET[1]?ease((T-SHEET[0])/.22):1-smooth((T-SHEET[1])/.35),press:ease((T-SHEET[0])/.32),entry:GOOD,word:'PASSED',outcome:'PASSED',
  time:App.caption.stubTime(GOOD,GOOD.at),score:'Score reference · '+GOOD.score+'%',reason:'Meets your rules',action:'Passing alert rang · from notification'};}
 return s;
}
// The camera: where the frame looks on the screen (dp from its top) and how close, each key eased in over .7 s.
const CAMERA=[[ENTER,305,1.42],[beat(9),262,2],[beat(16),250,1.85],[beat(19),610,1.75],[beat(21)+.1,738,1.35],[beat(23)+.45,700,1.7]];
function stage(l){
 // Where the phone stands at zoom 1 (the camera's point at ax, ay), the part of the frame it may fill beside or below
 // the words, its widest zoom, and where the note about the screens goes.
 return l.wide?{k:1,ax:1355,ay:540,left:940,top:-1e3,most:2.15,note:[l.tx,1010,21,'left']}
  :l.square?{k:1,ax:540,ay:696,left:-1e3,top:312,most:2.4,note:[540,301,19,'center']}
  :{k:1.4,ax:540,ay:1280,left:-1e3,top:640,most:1.7,note:[540,616,23,'center']};
}
function camera(T){
 let i=0;while(i+1<CAMERA.length&&T>=CAMERA[i+1][0])i++;
 const a=CAMERA[Math.max(0,i-1)],b=CAMERA[i],p=i?smooth((T-b[0])/.7):1;
 return {y:lerp(a[1],b[1],p),z:lerp(a[2],b[2],p)};
}
// Where the phone's screen is (its top-left x, y and dp scale k), or null while it is away or the app's views are unloaded.
function place(l,T){
 const App=root.OfferApp;if(!App||!App.page||T<ENTER||T>EXIT+.5)return null;
 // It slides in, and bows out a little smaller as the close comes in.
 const P=App.phone,s=stage(l),cam=camera(T),inp=ease((T-ENTER)/.8),out=smooth((T-EXIT)/.4),k=s.k*Math.min(cam.z,s.most)*(1-.08*out);
 let x=s.ax-P.W/2*k,y=s.ay-cam.y*k;
 // Beside the words in landscape, the phone never crosses into their column.
 x=Math.max(x,s.left+P.BEZEL*k);
 if(l.wide)x+=(1-inp)*1000;else y+=(1-inp)*1200;
 return {App,P,s,k,x,y:y+out*140,out};
}
function phone3d(r,set,all,l,T,dx){
 const p=place(l,T);if(!p)return;
 const {M}=GL,{P,s,k,x,y,out}=p,D=30,cx=x+P.W/2*k,cy=y+P.H/2*k,sc=per(l,100*k,D),front=at(l,cx,cy,D,dx);
 // Stacked, the phone slips under the sky beneath the words.
 if(!l.wide)r.scissor([0,s.top,l.w,l.h-s.top]);
 const sh=all.shadow(),SD=D+3;
 r.draw(sh.quad,M.trs(at(l,cx,cy+26*k,SD,dx),null,[per(l,640*k,SD),per(l,1280*k,SD),1]),{tex:sh.tex,texAlpha:true,unlit:true,tint:'#040A16',alpha:.45*(1-out),fog:false,cull:false});
 // Its face square to the camera, in line with the flat screen drawn over it.
 r.faded(1-out,()=>set.art.phoneBody(M.trs([front[0],front[1],-D-sc*set.art.phoneSize.D/2],null,sc)));
 if(!l.wide)r.scissor(null);
}
function screen(c,l,T){
 const p=place(l,T);if(!p)return;
 const {App,P,s,k,x,y,out}=p;
 c.save();c.globalAlpha*=1-out;
 if(!l.wide){c.beginPath();c.rect(0,s.top,l.w,l.h-s.top);c.clip();}
 c.translate(x,y);c.scale(k,k);
 // The part of the screen in sight, in the page's dp (under the status bar), so views out of sight are skipped.
 const day=dawn(T),state=story(T,App);state.view={top:((l.wide?0:s.top)-y)/k-P.STATUS,bottom:(l.h-y)/k-P.STATUS};
 // The app turns to its day palette in the middle third of the film's dawn: quickly, as a theme switch does.
 const lit=smooth((day-.35)/.3);
 c.save();P.clip(c);
 if(lit<1)App.page.draw(c,Object.assign({},state,{dark:true}));
 if(lit>0){c.globalAlpha*=lit;App.page.draw(c,Object.assign({},state,{dark:false}));}
 c.restore();P.lens(c);c.restore();
 // Stacked, the sky itself, redrawn in fading strips once the phone is up, blends it away under the words.
 if(!l.wide&&y-P.BEZEL*k<s.top+70)for(let i=0;i<14;i++){const y0=s.top+i*5;c.save();c.globalAlpha*=1-smooth(i/14);sky(c,l,T,0,y0,l.w,5.5);c.restore();}
 // The screens are drawn from the app's own source with invented offers, and the film says so, quietly.
 c.save();c.globalAlpha*=(1-out)*ease((T-ENTER-.6)/.5);
 body(c,'App screens drawn from its source · invented offers',s.note[0],s.note[1],s.note[2],mix('#8FA6C9','#5B7383',dawn(T)),{align:s.note[3],maxWidth:l.wide?760:l.w-120});
 c.restore();
}
/* The 3D layer of one frame: the land and sky, then the shots' things in the studio light. */
function stage3d(r,c,l,t,i,x){
 const {M}=GL,I=IDENT,set=world(r,l),all=WORLDS.get(r),shot=SHOTS[i],prev=SHOTS[i-1],day=dawn(t),dx=drift(l,t);
 r.clear(mix3(...SKY[2],day));
 r.camera({eye:[dx,0,0],at:[dx,0,-1],fov:FOV,near:2,far:3000});
 r.light(landLight(day));
 // Near to far, so the depth test spares the far hills' hidden parts.
 const hills=set.hills();for(let j=HILLS.length-1;j>=0;j--)r.draw(hills[j],I,{tint:mix3(HILLS[j][1],HILLS[j][2],day),rim:.18,spec:.05,shine:10,cull:false});
 // The town rises from behind the first hill for the shots it belongs to and sinks for the others.
 const city=prev?lerp(prev.city,shot.city,smooth((t-shot.from)/.8)):shot.city;
 if(city>.005){const k=set.city(),m=M.trs([0,-k.sink*(1-city),0]);
  // Far off, the town keeps the flat film's haze.
  const haze=lerp(.32,.24,day);
  r.draw(k.walls,m,{tint:mix3('#33496C','#D5DBD2',day),rim:.12,spec:.05,haze});
  r.draw(k.dark,m,{tint:mix3('#2A3D5C','#CAD2C9',day),rim:0,spec:0,haze});
  r.draw(k.lit,m,{tint:mix3('#E9C98A','#E9ECE3',day),rim:0,spec:0,glow:1-day,haze:haze*.6});}
 r.sky({c0:mix3(...SKY[0],day),c1:mix3(...SKY[1],day),c2:mix3(...SKY[2],day),mid:.57,from:[0,0],to:[.3,1],
  halo:'#79A6EB',haloAt:[.75,.4],haloR:l.w*.65,haloA:.19*(1-day)});
 if(day<1)r.stars(set.stars(),{color:'#FFF5DA',alpha:.29*(1-day),time:t,twinkle:1});
 // The first shot's road, car and rain, fading out through the cut to the second.
 const first=i===0?1:i===1?1-x:0;
 if(first>0)road3d(r,set,l,t,day,first);
 r.light(STUDIO);
 if(first>0)time3d(r,set,all,l,t,day,dx,first);
 phone3d(r,set,all,l,t,dx);
 if(i===SHOTS.length-1)close3d(r,set,l,c,t-shot.from,dx,x);
 r.done();
}
const WORDS=[time,minimums,decline,choose,perspective,direction,close];
// t is film time in seconds. c is a 2D context whose transform maps (0,0)-(w,h) onto the frame; r, an OfferGL renderer
// whose canvas is the frame's size and its view w x h units. Returns the visible text's bounds.
function frame(r,c,t,w,h,emblem,opt){
 bounds=[];timestamp=t;audit=!opt||opt.audit!==false;t=clamp(t,0,DURATION-1/FPS);
 const l=layout(w,h);let i=SHOTS.findIndex(s=>t<s.to);if(i<0)i=SHOTS.length-1;
 // The backdrop never cuts; outgoing and incoming foregrounds overlap briefly instead of a hard cut.
 const shot=SHOTS[i],prev=SHOTS[i-1],x=prev?smooth((t-shot.from)/XF):1;
 // The 3D art, drawn into its own canvas, laid in as the frame's background.
 if(r){stage3d(r,c,l,t,i,x);c.drawImage(r.canvas,0,0,w,h);}
 c.save();c.lineJoin='round';c.lineCap='round';
 // The phone's screen passes in front of the first shot's words and under the later shots'.
 if(x<1){scene=prev.name;c.save();c.globalAlpha=1-x;WORDS[i-1](c,l,t-prev.from,t,emblem);c.restore();}
 if(i)screen(c,l,t);
 scene=shot.name;c.save();c.globalAlpha=x;WORDS[i](c,l,t-shot.from,t,emblem);c.restore();
 if(!i)screen(c,l,t);
 c.restore();
 return bounds;
}
root.OfferFilm={DURATION,FPS,POSTER,BEAT,SHOTS,CAPTIONS,frame};
})(typeof window!=='undefined'?window:globalThis);
