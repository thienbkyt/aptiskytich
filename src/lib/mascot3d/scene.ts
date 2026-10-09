// @ts-nocheck
/* Cảnh 3D Kỳ Kỳ & Tích Tích (three.js r128 nạp từ CDN, window.THREE).
   Sinh từ bản mockup Mascot_3D — không chỉnh tay phần hình học. */
export function initMascot3D(wrap, opts) {
opts=opts||{};const THREE=window.THREE;
const T=THREE;
const renderer=new T.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(2,window.devicePixelRatio||1));
renderer.outputEncoding=T.sRGBEncoding;
renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=0.92;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
wrap.appendChild(renderer.domElement);
// setSize(...,false) không đặt kích thước CSS → máy màn Retina (DPR 2) canvas bị phóng gấp đôi. Ép theo khung.
renderer.domElement.style.width='100%';renderer.domElement.style.height='100%';renderer.domElement.style.display='block';
const scene=new T.Scene();
const BG_DAY=new T.Color('#FFF3EA'),BG_NIGHT=new T.Color('#1d1236');
scene.background=opts.transparent?null:BG_DAY.clone();
const camera=new T.PerspectiveCamera(32,1,0.1,100);

// ---------- môi trường phản chiếu (studio) ----------
const pm=new T.PMREMGenerator(renderer);
function studio(){
  const s=new T.Scene();
  const g=new T.SphereGeometry(20,32,16);
  const cols=[];const p=g.attributes.position;
  for(let i=0;i<p.count;i++){const y=p.getY(i)/20;const c=new T.Color().lerpColors(new T.Color('#6e6878'),new T.Color('#d8d4de'),(y+1)/2);cols.push(c.r,c.g,c.b);}
  g.setAttribute('color',new T.Float32BufferAttribute(cols,3));
  s.add(new T.Mesh(g,new T.MeshBasicMaterial({side:T.BackSide,vertexColors:true})));
  const box=(w,h,x,y,z,c,i)=>{const m=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({color:new T.Color(c).multiplyScalar(i),side:T.DoubleSide}));m.position.set(x,y,z);m.lookAt(0,0,0);s.add(m);};
  box(10,6,-8,10,8,'#ffffff',2.2);box(8,8,10,4,6,'#fff3e6',1.2);box(14,4,0,-6,-12,'#ffe0c4',0.6);box(6,12,-12,2,-6,'#ffffff',0.9);
  return pm.fromScene(s,0.02).texture;
}
scene.environment=studio();

scene.add(new T.HemisphereLight('#ffffff','#f3d9c8',0.35));
const key=new T.DirectionalLight('#ffffff',1.15);key.position.set(-2,10,5);key.castShadow=true;
key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-6;key.shadow.camera.right=6;key.shadow.camera.top=6;key.shadow.camera.bottom=-2;key.shadow.radius=6;key.shadow.bias=-0.0004;
scene.add(key);
const rim=new T.DirectionalLight('#ffd7b0',0.5);rim.position.set(4,4,-5);scene.add(rim);
const ground=new T.Mesh(new T.PlaneGeometry(40,40),new T.ShadowMaterial({opacity:0.12}));
ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);

// ---------- helpers ----------
function superEllipsoid(w,h,d,e,seg){
  seg=seg||48;const g=new T.SphereGeometry(1,seg,Math.round(seg*0.75));const p=g.attributes.position;
  const sp=(v)=>Math.sign(v)*Math.pow(Math.abs(v),e);
  for(let i=0;i<p.count;i++){p.setXYZ(i,sp(p.getX(i))*w/2,sp(p.getY(i))*h/2,sp(p.getZ(i))*d/2);}
  g.computeVertexNormals();return g;
}
function gradient(geo,c1,c2,f){const p=geo.attributes.position;const a=new T.Color(c1),b=new T.Color(c2);const cols=[];
  let mn=1e9,mx=-1e9;for(let i=0;i<p.count;i++){const v=f(p.getX(i),p.getY(i),p.getZ(i));mn=Math.min(mn,v);mx=Math.max(mx,v);}
  for(let i=0;i<p.count;i++){const t=(f(p.getX(i),p.getY(i),p.getZ(i))-mn)/(mx-mn||1);const c=a.clone().lerp(b,t).convertSRGBToLinear();cols.push(c.r,c.g,c.b);}
  geo.setAttribute('color',new T.Float32BufferAttribute(cols,3));return geo;}
