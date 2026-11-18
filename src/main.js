import { createClient } from "@supabase/supabase-js";
import "./style.css";

const sb = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);

const TOPICS=["자주 들은 노래","다시 먹고 싶은 음식","마음에 든 장소","오래 남은 작품","눈길이 간 색","자주 입은 옷","손이 많이 간 문구","좋아하는 사진 한 장","소소한 즐거움","나만의 소중한 물건",
"처음 해본 일","뜻밖의 취향","써먹어 본 배움","우연히 발견한 공간","추천받아 좋아진 것","새로 구독한 채널","생각보다 쉬웠던 일","생활을 바꾼 도구","나와 안 맞았던 것","최근 알게 된 사실",
"덜 좋아하게 된 것","새로 생긴 관심사","달라진 소비 기준","조금 익숙해진 일","그만두기로 한 것","내 취향대로 한 선택","생각이 바뀐 계기","자주 했던 말","스스로 기특했던 일","올해 초와 달라진 나",
"작은 행복을 느낀 순간","크게 웃었던 기억","에너지가 빠진 순간","기운을 되찾은 방법","혼자라서 좋았던 시간","함께라서 좋았던 시간","오래 남은 한마디","고마웠던 배려","기대와 달랐던 경험","요즘 마음을 차지한 것",
"올해 잘 산 물건","다시는 안 살 물건","돈 없이 즐긴 것","아깝지 않았던 시간","기억하고 싶은 하루","다시 꺼내고 싶은 취미","아직 해보고 싶은 일","이어가고 싶은 습관","내년에도 함께할 사람","기록하며 발견한 나"];
const SECTIONS=["좋아했던 것","새로 발견한 것","달라진 나","마음에 남은 순간","앞으로 남길 것"];
const EMOJIS=["🐰","🐻","🐱","🐶","🦊","🐼","🐸","🐧","🐥","🦄","🐹","🍓","🍑","🌷","🌙","⭐"];
const START=Date.UTC(2026,10,12), END=Date.UTC(2026,11,31), DAY=864e5;
const BUCKET="photos";
const CREDIT=`<p class="credit">50가지 주제는 kyul님의 ‘올해의 나 수집하기’에서 빌려 왔어요. © 2026 kyul</p>`;

/* ---------- utils ---------- */
const $=id=>document.getElementById(id);
function kstToday(){const d=new Date(Date.now()+9*36e5);return Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate());}
function dayOf(ms){return Math.floor((ms-START)/DAY)+1;}
function openUntil(){return Math.max(1,Math.min(50,dayOf(kstToday())));}
function dayDate(n,short){const d=new Date(START+(n-1)*DAY);return short?(d.getUTCMonth()+1)+"."+d.getUTCDate():(d.getUTCMonth()+1)+"월 "+d.getUTCDate()+"일 ("+"일월화수목금토"[d.getUTCDay()]+")";}
function dday(){const l=Math.round((END-kstToday())/DAY);return l>0?"D-"+l:l===0?"D-DAY":"완주!";}
function fmtTime(iso){if(!iso)return "";const d=new Date(new Date(iso).getTime()+9*36e5);return (d.getUTCMonth()+1)+"/"+d.getUTCDate()+" "+String(d.getUTCHours()).padStart(2,"0")+":"+String(d.getUTCMinutes()).padStart(2,"0");}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function extOf(type){return type==="image/png"?"png":type==="image/webp"?"webp":type==="image/gif"?"gif":"jpg";}

/* ---------- state ----------
   S.uid = 이 기기의 익명 로그인 id, S.me = 내가 앉은 자리 번호(문자열) */
const S={tab:"today",day:openUntil(),person:null,uid:null,me:null,authKnown:false,status:"loading",authFail:false,
  seats:[],members:{},answers:{},written:new Set(),urls:{},editing:false};

