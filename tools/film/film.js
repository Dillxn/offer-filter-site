/* Offer Filter: one deterministic, narration-timed vector film.
 * Each aspect ratio is composed independently. No remote assets or build service.
 */
(function(root) {
'use strict';
const A=root.OfferArt, TAU=Math.PI*2;
const C={ink:'#162844',cream:'#FFF7DF',blue:'#4385EB',sky:'#AFD0FF',pink:'#F29791',mint:'#B9E4BE',gold:'#F5C66F',purple:'#C3ABF7'};
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const ease=t=>1-Math.pow(1-clamp(t),3);
const smooth=t=>{t=clamp(t);return t*t*(3-2*t);};
const SHOTS=[
 {from:0,to:1.78,name:'time'},
 {from:1.78,to:3.72,name:'minimums'},
 {from:3.72,to:7.08,name:'decline'},
 {from:7.08,to:9,name:'choose'},
 {from:9,to:11.5,name:'perspective'},
 {from:11.5,to:13.8,name:'direction'},
 {from:13.8,to:21,name:'close'},
];
let bounds=[], scene='', timestamp=0;
function box(c,x,y,w,h,r,fill,stroke){A.roundRect(c,x,y,w,h,r);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.stroke();}}
function dot(c,x,y,r,col){c.beginPath();c.arc(x,y,Math.max(.001,r),0,TAU);c.fillStyle=col;c.fill();}
function stroke(c,pts,col,w=2){c.beginPath();pts.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.strokeStyle=col;c.lineWidth=w;c.stroke();}
// Measure the actual font, including ink overhang and descenders. Never use a
// fixed-height clipping rectangle or Canvas's horizontally squashed maxWidth.
function text(c,str,x,y,size,col=C.cream,opt={}) {
 const {align='left',family='Baloo 2',weight=700,maxWidth=Infinity,track=true}=opt;
 c.textAlign=align;c.textBaseline='alphabetic';c.fillStyle=col;
 c.font=`${weight} ${size}px "${family}"`;
 let m=c.measureText(str);
 if(m.width>maxWidth){size*=maxWidth/m.width;c.font=`${weight} ${size}px "${family}"`;m=c.measureText(str);}
 c.fillText(str,x,y);
 if(track&&c.globalAlpha>.1){
  const tr=c.getTransform(),left=x-m.actualBoundingBoxLeft,right=x+m.actualBoundingBoxRight;
  const top=y-m.actualBoundingBoxAscent,bottom=y+m.actualBoundingBoxDescent;
  const corners=[[left,top],[right,top],[right,bottom],[left,bottom]].map(([a,b])=>[tr.a*a+tr.c*b+tr.e,tr.b*a+tr.d*b+tr.f]);
  bounds.push({scene,timestamp,text:str,size,alpha:c.globalAlpha,left:Math.min(...corners.map(p=>p[0])),right:Math.max(...corners.map(p=>p[0])),top:Math.min(...corners.map(p=>p[1])),bottom:Math.max(...corners.map(p=>p[1]))});
 }
 return m;
}
function body(c,str,x,y,size,col=C.sky,opt={}){return text(c,str,x,y,size,col,{family:'Atkinson Hyperlegible',weight:400,...opt});}
function layout(w,h){
 const wide=w/h>1.25,square=w===h;
 return {w,h,wide,square,tx:wide?120:square?76:86,ty:wide?338:square?148:248,
  head:wide?120:square?101:134,headW:wide?810:w-(square?152:172),
  cx:wide?1360:w/2,cy:wide?552:square?615:1060,r:wide?298:square?235:330,
  k:wide?1:square?.82:1.08};
}
function heading(c,lines,l,t,day=0){
 const base=day?C.ink:C.cream,accent=day?'#2772C4':C.sky;
 lines.forEach((s,i)=>{c.save();const p=ease((t-i*.055)/.42);c.globalAlpha*=p;
  text(c,s,l.tx,l.ty+i*l.head*.98+(1-p)*22,l.head,i===1?accent:base,{maxWidth:l.headW});c.restore();});
}
function supporting(c,str,l,y,day=0){body(c,str,l.tx,y,l.square?30:36,day?'#426275':C.sky,{maxWidth:l.headW});}
function background(c,w,h,t,day=0){
 const g=c.createLinearGradient(0,0,w*.3,h);g.addColorStop(0,A.mix('#0C1732','#CFE7ED',day));g.addColorStop(.57,A.mix('#263753','#F0DFBB',day));g.addColorStop(1,A.mix('#354260','#F8B27E',day));c.fillStyle=g;c.fillRect(0,0,w,h);
 const halo=c.createRadialGradient(w*.75,h*.4,0,w*.75,h*.4,w*.65);halo.addColorStop(0,`rgba(121,166,235,${.19*(1-day)})`);halo.addColorStop(1,'rgba(121,166,235,0)');c.fillStyle=halo;c.fillRect(0,0,w,h);
 if(day<1)for(let i=0;i<75;i++){const x=((i*367)%997)/997*w,y=((i*151)%787)/787*h*.75;dot(c,x,y,.8+(i%3)*.6,`rgba(255,245,218,${(1-day)*(.15+.14*Math.sin(i+t))})`);}
 const colors=day?['#B9C8BA','#7FA99E','#477E85']:['#2C4260','#253B56','#1B3049'];
 for(let j=0;j<3;j++){c.beginPath();c.moveTo(0,h);for(let x=0;x<=w+20;x+=20)c.lineTo(x,h*(.82+j*.085)+Math.sin(x/w*5.8+j*1.5+t*.025)*h*.035);c.lineTo(w,h);c.closePath();c.fillStyle=colors[j];c.fill();}
}
function skyline(c,w,h,t,day=0){
 const u=w/1080,base=h*.84;c.save();c.globalAlpha=day?.32:.48;
 for(let i=0;i<17;i++){const bw=(29+i*11%36)*u,x=i*w/16-15*u,bh=(40+i*67%135)*u;
  box(c,x,base-bh,bw,bh,5*u,day?'#659BA4':'#496486');
  for(let row=0;row<bh/(20*u)-1;row++)for(let col=0;col<bw/(14*u)-1;col++){c.fillStyle=day?'#EFDFB5':'#CCB57E';c.fillRect(x+8*u+col*14*u,base-bh+10*u+row*20*u,4*u,6*u);}}
 c.restore();
}
function road(c,w,h,t,day=0){
 const y=h*.915;c.fillStyle=day?'#396B78':'#15293F';c.fillRect(0,y,w,h-y);
 c.setLineDash([40,60]);c.lineDashOffset=-t*115;stroke(c,[[0,y+h*.042],[w,y+h*.042]],day?'#DDCCA1':'#677D94',3);c.setLineDash([]);
}
function car(c,x,y,s=1){
 c.save();c.translate(x,y);c.scale(s,s);
 dot(c,-42,25,14,C.ink);dot(c,48,25,14,C.ink);dot(c,-42,25,6,C.cream);dot(c,48,25,6,C.cream);
 c.beginPath();c.moveTo(-75,20);c.lineTo(-70,-10);c.quadraticCurveTo(-60,-18,-42,-18);c.lineTo(-18,-47);c.quadraticCurveTo(-10,-54,4,-54);c.lineTo(39,-47);c.lineTo(63,-15);c.quadraticCurveTo(80,-7,80,20);c.closePath();c.fillStyle=C.cream;c.fill();
 c.beginPath();c.moveTo(-31,-21);c.lineTo(-10,-44);c.lineTo(3,-44);c.lineTo(3,-21);c.closePath();c.fillStyle=C.blue;c.fill();box(c,11,-41,26,21,4,C.blue);box(c,-73,0,11,9,3,C.pink);box(c,66,0,13,10,3,C.gold);c.restore();
}
function ticket(c,x,y,s,rot,pay,info,kind,alpha=1,track=false){
 c.save();c.globalAlpha*=alpha;c.translate(x,y);c.rotate(rot);c.scale(s,s);
 c.shadowColor='rgba(5,18,40,.22)';c.shadowBlur=20;c.shadowOffsetY=12;box(c,-157,-89,314,178,19,C.cream);c.shadowColor='transparent';
 const col=kind==='decline'?C.pink:kind==='pass'?C.mint:C.sky;box(c,-157,-89,58,178,19,col);c.fillStyle=C.cream;c.fillRect(-113,-89,22,178);
 c.setLineDash([4,6]);stroke(c,[[-100,-74],[-100,74]],'#B4BCB3',1.4);c.setLineDash([]);
 c.save();c.translate(-128,0);c.rotate(-Math.PI/2);body(c,'OFFER',0,7,17,C.ink,{align:'center',track:false});c.restore();
 text(c,pay,-79,6,58,C.ink,{maxWidth:216,track});body(c,info,-78,45,22,'#49616C',{maxWidth:214,track});
 dot(c,-100,-89,6,'#2C415D');dot(c,-100,89,6,'#2C415D');c.restore();
}
function mascot(c,x,y,s,t,ring=1){
 c.save();c.translate(x,y+Math.sin(t*1.4)*5);A.enso(c,0,0,97*s,ring,C.blue,8*s);
 A.mascot(c,0,-8,s,{mood:Math.floor(t*2)%13===11?'blink':'happy',wave:12+Math.sin(t*2)*7,breathe:Math.sin(t*2)});c.restore();
}
function icon(c,x,y,r,kind,col){
 dot(c,x,y,r,col);const p=kind==='check'?[[-.44,.01],[-.1,.35],[.45,-.33]]:[[-.3,-.3],[.3,.3]];
 stroke(c,p.map(([a,b])=>[x+a*r,y+b*r]),C.ink,r*.13);
 if(kind!=='check')stroke(c,[[x+r*.3,y-r*.3],[x-r*.3,y+r*.3]],C.ink,r*.13);
}
function intro(c,w,h,t,l){
 background(c,w,h,t);skyline(c,w,h,t);road(c,w,h,t);car(c,w*.57,h*.95,1.55);
 for(let i=0;i<9;i++){const cx=l.wide?1130+(i%3)*235:145+(i%3)*380,cy=(l.wide?240:l.square?400:680)+Math.floor(i/3)*(l.wide?205:l.square?190:325);ticket(c,cx+Math.sin(t+i)*28,cy+Math.cos(t*.7+i)*27,l.wide?.64:l.square?.65:.8,Math.sin(i)*.13,['$3.50','$4.25','$18.40'][i%3],['9.2 mi','12.4 mi','4.1 mi'][i%3],null,.3+(i%3)*.14);}
 if(!l.wide){const g=c.createLinearGradient(0,0,0,l.ty+200);g.addColorStop(0,'#0C1732');g.addColorStop(.7,'rgba(12,23,50,.97)');g.addColorStop(1,'rgba(12,23,50,0)');c.fillStyle=g;c.fillRect(0,0,w,l.ty+200);}
 heading(c,['Your time','matters.'],l,t);
}
function rules(c,w,h,t,l){
 background(c,w,h,t+2);heading(c,['Set your','minimums.'],l,t);
 const r=l.r*.9,cx=l.cx,cy=l.cy,angs=[-2.35,-.79,.79,2.35],vals=[.63,lerp(.43,.82,smooth((t-.25)/1.1)),.68,.53];
 for(let k=1;k<=4;k++){c.beginPath();c.arc(cx,cy,r*k/4,0,TAU);c.strokeStyle=k===4?'#769DCF':'#3E587B';c.lineWidth=k===4?2.6:1.6;c.stroke();}
 const points=vals.map((v,i)=>[cx+Math.cos(angs[i])*r*v,cy+Math.sin(angs[i])*r*v]);
 angs.forEach((a,i)=>{const x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r;stroke(c,[[cx,cy],[x,y]],'#557399',2);
  const lx=cx+Math.cos(a)*r*1.21,ly=cy+Math.sin(a)*r*1.21;dot(c,lx,ly,l.square?34:43,C.cream);body(c,['$','/mi','/min','/stop'][i],lx,ly+8,i?l.square?19:24:34,C.ink,{align:'center'});});
 c.beginPath();points.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.closePath();c.fillStyle='rgba(91,154,249,.3)';c.fill();c.strokeStyle=C.sky;c.lineWidth=5;c.stroke();points.forEach(p=>dot(c,...p,10,C.sky));
 const p=points[1];dot(c,...p,24+Math.sin(t*3)*4,'rgba(161,205,255,.23)');box(c,p[0]-93,p[1]-75,186,53,25,C.cream);text(c,`$${lerp(2,3,smooth((t-.25)/1.1)).toFixed(2)}/mi`,p[0],p[1]-39,30,C.ink,{align:'center'});
 supporting(c,'You set the pace.',l,l.ty+l.head*2.25);
}
function decline(c,w,h,t,l){
 background(c,w,h,t+4);skyline(c,w,h,t);heading(c,['Low offers?','Declined.'],l,t);
 mascot(c,l.cx,l.cy,l.r/97,t+3);
 for(let i=0;i<2;i++){
  const lt=t-.25-i*1.13;if(lt<0||lt>1.4)continue;
  const p=ease(lt/.48),q=clamp((lt-.5)/.85),sign=i?1:-1;
  const y=lerp(l.cy-l.r*1.85,l.cy-l.r*.73,p)-Math.sin(q*Math.PI)*l.r*.4;
  ticket(c,l.cx+sign*q*l.r*1.8,y,(l.square?.75:.94),sign*q*.65,i?'$4.25':'$3.50',i?'12.4 mi · 38 min':'9.2 mi · 34 min','decline',Math.min(p,1-q));
  if(q>0&&q<.95)icon(c,l.cx+sign*l.r*.72,l.cy-l.r*.88,(l.square?25:32)*ease(q*6),'cross',C.pink);
 }
 supporting(c,'Below your rules.',l,l.ty+l.head*2.25);
}
function choose(c,w,h,t,l){
 background(c,w,h,t+7);skyline(c,w,h,t);heading(c,['The good ones?','Your call.'],l,t);
 const s=l.r/97*(l.square?.83:.91),my=l.cy-(l.square?20:45);mascot(c,l.cx,my,s,t+6);
 const p=ease((t-.1)/.65),ty=l.cy+(l.square?218:350);ticket(c,l.cx,lerp(my+80,ty,p),l.square?1.12:1.36,0,'$18.40','4.1 mi · 22 min','pass',p,true);
 if(p>.95)icon(c,l.cx+155*(l.square?1.12:1.36),ty-90*(l.square?1.12:1.36),l.square?31:40,'check',C.mint);
 supporting(c,'Ready for your decision.',l,l.ty+l.head*2.25);
}
function history(c,w,h,t,l){
 background(c,w,h,t+9);heading(c,['Every offer.','In perspective.'],l,t);
 const width=l.wide?660:l.square?830:870,x0=l.cx-width/2,base=l.wide?842:l.square?883:1540,scale=l.wide?1:l.square?.83:1.27;
 const heights=[86,122,294,138,198,243,105,165,314,144];
 heights.forEach((hh,i)=>{const p=ease((t-i*.055)/.65),bw=width/10-12,x=x0+i*width/10,pass=[2,5,8].includes(i),bh=hh*scale*p,col=pass?C.mint:C.pink;
  box(c,x,base-bh,bw,bh,6,col);for(let row=0;row<Math.floor((bh-20)/28);row++)for(let col=0;col<2;col++){c.fillStyle='rgba(23,44,59,.24)';c.fillRect(x+12+col*(bw-31),base-bh+14+row*28,7,10);}
  if(p>.65)icon(c,x+bw/2,base-bh-29,17,pass?'check':'cross',col);
 });
 stroke(c,[[x0-10,base+2],[x0+width,base+2]],'#6D94BA',2);
 const ky=l.wide?340:l.square?448:942;
 body(c,'3 passed',x0,ky, l.square?31:37,C.mint);body(c,'7 declined',x0+width*.58,ky,l.square?31:37,C.pink);
 body(c,'ILLUSTRATIVE OFFERS',x0,ky-52,l.square?20:22,C.sky);
}
function map(c,l,t){
 const cx=l.cx,cy=l.cy+15,r=l.r*(l.square?1.04:1.08);
 c.save();c.beginPath();c.arc(cx,cy,r,0,TAU);c.clip();dot(c,cx,cy,r,'#C8D6BD');
 c.strokeStyle='#B6C8B4';c.lineWidth=23;for(let k=-3;k<=3;k++){stroke(c,[[cx-r,cy+k*98-r*.12],[cx+r,cy+k*98+r*.1]],'#E6E3BF',l.square?15:23);stroke(c,[[cx+k*113,cy-r],[cx+k*113+70,cy+r]],'#E6E3BF',l.square?15:23);}
 const pts=[[cx-r*.59,cy+r*.38],[cx-r*.16,cy+r*.4],[cx-r*.11,cy-r*.07],[cx+r*.38,cy-r*.11],[cx+r*.43,cy-r*.49]];
 stroke(c,pts,'#FFF5DB',18);c.save();c.setLineDash([2000]);c.lineDashOffset=2000*(1-ease(t/1.1));stroke(c,pts,'#317BCA',10);c.restore();
 dot(c,...pts[0],18,C.blue);dot(c,...pts[0],7,C.cream);const end=pts.at(-1);dot(c,...end,29,C.gold);dot(c,...end,12,'#B98236');
 for(const [x,y,s] of [[-.65,-.4,18],[.63,.44,22],[.2,.67,15],[-.62,.64,12]]){dot(c,cx+x*r,cy+y*r,s,'#739B80');dot(c,cx+x*r+9,cy+y*r-10,s*.8,'#8BAE87');}
 c.restore();c.beginPath();c.arc(cx,cy,r,0,TAU);c.strokeStyle='#FBF1D4';c.lineWidth=8;c.stroke();
}
function direction(c,w,h,t,l){
 const day=smooth(t/.65);background(c,w,h,t+12,day);skyline(c,w,h,t,day);heading(c,['Find your','next move.'],l,t,day>.5);
 map(c,l,t);road(c,w,h,t,day);car(c,lerp(w*.33,w*.61,ease(t/2.2)),h*.95,l.wide?1.4:1.35);
 supporting(c,'Guided by your offer history.',l,l.ty+l.head*2.2,1);
}
function android(c,x,y,s,col){c.save();c.translate(x,y);c.scale(s,s);c.lineCap='round';stroke(c,[[-11,-14],[-17,-24]],col,3);stroke(c,[[11,-14],[17,-24]],col,3);c.beginPath();c.arc(0,0,24,Math.PI,TAU);c.lineTo(24,5);c.lineTo(-24,5);c.closePath();c.fillStyle=col;c.fill();dot(c,-10,-6,2.6,C.cream);dot(c,10,-6,2.6,C.cream);c.restore();}
function close(c,w,h,t,l,emblem){
 background(c,w,h,t+14,1);skyline(c,w,h,t,1);
 const wide=l.wide,sq=l.square;
 const mx=wide?1390:540,my=wide?442:sq?387:565,ms=wide?3.25:sq?2.03:3.25;
 const p=ease(t/.55);mascot(c,mx,my,ms*(.93+.07*p),t+8);
 for(let i=0;i<4;i++){const a=i*TAU/4+.3;A.sparkle(c,mx+Math.cos(a)*ms*115,my+Math.sin(a)*ms*107,(wide?16:12)*(1+.12*Math.sin(t+i)),i%2?C.gold:'#7AADE3');}
 const tx=wide?135:w/2,align=wide?'left':'center',ty=wide?355:sq?132:1030;
 text(c,'Offer Filter',tx,ty,wide?148:sq?107:145,C.ink,{align,maxWidth:wide?920:930});
 body(c,'A little more calm.',tx,ty+(wide?75:sq?58:80),wide?54:sq?40:52,'#276BAE',{align});
 const fy=wide?571:sq?719:1230;
 const freeSize=wide?38:sq?36:42;c.font=`400 ${freeSize}px \"Atkinson Hyperlegible\"`;const freeWidth=c.measureText('Free & open source').width;const freeX=wide?198:(w-freeWidth)/2+25;android(c,freeX-38,fy-5,.75,'#2D7865');body(c,'Free & open source',freeX,fy,freeSize,'#285D59');
 const by=wide?644:sq?758:1290,bw=wide?410:sq?394:470,bh=wide?91:sq?80:100,bx=wide?132:(w-bw)/2;
 box(c,bx,by,bw,bh,bh/2,'#276FBE');text(c,'offerfilter.org',bx+bw/2,by+bh*.66,wide?42:sq?39:48,'#FFF7DF',{align:'center'});
 // The original artwork stays unchanged and complete, including the passage
 // and reference. Its backing is a colored evening sky inside the dawn world.
 const mw=wide?250:sq?172:290,mh=mw*emblem.height/emblem.width,ex=wide?770:sq?802:395,ey=wide?640:sq?528:1458;
 c.save();c.globalAlpha*=ease((t-.5)/.6);box(c,ex-21,ey-16,mw+42,mh+32,24,'#366A79');c.drawImage(emblem,ex,ey,mw,mh);c.restore();
 const ny=wide?992:sq?1008:1818;
 body(c,'Independent app. Not affiliated with DoorDash.',wide?135:76,ny,wide?26:sq?22:27,'#183D4E',{maxWidth:wide?920:sq?690:928});
}
const DRAW=[intro,rules,decline,choose,history,direction,close];
function draw(c,w,h,t,i,emblem){c.save();c.lineJoin='round';c.lineCap='round';scene=SHOTS[i].name;DRAW[i](c,w,h,t-SHOTS[i].from,layout(w,h),emblem);c.restore();}
function frame(c,t,w,h,emblem){
 bounds=[];timestamp=t;t=clamp(t,0,21-1/30);let i=SHOTS.findIndex(s=>t<s.to);if(i<0)i=6;
 // A short crossfade lets typography remain fully drawn and avoids a hard
 // black frame. Unlike a text reveal mask, it cannot cut ascenders/descenders.
 const local=t-SHOTS[i].from;
 if(i>0&&local<.18){draw(c,w,h,SHOTS[i].from-1/30,i-1,emblem);c.save();c.globalAlpha=smooth(local/.18);draw(c,w,h,t,i,emblem);c.restore();}
 else draw(c,w,h,t,i,emblem);
 return bounds;
}
root.OfferFilm={DURATION:21,FPS:30,SHOTS,frame};
})(typeof window!=='undefined'?window:globalThis);
