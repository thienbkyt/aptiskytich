// @ts-nocheck
/* Hoc Key Sieu Toc - engine thuan JS (UI + game). React chi nap du lieu va mount. */
// ===================== DATA ADAPTER (raw DB rows → view model) =====================
function _num(t){ const m=(t||"").match(/Đề\s*(\d+)/i); return m?m[1]:"?"; }
function _topic(t){ return (t||"").replace(/^Đề\s*\d+\s*[-–:]\s*/i,"").replace(/\s*\((Version|Ver\.?|Bản)\s*\d+\)\s*$/i,"").trim(); }
function _norm(s){ return String(s||"").toLowerCase().replace(/[^a-z ]/g,"").replace(/\s+/g," ").trim(); }
const _SWAP={M:"W",W:"M",B:"B"};
function _splitExp(exp){ const s=String(exp||""); const m=s.match(/\n\s*-{2,}\s*GIẢI THÍCH[^\n]*\n?/i); return m ? [s.slice(0,m.index).trim(), s.slice(m.index+m[0].length)] : [s.trim(), ""]; }
function _quotes(line){ const out=[]; const re=/"([^"]{5,})"|“([^”]{5,})”/g; let m; while((m=re.exec(line))){ (m[1]||m[2]).split(/\.\.\.|…/).map(x=>x.trim().replace(/^[,;:]\s*/,"")).filter(x=>x.length>=5).forEach(x=>out.push(x)); } return out; }
function _letter(opt, idx){ const t=String(opt||"").trim().toLowerCase(); if(t.startsWith("both")) return "B"; if(t.startsWith("wom")) return "W"; if(t.startsWith("man")||t.startsWith("men")) return "M"; return ["M","W","B"][idx]||"B"; }
function _dedupe(list, keyFn){ const seen=new Map(); const rk=p=>p==="high"?0:p==="medium"?1:p==="low"?2:3; const out=[];
  list.forEach(x=>{ const k=keyFn(x); const d=seen.get(k); if(d){ d.dups=(d.dups||[]).concat(x.title); d.dupIds=(d.dupIds||[]).concat(x.id); if(rk(x.prio)<rk(d.prio)) d.prio=x.prio; return; } seen.set(k,x); out.push(x); }); return out; }
function buildData(raw, notes, prio){
  const note=(k,r)=>notes[k+"::"+r];
  const pr=id=>prio[id]||null;
  // ---- L3 ----
  const groups=[];
  (raw.l3||[]).forEach(set=>{
    const qs=(set.qs||[]).slice().sort((a,b)=>a.order_index-b.order_index); if(qs.length<4) return;
    const code=qs.map(q=>_letter((q.options||[])[q.correct_answer], q.correct_answer));
    const st=qs.map(q=>q.question_text||"");
    const q0=qs.find(q=>q.explanation)||qs[0];
    const [script, giai]=_splitExp(q0.explanation);
    const lines=script.split("\n").map(l=>l.trim()).filter(Boolean).map(l=>{ const m=l.match(/^(M|W|Man|Woman|Men|Women)\s*:\s*(.*)$/i); return m?{spk:m[1][0].toUpperCase()==="M"&&!/^wo/i.test(m[1])?"M":"W", text:m[2]}:{spk:"N",text:l}; });
    const firstL=lines.find(l=>l.spk!=="N"); const first=firstL?firstL.spk:null;
    const nam = first==="W" ? code.map(c=>_SWAP[c]) : code;
    const ev=[]; let k=-1; giai.split("\n").forEach(l=>{ const m=l.match(/^\s*(\d)\s*[.)]/); if(m) k=+m[1]-1; if(k>=0&&k<4) _quotes(l).forEach(q=>{ if(script.includes(q)) ev.push([k,q,"q"+k]); }); });
    const topic=_topic(set.title);
    let g=groups.find(x=>x.topic.toLowerCase()===topic.toLowerCase()); if(!g){ g={topic, vi:"", bans:[]}; groups.push(g); }
    const sk=st.map(_norm).join("|"); let b=g.bans.find(x=>x.sk===sk); if(!b){ b={sk, st, nam, sets:[]}; g.bans.push(b); }
    const ck=code.join(""); const dup=b.sets.find(x=>x.code.join("")===ck);
    if(dup){ dup.dups=(dup.dups||[]).concat(set.title); dup.dupIds=(dup.dupIds||[]).concat(set.id); const rk=p=>p==="high"?0:p==="medium"?1:p==="low"?2:3; if(rk(pr(set.id))<rk(dup.prio)) dup.prio=pr(set.id); if(!dup.script&&lines.length>1){ dup.script=lines; dup.ev=ev; dup.audio=q0.audio_url||dup.audio; } return; }
    b.sets.push({id:set.id, title:set.title, n:_num(set.title), first:first||"M", firstUnknown:!first, prio:pr(set.id), script:lines.length>1?lines:null, ev, audio:q0.audio_url||null, code});
  });
  groups.forEach(g=>{ g.bans.forEach(b=>{ const nam=b.nam.join(""), nu=b.nam.map(c=>_SWAP[c]).join(""); b.nu=nu.split("");
      const nN=note("l3_mnemonic", g.topic+"|"+nam), nU=note("l3_mnemonic", g.topic+"|"+nu);
      b.mnNam=nN&&nN.text||null; b.mnNu=nU&&nU.text||null; if(!g.vi) g.vi=(nN&&nN.vi)||(nU&&nU.vi)||"";
      b.sets.forEach(s=>{ const n=note("l3_mnemonic", g.topic+"|"+s.code.join("")); s.mn=n&&n.text||null; });
      const ps=b.sets.map(s=>s.prio).filter(Boolean); b.prio=ps.includes("high")?"high":ps.includes("medium")?"medium":ps.length?"low":null; delete b.sk; });
    g.bans.sort((a,b)=>+a.sets[0].n - +b.sets[0].n); });
  groups.sort((a,b)=>+a.bans[0].sets[0].n - +b.bans[0].sets[0].n);
  // ---- L4 ----
  const L4=(raw.l4||[]).map(set=>{ const qs=(set.qs||[]).slice().sort((a,b)=>a.order_index-b.order_index); if(qs.length<4) return null;
    const scripts=[], audio=[], ev=[];
    [0,1].forEach(m=>{ const q=qs[m*2]; const [sc,giai]=_splitExp(q.explanation); scripts.push(sc||null); audio.push(q.audio_url||null);
      let n=-1; giai.split("\n").forEach(l=>{ const mm=l.match(/^\s*(\d)\s*[.)]/); if(mm) n=+mm[1]-1; if(n<0||n>1) return; const qi=m*2+n; const parts=l.split(/Bẫy/i);
        _quotes(parts[0]).forEach(x=>{ if(sc.includes(x)) ev.push([qi,x,"ans"]); }); parts.slice(1).forEach(p=>_quotes(p).forEach(x=>{ if(sc.includes(x)) ev.push([qi,x,"trap"]); })); });
      // nếu giải thích không trích nguyên văn: tô đáp án đúng nếu xuất hiện y hệt trong script
      [0,1].forEach(n=>{ const qq=qs[m*2+n]; const ans=String((qq.options||[])[qq.correct_answer]||"").replace(/[.]$/,""); if(ans && !ev.some(e=>e[0]===m*2+n&&e[2]==="ans") && sc.toLowerCase().includes(ans.toLowerCase())){ const i=sc.toLowerCase().indexOf(ans.toLowerCase()); ev.push([m*2+n, sc.slice(i,i+ans.length), "ans"]); } });
    });
    return {id:set.id, title:set.title, prio:pr(set.id), qs:qs.map(q=>({t:q.question_text, o:q.options||[], a:q.correct_answer})), scripts, audio, ev}; }).filter(Boolean)
    .sort((a,b)=>+_num(a.title) - +_num(b.title));
  const L4u=_dedupe(L4, s=>s.qs.map(q=>_norm(q.t)+"="+_norm(q.o[q.a])).join("|"));
  // ---- R2 ----
  const R2=(raw.r2||[]).map(set=>{ const q=(set.qs||[])[0]; const ex=q&&q.extra_data||{}; const ss=(ex.sentences||[]).slice().sort((a,b)=>a.correctPosition-b.correctPosition); if(!ss.length) return null;
    const titles=ex.sectionTitles||["Đoạn 1","Đoạn 2"]; const half=Math.ceil(ss.length/2); const given=ex.givenSentences;
    const sec=[0,1].map(k=>{ const part=ss.filter(x=> k===0 ? x.correctPosition<=half : x.correctPosition>half).map(x=>x.text);
      if(Array.isArray(given)) return {t:titles[k]||"", given:given[k]||null, order:part};
      return {t:titles[k]||"", given:part[0]||null, order:part.slice(1)}; }).filter(s=>s.order.length);
    return {id:set.id, title:set.title, prio:pr(set.id), sec}; }).filter(Boolean).sort((a,b)=>+_num(a.title) - +_num(b.title));
  const R2u=_dedupe(R2, s=>s.sec.map(x=>[x.given||"",...x.order].map(_norm).join(">")).join("||"));
  // ---- R5 ----
  const R5=(raw.r5||[]).map(set=>{ const q=(set.qs||[])[0]; const ex=q&&q.extra_data||{}; const ps=(ex.paragraphs||[]).slice().sort((a,b)=>a.index-b.index); if(!ps.length) return null;
    const h=(ex.headings||[]).map(x=>[x.text, x.paragraphIndex==null?null:+x.paragraphIndex]); const nk=note("r5_signal", set.id);
    return {id:set.id, title:set.title, prio:pr(set.id), h, p:ps.map(x=>x.text), key:(nk&&nk.keys)||[]}; }).filter(Boolean).sort((a,b)=>+_num(a.title) - +_num(b.title));
  const R5u=_dedupe(R5, s=>s.p.map(_norm).join("|")+"#"+s.h.map(h=>_norm(h[0])+h[1]).join("|"));
  return {L3:groups, L4:L4u, R2:R2u, R5:R5u};
}

