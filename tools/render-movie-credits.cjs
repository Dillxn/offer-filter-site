#!/usr/bin/env node
/* Typeset the requested film credits with bundled font, black and white only. */
const fs=require('fs'),path=require('path'),{spawn}=require('child_process');
const {createCanvas,GlobalFonts}=require('@napi-rs/canvas');
const root=path.resolve(__dirname,'..');
GlobalFonts.registerFromPath(path.join(root,'assets/AtkinsonHyperlegible-Regular.ttf'),'Atkinson Hyperlegible');
const layouts={
 landscape:{w:1920,h:1080,drift:100,title:[218,56,9],label:[337,24,5],music:[382,34,2],message:[557,68,5],passage:[[657,42,2],[714,42,2]],verse:[785,32,5],notice:[[966,26,0]]},
 portrait:{w:1080,h:1920,drift:145,title:[445,64,9],label:[624,28,4],music:[680,42,2],message:[931,68,3],passage:[[1060,45,1],[1125,45,1]],verse:[1207,35,4],notice:[[1560,29,0],[1605,29,0]]},
 square:{w:1080,h:1080,drift:90,title:[177,56,8],label:[302,24,4],music:[349,36,2],message:[523,64,3],passage:[[623,42,1],[681,42,1]],verse:[752,32,4],notice:[[947,25,0]]},
};
function lettered(ctx,text,y,size,tracking,width,alpha=1){
 ctx.font=`${size}px "Atkinson Hyperlegible"`;ctx.textBaseline='alphabetic';ctx.fillStyle=`rgba(255,255,255,${alpha})`;
 const chars=[...text],span=chars.reduce((a,c)=>a+ctx.measureText(c).width,0)+(chars.length-1)*tracking;
 if(span>width*.88)throw new Error(`Line too wide: ${text} ${span}/${width}`);
 let x=(width-span)/2;for(const c of chars){ctx.fillText(c,x,y);x+=ctx.measureText(c).width+tracking;}
 return {text,baseline:y,fontSize:size,tracking,width:span,left:(width-span)/2,right:(width+span)/2,alpha};
}
function render(canvas,l,t){
 const ctx=canvas.getContext('2d');ctx.fillStyle='#000';ctx.fillRect(0,0,l.w,l.h);
 // A slow straight credit drift, gently braking into an unhurried final hold.
 const travel=Math.min(t/4.8,1),drift=l.drift*Math.pow(1-travel,1.3),opacity=Math.min(t/.65,1);
 ctx.save();ctx.translate(0,drift);ctx.globalAlpha=opacity;
 const lines=[];const put=(s,p,a=1)=>lines.push(lettered(ctx,s,...p,l.w,a));
 put('OFFER FILTER',l.title);put('MUSIC & NARRATION',l.label,.65);put('Your Time Matters',l.music,.92);
 put('JESUS LOVES YOU',l.message);
 put('WE LOVE EACH OTHER',l.passage[0]);put('BECAUSE HE LOVES US FIRST.',l.passage[1]);put('1 JOHN 4:19',l.verse,.78);
 if(l.notice.length===1)put('Independent app. Not affiliated with DoorDash.',l.notice[0],.60);
 else{put('Independent app.',l.notice[0],.60);put('Not affiliated with DoorDash.',l.notice[1],.60);}
 ctx.restore();return {lines,drift,opacity};
}
(async()=>{
 const out=path.resolve(process.argv[2]||'/tmp/offer-movie-credits-frames');fs.mkdirSync(out,{recursive:true});
 const receipt={startSeconds:16,durationSeconds:8,frames:240,fps:30,whiteFadeSeconds:.65,driftSettlesAtSeconds:20.8,finalHoldSeconds:3.2,layouts:{}};
 for(const[name,l]of Object.entries(layouts)){
  const c=createCanvas(l.w,l.h);const settled=render(c,l,7.5);fs.writeFileSync(path.join(out,name+'-final.png'),c.toBuffer('image/png'));
  render(c,l,2.4);fs.writeFileSync(path.join(out,name+'-moving.png'),c.toBuffer('image/png'));
  const enc=spawn('ffmpeg',['-nostdin','-y','-v','error','-f','image2pipe','-framerate','30','-i','pipe:0','-c:v','qtrle','-pix_fmt','argb','-threads','2',path.join(out,name+'.mov')],{stdio:['pipe','inherit','inherit']});
  const done=new Promise((resolve,reject)=>{enc.on('error',reject);enc.on('exit',n=>n===0?resolve():reject(Error('encoder '+n)));});
  for(let i=0;i<240;i++){render(c,l,i/30);if(!enc.stdin.write(c.toBuffer('image/png')))await new Promise(r=>enc.stdin.once('drain',r));}
  enc.stdin.end();await done;receipt.layouts[name]={...l,...settled};console.log(name+': 240 frames rendered locally');
 }
 fs.writeFileSync(path.join(out,'movie-credits-layouts.json'),JSON.stringify(receipt,null,2)+'\n');
})().catch(e=>{console.error(e);process.exit(1)});