function wrote(id,n){return S.written.has(id+":"+n);}
function ans(id,n){return S.answers[id+":"+n]||null;}
function memberIds(){return Object.keys(S.members).sort((a,b)=>a-b);}
function mem(id){const m=S.members[id]||{};return {nick:m.nick||"빈자리",emoji:EMOJIS.includes(m.emoji)?m.emoji:"🙂",photo:m.photo_path||null};}
function face(id){const p=mem(id),u=p.photo&&S.urls[p.photo];return u?`<img src="${esc(u)}" alt="" onerror="this.replaceWith('${p.emoji}')">`:p.emoji;}
function countDay(n){return memberIds().filter(id=>wrote(id,n)).length;}
function myCount(id){let c=0;for(let n=1;n<=50;n++)if(wrote(id,n))c++;return c;}
function sealed(n,owner){return owner!==S.me&&!wrote(S.me,n);}
function streak(){if(!S.me)return 0;let n=openUntil();if(!wrote(S.me,n))n--;let c=0;while(n>=1&&wrote(S.me,n)){c++;n--;}return c;}

/* ---------- data ---------- */
async function signUrls(paths){
  const need=[...new Set(paths.filter(p=>p&&!S.urls[p]))];
  if(!need.length)return;
  const {data}=await sb.storage.from(BUCKET).createSignedUrls(need,60*60*24);
  (data||[]).forEach(d=>{if(d.signedUrl&&d.path)S.urls[d.path]=d.signedUrl;});
}
async function load(){
  const st=await sb.from("seats").select("seat,user_id,nick,emoji,photo_path,joined_at").order("seat");
  if(st.error){console.error(st.error);S.status="error";return;}
  S.seats=st.data;
  S.members=Object.fromEntries(st.data.filter(r=>r.nick).map(r=>[String(r.seat),r]));
  const mine=st.data.find(r=>r.user_id&&r.user_id===S.uid);
  S.me=mine?String(mine.seat):null;
  if(S.me){
    const [a,ds]=await Promise.all([sb.from("answers").select("*"),sb.rpc("day_status")]);
    if(a.error||ds.error){console.error(a.error||ds.error);S.status="error";return;}
    S.answers=Object.fromEntries(a.data.map(r=>[r.seat+":"+r.day,r]));
    S.written=new Set(ds.data.map(r=>r.seat+":"+r.day));
    await signUrls([...st.data.map(r=>r.photo_path),...a.data.map(r=>r.photo_path)]);
  }else{S.answers={};S.written=new Set();}
  S.status="ready";
}
let reloadTimer=null;
function scheduleReload(){clearTimeout(reloadTimer);reloadTimer=setTimeout(async()=>{if(!S.uid)return;const was=S.me;await load();if(was!==S.me)render();else refresh();},400);}
let channel=null,poll=null;
function startLive(){
  stopLive();
  channel=sb.channel("diary")
    .on("postgres_changes",{event:"*",schema:"public",table:"answers"},scheduleReload)
    .on("postgres_changes",{event:"*",schema:"public",table:"seats"},scheduleReload)
    .subscribe();
  poll=setInterval(()=>{if(document.visibilityState==="visible")scheduleReload();},60000);
}
function stopLive(){if(channel){sb.removeChannel(channel);channel=null;}clearInterval(poll);}
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"&&S.uid)scheduleReload();});