const M=(o)=>new T.MeshPhysicalMaterial(Object.assign({roughness:.3,metalness:0,clearcoat:1,clearcoatRoughness:.08,envMapIntensity:1},o));
const mPorc=M({color:'#F8F7FB',roughness:.32,clearcoatRoughness:.12});
const mOrange=M({vertexColors:true,color:'#ffffff',roughness:.28});
const mOrangeSolid=M({color:'#FF7A1A',roughness:.28});
const mVisor=M({color:'#FFFFFF',roughness:.12,clearcoatRoughness:.03});
const mInk=M({color:'#24104f',roughness:.15});
const mWhite=new T.MeshBasicMaterial({color:'#ffffff'});
const mWhiteEye=M({color:'#EEEAF4',roughness:.2});
const mCheek=new T.MeshStandardMaterial({color:'#FF8FA3',roughness:.6,transparent:true,opacity:.55});
const mMouth=M({color:'#E8571A',roughness:.25});
const mPink=M({color:'#FF5C8A',roughness:.3});
const mRed=M({color:'#CC1C01',roughness:.3});
const mBear=new T.MeshStandardMaterial({color:'#9A5B32',roughness:.85});
const mBearL=new T.MeshStandardMaterial({color:'#E3BC92',roughness:.85});
const mDark=new T.MeshStandardMaterial({color:'#2b1608',roughness:.4});
const mBearBow=M({color:'#E0242E',roughness:.35});
function mesh(g,m,x,y,z,parent){const o=new T.Mesh(g,m);o.position.set(x||0,y||0,z||0);o.castShadow=true;o.receiveShadow=true;(parent||scene).add(o);return o;}
const sph=(r,s)=>new T.SphereGeometry(r,s||40,Math.round((s||40)*0.75));
function textTex(txt,color,bg,font){const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d');
  if(bg){x.fillStyle=bg;x.beginPath();x.arc(128,128,128,0,7);x.fill();}
  x.fillStyle=color;x.font=font||'900 170px "Arial Black",Arial,sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillText(txt,128,140);
  const t=new T.CanvasTexture(c);t.encoding=T.sRGBEncoding;t.anisotropy=8;return t;}
function tube(points,r,mat,parent){const c=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));const m=mesh(new T.TubeGeometry(c,40,r,10,false),mat,0,0,0,parent);return m;}
// đặt decal lên mặt ellipsoid (cx,cy,cz,rx,ry,rz)
function onEll(obj,E,x,y,lift){const [cx,cy,cz,rx,ry,rz]=E;const u=1-((x-cx)/rx)**2-((y-cy)/ry)**2;const z=cz+rz*Math.sqrt(Math.max(0,u));
  obj.position.set(x,y,z+(lift||0));const n=new T.Vector3((x-cx)/(rx*rx),(y-cy)/(ry*ry),(z-cz)/(rz*rz)).normalize();
  obj.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),n);return obj;}
function heart(s,mat){const sh=new T.Shape();sh.moveTo(0,-0.6);sh.bezierCurveTo(-1.2,0.1,-0.8,1.0,0,0.45);sh.bezierCurveTo(0.8,1.0,1.2,0.1,0,-0.6);
  const g=new T.ExtrudeGeometry(sh,{depth:.25,bevelEnabled:true,bevelThickness:.12,bevelSize:.12,bevelSegments:4,curveSegments:16});g.center();g.scale(s,s,s);return new T.Mesh(g,mat);}
function arcEye(r,tube_,mat){const g=new T.TorusGeometry(r,tube_,12,24,Math.PI);return new T.Mesh(g,mat);}
function witchHat(scale){const g=new T.Group();
  const mHat=M({color:'#4B2E8F',roughness:.45,clearcoat:.4});const mBrim=M({color:'#3A2470',roughness:.45,clearcoat:.4});
  const brim=mesh(new T.CylinderGeometry(1.05,1.05,.06,48),mBrim,0,0,0,g);
  const pts=[];for(let i=0;i<=20;i++){const t=i/20;pts.push(new T.Vector2(0.62*(1-t)+0.02,t*1.5));}
  const cone=mesh(new T.LatheGeometry(pts,48),mHat,0,0.02,0,g);cone.geometry.translate(0,0,0);
  // chóp gập
  const tip=tube([[0,1.45,0],[0.12,1.62,0],[0.38,1.68,0.02]],0.045,mHat,g);
  const band=mesh(new T.CylinderGeometry(0.585,0.6,.16,48,1,true),M({color:'#FF7A1A',side:T.DoubleSide}),0,0.16,0,g);
  const star=mesh(new T.OctahedronGeometry(.07),M({color:'#FFC531',emissive:'#7a5200'}),0,0.62,0.4,g);
  g.scale.setScalar(scale);g.userData.hw=true;g.visible=false;return g;}
function pumpkin(s){const g=new T.Group();const mP=M({color:'#FF8A1E',roughness:.35});
  for(let i=0;i<6;i++){const a=i/6*Math.PI*2;const o=mesh(sph(.5,32),mP,Math.cos(a)*.22,0,Math.sin(a)*.22,g);o.scale.set(.62,.85,.62);}
  mesh(new T.CylinderGeometry(.05,.07,.25,10),M({color:'#3E7D2C'}),0,.5,0,g);
  const mF=new T.MeshBasicMaterial({color:'#3a1500'});
  const eye=new T.ConeGeometry(.09,.14,3);
  const e1=mesh(eye,mF,-.16,.08,.55,g);const e2=mesh(eye,mF,.16,.08,.55,g);
  const mo=mesh(new T.TorusGeometry(.2,.04,8,20,Math.PI),mF,0,-.08,.55,g);mo.rotation.z=Math.PI;
  g.scale.setScalar(s);g.userData.hw=true;g.visible=false;return g;}

