/* ============================================================================
   CourseGate — identificação de curso (games / arte), NÃO-BLOQUEANTE
   Overcast Realm

   Uso em qualquer página (igual antes, não muda a chamada):
     <script src="./course-gate.js"></script>
     ...
     <div id="page-content"> ...conteúdo real da página... </div>
     ...
     <script>
       CourseGate.protect({ cursos: ['games'], contentSelector: '#page-content' });
     </script>

   Mudança importante: o conteúdo NUNCA fica escondido esperando login.
   protect() só cuida de:
     1) mostrar um crachá pequeno e opcional pra vincular nome (igual o
        progress.js já faz nas páginas de exercício) — só pra registrar
        progresso/moedas, quem não vincular ainda assim usa a página normal;
     2) se o aluno JÁ vinculou nome em outra hora e o curso salvo não bate
        com o da página, mostra um avisinho discreto no topo (não trava nada).

   O vínculo continua em sessionStorage (some ao fechar o navegador) e some
   sozinho depois de 4h mesmo com a aba aberta, pra sala de informática.
============================================================================ */
window.CourseGate = (function(){
  const SUPABASE_URL = "https://kezlmecrxhjahhoekybs.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtlemxtZWNyeGhqYWhob2VreWJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5MDkwNjAsImV4cCI6MjEwMjQ4NTA2MH0.-TcsKrFxRMeiqKrzXk57E8-60eobk3fJ0Crn7ci0MW8";
  const IDENTITY_KEY = 'overcast_course_identity';
  const VALIDADE_MS = 4 * 60 * 60 * 1000; // 4 horas

  const NOMES_CURSO = { games: '🎮 Games', arte: '🎨 Arte Digital' };

  let sbClient = null;
  function loadSupabaseLib(){
    return new Promise((resolve) => {
      if(window.supabase){ resolve(); return; }
      const existing = document.querySelector('script[data-overcast-supabase]');
      if(existing){ existing.addEventListener('load', () => resolve()); existing.addEventListener('error', () => resolve()); return; }
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js';
      script.dataset.overcastSupabase = 'true';
      script.onload = () => resolve();
      script.onerror = () => resolve();
      document.head.appendChild(script);
    });
  }
  async function getSb(){
    await loadSupabaseLib();
    if(!window.supabase) return null;
    if(!sbClient) sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    return sbClient;
  }

  function getIdentity(){
    try{
      const raw = sessionStorage.getItem(IDENTITY_KEY);
      if(!raw) return null;
      const data = JSON.parse(raw);
      if(!data.linkedAt || Date.now() - data.linkedAt > VALIDADE_MS) {
        sessionStorage.removeItem(IDENTITY_KEY);
        return null;
      }
      return data;
    }catch(e){ return null; }
  }
  function setIdentity(data){
    sessionStorage.setItem(IDENTITY_KEY, JSON.stringify({ ...data, linkedAt: Date.now() }));
  }
  function clearIdentity(){ sessionStorage.removeItem(IDENTITY_KEY); }

  /* ---- estilos: crachá + modal + aviso, nada de tela cheia bloqueando ---- */
  function ensureStyles(){
    if(document.getElementById('cg-styles')) return;
    const style = document.createElement('style');
    style.id = 'cg-styles';
    style.textContent = `
      #cg-badge{ position:fixed; bottom:14px; right:14px; z-index:9998;
        display:inline-flex; align-items:center; gap:6px; font-family:'Baloo 2','Segoe UI',sans-serif;
        font-weight:700; font-size:12px; color:#2bb673; background:#e3fbf0; border:2px solid #2bb673;
        border-radius:999px; padding:8px 14px; cursor:pointer; box-shadow:0 4px 0 rgba(0,0,0,.25); }
      #cg-badge.unlinked{ color:#6b5b8a; background:#f2f0f7; border-color:#d8d0ec; }
      #cg-aviso-curso{ font-family:'Baloo 2','Segoe UI',sans-serif; font-weight:700; font-size:13px;
        color:#3a2b0f; background:#ffd23f; border-bottom:3px solid #b98a00; padding:10px 16px;
        display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap; }
      #cg-aviso-curso button{ font-family:inherit; font-weight:800; font-size:12px; border:none;
        border-radius:999px; padding:6px 12px; cursor:pointer; background:#3a2b0f; color:#ffd23f; }
      #cg-overlay{ position:fixed; inset:0; z-index:99999; background:rgba(20,15,35,.6);
        display:none; align-items:center; justify-content:center; padding:20px;
        font-family:'Baloo 2','Segoe UI',sans-serif; }
      #cg-overlay.show{ display:flex; }
      #cg-box{ background:#221b38; border:3px solid #443a63; border-radius:20px; padding:26px;
        max-width:400px; width:100%; box-shadow:0 8px 0 #0c091680; text-align:center; }
      #cg-box h2{ font-family:'Press Start 2P','Courier New',monospace; font-size:14px; color:#ffd23f; margin:0 0 14px; line-height:1.6; }
      #cg-box p{ color:#c9bfe8; font-weight:700; font-size:13px; line-height:1.5; margin:0 0 14px; }
      #cg-box input{ width:100%; padding:10px; border-radius:8px; border:2px solid #443a63; background:#150f24; color:#fff;
        font-family:inherit; font-size:14px; margin-bottom:8px; box-sizing:border-box; }
      #cg-box button{ font-family:'Press Start 2P','Courier New',monospace; font-weight:700; font-size:11px; border:none;
        border-radius:999px; padding:11px 16px; cursor:pointer; color:#fff; width:100%; margin-bottom:8px; }
      .cg-btn-primary{ background:#2fa8ec; } .cg-btn-list{ background:#7c3aed; text-align:center; }
      .cg-btn-gray{ background:#4a3a7c; }
      #cg-error{ color:#ff5c5c; font-size:12px; font-weight:700; margin:6px 0; min-height:16px; }
      #cg-aluno-list{ display:flex; flex-direction:column; gap:6px; max-height:220px; overflow-y:auto; margin-bottom:8px; }
      #cg-icon{ font-size:44px; margin-bottom:8px; }
    `;
    document.head.appendChild(style);
  }

  let opcoesAtuais = null; // { cursos, contentSelector }
  let turmaBusca = null;

  /* ---- crachá opcional (nunca esconde conteúdo) ---- */
  function badgeHTML(){
    const id = getIdentity();
    return id ? `👤 <b>${id.nome}</b> <span style="opacity:.7;">(trocar)</span>` : `🔗 Vincular meu nome`;
  }
  function mostrarBadge(){
    ensureStyles();
    let badge = document.getElementById('cg-badge');
    if(!badge){
      badge = document.createElement('div');
      badge.id = 'cg-badge';
      badge.onclick = abrirModalVinculo;
      document.body.appendChild(badge);
    }
    badge.className = getIdentity() ? '' : 'unlinked';
    badge.innerHTML = badgeHTML();
  }

  /* ---- modal de vínculo (mesmo fluxo de sempre, só que abre por escolha, não trava nada) ---- */
  function abrirModalVinculo(){
    ensureStyles();
    let overlay = document.getElementById('cg-overlay');
    if(!overlay){
      overlay = document.createElement('div');
      overlay.id = 'cg-overlay';
      document.body.appendChild(overlay);
      overlay.addEventListener('click', e => { if(e.target === overlay) fecharModalVinculo(); });
    }
    overlay.innerHTML = `<div id="cg-box">${telaVincularHTML()}</div>`;
    overlay.classList.add('show');
    document.getElementById('cg-buscar-btn').onclick = buscarTurma;
    document.getElementById('cg-turma-code').addEventListener('keydown', e => { if(e.key === 'Enter') buscarTurma(); });
    document.getElementById('cg-fechar-btn').onclick = fecharModalVinculo;
  }
  function fecharModalVinculo(){
    const overlay = document.getElementById('cg-overlay');
    if(overlay) overlay.classList.remove('show');
  }

  function telaVincularHTML(){
    return `
      <div id="cg-icon">🔗</div>
      <h2>VINCULAR NOME</h2>
      <p>Opcional — vincular seu nome salva seu progresso, moedas e avatar. Digite o código da sua turma:</p>
      <div id="cg-step-turma">
        <input type="text" id="cg-turma-code" placeholder="Código da turma">
        <button class="cg-btn-primary" id="cg-buscar-btn">🔎 Buscar Turma</button>
        <div id="cg-error"></div>
      </div>
      <div id="cg-step-aluno" style="display:none;">
        <p style="color:#ffd23f;font-weight:800;" id="cg-turma-nome"></p>
        <p style="font-size:12px;">Clique no seu nome:</p>
        <div id="cg-aluno-list"></div>
        <button class="cg-btn-gray" id="cg-trocar-turma-btn">← Trocar turma</button>
      </div>
      <button class="cg-btn-gray" id="cg-fechar-btn">✕ Fechar</button>
    `;
  }

  async function buscarTurma(){
    const code = document.getElementById('cg-turma-code').value.trim().toLowerCase();
    const errEl = document.getElementById('cg-error');
    if(!code){ errEl.textContent = '👉 Digite o código da turma.'; return; }
    const sb = await getSb();
    if(!sb){ errEl.textContent = '❌ Não consegui conectar. Recarregue a página.'; return; }
    errEl.textContent = '⏳ Buscando...';
    const { data: turma, error } = await sb.from('turmas').select('*').eq('codigo_acesso', code).maybeSingle();
    if(error || !turma){ errEl.textContent = '❌ Turma não encontrada.'; return; }
    errEl.textContent = '';
    const { data: alunos } = await sb.from('alunos').select('*').eq('turma_id', turma.id).order('nome');
    turmaBusca = { turma, alunos: alunos || [] };
    document.getElementById('cg-turma-nome').textContent = 'Turma: ' + turma.nome;
    document.getElementById('cg-aluno-list').innerHTML = (alunos && alunos.length)
      ? alunos.map((a,i) => `<button class="cg-btn-list" data-i="${i}">${a.nome}</button>`).join('')
      : '<p style="font-size:12px;">Nenhum aluno cadastrado nessa turma.</p>';
    document.querySelectorAll('#cg-aluno-list .cg-btn-list').forEach(btn => {
      btn.onclick = () => escolherAluno(parseInt(btn.dataset.i, 10));
    });
    document.getElementById('cg-step-turma').style.display = 'none';
    document.getElementById('cg-step-aluno').style.display = 'block';
    document.getElementById('cg-trocar-turma-btn').onclick = () => {
      document.getElementById('cg-step-turma').style.display = 'block';
      document.getElementById('cg-step-aluno').style.display = 'none';
    };
  }

  async function escolherAluno(i){
    if(!turmaBusca) return;
    const aluno = turmaBusca.alunos[i];
    if(!aluno) return;
    setIdentity({
      codigo: aluno.codigo, nome: aluno.nome,
      turmaCodigo: turmaBusca.turma.codigo_acesso, tipoCurso: turmaBusca.turma.tipo_curso
    });
    fecharModalVinculo();
    mostrarBadge();
    await checarAvisoCurso();
  }

  /* ---- aviso leve (não bloqueia) quando o curso salvo não bate com o da página ---- */
  function removerAviso(){
    const el = document.getElementById('cg-aviso-curso');
    if(el) el.remove();
  }
  function mostrarAviso(nomeAluno, tipoCursoAluno, cursosExigidos){
    ensureStyles();
    removerAviso();
    const nomeCursoAtual = NOMES_CURSO[tipoCursoAluno] || tipoCursoAluno;
    const nomesExigidos = cursosExigidos.map(c => NOMES_CURSO[c] || c).join(' ou ');
    const aviso = document.createElement('div');
    aviso.id = 'cg-aviso-curso';
    aviso.innerHTML = `
      <span>🚧 Oi, ${nomeAluno}! Essa atividade é do curso ${nomesExigidos}, mas seu vínculo é de ${nomeCursoAtual} — dá pra usar mesmo assim.</span>
      <button id="cg-aviso-trocar">🔁 Trocar vínculo</button>
    `;
    document.body.insertBefore(aviso, document.body.firstChild);
    document.getElementById('cg-aviso-trocar').onclick = () => { clearIdentity(); mostrarBadge(); removerAviso(); abrirModalVinculo(); };
  }

  async function checarAvisoCurso(){
    const identity = getIdentity();
    if(!identity || !opcoesAtuais){ removerAviso(); return; }
    let tipoCurso = identity.tipoCurso;
    const sb = await getSb();
    if(sb){
      const { data: turma } = await sb.from('turmas').select('tipo_curso').eq('codigo_acesso', identity.turmaCodigo).maybeSingle();
      if(turma) tipoCurso = turma.tipo_curso;
    }
    if(tipoCurso && !opcoesAtuais.cursos.includes(tipoCurso)){
      mostrarAviso(identity.nome, tipoCurso, opcoesAtuais.cursos);
    } else {
      removerAviso();
    }
  }

  /* ---- ponto de entrada: SEMPRE libera o conteúdo, nunca trava a página ---- */
  function protect(opcoes){
    opcoesAtuais = opcoes;
    // conteúdo sempre visível — se a página tinha o bloco escondido via
    // style="display:none" (padrão antigo), reexibe aqui
    if(opcoes.contentSelector){
      document.querySelectorAll(opcoes.contentSelector).forEach(el => { el.style.display = ''; });
    }
    mostrarBadge();
    checarAvisoCurso();
  }

  return { protect, getIdentity, clearIdentity, abrirModalVinculo };
})();
