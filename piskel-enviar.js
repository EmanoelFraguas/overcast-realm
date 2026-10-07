(function () {
  // Confirma que estamos mesmo dentro do Piskel (a variável global "pskl" só existe lá)
  if (typeof pskl === 'undefined' || !pskl.app || !pskl.app.piskelController) {
    alert('⚠️ Abra este favorito com a aba do Piskel aberta (piskelapp.com), com o desenho pronto.');
    return;
  }

  var SUPABASE_URL = 'https://kezlmecrxhjahhoekybs.supabase.co';
  var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtlemxtZWNyeGhqYWhob2VreWJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5MDkwNjAsImV4cCI6MjEwMjQ4NTA2MH0.-TcsKrFxRMeiqKrzXk57E8-60eobk3fJ0Crn7ci0MW8';
  var HEADERS = { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + SUPABASE_ANON_KEY };

  var pc = pskl.app.piskelController;
  var frameCount = pc.getFrameCount();
  var ehAnimacao = frameCount > 1;

  // Se for um desenho parado (1 frame só), já pega o PNG logo de cara — se der erro, nem vale
  // a pena pedir turma/aluno. Se for animação (mais de 1 frame), o GIF é gerado só depois de
  // escolher o aluno (a geração é mais pesada e não precisa travar a escolha da turma).
  var dataUrl;
  if (!ehAnimacao) {
    try {
      dataUrl = pskl.app.getFirstFrameAsPng();
    } catch (e) {
      alert('❌ Não consegui pegar o desenho do Piskel: ' + e.message);
      return;
    }
  }

  // ---- Codificador de GIF com cores EXATAS ----
  // O codificador do Piskel aproxima as cores (NeuQuant) e usa o amarelo puro como "cor transparente";
  // em alguns desenhos isso deixa pontinhos amarelos no fundo. Este aqui usa exatamente as cores do
  // desenho (até 255) e transparência de verdade, então não aparece ruído.
  // Codificador de GIF com cores EXATAS (sem aproximação) e transparência de 1 bit.
  // frames: array de Uint8ClampedArray RGBA (w*h*4). Retorna Blob, ou null se passar de 255 cores.
  function gifExato(frames, w, h, delayMs) {
    var LIM = 128;                       // alpha < 128 vira transparente
    var paleta = new Map();              // "r,g,b" -> índice (1..255); índice 0 = transparente
    var cores = [];                      // [r,g,b] na ordem dos índices 1..
    var quadros = frames.map(function (d) {
      var idx = new Uint8Array(w * h);
      for (var p = 0, i = 0; p < w * h; p++, i += 4) {
        if (d[i + 3] < LIM) { idx[p] = 0; continue; }
        var chave = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
        var n = paleta.get(chave);
        if (n === undefined) {
          if (cores.length >= 255) { n = -1; } else { n = cores.length + 1; paleta.set(chave, n); cores.push([d[i], d[i + 1], d[i + 2]]); }
        }
        if (n === -1) return null;
        idx[p] = n;
      }
      return idx;
    });
    if (quadros.some(function (q) { return q === null; })) return null;

    var bits = 1;                        // tamanho da tabela = 2^bits (>= cores+1)
    while ((1 << bits) < cores.length + 1) bits++;
    var tam = 1 << bits;
    var minCode = Math.max(2, bits);

    var out = [];
    function b(v) { out.push(v & 255); }
    function s(v) { b(v); b(v >> 8); }
    function txt(t) { for (var i = 0; i < t.length; i++) b(t.charCodeAt(i)); }

    txt('GIF89a'); s(w); s(h);
    b(0x80 | 0x70 | (bits - 1)); b(0); b(0);          // tabela global + profundidade de cor
    b(0); b(0); b(0);                                   // índice 0 (transparente) = preto
    for (var c = 0; c < cores.length; c++) { b(cores[c][0]); b(cores[c][1]); b(cores[c][2]); }
    for (var f = cores.length + 1; f < tam; f++) { b(0); b(0); b(0); }
    if (quadros.length > 1) { b(0x21); b(0xFF); b(11); txt('NETSCAPE2.0'); b(3); b(1); s(0); b(0); }   // repete pra sempre

    var atraso = Math.max(2, Math.round(delayMs / 10));
    quadros.forEach(function (idx) {
      b(0x21); b(0xF9); b(4); b((2 << 2) | 1); s(atraso); b(0); b(0);   // transparência no índice 0, descarta o quadro anterior
      b(0x2C); s(0); s(0); s(w); s(h); b(0);
      b(minCode);
      var dados = lzw(minCode, idx);
      for (var o = 0; o < dados.length; o += 255) {
        var pedaco = dados.slice(o, o + 255);
        b(pedaco.length); for (var k = 0; k < pedaco.length; k++) b(pedaco[k]);
      }
      b(0);
    });
    b(0x3B);
    return new Blob([new Uint8Array(out)], { type: 'image/gif' });
  }

  function lzw(minCode, idx) {
    var clear = 1 << minCode, eoi = clear + 1;
    var tamCod = minCode + 1, prox = eoi + 1, dic = new Map();
    var saida = [], atual = 0, nbits = 0;
    function emite(c) {
      atual |= c << nbits; nbits += tamCod;
      while (nbits >= 8) { saida.push(atual & 255); atual >>= 8; nbits -= 8; }
    }
    emite(clear);
    var prefixo = idx[0];
    for (var i = 1; i < idx.length; i++) {
      var k = idx[i], chave = (prefixo << 8) | k, achou = dic.get(chave);
      if (achou !== undefined) { prefixo = achou; continue; }
      emite(prefixo);
      if (prox < 4096) {
        dic.set(chave, prox);
        if (prox === (1 << tamCod)) tamCod++;
        prox++;
      } else {
        emite(clear); dic = new Map(); tamCod = minCode + 1; prox = eoi + 1;
      }
      prefixo = k;
    }
    emite(prefixo); emite(eoi);
    if (nbits > 0) saida.push(atual & 255);
    return saida;
  }

  // Gera o GIF animado: primeiro tenta o jeito exato (acima); só se o desenho tiver mais de 255
  // cores usa o codificador do próprio Piskel (que aproxima as cores).
  function gerarGifAnimado() {
    return new Promise(function (resolve, reject) {
      try {
        var width = pc.getWidth();
        var height = pc.getHeight();
        var fps = pc.getFPS();

        // pega cada quadro como pixels (RGBA)
        var quadrosRGBA = [];
        for (var q = 0; q < frameCount; q++) {
          var render = pc.renderFrameAt(q, true);
          var cv = pskl.utils.CanvasUtils.createCanvas(width, height);
          var cx = cv.getContext('2d');
          cx.drawImage(render, 0, 0, width, height);
          quadrosRGBA.push(cx.getImageData(0, 0, width, height).data);
        }

        var exato = gifExato(quadrosRGBA, width, height, 1000 / fps);
        if (exato) { resolve(exato); return; }

        // plano B: desenho com mais de 255 cores -> codificador do Piskel
        if (!window.GIF) {
          reject(new Error('Biblioteca de GIF do Piskel não encontrada nesta página.'));
          return;
        }
        var MAX_GIF_COLORS = 256;
        var currentColors = pskl.app.currentColorsService.getCurrentColors();
        var layers = pc.getLayers();
        var isTransparent = layers.some(function (l) { return l.isTransparent(); });
        var preserveColors = !isTransparent && currentColors.length < MAX_GIF_COLORS;

        var transparentColor, transparent;
        if (preserveColors) {
          transparentColor = pskl.utils.ColorUtils.getUnusedColor(currentColors) || '#FF00FF';
          transparent = parseInt(transparentColor.substring(1), 16);
        } else {
          transparentColor = '#FFFFFF';
          transparent = null;
        }

        var gif = new window.GIF({
          workers: 5,
          quality: 1,   // igual ao do Piskel (quanto menor, mais fiel)
          width: width,
          height: height,
          preserveColors: preserveColors,
          repeat: 0,
          transparent: transparent
        });

        var background = pskl.utils.CanvasUtils.createCanvas(width, height);
        var context = background.getContext('2d');
        context.fillStyle = transparentColor;

        for (var i = 0; i < frameCount; i++) {
          var render2 = pc.renderFrameAt(i, true);
          context.clearRect(0, 0, width, height);
          context.fillRect(0, 0, width, height);
          context.drawImage(render2, 0, 0, width, height);
          var canvas = pskl.utils.ImageResizer.scale(background, 1);
          gif.addFrame(canvas.getContext('2d'), { delay: 1000 / fps });
        }

        gif.on('finished', function (blob) { resolve(blob); });
        gif.render();
      } catch (e) {
        reject(e);
      }
    });
  }

  var codigoTurma = prompt('Qual é o código da turma?');
  if (!codigoTurma) return;
  codigoTurma = codigoTurma.trim().toLowerCase();

  // remove qualquer painel antigo que tenha ficado aberto
  var antigo = document.getElementById('overcast-envio-painel');
  if (antigo) antigo.remove();

  var painel = document.createElement('div');
  painel.id = 'overcast-envio-painel';
  painel.style.cssText = 'position:fixed;inset:0;background:rgba(10,6,20,.75);z-index:999999;' +
    'display:flex;align-items:center;justify-content:center;font-family:sans-serif;';
  painel.innerHTML = '<div style="background:#1e1a2e;border:2px solid #322c47;border-radius:16px;' +
    'padding:22px;max-width:320px;width:90%;max-height:80vh;overflow-y:auto;color:#fff;">' +
    '<p style="font-weight:bold;margin:0 0 12px;">⏳ Buscando turma...</p></div>';
  document.body.appendChild(painel);
  var caixa = painel.firstChild;

  function fechar() { painel.remove(); }

  fetch(SUPABASE_URL + '/rest/v1/turmas?codigo_acesso=eq.' + encodeURIComponent(codigoTurma) + '&select=*', {
    headers: HEADERS
  })
    .then(function (r) { return r.json(); })
    .then(function (turmas) {
      var turma = turmas && turmas[0];
      if (!turma) {
        caixa.innerHTML = '<p style="color:#fb7185;font-weight:bold;">❌ Turma não encontrada.</p>' +
          '<button id="ov-fechar" style="margin-top:10px;width:100%;padding:10px;border-radius:8px;border:none;background:#322c47;color:#fff;cursor:pointer;">Fechar</button>';
        document.getElementById('ov-fechar').onclick = fechar;
        return;
      }
      return fetch(SUPABASE_URL + '/rest/v1/alunos?turma_id=eq.' + turma.id + '&select=*&order=nome', {
        headers: HEADERS
      })
        .then(function (r) { return r.json(); })
        .then(function (alunos) {
          alunos = alunos || [];
          var html = '<p style="font-weight:bold;color:#a78bfa;margin:0 0 4px;">' + turma.nome + '</p>' +
            '<p style="color:#9c93b8;font-size:13px;margin:0 0 10px;">Toque no seu nome:</p>';
          if (!alunos.length) {
            html += '<p style="color:#9c93b8;font-size:13px;">Nenhum aluno cadastrado.</p>';
          } else {
            alunos.forEach(function (a, i) {
              html += '<button data-i="' + i + '" class="ov-aluno-btn" style="display:block;width:100%;text-align:left;' +
                'padding:12px 14px;margin-bottom:6px;border-radius:10px;border:2px solid #322c47;background:#150f24;' +
                'color:#fff;font-weight:bold;font-size:14px;cursor:pointer;">' + a.nome + '</button>';
            });
          }
          html += '<button id="ov-fechar" style="margin-top:6px;width:100%;padding:10px;border-radius:8px;border:none;background:#322c47;color:#fff;cursor:pointer;">Cancelar</button>';
          caixa.innerHTML = html;
          document.getElementById('ov-fechar').onclick = fechar;
          Array.prototype.forEach.call(caixa.querySelectorAll('.ov-aluno-btn'), function (btn) {
            btn.onclick = function () {
              enviar(alunos[parseInt(btn.dataset.i, 10)]);
            };
          });
        });
    })
    .catch(function (err) {
      caixa.innerHTML = '<p style="color:#fb7185;font-weight:bold;">❌ Erro: ' + err.message + '</p>' +
        '<button id="ov-fechar" style="margin-top:10px;width:100%;padding:10px;border-radius:8px;border:none;background:#322c47;color:#fff;cursor:pointer;">Fechar</button>';
      document.getElementById('ov-fechar').onclick = fechar;
    });

  function enviar(aluno) {
    fechar();
    var codigo = aluno.codigo;

    var aviso = document.createElement('div');
    aviso.textContent = ehAnimacao ? '🎞️ Gerando GIF animado...' : '⏳ Enviando pro Overcast...';
    aviso.style.cssText = 'position:fixed;top:16px;right:16px;z-index:999999;background:#7c3aed;color:#fff;' +
      'font-family:sans-serif;font-weight:bold;font-size:14px;padding:12px 18px;border-radius:10px;' +
      'box-shadow:0 6px 16px rgba(0,0,0,.4);';
    document.body.appendChild(aviso);

    var preparar = ehAnimacao
      ? gerarGifAnimado().then(function (blob) { return { blob: blob, ext: '.gif', tipo: 'image/gif' }; })
      : Promise.resolve().then(function () {
          var base64 = dataUrl.split(',')[1];
          var binStr = atob(base64);
          var bytes = new Uint8Array(binStr.length);
          for (var i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
          return { blob: new Blob([bytes], { type: 'image/png' }), ext: '.png', tipo: 'image/png' };
        });

    preparar
      .then(function (resultado) {
        aviso.textContent = '⏳ Enviando pro Overcast...';

        var agora = new Date();
        var pad = function (n) { return String(n).padStart(2, '0'); };
        var nomeArquivo = 'piskel_' + agora.getFullYear() + pad(agora.getMonth() + 1) + pad(agora.getDate())
          + '_' + pad(agora.getHours()) + pad(agora.getMinutes()) + pad(agora.getSeconds()) + resultado.ext;
        var storagePath = 'envios/' + codigo + '/' + nomeArquivo;

        return fetch(SUPABASE_URL + '/storage/v1/object/submissoes/' + storagePath, {
          method: 'POST',
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: 'Bearer ' + SUPABASE_ANON_KEY,
            'Content-Type': resultado.tipo,
            'x-upsert': 'true'
          },
          body: resultado.blob
        })
          .then(function (resp) {
            if (!resp.ok) return resp.text().then(function (t) { throw new Error(t); });
            return fetch(SUPABASE_URL + '/rest/v1/rpc/registrar_envio', {
              method: 'POST',
              headers: {
                apikey: SUPABASE_ANON_KEY,
                Authorization: 'Bearer ' + SUPABASE_ANON_KEY,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                p_codigo: codigo,
                p_nome_arquivo: nomeArquivo,
                p_storage_path: storagePath,
                p_tipo: 'envio',
                p_tamanho_bytes: resultado.blob.size
              })
            });
          });
      })
      .then(function (resp) {
        if (!resp.ok) return resp.text().then(function (t) { throw new Error(t); });
        aviso.textContent = '✅ Desenho de ' + aluno.nome + ' enviado!';
        aviso.style.background = '#16a34a';
        setTimeout(function () { aviso.remove(); }, 3500);
      })
      .catch(function (err) {
        aviso.textContent = '❌ Erro ao enviar: ' + err.message;
        aviso.style.background = '#dc2626';
        setTimeout(function () { aviso.remove(); }, 6000);
      });
  }
})();