// ====================== KỲ KỲ ======================
const KK=new T.Group();scene.add(KK);KK.position.x=-1.55;
const P=(xs,ys)=>[(xs-60)/40,(146-ys)/40];
const kkFloat=new T.Group();KK.add(kkFloat);
// thân
const kBody=mesh(sph(1,56),mPorc,0,P(0,114)[1],0,kkFloat);kBody.scale.set(.64,.52,.56);
// huy hiệu K — gắn phẳng trên ngực như chữ "A" của Tích Tích
const ringE=[0,P(0,114)[1],0,.64,.52,.56];
const ring=new T.Group();kkFloat.add(ring);
{const base=mesh(sph(1,48),M({color:'#FBFAFC',roughness:.22}),0,0,0,ring);base.scale.set(.2,.2,.05);
 mesh(new T.TorusGeometry(.2,.03,16,56),mOrangeSolid,0,0,0.012,ring);
 const k=mesh(new T.PlaneGeometry(.3,.3),new T.MeshBasicMaterial({map:textTex('K','#EE6510'),transparent:true}),0,-.004,0.052,ring);k.castShadow=false;}
onEll(ring,ringE,0,P(0,112)[1],0.0);
// tay
const kHandR=mesh(sph(.17),mOrange,0.7,0.62,0.32,kkFloat);gradient(kHandR.geometry,'#FFB24A','#E8500C',(x,y)=>-y);
// đầu
const kHead=new T.Group();kHead.position.set(0,P(0,80)[1],0);kkFloat.add(kHead);
const hy=P(0,58)[1]-kHead.position.y;
const HE=[0,hy,0,1.175,1.05,1.0];
const shell=mesh(sph(1,64),mPorc,0,hy,0,kHead);shell.scale.set(1.175,1.05,1.0);
for(const sx of [-1,1]){const ear=mesh(sph(.29),mOrange,sx*.8,P(0,25)[1]-kHead.position.y,-0.05,kHead);gradient(ear.geometry,'#FFB24A','#EA560C',(x,y)=>-y);
  const inner=mesh(sph(.17),M({color:'#FFE0B0',roughness:.4}),sx*.8,P(0,26)[1]-kHead.position.y,0.16,kHead);inner.scale.z=.35;}
// viền cam + kính mặt
const fy=P(0,61)[1]-kHead.position.y;
const rimM=mesh(sph(1,56),mOrange,0,fy,0.8,kHead);rimM.scale.set(.875,.675,.24);gradient(rimM.geometry,'#FF9A2E','#F2600E',(x,y)=>-y);
const VE=[0,fy,0.84,.79,.59,.22];
const visor=mesh(sph(1,56),mVisor,0,fy,0.84,kHead);visor.scale.set(.79,.59,.22);
// mắt
const kFace=new T.Group();kHead.add(kFace);
const kEyes=new T.Group();kFace.add(kEyes);
const kPupils=[];
for(const sx of [-1,1]){const ex=sx*(13/40),ey=P(0,60)[1]-kHead.position.y;
  const eg=new T.Group();onEll(eg,VE,ex,ey,0.0);kEyes.add(eg);
  const w=mesh(sph(1,32),mWhiteEye,0,0,0,eg);w.scale.set(.235,.27,.05);
  const pg=new T.Group();eg.add(pg);pg.position.z=.03;kPupils.push(pg);
  const pu=mesh(sph(1,32),mInk,0,0,0,pg);pu.scale.set(.185,.22,.05);
  mesh(sph(.065,16),mWhite,.065,.085,.045,pg);mesh(sph(.03,12),mWhite,-.06,-.08,.045,pg);
  // mi
  for(const [lx,ly,a] of [[.17,.17,0.6],[.215,.07,0.25]]){const l=mesh(new T.CylinderGeometry(.018,.018,.11,8),mInk,sx*lx,ly,.02,eg);l.rotation.z=-sx*a-sx*0.9;}
}
// mắt cười (happy)
const kHappy=new T.Group();kFace.add(kHappy);kHappy.visible=false;
for(const sx of [-1,1]){const a=arcEye(.16,.035,mInk);const g=new T.Group();onEll(g,VE,sx*(13/40),P(0,60)[1]-kHead.position.y,0.02);g.add(a);a.position.y=-.06;kHappy.add(g);}
// tim
const kLove=new T.Group();kFace.add(kLove);kLove.visible=false;
for(const sx of [-1,1]){const h=heart(.19,M({color:'#FF4F6E',roughness:.25}));const g=new T.Group();onEll(g,VE,sx*(13/40),P(0,60)[1]-kHead.position.y,0.03);g.add(h);kLove.add(g);}
// má
for(const sx of [-1,1]){const c=mesh(sph(1,24),mCheek,0,0,0,kFace);c.scale.set(.13,.09,.02);onEll(c,VE,sx*.6,P(0,71)[1]-kHead.position.y,0.0);c.castShadow=false;}
// miệng
const kSmile=new T.Group();kFace.add(kSmile);
{const g=new T.Group();onEll(g,VE,0,P(0,74)[1]-kHead.position.y,0.015);const m=mesh(new T.TorusGeometry(.12,.028,10,24,Math.PI*.8),mMouth,0,.05,0,g);m.rotation.z=Math.PI+Math.PI*.1;kSmile.add(g);}
const kOpen=new T.Group();kFace.add(kOpen);kOpen.visible=false;
{const g=new T.Group();onEll(g,VE,0,P(0,76)[1]-kHead.position.y,0.01);const sh=new T.Shape();sh.moveTo(-.16,.06);sh.quadraticCurveTo(0,.08,.16,.06);sh.quadraticCurveTo(.14,-.2,0,-.2);sh.quadraticCurveTo(-.14,-.2,-.16,.06);
 const m=new T.Mesh(new T.ExtrudeGeometry(sh,{depth:.02,bevelEnabled:true,bevelSize:.012,bevelThickness:.012,bevelSegments:3}),mMouth);g.add(m);
 const t=mesh(sph(1,16),M({color:'#FF95A6'}),0,-.12,.03,g);t.scale.set(.08,.04,.02);kOpen.add(g);}
