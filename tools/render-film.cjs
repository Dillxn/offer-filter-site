#!/usr/bin/env node
const fs=require('fs'),path=require('path'),{spawn}=require('child_process');
let canvas;try{canvas=require('@napi-rs/canvas')}catch(e){if(!process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES)throw e;canvas=require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'@napi-rs/canvas'));}
const {createCanvas,GlobalFonts,loadImage,Path2D}=canvas;global.Path2D=Path2D;
const root=path.resolve(__dirname,'..');
// Skia ignores weight on variable fonts, so the film's bold Baloo 2 is a static 700 instance (tools/make-fonts.sh).
for(const[file,name]of[['baloo2-bold-latin.ttf','Baloo 2'],['AtkinsonHyperlegible-Regular.ttf','Atkinson Hyperlegible'],['roboto-400-latin.ttf','Roboto'],['roboto-500-latin.ttf','Roboto']]){if(!GlobalFonts.registerFromPath(path.join(root,'assets',file),name))throw Error('Font failed: '+file);}
// The app's own views (assets/app/), drawn inside the film's phone, load before the film as on the page.
require('../assets/brand.js');for(const file of require('../assets/app/files.json'))require('../assets/app/'+file);require('../assets/film.js');
// The app's ports draw a few things offscreen (a layer, a blurred shadow), as the page does with canvas elements.
OfferApp.util.makeCanvas=(w,h)=>createCanvas(w,h);
const {DURATION,FPS,POSTER,CAPTIONS}=OfferFilm,FRAMES=Math.round(DURATION*FPS);
const FORMATS={landscape:[1920,1080],portrait:[1080,1920],square:[1080,1080]};
const OUT=path.resolve(process.argv[3]||'/tmp/offer-filter-film');fs.mkdirSync(OUT,{recursive:true});
const times=[2.6,4.7,6.5,10.5,12.9,14.9,17.9,POSTER];
const stamp=s=>{const m=Math.floor(s/60),r=(s-m*60).toFixed(3).padStart(6,'0');return `${String(m).padStart(2,'0')}:${r}`;};
function writeCaptions(){
 const vtt='WEBVTT\n\nNOTE Generated from OfferFilm.CAPTIONS in assets/film.js, timed to the narration take\'s word boundaries.\n\n'+CAPTIONS.map(([a,b,s])=>`${stamp(a)} --> ${stamp(b)}\n${s}\n`).join('\n');
 const file=path.join(OUT,'film-captions.vtt');fs.writeFileSync(file,vtt);return file;
}
async function main(){
 const emblemSource=await loadImage(path.join(root,'assets/jesus-loves-you-emblem.png'));
 const emblem=createCanvas(emblemSource.width,emblemSource.height),ink=emblem.getContext('2d');
 ink.drawImage(emblemSource,0,0);ink.globalCompositeOperation='source-in';
 ink.fillStyle='#315B54';ink.fillRect(0,0,emblem.width,emblem.height);
 const mode=process.argv[2]||'stills',captions=writeCaptions();
 if(mode==='captions')return console.log(captions);
 for(const[name,[w,h]]of Object.entries(FORMATS)){
  if(mode!=='stills'&&mode!=='audit'&&name!==mode)continue;
  const c=createCanvas(w,h),ctx=c.getContext('2d');
  if(mode==='stills'){
   for(let i=0;i<times.length;i++){OfferFilm.frame(ctx,times[i],w,h,emblem);fs.writeFileSync(path.join(OUT,`${name}-${i}.png`),c.toBuffer('image/png'));}
   const tileW=name==='portrait'?270:480,tileH=h*tileW/w;
   const sheet=createCanvas(4*tileW,2*tileH),sc=sheet.getContext('2d');
   for(let i=0;i<times.length;i++){const im=await loadImage(path.join(OUT,`${name}-${i}.png`));sc.drawImage(im,i%4*tileW,Math.floor(i/4)*tileH,tileW,tileH);}
   fs.writeFileSync(path.join(OUT,`contact-${name}.jpg`),sheet.toBuffer('image/jpeg',91));
   continue;
  }
  const violations=[],minima={left:Infinity,top:Infinity,right:Infinity,bottom:Infinity},byScene={};
  let ff,done;
  if(mode!=='audit'){
   // Captions ride along as a soft subtitle track, so a saved film keeps them.
   const file=path.join(OUT,`offer-filter-${name}.mp4`);
   ff=spawn('ffmpeg',['-nostdin','-y','-v','error','-f','rawvideo','-pixel_format','rgba','-video_size',`${w}x${h}`,'-framerate',String(FPS),'-i','pipe:0','-i',path.join(OUT,'soundtrack.wav'),'-i',captions,'-map','0:v','-map','1:a','-map','2:s','-c:v','libx264','-crf','18','-preset','medium','-tune','animation','-threads','4','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-c:s','mov_text','-metadata:s:s:0','language=eng','-movflags','+faststart','-frames:v',String(FRAMES),'-t',String(DURATION),'-map_metadata','-1',file],{stdio:['pipe','inherit','inherit']});
   done=new Promise((res,rej)=>{ff.on('error',rej);ff.on('exit',code=>code?rej(Error('encoder '+code)):res());});
  }
  for(let f=0;f<FRAMES;f++){
   const records=OfferFilm.frame(ctx,f/FPS,w,h,emblem);
   for(const b of records){
    minima.left=Math.min(minima.left,b.left);minima.top=Math.min(minima.top,b.top);minima.right=Math.min(minima.right,w-b.right);minima.bottom=Math.min(minima.bottom,h-b.bottom);
    byScene[b.scene]=(byScene[b.scene]||0)+1;
    if(b.left<24||b.top<24||b.right>w-24||b.bottom>h-24)violations.push({frame:f,...b});
   }
   if(ff&&!ff.stdin.write(ctx.getImageData(0,0,w,h).data))await new Promise(r=>ff.stdin.once('drain',r));
   if(f%150===0)console.log(`${name}: ${f}/${FRAMES}`);
  }
  if(ff){ff.stdin.end();await done;}
  const report={format:name,width:w,height:h,frames:FRAMES,fps:FPS,duration:DURATION,minimumTextMargins:minima,checkedTextDraws:byScene,violations};
  fs.writeFileSync(path.join(OUT,`${name}-text-validation.json`),JSON.stringify(report,null,2)+'\n');
  if(violations.length)throw Error(`${name}: ${violations.length} text boundary violations; see report`);
  OfferFilm.frame(ctx,POSTER,w,h,emblem);fs.writeFileSync(path.join(OUT,`poster-${name}.jpg`),c.toBuffer('image/jpeg',93));
  console.log(`${name}: finished; all visible text inside safe frame`);
 }
}
main().catch(e=>{console.error(e);process.exitCode=1});
