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

/* ---------- state ---------- */
const S={tab:"today",day:openUntil(),person:null,uid:null,authKnown:false,status:"loading",
  members:{},answers:{},written:new Set(),urls:{},editing:false,askedProfile:false,
  login:{step:"email",email:""}};

function wrote(id,n){return S.written.has(id+":"+n);}
function ans(id,n){return S.answers[id+":"+n]||null;}
function memberIds(){
  const ids=new Set(Object.keys(S.members));S.written.forEach(k=>ids.add(k.split(":")[0]));
  return [...ids].sort((a,b)=>new Date((S.members[a]||{}).joined_at||9e15)-new Date((S.members[b]||{}).joined_at||9e15));
}
function mem(id){const m=S.members[id]||{};return {nick:m.nick||"이름 없는 친구",emoji:EMOJIS.includes(m.emoji)?m.emoji:"🙂",photo:m.photo_path||null};}
function face(id){const p=mem(id),u=p.photo&&S.urls[p.photo];return u?`<img src="${esc(u)}" alt="" onerror="this.replaceWith('${p.emoji}')">`:p.emoji;}
function countDay(n){return memberIds().filter(id=>wrote(id,n)).length;}
function myCount(id){let c=0;for(let n=1;n<=50;n++)if(wrote(id,n))c++;return c;}
function sealed(n,owner){return owner!==S.uid&&!wrote(S.uid,n);}
function streak(){if(!S.uid)return 0;let n=openUntil();if(!wrote(S.uid,n))n--;let c=0;while(n>=1&&wrote(S.uid,n)){c++;n--;}return c;}

/* ---------- data ---------- */
async function signUrls(paths){
  const need=[...new Set(paths.filter(p=>p&&!S.urls[p]))];
  if(!need.length)return;
  const {data}=await sb.storage.from(BUCKET).createSignedUrls(need,60*60*24);
  (data||[]).forEach(d=>{if(d.signedUrl&&d.path)S.urls[d.path]=d.signedUrl;});
}
async function load(){
  const [m,a,st]=await Promise.all([sb.from("members").select("*"),sb.from("answers").select("*"),sb.rpc("day_status")]);
  if(m.error||a.error||st.error){console.error(m.error||a.error||st.error);S.status="error";return;}
  S.members=Object.fromEntries(m.data.map(r=>[r.id,r]));
  S.answers=Object.fromEntries(a.data.map(r=>[r.user_id+":"+r.day,r]));
  S.written=new Set(st.data.map(r=>r.user_id+":"+r.day));
  await signUrls([...m.data.map(r=>r.photo_path),...a.data.map(r=>r.photo_path)]);
  S.status="ready";
}
let reloadTimer=null;
function scheduleReload(){clearTimeout(reloadTimer);reloadTimer=setTimeout(async()=>{if(!S.uid)return;await load();refresh();},400);}
let channel=null,poll=null;
function startLive(){
  stopLive();
  channel=sb.channel("diary")
    .on("postgres_changes",{event:"*",schema:"public",table:"answers"},scheduleReload)
    .on("postgres_changes",{event:"*",schema:"public",table:"members"},scheduleReload)
    .subscribe();
  // 내가 아직 안 쓴 날의 친구 글은 실시간 이벤트가 안 오므로 가볍게 주기 갱신
  poll=setInterval(()=>{if(document.visibilityState==="visible")scheduleReload();},60000);
}
function stopLive(){if(channel){sb.removeChannel(channel);channel=null;}clearInterval(poll);}
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"&&S.uid)scheduleReload();});