const kO=new T.Group();kFace.add(kO);kO.visible=false;
{const g=new T.Group();onEll(g,VE,0,P(0,76)[1]-kHead.position.y,0.01);const m=mesh(sph(1,20),mMouth,0,0,0,g);m.scale.set(.1,.12,.03);kO.add(g);}
// vệt sáng trên kính
{const g=new T.Group();onEll(g,VE,-.55,fy+.33,0.012);const m=mesh(new T.TorusGeometry(.32,.012,8,24,Math.PI*.35),new T.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:.85}),0,0,0,g);m.rotation.z=Math.PI*.55;kHead.add(g);}
// nơ cam
const kBow=new T.Group();kHead.add(kBow);
{const by=P(0,34)[1]-kHead.position.y;kBow.position.set(.83,by,.42);kBow.rotation.set(-.3,.6,-.35);
 for(const sx of [-1,1]){const l=mesh(sph(1,24),mOrange,sx*.12,0,0,kBow);l.scale.set(.13,.09,.06);gradient(l.geometry,'#FFB24A','#F05A0C',(x,y)=>-y);}
 mesh(sph(.055,16),mOrangeSolid,0,0,.02,kBow);}
// dây ăng-ten
const kWires=new T.Group();kHead.add(kWires);
{const o=kHead.position.y;const mW=M({color:'#EDEBF2',roughness:.3});
 const w1=[[-.3,P(0,22)[1]-o,0],[-.45,P(0,8)[1]-o,-.02],[-.6,P(0,-6)[1]-o,0]];
 const w2=[[-.17,P(0,19)[1]-o,.05],[-.22,P(0,4)[1]-o,.02],[-.27,P(0,-10)[1]-o,.02]];
 for(const w of [w1,w2]){tube(w,.02,mW,kWires);const tp=w[2];const cap=mesh(new T.CylinderGeometry(.05,.05,.16,16),mPorc,tp[0],tp[1]+.06,tp[2],kWires);mesh(sph(.04,12),M({color:'#FFAA22',emissive:'#ff7a00',emissiveIntensity:.4}),tp[0],tp[1]+.15,tp[2],kWires);}}
// gấu bông
const bear=new T.Group();kkFloat.add(bear);bear.position.set(-.74,.66,.42);bear.rotation.set(0,.35,-.18);
{mesh(sph(.3),mBear,0,-.18,0,bear).scale.set(1,.95,.85);const bl=mesh(sph(.17),mBearL,0,-.16,.17,bear);bl.scale.z=.5;
 mesh(sph(.27),mBear,0,.22,0,bear);for(const sx of [-1,1]){mesh(sph(.1),mBear,sx*.21,.42,-.02,bear);const ie=mesh(sph(.055),mBearL,sx*.21,.42,.05,bear);ie.scale.z=.5;
   mesh(sph(.035,12),mDark,sx*.09,.27,.24,bear);mesh(sph(.1),mBear,sx*.27,-.12,.1,bear);mesh(sph(.11),mBear,sx*.15,-.42,.08,bear);}
 const mz=mesh(sph(.12),mBearL,0,.15,.2,bear);mz.scale.set(1,.8,.6);mesh(sph(.04,12),mDark,0,.19,.27,bear);
 for(const sx of [-1,1]){const b=mesh(sph(.07),mBearBow,sx*.08,-.01,.24,bear);b.scale.set(1,.7,.6);}mesh(sph(.035),mBearBow,0,-.01,.26,bear);}
const kHandL=mesh(sph(.17),mOrange,-.38,.36,.62,kkFloat);gradient(kHandL.geometry,'#FFB24A','#E8500C',(x,y)=>-y);
// halloween KK
const kHat=witchHat(.85);kHat.position.set(.05,P(0,22)[1]-kHead.position.y,.0);kHat.rotation.set(-.1,0,-.12);kHead.add(kHat);
const kPump=pumpkin(.32);kPump.position.set(.86,.38,.42);kkFloat.add(kPump);

// ====================== TÍCH TÍCH ======================
const TT=new T.Group();scene.add(TT);TT.position.x=1.55;
const Q=(ys)=>(129-ys)/40;
const ttFloat=new T.Group();TT.add(ttFloat);
const OR1='#FEAD5F',OR2='#CC1C01';
const tBodyG=gradient(superEllipsoid(1.3,.78,.95,.32),OR1,OR2,(x,y)=>x*.4-y);
const tBody=mesh(tBodyG,mOrange,0,Q(109),0,ttFloat);
{const b=mesh(superEllipsoid(.5,.3,.08,.3),M({color:'#ffffff',roughness:.25}),0,Q(108),.47,ttFloat);
 const a=mesh(new T.PlaneGeometry(.26,.26),new T.MeshBasicMaterial({map:textTex('A','#CC1C01'),transparent:true}),0,Q(108)-.005,.515,ttFloat);a.castShadow=false;}
