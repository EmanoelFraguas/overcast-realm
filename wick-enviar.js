(function () {
  // Confirma que estamos dentro do Wick Editor (ele define a função de salvar arquivos: window.saveFileFromWick)
  if (typeof window.saveFileFromWick !== 'function') {
    alert('⚠️ Abra este favorito com a aba do Wick Editor aberta (editor.wickeditor.com).');
    return;
  }

  var SUPABASE_URL = 'https://kezlmecrxhjahhoekybs.supabase.co';
  var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtlemxtZWNyeGhqYWhob2VreWJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5MDkwNjAsImV4cCI6MjEwMjQ4NTA2MH0.-TcsKrFxRMeiqKrzXk57E8-60eobk3fJ0Crn7ci0MW8';
  var HEADERS = { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + SUPABASE_ANON_KEY };

  // Guarda a função original do Wick só na 1ª vez (clicar no favorito de novo não empilha nada)
  if (!window.__overcastWickOriginal) window.__overcastWickOriginal = window.saveFileFromWick;
  var salvarOriginal = window.__overcastWickOriginal;
  // clicar no favorito de novo = escolher o aluno de novo
  window.__overcastWickAluno = null;

  function aviso(texto, cor, ms) {
    var el = document.createElement('div');
    el.textContent = texto;
    el.style.cssText = 'position:fixed;top:16px;right:16px;z-index:2147483647;background:' + cor + ';color:#fff;' +
      'font-family:sans-serif;font-weight:bold;font-size:14px;padding:12px 18px;border-radius:10px;' +
      'box-shadow:0 6px 16px rgba(0,0,0,.4);max-width:340px;';
    document.body.appendChild(el);
    if (ms) setTimeout(function () { el.remove(); }, ms);
    return el;
  }

  // Painel: código da turma -> lista de alunos -> aluno escolhido (rejeita se cancelar)
  function escolherAluno() {
    return new Promise(function (resolve, reject) {
      var codigoTurma = prompt('Qual é o código da turma?');
      if (!codigoTurma) { reject(new Error('cancelado')); return; }
      codigoTurma = codigoTurma.trim().toLowerCase();

      var antigo = document.getElementById('overcast-envio-painel');
      if (antigo) antigo.remove();
      var painel = document.createElement('div');
      painel.id = 'overcast-envio-painel';
      painel.style.cssText = 'position:fixed;inset:0;background:rgba(10,6,20,.75);z-index:2147483647;' +
        'display:flex;align-items:center;justify-content:center;font-family:sans-serif;';
      painel.innerHTML = '<div style="background:#1e1a2e;border:2px solid #322c47;border-radius:16px;' +
        'padding:22px;max-width:320px;width:90%;max-height:80vh;overflow-y:auto;color:#fff;">' +
        '<p style="font-weight:bold;margin:0 0 12px;">⏳ Buscando turma...</p></div>';
      document.body.appendChild(painel);
      var caixa = painel.firstChild;
      function fechar() { painel.remove(); }
      function botaoFechar(texto) {
        return '<button id="ov-fechar" style="margin-top:10px;width:100%;padding:10px;border-radius:8px;border:none;' +
          'background:#322c47;color:#fff;cursor:pointer;">' + texto + '</button>';
      }
      function ligarFechar() {
        document.getElementById('ov-fechar').onclick = function () { fechar(); reject(new Error('cancelado')); };
      }

      fetch(SUPABASE_URL + '/rest/v1/turmas?codigo_acesso=eq.' + encodeURIComponent(codigoTurma) + '&select=*', { headers: HEADERS })
        .then(function (r) { return r.json(); })
        .then(function (turmas) {
          var turma = turmas && turmas[0];
          if (!turma) {
            caixa.innerHTML = '<p style="color:#fb7185;font-weight:bold;">❌ Turma não encontrada.</p>' + botaoFechar('Fechar');
            ligarFechar();
            return;
          }
          return fetch(SUPABASE_URL + '/rest/v1/alunos?turma_id=eq.' + turma.id + '&select=*&order=nome', { headers: HEADERS })
            .then(function (r) { return r.json(); })
            .then(function (alunos) {
              alunos = alunos || [];
              var html = '<p style="font-weight:bold;color:#a78bfa;margin:0 0 4px;"></p>' +
                '<p style="color:#9c93b8;font-size:13px;margin:0 0 10px;">Toque no seu nome:</p><div id="ov-lista"></div>' +
                botaoFechar('Cancelar');
              caixa.innerHTML = html;
              caixa.firstChild.textContent = turma.nome;
              var lista = document.getElementById('ov-lista');
              if (!alunos.length) lista.innerHTML = '<p style="color:#9c93b8;font-size:13px;">Nenhum aluno cadastrado.</p>';
              alunos.forEach(function (a) {
                var b = document.createElement('button');
                b.textContent = a.nome;
                b.style.cssText = 'display:block;width:100%;text-align:left;padding:12px 14px;margin-bottom:6px;' +
                  'border-radius:10px;border:2px solid #322c47;background:#150f24;color:#fff;font-weight:bold;font-size:14px;cursor:pointer;';
                b.onclick = function () { fechar(); resolve(a); };
                lista.appendChild(b);
              });
              ligarFechar();
            });
        })
        .catch(function (err) {
          caixa.innerHTML = '<p style="color:#fb7185;font-weight:bold;"></p>' + botaoFechar('Fechar');
          caixa.firstChild.textContent = '❌ Erro: ' + err.message;
          ligarFechar();
        });
    });
  }

  // nome seguro pro Storage: sem acentos, espaços ou símbolos
  function nomeSeguro(s) {
    s = String(s || 'wick').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9._-]+/g, '_')
      .replace(/^_+|_+$/g, '').slice(0, 60);
    return s || 'wick';
  }
  function carimbo() {
    var d = new Date(), p = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '_' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
  }

  function enviarArquivo(aluno, file, name, extension) {
    var nomeArquivo = nomeSeguro(name) + '_' + carimbo() + extension;
    var storagePath = 'envios/' + aluno.codigo + '/' + nomeArquivo;
    return fetch(SUPABASE_URL + '/storage/v1/object/submissoes/' + storagePath, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: 'Bearer ' + SUPABASE_ANON_KEY,
        'Content-Type': file.type || 'application/octet-stream',
        'x-upsert': 'true'
      },
      body: file
    })
      .then(function (resp) {
        if (!resp.ok) return resp.text().then(function (t) { throw new Error(t); });
        return fetch(SUPABASE_URL + '/rest/v1/rpc/registrar_envio', {
          method: 'POST',
          headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            p_codigo: aluno.codigo, p_nome_arquivo: nomeArquivo, p_storage_path: storagePath,
            p_tipo: 'envio', p_tamanho_bytes: file.size
          })
        });
      })
      .then(function (resp) {
        if (!resp.ok) return resp.text().then(function (t) { throw new Error(t); });
        return nomeArquivo;
      });
  }

  // Troca a função de salvar do Wick: em vez de baixar o arquivo, manda pro Overcast
  window.saveFileFromWick = function (file, name, extension, successCallback, failureCallback) {
    var pegarAluno = window.__overcastWickAluno
      ? Promise.resolve(window.__overcastWickAluno)
      : escolherAluno().then(function (a) { window.__overcastWickAluno = a; return a; });

    pegarAluno
      .then(function (aluno) {
        var el = aviso('⏳ Enviando pro Overcast...', '#7c3aed');
        return enviarArquivo(aluno, file, name, extension).then(function (nomeArquivo) {
          el.textContent = '✅ Enviado pro Overcast: ' + aluno.nome + ' — ' + nomeArquivo;
          el.style.background = '#16a34a';
          setTimeout(function () { el.remove(); }, 5000);
          if (successCallback) successCallback();
        }, function (err) { el.remove(); throw err; });
      })
      .catch(function (err) {
        if (err && err.message === 'cancelado') {
          aviso('Envio cancelado — nada foi salvo.', '#6b7280', 4000);
          if (failureCallback) failureCallback();
          return;
        }
        // deu erro no envio: salva no computador do jeito normal pra o trabalho não se perder
        aviso('❌ Não consegui enviar (' + (err && err.message ? err.message : err) + '). Salvei no computador.', '#dc2626', 8000);
        salvarOriginal(file, name, extension, successCallback, failureCallback);
      });
  };

  aviso('✅ Pronto! Agora, ao salvar/exportar no Wick, o arquivo vai pro Overcast.', '#16a34a', 5000);
})();