export function mountHocKey(ROOT, OPTS){
ROOT.classList.add('hk');
ROOT.innerHTML = "<div class=\"hk-wrap\">\n <div class=\"hk-head\"><h1>🚀 Học Key Thần Tốc</h1><p class=\"sub\">Thuộc đáp án theo từng dạng câu — Listening câu 15, 16–17 · Reading Part 2–3, Part 5. Mỗi dạng một cách học riêng + game.</p></div>\n <div class=\"parts\" id=\"parts\"></div>\n <div class=\"pfbar\" id=\"pf\"></div><div class=\"prog\" id=\"prog\"></div>\n <div class=\"tabs\" id=\"tabs\"></div>\n <div id=\"body\"></div>\n <div class=\"lockbar\"><div style=\"font-size:30px\">🔒</div><b style=\"font-size:18px\">Học Key Thần Tốc dành cho Pro</b><div class=\"muted\">Nâng cấp Pro để mở bảng key, flashcard, kiểm tra và game cho Listening câu 15–17, Reading Part 2–3 & 5.</div><button class=\"btn b-main\" data-upgrade=\"1\">Nâng cấp Pro</button></div>\n</div>\n<div id=\"scrim\"></div><aside id=\"drawer\"></aside>\n";
const D = buildData(OPTS.raw, Object.assign({}, OPTS.notes||{}, OPTS.userNotes||{}), OPTS.prio||{});
const L3 = D.L3, L4 = D.L4, R2 = D.R2, R5 = D.R5;
const $ = (s, el=ROOT) => el.querySelector(s);
const $$ = (s, el=ROOT) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const short = t => (t.match(/Đề\s*\d+/)||[t])[0];
const shuffle = a => { a=[...a]; for(let i=a.length-1;i>0;i--){const j=Math.random()*(i+1)|0;[a[i],a[j]]=[a[j],a[i]];} return a; };
const MWBVI = {M:"Man",W:"Woman",B:"Both"};
const seq = (c, cls="") => `<span class="seq ${cls}">${c.map(x=>`<span class="s s${x}">${x}</span>`).join("")}</span>`;
const PRIO = {high:["Ưu tiên cao","p-high"], medium:["Ưu tiên vừa","p-med"], low:["Ưu tiên thấp","p-low"]};
const prioBadge = p => p ? `<span class="pb ${PRIO[p][1]}">${p==="high"?"🔥 ":""}${PRIO[p][0]}</span>` : `<span class="pb p-none">Chưa vào key</span>`;
const learned = {l3:new Set(), l4:new Set(), r2:new Set(), r5:new Set()};
(OPTS.learned||[]).forEach(r=>{ if(learned[r.part]) learned[r.part].add(r.exam_set_id); });
const L3ROWS = L3.flatMap(g => g.bans.map((b,bi) => ({g, b, bi, id:`${g.topic}#${bi}`, multi:g.bans.length>1})));
const L3SETS = L3ROWS.flatMap(r => r.b.sets.map((s,si) => ({r, s, si, id:s.id}))).sort((a,b)=> (L3.indexOf(a.r.g)-L3.indexOf(b.r.g)) || (a.r.bi-b.r.bi) || (+a.s.n - +b.s.n));
// ---- canonical id (đề trùng → đề giữ lại) + part của mỗi đề
const CANON = new Map(), PARTOF = new Map(), TITLE = new Map();
L3SETS.forEach(x=>{ CANON.set(x.id,x.id); PARTOF.set(x.id,"l3"); TITLE.set(x.id,x.s.title); (x.s.dupIds||[]).forEach(d=>CANON.set(d,x.id)); });
[["l4",L4],["r2",R2],["r5",R5]].forEach(([pt,list])=>list.forEach(x=>{ CANON.set(x.id,x.id); PARTOF.set(x.id,pt); TITLE.set(x.id,x.title); (x.dupIds||[]).forEach(d=>CANON.set(d,x.id)); }));
// ---- Sổ key cá nhân
const NB = new Set(); (OPTS.notebook||[]).forEach(r=>{ const c=CANON.get(r.exam_set_id); if(c) NB.add(c); });
const PRACTICE_WRONG = [...new Set((OPTS.practiceWrong||[]).map(id=>CANON.get(id)).filter(Boolean))];
const SESSION_WRONG = new Set();
let NBMODE=false, nbPart=null, lf="all";
const passL = (part,id) => lf==="all" || (lf==="yes") === learned[part].has(id);
const okSet = (part,s) => passP(s.prio) && (!NBMODE || NB.has(s.id)) && passL(part,s.id);
const okRow = r => passP(r.b.prio) && r.b.sets.some(s=>(!NBMODE||NB.has(s.id)) && passL("l3",s.id));
const noteWrong = (part,id) => { if(id) SESSION_WRONG.add(id); };
const doBtn = (part,id) => OPTS.onDoSet ? `<button class="dob" data-do="${part}|${esc(id)}" title="Vào làm đề này theo đúng Part">▶ Làm đề</button>` : "";
const nbBtn = (part,id,big) => `<button class="nbb ${NB.has(id)?"on":""} ${big?"big":""}" data-nb="${part}|${esc(id)}">${NB.has(id)?"✓ Trong sổ key":"＋ Sổ key"}</button>`;
function toggleNB(part,id,force,source){ const on = force==null ? !NB.has(id) : force; if(on===NB.has(id)) return; on?NB.add(id):NB.delete(id); OPTS.onToggleNotebook&&OPTS.onToggleNotebook(part,id,on,source||"manual"); }

const PARTS = [
 {id:"l3", grp:"Listening", name:"Câu 15", sub:"Short conversations", tabs:["Bảng mã","Flashcard","Kiểm tra","🎮 Game"], items:()=>L3SETS.map(x=>({id:x.id,prio:x.s.prio}))},
 {id:"l4", grp:"Listening", name:"Câu 16–17", sub:"Monologues", tabs:["Bảng đáp án","Flashcard","Kiểm tra","🎮 Game"], items:()=>L4.map(s=>({id:s.id,prio:s.prio}))},
 {id:"r2", grp:"Reading", name:"Part 2–3", sub:"Text cohesion", tabs:["Thứ tự đúng","Luyện xếp","Câu tiếp theo?","🎮 Game ná"], items:()=>R2.map(s=>({id:s.id,prio:s.prio}))},
 {id:"r5", grp:"Reading", name:"Part 5", sub:"Long reading", tabs:["Bảng tra","Flashcard","Kiểm tra","🎮 Game"], items:()=>R5.map(s=>({id:s.id,prio:s.prio}))},
];
let HIDE_SUG=(()=>{ try{ return localStorage.getItem("hk_hide_sug")==="1"; }catch{ return false; } })();
let cur=(OPTS.initial&&OPTS.initial.cur)||"l3", tab=(OPTS.initial&&+OPTS.initial.tab)||0, locked=!!OPTS.locked, prioF="all";
const passP = p => prioF==="all" || p===prioF;

const HOW = {
 l3:`<b>Câu 15 — 2 người bàn 1 chủ đề, 4 nhận định chọn Man / Woman / Both.</b> Mỗi chủ đề có <b>2 mã</b>: <b>Nam nói trước</b> và <b>Nữ nói trước</b> (đổi M↔W, B giữ nguyên). Vào thi nghe câu đầu tiên là ai nói → dùng đúng mã. Đề nào có 2 bộ nhận định khác nhau thì ghi <b>Bản 01 / Bản 02</b>.`,
 l4:`<b>Câu 16–17 — mỗi đề 2 bài nói, mỗi bài 2 câu hỏi, 3 lựa chọn.</b> Học key = nhớ <b>câu hỏi → ý đúng</b>. Bấm 🎧 để nghe + xem script: câu chứa đáp án tô xanh, chỗ gài bẫy tô đỏ.`,
 r2:`<b>Part 2–3 — 2 đoạn, mỗi đoạn xếp 5 câu.</b> Học key = nhớ <b>chuỗi mở câu</b> + <b>từ nối</b> (this/these, he/she, then, after…) tô cam để quên vẫn suy ra được.`,
 r5:`<b>Part 5 — 7 đoạn ghép tiêu đề</b> (có đề thừa 1 tiêu đề gây nhiễu). Học key = nhớ <b>đoạn số mấy ↔ tiêu đề</b> qua <b>câu tín hiệu</b> tô vàng.`
};

const NBTABS=["Danh sách","Flashcard","Kiểm tra","🎮 Game"];
const PART_FN={l3:[L3Table,L3Flash,L3Quiz,L3Game], l4:[L4Table,L4Flash,L4Quiz,L4Game], r2:[R2Table,R2Order,R2Next,R2Game], r5:[R5Table,R5Flash,R5Quiz,R5Game]};
const PART_PLAY={l3:[1,2,3], l4:[1,2,3], r2:[1,2,3], r5:[1,2,3]};
function renderShell(){
  OPTS.onState&&OPTS.onState({cur,tab});
  const grpHtml = g => `<div class="sg"><div class="sgl">${g.toUpperCase()}</div><div class="sgr">${PARTS.filter(x=>x.grp===g).map(x=>`<button class="pt ${x.id===cur?"on":""}" data-part="${x.id}"><b>${x.name}</b><span>${x.sub}</span></button>`).join("")}</div></div>`;
  const sugN = [...new Set([...SESSION_WRONG, ...PRACTICE_WRONG])].filter(id=>PARTOF.has(id) && !NB.has(id)).length;
  $("#parts").innerHTML = `<div class="seg">${grpHtml("Listening")}<div class="sep"></div>${grpHtml("Reading")}</div>
    <button class="nbcard ${cur==="nb"?"on":""}" data-part="nb">${sugN&&!HIDE_SUG?`<span class="dot">${sugN} gợi ý</span>`:""}<span class="ic">📒</span><span class="nbtx"><b>Sổ key của tôi</b><span class="csub">${NB.size} đề đã lưu · ôn Flashcard / Game</span></span><span class="go">›</span></button>`;
  ROOT.classList.toggle("locked", locked);
  stopGames();
  if(cur==="nb"){ renderNotebook(); return; }
  NBMODE=false;
  const p = PARTS.find(x=>x.id===cur);
  const items = p.items(), cnt = k => items.filter(i=>i.prio===k).length;
  const ly = items.filter(i=>learned[cur].has(i.id)).length;
  const vis = items.filter(i=>passP(i.prio)), done = vis.filter(i=>learned[cur].has(i.id)).length, pct = vis.length?Math.round(done/vis.length*100):0;
  $("#pf").innerHTML = `<div class="hfg"><span class="hfl">Ưu tiên</span><div class="hseg">` + [["all","Tất cả",items.length],["high","🔥 Cao",cnt("high")],["medium","Vừa",cnt("medium")],["low","Thấp",cnt("low")]]
    .filter(([k,,n])=>k==="all"||n>0).map(([k,l,n])=>`<button class="${prioF===k?"on":""}" data-pf="${k}">${l}<i>${n}</i></button>`).join("") + `</div></div>`
    + `<div class="hfg"><span class="hfl">Trạng thái</span><div class="hseg">` + [["all","Tất cả",null],["no","Chưa thuộc",items.length-ly],["yes","Đã thuộc",ly]].map(([k,l,n])=>`<button class="${lf===k?"on":""}" data-lf="${k}">${l}${n==null?"":`<i>${n}</i>`}</button>`).join("") + `</div></div>`
    + `<div class="pprog"><b>${p.name}</b><div class="bar"><i style="width:${pct}%"></i></div><b>${done}/${vis.length}</b><span class="muted">đã thuộc</span></div>`;
  $("#pf").style.display=""; $("#prog").style.display="none"; 
  $("#tabs").innerHTML = p.tabs.map((t,i)=>`<button class="tab ${i===tab?"on":""} ${i===3?"tgame":""}" data-tab="${i}">${t}</button>`).join("");
  PART_FN[cur][tab]($("#body"));
}
function nbItems(){ return [...NB].filter(id=>PARTOF.has(id)).map(id=>({id, part:PARTOF.get(id), title:TITLE.get(id)})); }
function renderNotebook(){
  const items = nbItems(); const byPart = pt => items.filter(i=>i.part===pt);
  if(!nbPart || !byPart(nbPart).length) nbPart = (PARTS.find(x=>byPart(x.id).length)||PARTS[0]).id;
  const sugg = [...new Set([...SESSION_WRONG, ...PRACTICE_WRONG])].filter(id=>PARTOF.has(id) && !NB.has(id));
  $("#pf").innerHTML = tab===0 ? "" : `<div class="hfg"><span class="hfl">Ôn phần</span><div class="hseg">` + PARTS.map(x=>`<button class="${nbPart===x.id?"on":""}" data-nbp="${x.id}" ${byPart(x.id).length?"":"disabled"}>${x.grp==="Listening"?"L":"R"} · ${x.name}<i>${byPart(x.id).length}</i></button>`).join("") + `</div></div>`;
  $("#pf").style.display = tab===0 ? "none" : "";
  $("#prog").style.display="none";
  $("#tabs").innerHTML = NBTABS.map((t,i)=>`<button class="tab ${i===tab?"on":""} ${i===3?"tgame":""}" data-tab="${i}">${t}</button>`).join("");
  const b=$("#body");
  if(tab===0){
    const pname = pt => { const x=PARTS.find(p=>p.id===pt); return `${x.grp} ${x.name}`; };
    b.innerHTML = `${sugg.length&&HIDE_SUG?`<div class="sugoff"><button class="sugtg" data-sugtg="0">💡 Hiện gợi ý (${sugg.length} đề làm sai)</button></div>`:""}${sugg.length&&!HIDE_SUG?`<div class="card nbsug"><div class="l4h"><div><b>Gợi ý thêm vào sổ</b> <span class="muted">· ${sugg.length} đề bạn làm sai (bài luyện đề + kiểm tra/game ở đây)</span></div><div class="sugacts"><button class="sugtg" data-sugtg="1">Ẩn gợi ý</button><button class="btn b-main sm" data-nball="1">＋ Thêm tất cả</button></div></div>
      <div class="nblist">${sugg.map(id=>`<div class="nbrow"><span class="nbpart">${pname(PARTOF.get(id))}</span><span class="nbt">${esc(TITLE.get(id))}</span>${nbBtn(PARTOF.get(id),id)}</div>`).join("")}</div></div>`:""}
      <div class="card nbmain"><div class="l4h"><div><b>📒 Sổ key của tôi</b> <span class="muted">· ${items.length} đề</span></div>${items.length?`<span class="muted">Chọn tab Flashcard / Kiểm tra / Game để ôn riêng các đề này</span>`:""}</div>
      ${items.length?PARTS.map(x=>byPart(x.id).length?`<div class="nbgrp"><div class="lbl">${x.grp} · ${x.name}</div>${byPart(x.id).map(i=>`<div class="nbrow"><span class="nbt">${esc(i.title)}</span><button class="lbtn" data-goto="${i.part}|${esc(i.id)}">Mở</button><button class="nbb on" data-nb="${i.part}|${esc(i.id)}">Bỏ khỏi sổ</button></div>`).join("")}</div>`:"").join("")
       :`<div class="emptyc">Sổ đang trống. Bấm <b>＋ Sổ key</b> ở bất kỳ đề nào, hoặc thêm từ gợi ý câu sai.</div>`}</div>`;
    return;
  }
  NBMODE=true; prioF="all"; lf="all";
  if(!byPart(nbPart).length){ b.innerHTML=`<div class="card emptyc">Sổ key chưa có đề nào để ôn.</div>`; return; }
  PART_FN[nbPart][tab](b);
}
ROOT.addEventListener("click", e=>{
  const cl=e.target.closest("[data-close]"); if(cl){ closeDrawer(); return; }
  const dz=e.target.closest("[data-do]"); if(dz){ e.stopPropagation(); if(locked){ OPTS.onUpgrade&&OPTS.onUpgrade(); return; } const [p,id]=dz.dataset.do.split("|"); OPTS.onDoSet&&OPTS.onDoSet(p,id); return; }
  const up=e.target.closest("[data-upgrade]"); if(up){ OPTS.onUpgrade&&OPTS.onUpgrade(); return; }
  const ed=e.target.closest("[data-edit]"); if(ed){ e.stopPropagation(); editNote(ed.dataset.edit); return; }
  const nb=e.target.closest("[data-nb]"); if(nb){ e.stopPropagation(); const [p,id]=nb.dataset.nb.split("|"); toggleNB(p,id,null,"manual"); const on=NB.has(id); $$(`[data-nb="${p}|${id}"]`).forEach(x=>{ x.classList.toggle("on",on); if(!x.closest(".nbmain")) x.textContent=on?"✓ Trong sổ key":"＋ Sổ key"; }); const nc=$(".nbcard .csub"); if(nc) nc.textContent=`${NB.size} đề đã lưu · ôn Flashcard / Game`; if(cur==="nb"&&tab===0) renderShell(); return; }
  const sg=e.target.closest("[data-sugtg]"); if(sg){ HIDE_SUG = sg.dataset.sugtg==="1"; try{ localStorage.setItem("hk_hide_sug", HIDE_SUG?"1":"0"); }catch{} renderShell(); return; }
  const na=e.target.closest("[data-nball]"); if(na){ [...new Set([...SESSION_WRONG, ...PRACTICE_WRONG])].filter(id=>PARTOF.has(id)&&!NB.has(id)).forEach(id=>toggleNB(PARTOF.get(id),id,true,"suggest")); renderShell(); return; }
  const np=e.target.closest("[data-nbp]"); if(np){ nbPart=np.dataset.nbp; resetState(); renderShell(); return; }
  const gt=e.target.closest("[data-goto]"); if(gt){ const [p,id]=gt.dataset.goto.split("|"); cur=p; tab=0; prioF="all"; lf="all"; resetState(); renderShell(); const t=TITLE.get(id); const q=$("#q"); if(q&&t){ q.value=(p==="l3"?(t.replace(/^Đề\s*\d+\s*[-–:]\s*/,"")):t); q.dispatchEvent(new Event("input")); } return; }
  const lfb=e.target.closest("[data-lf]"); if(lfb){ lf=lfb.dataset.lf; resetState(); renderShell(); return; }
  const pb=e.target.closest("[data-part]"); if(pb){ cur=pb.dataset.part; tab=0; prioF="all"; lf="all"; resetState(); renderShell(); return; }
  const tb=e.target.closest("[data-tab]"); if(tb){ tab=+tb.dataset.tab; resetState(); renderShell(); return; }
  const pf=e.target.closest("[data-pf]"); if(pf){ prioF=pf.dataset.pf; resetState(); renderShell(); return; }
  const l=e.target.closest("[data-learn]"); if(l){ e.stopPropagation(); const [p,id]=l.dataset.learn.split("|"); const on=!learned[p].has(id); on?learned[p].add(id):learned[p].delete(id); OPTS.onToggleLearned&&OPTS.onToggleLearned(p,id,on); renderShell(); return; }
});
const learnBtn = (part,id) => `<button class="lbtn ${learned[part].has(id)?"on":""}" data-learn="${part}|${esc(id)}">${learned[part].has(id)?"✓ Đã thuộc":"Đánh dấu đã thuộc"}</button>`;
let fcI=0, fcFlip=false, qz=null, ro=null, rn=null, r5q=null;
function resetState(){ fcI=0; fcFlip=false; qz=null; ro=null; rn=null; r5q=null; }
const empty = `<div class="card emptyc">Không có đề nào ở mức ưu tiên này.</div>`;

// ===================== AUDIO & SCRIPT DRAWER =====================
let audioEl=null;
function openDrawer(html){ $("#drawer").innerHTML = html; ROOT.classList.add("dopen"); }
function closeDrawer(){ try{ audioEl&&audioEl.pause(); }catch(e){} audioEl=null; ROOT.classList.remove("dopen"); }
$("#scrim").onclick = closeDrawer;
function markQuotes(text, evs){
  let out = esc(text);
  evs.forEach(ev=>{ const q = esc(ev.q); const i = out.indexOf(q); if(i<0) return;
    out = out.slice(0,i) + `<mark class="${ev.cls}">${q}<sup>${ev.tag}</sup></mark>` + out.slice(i+q.length); });
  return out;
}
const CIRC = ["①","②","③","④"];
function playerHtml(path){ return path ? `<div class="player"><audio id="aud" controls preload="none"></audio><div class="spd"><button data-r="0.8">0.8×</button><button data-r="1" class="on">1×</button><button data-r="1.2">1.2×</button></div><span class="muted ptxt" id="pst">Đang tải audio…</span></div>` : `<div class="player"><span class="muted ptxt">Đề này chưa có audio.</span></div>`; }
async function wirePlayer(path){
  if(!path) return; const a=$("#aud"); if(!a) return; audioEl=a; const st=$("#pst");
  $$("#drawer .spd button").forEach(b=>b.onclick=()=>{ a.playbackRate=+b.dataset.r; $$("#drawer .spd button").forEach(x=>x.classList.toggle("on",x===b)); });
  try{ const url = OPTS.getAudio ? await OPTS.getAudio(path) : path; if(audioEl!==a) return; if(!url){ st.textContent="Không tải được audio — thử lại sau."; return; } a.src=url; st.textContent="Bấm ▶ để nghe · chỉnh tốc độ bên cạnh"; }
  catch(e){ st.textContent="Không tải được audio — thử lại sau."; }
}
const xBtn = `<button class="x" data-close="1">✕</button>`;
function openL3Script(row, si){
  const s = row.b.sets[si], use = s.code;
  const head = `<div class="dh"><div><div class="lbl">${short(s.title)}</div><h3>${esc(row.g.topic)}</h3></div>${xBtn}</div>
   <div class="who ${s.first}">${s.firstUnknown?"Chưa rõ ai nói trước":s.first==="M"?"👨 NAM nói trước":"👩 NỮ nói trước"} → mã ${seq(use)}${s.mn?` <span class="mnx">“${esc(s.mn)}”</span>`:""}</div>`;
  const legend = row.b.st.map((t,k)=>`<div class="lgr"><span class="cn c${k}">${CIRC[k]}</span><span class="s s${use[k]}">${use[k]}</span>${esc(t)}</div>`).join("");
  if(!s.script){ openDrawer(head + `<div class="lgbox lgtop">${legend}</div>` + playerHtml(s.audio) + `<div class="noscript">Đề này chưa có script.</div>`); wirePlayer(s.audio); return; }
  const evs = (s.ev||[]).map(([k,q,kind])=>({q, tag:CIRC[k], cls:`ev ev-${kind}`}));
  const body = s.script.map(l=>`<p class="sl sl-${l.spk}"><b class="spk">${l.spk==="M"?"Man":l.spk==="W"?"Woman":""}</b>${markQuotes(l.text, evs)}</p>`).join("");
  openDrawer(head + `<div class="lgbox lgtop">${legend}</div>` + playerHtml(s.audio) + `<div class="legend2"><span>Chỗ tô màu = câu nói tới nhận định có số tương ứng ①–④</span></div><div class="script">${body}</div>`);
  wirePlayer(s.audio);
}
function openL4Script(s, m){
  const txt = s.scripts && s.scripts[m], path = s.audio && s.audio[m];
  const head = `<div class="dh"><div><div class="lbl">${esc(s.title)} · Câu ${16+m}</div><h3>Bài nói ${m+1}</h3></div>${xBtn}</div>`;
  const qs = s.qs.slice(m*2, m*2+2);
  const legend = qs.map((q,k)=>`<div class="lgq"><b>Q${k+1}. ${esc(q.t)}</b><div class="op good">✓ ${esc(q.o[q.a])}</div></div>`).join("");
  if(!txt){ openDrawer(head + playerHtml(path) + `<div class="noscript">Đề này chưa có script.</div><div class="lgbox">${legend}</div>`); wirePlayer(path); return; }
  const evs = (s.ev||[]).filter(([qi])=> (qi>>1)===m).map(([qi,q,kind])=>({q, tag:`Q${qi%2+1}${kind==="trap"?" bẫy":""}`, cls: kind==="ans"?"ev ev-ans":"ev ev-trap"}));
  const paras = txt.split("\n").filter(Boolean);
  openDrawer(head + playerHtml(path) + `<div class="legend2"><span><i class="lg ev-ans"></i>câu chứa đáp án</span><span><i class="lg ev-trap"></i>chỗ gài bẫy (đáp án sai)</span></div>
    <div class="script">${paras.map(p=>`<p>${markQuotes(p, evs)}</p>`).join("")}</div><div class="lgbox">${legend}</div>`);
  wirePlayer(path);
}
// ===================== ADMIN EDIT =====================
function hkToast(msg){ const t=document.createElement("div"); t.className="hktoast"; t.textContent=msg; ROOT.appendChild(t); setTimeout(()=>t.classList.add("on"),10); setTimeout(()=>{ t.classList.remove("on"); setTimeout(()=>t.remove(),300); },2200); }
function editModal({title, sub, fields, validate, onSave}){
  const canAll = !!(OPTS.isAdmin && OPTS.onEditNote), canMe = !!OPTS.onEditUserNote;
  const m=document.createElement("div"); m.className="hkm";
  m.innerHTML=`<div class="hkm-box" role="dialog" aria-modal="true"><div class="hkm-h"><b>${esc(title)}</b><button class="hkm-x" data-mx="1" aria-label="Đóng">✕</button></div>${sub?`<p class="hkm-sub">${sub}</p>`:""}
    ${fields.map((f,i)=>`<label class="hkm-f"><span>${esc(f.label)}</span><input data-mf="${i}" value="${esc(f.value||"")}" placeholder="${esc(f.placeholder||"")}"></label>`).join("")}
    ${canAll?`<div class="hkm-scope"><span>Lưu cho</span><label><input type="radio" name="hksc" value="all" checked> Tất cả học viên</label>${canMe?`<label><input type="radio" name="hksc" value="me"> Chỉ tài khoản của tôi</label>`:""}</div>`:""}
    <p class="hkm-err"></p><div class="hkm-a"><button class="hkm-c" data-mx="1">Huỷ</button><button class="hkm-s">Lưu</button></div></div>`;
  ROOT.appendChild(m);
  const inputs=[...m.querySelectorAll("[data-mf]")]; setTimeout(()=>{ inputs[0]&&inputs[0].focus(); inputs[0]&&inputs[0].select(); },30);
  const close=()=>m.remove();
  const err=m.querySelector(".hkm-err"), btn=m.querySelector(".hkm-s");
  const doSave=async()=>{
    const vals=inputs.map(x=>x.value.trim()); const v=validate&&validate(vals); if(v){ err.textContent=v; return; }
    const all = canAll && (m.querySelector('input[name="hksc"]:checked')||{}).value==="all";
    btn.disabled=true; btn.textContent="Đang lưu…"; err.textContent="";
    try{ await onSave(vals, async (kind,ref,data)=>{ if(all) await OPTS.onEditNote(kind,ref,data); else await OPTS.onEditUserNote(kind,ref,data); }); close(); hkToast(all?"Đã lưu cho tất cả học viên ✓":"Đã lưu vào tài khoản của bạn ✓"); }
    catch(e){ err.textContent="Lưu không thành công: "+(e&&e.message||e); btn.disabled=false; btn.textContent="Lưu"; }
  };
  m.addEventListener("click",e=>{ if(e.target===m||e.target.closest("[data-mx]")){ close(); return; } if(e.target.closest(".hkm-s")) doSave(); });
  m.addEventListener("keydown",e=>{ if(e.key==="Enter"){ e.preventDefault(); doSave(); } if(e.key==="Escape") close(); });
}
function editNote(spec){
  if(!OPTS.onEditUserNote && !OPTS.onEditNote) return;
  const [kind, a, b2] = spec.split("§");
  if(kind==="l3"){
    const sets = L3ROWS.filter(r=>r.g.topic===a).flatMap(r=>r.b.sets); const cur=(sets.find(s=>s.code.join("")===b2)||{}).mn||"";
    const g = L3.find(x=>x.topic===a);
    editModal({ title:`Sửa câu nhớ · ${a}`, sub:`Mã <b>${esc(b2.split("").join("-"))}</b> — chữ đầu mỗi từ viết hoa theo mã (M = M, W = V/W, B = B).`,
      fields:[{label:"Câu nhớ",value:cur,placeholder:"vd: Mua Bán Với Bạn"},{label:"Gợi ý tiếng Việt cho chủ đề",value:(g&&g.vi)||"",placeholder:"vd: lên mạng"}],
      validate:v=>!v[0]?"Nhập câu nhớ trước đã.":"",
      onSave: async (v, save)=>{ const [text,vi]=v; await save("l3_mnemonic", `${a}|${b2}`, {text, vi});
        L3ROWS.forEach(r=>{ if(r.g.topic===a){ r.g.vi=vi; r.b.sets.forEach(s=>{ if(s.code.join("")===b2) s.mn=text; }); if(r.b.nam.join("")===b2) r.b.mnNam=text; if(r.b.nu.join("")===b2) r.b.mnNu=text; } });
        renderShell(); } });
    return;
  }
  if(kind==="r5"){
    const s = R5.find(x=>x.id===a); if(!s) return; const p=+b2;
    editModal({ title:`Sửa câu tín hiệu · đoạn ${p}`, sub:"Copy y nguyên 1 cụm có trong đoạn để tô vàng.",
      fields:[{label:"Câu tín hiệu",value:s.key[p-1]||""}],
      validate:v=>v[0]&&!s.p[p-1].includes(v[0])?"Cụm này không có nguyên văn trong đoạn — hãy copy đúng từng chữ.":"",
      onSave: async (v, save)=>{ const keys = s.p.map((_,i)=> i===p-1 ? v[0] : (s.key[i]||"")); await save("r5_signal", a, {keys}); s.key = keys; renderShell(); } });
  }
}

// ===================== L3 =====================
const mnHtml = (row, which) => { const t = which==="nam"?row.b.mnNam:row.b.mnNu; return t ? `<span class="mnv">${esc(row.g.vi)}</span> <b>${esc(t)}</b>` : `<span class="mnv">chưa có câu nhớ</span>`; };
const editBtn = spec => (OPTS.onEditUserNote||OPTS.onEditNote) ? `<button class="edb" data-edit="${esc(spec)}" title="Sửa theo cách nhớ của bạn">✎</button>` : "";
function L3Table(b){
  const rows = L3SETS.filter(x=>okSet("l3",x.s));
  if(!rows.length){ b.innerHTML=empty; return; }
  b.innerHTML = `<div class="tools"><input class="search" id="q" placeholder="Tìm chủ đề, vd: Internet, Art…"><span class="muted">Bấm dòng để xem 4 nhận định</span></div>
  <div class="card tbl"><table class="l3t"><thead><tr><th>Đề</th><th>Chủ đề</th><th class="cnam">👨 Nam nói trước</th><th class="cnu">👩 Nữ nói trước</th><th>Đề</th><th></th></tr></thead><tbody id="tb"></tbody></table></div>`;
  const draw=()=>{ const q=($("#q").value||"").toLowerCase();
    $("#tb").innerHTML = rows.filter(x=>x.s.title.toLowerCase().includes(q)).map(x=>{ const i=L3SETS.indexOf(x), r=x.r, s=x.s, M=s.first==="M", code=s.code;
      const cell = `${seq(code)}<div class="mn">${s.mn?`<span class="mnv">${esc(r.g.vi)}</span> <b>${esc(s.mn)}</b>`:`<span class="mnv">chưa có câu nhớ</span>`}${editBtn(`l3§${r.g.topic}§${code.join("")}`)}</div>${s.firstUnknown?`<div class="mnv">(chưa rõ ai nói trước)</div>`:""}`;
      return `<tr class="row" data-x="${i}"><td><b>${short(s.title)}</b></td>
       <td><div class="tp">${esc(r.g.topic)}</div>${prioBadge(s.prio)}</td>
       <td class="cnam ${M?"":"empty"}" data-l="👨 Nam nói trước">${M?cell:`<span class="dash">—</span>`}</td>
       <td class="cnu ${M?"empty":""}" data-l="👩 Nữ nói trước">${M?`<span class="dash">—</span>`:cell}</td>
       <td class="tdshow"><button class="showd" data-sc="${i}">Hiện đề</button></td>
       <td class="tdacts"><div class="acts">${doBtn("l3",s.id)}${learnBtn("l3",s.id)}${nbBtn("l3",s.id)}</div></td></tr>
       <tr class="detail" id="d${i}" hidden><td></td><td colspan="5">${r.b.st.map((t,k)=>`<div class="stmt"><span class="s s${code[k]}">${code[k]}</span>${esc(t)}</div>`).join("")}</td></tr>`; }).join("");
  };
  draw(); $("#q").oninput=draw;
  $("#tb").onclick = e=>{ const sc=e.target.closest("[data-sc]"); if(sc){ const x=L3SETS[+sc.dataset.sc]; openL3Script(x.r, x.si); return; }
    const r=e.target.closest("tr.row"); if(!r||e.target.closest("[data-learn],[data-edit],[data-nb],[data-do],.showd")) return; const d=$("#d"+r.dataset.x); d.hidden=!d.hidden; };
}
function l3Cards(){ return L3ROWS.filter(okRow).flatMap(r=>r.b.st.map((t,k)=>["M","W"].map(f=>({r,t,k,f})))).flat(); }
function flashShell(b, n, front, back, redraw){
  b.innerHTML = `<div class="fcw"><div class="muted">Thẻ ${fcI+1}/${n} · bấm thẻ để lật</div>
  <div class="fc ${fcFlip?"flip":""}" id="fc"><div class="fci"><div class="face">${front}</div><div class="face back">${back}</div></div></div>
  <div class="fcnav"><button class="btn b-ghost" id="pv">← Trước</button><button class="btn b-no" id="nx1">Chưa nhớ</button><button class="btn b-yes" id="nx2">Nhớ rồi</button></div></div>`;
  $("#fc").onclick=()=>{ fcFlip=!fcFlip; $("#fc").classList.toggle("flip"); };
  $("#pv").onclick=()=>{ fcI=Math.max(0,fcI-1); fcFlip=false; redraw(b); };
  $("#nx1").onclick=$("#nx2").onclick=()=>{ fcI=(fcI+1)%n; fcFlip=false; redraw(b); };
}
let l3cards=null;
function L3Flash(b){
  if(!l3cards || fcI===0) l3cards = shuffle(l3Cards()); if(!l3cards.length){ b.innerHTML=empty; return; }
  const x=l3cards[fcI%l3cards.length], code = x.f==="M"?x.r.b.nam:x.r.b.nu;
  flashShell(b, l3cards.length,
   `<div class="lbl">${esc(x.r.g.topic)} · nhận định ${x.k+1}/4</div><div class="who ${x.f}">${x.f==="M"?"👨 Nam nói trước":"👩 Nữ nói trước"}</div><h3>${esc(x.t)}</h3><div class="muted">Man, Woman hay Both?</div>`,
   `<div class="lbl">Đáp án (${x.f==="M"?"nam":"nữ"} nói trước)</div><div class="huge s${code[x.k]}t">${MWBVI[code[x.k]]}</div><div>Cả mã: ${seq(code)}</div><div class="mn" style="margin-top:8px">${mnHtml(x.r, x.f==="M"?"nam":"nu")}</div>`, L3Flash);
}
function L3Quiz(b){
  const rows = L3ROWS.filter(okRow); if(!rows.length){ b.innerHTML=empty; return; }
  if(!qz){ qz={list:shuffle(rows.flatMap(r=>r.b.sets.map((s,si)=>({r,s,si})).filter(x=>okSet("l3",x.s)))), i:0, score:0, ans:{}, checked:false}; }
  const {r,s}=qz.list[qz.i%qz.list.length], c = s.code;
  b.innerHTML = `<div class="quiz card"><div class="qhead"><span>Đề ${qz.i+1}/${qz.list.length} · Điểm: <b>${qz.score}</b></span>${prioBadge(r.b.prio)}</div>
   <h3>${esc(r.g.topic)}</h3><div class="who ${s.first}">${s.first==="M"?"👨 Câu đầu tiên NAM nói":"👩 Câu đầu tiên NỮ nói"}</div>
   ${r.b.st.map((t,k)=>`<div class="qrow"><div class="qt">${k+1}. ${esc(t)}</div><div class="mwb">${["M","W","B"].map(m=>{ let cls=qz.ans[k]===m?"pick":""; if(qz.checked){ if(m===c[k]) cls="right"; else if(qz.ans[k]===m) cls="wrong"; }
     return `<button class="mb ${cls}" data-k="${k}" data-m="${m}" ${qz.checked?"disabled":""}>${MWBVI[m]}</button>`; }).join("")}</div></div>`).join("")}
   <div class="qfoot">${qz.checked?`<span>Mã đúng: ${seq(c)} <span class="mn">${mnHtml(r, s.first==="M"?"nam":"nu")}</span> · ${short(s.title)} ${c.every((m,k)=>qz.ans[k]===m)?"":nbBtn("l3",s.id,1)}</span><button class="btn b-main" id="nx">Đề tiếp →</button>`:`<span class="muted">Chọn đủ 4 câu</span><button class="btn b-main" id="ck" ${Object.keys(qz.ans).length<4?"disabled":""}>Kiểm tra</button>`}</div></div>`;
  $$(".mb",b).forEach(x=>x.onclick=()=>{ qz.ans[x.dataset.k]=x.dataset.m; L3Quiz(b); });
  const ck=$("#ck"); if(ck) ck.onclick=()=>{ qz.checked=true; if(c.every((m,k)=>qz.ans[k]===m)) qz.score++; else noteWrong("l3",s.id); L3Quiz(b); };
  const nx=$("#nx"); if(nx) nx.onclick=()=>{ qz.i++; qz.ans={}; qz.checked=false; L3Quiz(b); };
}
function L3Game(b){
  const cards = shuffle(l3Cards()).slice(0,10); if(!cards.length){ b.innerHTML=empty; return; }
  bubbleGame(b, {name:"Câu 15 · Bắn Man / Woman / Both", time:8, rounds: cards.map(x=>{ const c=x.f==="M"?x.r.b.nam:x.r.b.nu;
    return {top:`<span class="who ${x.f} sm">${x.f==="M"?"👨 Nam nói trước":"👩 Nữ nói trước"}</span> ${esc(x.r.g.topic)}`, prompt:x.t, opts:["M","W","B"].map(m=>({label:MWBVI[m], cls:"g"+m, ok:m===c[x.k]})), review:`${esc(x.r.g.topic)} — ${esc(x.t)} → <b>${MWBVI[c[x.k]]}</b> (${x.f==="M"?"nam":"nữ"} trước, mã ${c.join("-")})`, nb:["l3",(x.r.b.sets.find(s=>s.first===x.f)||x.r.b.sets[0]).id]}; })});
}

// ===================== L4 =====================
function L4Table(b){
  const list = L4.filter(s=>okSet("l4",s)); if(!list.length){ b.innerHTML=empty; return; }
  b.innerHTML = `<div class="tools"><input class="search" id="q" placeholder="Tìm theo đề / câu hỏi / đáp án…"></div><div id="list"></div>`;
  const draw=()=>{ const q=($("#q").value||"").toLowerCase();
    $("#list").innerHTML = list.filter(s=>JSON.stringify(s.qs).toLowerCase().includes(q)||s.title.toLowerCase().includes(q)).map(s=>{ const si=L4.indexOf(s); return `
     <div class="card l4c"><div class="l4h"><div><b>${esc(s.title)}</b> ${prioBadge(s.prio)}</div><div class="acts">${doBtn("l4",s.id)}${learnBtn("l4",s.id)}${nbBtn("l4",s.id)}</div></div>
     <div class="l4g">${[0,1].map(m=>`<div class="mono"><div class="monoh"><span class="lbl">Câu ${16+m} · bài nói ${m+1}</span><button class="abtn" data-l4="${si}|${m}">🎧 Audio & script</button></div>${s.qs.slice(m*2,m*2+2).map(qq=>`
       <div class="qa"><div class="qq">${esc(qq.t)}</div>${qq.o.map((o,i)=>`<div class="op ${i===qq.a?"good":"bad"}">${i===qq.a?"✓ ":""}${esc(o)}</div>`).join("")}</div>`).join("")}</div>`).join("")}</div></div>`; }).join("");
  };
  draw(); $("#q").oninput=draw;
  $("#list").onclick=e=>{ const a=e.target.closest("[data-l4]"); if(!a) return; const [si,m]=a.dataset.l4.split("|").map(Number); openL4Script(L4[si], m); };
}
function l4Cards(){ return L4.filter(s=>okSet("l4",s)).flatMap(s=>s.qs.map((q,k)=>({s,q,k}))); }
let l4cards=null;
function L4Flash(b){
  if(!l4cards||fcI===0) l4cards=l4Cards(); if(!l4cards.length){ b.innerHTML=empty; return; }
  const x=l4cards[fcI%l4cards.length];
  flashShell(b, l4cards.length, `<div class="lbl">${short(x.s.title)} · Câu ${16+(x.k>>1)} · hỏi ${x.k%2+1}/2</div><h3>${esc(x.q.t)}</h3><div class="muted">Nhớ ý đúng là gì?</div>`,
   `<div class="lbl">Ý đúng</div><div class="big">✓ ${esc(x.q.o[x.q.a])}</div><div class="muted" style="margin-top:10px">Bẫy: ${x.q.o.filter((_,i)=>i!==x.q.a).map(esc).join(" · ")}</div>`, L4Flash);
}
function L4Quiz(b){
  const all=l4Cards(); if(!all.length){ b.innerHTML=empty; return; }
  if(!qz){ qz={list:shuffle(all), i:0, score:0, pick:null, mix:true, opts:shuffle([0,1,2])}; }
  const x=qz.list[qz.i%qz.list.length];
  b.innerHTML=`<div class="quiz card"><div class="qhead"><span>Câu ${qz.i+1}/${qz.list.length} · Điểm: <b>${qz.score}</b></span><label class="muted"><input type="checkbox" id="mix" ${qz.mix?"checked":""}> Trộn thứ tự đáp án</label></div>
   <div class="lbl">${qz.pick!=null?esc(x.s.title):"Đề ẩn"}</div><h3>${esc(x.q.t)}</h3>
   ${(qz.mix?qz.opts:[0,1,2]).map(i=>{ let cls=""; if(qz.pick!=null){ if(i===x.q.a) cls="right"; else if(i===qz.pick) cls="wrong"; } return `<button class="opt ${cls}" data-i="${i}" ${qz.pick!=null?"disabled":""}>${esc(x.q.o[i])}</button>`; }).join("")}
   <div class="qfoot"><span>${qz.pick!=null?`<button class="abtn" id="sc">🎧 Nghe lại đoạn này</button> ${qz.pick!==x.q.a?nbBtn("l4",x.s.id,1):""}`:""}</span>${qz.pick!=null?`<button class="btn b-main" id="nx">Câu tiếp →</button>`:""}</div></div>`;
  $$(".opt",b).forEach(o=>o.onclick=()=>{ qz.pick=+o.dataset.i; if(qz.pick===x.q.a) qz.score++; else noteWrong("l4",x.s.id); L4Quiz(b); });
  $("#mix").onchange=e=>{ qz.mix=e.target.checked; L4Quiz(b); };
  const sc=$("#sc"); if(sc) sc.onclick=()=>openL4Script(x.s, x.k>>1);
  const nx=$("#nx"); if(nx) nx.onclick=()=>{ qz.i++; qz.pick=null; qz.opts=shuffle([0,1,2]); L4Quiz(b); };
}
function L4Game(b){
  const cards=shuffle(l4Cards()).slice(0,10); if(!cards.length){ b.innerHTML=empty; return; }
  bubbleGame(b, {name:"Câu 16–17 · Bắn ý đúng", time:12, wide:true, rounds:cards.map(x=>({top:`${short(x.s.title)} · Câu ${16+(x.k>>1)}`, prompt:x.q.t, opts:shuffle(x.q.o.map((o,i)=>({label:o, cls:["gA","gB","gC"][i], ok:i===x.q.a}))), review:`${esc(x.q.t)} → <b>${esc(x.q.o[x.q.a])}</b>`, nb:["l4",x.s.id]}))});
}

// ===================== R2 =====================
const CLUE=/\b(this|these|that|those|he|she|it|they|his|her|its|their|him|them|then|next|first|finally|after|before|when|once|later|soon|also|besides|while|there|nowadays|in addition|as a member)\b/gi;
const hl = t => esc(t).replace(CLUE, m=>`<mark class="cl">${m}</mark>`);
const fw = t => t.replace(/^[^A-Za-z]+/,"").split(/\s+/).slice(0,3).join(" ");
function R2Table(b){
  const list=R2.filter(s=>okSet("r2",s)); if(!list.length){ b.innerHTML=empty; return; }
  b.innerHTML = list.map(s=>`<div class="card r2c"><div class="l4h"><div><b>${esc(s.title)}</b> ${prioBadge(s.prio)}</div><div class="acts">${doBtn("r2",s.id)}${learnBtn("r2",s.id)}${nbBtn("r2",s.id)}</div></div>
   <div class="l4g">${s.sec.map((sec,k)=>`<div class="mono"><div class="lbl">Đoạn ${k+1}: ${esc(sec.t)}</div>
    <div class="chain">${sec.order.map(t=>`<span>${esc(fw(t))}…</span>`).join("<i>→</i>")}</div>
    <ol class="ord" start="${sec.given?0:1}">${sec.given?`<li class="given">${esc(sec.given)} <span class="tag0">câu cho sẵn</span></li>`:""}${sec.order.map(t=>`<li>${hl(t)}</li>`).join("")}</ol></div>`).join("")}</div></div>`).join("")
   + `<div class="muted" style="margin:6px 4px">Chữ <mark class="cl">tô cam</mark> = từ nối / đại từ trỏ ngược câu trước. Bản thật: AI viết thêm 1 dòng giải thích cho từng mối nối (admin sửa được).</div>`;
}
function r2Sections(){ return R2.filter(s=>okSet("r2",s)).flatMap(s=>s.sec.map((sec,k)=>({s,sec,k}))); }
function R2Order(b){
  const secs=r2Sections(); if(!secs.length){ b.innerHTML=empty; return; }
  if(!ro){ ro={i:0}; }
  const x=secs[ro.i%secs.length], N=x.sec.order.length;
  if(!ro.pool){ ro.pool=shuffle(x.sec.order); ro.slots=Array(N).fill(null); ro.checked=false; }
  const filled=ro.slots.filter(Boolean).length;
  b.innerHTML=`<div class="quiz card"><div class="qhead"><span><b>${esc(x.s.title)}</b> · ${esc(x.sec.t)}</span><span class="muted">Bấm hoặc kéo câu vào ô · bấm câu đã xếp để gỡ</span></div>
   ${x.sec.given?`<div class="r2given"><span class="r2n">0</span>${esc(x.sec.given)}<span class="tag0">câu cho sẵn</span></div>`:""}
   <div class="r2slots">${ro.slots.map((t,i)=>{ const ok=ro.checked&&t?(t===x.sec.order[i]):null;
     return `<div class="r2slot ${t?"has":""} ${ok===true?"right":ok===false?"wrong":""}" data-slot="${i}"><span class="r2n">${i+1}</span>${t?`<div class="r2item" data-from="s${i}">${ro.checked?hl(t):esc(t)}</div>`:`<span class="r2ph">Kéo hoặc bấm 1 câu bên dưới</span>`}${ok===false?`<div class="r2fix">→ ${esc(x.sec.order[i])}</div>`:""}</div>`; }).join("")}</div>
   <div class="pool">${ro.pool.map((t,i)=>`<div class="pc r2item" data-from="p${i}">${esc(t)}</div>`).join("")}</div>
   <div class="qfoot"><span><button class="btn b-ghost" id="rs">Làm lại</button> ${ro.checked&&ro.slots.some((t,i)=>t!==x.sec.order[i])?nbBtn("r2",x.s.id,1):""}</span>${ro.checked?`<button class="btn b-main" id="nx">Đoạn tiếp →</button>`:`<button class="btn b-main" id="ck" ${filled<N?"disabled":""}>Kiểm tra</button>`}</div></div>`;
  const take = from => from[0]==="p" ? ro.pool.splice(+from.slice(1),1)[0] : (()=>{ const k=+from.slice(1); const t=ro.slots[k]; ro.slots[k]=null; return t; })();
  const putToSlot = (from, k) => { if(from===`s${k}`) return;
    if(from[0]==="s"){ const a=+from.slice(1); const t=ro.slots[a]; ro.slots[a]=ro.slots[k]; ro.slots[k]=t; return; }
    const t=take(from); if(ro.slots[k]) ro.pool.push(ro.slots[k]); ro.slots[k]=t; };
  const clickItem = from => { if(ro.checked) return;
    if(from[0]==="p"){ const k=ro.slots.indexOf(null); if(k<0) return; ro.slots[k]=take(from); }
    else { ro.pool.push(take(from)); } R2Order(b); };
  $$(".r2item",b).forEach(el=>{
    el.addEventListener("pointerdown", ev=>{ if(ro.checked||ev.button>0) return; const from=el.dataset.from, sx=ev.clientX, sy=ev.clientY; let ghost=null;
      const move=e=>{ if(!ghost && Math.hypot(e.clientX-sx,e.clientY-sy)>6){ ghost=el.cloneNode(true); ghost.className="r2ghost"; ghost.style.width=el.offsetWidth+"px"; document.body.appendChild(ghost); el.classList.add("dragging"); }
        if(ghost){ e.preventDefault(); ghost.style.transform=`translate(${e.clientX-20}px,${e.clientY-18}px)`; $$(".r2slot",b).forEach(s=>s.classList.remove("over")); const t=document.elementFromPoint(e.clientX,e.clientY); const sl=t&&t.closest(".r2slot"); if(sl&&b.contains(sl)) sl.classList.add("over"); } };
      const up=e=>{ document.removeEventListener("pointermove",move); document.removeEventListener("pointerup",up);
        if(!ghost){ clickItem(from); return; }
        ghost.remove(); const t=document.elementFromPoint(e.clientX,e.clientY); const sl=t&&t.closest(".r2slot"); const pl=t&&t.closest(".pool");
        if(sl&&b.contains(sl)) putToSlot(from, +sl.dataset.slot); else if(pl&&from[0]==="s") ro.pool.push(take(from));
        R2Order(b); };
      document.addEventListener("pointermove",move); document.addEventListener("pointerup",up); });
  });
  $("#rs").onclick=()=>{ ro.pool=null; R2Order(b); };
  const ck=$("#ck"); if(ck) ck.onclick=()=>{ ro.checked=true; if(ro.slots.some((t,i)=>t!==x.sec.order[i])) noteWrong("r2",x.s.id); R2Order(b); };
  const nx=$("#nx"); if(nx) nx.onclick=()=>{ ro.i++; ro.pool=null; R2Order(b); };
}
function R2Next(b){
  const secs=r2Sections(); if(!secs.length){ b.innerHTML=empty; return; }
  if(!rn){ rn={list:shuffle(secs.flatMap(x=>{ const all=[x.sec.given,...x.sec.order].filter(Boolean); return all.slice(0,-1).map((t,i)=>({x,all,i})); })), i:0, pick:null, score:0}; }
  const y=rn.list[rn.i%rn.list.length], right=y.all[y.i+1];
  if(!rn.opts){ rn.opts=shuffle([right,...shuffle(y.x.sec.order.filter(t=>t!==right&&t!==y.all[y.i])).slice(0,3)]); }
  b.innerHTML=`<div class="quiz card"><div class="qhead"><span>Câu ${rn.i+1} · Điểm: <b>${rn.score}</b></span><span class="muted">${esc(y.x.s.title)} · ${esc(y.x.sec.t)}</span></div>
   <div class="lbl">Câu hiện tại</div><div class="cur">${hl(y.all[y.i])}</div><div class="lbl" style="margin-top:14px">Câu nào đứng NGAY SAU?</div>
   ${rn.opts.map(o=>{ let cls=""; if(rn.pick!=null){ if(o===right) cls="right"; else if(o===rn.pick) cls="wrong"; } return `<button class="opt ${cls}" data-o="${esc(o)}" ${rn.pick!=null?"disabled":""}>${rn.pick!=null?hl(o):esc(o)}</button>`; }).join("")}
   <div class="qfoot"><span>${rn.pick!=null&&rn.pick!==right?nbBtn("r2",y.x.s.id,1):""}</span>${rn.pick!=null?`<button class="btn b-main" id="nx">Tiếp →</button>`:""}</div></div>`;
  $$(".opt",b).forEach(o=>o.onclick=()=>{ rn.pick=o.dataset.o; if(rn.pick===right) rn.score++; else noteWrong("r2",y.x.s.id); R2Next(b); });
  const nx=$("#nx"); if(nx) nx.onclick=()=>{ rn.i++; rn.pick=null; rn.opts=null; R2Next(b); };
}

// ===================== R5 =====================
const headOf=(s,p)=>s.h.find(h=>h[1]===p)[0];
const markKey=(s,p,txt)=>{ const k=(s.key||[])[p-1]; if(!k) return esc(txt); const i=txt.indexOf(k); return i<0?esc(txt):esc(txt.slice(0,i))+`<mark class="ky">${esc(k)}</mark>`+esc(txt.slice(i+k.length)); };
const sigS=(s,p)=>{ const k=(s.key||[])[p-1]; const ss=s.p[p-1].match(/[^.!?]+[.!?]+/g)||[s.p[p-1]]; return ((k&&ss.find(x=>x.includes(k)))||ss[0]).trim(); };
function R5Table(b){
  const list=R5.filter(s=>okSet("r5",s)); if(!list.length){ b.innerHTML=empty; return; }
  b.innerHTML=list.map(s=>{ const extra=s.h.filter(h=>h[1]==null); return `<div class="card r2c"><div class="l4h"><div><b>${esc(s.title)}</b> ${prioBadge(s.prio)}</div><div class="acts">${doBtn("r5",s.id)}${learnBtn("r5",s.id)}${nbBtn("r5",s.id)}</div></div>
   <table><thead><tr><th style="width:70px">Đoạn</th><th style="width:34%">Tiêu đề đúng</th><th>Câu tín hiệu trong đoạn</th></tr></thead><tbody>
   ${s.p.map((_,i)=>`<tr class="row r5r"><td><span class="pn">${i+1}</span></td><td><b>${esc(headOf(s,i+1))}</b></td><td class="sig">${markKey(s,i+1,sigS(s,i+1))} ${editBtn(`r5§${s.id}§${i+1}`)} <span class="more">xem cả đoạn ▾</span><div class="full" hidden>${markKey(s,i+1,s.p[i])}</div></td></tr>`).join("")}
   ${extra.map(h=>`<tr><td><span class="pn x">✕</span></td><td><s>${esc(h[0])}</s></td><td class="muted">Tiêu đề thừa — không thuộc đoạn nào (bẫy)</td></tr>`).join("")}
   </tbody></table></div>`; }).join("");
  $$(".r5r",b).forEach(r=>r.onclick=()=>{ const f=$(".full",r); f.hidden=!f.hidden; });
}
function r5Cards(){ return R5.filter(s=>okSet("r5",s)).flatMap(s=>s.h.filter(h=>h[1]!=null).map(h=>({s,h}))); }
let r5cards=null;
function R5Flash(b){
  if(!r5cards||fcI===0) r5cards=shuffle(r5Cards()); if(!r5cards.length){ b.innerHTML=empty; return; }
  const x=r5cards[fcI%r5cards.length];
  flashShell(b, r5cards.length, `<div class="lbl">${esc(x.s.title)} · tiêu đề</div><h3>“${esc(x.h[0])}”</h3><div class="muted">Thuộc đoạn số mấy? Câu tín hiệu là gì?</div>`,
   `<div class="lbl">Đáp án</div><div class="big">Đoạn ${x.h[1]}</div><div class="sig" style="margin-top:8px">${markKey(x.s,x.h[1],sigS(x.s,x.h[1]))}</div>`, R5Flash);
}
function R5Quiz(b){
  const list=R5.filter(s=>okSet("r5",s)); if(!list.length){ b.innerHTML=empty; return; }
  if(!r5q) r5q={si:0, ans:{}, checked:false};
  const s=list[r5q.si%list.length], heads=s.h.map(h=>h[0]).sort();
  const score=r5q.checked?s.p.filter((_,i)=>r5q.ans[i]===headOf(s,i+1)).length:0;
  b.innerHTML=`<div class="quiz card"><div class="qhead"><span><b>${esc(s.title)}</b> · chọn tiêu đề cho từng đoạn (giống đề thi)</span>${r5q.checked?`<b>${score}/7</b>`:prioBadge(s.prio)}</div>
   ${s.p.map((t,i)=>{ const ok=r5q.checked?r5q.ans[i]===headOf(s,i+1):null; return `<div class="pq ${ok===true?"right":ok===false?"wrong":""}"><div class="pqh"><span class="pn">${i+1}</span><select data-i="${i}" ${r5q.checked?"disabled":""}><option value="">— chọn tiêu đề —</option>${heads.map(h=>`<option ${r5q.ans[i]===h?"selected":""}>${esc(h)}</option>`).join("")}</select>${ok===false?`<span class="fix">→ ${esc(headOf(s,i+1))}</span>`:""}</div><div class="ptx">${r5q.checked?markKey(s,i+1,t):esc(t)}</div></div>`; }).join("")}
   <div class="qfoot"><span class="muted">${r5q.checked?(score<s.p.length?nbBtn("r5",s.id,1)+" ":"")+"Cụm tô vàng = câu tín hiệu":"Mẹo: lướt tìm câu tín hiệu, đừng đọc hết đoạn"}</span>${r5q.checked?`<button class="btn b-main" id="nx">Đề tiếp →</button>`:`<button class="btn b-main" id="ck">Kiểm tra</button>`}</div></div>`;
  $$("select",b).forEach(x=>x.onchange=()=>{ r5q.ans[x.dataset.i]=x.value; });
  const ck=$("#ck"); if(ck) ck.onclick=()=>{ r5q.checked=true; if(s.p.some((_,i)=>r5q.ans[i]!==headOf(s,i+1))) noteWrong("r5",s.id); R5Quiz(b); };
  const nx=$("#nx"); if(nx) nx.onclick=()=>{ r5q={si:r5q.si+1, ans:{}, checked:false}; R5Quiz(b); };
}
function R5Game(b){
  const cards=shuffle(r5Cards()).slice(0,10); if(!cards.length){ b.innerHTML=empty; return; }
  bubbleGame(b, {name:"Part 5 · Bắn đúng đoạn", time:8, rounds:cards.map(x=>{ const n=x.s.p.length; const wrong=shuffle([...Array(n)].map((_,i)=>i+1).filter(i=>i!==x.h[1])).slice(0,3);
    return {top:esc(x.s.title), prompt:`“${x.h[0]}”`, opts:shuffle([x.h[1],...wrong]).map(k=>({label:`Đoạn ${k}`, cls:"gP", ok:k===x.h[1]})), review:`“${esc(x.h[0])}” → <b>Đoạn ${x.h[1]}</b>: ${markKey(x.s,x.h[1],sigS(x.s,x.h[1]))}`, nb:["r5",x.s.id]}; })});
}


// ===================== MASCOTS =====================
const MASC = OPTS.mascots;
const MNAME = {k:"Kỳ Kỳ", t:"Tích Tích"};
const pick = a => a[Math.random()*a.length|0];
function mascHtml(who, side){ return `<div class="masc masc-${who} ${side}" data-m="${who}"><div class="say"></div><img src="${MASC[who].wave}" alt="${MNAME[who]}"><span class="mname">${MNAME[who]}</span></div>`; }
function react(root, who, pose, text, hold=1300){
  const el = root.querySelector(`.masc[data-m="${who}"]`); if(!el) return;
  const img = el.querySelector("img"), say = el.querySelector(".say");
  img.src = MASC[who][pose] || MASC[who].wave; el.classList.remove("bounce"); void el.offsetWidth; el.classList.add("bounce");
  if(text){ say.innerHTML = text; say.classList.add("show"); }
  clearTimeout(el._t); el._t = setTimeout(()=>{ img.src = MASC[who].wave; say.classList.remove("show"); }, hold);
}

// ===================== SOUND =====================
let muted=false, actx=null;
function beep(type){ if(muted) return; try{ actx=actx||new (window.AudioContext||window.webkitAudioContext)(); const t=actx.currentTime;
  const tone=(f,d,st=0,w="sine",v=.18)=>{ const o=actx.createOscillator(), g=actx.createGain(); o.type=w; o.frequency.value=f; g.gain.setValueAtTime(v,t+st); g.gain.exponentialRampToValueAtTime(.001,t+st+d); o.connect(g).connect(actx.destination); o.start(t+st); o.stop(t+st+d); };
  if(type==="shoot") tone(520,.08,0,"triangle",.08); if(type==="ok"){ tone(660,.12); tone(990,.18,.08); } if(type==="bad"){ tone(200,.25,0,"sawtooth",.12); } if(type==="end"){ tone(523,.15); tone(659,.15,.12); tone(784,.3,.24); } }catch(e){} }

// ===================== BUBBLE GAME =====================
let gameStop=[];
function stopGames(){ gameStop.forEach(f=>f()); gameStop=[]; }
function bubbleGame(root, cfg, onlyRounds){
  stopGames();
  const rounds = onlyRounds || cfg.rounds;
  let i=0, score=0, combo=0, best=0, wrongs=[], busy=false, raf=0, tmr=0, tLeft=cfg.time, alive=true;
  root.innerHTML=`<div class="game"><div class="ghead"><span class="gname">${cfg.name}</span><span class="gstat"><span id="gsc">0</span> điểm · combo <b id="gcb">0</b></span><button class="gico" id="gmute" title="Tắt/bật tiếng">${muted?"🔇":"🔊"}</button></div>
   <div class="gq"><div class="gtop" id="gtop"></div><div class="gprompt" id="gp"></div><div class="gtime"><i id="gt"></i></div></div>
   <div class="arena ${cfg.wide?"wide":""}" id="ar"><div class="grid"></div><svg class="cannon" id="cn" viewBox="0 0 120 80"><defs><linearGradient id="cg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#ff8a4c"/><stop offset="1" stop-color="#c2410c"/></linearGradient></defs><g id="barrel" style="transform-origin:60px 62px"><rect x="52" y="6" width="16" height="50" rx="8" fill="url(#cg)"/></g><path d="M18 78 Q60 30 102 78 Z" fill="url(#cg)"/><circle cx="60" cy="62" r="9" fill="#7c2d12"/></svg><div class="gfb" id="gfb"></div>${mascHtml("k","ms-left")}${mascHtml("t","ms-right")}</div>
   <div class="ghint muted">Bấm vào bóng để bắn · phím 1–${4} cũng được</div></div>`;
  const ar=$("#ar",root);
  $("#gmute",root).onclick=()=>{ muted=!muted; $("#gmute",root).textContent=muted?"🔇":"🔊"; };
  let bubbles=[];
  function layout(){
    const r=rounds[i]; $("#gtop",root).innerHTML=`Lượt ${i+1}/${rounds.length} · ${r.top}`; $("#gp",root).innerHTML=esc(r.prompt).replace(/&lt;/g,"<").replace(/&gt;/g,">");
    $$(".bub",ar).forEach(e=>e.remove());
    const W=ar.clientWidth, H=ar.clientHeight-130;
    const n=r.opts.length, bandOrder=shuffle([...Array(n)].map((_,i)=>i)), bh=(H-6)/n;
    bubbles=r.opts.map((o,k)=>{ const el=document.createElement("button"); el.className=`bub ${o.cls}`; el.innerHTML=`<span class="bn">${k+1}</span>${esc(o.label)}`; ar.appendChild(el);
      if(el.offsetWidth>W-16) el.style.maxWidth=(W-16)+"px";
      const w=el.offsetWidth, h=el.offsetHeight; const band=bandOrder[k]; const y0=6+band*bh, y1=Math.max(y0, y0+bh-h);
      const x=6+Math.random()*Math.max(1,W-w-12); const y=y0+Math.random()*(y1-y0);
      const sp=(cfg.wide?.25:.55)*(W<600?.7:1); const bb={el,o,k,x,y,w,h,y0,y1,vx:(Math.random()<.5?-1:1)*sp*(0.6+Math.random()*.6),vy:(Math.random()<.5?-1:1)*sp*0.35};
      el.onclick=()=>shoot(bb); return bb; });
    tLeft=cfg.time; tick(); busy=false;
  }
  function frame(){ const W=ar.clientWidth, H=ar.clientHeight-130;
    bubbles.forEach(b=>{ if(b.dead) return; b.x+=b.vx; b.y+=b.vy; if(b.x<6||b.x+b.w>W-6) b.vx*=-1; if(b.y<b.y0||b.y>b.y1) b.vy*=-1; b.x=Math.max(6,Math.min(W-b.w-6,b.x)); b.y=Math.max(b.y0,Math.min(b.y1,b.y)); b.el.style.transform=`translate(${b.x}px,${b.y}px)`; });
    raf=requestAnimationFrame(frame); }
  let lowSaid=false;
  function tick(){ lowSaid=false; clearInterval(tmr); const gt=$("#gt",root); gt.style.width="100%"; const t0=Date.now();
    tmr=setInterval(()=>{ const left=cfg.time-(Date.now()-t0)/1000; gt.style.width=Math.max(0,left/cfg.time*100)+"%"; gt.classList.toggle("low",left<3); if(left<3 && !lowSaid){ lowSaid=true; react(root,"t","surprise","Nhanh lên!",1200); } if(left<=0){ clearInterval(tmr); if(!busy) resolve(null); } },100); }
  function shoot(bb){ if(busy||bb.dead) return; busy=true; beep("shoot");
    const cn=$("#cn",root).getBoundingClientRect(), ra=ar.getBoundingClientRect(); const cx=cn.left-ra.left+cn.width/2, cy=cn.top-ra.top+cn.height*0.75;
    const tx=bb.x+bb.w/2, ty=bb.y+bb.h/2; const ang=Math.atan2(tx-cx, cy-ty)*180/Math.PI; $("#barrel",root).style.transform=`rotate(${ang}deg)`;
    const p=document.createElement("div"); p.className="proj"; p.style.transform=`translate(${cx-9}px,${cy-9}px)`; ar.appendChild(p);
    requestAnimationFrame(()=>{ p.style.transition="transform .22s cubic-bezier(.2,.7,.3,1)"; p.style.transform=`translate(${tx-9}px,${ty-9}px)`; });
    setTimeout(()=>{ if(!alive) return; p.remove(); resolve(bb); },230); }
  function fb(txt, cls){ const f=$("#gfb",root); f.className=`gfb show ${cls}`; f.innerHTML=txt; setTimeout(()=>f.classList.remove("show"),900); }
  function resolve(bb){ if(!alive) return; busy=true; clearInterval(tmr); const r=rounds[i]; const right=bubbles.find(b=>b.o.ok);
    if(bb && bb.o.ok){ combo++; best=Math.max(best,combo); const add=10+Math.min(combo-1,5)*2+Math.round(tLeft); score+=add; bb.dead=true; bb.el.classList.add("pop"); beep("ok"); fb(`+${add}${combo>1?` · combo ×${combo}`:""}`,"ok");
      if(combo>=3){ react(root,"k","laugh",`Combo ×${combo}! 🔥`); react(root,"t","cheer",pick(["Quá đỉnh!","Thuộc key rồi đó!"])); } else { react(root,"k","cheer",pick(["Chuẩn!","Trúng phóc!","Ngon!"])); } }
    else { combo=0; wrongs.push(r); if(r.nb) noteWrong(r.nb[0],r.nb[1]); beep("bad"); if(bb){ bb.el.classList.add("hitbad"); } right.el.classList.add("glow"); fb(bb?"Sai rồi!":"Hết giờ!","bad");
      react(root,"k",bb?"sad":"surprise",bb?pick(["Ui… trượt rồi","Huhu sai mất"]):"Hết giờ rồi!",1500); react(root,"t","think",`Đáp án là <b>${esc(right.o.label.length>28?right.o.label.slice(0,28)+"…":right.o.label)}</b> nha!`,1500); }
    $("#gsc",root).textContent=score; $("#gcb",root).textContent=combo;
    setTimeout(()=>{ if(!alive) return; i++; if(i>=rounds.length) end(); else layout(); }, bb&&bb.o.ok?650:1500); }
  function end(){ cancelAnimationFrame(raf); clearInterval(tmr); beep("end"); const acc=Math.round((rounds.length-wrongs.length)/rounds.length*100);
    const kp=acc>=80?"trophy":acc>=50?"cheer":"sad", tp=acc>=80?"cheer":acc>=50?"laugh":"wave", tl=acc>=80?"Xuất sắc! Key thuộc làu luôn 🎉":acc>=50?"Khá lắm! Ôn thêm câu sai là ngon":"Không sao, chơi lại câu sai nhé!";
    $(".game",root).innerHTML=`<div class="gend"><div class="endmasc"><img src="${MASC.k[kp]}"><div class="endsay">${tl}</div><img src="${MASC.t[tp]}"></div><h3>${score} điểm</h3><div class="muted">Đúng ${rounds.length-wrongs.length}/${rounds.length} (${acc}%) · combo dài nhất ×${best}</div>
     ${wrongs.length?`<div class="wlist"><div class="lbl">Câu cần ôn lại</div>${wrongs.map(w=>`<div class="wi">${w.review}</div>`).join("")}</div>`:`<div class="perfect">Không sai câu nào 🎉</div>`}
     <div class="qfoot" style="justify-content:center"><button class="btn b-ghost" id="ga">Chơi ván mới</button>${wrongs.length?`<button class="btn b-main" id="gw">Chơi lại câu sai (${wrongs.length})</button>`:""}${wrongs.some(w=>w.nb&&!NB.has(w.nb[1]))?`<button class="btn b-ghost" id="gnb">＋ Thêm đề sai vào sổ key</button>`:""}</div></div>`;
    $("#ga",root).onclick=()=>renderShell(); const gw=$("#gw",root); if(gw) gw.onclick=()=>bubbleGame(root,cfg,shuffle(wrongs));
    const gnb=$("#gnb",root); if(gnb) gnb.onclick=()=>{ wrongs.forEach(w=>{ if(w.nb) toggleNB(w.nb[0],w.nb[1],true,"game"); }); gnb.textContent="✓ Đã thêm vào sổ key"; gnb.disabled=true; }; }
  const key=e=>{ const n=+e.key; if(n>=1&&n<=bubbles.length) shoot(bubbles[n-1]); }; document.addEventListener("keydown",key);
  gameStop.push(()=>{ alive=false; cancelAnimationFrame(raf); clearInterval(tmr); document.removeEventListener("keydown",key); });
  layout(); raf=requestAnimationFrame(frame);
  setTimeout(()=>{ if(!alive) return; react(root,"k","cheer","Bắn thôi! 🎯",1500); react(root,"t","wave","Nhớ key nha~",1500); },150);
}

// ===================== SLINGSHOT GAME (R2) =====================
function R2Game(root, onlyRounds){
  stopGames(); if(onlyRounds) {}
  const rounds = onlyRounds || shuffle(r2Sections()).slice(0,4); if(!rounds.length){ root.innerHTML=empty; return; }
  let ri=0, score=0, miss=0, wrongs=[], alive=true; gameStop.push(()=>{ alive=false; });
  root.innerHTML=`<div class="game sling"><div class="ghead"><span class="gname">Part 2–3 · Ná xếp câu</span><span class="gstat"><span id="gsc">0</span> điểm · trượt <b id="gms">0</b></span><button class="gico" id="gmute">${muted?"🔇":"🔊"}</button></div>
   <div class="otp card"><div class="lbl" id="stitle"></div><div class="given" id="sgiven"></div><div class="slots" id="slots"></div></div>
   <div class="sarena" id="sa"><div class="loaded" id="ld">Chọn 1 viên đạn bên dưới để nạp vào ná</div>
    <svg class="ss" id="ss" viewBox="0 0 300 260"><defs><linearGradient id="wd" x1="0" x2="1"><stop offset="0" stop-color="#6b3a1f"/><stop offset=".5" stop-color="#9a5a2e"/><stop offset="1" stop-color="#5a2f17"/></linearGradient></defs>
     <line id="b1" x1="98" y1="62" x2="150" y2="96" stroke="#3b2414" stroke-width="5" stroke-linecap="round"/>
     <path d="M140 250 L140 150 Q140 130 120 115 L92 70 Q86 58 98 54 Q108 52 112 62 L150 118 L188 62 Q192 52 202 54 Q214 58 208 70 L180 115 Q160 130 160 150 L160 250 Z" fill="url(#wd)" stroke="#3b2414" stroke-width="3"/>
     <rect x="133" y="160" width="34" height="80" rx="10" fill="#4a2a17"/><rect x="128" y="120" width="44" height="26" rx="6" fill="#c8a24a" stroke="#7a5a1a" stroke-width="2"/>
     <line id="b2" x1="202" y1="62" x2="150" y2="96" stroke="#3b2414" stroke-width="5" stroke-linecap="round"/>
     <g id="pouch" style="cursor:grab"><circle id="ball" cx="150" cy="96" r="20" fill="#d6d3cd" stroke="#8a857c" stroke-width="2"/><text id="balltxt" x="150" y="101" text-anchor="middle" font-size="13" font-weight="800" fill="#5a3a20"></text></g></svg>
    ${mascHtml("t","sl-left")}${mascHtml("k","sl-right")}<div class="aimhint muted">Kéo viên đạn xuống rồi thả để bắn vào ô đang sáng · hoặc bấm <button class="btn b-main sm" id="fire" disabled>Bắn</button></div></div>
   <div class="ammo" id="ammo"></div></div>`;
  $("#gmute",root).onclick=()=>{ muted=!muted; $("#gmute",root).textContent=muted?"🔇":"🔊"; };
  let x, pool, filled, loaded=null, slotIdx=0;
  function setup(){ x=rounds[ri]; pool=shuffle(x.sec.order.map((t,k)=>({t,k}))); filled=[]; loaded=null; slotIdx=0; draw(); }
  function draw(){
    $("#stitle",root).innerHTML=`Đoạn ${ri+1}/${rounds.length} · ${esc(x.s.title)} — <b>${esc(x.sec.t)}</b>`;
    $("#sgiven",root).innerHTML=x.sec.given?`<span class="tag0">câu cho sẵn</span> ${esc(x.sec.given)}`:`<span class="muted">Đoạn này không có câu cho sẵn — xếp cả 5 câu</span>`;
    $("#slots",root).innerHTML=x.sec.order.map((_,k)=>`<div class="slot2 ${k<slotIdx?"done":k===slotIdx?"cur":""}" data-s="${k}"><b>${k+1}</b><span>${k<slotIdx?esc(fw(x.sec.order[k]))+"…":"·"}</span></div>`).join("");
    $("#ammo",root).innerHTML=pool.map((a,i)=>`<button class="am ${loaded===a?"on":""}" data-a="${i}" title="${esc(a.t)}"><b>${esc(fw(a.t))}…</b><span>${esc(a.t)}</span></button>`).join("");
    $$(".am",root).forEach(e=>e.onclick=()=>{ loaded=pool[+e.dataset.a]; beep("shoot"); draw(); });
    $("#ld",root).innerHTML=loaded?`<span class="tag0">đang nạp</span> ${hl(loaded.t)}`:"Chọn 1 viên đạn bên dưới để nạp vào ná";
    if(loaded && !draw._said){ draw._said=1; react(root,"t","wave","Kéo xuống rồi thả!",1500); }
    $("#balltxt",root).textContent=loaded?String.fromCharCode(65+pool.indexOf(loaded)):""; $("#ball",root).setAttribute("fill",loaded?"#f59e0b":"#d6d3cd");
    $("#fire",root).disabled=!loaded; $("#gsc",root).textContent=score; $("#gms",root).textContent=miss;
  }
  // drag
  const svg=$("#ss",root), pouch=$("#pouch",root); let drag=null;
  const setPouch=(dx,dy)=>{ $("#ball",root).setAttribute("cx",150+dx); $("#ball",root).setAttribute("cy",96+dy); $("#balltxt",root).setAttribute("x",150+dx); $("#balltxt",root).setAttribute("y",101+dy); ["b1","b2"].forEach(id=>{ $("#"+id,root).setAttribute("x2",150+dx); $("#"+id,root).setAttribute("y2",96+dy); }); };
  const pt=e=>{ const r=svg.getBoundingClientRect(); return {x:(e.clientX-r.left)*300/r.width, y:(e.clientY-r.top)*260/r.height}; };
  pouch.addEventListener("pointerdown",e=>{ if(!loaded) return; drag=pt(e); pouch.setPointerCapture(e.pointerId); });
  pouch.addEventListener("pointermove",e=>{ if(!drag) return; const p=pt(e); let dx=p.x-drag.x, dy=p.y-drag.y; dy=Math.max(0,Math.min(110,dy)); dx=Math.max(-60,Math.min(60,dx)); setPouch(dx,dy); drag.dy=dy; });
  pouch.addEventListener("pointerup",()=>{ if(!drag) return; const pulled=(drag.dy||0)>30; drag=null; setPouch(0,0); if(pulled) fire(); });
  $("#fire",root).onclick=fire;
  function fire(){ if(!loaded) return; beep("shoot");
    const sa=root.getBoundingClientRect(), b=$("#ball",root).getBoundingClientRect(), tgt=$(`[data-s="${slotIdx}"]`,root).getBoundingClientRect();
    const p=document.createElement("div"); p.className="proj big"; p.textContent=$("#balltxt",root).textContent; root.querySelector(".sling").appendChild(p);
    const sx=b.left-sa.left+b.width/2-16, sy=b.top-sa.top+b.height/2-16, tx=tgt.left-sa.left+tgt.width/2-16, ty=tgt.top-sa.top+tgt.height/2-16;
    p.style.transform=`translate(${sx}px,${sy}px)`; requestAnimationFrame(()=>{ p.style.transition="transform .35s cubic-bezier(.15,.8,.3,1)"; p.style.transform=`translate(${tx}px,${ty}px) scale(.8)`; });
    setTimeout(()=>{ p.remove(); if(!alive||!loaded) return; const ok=loaded.k===slotIdx; const el=$(`[data-s="${slotIdx}"]`,root);
      if(ok){ score+=10; beep("ok"); react(root,"k","cheer",pick(["Chuẩn ô!","Vào luôn!","Đúng rồi!"])); pool=pool.filter(a=>a!==loaded); loaded=null; slotIdx++; draw(); if(slotIdx>=x.sec.order.length) roundDone(); }
      else { miss++; score=Math.max(0,score-3); beep("bad"); react(root,"k","sad","Trượt mất…"); react(root,"t","think","Nhìn từ nối ở đầu câu nha!",1700); el.classList.add("shake"); if(!wrongs.includes(x)) { wrongs.push(x); noteWrong("r2",x.s.id); } setTimeout(()=>{ if(!alive) return; loaded=null; draw(); },450); } },360); }
  function roundDone(){ setTimeout(()=>{ if(!alive) return; react(root,"k","laugh","Xong đoạn! 🎉",1800); react(root,"t","cheer","Giỏi quá!",1800); $(".otp",root).insertAdjacentHTML("beforeend",`<div class="rdone"><div class="lbl">✓ Đúng thứ tự — chú ý từ nối tô cam</div><ol class="ord">${x.sec.order.map(t=>`<li>${hl(t)}</li>`).join("")}</ol><button class="btn b-main" id="nxr">${ri+1<rounds.length?"Đoạn tiếp →":"Xem kết quả"}</button></div>`);
      $("#ammo",root).innerHTML=""; $("#nxr",root).onclick=()=>{ ri++; if(ri>=rounds.length) end(); else setup(); }; },300); }
  function end(){ beep("end"); const kp=miss===0?"trophy":miss<4?"cheer":"sad", tl=miss===0?"Không trượt phát nào! 🏆":miss<4?"Ngon lành! Ôn lại đoạn sai nhé":"Luyện thêm chút là thuộc ngay!"; $(".sling",root).innerHTML=`<div class="gend"><div class="endmasc"><img src="${MASC.t[miss<4?"cheer":"wave"]}"><div class="endsay">${tl}</div><img src="${MASC.k[kp]}"></div><h3>${score} điểm</h3><div class="muted">${rounds.length} đoạn · bắn trượt ${miss} lần</div>
     ${wrongs.length?`<div class="wlist"><div class="lbl">Đoạn cần ôn lại</div>${wrongs.map(w=>`<div class="wi"><b>${esc(w.sec.t)}</b>: ${w.sec.order.map(t=>esc(fw(t))+"…").join(" → ")}</div>`).join("")}</div>`:`<div class="perfect">Không trượt phát nào 🎉</div>`}
     <div class="qfoot" style="justify-content:center"><button class="btn b-ghost" id="ga">Chơi ván mới</button>${wrongs.length?`<button class="btn b-main" id="gw">Chơi lại đoạn sai (${wrongs.length})</button>`:""}${wrongs.some(w=>!NB.has(w.s.id))?`<button class="btn b-ghost" id="gnb">＋ Thêm đề sai vào sổ key</button>`:""}</div></div>`;
    $("#ga",root).onclick=()=>renderShell(); const gw=$("#gw",root); if(gw) gw.onclick=()=>R2Game(root,shuffle(wrongs));
    const gnb=$("#gnb",root); if(gnb) gnb.onclick=()=>{ wrongs.forEach(w=>toggleNB("r2",w.s.id,true,"game")); gnb.textContent="✓ Đã thêm vào sổ key"; gnb.disabled=true; }; }
  setup();
}
renderShell();
return { destroy(){ stopGames(); closeDrawer(); ROOT.innerHTML=""; } };

}