const tHandL=mesh(gradient(superEllipsoid(.36,.56,.42,.45),OR1,OR2,(x,y)=>-y),mOrange,-.79,Q(109),0.05,ttFloat);tHandL.rotation.z=.12;
const tHandR=mesh(gradient(superEllipsoid(.36,.56,.42,.45),OR1,OR2,(x,y)=>-y),mOrange,.79,Q(109),0.05,ttFloat);tHandR.rotation.z=-.12;
const tHead=new T.Group();tHead.position.set(0,Q(80),0);ttFloat.add(tHead);
const thy=Q(59)-tHead.position.y;
mesh(gradient(superEllipsoid(2.2,1.75,1.55,.42,64),OR1,OR2,(x,y)=>x*.35-y),mOrange,0,thy,0,tHead);
for(const sx of [-1,1]){const e=mesh(superEllipsoid(.26,.52,.42,.5),mRed,sx*1.15,thy,0,tHead);}
const tFace=mesh(gradient(superEllipsoid(1.72,1.17,.3,.38,56),'#FFFFFF','#EFE7EE',(x,y)=>-y),M({vertexColors:true,color:'#ffffff',roughness:.12,clearcoatRoughness:.03}),0,thy,.66,tHead);
const FZ=.66+.15;
const tFaceG=new T.Group();tHead.add(tFaceG);
const tEyes=new T.Group();tFaceG.add(tEyes);const tPupils=[];
for(const sx of [-1,1]){const eg=new T.Group();eg.position.set(sx*.35,Q(58)-tHead.position.y,FZ);tEyes.add(eg);
  const pg=new T.Group();eg.add(pg);tPupils.push(pg);
  const pu=mesh(sph(1,32),mInk,0,0,0,pg);pu.scale.set(.19,.225,.05);
  mesh(sph(.06,16),mWhite,.065,.09,.04,pg);mesh(sph(.028,12),mWhite,-.05,-.08,.04,pg);
  for(const [lx,ly,a] of [[.17,.18,.5],[.11,.25,.15]]){const l=mesh(new T.CylinderGeometry(.016,.016,.11,8),mInk,sx*lx,ly,.01,eg);l.rotation.z=-sx*(a+.9);}}
const tHappy=new T.Group();tFaceG.add(tHappy);tHappy.visible=false;
for(const sx of [-1,1]){const a=arcEye(.17,.035,mInk);a.position.set(sx*.35,Q(58)-tHead.position.y-.06,FZ+.02);tHappy.add(a);}
const tLove=new T.Group();tFaceG.add(tLove);tLove.visible=false;
for(const sx of [-1,1]){const h=heart(.2,M({color:'#FF3D6E',roughness:.25}));h.position.set(sx*.35,Q(58)-tHead.position.y,FZ+.04);tLove.add(h);}
for(const sx of [-1,1]){const c=mesh(sph(1,24),mCheek,sx*.625,Q(72)-tHead.position.y,FZ-.005,tFaceG);c.scale.set(.12,.1,.02);c.castShadow=false;}
const tSmile=new T.Group();tFaceG.add(tSmile);
{const m=mesh(new T.TorusGeometry(.12,.026,10,24,Math.PI*.8),mRed,0,Q(74)-tHead.position.y,FZ+.01,tSmile);m.rotation.z=Math.PI+Math.PI*.1;}
const tOpen=new T.Group();tFaceG.add(tOpen);tOpen.visible=false;
{const sh=new T.Shape();sh.moveTo(-.25,.05);sh.quadraticCurveTo(0,.06,.25,.05);sh.quadraticCurveTo(0,-.35,-.25,.05);
 const m=new T.Mesh(new T.ExtrudeGeometry(sh,{depth:.02,bevelEnabled:true,bevelSize:.012,bevelThickness:.012,bevelSegments:3}),mRed);m.position.set(0,Q(71)-tHead.position.y,FZ);tOpen.add(m);
 const t=mesh(sph(1,16),M({color:'#FF8FA3'}),0,Q(77)-tHead.position.y,FZ+.03,tOpen);t.scale.set(.09,.04,.02);}
const tO=new T.Group();tFaceG.add(tO);tO.visible=false;
{const m=mesh(sph(1,20),mRed,0,Q(75)-tHead.position.y,FZ+.01,tO);m.scale.set(.11,.15,.03);}
const tAnt=new T.Group();tHead.add(tAnt);
mesh(new T.CylinderGeometry(.04,.05,.36,12),mRed,0,Q(20)-tHead.position.y,0,tAnt);
mesh(sph(.13),M({color:OR1,emissive:'#ff7a20',emissiveIntensity:.25}),0,Q(11)-tHead.position.y,0,tAnt);
const tBow=new T.Group();tHead.add(tBow);tBow.position.set(.72,thy+.86,.42);tBow.rotation.set(-.55,.2,-.25);tBow.scale.setScalar(1.35);
for(const sx of [-1,1]){const l=mesh(sph(1,24),mPink,sx*.13,0,0,tBow);l.scale.set(.15,.1,.07);}mesh(sph(.06,16),M({color:'#E23D6E'}),0,0,.03,tBow);
const tHat=witchHat(.95);tHat.position.set(.08,Q(24)-tHead.position.y-.02,0);tHat.rotation.set(-.08,0,.1);tHead.add(tHat);
const tPump=pumpkin(.36);tPump.position.set(1.05,Q(124),.35);ttFloat.add(tPump);

