/* BERTAUT — etalase aplikasi kerja. Dua moda:
 *  - file:// atau tanpa backend → mandiri lokal (dinding login + localStorage)
 *  - dihidangkan backend      → etalase publik + API terpusat (kelola perlu masuk)
 */
(function(){
"use strict";
var LS_APPS="bertaut.apps.v1", LS_CREDS="bertaut.creds.v1", LS_VIS="bertaut.visits.v1";
var SS_SESS="bertaut.session", SS_TOKEN="bertaut.token";

var CATS=["Kepegawaian","Kinerja","Administrasi","Keuangan","Kesehatan","Lainnya"];
var DEFAULTS=[
 {id:"myasn",name:"MyASN BKN",url:"https://myasn.bkn.go.id",desc:"Layanan mandiri ASN — profil, riwayat jabatan, SK & data pribadi.",cat:"Kepegawaian",accent:"gold",glyph:"◈",pin:true,visits:0,lastOpen:null},
 {id:"siasn",name:"SIASN BKN",url:"https://siasn.bkn.go.id",desc:"Sistem Informasi ASN terpusat — layanan administrasi kepegawaian.",cat:"Kepegawaian",accent:"teal",glyph:"⬢",pin:true,visits:0,lastOpen:null},
 {id:"ekin",name:"e-Kinerja BKN",url:"https://ekinerja.bkn.go.id",desc:"Perencanaan & penilaian kinerja harian hingga SKP tahunan.",cat:"Kinerja",accent:"clay",glyph:"▲",pin:true,visits:0,lastOpen:null},
 {id:"srikandi",name:"Srikandi Arsip",url:"https://srikandi.arsip.go.id",desc:"Surat-menyurat dinas & kearsipan elektronik terintegrasi.",cat:"Administrasi",accent:"sage",glyph:"▣",pin:false,visits:0,lastOpen:null},
 {id:"coretax",name:"Coretax DJP",url:"https://coretaxdjp.pajak.go.id",desc:"Administrasi perpajakan — e-Filing, e-Billing & profil Wajib Pajak.",cat:"Keuangan",accent:"ink",glyph:"◎",pin:false,visits:0,lastOpen:null},
 {id:"taspen",name:"Taspen & e-Klim",url:"https://www.taspen.co.id",desc:"Tabungan pensiun, klaim manfaat & layanan kesejahteraan ASN.",cat:"Keuangan",accent:"gold",glyph:"✦",pin:false,visits:0,lastOpen:null},
 {id:"edabu",name:"e-Dabu BPJS Kesehatan",url:"https://edabu.bpjs-kesehatan.go.id",desc:"Kepesertaan JKN-KIS — cek status, iuran & badan usaha.",cat:"Kesehatan",accent:"teal",glyph:"◎",pin:false,visits:0,lastOpen:null},
 {id:"lapor",name:"LAPOR! SPAN",url:"https://www.lapor.go.id",desc:"Kanal aspirasi & pengaduan pelayanan publik nasional.",cat:"Administrasi",accent:"clay",glyph:"⬢",pin:false,visits:0,lastOpen:null}
];

function $(s,r){return (r||document).querySelector(s)}
function $all(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))}
function uid(){return "a"+Math.random().toString(36).slice(2,9)}
function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}
function normUrl(u){u=String(u||"").trim();if(!u)return "";if(!/^https?:\/\//i.test(u))u="https://"+u;return u}
function hostOf(u){try{return new URL(u).hostname.replace(/^www\./,"")}catch(e){return u}}
function load(k,f){try{var v=localStorage.getItem(k);return v?JSON.parse(v):f}catch(e){return f}}
function save(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}
function toast(msg){var t=document.createElement("div");t.className="toast";t.textContent=msg;$("#toasts").appendChild(t);setTimeout(function(){t.style.opacity="0";setTimeout(function(){t.remove()},400)},2600)}
function cap(s){s=String(s||"");return s?s.charAt(0).toUpperCase()+s.slice(1):s}

/* ---------- peran & koneksi backend ---------- */
var Admin={on:false,user:null};
var Session={user:null,sso:false,roles:[],canManage:false};
var SSO={enabled:false,loginUrl:null,adminRoles:[]};
var Remote={on:false,token:null};
try{Remote.token=sessionStorage.getItem(SS_TOKEN)}catch(e){Remote.token=null}
function setAdmin(u,info){
  info=info||{};
  Session.user=u||null;
  Session.sso=!!info.sso;
  Session.roles=Array.isArray(info.roles)?info.roles:[];
  Session.canManage=(info.canManage!==undefined)?!!info.canManage:!!u;
  // Admin.on = boleh Kelola (mengendalikan tombol .admin-only)
  Admin.on=!!u&&Session.canManage;
  Admin.user=u||null;
  document.body.classList.toggle("is-admin",Admin.on);
  document.body.classList.toggle("is-logged",!!u);
}
function serverMode(){return document.body.classList.contains("is-server")}
function api(path,opts){
  opts=opts||{};
  var ctrl=null,to=null;
  try{ctrl=new AbortController();to=setTimeout(function(){ctrl.abort()},opts.timeout||8000)}catch(e){}
  var headers={"Content-Type":"application/json"};
  if(Remote.token)headers["Authorization"]="Bearer "+Remote.token;
  return fetch(path,{method:opts.method||"GET",headers:headers,body:opts.body?JSON.stringify(opts.body):undefined,signal:ctrl?ctrl.signal:undefined})
    .then(function(res){if(to)clearTimeout(to);
      if(res.status===401){onUnauthorized();var e=new Error("Sesi pengelola berakhir. Masuk kembali.");e.auth=true;throw e}
      if(!res.ok)throw new Error("Server menjawab "+res.status);
      var ct=res.headers.get("content-type")||"";
      return ct.indexOf("json")>-1?res.json():res.text();
    })
    .catch(function(err){if(to)clearTimeout(to);throw err});
}
function onUnauthorized(){
  Remote.token=null;try{sessionStorage.removeItem(SS_TOKEN)}catch(e){}
  setAdmin(null);state.managing=false;
  if(serverMode())showLogin();
}
function refreshApps(){return api("/api/apps").then(function(list){if(Array.isArray(list)){apps=list;save(LS_APPS,apps)}renderAll()})}

/* ---------- data lokal (cadangan + moda file://) ---------- */
var _apps=load(LS_APPS,null);
var apps=Array.isArray(_apps)&&_apps.length?_apps:DEFAULTS.slice();
var _creds=load(LS_CREDS,null);
var creds=(_creds&&_creds.user)?_creds:{user:"admin",pass:"bertaut123"};
var visits=load(LS_VIS,{total:0});
if(!visits||typeof visits.total!=="number")visits={total:0};
var state={q:"",cat:"Semua",sort:"manual",managing:false,palIdx:0};

/* ---------- preloader + debu ---------- */
var preN=$("#preNum"),preB=$("#preBar"),n=0;
var preT=setInterval(function(){n=Math.min(100,n+Math.ceil(Math.random()*9));preN.textContent=String(n).padStart(2,"0");preB.style.width=n+"%";if(n>=100){clearInterval(preT);setTimeout(function(){$("#preloader").classList.add("done");boot()},350)}},70);
(function dust(){var c=$("#dust"),x=c.getContext("2d"),P=[],W,H;function rs(){W=c.width=innerWidth;H=c.height=innerHeight}rs();addEventListener("resize",rs);
for(var i=0;i<70;i++)P.push({x:Math.random()*innerWidth,y:Math.random()*innerHeight,r:Math.random()*1.8+.4,s:Math.random()*.35+.08,o:Math.random()*.5+.15});
(function f(){x.clearRect(0,0,W,H);P.forEach(function(p){p.y-=p.s;if(p.y<-4){p.y=H+4;p.x=Math.random()*W}x.globalAlpha=p.o;x.fillStyle="#c9a86a";x.beginPath();x.arc(p.x,p.y,p.r,0,7);x.fill()});x.globalAlpha=1;if(!matchMedia("(prefers-reduced-motion: reduce)").matches)requestAnimationFrame(f)})})();

/* kursor */
(function(){var d=$(".cursor-dot"),r=$(".cursor-ring");if(!d)return;addEventListener("mousemove",function(e){d.style.transform="translate("+(e.clientX-3)+"px,"+(e.clientY-3)+"px)";r.style.transform="translate("+(e.clientX-17)+"px,"+(e.clientY-17)+"px)"});addEventListener("mouseover",function(e){if(e.target.closest("a,button,.card")){r.style.width="52px";r.style.height="52px"}else{r.style.width="34px";r.style.height="34px"}})})();

/* jam */
function tickClock(){try{var now=new Date(),fmt=new Intl.DateTimeFormat("id-ID",{hour:"2-digit",minute:"2-digit",second:"2-digit",timeZone:"Asia/Jakarta"}),df=new Intl.DateTimeFormat("id-ID",{weekday:"long",day:"numeric",month:"long",year:"numeric",timeZone:"Asia/Jakarta"});
var t=fmt.format(now),d=df.format(now);if($("#loginClock")){$("#loginClock").textContent=t;$("#loginDate").textContent=d}if($("#clock")){$("#clock").textContent=t.slice(0,5);$("#dateLine").textContent=d}var h=parseInt(t.slice(0,2),10),g=h<11?"pagi":h<15?"siang":h<19?"sore":"malam";if($("#greet"))$("#greet").textContent=Session.user?g:"datang";if($("#todayLine"))$("#todayLine").textContent=d;}catch(e){}}setInterval(tickClock,1000);tickClock();

/* ---------- boot: backend dulu, lokal sebagai cadangan ---------- */
function parseSsoReturn(){
  try{
    var h=location.hash||"";
    var m=/#sso_token=([^&]+)/.exec(h);
    if(m){
      var tok=decodeURIComponent(m[1]);
      try{sessionStorage.setItem(SS_TOKEN,tok)}catch(e){}
      Remote.token=tok;
      location.hash="";
      history.replaceState(null,"",location.pathname+location.search);
      return {token:tok};
    }
  }catch(e){}
  try{
    var q=new URLSearchParams(location.search);
    var err=q.get("sso_error");
    if(err){
      q.delete("sso_error");
      var qs=q.toString();
      history.replaceState(null,"",location.pathname+(qs?"?"+qs:"")+location.hash);
      return {error:err};
    }
  }catch(e){}
  return null;
}
function loadSsoConfig(){
  if(location.protocol==="file:")return Promise.resolve();
  return api("/api/auth/config",{timeout:3500}).then(function(c){
    SSO.enabled=!!(c&&c.ssoEnabled);
    SSO.loginUrl=(c&&c.loginUrl)||null;
    SSO.adminRoles=(c&&c.adminRoles)||[];
    var w=$("#ssoWrap"),b=$("#ssoBtn"),hint=$("#ssoHint");
    if(w)w.hidden=!SSO.enabled;
    if(b&&SSO.enabled)b.addEventListener("click",function(){location.href=SSO.loginUrl});
    if(hint&&SSO.enabled)hint.textContent="Peran pengelola: "+(SSO.adminRoles.join(", ")||"—")+". Akun tanpa peran tetap bisa melihat etalase.";
  }).catch(function(){SSO.enabled=false});
}
function boot(){
  if(location.protocol==="file:"){localEnter();renderAll();return}
  document.body.classList.add("is-server");
  var ssoRet=parseSsoReturn();
  if(ssoRet&&ssoRet.error){
    try{var ee=$("#loginErr");if(ee){ee.hidden=false;ee.textContent="SSO gagal: "+ssoRet.error}}catch(e){}
    toast("SSO gagal: "+ssoRet.error);
  }
  api("/api/health",{timeout:3500}).then(function(h){Remote.on=!!(h&&h.ok)}).catch(function(){Remote.on=false}).then(function(){
    if(!Remote.on){localEnter();renderAll();return}
    return loadSsoConfig().then(function(){
      return refreshApps().catch(function(){}).then(function(){
        if(!Remote.token)return null;
        return api("/api/me").then(function(me){
          if(me&&me.user){
            setAdmin(me.user,{sso:me.sso,roles:me.roles,canManage:me.canManage});
            if(!me.canManage)toast("Masuk SSO sebagai "+me.user+" (lihat saja — tanpa peran pengelola).");
          }
        }).catch(function(){Remote.token=null;try{sessionStorage.removeItem(SS_TOKEN)}catch(e){}});
      }).then(function(){
        // Selalu tampilkan etalase publik; login hanya untuk Kelola.
        showApp();renderAll();
        if(ssoRet&&ssoRet.token&&Session.user&&Session.canManage)toast("Selamat bertugas, "+Session.user+" (SSO).");
      });
    });
  });
}
function localEnter(){
  var s=null;try{s=sessionStorage.getItem(SS_SESS)}catch(e){}
  if(s==="ok"){setAdmin(creds.user,{sso:false,roles:["local-admin"],canManage:true});showApp()}else{showLogin()}
  save(LS_APPS,apps);
}
function showLogin(){$("#loginView").hidden=false;$("#appView").hidden=true}
function showApp(){$("#loginView").hidden=true;$("#appView").hidden=false}

/* ---------- auth ---------- */
$("#togglePass").addEventListener("click",function(){var i=$("#loginPass");i.type=i.type==="password"?"text":"password";this.textContent=i.type==="password"?"◎":"◉"});
function shakeCard(){var c=$("#loginCard");c.classList.remove("shake");void c.offsetWidth;c.classList.add("shake")}
$("#loginForm").addEventListener("submit",function(e){
  e.preventDefault();
  var u=$("#loginUser").value.trim(),p=$("#loginPass").value,err=$("#loginErr");
  if(Remote.on){
    api("/api/login",{method:"POST",body:{user:u,pass:p}}).then(function(r){
      Remote.token=r.token;try{sessionStorage.setItem(SS_TOKEN,r.token)}catch(x){}
      setAdmin(r.user,{sso:!!r.sso,roles:r.roles||["local-admin"],canManage:(r.canManage!==undefined)?r.canManage:true});err.hidden=true;showApp();renderAll();toast("Selamat bertugas, "+r.user+".");
    }).catch(function(ex){
      err.hidden=false;err.textContent=(ex&&ex.auth)?ex.message:"Kunci tidak cocok. Periksa nama pengguna & kata sandi.";shakeCard();
    });
    return;
  }
  if(u===creds.user&&p===creds.pass){err.hidden=true;try{sessionStorage.setItem(SS_SESS,"ok")}catch(x){}setAdmin(creds.user,{sso:false,roles:["local-admin"],canManage:true});showApp();renderAll();toast("Selamat datang kembali, "+u+".")}
  else{err.hidden=false;err.textContent="Kunci tidak cocok. Periksa nama pengguna & kata sandi.";shakeCard()}
});
$("#logoutBtn").addEventListener("click",function(){
  var wasSso=Session.sso;
  Remote.token=null;try{sessionStorage.removeItem(SS_TOKEN)}catch(e){}
  try{sessionStorage.removeItem(SS_SESS)}catch(e){}
  setAdmin(null);state.managing=false;$("#loginPass").value="";
  if(wasSso&&SSO.enabled){
    // bersihkan sesi Keycloak juga bila memungkinkan
    toast("Keluar SSO…");
    location.href="/auth/sso/logout?next="+encodeURIComponent(location.origin+"/");
    return;
  }
  if(serverMode()){showApp();renderAll();toast("Anda keluar. Etalase tetap terbuka publik.")}else{showLogin();toast("Portal dikunci kembali.")}
});
var loginNavBtn=$("#loginNavBtn");
if(loginNavBtn)loginNavBtn.addEventListener("click",function(){showLogin();setTimeout(function(){$("#loginUser").focus()},60)});
var backBtn=$("#backBtn");
if(backBtn)backBtn.addEventListener("click",function(){showApp()});
$("#resetAllLink").addEventListener("click",function(){
  if(!confirm("Atur ulang portal ke bawaan (admin / bertaut123 + 8 aplikasi)?"))return;
  if(Remote.on){toast("Masuk dahulu sebagai pengelola untuk mengatur ulang.");return}
  creds={user:"admin",pass:"bertaut123"};apps=DEFAULTS.map(function(a){return Object.assign({},a)});visits={total:0};
  save(LS_CREDS,creds);save(LS_APPS,apps);save(LS_VIS,visits);toast("Portal dikembalikan ke bawaan.");
});

/* ---------- render ---------- */
function filtered(){var q=state.q.trim().toLowerCase();
var list=apps.filter(function(a){var okC=state.cat==="Semua"||a.cat===state.cat;var okQ=!q||(a.name+" "+a.desc+" "+hostOf(a.url)).toLowerCase().indexOf(q)>-1;return okC&&okQ});
if(state.sort==="az")list.sort(function(a,b){return a.name.localeCompare(b.name,"id")});
else if(state.sort==="recent")list.sort(function(a,b){return String(b.lastOpen||"").localeCompare(String(a.lastOpen||""))});
else{var pinned=list.filter(function(a){return a.pin}),rest=list.filter(function(a){return !a.pin});list=pinned.concat(rest)}
return list}

function renderAll(){renderChips();renderCatOptions();renderGrid();renderStats()}
function renderChips(){var cats=["Semua"].concat(CATS.filter(function(c){return apps.some(function(a){return a.cat===c})}));var w=$("#chips");w.innerHTML="";cats.forEach(function(c){var b=document.createElement("button");b.className="chip"+(state.cat===c?" on":"");b.textContent=c;b.addEventListener("click",function(){state.cat=c;renderAll()});w.appendChild(b)})}
function renderCatOptions(){var s=$("#fCat");if(!s)return;var cur=s.value;s.innerHTML="";CATS.forEach(function(c){var o=document.createElement("option");o.value=c;o.textContent=c;s.appendChild(o)});if(cur)s.value=cur}
function renderStats(){
  $("#statTotal").textContent=apps.length;
  $("#statFav").textContent=apps.filter(function(a){return a.pin}).length;
  var tot=Remote.on?apps.reduce(function(s,a){return s+(a.visits|0)},0):(visits.total||0);
  $("#statVisit").textContent=tot;
  $("#dialNum").textContent=String(filtered().length).padStart(2,"0");
  var ring=$(".dial-ring");if(ring)ring.style.setProperty("--p",Math.min(100,apps.length?filtered().length/apps.length*100:0)+"%");
  $("#footCount").textContent=apps.length+" gerbang · "+tot+" kunjungan";
  var who=Session.user?cap(Session.user)+(Session.sso?" (SSO)":""):(serverMode()?"Tamu":cap(creds.user));
  var nm=$("#whoName");if(nm)nm.textContent=who;
  var av=$("#logoutBtn");if(av)av.textContent=((Session.user||Admin.user||"?").charAt(0)||"?").toUpperCase();
  var su=$("#sUser");if(su&&!su.value)su.value=Session.user||creds.user;
  var navBtn=$("#loginNavBtn");if(navBtn)navBtn.style.display=Session.user?"none":"";
  tickClock();
}

function renderGrid(){
  var g=$("#grid");var list=filtered();
  document.body.classList.toggle("managing",state.managing);
  $("#appView").classList.toggle("managing",state.managing);
  var mb=$("#manageBtn");if(mb)mb.setAttribute("aria-pressed",state.managing?"true":"false");
  $("#emptyState").hidden=list.length>0;g.innerHTML="";
  list.forEach(function(a,i){
    var el=document.createElement("article");el.className="card";el.setAttribute("data-accent",a.accent||"gold");el.style.animationDelay=Math.min(i*60,480)+"ms";
    el.innerHTML='<div class="card-top"><span class="card-idx">'+String(i+1).padStart(2,"0")+' / '+esc(a.cat||"")+'</span>'
    +(a.pin?'<span class="pin-flag">★ SEMAT</span>':"")
    +'<span class="glyph" aria-hidden="true">'+esc(a.glyph||"◈")+'</span></div>'
    +'<p class="cat">'+esc(a.cat||"Lainnya")+'</p><h3>'+esc(a.name)+'</h3><p class="desc">'+esc(a.desc||hostOf(a.url))+'</p>'
    +'<div class="card-meta"><span>'+esc(hostOf(a.url))+'</span><span>'+(a.visits||0)+'× dibuka</span></div>'
    +'<div class="card-actions"><a class="go" href="'+esc(a.url)+'" target="_blank" rel="noopener">Kunjungi <span>↗</span></a>'
    +'<button class="mini manage-only" data-act="edit" title="Ubah">✎</button><button class="mini manage-only" data-act="del" title="Hapus">🗑</button></div>';
    el.querySelector(".go").addEventListener("click",function(){
      a.visits=(a.visits||0)+1;a.lastOpen=new Date().toISOString();
      visits.total=(visits.total||0)+1;save(LS_APPS,apps);save(LS_VIS,visits);
      if(Remote.on)api("/api/apps/"+encodeURIComponent(a.id)+"/visit",{method:"POST"}).catch(function(){});
      renderStats();
    });
    var eb=el.querySelector('[data-act="edit"]');if(eb)eb.addEventListener("click",function(){openModal(a)});
    var db=el.querySelector('[data-act="del"]');if(db)db.addEventListener("click",function(){removeApp(a)});
    el.addEventListener("mousemove",function(e){if(matchMedia("(pointer:coarse)").matches)return;var r=el.getBoundingClientRect(),rx=((e.clientY-r.top)/r.height-.5)*-7,ry=((e.clientX-r.left)/r.width-.5)*9;el.style.transform="perspective(800px) rotateX("+rx+"deg) rotateY("+ry+"deg) translateY(-3px)"});
    el.addEventListener("mouseleave",function(){el.style.transform=""});
    g.appendChild(el);
  });
}
function removeApp(a){
  if(!confirm('Hapus "'+a.name+'" dari etalase?'))return;
  if(Remote.on){
    api("/api/apps/"+encodeURIComponent(a.id),{method:"DELETE"}).then(function(){return refreshApps()}).then(function(){toast("Gerbang dihapus.")}).catch(function(e){toast(e.message||"Gagal menghapus.")});
    return;
  }
  apps=apps.filter(function(x){return x.id!==a.id});save(LS_APPS,apps);renderAll();toast("Gerbang dihapus.");
}

/* ---------- cari / urut / kelola ---------- */
function needAdmin(){
  if(Admin.on)return true;
  if(Session.user&&!Session.canManage){toast("Akun SSO "+Session.user+" tidak punya peran pengelola ("+SSO.adminRoles.join(", ")+").");return false}
  toast("Masuk dahulu sebagai pengelola.");if(serverMode())showLogin();return false;
}
var qEl=$("#q");if(qEl)qEl.addEventListener("input",function(){state.q=qEl.value;renderGrid();renderStats()});
var ss=$("#sortSel");if(ss)ss.addEventListener("change",function(){state.sort=ss.value;renderGrid()});
var mBtn=$("#manageBtn");if(mBtn)mBtn.addEventListener("click",function(){if(!needAdmin())return;state.managing=!state.managing;renderGrid();toast(state.managing?"Mode kelola aktif — ubah & hapus tersedia.":"Mode kelola mati.")});

/* ---------- modal ---------- */
var scrim=$("#scrim");
function openModal(a){
  if(!needAdmin())return;
  $("#modalKicker").textContent=a?"Menyunting gerbang":"Gerbang baru";
  $("#modalTitle").textContent=a?a.name:"Tambah aplikasi";
  $("#fId").value=a?a.id:"";$("#fName").value=a?a.name:"";$("#fUrl").value=a?a.url:"";$("#fDesc").value=a?a.desc:"";
  $("#fCat").value=a?a.cat:"Kepegawaian";$("#fAccent").value=(a&&a.accent)||"gold";$("#fGlyph").value=(a&&a.glyph)||"◈";
  $("#fPin").checked=!!(a&&a.pin);$("#formErr").hidden=true;scrim.hidden=false;
  setTimeout(function(){$("#fName").focus()},50);
}
function closeModal(){scrim.hidden=true}
$("#addBtn").addEventListener("click",function(){openModal(null)});
$("#emptyAdd").addEventListener("click",function(){if(Admin.on)openModal(null);else if(serverMode())showLogin();else openModal(null)});
$("#modalClose").addEventListener("click",closeModal);$("#modalCancel").addEventListener("click",closeModal);
scrim.addEventListener("click",function(e){if(e.target===scrim)closeModal()});
$("#appForm").addEventListener("submit",function(e){
  e.preventDefault();
  var err=$("#formErr");
  var name=$("#fName").value.trim(),url=normUrl($("#fUrl").value),desc=$("#fDesc").value.trim(),id=$("#fId").value;
  var payload={name:name,url:url,desc:desc,cat:$("#fCat").value,accent:$("#fAccent").value,glyph:$("#fGlyph").value,pin:$("#fPin").checked};
  if(name.length<2){err.hidden=false;err.textContent="Nama aplikasi minimal 2 huruf.";return}
  try{var u=new URL(url);if(!/^https?:$/.test(u.protocol))throw new Error("x")}catch(x){err.hidden=false;err.textContent="Tautan tidak valid — awali dengan https://";return}
  err.hidden=true;
  if(Remote.on){
    var p=id?api("/api/apps/"+encodeURIComponent(id),{method:"PUT",body:payload}):api("/api/apps",{method:"POST",body:payload});
    p.then(function(){return refreshApps()}).then(function(){closeModal();toast("Gerbang “"+name+"” tersimpan & terbit publik.")}).catch(function(ex){err.hidden=false;err.textContent=ex.message||"Gagal menyimpan."});
    return;
  }
  if(id){var t=apps.filter(function(a){return a.id===id})[0];if(t)Object.assign(t,payload,{visits:t.visits|0,lastOpen:t.lastOpen||null})}
  else{apps.unshift(Object.assign({id:uid(),visits:0,lastOpen:null},payload))}
  save(LS_APPS,apps);closeModal();renderAll();toast("Gerbang “"+name+"” tersimpan.");
});

/* ---------- pengaturan ---------- */
var drawer=$("#drawer");
$("#settingsBtn").addEventListener("click",function(){if(needAdmin())drawer.hidden=false});
$("#drawerClose").addEventListener("click",function(){drawer.hidden=true});
$("#saveCreds").addEventListener("click",function(){
  var u=$("#sUser").value.trim(),p=$("#sPass").value;
  if(u.length<3){toast("Nama pengguna minimal 3 huruf.");return}
  if(p&&p.length<6){toast("Kata sandi minimal 6 karakter.");return}
  if(Remote.on){
    api("/api/creds",{method:"POST",body:{user:u,pass:p||undefined}}).then(function(r){
      setAdmin(r.user,{sso:Session.sso,roles:Session.roles,canManage:true});$("#sPass").value="";renderAll();toast("Kunci masuk diperbarui.");
    }).catch(function(e){toast(e.message||"Gagal menyimpan kunci.")});
    return;
  }
  creds={user:u,pass:p||creds.pass};save(LS_CREDS,creds);setAdmin(creds.user,{sso:false,roles:["local-admin"],canManage:true});$("#sPass").value="";renderStats();toast("Kunci masuk diperbarui.");
});
$("#exportBtn").addEventListener("click",function(){
  if(Remote.on){
    var headers={};if(Remote.token)headers["Authorization"]="Bearer "+Remote.token;
    fetch("/api/export",{headers:headers}).then(function(r){if(!r.ok)throw new Error("Perlu masuk sebagai pengelola.");return r.blob()}).then(function(blob){
      var a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="bertaut-etalase.json";a.click();setTimeout(function(){URL.revokeObjectURL(a.href)},2000);
    }).catch(function(e){toast(e.message)});
    return;
  }
  var blob=new Blob([JSON.stringify({apps:apps,exportedAt:new Date().toISOString()},null,2)],{type:"application/json"});
  var a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="bertaut-etalase.json";a.click();setTimeout(function(){URL.revokeObjectURL(a.href)},2000);
});
$("#importBtn").addEventListener("click",function(){if(needAdmin())$("#importFile").click()});
function mapImport(d){
  var arr=Array.isArray(d)?d:d.apps;
  if(!Array.isArray(arr))throw new Error("Berkas tidak valid.");
  return arr.filter(function(a){return a&&a.name&&a.url}).slice(0,200).map(function(a){
    return{id:String(a.id||uid()).slice(0,24),name:String(a.name).slice(0,48),url:normUrl(a.url),desc:String(a.desc||"").slice(0,120),
      cat:CATS.indexOf(a.cat)>-1?a.cat:"Lainnya",accent:["gold","teal","clay","sage","ink"].indexOf(a.accent)>-1?a.accent:"gold",
      glyph:String(a.glyph||"◈").slice(0,4),pin:!!a.pin,visits:a.visits|0,lastOpen:a.lastOpen||null};
  });
}
$("#importFile").addEventListener("change",function(){
  var f=this.files[0];if(!f)return;var r=new FileReader();
  r.onload=function(){
    try{
      var arr=mapImport(JSON.parse(r.result));
      if(Remote.on){
        api("/api/apps/replace",{method:"POST",body:{apps:arr}}).then(function(rr){return refreshApps().then(function(){toast((rr&&rr.count||arr.length)+" gerbang diimpor & terbit.")})}).catch(function(e){toast(e.message||"Impor gagal.")});
      }else{apps=arr;save(LS_APPS,apps);renderAll();toast(arr.length+" gerbang diimpor.")}
    }catch(e){toast(e.message||"Berkas tidak valid.")}
  };
  r.readAsText(f);this.value="";
});
$("#wipeBtn").addEventListener("click",function(){
  if(!confirm("Kembalikan 8 aplikasi bawaan? Susunan saat ini hilang."))return;
  if(Remote.on){
    api("/api/apps/reset",{method:"POST"}).then(function(){return refreshApps()}).then(function(){toast("Kembali ke susunan bawaan.")}).catch(function(e){toast(e.message||"Gagal.")});
    return;
  }
  apps=DEFAULTS.map(function(a){return Object.assign({},a)});save(LS_APPS,apps);renderAll();toast("Kembali ke susunan bawaan.");
});

/* ---------- palet + pintasan ---------- */
var palS=$("#palScrim"),palI=$("#palInput"),palL=$("#palList");
function openPal(){palS.hidden=false;palI.value="";state.palIdx=0;renderPal("");setTimeout(function(){palI.focus()},40)}
function closePal(){palS.hidden=true}
function renderPal(q){q=q.toLowerCase();var list=apps.filter(function(a){return (a.name+" "+a.cat).toLowerCase().indexOf(q)>-1}).slice(0,8);palL.innerHTML="";if(!list.length){palL.innerHTML='<div class="pal-item">Tidak ditemukan — tekan Esc</div>';return}
list.forEach(function(a,i){var b=document.createElement("button");b.className="pal-item"+(i===state.palIdx?" sel":"");b.innerHTML="<b>"+esc(a.glyph||"◈")+"</b><span>"+esc(a.name)+"<br><small>"+esc(a.cat)+" · "+esc(hostOf(a.url))+"</small></span>";b.addEventListener("click",function(){goApp(a)});palL.appendChild(b)})}
function goApp(a){a.visits=(a.visits||0)+1;a.lastOpen=new Date().toISOString();visits.total=(visits.total||0)+1;save(LS_APPS,apps);save(LS_VIS,visits);if(Remote.on)api("/api/apps/"+encodeURIComponent(a.id)+"/visit",{method:"POST"}).catch(function(){});closePal();renderStats();window.open(a.url,"_blank","noopener")}
palI.addEventListener("input",function(){state.palIdx=0;renderPal(palI.value)});
palI.addEventListener("keydown",function(e){var items=$all(".pal-item",palL);if(e.key==="ArrowDown"){e.preventDefault();state.palIdx=Math.min(items.length-1,state.palIdx+1);renderPal(palI.value)}else if(e.key==="ArrowUp"){e.preventDefault();state.palIdx=Math.max(0,state.palIdx-1);renderPal(palI.value)}else if(e.key==="Enter"){var list=apps.filter(function(a){return (a.name+" "+a.cat).toLowerCase().indexOf(palI.value.toLowerCase())>-1}).slice(0,8);if(list[state.palIdx])goApp(list[state.palIdx])}});
palS.addEventListener("click",function(e){if(e.target===palS)closePal()});
document.addEventListener("keydown",function(e){
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k"){e.preventDefault();if(!$("#appView").hidden)openPal();return}
  if(e.key==="Escape"){closePal();closeModal();drawer.hidden=true;$("#shortcuts").hidden=true;return}
  if(e.target.matches("input,select,textarea"))return;
  if($("#appView").hidden)return;
  if(e.key==="/"){e.preventDefault();$("#q").focus()}
  else if(e.key==="n"){if(needAdmin())openModal(null)}
  else if(e.key==="e"){if(needAdmin()){state.managing=!state.managing;renderGrid()}}
  else if(e.key==="?"){$("#shortcuts").hidden=!$("#shortcuts").hidden}
});
$("#shortClose").addEventListener("click",function(){$("#shortcuts").hidden=true});
renderAll();
})();
