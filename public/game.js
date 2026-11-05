'use strict';
const $=s=>document.querySelector(s);
const canvas=$('#game'),ctx=canvas.getContext('2d');
const W=400,H=600,LINE=100,FLOOR=588;
const fruits=[
 {name:'第1级图标',r:14,color:'#8972a1',score:1},
 {name:'第2级图标',r:19,color:'#c65357',score:3},
 {name:'第3级图标',r:25,color:'#e49b45',score:6},
 {name:'第4级图标',r:31,color:'#e6cb58',score:10},
 {name:'第5级图标',r:38,color:'#91a864',score:15},
 {name:'第6级图标',r:45,color:'#d56c52',score:21},
 {name:'第7级图标',r:53,color:'#e9a391',score:28},
 {name:'第8级图标',r:62,color:'#d8b54d',score:36},
 {name:'第9级图标',r:71,color:'#a18b63',score:45},
 {name:'第10级图标',r:80,color:'#b5bf7b',score:55},
 {name:'第11级图标',r:91,color:'#5c9562',score:66}
];
const images=Array(11).fill(null);
let bodies=[],particles=[],score=0,current=0,next=0,aim=200,state='running',dropCooldown=0,dangerTime=0,hasWon=false,last=0,accumulator=0,dragging=null,dragX=0;
const randLevel=()=>Math.floor(Math.random()*5);
function clampAim(x){return Math.max(12+fruits[current].r,Math.min(W-12-fruits[current].r,x));}
function paintFruit(c,level,x,y,r,angle=0,artVariant=0){
 const f=fruits[level];c.save();c.translate(x,y);c.rotate(angle);
 if(images[level]){const artwork=images[level],image=Array.isArray(artwork)?artwork[artVariant%artwork.length]:artwork,scale=Math.max(r*2/image.naturalWidth,r*2/image.naturalHeight);c.beginPath();c.arc(0,0,r,0,Math.PI*2);c.clip();c.fillStyle=f.color;c.fillRect(-r,-r,r*2,r*2);c.drawImage(image,-image.naturalWidth*scale/2,-image.naturalHeight*scale/2,image.naturalWidth*scale,image.naturalHeight*scale);c.restore();return;}
 c.shadowColor='#635c3620';c.shadowBlur=4;c.shadowOffsetY=2;c.fillStyle=f.color;c.beginPath();c.arc(0,0,r,0,Math.PI*2);c.fill();c.shadowColor='transparent';
 c.save();c.beginPath();c.arc(0,0,r-.5,0,Math.PI*2);c.clip();
 if(level===10){c.strokeStyle='#356c43';c.lineWidth=r*.09;for(let i=-2;i<=2;i++){c.beginPath();c.moveTo(i*r*.42,-r);c.bezierCurveTo(i*r*.32+r*.18,-r*.3,i*r*.48-r*.18,r*.3,i*r*.42,r);c.stroke();}}
 else if(level===4){c.fillStyle='#e9dca3';c.beginPath();c.arc(0,0,r*.68,0,Math.PI*2);c.fill();c.fillStyle='#768e48';c.beginPath();c.arc(0,0,r*.56,0,Math.PI*2);c.fill();for(let i=0;i<10;i++){const t=i*Math.PI/5;c.fillStyle='#485039';c.beginPath();c.ellipse(Math.cos(t)*r*.37,Math.sin(t)*r*.37,1.5,2.4,t,0,Math.PI*2);c.fill();}}
 else if(level===7||level===9){c.strokeStyle=level===7?'#a98c35':'#d5d9a0';c.lineWidth=1.5;for(let i=-3;i<=3;i++){c.beginPath();c.moveTo(-r,i*r*.4-r);c.lineTo(r,i*r*.4+r);c.moveTo(-r,i*r*.4+r);c.lineTo(r,i*r*.4-r);c.stroke();}}
 else if(level===8){c.strokeStyle='#85714f';c.lineWidth=2;for(let i=-1;i<=1;i++){c.beginPath();c.ellipse(i*r*.3,0,r*.15,r*.95,0,0,Math.PI*2);c.stroke();}}
 else if(level===6){c.strokeStyle='#cb8176';c.lineWidth=2;c.beginPath();c.moveTo(0,-r);c.quadraticCurveTo(-r*.3,0,0,r);c.stroke();}
 c.restore();
 if(![4,8].includes(level)){c.fillStyle='#fffbed60';c.beginPath();c.ellipse(-r*.32,-r*.38,r*.21,r*.1,-.7,0,Math.PI*2);c.fill();}
 if(![4,8,9].includes(level)){c.fillStyle='#527b44';c.beginPath();c.moveTo(0,-r+3);c.quadraticCurveTo(r*.12,-r-r*.35,r*.44,-r-r*.12);c.quadraticCurveTo(r*.32,-r+r*.07,0,-r+3);c.fill();}
 // Faces keep the default fruit set playful, while uploaded art stays untouched.
 if(![4,8].includes(level)){c.fillStyle='#3e523c';const eye=Math.max(1,r*.035);for(const dx of [-.2,.2]){c.beginPath();c.arc(dx*r,r*.12,eye,0,Math.PI*2);c.fill();}c.strokeStyle='#3e523c';c.lineWidth=Math.max(1,r*.022);c.beginPath();c.arc(0,r*.15,r*.12,.25,Math.PI-.25);c.stroke();}
 c.restore();
}
function updateUI(){
 $('#score').textContent=score;
 $('#pause').textContent=state==='paused'?'继续':'暂停';$('#pause').disabled=['over','won'].includes(state);$('#drop').disabled=state!=='running'||dropCooldown>0;$('#left').disabled=state!=='running';$('#right').disabled=state!=='running';
 canvas.setAttribute('aria-label',`当前${fruits[current].name}，得分${score}。左右方向键瞄准，空格投放。`);
}
function showOverlay(label,title,text,button){$('#overlayLabel').textContent=label;$('#overlayTitle').textContent=title;$('#overlayText').textContent=text;$('#continue').textContent=button;$('#overlay').hidden=false;updateUI();}
function restart(){bodies=[];particles=[];score=0;current=randLevel();next=randLevel();aim=200;state='running';dropCooldown=0;dangerTime=0;hasWon=false;dragging=null;accumulator=0;$('#overlay').hidden=true;$('#status').textContent='相同图标碰撞即可合成';updateUI();}
function togglePause(){if(state==='running'){state='paused';dragging=null;showOverlay('休息一下','休息一下，再继续合成。','游戏已暂停。准备好了，就继续合成吧。','继续游戏');}else if(state==='paused'){state='running';$('#overlay').hidden=true;updateUI();}}
function drop(){if(state!=='running'||dropCooldown>0)return;const f=fruits[current];bodies.push({x:clampAim(aim),y:48,r:f.r,level:current,vx:0,vy:0,age:0,angle:0});current=next;next=randLevel();aim=clampAim(aim);dropCooldown=.55;$('#status').textContent=`${f.name}落下了，相同图标碰撞即可合成。`;updateUI();}
function burst(x,y,color){for(let i=0;i<10;i++){const a=i*Math.PI/5;particles.push({x,y,vx:Math.cos(a)*80,vy:Math.sin(a)*80,life:.5,color});}}
function merge(a,b){const level=a.level+1,r=fruits[level].r;const x=Math.max(12+r,Math.min(W-12-r,(a.x+b.x)/2)),y=Math.min(FLOOR-r,(a.y+b.y)/2);bodies=bodies.filter(body=>body!==a&&body!==b);bodies.push({x,y,r,level,artVariant:0,vx:(a.vx+b.vx)*.25,vy:Math.min(0,(a.vy+b.vy)*.25),age:0,angle:0});score+=fruits[level].score;burst(x,y,fruits[level].color);$('#status').textContent=`合成${fruits[level].name}！+${fruits[level].score} 分`;if(level===10&&!hasWon){hasWon=true;state='won';showOverlay('大晏奚达成！','这一颗夏天，属于你。',`你合成了大晏奚！当前得分 ${score}，还可以继续挑战。`,'继续挑战');}updateUI();}
function bounds(b){if(b.x-b.r<12){b.x=12+b.r;b.vx=Math.abs(b.vx)*.22;}if(b.x+b.r>388){b.x=388-b.r;b.vx=-Math.abs(b.vx)*.22;}if(b.y+b.r>FLOOR){b.y=FLOOR-b.r;if(b.vy>0)b.vy=-b.vy*.08;b.vx*=.97;}}
function step(dt){
 dropCooldown=Math.max(0,dropCooldown-dt);
 for(const b of bodies){b.age+=dt;b.vy=Math.min(650,b.vy+1000*dt);b.vx*=.998;b.x+=b.vx*dt;b.y+=b.vy*dt;b.angle+=b.vx*dt/b.r*.3;bounds(b);}
 // Resolve circles in several small passes. Mass grows with fruit area.
 let merged=false;
 for(let pass=0;pass<5;pass++){
 let pair=null;
 outer:for(let i=0;i<bodies.length;i++)for(let j=i+1;j<bodies.length;j++){
 const a=bodies[i],b=bodies[j],dx=b.x-a.x,dy=b.y-a.y,dist=Math.hypot(dx,dy),sum=a.r+b.r;
 if(dist>=sum)continue;
 if(!merged&&a.level===b.level&&a.level<10){pair=[a,b];break outer;}
 const nx=dist>.001?dx/dist:0,ny=dist>.001?dy/dist:1,penetration=sum-dist;
 const ia=1/(a.r*a.r),ib=1/(b.r*b.r),inv=ia+ib;
 a.x-=nx*penetration*ia/inv;a.y-=ny*penetration*ia/inv;b.x+=nx*penetration*ib/inv;b.y+=ny*penetration*ib/inv;
 const relative=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;
 if(relative<0){const impulse=-(1.06)*relative/inv;a.vx-=impulse*ia*nx;a.vy-=impulse*ia*ny;b.vx+=impulse*ib*nx;b.vy+=impulse*ib*ny;}
 a.vx*=.99;b.vx*=.99;
 }
 if(pair){merge(...pair);merged=true;}for(const b of bodies)bounds(b);
 }
 for(const p of particles){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=200*dt;}particles=particles.filter(p=>p.life>0);
 const danger=bodies.some(b=>b.age>1.25&&b.y-b.r<LINE);
 dangerTime=danger?dangerTime+dt:0;
 if(dangerTime>=2&&state==='running'){state='over';dragging=null;$('#status').textContent=`本局结束，得分 ${score}。再试一次吧！`;showOverlay('图标装满啦','差一点，就有新惊喜。',`本局获得 ${score} 分。让大图标落在底部，给新图标留些空间。`,'再来一局');}
 $('#drop').disabled=state!=='running'||dropCooldown>0;
}
function draw(){ctx.clearRect(0,0,W,H);ctx.fillStyle='#fff5d7';ctx.fillRect(0,0,W,H);
 ctx.fillStyle='#d6c79520';for(let y=120;y<590;y+=26)for(let x=25;x<400;x+=26){ctx.beginPath();ctx.arc(x,y,1,0,Math.PI*2);ctx.fill();}
 ctx.strokeStyle=dangerTime>0?'#c57455':'#cabc8d';ctx.lineWidth=1.5;ctx.setLineDash([5,5]);ctx.beginPath();ctx.moveTo(13,LINE);ctx.lineTo(387,LINE);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle=dangerTime>0?'#b45942':'#a4986e';ctx.font='10px sans-serif';ctx.fillText(dangerTime>0?`即将装满 · ${Math.max(0,2-dangerTime).toFixed(1)} 秒`:'请别让图标越过这条线',20,LINE-9);
 ctx.fillStyle='#d5dcb7';ctx.fillRect(0,0,10,H);ctx.fillRect(390,0,10,H);ctx.fillRect(0,FLOOR,W,12);ctx.fillStyle='#bccb99';ctx.fillRect(8,FLOOR,384,4);
 for(const b of bodies)paintFruit(ctx,b.level,b.x,b.y,b.r,b.angle,b.artVariant);
 for(const p of particles){ctx.globalAlpha=Math.max(0,p.life*2);ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,3,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;
 if(state==='running'){const r=fruits[current].r;ctx.strokeStyle='#a6b48480';ctx.setLineDash([3,6]);ctx.beginPath();ctx.moveTo(aim,48+r+6);ctx.lineTo(aim,575);ctx.stroke();ctx.setLineDash([]);ctx.globalAlpha=dropCooldown>0?.4:1;paintFruit(ctx,current,aim,48,r);ctx.globalAlpha=1;}
}
function frame(time){if(!last)last=time;const elapsed=Math.min((time-last)/1000,.05);last=time;if(state==='running'){accumulator+=elapsed;while(accumulator>=1/120&&state==='running'){step(1/120);accumulator-=1/120;}}else accumulator=0;draw();requestAnimationFrame(frame);}
function resize(){const dpr=Math.min(window.devicePixelRatio||1,2),rect=canvas.getBoundingClientRect();canvas.width=Math.round(rect.width*dpr);canvas.height=Math.round(rect.height*dpr);ctx.setTransform(canvas.width/W,0,0,canvas.height/H,0,0);draw();}
function pointerAim(e){const rect=canvas.getBoundingClientRect();aim=clampAim((e.clientX-rect.left)/rect.width*W);}
canvas.addEventListener('pointerdown',e=>{if(state!=='running'||dragging!==null||e.button>0)return;e.preventDefault();canvas.focus({preventScroll:true});dragging=e.pointerId;dragX=aim;pointerAim(e);canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{if(state!=='running')return;if(dragging===e.pointerId||e.pointerType==='mouse'&&dragging===null)pointerAim(e);});
canvas.addEventListener('pointerup',e=>{if(dragging!==e.pointerId)return;pointerAim(e);dragging=null;drop();});
canvas.addEventListener('pointercancel',()=>{dragging=null;aim=clampAim(dragX);});
canvas.addEventListener('lostpointercapture',()=>{dragging=null;});
$('#drop').addEventListener('click',drop);$('#left').addEventListener('click',()=>{aim=clampAim(aim-22);});$('#right').addEventListener('click',()=>{aim=clampAim(aim+22);});
$('#pause').addEventListener('click',togglePause);$('#restart').addEventListener('click',restart);
$('#continue').addEventListener('click',()=>{if(state==='over')restart();else{state='running';$('#overlay').hidden=true;updateUI();}canvas.focus({preventScroll:true});});
window.addEventListener('keydown',e=>{if(e.target.matches('input,button,a,summary'))return;if(['ArrowLeft','ArrowRight','Space','Enter','KeyP'].includes(e.code)){e.preventDefault();if(e.code==='KeyP'&&!e.repeat)togglePause();if(state!=='running')return;if(e.code==='ArrowLeft')aim=clampAim(aim-16);if(e.code==='ArrowRight')aim=clampAim(aim+16);if((e.code==='Space'||e.code==='Enter')&&!e.repeat)drop();}});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&state==='running')togglePause();});
// Uploaded artwork is the default set; administrators can override individual levels.
const defaultArtwork = [0,1,2,3,4,5,6,7,8,9];
async function loadDefaultImages(){
 await Promise.all(defaultArtwork.map(index => new Promise(resolve => {
  const image = new Image();
  image.onload = () => { images[index] = image; resolve(); };
  image.onerror = resolve;
  image.src = index === 0 ? '/assets/fruits/grape.png' : index === 9 ? '/assets/fruits/12.png' : `/assets/fruits/${index}.png`;
 })));
 const finalArtwork = await Promise.all([0].map(index => new Promise(resolve => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => resolve(null);
  image.src = `/assets/fruits/${index}.png`;
 })));
 const loaded = finalArtwork.filter(Boolean);
 if (loaded.length) images[10] = loaded;
 draw();
}
async function loadPublishedImages(){
 try{
  const response=await fetch('/api/fruit-images',{cache:'no-store'});
  if(!response.ok)return;
  const {images:published}=await response.json();
  if(!Array.isArray(published))return;
  await Promise.all(published.map(async(entry)=>{
   if(!Number.isInteger(entry.level)||entry.level<1||entry.level>11||typeof entry.url!=='string'||!entry.url.startsWith('/api/fruit-images/'))return;
   await new Promise(resolve=>{const image=new Image();image.onload=()=>{images[entry.level-1]=image;draw();resolve();};image.onerror=resolve;image.src=entry.url;});
  }));
 }catch{/* Default fruit art keeps the game playable when custom art is unavailable. */}
}
window.addEventListener('resize',resize);restart();resize();requestAnimationFrame(frame);loadDefaultImages().then(loadPublishedImages);