// chuyển màu sRGB -> linear cho mọi vật liệu (three r128 chưa tự quản lý màu)
{const done=new Set();scene.traverse(o=>{const m=o.material;if(!m||done.has(m))return;done.add(m);
  if(m.color&&!m.vertexColors)m.color.convertSRGBToLinear();if(m.emissive)m.emissive.convertSRGBToLinear();});}
// ---------- bố cục camera ----------
let theta=opts.theta??0.18,phi=opts.phi??1.35,radius=12.5,target=new T.Vector3(opts.targetX??0,opts.targetY??1.55,0);
let autoRot=false;
function placeCam(){camera.position.set(target.x+radius*Math.sin(phi)*Math.sin(theta),target.y+radius*Math.cos(phi),target.z+radius*Math.sin(phi)*Math.cos(theta));camera.lookAt(target);}
function resize(){const w=wrap.clientWidth,h=wrap.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
  radius=opts.radius?opts.radius*(w/h<1?1.4:1):(w/h<1?17:12.5);placeCam();}
window.addEventListener('resize',resize);let ro=null;try{ro=new ResizeObserver(resize);ro.observe(wrap);}catch(e){}
// kéo xoay
let drag=null;const el=renderer.domElement;
if(opts.drag)el.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY,t:theta,p:phi};el.setPointerCapture(e.pointerId);});
el.addEventListener('pointermove',e=>{mouse.x=(e.clientX/innerWidth)*2-1;mouse.y=-(e.clientY/innerHeight)*2+1;
  if(!drag)return;theta=drag.t-(e.clientX-drag.x)*0.008;phi=Math.max(.35,Math.min(1.62,drag.p-(e.clientY-drag.y)*0.006));placeCam();});
el.addEventListener('pointerup',()=>drag=null);
if(opts.zoom)el.addEventListener('wheel',e=>{e.preventDefault();radius=Math.max(6,Math.min(24,radius*(1+e.deltaY*0.001)));placeCam();},{passive:false});
const mouse={x:0,y:0};const onWinMove=e=>{mouse.x=(e.clientX/innerWidth)*2-1;mouse.y=-(e.clientY/innerHeight)*2+1;};window.addEventListener('mousemove',onWinMove);

// ---------- biểu cảm ----------
let mood='normal';
function setMood(m){mood=m;
  kEyes.visible=tEyes.visible=(m==='normal'||m==='surprise');
  kHappy.visible=tHappy.visible=(m==='happy');
  kLove.visible=tLove.visible=(m==='love');
  kSmile.visible=tSmile.visible=(m==='normal');
  kOpen.visible=tOpen.visible=(m==='happy'||m==='love');
  kO.visible=tO.visible=(m==='surprise');
  const s=m==='surprise'?1.18:1;kPupils.concat(tPupils).forEach(p=>p.scale.setScalar(s));
}
let hw=false;
function setHW(on){hw=on;scene.traverse(o=>{if(o.userData.hw)o.visible=on;});
  kBow.visible=kWires.visible=!on;tBow.visible=tAnt.visible=!on;
  if(!opts.transparent)scene.background=on?BG_NIGHT.clone():BG_DAY.clone();
  ground.material.opacity=on?.3:.12;key.color.set(on?'#d9ccff':'#ffffff');rim.color.set(on?'#ff9a3d':'#ffd7b0');rim.intensity=on?1.1:.5;
}
// click vào mascot → nhảy
const ray=new T.Raycaster();let hopK=-9,hopT=-9;let frozenAt=null;const nowS=()=>frozenAt??performance.now()/1000;
el.addEventListener('click',e=>{if(drag&&Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>4)return;const r=el.getBoundingClientRect();
  ray.setFromCamera({x:(e.clientX-r.left)/r.width*2-1,y:-(e.clientY-r.top)/r.height*2+1},camera);
  const hit=ray.intersectObjects([KK,TT],true)[0];if(!hit)return;let o=hit.object;while(o&&o!==KK&&o!==TT)o=o.parent;
  if(o===KK)hopK=nowS();else hopT=nowS();const prev=mood;setMood('happy');setTimeout(()=>setMood(prev==='happy'?'normal':prev),1200);});