/* ---------- render ---------- */
function render(){renderLeft();renderTabs();renderMain();}
function refresh(){
  renderLeft();
  if(!S.me){renderMain();return;}
  if(S.tab==="today"&&$("compose")){renderStamps();renderFeed();if(!S.editing)renderCompose();}
  else renderMain();
}
function renderLeft(){
  const max=openUntil(),me=S.me?mem(S.me):null;
  const t=kstToday(),dow=(new Date(t).getUTCDay()+6)%7,mon=t-dow*DAY;
  let week="";
  ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].forEach(w=>week+=`<span class="wd dot">${w}</span>`);
  for(let i=0;i<7;i++){const ms=mon+i*DAY,n=dayOf(ms),d=new Date(ms).getUTCDate(),inR=S.me&&n>=1&&n<=50&&n<=max;
    week+=`<button class="dot ${inR&&wrote(S.me,n)?"done":""} ${ms===t?"today":""}" ${inR?`data-act="goday" data-day="${n}"`:"disabled"} aria-label="${d}일">${d}</button>`;}
  const st=streak();
  $("left").innerHTML=`
    <div class="counter dot">TODAY <b>${S.me?countDay(max):0}</b> | TOTAL <b class="total">${S.written.size}</b></div>
    <div class="todayis"><span class="dot" style="color:var(--link)">TODAY IS..</span><span>2026년 ${dday()}</span></div>
    <div class="avatar">${me?face(S.me):"📔"}</div>
    <p class="nick">${me?esc(me.nick):"올해의 나 수집하기"}</p>
    <p class="bio">${S.me?`${S.me}번 자리 · 모은 조각 ${myCount(S.me)} / 50`:"50일 동안 나를 모으는 다이어리"}</p>
    ${S.me?`<div class="edit-links dot"><button data-act="profile">EDIT</button><button data-tab="people">FRIENDS</button><button data-act="leave">LOGOUT</button></div>`:""}
    <div class="week">${week}</div>
    <p class="streak">${S.me?(st?`<b>${st}일 연속 기록 중</b><small>오늘도 한 조각 모아 볼까요</small>`:`<b>오늘 첫 조각을 모아 보세요</b><small>매일 쓰면 연속 기록이 쌓여요</small>`):""}</p>
    <div class="lfoot"><b>올해의 나 수집하기</b><br><span class="dot">2026.11.12 - 12.31</span></div>`;
}
function renderTabs(){
  const t=[["today","오늘의 주제"],["topics","50가지 주제"],["people","모아보기"]];
  $("tabs").innerHTML=S.me?t.map(([k,l])=>`<button class="tab" data-tab="${k}" ${S.tab===k?'aria-current="page"':""}>${l}</button>`).join(""):"";
}
function notices(){return S.status==="error"?`<div class="notice">기록을 불러오지 못했어요. 잠시 후 새로고침해 주세요.</div>`:"";}
function rhead(title){return `<div class="rhead"><h1>${title}</h1><small>${memberIds().length?memberIds().length+"명이 함께 수집 중":""}</small></div>`+notices();}
function renderMain(){
  const m=$("main");
  if(S.authFail){m.innerHTML=rhead("다이어리 열기")+`<div class="notice">다이어리에 연결하지 못했어요. 만든 사람은 Supabase에서 익명 로그인(Allow anonymous sign-ins)이 켜져 있는지 확인해 주세요.</div>`;return;}
  if(!S.authKnown||!S.uid||S.status==="loading"){m.innerHTML=`<p class="empty">다이어리를 펼치는 중…</p>`;return;}
  if(!S.me){m.innerHTML=viewSeats();return;}
  if(S.tab==="topics")m.innerHTML=viewTopics();
  else if(S.tab==="people")m.innerHTML=viewPeople();
  else{
    const n=S.day;
    m.innerHTML=rhead("우리들의 올해")+`
      <div class="dayline"><button class="arrow" data-act="prev" ${n<=1?"disabled":""} aria-label="이전 날">‹</button><span><span class="dot">DAY ${n}</span> · ${dayDate(n)}${n===openUntil()?" · 오늘":""}</span><button class="arrow" data-act="next" ${n>=50?"disabled":""} aria-label="다음 날">›</button></div>
      <div class="pcard"><div class="sec">${SECTIONS[Math.floor((n-1)/10)]}</div><h2><span class="hl">${TOPICS[n-1]}</span></h2><div class="stamps" id="stamps"></div></div>
      <div id="compose"></div><div id="feedwrap"></div>`;
    S.editing=false;renderStamps();renderCompose();renderFeed();
  }
}

