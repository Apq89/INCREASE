/* INCREASE — contas, gravação na nuvem e ranking (Supabase).
   Carrega antes do jogo. O jogo chama window.IncreaseBoot(start) no fim do seu script:
   aqui mostramos o login, trazemos o jogo gravado da nuvem para o browser e só depois arrancamos. */
(function(){
  const cfg = window.INCREASE_CONFIG || {};
  const sb = cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey) : null;
  const SAVE_KEY = 'alavanca-save-v1';   // a mesma chave que o jogo usa
  const OWNER_KEY = 'increase-owner';    // de quem é o jogo gravado neste browser
  let user = null, username = '', timer = null, startGame = null, started = false;

  /* ---------- Estilos do ecrã de entrada, do ranking e do topo ---------- */
  const css = document.createElement('style');
  css.textContent = `
  .auth{position:fixed; inset:0; z-index:90; display:flex; align-items:center; justify-content:center; padding:16px; background:radial-gradient(circle at 1px 1px,#1C1C1C 1px,transparent 0) 0 0/22px 22px,#0A0A0A; overflow:auto}
  .auth-box{box-sizing:border-box; width:100%; max-width:400px; margin:auto; display:flex; flex-direction:column; gap:14px; padding:24px; border:2px solid #3A3A3A; border-radius:16px; background:linear-gradient(180deg,#1A1A1A,#131313)}
  .auth-logo{display:flex; align-items:center; gap:12px; font:400 34px 'Russo One','Chakra Petch',sans-serif; letter-spacing:.08em; color:#fff; text-transform:uppercase}
  .auth-box label{font:600 11px 'Chakra Petch',sans-serif; letter-spacing:.12em; text-transform:uppercase; color:#999; display:flex; flex-direction:column; gap:6px}
  .auth-box input{width:100%; min-width:0; box-sizing:border-box; font:500 16px 'IBM Plex Sans',sans-serif; padding:11px 12px; border:2px solid #3A3A3A; border-radius:8px; background:#0E0E0E; color:#F2F2F2}
  .auth-box input:focus{outline:none; border-color:#F2F2F2}
  .auth-msg{font-size:13.5px; padding:10px 12px; border-radius:8px; background:#222; color:#F2F2F2}
  .auth-msg.bad{background:#3A1414; box-shadow:inset 0 0 0 1px #FF5C5C}
  .auth-msg.good{background:#0F2A1C; box-shadow:inset 0 0 0 1px #3DDC84}
  .auth-link{background:none; border:0; color:#BDBDBD; text-decoration:underline; cursor:pointer; font-size:13px; padding:4px; align-self:center}
  .rank-back{position:fixed; inset:0; z-index:80; background:rgba(0,0,0,.7); display:flex; align-items:center; justify-content:center; padding:16px}
  .rank{width:100%; max-width:640px; max-height:calc(100% - 32px); overflow:auto; padding:18px; border:2px solid #3A3A3A; border-radius:16px; background:linear-gradient(180deg,#1A1A1A,#131313); display:flex; flex-direction:column; gap:12px}
  .rank table{width:100%; border-collapse:collapse; font-size:14px}
  .rank th{font:600 11px 'Chakra Petch',sans-serif; letter-spacing:.1em; text-transform:uppercase; color:#999; text-align:left; padding:6px 8px 6px 0; border-bottom:1px solid #2E2E2E}
  .rank td{padding:9px 8px 9px 0; border-bottom:1px solid #2E2E2E}
  .rank td.n{font-family:'IBM Plex Mono',monospace; text-align:right; white-space:nowrap}
  .rank tr.me td{background:#262626}
  .rank .pos1{font:400 18px 'Russo One',sans-serif}
  .cloud-st{font-size:11.5px; color:#999; font-family:'IBM Plex Mono',monospace}
  `;
  document.head.appendChild(css);

  const LOGO = '<svg viewBox="0 0 30 30" width="34" height="34" aria-hidden="true"><rect x="2" y="18" width="6" height="10" fill="#fff"/><rect x="12" y="11" width="6" height="17" fill="#fff"/><rect x="22" y="3" width="6" height="25" fill="#fff"/></svg>';
  const escH = t => String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');

  /* ---------- Arranque ---------- */
  window.IncreaseBoot = async function(start){
    startGame = start;
    if(!sb){ run(); return; }                       // sem Supabase configurado: joga sem contas
    const { data } = await sb.auth.getSession();
    if(data.session) await enter(data.session.user);
    else showAuth('login');
    sb.auth.onAuthStateChange((event)=>{ if(event === 'PASSWORD_RECOVERY') showAuth('newpass'); });
  };
  function run(){ if(started) return; started = true; startGame({}); }

  async function enter(u){
    user = u;
    username = (u.user_metadata && u.user_metadata.username) || (u.email || '').split('@')[0];
    const prof = await sb.from('profiles').select('username').eq('id', u.id).maybeSingle();
    if(prof.data) username = prof.data.username;
    // Jogo gravado na nuvem vs. neste browser: fica o mais recente do mesmo jogador
    const row = await sb.from('saves').select('data, updated_at').eq('user_id', u.id).maybeSingle();
    let local = null; try{ local = JSON.parse(localStorage.getItem(SAVE_KEY)); }catch(e){}
    const mine = localStorage.getItem(OWNER_KEY) === u.id;
    try{
      if(row.data && row.data.data){
        const localNewer = mine && local && (local.seen || 0) > Date.parse(row.data.updated_at);
        if(!localNewer) localStorage.setItem(SAVE_KEY, JSON.stringify(row.data.data));
      } else if(!mine){
        localStorage.removeItem(SAVE_KEY);           // conta nova: não herda o jogo de outra pessoa neste aparelho
      }
      localStorage.setItem(OWNER_KEY, u.id);
    }catch(e){}
    hideAuth();
    run();
    hookSave();
    addHud();
    upload();
  }

  /* ---------- Gravação na nuvem ---------- */
  function hookSave(){
    const original = window.save;
    window.save = function(){ original(); schedule(); };
    document.addEventListener('visibilitychange', ()=>{ if(document.visibilityState === 'hidden') upload(); });
  }
  function schedule(){ if(timer) return; timer = setTimeout(()=>{ timer = null; upload(); }, 20000); }
  async function upload(){
    if(!user || typeof S === 'undefined' || !S) return;
    const now = new Date().toISOString(), nw = Math.round(netWorth());
    status('A gravar…');
    const a = await sb.from('saves').upsert({user_id:user.id, data:S, updated_at:now});
    const b = await sb.from('scores').upsert({user_id:user.id, username, net_worth:nw, title:TITLES[titleIdx(nw)].name, day:S.day, city:(CITY_BY[S.city] || {}).name || '', updated_at:now});
    status(a.error || b.error ? '⚠️ Sem ligação' : '☁️ Gravado');
  }
  function status(t){ const el = document.getElementById('cloudSt'); if(el) el.textContent = t; }

  /* ---------- Topo: jogador, ranking e sair ---------- */
  function addHud(){
    const clock = document.querySelector('.clock'); if(!clock || document.getElementById('rankBtn')) return;
    clock.insertAdjacentHTML('afterbegin', `<button class="citybtn" id="rankBtn">🏆 Ranking</button><button class="citybtn" id="userBtn" title="Sair da conta">👤 ${escH(username)} · Sair</button><span class="cloud-st" id="cloudSt"></span>`);
    document.getElementById('rankBtn').onclick = showRanking;
    document.getElementById('userBtn').onclick = async ()=>{ await upload(); await sb.auth.signOut(); try{ localStorage.removeItem(SAVE_KEY); }catch(e){} location.reload(); };
  }
  async function showRanking(){
    const back = document.createElement('div'); back.className = 'rank-back';
    back.innerHTML = `<div class="rank" role="dialog" aria-modal="true" aria-label="Ranking"><div style="display:flex;justify-content:space-between;align-items:center"><h2>🏆 Ranking de património</h2><button class="btn" data-x>Fechar</button></div><p class="note">A carregar…</p></div>`;
    document.body.appendChild(back);
    back.addEventListener('click', e=>{ if(e.target === back || e.target.closest('[data-x]')) back.remove(); });
    await upload();
    const { data, error } = await sb.from('scores').select('user_id, username, net_worth, title, day, city').order('net_worth', {ascending:false}).limit(50);
    const box = back.querySelector('.rank');
    if(error){ box.querySelector('.note').textContent = 'Não foi possível carregar o ranking. Verifica a ligação.'; return; }
    box.querySelector('.note').outerHTML = `<table><thead><tr><th>#</th><th>Jogador</th><th style="text-align:right">Património</th><th>Estatuto</th><th style="text-align:right">Dias</th></tr></thead><tbody>${
      data.map((r,i)=>`<tr class="${r.user_id===user.id ? 'me' : ''}"><td class="${i<3 ? 'pos1' : ''}">${i===0 ? '🥇' : i===1 ? '🥈' : i===2 ? '🥉' : i+1}</td><td><strong>${escH(r.username)}</strong><br><span class="note">${escH(r.city || '')}</span></td><td class="n">${eurC(+r.net_worth)}</td><td>${escH(r.title || '')}</td><td class="n">${r.day ?? ''}</td></tr>`).join('')
    }</tbody></table>`;
  }

  /* ---------- Ecrã de entrada ---------- */
  let authEl = null;
  function showAuth(mode, msg, kind){
    if(!authEl){ authEl = document.createElement('div'); authEl.className = 'auth'; document.body.appendChild(authEl); }
    const titles = {login:'Entrar', signup:'Criar conta', reset:'Recuperar palavra-passe', newpass:'Nova palavra-passe'};
    authEl.innerHTML = `<form class="auth-box" novalidate>
      <div class="auth-logo">${LOGO}Increase</div>
      <p class="note" style="margin:0">Jogo de negócios em que todo o capital vem de crédito. ${mode==='signup' ? 'Cria a tua conta: o jogo fica gravado na nuvem e entras no ranking.' : ''}</p>
      <h2 style="margin:0">${titles[mode]}</h2>
      ${msg ? `<div class="auth-msg ${kind || ''}">${escH(msg)}</div>` : ''}
      ${mode==='signup' ? '<label>Nome de jogador<input name="username" autocomplete="nickname" minlength="3" maxlength="20" required></label>' : ''}
      ${mode!=='newpass' ? '<label>Email<input name="email" type="email" autocomplete="email" required></label>' : ''}
      ${mode==='login' || mode==='signup' || mode==='newpass' ? `<label>${mode==='newpass' ? 'Nova palavra-passe' : 'Palavra-passe'}<input name="password" type="password" autocomplete="${mode==='login' ? 'current-password' : 'new-password'}" minlength="6" required></label>` : ''}
      <button class="btn primary big" type="submit">${mode==='login' ? 'Entrar' : mode==='signup' ? 'Criar conta e jogar' : mode==='reset' ? 'Enviar email' : 'Guardar'}</button>
      ${mode==='login' ? '<button class="btn" type="button" data-go="signup">Ainda não tenho conta</button><button class="auth-link" type="button" data-go="reset">Esqueci-me da palavra-passe</button>' : ''}
      ${mode==='signup' || mode==='reset' ? '<button class="btn" type="button" data-go="login">Já tenho conta</button>' : ''}
      <button class="auth-link" type="button" data-offline>Jogar sem conta (só neste aparelho)</button>
    </form>`;
    const form = authEl.querySelector('form');
    authEl.querySelectorAll('[data-go]').forEach(b=>b.onclick = ()=>showAuth(b.dataset.go));
    authEl.querySelector('[data-offline]').onclick = ()=>{ hideAuth(); run(); };
    form.onsubmit = async e=>{
      e.preventDefault();
      const f = Object.fromEntries(new FormData(form)), btn = form.querySelector('[type=submit]');
      btn.disabled = true;
      try{
        if(mode==='login'){
          const { data, error } = await sb.auth.signInWithPassword({email:f.email, password:f.password});
          if(error) return showAuth('login', explain(error), 'bad');
          await enter(data.user);
        } else if(mode==='signup'){
          const name = (f.username || '').trim();
          if(!/^[\p{L}\p{N}_ .-]{3,20}$/u.test(name)) return showAuth('signup', 'O nome de jogador tem de ter entre 3 e 20 letras ou números.', 'bad');
          const taken = await sb.from('profiles').select('id').eq('username', name).maybeSingle();
          if(taken.data) return showAuth('signup', 'Esse nome de jogador já existe. Escolhe outro.', 'bad');
          const { data, error } = await sb.auth.signUp({email:f.email, password:f.password, options:{data:{username:name}, emailRedirectTo:location.origin + location.pathname}});
          if(error) return showAuth('signup', explain(error), 'bad');
          // Email já registado: o Supabase devolve um utilizador sem identidades
          if(data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) return showAuth('login', 'Esse email já tem conta. Entra com a tua palavra-passe.', 'bad');
          if(data.session) await enter(data.user);
          else showAuth('login', 'Conta criada. Enviámos-te um email: confirma o endereço e depois entra aqui.', 'good');
        } else if(mode==='reset'){
          const { error } = await sb.auth.resetPasswordForEmail(f.email, {redirectTo:location.origin + location.pathname});
          showAuth('login', error ? error.message : 'Se o email existir, recebes uma ligação para criar uma nova palavra-passe.', error ? 'bad' : 'good');
        } else if(mode==='newpass'){
          const { data, error } = await sb.auth.updateUser({password:f.password});
          if(error) return showAuth('newpass', error.message, 'bad');
          await enter(data.user);
        }
      } finally { btn.disabled = false; }
    };
    setTimeout(()=>{ const i = form.querySelector('input'); if(i) i.focus(); }, 0);
  }
  // Mensagens do Supabase em português, com o que fazer a seguir
  function explain(error){
    const m = (error && error.message) || '';
    if(/Invalid login credentials/i.test(m)) return 'Email ou palavra-passe errados.';
    if(/Email not confirmed/i.test(m)) return 'Esta conta ainda não foi confirmada. Abre o email de confirmação que recebeste; se não chegou, pede ao administrador do jogo para te confirmar a conta.';
    if(/rate limit/i.test(m)) return 'Foram enviados demasiados emails na última hora. Tenta de novo mais tarde.';
    if(/already registered|already exists/i.test(m)) return 'Esse email já tem conta. Entra com a tua palavra-passe.';
    if(/Password should be/i.test(m)) return 'A palavra-passe tem de ter pelo menos 6 caracteres.';
    if(/Database error saving new user/i.test(m)) return 'Não foi possível criar a conta. Experimenta outro nome de jogador.';
    if(/sending.*email|confirmation email/i.test(m)) return 'Não foi possível enviar o email de confirmação. Pede ao administrador do jogo para desligar a confirmação por email.';
    return m || 'Algo correu mal. Tenta de novo.';
  }
  function hideAuth(){ if(authEl){ authEl.remove(); authEl = null; } }
})();
