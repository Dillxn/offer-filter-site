#!/usr/bin/env node
/* Recompose only the final 2.5 seconds, using the website's original vector
 * primitives, bundled fonts, and unchanged emblem master. No new artwork. */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { createCanvas, loadImage, GlobalFonts, Path2D } = require('@napi-rs/canvas');
global.Path2D = Path2D;
require('../assets/brand.js');
const A = global.OfferArt;
const root = path.resolve(__dirname, '..');
GlobalFonts.registerFromPath(path.join(root,'assets/Baloo2.ttf'), 'Baloo 2');
GlobalFonts.registerFromPath(path.join(root,'assets/AtkinsonHyperlegible-Regular.ttf'), 'Atkinson Hyperlegible');
const FORMATS = {
  landscape: {w:1920,h:1080,ring:[1400,470,250],mascot:[1400,437,2.78],title:[160,382,118,'left'],tag:[162,459,46,'left'],support:[164,578,28,'left'],tips:[164,625,29,'left'],mark:[671,542,220],notice:[960,1014,23]},
  portrait: {w:1080,h:1920,ring:[540,535,267],mascot:[540,500,2.97],title:[540,945,115,'center'],tag:[540,1027,45,'center'],support:[540,1142,28,'center'],tips:[540,1190,30,'center'],mark:[430,1270,220],notice:[540,1808,23]},
  square: {w:1080,h:1080,ring:[540,310,178],mascot:[540,286,1.98],title:[540,604,91,'center'],tag:[540,668,36,'center'],support:[174,790,23,'left'],tips:[174,832,25,'left'],mark:[707,735,190],notice:[540,1014,21]},
};
function text(ctx,txt,x,y,size,align='left',color='#111B34',weight=400,family='Atkinson Hyperlegible'){
  ctx.font=`${weight} ${size}px "${family}"`;ctx.fillStyle=color;ctx.textAlign=align;ctx.textBaseline='alphabetic';ctx.fillText(txt,x,y);
}
function background(ctx,w,h){
  const g=ctx.createLinearGradient(0,0,w,h);g.addColorStop(0,'#D2DFEF');g.addColorStop(.52,'#E9DFD2');g.addColorStop(1,'#F6C895');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
  // Preserve the film's warm sky and quiet layered skyline, behind the content.
  const horizon=h*.81;
  ctx.fillStyle='rgba(131,167,176,.12)';
  for(let i=0;i<19;i++){const x=i*w/17-w*.03,bh=(.065+((i*17)%13)*.012)*h;A.roundRect(ctx,x,horizon-bh,w*(.021+(i%3)*.012),h*.24,7);ctx.fill();}
  const square=w===h, dy=square?.07:0;
  const hills=[['#AEBFC0',.8+dy,.029,1.0],['#8EA9A7',.9+dy,.045,2.9],['#678E96',.99+dy,.048,4.2]];
  for(const [color,y,amp,phase] of hills){ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(0,h);ctx.lineTo(0,h*y);for(let x=0;x<=w;x+=12)ctx.lineTo(x,h*y+Math.sin(x/w*5+phase)*h*amp);ctx.lineTo(w,h);ctx.closePath();ctx.fill();}
}
function render(canvas,layout,mark,t){
  const ctx=canvas.getContext('2d'),{w,h}=layout;ctx.clearRect(0,0,w,h);background(ctx,w,h);
  const [cx,cy,r]=layout.ring;A.enso(ctx,cx,cy,r,1,'#4D83E8',r*.068);
  const [mx,my,s]=layout.mascot;A.mascot(ctx,mx,my,s,{mood:'happy',breathe:Math.sin(t*1.8),wave:5+Math.sin(t*1.2)*2});
  A.sparkle(ctx,cx-r*1.08,cy-r*.34,r*.034,'#EFD184');A.sparkle(ctx,cx+r*1.09,cy+r*.37,r*.026,'#EFD184');
  text(ctx,'Offer Filter',...layout.title,'#111B34',700,'Baloo 2');
  text(ctx,'A little more calm.',...layout.tag,'#3979CF',400);
  text(ctx,'FREE ANDROID BETA',...layout.support,'#343A40',400);
  text(ctx,'Android · tips welcome',...layout.tips,'#343A40',400);
  const [x,y,mw]=layout.mark;ctx.drawImage(mark,x,y,mw,mark.height*mw/mark.width);
  text(ctx,'Independent app. Not affiliated with DoorDash.',...layout.notice,'center','#354F58',400);
}
(async()=>{
  const output=path.resolve(process.argv[2]||'/tmp/offer-composition-frames');fs.mkdirSync(output,{recursive:true});
  const emblem=await loadImage(path.join(root,'assets/jesus-loves-you-emblem.png'));
  const mark=createCanvas(emblem.width,emblem.height),mc=mark.getContext('2d');mc.drawImage(emblem,0,0);mc.globalCompositeOperation='source-in';mc.fillStyle='#343A40';mc.fillRect(0,0,mark.width,mark.height);
  const layouts={};
  for(const [name,l] of Object.entries(FORMATS)){
    const canvas=createCanvas(l.w,l.h);render(canvas,l,mark,1.5);fs.writeFileSync(path.join(output,name+'.png'),canvas.toBuffer('image/png'));
    const encoder=spawn('ffmpeg',['-nostdin','-y','-v','error','-f','image2pipe','-framerate','30','-i','pipe:0','-c:v','qtrle','-pix_fmt','argb','-threads','2',path.join(output,name+'.mov')],{stdio:['pipe','inherit','inherit']});
    const done=new Promise((resolve,reject)=>{encoder.on('error',reject);encoder.on('exit',code=>code===0?resolve():reject(new Error('encoder '+code)));});
    for(let i=0;i<75;i++){render(canvas,l,mark,i/30);if(!encoder.stdin.write(canvas.toBuffer('image/png')))await new Promise(r=>encoder.stdin.once('drain',r));}
    encoder.stdin.end();await done;layouts[name]=l;console.log(`${name}: 75 frames rendered locally`);
  }
  fs.writeFileSync(path.join(output,'closing-scene-layouts.json'),JSON.stringify({start:16,fadeSeconds:.3,duration:2.5,frames:75,layouts},null,2)+'\n');
})().catch(e=>{console.error(e);process.exit(1)});