/* ---------- seats ---------- */
function viewSeats(){
  return rhead("자리 고르기")+`<p class="progtxt" style="font-size:14px;color:var(--ink)">처음이면 <b>빈자리</b>를 골라 앉고, 전에 앉았던 자리가 있으면 <b>내 자리</b>를 눌러 비밀번호를 입력해 주세요.</p>
    <div class="people">${S.seats.map(r=>{const id=String(r.seat);
      return r.nick?`<button class="friend" data-act="seat" data-seat="${id}"><span class="big">${face(id)}</span><span><b>${esc(r.nick)}</b><small>${id}번 자리 · 들어가기</small></span></button>`
        :`<button class="friend seat-empty" data-act="seat" data-seat="${id}"><span class="big">＋</span><span><b>빈자리</b><small>${id}번 자리 · 앉기</small></span></button>`;}).join("")}</div>`+CREDIT;
}
const sheetEl=$("sheet");
function closeSheet(){sheetEl.innerHTML="";}
let pickEmoji=null,pickPhoto=null;
function emojiGrid(){return `<div class="emojis">${EMOJIS.map(e=>`<button data-act="emoji" data-e="${e}" aria-pressed="${e===pickEmoji}">${e}</button>`).join("")}</div>`;}
function openSeat(id){
  const r=S.members[id];
  if(r){
    sheetEl.innerHTML=`<div class="scrim" data-act="close"></div><div class="sheet" role="dialog" aria-modal="true" aria-label="자리 들어가기">
      <h3>${id}번 자리 · ${esc(r.nick)}</h3><p class="sub">이 자리 주인이면 비밀번호를 입력해 주세요.</p>
      <input type="password" id="c-pin" autocomplete="current-password" placeholder="비밀번호">
      <div class="tools"><span class="sp"></span><button class="btn" data-act="close">닫기</button><button class="btn main" data-act="enter" data-seat="${id}">들어가기</button></div>
      <p class="err" id="c-err" role="status"></p></div>`;
    setTimeout(()=>$("c-pin")?.focus(),50);
  }else{
    pickEmoji=EMOJIS[Math.floor(Math.random()*EMOJIS.length)];
    sheetEl.innerHTML=`<div class="scrim" data-act="close"></div><div class="sheet" role="dialog" aria-modal="true" aria-label="빈자리에 앉기">
      <h3>${id}번 빈자리에 앉기</h3><p class="sub">친구들에게 보일 닉네임과 캐릭터, 다음에 다시 들어올 때 쓸 비밀번호를 정해 주세요. 프로필 사진은 들어간 뒤에 EDIT에서 올릴 수 있어요.</p>
      <input type="text" id="c-nick" maxlength="12" placeholder="닉네임">
      ${emojiGrid()}
      <input type="password" id="c-pin" autocomplete="new-password" placeholder="비밀번호 (4자 이상)" style="margin-bottom:8px">
      <input type="password" id="c-pin2" autocomplete="new-password" placeholder="비밀번호 한 번 더">
      <div class="tools"><span class="sp"></span><button class="btn" data-act="close">닫기</button><button class="btn main" data-act="sit" data-seat="${id}">앉기</button></div>
      <p class="err" id="c-err" role="status"></p></div>`;
    setTimeout(()=>$("c-nick")?.focus(),50);
  }
}
const CLAIM_MSG={wrong:"비밀번호가 맞지 않아요. 5번 틀리면 10분 동안 잠겨요.",locked:"비밀번호를 여러 번 틀려서 10분 동안 잠겼어요.",
  taken:"방금 다른 친구가 이 자리에 앉았어요. 다른 빈자리를 골라 주세요.",empty:"아직 아무도 안 앉은 자리예요.",short:"비밀번호는 4자 이상으로 해 주세요.",
  need_nick:"닉네임을 적어 주세요.",no_seat:"없는 자리예요.",no_auth:"연결이 끊겼어요. 새로고침해 주세요."};
async function claim(btn,mode){
  const id=btn.dataset.seat,err=$("c-err"),pin=$("c-pin").value;
  let nick=null;
  if(mode==="new"){
    nick=$("c-nick").value.trim();
    if(!nick){err.textContent=CLAIM_MSG.need_nick;return;}
    if(pin.length<4){err.textContent=CLAIM_MSG.short;return;}
    if(pin!==$("c-pin2").value){err.textContent="비밀번호 두 개가 서로 달라요.";return;}
  }else if(!pin){err.textContent="비밀번호를 입력해 주세요.";return;}
  btn.disabled=true;
  const {data,error}=await sb.rpc("claim_seat",{p_seat:+id,p_pin:pin,p_mode:mode,p_nick:nick,p_emoji:pickEmoji});
  if(error||data!=="ok"){btn.disabled=false;err.textContent=error?"잠시 후 다시 시도해 주세요.":(CLAIM_MSG[data]||"잠시 후 다시 시도해 주세요.");if(data==="taken")scheduleReload();return;}
  closeSheet();S.status="loading";render();await load();render();
}

