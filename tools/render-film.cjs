#!/usr/bin/env node
const fs=require('fs'),path=require('path'),{spawn}=require('child_process');
let canvas;try{canvas=require('@napi-rs/canvas')}catch(e){if(!process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES)throw e;canvas=require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'@napi-rs/canvas'));}
const {createCanvas,GlobalFonts,loadImage,Path2D}=canvas;global.Path2D=Path2D;
const root=path.resolve(__dirname,'..');
for(const[file,name]of[['Baloo2.ttf','Baloo 2'],['AtkinsonHyperlegible-Regular.ttf','Atkinson Hyperlegible']]){if(!GlobalFonts.registerFromPath(path.join(root,'assets',file),name))throw Error('Font failed: '+file);}
require('../assets/brand.js');require('./film/film.js');
const FORMATS={landscape:[1920,1080],portrait:[1080,1920],square:[1080,1080]};
const OUT=path.resolve(process.argv[3]||'/tmp/offer-filter-film');fs.mkdirSync(OUT,{recursive:true});
const times=[1.1,2.9,5.8,8.3,10.5,12.9,15.8,19.6];
async function main(){
 const emblemSource=await loadImage(path.join(root,'assets/jesus-loves-you-emblem.png'));
 const emblem=createCanvas(emblemSource.width,emblemSource.height),ink=emblem.getContext('2d');
 ink.drawImage(emblemSource,0,0);ink.globalCompositeOperation='source-in';
 ink.fillStyle='#315B54';ink.fillRect(0,0,emblem.width,emblem.height);
 const mode=process.argv[2]||'stills';
 for(const[name,[w,h]]of Object.entries(FORMATS)){
  if(mode!=='stills'&&mode!=='audit'&&name!==mode)continue;
  const c=createCanvas(w,h),ctx=c.getContext('2d');
  if(mode==='stills'){
   for(let i=0;i<times.length;i++){OfferFilm.frame(ctx,times[i],w,h,emblem);fs.writeFileSync(path.join(OUT,`${name}-${i}.png`),c.toBuffer('image/png'));}
   const columns=name==='portrait'?4:4,tileW=name==='portrait'?270:480,tileH=h*tileW/w;
   const sheet=createCanvas(columns*tileW,2*tileH),sc=sheet.getContext('2d');
   for(let i=0;i<times.length;i++){const im=await loadImage(path.join(OUT,`${name}-${i}.png`));sc.drawImage(im,i%4*tileW,Math.floor(i/4)*tileH,tileW,tileH);}
   fs.writeFileSync(path.join(OUT,`contact-${name}.jpg`),sheet.toBuffer('image/jpeg',91));
   continue;
  }
  const violations=[],minima={left:Infinity,top:Infinity,right:Infinity,bottom:Infinity},byScene={};
  let ff,done;
  if(mode!=='audit'){
   const file=path.join(OUT,`offer-filter-${name}.mp4`);
   ff=spawn('ffmpeg',['-nostdin','-y','-v','error','-f','rawvideo','-pixel_format','rgba','-video_size',`${w}x${h}`,'-framerate','30','-i','pipe:0','-i',path.join(OUT,'soundtrack.wav'),'-c:v','libx264','-crf','18','-preset','medium','-threads','4','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-movflags','+faststart','-frames:v','630','-t','21','-map_metadata','-1',file],{stdio:['pipe','inherit','inherit']});
   done=new Promise((res,rej)=>{ff.on('error',rej);ff.on('exit',code=>code?rej(Error('encoder '+code)):res());});
  }
  for(let f=0;f<630;f++){
   const records=OfferFilm.frame(ctx,f/30,w,h,emblem);
   for(const b of records){
    minima.left=Math.min(minima.left,b.left);minima.top=Math.min(minima.top,b.top);minima.right=Math.min(minima.right,w-b.right);minima.bottom=Math.min(minima.bottom,h-b.bottom);
    byScene[b.scene]=(byScene[b.scene]||0)+1;
    if(b.left<24||b.top<24||b.right>w-24||b.bottom>h-24)violations.push({frame:f,...b});
   }
   if(ff&&!ff.stdin.write(ctx.getImageData(0,0,w,h).data))await new Promise(r=>ff.stdin.once('drain',r));
   if(f%150===0)console.log(`${name}: ${f}/630`);
  }
  if(ff){ff.stdin.end();await done;}
  const report={format:name,width:w,height:h,frames:630,fps:30,duration:21,minimumTextMargins:minima,checkedTextDraws:byScene,violations};
  fs.writeFileSync(path.join(OUT,`${name}-text-validation.json`),JSON.stringify(report,null,2)+'\n');
  if(violations.length)throw Error(`${name}: ${violations.length} text boundary violations; see report`);
  OfferFilm.frame(ctx,19.6,w,h,emblem);fs.writeFileSync(path.join(OUT,`poster-${name}.jpg`),c.toBuffer('image/jpeg',93));
  console.log(`${name}: finished; all visible text inside safe frame`);
 }
}
main().catch(e=>{console.error(e);process.exitCode=1});