/* ---------- render ---------- */
function render(){renderLeft();renderTabs();renderMain();}
function refresh(){
  renderLeft();
  if(!S.uid)return;
  if(S.tab==="today"&&$("compose")){renderStamps();renderFeed();if(!S.editing)renderCompose();}
  else renderMain();
}
function renderLeft(){
  const max=openUntil(),me=S.uid&&S.members[S.uid]?mem(S.uid):null;
  const t=kstToday(),dow=(new Date(t).getUTCDay()+6)%7,mon=t-dow*DAY;
  let week="";
  ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].forEach(w=>week+=`<span class="wd dot">${w}</span>`);
  for(let i=0;i<7;i++){const ms=mon+i*DAY,n=dayOf(ms),d=new Date(ms).getUTCDate(),inR=S.uid&&n>=1&&n<=50&&n<=max;
    week+=`<button class="dot ${inR&&wrote(S.uid,n)?"done":""} ${ms===t?"today":""}" ${inR?`data-act="goday" data-day="${n}"`:"disabled"} aria-label="${d}일">${d}</button>`;}
  const st=streak();
  $("left").innerHTML=`
    <div class="counter dot">TODAY <b>${S.uid?countDay(max):0}</b> | TOTAL <b class="total">${S.written.size}</b></div>
    <div class="todayis"><span class="dot" style="color:var(--link)">TODAY IS..</span><span>2026년 ${dday()}</span></div>
    <div class="avatar">${me?face(S.uid):"📔"}</div>
    <p class="nick">${me?esc(me.nick):"올해의 나 수집하기"}</p>
    <p class="bio">${S.uid?`내가 모은 조각 ${myCount(S.uid)} / 50`:"50일 동안 나를 모으는 다이어리"}</p>
    ${S.uid?`<div class="edit-links dot"><button data-act="profile">EDIT</button><button data-tab="people">FRIENDS</button><button data-act="logout">LOGOUT</button></div>`:""}
    <div class="week">${week}</div>
    <p class="streak">${S.uid?(st?`<b>${st}일 연속 기록 중</b><small>오늘도 한 조각 모아 볼까요</small>`:`<b>오늘 첫 조각을 모아 보세요</b><small>매일 쓰면 연속 기록이 쌓여요</small>`):""}</p>
    <div class="lfoot"><b>올해의 나 수집하기</b><br><span class="dot">2026.11.12 - 12.31</span></div>`;
}
function renderTabs(){
  const t=[["today","오늘의 주제"],["topics","50가지 주제"],["people","모아보기"]];
  $("tabs").innerHTML=S.uid?t.map(([k,l])=>`<button class="tab" data-tab="${k}" ${S.tab===k?'aria-current="page"':""}>${l}</button>`).join(""):"";
}
function notices(){
  if(S.status==="error")return `<div class="notice">기록을 불러오지 못했어요. 잠시 후 새로고침해 주세요.</div>`;
  return "";
}
function rhead(title){return `<div class="rhead"><h1>${title}</h1><small>${S.uid?memberIds().length+"명이 함께 수집 중":""}</small></div>`+notices();}
function renderMain(){
  const m=$("main");
  if(!S.authKnown){m.innerHTML=`<p class="empty">다이어리를 펼치는 중…</p>`;return;}
  if(!S.uid){m.innerHTML=viewLogin();return;}
  if(S.status==="loading"){m.innerHTML=rhead("우리들의 올해")+`<p class="empty">기록을 불러오는 중…</p>`;return;}
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

/* ---------- login ---------- */
function viewLogin(){
  const L=S.login;
  if(L.step==="code")return rhead("다이어리 열기")+`<div class="login">
    <p class="ok">${esc(L.email)}으로 로그인 메일을 보냈어요.</p>
    <p class="hint">메일 속 링크를 누르거나, 메일에 적힌 숫자 코드를 아래에 입력해 주세요. 메일이 안 보이면 스팸함도 확인해 주세요.</p>
    <div class="field"><input id="l-code" inputmode="numeric" autocomplete="one-time-code" maxlength="10" placeholder="숫자 코드" aria-label="숫자 코드"><button class="btn main" data-act="verify">들어가기</button></div>
    <p class="err" id="l-err" role="status"></p>
    <button class="back" data-act="relogin">‹ 다른 이메일로 하기</button></div>`;
  return rhead("다이어리 열기")+`<div class="login">
    <p>친구들끼리만 쓰는 다이어리예요. 초대받은 이메일을 적으면 로그인 메일을 보내 드려요. 비밀번호는 필요 없어요.</p>
    <div class="field"><input id="l-email" type="email" autocomplete="email" placeholder="이메일 주소" aria-label="이메일 주소" value="${esc(L.email)}"><button class="btn main" data-act="send">로그인 메일 받기</button></div>
    <p class="err" id="l-err" role="status"></p>
    <p class="credit">50가지 주제는 kyul님의 ‘올해의 나 수집하기’에서 빌려 왔어요. © 2026 kyul</p></div>`;
}
async function sendMail(btn){
  const email=$("l-email").value.trim(),err=$("l-err");
  if(!/^\S+@\S+\.\S+$/.test(email)){err.textContent="이메일 주소를 확인해 주세요.";return;}
  btn.disabled=true;btn.textContent="보내는 중…";
  const {error}=await sb.auth.signInWithOtp({email,options:{shouldCreateUser:false,emailRedirectTo:location.origin}});
  if(error){
    btn.disabled=false;btn.textContent="로그인 메일 받기";
    const msg=(error.message||"").toLowerCase();
    err.textContent=msg.includes("signup")||msg.includes("not allowed")||msg.includes("not found")?"초대받지 않은 이메일이에요. 다이어리를 만든 친구에게 등록을 부탁해 주세요."
      :error.status===429||msg.includes("rate")?"메일을 너무 자주 요청했어요. 1분쯤 뒤에 다시 눌러 주세요."
      :"메일을 보내지 못했어요. 잠시 후 다시 시도해 주세요.";
    return;
  }
  S.login={step:"code",email};renderMain();setTimeout(()=>$("l-code")?.focus(),50);
}
async function verifyCode(btn){
  const token=$("l-code").value.replace(/\D/g,""),err=$("l-err");
  if(token.length<6){err.textContent="메일에 적힌 숫자 코드를 모두 입력해 주세요.";return;}
  btn.disabled=true;
  const {error}=await sb.auth.verifyOtp({email:S.login.email,token,type:"email"});
  if(error){btn.disabled=false;err.textContent="코드가 맞지 않거나 시간이 지났어요. 새 메일을 받아 다시 시도해 주세요.";}
}

/* ---------- today ---------- */
function renderStamps(){
  const el=$("stamps");if(!el)return;const n=S.day,ids=memberIds(),w=ids.filter(id=>wrote(id,n)).length;
  el.innerHTML=ids.map(id=>`<span class="stamp ${wrote(id,n)?"on":""}" title="${esc(mem(id).nick)}">${face(id)}</span>`).join("")+`<small>${ids.length?`${ids.length}명 중 ${w}명이 남겼어요`:"아직 아무도 없어요"}</small>`;
}
let draftImg=null; // {path,url} 기존 사진 | {blob,url} 새 사진
function renderCompose(){
  const el=$("compose");if(!el)return;
  const n=S.day,mine=ans(S.uid,n);
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
  const others=memberIds().filter(id=>id!==S.uid&&wrote(id,n))
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
  let h=rhead("50가지 주제")+`<p class="progtxt">내가 모은 조각 ${myCount(S.uid)} / 50</p><div class="prog">`;
  for(let n=1;n<=50;n++)h+=`<i class="${wrote(S.uid,n)?"on":""} ${n===max?"now":""}" title="${n}일차"></i>`;
  h+=`</div>`;
  SECTIONS.forEach((s,i)=>{
    h+=`<h3 class="sub-h"><span><span class="tag t${i}">${s}</span></span><small class="dot">DAY ${i*10+1}-${i*10+10} · ${dayDate(i*10+1,1)}-${dayDate(i*10+10,1)}</small></h3><div class="rows">`;
    for(let n=i*10+1;n<=i*10+10;n++){const fut=n>max;
      h+=`<button class="row ${n===max?"now":""} ${fut?"future":""}" data-act="goday" data-day="${n}"><span class="n dot">${String(n).padStart(2,"0")}</span><span class="tt">${TOPICS[n-1]}</span><span class="d dot">${dayDate(n,1)}</span><span class="cnt">${fut?"":countDay(n)+"/"+total}</span><span class="ck">${fut?"🔒":wrote(S.uid,n)?"✓":""}</span></button>`;}
    h+=`</div>`;
  });
  return h+`<p class="credit">50가지 주제는 kyul님의 ‘올해의 나 수집하기’에서 빌려 왔어요. © 2026 kyul</p>`;
}
function viewPeople(){
  if(S.person)return viewPerson(S.person);
  const ids=memberIds();
  return rhead("친구별 모아보기")+(ids.length?`<div class="people">`+ids.map(id=>{const p=mem(id),c=myCount(id);
    return `<button class="friend" data-act="person" data-id="${esc(id)}"><span class="big">${face(id)}</span><span><b>${esc(p.nick)}${id===S.uid?" (나)":""}</b><span class="bar"><i style="width:${c*2}%"></i></span><small>${c} / 50 조각</small></span></button>`;}).join("")+`</div>`
    :`<p class="empty">아직 모인 친구가 없어요.</p>`);
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
  const path=`${S.uid}/${prefix}-${Date.now()}.${extOf(blob.type)}`;
  const {error}=await sb.storage.from(BUCKET).upload(path,blob,{contentType:blob.type||"image/jpeg"});
  if(error)throw error;
  S.urls[path]=URL.createObjectURL(blob);
  return path;
}
function removeFile(path){if(path)sb.storage.from(BUCKET).remove([path]).catch(()=>{});}
function errText(e){
  const msg=String(e&&(e.message||e.error)||"").toLowerCase();
  if(e&&(e.code==="42501"||msg.includes("row-level security")))return "아직 열리지 않은 날이거나 권한이 없어요.";
  if(msg.includes("size")||msg.includes("too large"))return "사진이 너무 커요. 다른 사진을 골라 주세요.";
  if(msg.includes("mime")||msg.includes("type"))return "이 형식의 사진은 붙일 수 없어요. JPG나 PNG로 골라 주세요.";
  return "저장하지 못했어요. 잠시 후 다시 눌러 주세요.";
}
async function save(btn){
  const n=S.day,err=$("w-err"),body=$("w-text").value.trim();
  if(!body&&!draftImg){err.textContent="글이나 사진 중 하나는 남겨 주세요.";return;}
  btn.disabled=true;btn.textContent="저장하는 중…";
  const old=ans(S.uid,n);
  try{
    let path=draftImg&&draftImg.path||null;
    if(draftImg&&draftImg.blob)path=await uploadBlob(draftImg.blob,"day"+n);
    const {error}=await sb.from("answers").upsert({user_id:S.uid,day:n,body,photo_path:path,updated_at:new Date().toISOString()});
    if(error)throw error;
    if(old&&old.photo_path&&old.photo_path!==path)removeFile(old.photo_path);
    await load();S.editing=false;renderCompose();refresh();
  }catch(e){console.error(e);err.textContent=errText(e);btn.disabled=false;btn.textContent="남기기";}
}
async function del(btn){
  if(!confirm("이 날의 답을 지울까요?"))return;
  btn.disabled=true;const old=ans(S.uid,S.day);
  const {error}=await sb.from("answers").delete().match({user_id:S.uid,day:S.day});
  if(error){$("w-err").textContent=errText(error);btn.disabled=false;return;}
  if(old)removeFile(old.photo_path);
  await load();S.editing=false;renderCompose();refresh();
}

/* ---------- profile ---------- */
const sheetEl=$("sheet");
function closeSheet(force){if(!force&&S.uid&&!S.members[S.uid])return;sheetEl.innerHTML="";}
let pickEmoji=null,pickPhoto=null;
function drawPfp(){const el=$("pfp");if(!el)return;el.innerHTML=pickPhoto&&pickPhoto.url?`<img src="${esc(pickPhoto.url)}" alt="프로필 사진">`:pickEmoji;}
function openProfile(){
  const m=S.members[S.uid]||{},isNew=!S.members[S.uid];
  pickEmoji=EMOJIS.includes(m.emoji)?m.emoji:EMOJIS[Math.floor(Math.random()*EMOJIS.length)];
  pickPhoto=m.photo_path?{path:m.photo_path,url:S.urls[m.photo_path]}:null;
  sheetEl.innerHTML=`<div class="scrim" data-act="close"></div><div class="sheet" role="dialog" aria-modal="true" aria-label="프로필">
    <h3>${isNew?"다이어리에 온 걸 환영해요!":"프로필 바꾸기"}</h3><p class="sub">친구들에게 보일 닉네임과 프로필을 정해 주세요.</p>
    <input type="text" id="p-nick" maxlength="12" placeholder="닉네임" value="${esc(m.nick||"")}">
    <div class="pfrow"><div class="pfp" id="pfp"></div><div><div class="sub" style="margin:0 0 6px">프로필 사진 (없으면 아래 캐릭터가 보여요)</div><div class="btns"><label class="btn file">📷 사진 올리기<input type="file" id="p-file" accept="image/png,image/jpeg,image/webp,image/gif"></label><button class="btn" data-act="pnophoto">사진 빼기</button></div></div></div>
    <div class="emojis">${EMOJIS.map(e=>`<button data-act="emoji" data-e="${e}" aria-pressed="${e===pickEmoji}">${e}</button>`).join("")}</div>
    <div class="tools" style="margin:0"><span class="sp"></span>${isNew?"":`<button class="btn" data-act="close">닫기</button>`}<button class="btn main" data-act="psave">저장하기</button></div><p class="err" id="p-err" role="status"></p></div>`;
  drawPfp();
  const pf=$("p-file");
  pf.addEventListener("change",async()=>{const file=pf.files[0];if(!file)return;const blob=await shrink(file,true);pickPhoto={blob,url:URL.createObjectURL(blob)};drawPfp();});
  setTimeout(()=>$("p-nick")?.focus(),50);
}
async function saveProfile(btn){
  const nick=$("p-nick").value.trim(),err=$("p-err");
  if(!nick){err.textContent="닉네임을 적어 주세요.";return;}
  btn.disabled=true;
  const old=(S.members[S.uid]||{}).photo_path||null;
  try{
    let path=pickPhoto&&pickPhoto.path||null;
    if(pickPhoto&&pickPhoto.blob)path=await uploadBlob(pickPhoto.blob,"avatar");
    const {error}=await sb.from("members").upsert({id:S.uid,nick,emoji:pickEmoji,photo_path:path});
    if(error)throw error;
    if(old&&old!==path)removeFile(old);
    await load();closeSheet(true);render();
  }catch(e){console.error(e);err.textContent=errText(e);btn.disabled=false;}
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
  else if(a==="send")sendMail(t);
  else if(a==="verify")verifyCode(t);
  else if(a==="relogin"){S.login={step:"email",email:S.login.email};renderMain();}
  else if(a==="logout"){if(confirm("로그아웃할까요?"))sb.auth.signOut();}
});
document.addEventListener("keydown",e=>{
  if(e.key==="Escape"&&sheetEl.innerHTML)closeSheet();
  if(e.key==="Enter"&&e.target.id==="l-email")document.querySelector("[data-act=send]")?.click();
  if(e.key==="Enter"&&e.target.id==="l-code")document.querySelector("[data-act=verify]")?.click();
});
function readHash(){const h=location.hash.slice(1);S.tab=["today","topics","people"].includes(h)?h:"today";}
window.addEventListener("hashchange",()=>{readHash();render();$("rightpage").scrollTop=0;});

/* ---------- auth ---------- */
async function onUser(uid){
  S.uid=uid;S.authKnown=true;
  if(!uid){stopLive();S.members={};S.answers={};S.written=new Set();S.urls={};S.login={step:"email",email:S.login.email};closeSheet(true);render();return;}
  S.status="loading";render();
  await load();render();
  startLive();
  if(S.status==="ready"&&!S.members[uid])openProfile();
}
sb.auth.onAuthStateChange((_ev,session)=>{
  const uid=session?.user?.id||null;
  if(S.authKnown&&uid===S.uid)return;
  // Supabase 권장: 콜백 안에서 바로 다른 요청을 하지 않고 다음 틱으로 넘김
  setTimeout(()=>onUser(uid),0);
});
readHash();render();