/* ---------- today ---------- */
function renderStamps(){
  const el=$("stamps");if(!el)return;const n=S.day,ids=memberIds(),w=ids.filter(id=>wrote(id,n)).length;
  el.innerHTML=ids.map(id=>`<span class="stamp ${wrote(id,n)?"on":""}" title="${esc(mem(id).nick)}">${face(id)}</span>`).join("")+`<small>${ids.length}명 중 ${w}명이 남겼어요</small>`;
}
let draftImg=null; // {path,url} 기존 사진 | {blob,url} 새 사진
function renderCompose(){
  const el=$("compose");if(!el)return;
  const n=S.day,mine=ans(S.me,n);
  if(n>openUntil()){el.innerHTML=`<div class="locked">🔒 ${dayDate(n)}에 열리는 페이지예요</div>`;S.editing=false;return;}
  if(mine&&!S.editing){
    const u=mine.photo_path&&S.urls[mine.photo_path];
    el.innerHTML=`<div class="paper"><div class="who">✍️ 내 답 · ${fmtTime(mine.updated_at||mine.created_at)}</div>${mine.body?`<div class="mine-txt">${esc(mine.body)}</div>`:""}${u?`<div class="paper-img"><img src="${esc(u)}" alt="내가 남긴 사진" onerror="this.remove()"></div>`:""}
      <div class="tools"><span class="sp"></span><button class="btn" data-act="edit-mine">수정하기</button></div></div>`;
    return;
  }
  S.editing=true;
  draftImg=mine&&mine.photo_path?{path:mine.photo_path,url:S.urls[mine.photo_path]}:null;
  el.innerHTML=`<div class="paper"><textarea id="w-text" maxlength="1500" aria-label="내 답" placeholder="✍️ 오늘의 주제를 떠올리며 적어 보세요. 한 줄도 좋아요.">${esc(mine?.body||"")}</textarea>
    <div id="w-prev"></div>
    <div class="tools"><label class="btn file">📷 사진 붙이기<input type="file" id="w-file" accept="image/png,image/jpeg,image/webp,image/gif"></label><span class="sp"></span>
      ${mine?`<button class="btn" data-act="cancel">취소</button><button class="btn" data-act="del">지우기</button>`:""}<button class="btn main" data-act="save">남기기</button></div>
    <p class="err" id="w-err" role="status"></p></div>`;
  drawPreview();
  const f=$("w-file");
  f.addEventListener("change",async()=>{const file=f.files[0];if(!file)return;const blob=await shrink(file);draftImg={blob,url:URL.createObjectURL(blob)};drawPreview();});
}
function drawPreview(){
  const el=$("w-prev");if(!el)return;
  el.innerHTML=draftImg&&draftImg.url?`<div class="paper-img"><img src="${esc(draftImg.url)}" alt="붙인 사진"><button data-act="noimg" aria-label="사진 떼기">✕</button></div>`:"";
}
function renderFeed(){
  const el=$("feedwrap");if(!el)return;const n=S.day;
  if(n>openUntil()){el.innerHTML="";return;}
  const others=memberIds().filter(id=>id!==S.me&&wrote(id,n))
    .sort((a,b)=>new Date((ans(a,n)||{}).created_at||0)-new Date((ans(b,n)||{}).created_at||0));
  el.innerHTML=`<h3 class="sub-h">친구들의 답 <small>${others.length}개</small></h3>`+(others.length?others.map(id=>sayItem(id,n)).join(""):`<p class="empty">아직 친구들 답이 없어요. 단톡방에 슬쩍 알려 볼까요?</p>`);
}
function sayItem(id,n){
  const p=mem(id),a=ans(id,n);
  if(sealed(n,id)||!a)return `<div class="say sealed"><div class="who"><span class="av">${face(id)}</span><b>${esc(p.nick)}</b></div><p>🔒 내 답을 남기면 열려요</p></div>`;
  const u=a.photo_path&&S.urls[a.photo_path];
  return `<div class="say"><div class="who"><span class="av">${face(id)}</span><b>${esc(p.nick)}</b><span class="t dot">${fmtTime(a.updated_at||a.created_at)}</span></div>${a.body?`<p>${esc(a.body)}</p>`:""}${u?`<img src="${esc(u)}" alt="${esc(p.nick)}의 사진" loading="lazy" onerror="this.remove()">`:""}</div>`;
}