// ---------- vòng lặp ----------
const clock=new T.Clock();let nextBlink=1.5,blinkUntil=0;
let rafId=0,destroyed=false,paused=false;
function loop(){if(destroyed)return;rafId=requestAnimationFrame(loop);if(paused)return;const t=clock.getElapsedTime();const dt=clock.getDelta();
  if(autoRot){theta+=0.004;placeCam();}
  kkFloat.position.y=Math.sin(t*2)*0.05;ttFloat.position.y=Math.sin(t*2+1.3)*0.05;
  {const n=nowS();const pk=(n-hopK)/0.75,pt=(n-hopT)/0.75;
   const sq=(p)=>p<0.15?1-0.18*Math.sin(p/0.15*Math.PI/2):p>0.85?1-0.12*Math.sin((p-0.85)/0.15*Math.PI):1;
   if(pk>=0&&pk<1){kkFloat.position.y+=Math.sin(pk*Math.PI)*0.5;kkFloat.scale.set(2-sq(pk),sq(pk),2-sq(pk));}else kkFloat.scale.set(1,1,1);
   if(pt>=0&&pt<1){ttFloat.position.y+=Math.sin(pt*Math.PI)*0.5;ttFloat.scale.set(2-sq(pt),sq(pt),2-sq(pt));}else ttFloat.scale.set(1,1,1);}
  if(typeof animExtra==='function')animExtra();
  // nhìn theo chuột
  const yaw=mouse.x*0.45,pitch=-mouse.y*0.25;
  kHead.rotation.y+=((yaw+0.12)-kHead.rotation.y)*0.08;kHead.rotation.x+=(pitch-kHead.rotation.x)*0.08;kHead.rotation.z=Math.sin(t*1.3)*0.03;
  tHead.rotation.y+=((yaw-0.12)-tHead.rotation.y)*0.08;tHead.rotation.x+=(pitch-tHead.rotation.x)*0.08;tHead.rotation.z=Math.sin(t*1.3+1)*0.03;
  kPupils.concat(tPupils).forEach(p=>{p.position.x+=((mouse.x*0.05)-p.position.x)*0.15;p.position.y+=((mouse.y*0.05)-p.position.y)*0.15;});
  kWires.rotation.z=Math.sin(t*2.4)*0.06;kBow.rotation.z=-.35+Math.sin(t*3)*0.06;tAnt.rotation.z=Math.sin(t*2.2)*0.08;
  bear.rotation.z=-.18+Math.sin(t*2)*0.04;
  // chớp mắt
  if(t>nextBlink){blinkUntil=t+0.12;nextBlink=t+2.2+Math.random()*2.5;}
  const bl=t<blinkUntil?0.1:1;kEyes.children.forEach(e=>e.scale.y=bl);tEyes.children.forEach(e=>e.scale.y=bl);
  renderer.render(scene,camera);}
if(opts.spread){KK.position.x=-opts.spread;TT.position.x=opts.spread;}
if(opts.kkFront){KK.position.z=opts.kkFront;}
// ===== Ăn mừng: ĐẬP TAY (high-five) =====
const kHandBase=kHandR.position.clone(), tHandBase=tHandL.position.clone(), tHandRot0=tHandL.rotation.z;
const KKx0=KK.position.x, TTx0=TT.position.x;
let hfT=-9, burstDone=true; const sparks=[];
const sparkGroup=new T.Group();scene.add(sparkGroup);
const sparkMats=['#FFC531','#FF7A1A','#FF8FB1','#ffffff'].map(c=>new T.MeshBasicMaterial({color:new T.Color(c).convertSRGBToLinear(),transparent:true}));
const ringMat=new T.MeshBasicMaterial({color:new T.Color('#FFD36A').convertSRGBToLinear(),transparent:true,side:T.DoubleSide});
const hfRing=new T.Mesh(new T.RingGeometry(.18,.26,40),ringMat);hfRing.visible=false;sparkGroup.add(hfRing);
for(let i=0;i<14;i++){const m=new T.Mesh(i%3?new T.OctahedronGeometry(.07):new T.SphereGeometry(.05,10,8),sparkMats[i%4].clone());m.visible=false;sparkGroup.add(m);sparks.push({m,v:new T.Vector3()});}
let burstT=-9;
function burst(at){burstT=nowS();sparkGroup.position.copy(at);hfRing.visible=true;hfRing.scale.setScalar(.3);hfRing.lookAt(camera.position);
  sparks.forEach((s,i)=>{const a=i/sparks.length*Math.PI*2;s.m.position.set(0,0,0);s.m.visible=true;s.v.set(Math.cos(a)*(2+Math.random()*1.5),Math.sin(a)*(2+Math.random()*1.5)+.6,(Math.random()-.5)*1.2);});}
