(()=>{
'use strict';
const DATA=window.VOCAB_DATA;
if(!DATA||!Array.isArray(DATA.words)){document.body.innerHTML='<p style="color:white;padding:30px">words.js の読み込みに失敗しました。</p>';return;}
const WORDS=DATA.words;
const STORAGE='english_vocab_master_progress_v2';
const $=id=>document.getElementById(id);
const normalize=s=>String(s||'').toLowerCase().replace(/[’']/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const shuffle=a=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
const defaultState=()=>({ratings:{},quiz:{},pron:{},unit:'ALL',mode:'card',order:'normal',schemaVersion:4});
let state=load();
let queue=[],index=0,current=null,locked=false,pronAttempts=[];
function migrateState(s){
  // v2/v3 bug: a first correct quiz answer promoted 0 -> 1, and 1 meant '苦手'.
  // Repair only unambiguous cases: quiz has correct answers and no wrong answers.
  if(Number(s.schemaVersion||0)<4){
    for(const w of WORDS){
      const q=s.quiz&&s.quiz[w.id];
      const r=Number((s.ratings&&s.ratings[w.id])||0);
      if(r===1&&q&&Number(q.correct||0)>0&&Number(q.wrong||0)===0){
        s.ratings[w.id]=Number(q.correct||0)>=2?3:2;
      }
    }
    s.schemaVersion=4;
    try{localStorage.setItem(STORAGE,JSON.stringify(s))}catch{}
  }
  return s;
}
function load(){try{return migrateState({...defaultState(),...JSON.parse(localStorage.getItem(STORAGE)||'{}')})}catch{return defaultState()}}
function save(){localStorage.setItem(STORAGE,JSON.stringify(state))}
function rating(w){return Number(state.ratings[w.id]||0)}
function setRating(w,r){state.ratings[w.id]=r;save();updateStats()}
function statusLabel(r){return r===3?'習得':r===2?'あやしい':r===1?'苦手':'未判定'}
function unitWords(){if(state.mode==='weak')return WORDS.filter(w=>rating(w)<=1&&rating(w)>0);if(state.unit==='ALL')return WORDS;return WORDS.filter(w=>w.unit===state.unit)}
function buildQueue(){let a=unitWords();queue=state.order==='shuffle'?shuffle(a):[...a].sort((a,b)=>(a.unitOrder-b.unitOrder)||(a.order-b.order));index=0}
function next(){if(!queue.length){current=null;renderEmpty();return}if(index>=queue.length)index=0;current=queue[index++];renderCurrent()}
function prev(){if(!queue.length)return;index=Math.max(0,index-2);next()}
function updateStats(){const mastered=WORDS.filter(w=>rating(w)===3).length;const weak=WORDS.filter(w=>rating(w)===1).length;const tested=WORDS.filter(w=>{const q=state.quiz[w.id];return q&&(q.correct||q.wrong)}).length;$('totalCount').textContent=WORDS.length;$('masteredCount').textContent=mastered;$('weakCount').textContent=weak;$('testedCount').textContent=tested;$('dataSubtitle').textContent=`${WORDS.length}語収録・発音基準 ${DATA.pronunciationLocale||'en-US'}・データ版 ${DATA.dataVersion}・アプリ v4`}
function initUnits(){const units=[...new Set(WORDS.map(w=>w.unit))].sort((a,b)=>{const A=WORDS.find(w=>w.unit===a)?.unitOrder||0,B=WORDS.find(w=>w.unit===b)?.unitOrder||0;return A-B});$('unitSelect').innerHTML='<option value="ALL">全単語</option>'+units.map(u=>`<option value="${esc(u)}">${esc(u)}（${WORDS.filter(w=>w.unit===u).length}語）</option>`).join('');if(!['ALL',...units].includes(state.unit))state.unit='ALL';$('unitSelect').value=state.unit;$('orderSelect').value=state.order}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function audioButtons(){return `<div class="audioRow"><button data-audio="normal">🔊 発音を聞く</button><button class="slow" data-audio="slow">🐢 ゆっくり</button></div>`}
function speak(rate=.82){if(!current||!('speechSynthesis'in window))return;speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(current.word);u.lang='en-US';u.rate=rate;u.pitch=1;speechSynthesis.speak(u)}
function wordHeader({showWord=true,showPron=true}={}){return `<div class="prompt">${showWord?`<div class="word">${esc(current.word)}</div>`:''}${showPron?`<div class="ipa">${esc(current.ipa)}</div><div class="kana">発音ガイド：${esc(current.kanaGuide)}</div>`:''}<div class="pos">${esc(current.partOfSpeech)}</div>${showWord?audioButtons():''}</div>`}
function renderCurrent(){locked=false;pronAttempts=[];$('studyView').classList.remove('hidden');$('listView').classList.add('hidden');$('counterText').textContent=`${current.unit} ・ ${current.order} / ${WORDS.filter(w=>w.unit===current.unit).length}　｜　範囲内 ${Math.min(index,queue.length)} / ${queue.length}`;const mode=state.mode;if(mode==='card'||mode==='weak')renderCard();else if(mode==='choice')renderChoice();else if(mode==='spell')renderSpell();else if(mode==='pronounce')renderPron();$('statusLine').textContent=`現在の状態：${statusLabel(rating(current))}`;bindAudio()}
function bindAudio(){document.querySelectorAll('[data-audio]').forEach(b=>b.onclick=()=>speak(b.dataset.audio==='slow'?.45:.82))}
function renderCard(){$('promptArea').innerHTML=wordHeader();$('interactionArea').innerHTML=`<div class="interaction"><div id="cardReveal"><div class="instruction">意味を思い出してから表示してください</div><div class="actionRow"><button class="primary" id="revealBtn">意味を見る</button></div></div><div id="cardAnswer" class="hidden"><div class="meaning">${esc(current.meaning)}</div><div class="actionRow"><button class="rateBad" data-rate="1">😣 覚えてない</button><button class="rateMid" data-rate="2">🤔 あやしい</button><button class="rateGood" data-rate="3">✅ 覚えた</button></div></div><div class="actionRow"><button id="prevBtn">← 前へ</button><button id="skipBtn">次へ →</button></div></div>`;$('revealBtn').onclick=()=>{$('cardReveal').classList.add('hidden');$('cardAnswer').classList.remove('hidden')};document.querySelectorAll('[data-rate]').forEach(b=>b.onclick=()=>{setRating(current,Number(b.dataset.rate));setTimeout(next,120)});$('prevBtn').onclick=prev;$('skipBtn').onclick=next}
function normalizeMeaning(s){return String(s||'').toLowerCase().normalize('NFKC').replace(/[〜～]/g,'').replace(/[、，,。．・／/;；:：!?！？「」『』（）()\[\]【】]/g,' ').replace(/\s+/g,' ').trim()}
function meaningParts(m){return normalizeMeaning(m).split(/\s+/).map(x=>x.trim()).filter(x=>x.length>=2)}
function meaningConflict(a,b){const am=normalizeMeaning(a.meaning),bm=normalizeMeaning(b.meaning);if(!am||!bm)return false;if(am===bm)return true;const A=meaningParts(a.meaning),B=meaningParts(b.meaning);return A.some(x=>B.some(y=>x===y&&(x.length>=2)))}
function distractors(){
  const out=[];
  const usedMeaning=new Set([normalizeMeaning(current.meaning)]);
  const addPool=pool=>{for(const x of shuffle(pool)){const m=normalizeMeaning(x.meaning);if(!m||usedMeaning.has(m)||out.some(y=>y.id===x.id))continue;out.push(x);usedMeaning.add(m);if(out.length===3)break}};
  const eligible=WORDS.filter(w=>w.id!==current.id);
  // まず「同じ品詞かつ意味の衝突がない」候補を優先。
  addPool(eligible.filter(w=>w.partOfSpeech===current.partOfSpeech&&!meaningConflict(w,current)));
  // 次に同じDAY、最後に全体から補充。
  if(out.length<3)addPool(eligible.filter(w=>w.unit===current.unit&&!meaningConflict(w,current)));
  if(out.length<3)addPool(eligible.filter(w=>!meaningConflict(w,current)));
  // 安全弁：意味の完全一致だけを除外し、必ず3個まで補充する。
  if(out.length<3)addPool(eligible.filter(w=>normalizeMeaning(w.meaning)!==normalizeMeaning(current.meaning)));
  return out.slice(0,3)
}
function renderChoice(){// Critical: current.meaning is NOT inserted anywhere before the user answers.
$('promptArea').innerHTML=wordHeader();const opts=shuffle([current,...distractors()]);$('interactionArea').innerHTML=`<div class="interaction"><div class="instruction">この英単語の意味を選んでください</div><div class="options" id="choiceOptions">${opts.map(o=>`<button class="option" data-id="${o.id}">${esc(o.meaning)}</button>`).join('')}</div><div class="feedback" id="choiceFeedback"></div><div id="choiceReveal"></div></div>`;document.querySelectorAll('.option').forEach(b=>b.onclick=()=>judgeChoice(b,opts));}
function quizStat(ok){
  const q=state.quiz[current.id]||{correct:0,wrong:0,streak:0};
  if(ok){
    q.correct=(q.correct||0)+1;
    q.streak=(q.streak||0)+1;
  }else{
    q.wrong=(q.wrong||0)+1;
    q.streak=0;
  }
  state.quiz[current.id]=q;
  let r=rating(current);
  if(ok){
    // First correct: never '苦手'. 1 correct => あやしい, 2 consecutive correct => 習得.
    if((q.streak||0)>=2) r=3;
    else if(r<2) r=2;
  }else{
    // One miss lowers confidence, but does not erase an already-mastered word all the way to weak.
    r=(r===3)?2:1;
  }
  state.ratings[current.id]=r;
  save();updateStats();
}
function judgeChoice(btn,opts){if(locked)return;locked=true;const ok=btn.dataset.id===current.id;quizStat(ok);document.querySelectorAll('.option').forEach(b=>{b.disabled=true;if(b.dataset.id===current.id)b.classList.add('correct')});if(!ok)btn.classList.add('wrong');$('choiceFeedback').textContent=ok?'✅ 正解！':'❌ もう一度覚えよう';$('choiceReveal').innerHTML=`<div class="answerReveal"><strong>${esc(current.word)}</strong> = ${esc(current.meaning)}<br><span class="ipa">${esc(current.ipa)}</span>　<span class="kana">${esc(current.kanaGuide)}</span></div>`;setTimeout(next,1600)}
function renderSpell(){// The English spelling and pronunciation are deliberately hidden until judgment.
$('promptArea').innerHTML=`<div class="prompt"><div class="spellPrompt">${esc(current.meaning)}</div><div class="pos">${esc(current.partOfSpeech)}</div></div>`;$('interactionArea').innerHTML=`<div class="interaction"><div class="instruction">日本語から英単語を入力</div><div class="spellRow"><input id="spellInput" autocomplete="off" autocapitalize="off" spellcheck="false"><button id="spellBtn">判定</button></div><div class="feedback" id="spellFeedback"></div><div id="spellReveal"></div></div>`;const inp=$('spellInput');inp.focus();$('spellBtn').onclick=judgeSpell;inp.onkeydown=e=>{if(e.key==='Enter')judgeSpell()}}
function judgeSpell(){if(locked)return;const inp=$('spellInput');const a=normalize(inp.value);if(!a)return;locked=true;const ok=a===normalize(current.word);quizStat(ok);$('spellFeedback').textContent=ok?'✅ 正解！':`❌ 正解：${current.word}`;$('spellReveal').innerHTML=`<div class="answerReveal"><strong>${esc(current.word)}</strong><br>${esc(current.ipa)}　${esc(current.kanaGuide)}</div>`;setTimeout(next,1500)}
const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition||null;
function speechCandidate(text){
  const got=normalize(text).split(' ')[0]||'';
  const ans=normalize(current.word);
  return {grade:got===ans?'ok':'uncertain',label:got===ans?'🟢 認識一致':'⚪ 判定保留',got:got||'認識なし'}
}
function renderPron(){$('promptArea').innerHTML=wordHeader();$('interactionArea').innerHTML=`<div class="interaction pronBox"><div class="instruction">お手本を聞いてから、🎤を押します。「今、発音してください」と出てから1語だけ発音してください。ブラウザの文字認識が外れることがあるため、<strong>違う単語に変換されても発音ミスとは判定しません。</strong></div><div class="pronStatus" id="pronStatus">待機中</div><div class="attempts" id="attempts"><div class="attempt">まだ発音していません</div></div><button class="micBtn" id="micBtn">🎤 発音してみる</button><div class="feedback" id="pronFeedback"></div><div class="actionRow navRow"><button id="pronPrevBtn">← 前へ</button><button class="primary" id="pronNextBtn">次へ →</button></div><div class="note">🟢は「ブラウザが対象語として認識した」という目安です。別の単語に変換された場合は⚪判定保留とし、発音不良には数えません。この無料モードは発音採点AIではありません。</div></div>`;const b=$('micBtn');$('pronPrevBtn').onclick=()=>{stopActiveRecognition();prev()};$('pronNextBtn').onclick=()=>{stopActiveRecognition();next()};if(!SpeechRecognition){b.disabled=true;b.textContent='このブラウザでは音声認識非対応';$('pronStatus').textContent='このブラウザでは発音チェックを利用できません';return}b.onclick=startRecognition}
let activeRecognition=null;
function stopActiveRecognition(){if(activeRecognition){try{activeRecognition.abort()}catch{}activeRecognition=null}}
async function primeMicrophone(){if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia)return;const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});stream.getTracks().forEach(t=>t.stop())}
function pickSpeech(candidates){
  // Exact target in ANY alternative is a positive signal. Otherwise do not infer a pronunciation error.
  for(const t of candidates){const g=speechCandidate(t);if(g.grade==='ok')return g}
  return candidates.length?speechCandidate(candidates[0]):null
}
async function startRecognition(){
  if(activeRecognition)return;
  if(pronAttempts.length>=3){pronAttempts=[];renderAttempts();$('pronFeedback').textContent=''}
  const b=$('micBtn'),st=$('pronStatus');
  b.disabled=true;b.classList.add('listening');b.textContent='🎤 マイク準備中…';st.textContent='マイクを準備しています…';
  try{await primeMicrophone()}catch(e){b.disabled=false;b.classList.remove('listening');b.textContent='🎤 発音してみる';st.textContent='⚠️ マイクを使用できません。ブラウザのマイク許可を確認してください。';return}
  const r=new SpeechRecognition();activeRecognition=r;r.lang='en-US';r.interimResults=true;r.continuous=false;r.maxAlternatives=10;
  let candidates=[],finalized=false,hadResult=false,technicalError='',readyTimer=null;
  const finishAttempt=()=>{if(finalized)return;finalized=true;if(readyTimer)clearTimeout(readyTimer);const best=pickSpeech(candidates);if(best){pronAttempts.push(best);renderAttempts();savePron(best);st.textContent=best.grade==='ok'?`✅ 対象語「${current.word}」として認識されました`:`ブラウザ認識：「${best.got}」→ 発音の良否は判定保留`;}else if(technicalError==='no-speech'){st.textContent='⚠️ 音声を拾えませんでした。回数には数えていません。🎤を押して、「今どうぞ」の後に発音してください。';}else if(technicalError){st.textContent=`⚠️ 音声認識エラー：${technicalError}（回数には数えていません）`;}else{st.textContent='⚠️ 認識結果が返りませんでした。回数には数えていません。もう一度試してください。';}};
  const resetMic=()=>{activeRecognition=null;b.disabled=false;b.classList.remove('listening');b.textContent=pronAttempts.length>=3?'🎤 3回やり直す':'🎤 発音してみる'};
  r.onaudiostart=()=>{st.textContent='🎤 マイク接続OK。少し待ってください…';b.textContent='⏳ 準備中…';readyTimer=setTimeout(()=>{if(activeRecognition===r&&!finalized){st.textContent='🎙️ 今、1語だけ発音してください';b.textContent='👂 聞き取り中…'}},650)};
  r.onsoundstart=()=>{if(!finalized)st.textContent='🔊 音を検出しました。声を待っています…'};
  r.onspeechstart=()=>{if(readyTimer)clearTimeout(readyTimer);st.textContent='👂 声を検出しました。認識中…';b.textContent='👂 認識中…'};
  r.onresult=e=>{hadResult=true;for(let ri=e.resultIndex;ri<e.results.length;ri++){for(let ai=0;ai<e.results[ri].length;ai++){const t=e.results[ri][ai].transcript;if(t)candidates.push(t)}if(e.results[ri].isFinal){finishAttempt();try{r.stop()}catch{}break}}};
  r.onerror=e=>{technicalError=e.error||'unknown';if(technicalError!=='aborted')finishAttempt()};
  r.onend=()=>{if(!finalized){if(hadResult&&candidates.length)finishAttempt();else finishAttempt()}resetMic()};
  try{r.start()}catch(e){technicalError='start-failed';finishAttempt();resetMic()}
}
function renderAttempts(){const box=$('attempts');if(!box)return;box.innerHTML=pronAttempts.length?pronAttempts.map((a,i)=>`<div class="attempt ${a.grade}">${i+1}回目：${a.label}　ブラウザ認識「${esc(a.got)}」</div>`).join(''):'<div class="attempt">まだ発音していません</div>';if(pronAttempts.length>=3){const ok=pronAttempts.filter(a=>a.grade==='ok').length;const result=ok>=2?'✅ 3回中2回以上、対象語として認識されました':ok===1?'△ 1回は対象語として認識。自動判定は保留':'⚪ 3回とも文字認識が一致せず。発音不良とは断定できません';$('pronFeedback').textContent=result}}
function savePron(g){if(!g)return;const p=state.pron[current.id]||{ok:0,uncertain:0};p[g.grade]=(p[g.grade]||0)+1;state.pron[current.id]=p;save()}
function renderEmpty(){$('promptArea').innerHTML='<div class="meaning">対象の単語がありません</div>';$('interactionArea').innerHTML='<div class="instruction">学習範囲またはモードを変更してください。</div>';$('counterText').textContent='';$('statusLine').textContent=''}
function setMode(m){state.mode=m;save();document.querySelectorAll('#modeNav button').forEach(b=>b.classList.toggle('active',b.dataset.mode===m));if(m==='list'){renderList();return}$('listView').classList.add('hidden');$('studyView').classList.remove('hidden');buildQueue();next()}
function renderList(){state.mode='list';save();$('studyView').classList.add('hidden');$('listView').classList.remove('hidden');renderTable()}
function renderTable(){const q=normalize($('searchInput').value);const base=state.unit==='ALL'?WORDS:WORDS.filter(w=>w.unit===state.unit);const rows=base.filter(w=>!q||normalize(`${w.word} ${w.meaning} ${w.partOfSpeech} ${w.kanaGuide}`).includes(q));$('listCount').textContent=`${rows.length}語`;$('wordTable').innerHTML=rows.map(w=>`<tr><td><strong>${esc(w.word)}</strong></td><td>${esc(w.ipa)}</td><td>${esc(w.kanaGuide)}</td><td>${esc(w.meaning)}</td><td>${esc(w.partOfSpeech)}</td><td class="state${rating(w)}">${statusLabel(rating(w))}</td></tr>`).join('')}
function exportProgress(){const blob=new Blob([JSON.stringify({schema:2,exportedAt:new Date().toISOString(),state},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='english_vocab_progress.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
function importProgress(file){const r=new FileReader();r.onload=()=>{try{const x=JSON.parse(r.result);state={...defaultState(),...(x.state||x)};save();updateStats();initUnits();setMode(state.mode==='list'?'card':state.mode);alert('進捗を読み込みました。')}catch{alert('進捗ファイルを読み込めませんでした。')}};r.readAsText(file)}
// events
$('modeNav').onclick=e=>{const b=e.target.closest('button[data-mode]');if(b)setMode(b.dataset.mode)};
$('unitSelect').onchange=e=>{state.unit=e.target.value;save();if(state.mode==='list')renderTable();else{buildQueue();next()}};
$('orderSelect').onchange=e=>{state.order=e.target.value;save();if(state.mode!=='list'){buildQueue();next()}};
$('searchInput').oninput=renderTable;
$('settingsBtn').onclick=()=>$('dataDialog').showModal();
$('exportBtn').onclick=exportProgress;
$('importInput').onchange=e=>{if(e.target.files[0])importProgress(e.target.files[0])};
$('resetBtn').onclick=()=>{if(confirm('学習履歴をすべてリセットしますか？')){state=defaultState();save();updateStats();initUnits();setMode('card');$('dataDialog').close()}};
initUnits();updateStats();setMode(state.mode||'card');
})();