/* ---------- topics / people ---------- */
function viewTopics(){
  const max=openUntil(),total=memberIds().length;
  let h=rhead("50가지 주제")+`<p class="progtxt">내가 모은 조각 ${myCount(S.me)} / 50</p><div class="prog">`;
  for(let n=1;n<=50;n++)h+=`<i class="${wrote(S.me,n)?"on":""} ${n===max?"now":""}" title="${n}일차"></i>`;
  h+=`</div>`;
  SECTIONS.forEach((s,i)=>{
    h+=`<h3 class="sub-h"><span><span class="tag t${i}">${s}</span></span><small class="dot">DAY ${i*10+1}-${i*10+10} · ${dayDate(i*10+1,1)}-${dayDate(i*10+10,1)}</small></h3><div class="rows">`;
    for(let n=i*10+1;n<=i*10+10;n++){const fut=n>max;
      h+=`<button class="row ${n===max?"now":""} ${fut?"future":""}" data-act="goday" data-day="${n}"><span class="n dot">${String(n).padStart(2,"0")}</span><span class="tt">${TOPICS[n-1]}</span><span class="d dot">${dayDate(n,1)}</span><span class="cnt">${fut?"":countDay(n)+"/"+total}</span><span class="ck">${fut?"🔒":wrote(S.me,n)?"✓":""}</span></button>`;}
    h+=`</div>`;
  });
  return h+CREDIT;
}
function viewPeople(){
  if(S.person)return viewPerson(S.person);
  const ids=memberIds();
  return rhead("친구별 모아보기")+`<div class="people">`+ids.map(id=>{const p=mem(id),c=myCount(id);
    return `<button class="friend" data-act="person" data-id="${id}"><span class="big">${face(id)}</span><span><b>${esc(p.nick)}${id===S.me?" (나)":""}</b><span class="bar"><i style="width:${c*2}%"></i></span><small>${c} / 50 조각</small></span></button>`;}).join("")+`</div>`;
}
function viewPerson(id){
  const p=mem(id);
  let h=`<button class="back" data-act="unperson">‹ 친구 목록</button>`+rhead(`${p.emoji} ${esc(p.nick)}의 올해`);
  let any=false;
  for(let n=1;n<=50;n++){if(!wrote(id,n))continue;any=true;
    const a=ans(id,n),seal=sealed(n,id)||!a,u=a&&a.photo_path&&S.urls[a.photo_path];
    h+=`<div class="say${seal?" sealed":""}"><p class="q" style="margin:0"><span class="hl">${TOPICS[n-1]}</span></p><div class="qd dot">DAY ${n} · ${dayDate(n,1)}</div>`+
      (seal?`<p style="margin-left:0">🔒 이 날 내 답을 먼저 남기면 열려요</p>`:`${a.body?`<p style="margin-left:0">${esc(a.body)}</p>`:""}${u?`<img style="margin-left:0" src="${esc(u)}" alt="" loading="lazy" onerror="this.remove()">`:""}`)+`</div>`;}
  return h+(any?"":`<p class="empty">아직 남긴 조각이 없어요.</p>`);
}

