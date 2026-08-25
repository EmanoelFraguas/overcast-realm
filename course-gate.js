/* ============================================================================
   CourseGate — controle de acesso por curso (games / arte)
   Overcast Realm

   Uso em qualquer página protegida:
     <script src="./course-gate.js"></script>
     ...
     <div id="page-content" style="display:none;"> ...conteúdo real da página... </div>
     ...
     <script>
       CourseGate.protect({ cursos: ['games'], contentSelector: '#page-content' });
     </script>

   O vínculo (turma + aluno) fica em sessionStorage — some sozinho ao fechar
   o navegador — e também expira depois de algumas horas mesmo se a aba
   continuar aberta, pra evitar que o aluno seguinte numa mesma máquina de
   sala de informática "herde" o login de quem usou antes.
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

  /* ---- injeta a tela de bloqueio (link ou "não é do seu curso") ---- */
  function ensureStyles(){
    if(document.getElementById('cg-styles')) return;
    const style = document.createElement('style');
    style.id = 'cg-styles';
    style.textContent = `
      #cg-overlay{ position:fixed; inset:0; z-index:99999; background:#14101f;
        display:flex; align-items:center; justify-content:center; padding:20px;
        font-family:'Baloo 2','Segoe UI',sans-serif; }
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

  function mostrarOverlay(html){
    ensureStyles();
    let overlay = document.getElementById('cg-overlay');
    if(!overlay){
      overlay = document.createElement('div');
      overlay.id = 'cg-overlay';
      document.body.appendChild(overlay);
    }
    overlay.innerHTML = `<div id="cg-box">${html}</div>`;
  }
  function esconderOverlay(){
    const overlay = document.getElementById('cg-overlay');
    if(overlay) overlay.remove();
  }
  function liberarConteudo(){
    if(opcoesAtuais && opcoesAtuais.contentSelector){
      document.querySelectorAll(opcoesAtuais.contentSelector).forEach(el => { el.style.display = ''; });
    }
    esconderOverlay();
  }

  const LINK_VOLTAR = `<a href="./index.html" style="display:block;color:#8f88a8;font-size:12px;font-weight:700;text-decoration:none;margin-top:10px;">← Voltar pro Overcast Realm</a>`;

  function telaVincular(mensagemExtra){
    mostrarOverlay(`
      <div id="cg-icon">🔒</div>
      <h2>ÁREA RESTRITA</h2>
      <p>${mensagemExtra || 'Essa atividade é só pra quem já vinculou o nome. Digite o código da sua turma:'}</p>
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
      ${LINK_VOLTAR}
    `);
    document.getElementById('cg-buscar-btn').onclick = buscarTurma;
    document.getElementById('cg-turma-code').addEventListener('keydown', e => { if(e.key === 'Enter') buscarTurma(); });
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
    await validarEExibir();
  }

  function telaCursoErrado(nomeAluno, tipoCursoAluno, cursosExigidos){
    const nomeCursoAtual = NOMES_CURSO[tipoCursoAluno] || tipoCursoAluno;
    const nomesExigidos = cursosExigidos.map(c => NOMES_CURSO[c] || c).join(' ou ');
    mostrarOverlay(`
      <div id="cg-icon">🚫</div>
      <h2>NÃO É DA SUA TURMA</h2>
      <p>Oi, ${nomeAluno}! Essa atividade é do curso <b>${nomesExigidos}</b>, mas sua turma é de <b>${nomeCursoAtual}</b>.</p>
      <button class="cg-btn-gray" id="cg-trocar-btn">🔁 Vincular com outro nome</button>
      ${LINK_VOLTAR}
    `);
    document.getElementById('cg-trocar-btn').onclick = () => { clearIdentity(); telaVincular(); };
  }

  async function validarEExibir(){
    const identity = getIdentity();
    if(!identity){ telaVincular(); return; }

    // se já sabemos o tipo_curso da última vez que vinculou, usa como resposta rápida,
    // mas revalida com o banco pra garantir que não mudou
    const sb = await getSb();
    let tipoCurso = identity.tipoCurso;
    if(sb){
      const { data: turma } = await sb.from('turmas').select('tipo_curso').eq('codigo_acesso', identity.turmaCodigo).maybeSingle();
      if(turma) tipoCurso = turma.tipo_curso;
    }

    if(opcoesAtuais.cursos.includes(tipoCurso)){
      liberarConteudo();
    } else {
      telaCursoErrado(identity.nome, tipoCurso, opcoesAtuais.cursos);
    }
  }

  function protect(opcoes){
    opcoesAtuais = opcoes;
    validarEExibir();
  }

  return { protect, getIdentity, clearIdentity };
})();