const ease=(t)=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2, clamp01=(t)=>Math.max(0,Math.min(1,t)), mix=(a,b,t)=>a+(b-a)*t;
const MEET_Y=2.85;
function animExtra(){const n=nowS();
  const p=(n-hfT)/1.7;
  if(p>=0&&p<1){
    // dịch lại gần + nghiêng vào nhau
    const inw = p<0.36?ease(clamp01((p-0.05)/0.31)) : p<0.6?1 : 1-ease(clamp01((p-0.6)/0.3));
    KK.position.x=KKx0+0.14*inw; TT.position.x=TTx0-0.14*inw;
    kkFloat.rotation.z=-0.16*inw + (p<0.25?0.06*Math.sin(p/0.25*Math.PI):0); ttFloat.rotation.z=0.16*inw - (p<0.25?0.06*Math.sin(p/0.25*Math.PI):0);
    // tay: lấy đà (0-0.25) -> đập (0.25-0.36) -> giữ (0.36-0.55) -> hạ tay (0.55-0.9)
    const kMeet=new T.Vector3(-0.16-KK.position.x, MEET_Y, 0.75), tMeet=new T.Vector3(0.15-TT.position.x, MEET_Y-0.04, 0.75);
    const kWind=new T.Vector3(kHandBase.x+0.05, MEET_Y+0.35, 0.3), tWind=new T.Vector3(tHandBase.x+0.05, MEET_Y+0.3, 0.3);
    const place=(obj,base,wind,meet)=>{let v;
      if(p<0.25)v=base.clone().lerp(wind,ease(p/0.25));
      else if(p<0.36)v=wind.clone().lerp(meet,ease((p-0.25)/0.11));
      else if(p<0.55)v=meet.clone();
      else v=meet.clone().lerp(base,ease(clamp01((p-0.55)/0.35)));
      obj.position.copy(v);};
    place(kHandR,kHandBase,kWind,kMeet); place(tHandL,tHandBase,tWind,tMeet);
    {const g=p<0.25?1+0.35*ease(p/0.25):p<0.6?1.35:1.35-0.35*ease(clamp01((p-0.6)/0.3));kHandR.scale.setScalar(g);tHandL.scale.setScalar(g);}
    tHandL.rotation.z = p<0.9 ? tHandRot0+mix(0,-1.2,p<0.36?ease(clamp01(p/0.36)):p<0.55?1:1-ease(clamp01((p-0.55)/0.35))) : tHandRot0;
    // tay chạm nhau: rung nhẹ + bung tia sáng
    if(p>=0.36&&!burstDone){burstDone=true;const w=new T.Vector3();kHandR.getWorldPosition(w);const w2=new T.Vector3();tHandL.getWorldPosition(w2);burst(w.lerp(w2,.5));setMood('happy');}
    if(p>=0.36&&p<0.45){const k=Math.sin((p-0.36)/0.09*Math.PI)*0.06;kHandR.position.y+=k;tHandL.position.y+=k;}
    // quay mặt nhìn nhau
    const look = p<0.6?ease(clamp01(p/0.2)):1-ease(clamp01((p-0.6)/0.3));
    kHead.rotation.y=mix(kHead.rotation.y,0.55,look); tHead.rotation.y=mix(tHead.rotation.y,-0.55,look);
    // nhún mừng sau khi đập tay
    if(p>0.55&&p<0.9){const h=Math.sin((p-0.55)/0.35*Math.PI)*0.35;kkFloat.position.y+=h;ttFloat.position.y+=h*0.9;}
  } else if(hfT>0 && p>=1 && p<1.2){kHandR.position.copy(kHandBase);tHandL.position.copy(tHandBase);kHandR.scale.setScalar(1);tHandL.scale.setScalar(1);tHandL.rotation.z=tHandRot0;KK.position.x=KKx0;TT.position.x=TTx0;kkFloat.rotation.z=0;ttFloat.rotation.z=0;}
  // tia sáng
  const bp=(n-burstT)/0.8;
  if(bp>=0&&bp<1){hfRing.scale.setScalar(.3+bp*3.2);hfRing.material.opacity=1-bp;hfRing.lookAt(camera.position);
    sparks.forEach(s=>{s.m.position.copy(s.v).multiplyScalar(bp*0.55);s.m.position.y-=bp*bp*0.4;s.m.rotation.x+=0.2;s.m.rotation.y+=0.15;s.m.material.opacity=1-bp;s.m.scale.setScalar(1.2-bp*0.6);});}
  else if(hfRing.visible&&bp>=1){hfRing.visible=false;sparks.forEach(s=>s.m.visible=false);}
}
function highFive(){if(nowS()-hfT<1.8)return;hfT=nowS();burstDone=false;clearTimeout(highFive._t);highFive._t=setTimeout(()=>setMood('normal'),2600);}
// nhảy cổ vũ (không xoay): nhún + mắt cười
function cheer(){hopK=nowS();hopT=nowS()+0.18;setMood('happy');clearTimeout(cheer._t);cheer._t=setTimeout(()=>setMood('normal'),1500);}
function celebrate(){highFive();}
setMood('normal');resize();loop();
return {setPaused:(v)=>{paused=!!v;},destroy:()=>{destroyed=true;cancelAnimationFrame(rafId);window.removeEventListener('resize',resize);window.removeEventListener('mousemove',onWinMove);try{ro&&ro.disconnect();}catch(e){}try{renderer.dispose();renderer.forceContextLoss&&renderer.forceContextLoss();}catch(e){}try{el.remove();}catch(e){}},freeze:(p)=>{frozenAt=null;const n=nowS();hfT=n-p*1.7;burstDone=p>0.36;if(p>0.36&&p<0.8){burstT=n-(p-0.36)*1.7;const w=new T.Vector3();burst(new T.Vector3(0,MEET_Y,0.8));burstT=n-(p-0.36)*1.7;}frozenAt=n;},highFive,cheer,debug:()=>({k:kkFloat.rotation.y,t:ttFloat.rotation.y,kh:kHead.rotation.y,th:tHead.rotation.y}),setMood,setHW,celebrate,setAutoRotate:(v)=>{autoRot=!!v;}};
}