/* ---------- write ---------- */
async function shrink(file,square){
  try{
    const bmp=await createImageBitmap(file);const c=document.createElement("canvas");
    if(square){const s=Math.min(bmp.width,bmp.height),size=Math.min(600,s);c.width=c.height=size;c.getContext("2d").drawImage(bmp,(bmp.width-s)/2,(bmp.height-s)/2,s,s,0,0,size,size);}
    else{const k=Math.min(1,1600/Math.max(bmp.width,bmp.height));c.width=Math.round(bmp.width*k);c.height=Math.round(bmp.height*k);c.getContext("2d").drawImage(bmp,0,0,c.width,c.height);}
    return await new Promise(r=>c.toBlob(b=>r(b||file),"image/jpeg",.86));
  }catch(e){return file;}
}
async function uploadBlob(blob,prefix){
  const path=`${S.me}/${prefix}-${Date.now()}.${extOf(blob.type)}`;
  const {error}=await sb.storage.from(BUCKET).upload(path,blob,{contentType:blob.type||"image/jpeg"});
  if(error)throw error;
  S.urls[path]=URL.createObjectURL(blob);
  return path;
}
function removeFile(path){if(path)sb.storage.from(BUCKET).remove([path]).catch(()=>{});}
function errText(e){
  const msg=String(e&&(e.message||e.error)||"").toLowerCase();
  if(e&&(e.code==="42501"||msg.includes("row-level security")))return "아직 열리지 않은 날이거나, 다른 기기에서 이 자리로 들어와서 연결이 끊겼어요. 새로고침해 주세요.";
  if(msg.includes("size")||msg.includes("too large"))return "사진이 너무 커요. 다른 사진을 골라 주세요.";
  if(msg.includes("mime")||msg.includes("type"))return "이 형식의 사진은 붙일 수 없어요. JPG나 PNG로 골라 주세요.";
  return "저장하지 못했어요. 잠시 후 다시 눌러 주세요.";
}
async function save(btn){
  const n=S.day,err=$("w-err"),body=$("w-text").value.trim();
  if(!body&&!draftImg){err.textContent="글이나 사진 중 하나는 남겨 주세요.";return;}
  btn.disabled=true;btn.textContent="저장하는 중…";
  const old=ans(S.me,n);
  try{
    let path=draftImg&&draftImg.path||null;
    if(draftImg&&draftImg.blob)path=await uploadBlob(draftImg.blob,"day"+n);
    const {error}=await sb.from("answers").upsert({seat:+S.me,day:n,body,photo_path:path,updated_at:new Date().toISOString()});
    if(error)throw error;
    if(old&&old.photo_path&&old.photo_path!==path)removeFile(old.photo_path);
    await load();S.editing=false;renderCompose();refresh();
  }catch(e){console.error(e);err.textContent=errText(e);btn.disabled=false;btn.textContent="남기기";}
}
async function del(btn){
  if(!confirm("이 날의 답을 지울까요?"))return;
  btn.disabled=true;const old=ans(S.me,S.day);
  const {error}=await sb.from("answers").delete().match({seat:+S.me,day:S.day});
  if(error){$("w-err").textContent=errText(error);btn.disabled=false;return;}
  if(old)removeFile(old.photo_path);
  await load();S.editing=false;renderCompose();refresh();
}

/* ---------- profile ---------- */
function drawPfp(){const el=$("pfp");if(!el)return;el.innerHTML=pickPhoto&&pickPhoto.url?`<img src="${esc(pickPhoto.url)}" alt="프로필 사진">`:pickEmoji;}
function openProfile(){
  const m=S.members[S.me]||{};
  pickEmoji=EMOJIS.includes(m.emoji)?m.emoji:EMOJIS[0];
  pickPhoto=m.photo_path?{path:m.photo_path,url:S.urls[m.photo_path]}:null;
  sheetEl.innerHTML=`<div class="scrim" data-act="close"></div><div class="sheet" role="dialog" aria-modal="true" aria-label="프로필">
    <h3>프로필 바꾸기</h3><p class="sub">${S.me}번 자리 · 친구들에게 보일 닉네임과 프로필이에요.</p>
    <input type="text" id="p-nick" maxlength="12" placeholder="닉네임" value="${esc(m.nick||"")}">
    <div class="pfrow"><div class="pfp" id="pfp"></div><div><div class="sub" style="margin:0 0 6px">프로필 사진 (없으면 아래 캐릭터가 보여요)</div><div class="btns"><label class="btn file">📷 사진 올리기<input type="file" id="p-file" accept="image/png,image/jpeg,image/webp,image/gif"></label><button class="btn" data-act="pnophoto">사진 빼기</button></div></div></div>
    ${emojiGrid()}
    <div class="sub" style="margin:4px 0 6px">비밀번호 바꾸기 (바꿀 때만 입력, 4자 이상)</div>
    <input type="password" id="p-pw" autocomplete="new-password" placeholder="새 비밀번호" style="margin-bottom:14px">
    <div class="tools" style="margin:0"><span class="sp"></span><button class="btn" data-act="close">닫기</button><button class="btn main" data-act="psave">저장하기</button></div><p class="err" id="p-err" role="status"></p></div>`;
  drawPfp();
  const pf=$("p-file");
  pf.addEventListener("change",async()=>{const file=pf.files[0];if(!file)return;const blob=await shrink(file,true);pickPhoto={blob,url:URL.createObjectURL(blob)};drawPfp();});
}
async function saveProfile(btn){
  const nick=$("p-nick").value.trim(),pw=$("p-pw").value,err=$("p-err");
  if(!nick){err.textContent="닉네임을 적어 주세요.";return;}
  if(pw&&pw.length<4){err.textContent="비밀번호는 4자 이상으로 해 주세요.";return;}
  btn.disabled=true;
  const old=(S.members[S.me]||{}).photo_path||null;
  try{
    let path=pickPhoto&&pickPhoto.path||null;
    if(pickPhoto&&pickPhoto.blob)path=await uploadBlob(pickPhoto.blob,"avatar");
    const {error}=await sb.from("seats").update({nick,emoji:pickEmoji,photo_path:path}).eq("seat",+S.me);
    if(error)throw error;
    if(old&&old!==path)removeFile(old);
    if(pw){const {data,error:pe}=await sb.rpc("change_pin",{p_new:pw});if(pe||data!=="ok")throw new Error("pin");}
    await load();closeSheet();render();
  }catch(e){console.error(e);err.textContent=e.message==="pin"?"프로필은 저장됐지만 비밀번호는 못 바꿨어요. 다시 시도해 주세요.":errText(e);btn.disabled=false;}
}

