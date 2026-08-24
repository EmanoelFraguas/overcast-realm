/* ============================================================================
   OvercastProgress — sistema compartilhado de progresso de atividades
   Overcast Realm

   Uso em qualquer página de atividade:
     <script src="./progress.js"></script>
     ...
     OvercastProgress.mountBadge(document.getElementById('meu-container'));
     OvercastProgress.onLink(identity => { ... restaurar/recarregar ... });
     await OvercastProgress.saveProgress('labirinto1', { completed: [0,1,2] });
     const dados = await OvercastProgress.loadProgress('labirinto1');

   Pra criar uma atividade nova no futuro, não precisa mexer aqui nem no
   banco — só chamar saveProgress/loadProgress com um novo "slug" e o
   formato de dados que fizer sentido pra ela (é tudo JSONB livre).
============================================================================ */
window.OvercastProgress = (function(){
  const SUPABASE_URL = "https://kezlmecrxhjahhoekybs.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtlemxtZWNyeGhqYWhob2VreWJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5MDkwNjAsImV4cCI6MjEwMjQ4NTA2MH0.-TcsKrFxRMeiqKrzXk57E8-60eobk3fJ0Crn7ci0MW8";
  const IDENTITY_KEY = 'overcast_student_identity';

  function getSb(){
    if(!window.supabase) return null;
    if(!window._overcastSbClient){
      window._overcastSbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    return window._overcastSbClient;
  }

  /* ---- identidade (compartilhada entre TODAS as páginas do site, mesma origem) ---- */
  function getIdentity(){
    try{ return JSON.parse(localStorage.getItem(IDENTITY_KEY)); }catch(e){ return null; }
  }
  function setIdentity(data){
    localStorage.setItem(IDENTITY_KEY, JSON.stringify(data));
  }
  function clearIdentity(){
    localStorage.removeItem(IDENTITY_KEY);
  }

  /* ---- salvar / carregar progresso ---- */
  async function saveProgress(slug, dados){
    const identity = getIdentity();
    const sb = getSb();
    if(!identity || !sb) return false;
    try{
      const { error } = await sb.rpc('salvar_progresso', {
        p_codigo: identity.codigo, p_atividade_slug: slug, p_dados: dados
      });
      return !error;
    }catch(e){ return false; }
  }
  async function loadProgress(slug){
    const identity = getIdentity();
    const sb = getSb();
    if(!identity || !sb) return null;
    try{
      const { data, error } = await sb.rpc('obter_progresso', {
        p_codigo: identity.codigo, p_atividade_slug: slug
      });
      if(error) return null;
      return data;
    }catch(e){ return null; }
  }

  /* ---- widget de vínculo: injeta estilos + modal + crachá, funciona em qualquer página ---- */
  let onLinkCallback = null;
  function onLink(cb){ onLinkCallback = cb; }

  const widgetBadgeEls = [];
  function ensureStyles(){
    if(document.getElementById('ovp-styles')) return;
    const style = document.createElement('style');
    style.id = 'ovp-styles';
    style.textContent = `
      .ovp-badge{ display:inline-flex; align-items:center; gap:6px; font-family:'Baloo 2',sans-serif,system-ui; font-weight:700; font-size:12px; color:#2bb673; background:#e3fbf0; border:2px solid #2bb673; border-radius:10px; padding:6px 10px; cursor:pointer; white-space:nowrap; }
      .ovp-badge.unlinked{ color:#6b5b8a; background:#f2f0f7; border-color:#d8d0ec; }
      .ovp-overlay{ position:fixed; inset:0; background:rgba(20,15,35,0.55); display:none; align-items:center; justify-content:center; z-index:99999; padding:16px; }
      .ovp-overlay.show{ display:flex; }
      .ovp-box{ background:#fff; border-radius:20px; padding:22px; max-width:360px; width:100%; font-family:'Baloo 2',sans-serif,system-ui; box-shadow:0 10px 0 #e5e0f5; box-sizing:border-box; }
      .ovp-box h3{ margin:0 0 12px; font-size:16px; color:#3a2b52; }
      .ovp-box input{ width:100%; padding:10px; border-radius:8px; border:2px solid #d8d0ec; margin-bottom:8px; font-family:inherit; font-size:14px; box-sizing:border-box; }
      .ovp-box button{ font-family:inherit; font-weight:700; font-size:13px; border:none; border-radius:999px; padding:10px 16px; cursor:pointer; color:#fff; width:100%; margin-bottom:6px; }
      .ovp-btn-primary{ background:#2fa8ec; }
      .ovp-btn-list{ background:#a06bff; text-align:center; }
      .ovp-btn-gray{ background:#9089ab; }
      .ovp-btn-danger{ background:#ff5c5c; }
      .ovp-error{ color:#ff5c5c; font-size:12px; margin:6px 0; }
      .ovp-alunos{ display:flex; flex-direction:column; gap:6px; max-height:200px; overflow-y:auto; margin-bottom:8px; }
    `;
    document.head.appendChild(style);
  }
  function badgeHTML(){
    const id = getIdentity();
    return id ? `👤 <b>${id.nome}</b> <span style="opacity:.7;">(trocar)</span>` : `🔗 Vincular meu nome`;
  }
  function mountBadge(containerEl){
    ensureStyles();
    const badge = document.createElement('div');
    badge.className = 'ovp-badge' + (getIdentity() ? '' : ' unlinked');
    badge.innerHTML = badgeHTML();
    badge.onclick = openModal;
    containerEl.appendChild(badge);
    widgetBadgeEls.push(badge);
    return badge;
  }
  function refreshBadges(){
    widgetBadgeEls.forEach(b => {
      b.className = 'ovp-badge' + (getIdentity() ? '' : ' unlinked');
      b.innerHTML = badgeHTML();
    });
  }

  let ovpTurmaData = null;
  function ensureModal(){
    if(document.getElementById('ovp-overlay')) return;
    ensureStyles();
    const overlay = document.createElement('div');
    overlay.className = 'ovp-overlay';
    overlay.id = 'ovp-overlay';
    overlay.innerHTML = `
      <div class="ovp-box">
        <h3>🔗 Vincular meu nome</h3>
        <div id="ovp-step-turma">
          <input type="text" id="ovp-turma-code" placeholder="Código da turma">
          <button class="ovp-btn-primary" id="ovp-lookup-btn">🔎 Buscar Turma</button>
          <div class="ovp-error" id="ovp-turma-error"></div>
        </div>
        <div id="ovp-step-aluno" style="display:none;">
          <p style="font-weight:800; color:#e8a800; margin:4px 0;">Turma: <span id="ovp-turma-name"></span></p>
          <p style="font-size:12px; color:#6b5b8a;">Clique no seu nome:</p>
          <div class="ovp-alunos" id="ovp-aluno-list"></div>
          <button class="ovp-btn-gray" id="ovp-back-turma-btn">← Trocar turma</button>
        </div>
        <div id="ovp-status" style="font-size:12px; font-weight:800; min-height:16px; margin:6px 0;"></div>
        <button class="ovp-btn-gray" id="ovp-close-btn">✕ Fechar</button>
        <button class="ovp-btn-danger" id="ovp-unlink-btn" style="display:none;">🔓 Desvincular</button>
      </div>
    `;
    document.body.appendChild(overlay);
    document.getElementById('ovp-lookup-btn').onclick = lookupTurma;
    document.getElementById('ovp-back-turma-btn').onclick = backToTurma;
    document.getElementById('ovp-close-btn').onclick = closeModal;
    document.getElementById('ovp-unlink-btn').onclick = unlink;
    overlay.addEventListener('click', e => { if(e.target === overlay) closeModal(); });
  }
  async function lookupTurma(){
    const sb = getSb();
    const code = document.getElementById('ovp-turma-code').value.trim().toLowerCase();
    const errEl = document.getElementById('ovp-turma-error');
    if(!code){ errEl.textContent = '👉 Digite o código da turma.'; return; }
    if(!sb){ errEl.textContent = '❌ Não consegui conectar.'; return; }
    errEl.textContent = '⏳ Buscando...';
    const { data: turma, error } = await sb.from('turmas').select('*').eq('codigo_acesso', code).maybeSingle();
    if(error || !turma){ errEl.textContent = '❌ Turma não encontrada. Confira o código.'; return; }
    errEl.textContent = '';
    const { data: alunos } = await sb.from('alunos').select('*').eq('turma_id', turma.id).order('nome');
    ovpTurmaData = { turma, alunos: alunos||[] };
    document.getElementById('ovp-turma-name').textContent = turma.nome;
    document.getElementById('ovp-aluno-list').innerHTML = (alunos && alunos.length)
      ? alunos.map((a,i) => `<button class="ovp-btn-list" data-i="${i}">${a.nome}</button>`).join('')
      : '<p style="font-size:12px;color:#6b5b8a;">Nenhum aluno cadastrado nessa turma ainda.</p>';
    document.querySelectorAll('#ovp-aluno-list .ovp-btn-list').forEach(btn => {
      btn.onclick = () => pickAluno(parseInt(btn.dataset.i,10));
    });
    document.getElementById('ovp-step-turma').style.display = 'none';
    document.getElementById('ovp-step-aluno').style.display = 'block';
  }
  function pickAluno(i){
    if(!ovpTurmaData) return;
    const aluno = ovpTurmaData.alunos[i]; if(!aluno) return;
    setIdentity({ codigo: aluno.codigo, nome: aluno.nome, turmaCodigo: ovpTurmaData.turma.codigo_acesso, linkedAt: Date.now() });
    const statusEl = document.getElementById('ovp-status');
    statusEl.textContent = '✅ Vinculado como ' + aluno.nome + '!';
    statusEl.style.color = '#2bb673';
    refreshBadges();
    if(onLinkCallback) onLinkCallback(getIdentity());
    setTimeout(closeModal, 1200);
  }
  function openModal(){
    ensureModal();
    document.getElementById('ovp-unlink-btn').style.display = getIdentity() ? 'block' : 'none';
    document.getElementById('ovp-status').textContent = '';
    document.getElementById('ovp-overlay').classList.add('show');
  }
  function closeModal(){
    const el = document.getElementById('ovp-overlay');
    if(el) el.classList.remove('show');
  }
  function unlink(){
    clearIdentity();
    refreshBadges();
    closeModal();
    if(onLinkCallback) onLinkCallback(null);
  }
  function backToTurma(){
    document.getElementById('ovp-step-turma').style.display = 'block';
    document.getElementById('ovp-step-aluno').style.display = 'none';
  }

  return {
    getIdentity, setIdentity, clearIdentity,
    saveProgress, loadProgress, getSb,
    mountBadge, onLink
  };
})();