/* ---------- events ---------- */
document.addEventListener("click",e=>{
  const t=e.target.closest("[data-tab],[data-act]");if(!t)return;
  if(t.dataset.tab){if(t.dataset.tab==="people")S.person=null;if(location.hash==="#"+t.dataset.tab)render();else location.hash="#"+t.dataset.tab;return;}
  const a=t.dataset.act;
  if(a==="prev"&&S.day>1){S.day--;renderMain();}
  else if(a==="next"&&S.day<50){S.day++;renderMain();}
  else if(a==="goday"){S.day=+t.dataset.day;if(S.tab==="today")renderMain();else location.hash="#today";$("rightpage").scrollTop=0;}
  else if(a==="edit-mine"){S.editing=true;renderCompose();}
  else if(a==="cancel"){S.editing=false;renderCompose();}
  else if(a==="save")save(t);
  else if(a==="del")del(t);
  else if(a==="noimg"){draftImg=null;drawPreview();}
  else if(a==="person"){S.person=t.dataset.id;renderMain();$("rightpage").scrollTop=0;}
  else if(a==="unperson"){S.person=null;renderMain();}
  else if(a==="profile")openProfile();
  else if(a==="close")closeSheet();
  else if(a==="emoji"){pickEmoji=t.dataset.e;sheetEl.querySelectorAll("[data-act=emoji]").forEach(b=>b.setAttribute("aria-pressed",b.dataset.e===pickEmoji));drawPfp();}
  else if(a==="pnophoto"){pickPhoto=null;drawPfp();}
  else if(a==="psave")saveProfile(t);
  else if(a==="seat")openSeat(t.dataset.seat);
  else if(a==="sit")claim(t,"new");
  else if(a==="enter")claim(t,"enter");
  else if(a==="leave"){if(confirm("이 기기에서 나갈까요? 다시 들어올 때 내 자리 비밀번호가 필요해요."))sb.auth.signOut();}
});
document.addEventListener("keydown",e=>{
  if(e.key==="Escape"&&sheetEl.innerHTML)closeSheet();
  if(e.key==="Enter"&&(e.target.id==="c-pin"||e.target.id==="c-pin2"))document.querySelector("[data-act=sit],[data-act=enter]")?.click();
});
function readHash(){const h=location.hash.slice(1);S.tab=["today","topics","people"].includes(h)?h:"today";}
window.addEventListener("hashchange",()=>{readHash();render();$("rightpage").scrollTop=0;});

/* ---------- auth: 기기마다 자동 익명 로그인 → 자리로 본인 확인 ---------- */
async function onUser(uid){
  S.authKnown=true;S.uid=uid;
  if(!uid){
    stopLive();closeSheet();
    Object.assign(S,{me:null,seats:[],members:{},answers:{},written:new Set(),urls:{},status:"loading"});
    render();
    const {error}=await sb.auth.signInAnonymously();
    if(error){console.error(error);S.authFail=true;render();}
    return;
  }
  S.authFail=false;S.status="loading";render();
  await load();render();
  startLive();
}
sb.auth.onAuthStateChange((_ev,session)=>{
  const uid=session?.user?.id||null;
  if(S.authKnown&&uid===S.uid)return;
  setTimeout(()=>onUser(uid),0);
});
readHash();render();
