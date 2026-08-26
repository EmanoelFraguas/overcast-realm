/* ============================================================================
   AvatarRender — desenha o bonequinho de pixel art em camadas
   Overcast Realm

   Uso:
     <script src="./avatar-render.js"></script>
     <div id="meu-avatar"></div>
     <script>
       AvatarRender.render(document.getElementById('meu-avatar'), {
         pele: 'clara', roupa: 'roupa_camiseta_verde', chapeu: 'chapeu_coroa', acessorio: null
       }, 6); // 6 = tamanho de cada pixel em px (ajuste pro tamanho que precisar)
     </script>
============================================================================ */
window.AvatarRender = (function(){
  const GRID_W = 21, GRID_H = 22;
  const CX = 10;

  function dentroCirculo(gx, gy, cx, cy, r){ return Math.hypot(gx-cx, gy-cy) <= r; }

  const PELES = {
    clara:    { nome: 'Clara',    cor: '#f5d0a9' },
    media:    { nome: 'Média',    cor: '#dba374' },
    morena:   { nome: 'Morena',   cor: '#a86d3f' },
    escura:   { nome: 'Escura',   cor: '#6b4226' },
    fantasia: { nome: 'Fantasia', cor: '#9b7bd4' }
  };

  // cada função recebe (gx,gy) e devolve uma cor (string) ou null (transparente)
  function corBase(gx, gy, corPele){
    if(dentroCirculo(gx,gy,CX,5,4)) return corPele;                              // cabeça
    if(gy>=8 && gy<=9 && gx>=9 && gx<=11) return corPele;                        // pescoço
    if(gy>=10 && gy<=15 && ((gx>=4&&gx<=5)||(gx>=15&&gx<=16))) return corPele;   // mãos/braços
    return null;
  }
  function corRoupaDefault(gx, gy){
    if(gy>=9 && gy<=17 && gx>=7 && gx<=13) return '#8ecae6';
    if(gy>=18 && gy<=21 && ((gx>=7&&gx<=9)||(gx>=11&&gx<=13))) return '#3a3a3a';
    if(gy>=10 && gy<=13 && ((gx>=4&&gx<=5)||(gx>=15&&gx<=16))) return '#8ecae6';
    return null;
  }

  const ITENS = {
    roupa_camiseta_verde: { slot:'roupa', nome:'Camiseta Verde', paint(gx,gy){
      if(gy>=9 && gy<=17 && gx>=7 && gx<=13) return '#4be08f';
      if(gy>=18 && gy<=21 && ((gx>=7&&gx<=9)||(gx>=11&&gx<=13))) return '#3a3a3a';
      if(gy>=10 && gy<=13 && ((gx>=4&&gx<=5)||(gx>=15&&gx<=16))) return '#4be08f';
      return null;
    }},
    roupa_jaqueta_roxa: { slot:'roupa', nome:'Jaqueta Roxa', paint(gx,gy){
      if(gy===9 && gx>=7 && gx<=13) return '#a78bfa';
      if(gy>=10 && gy<=17 && gx>=7 && gx<=13) return '#7c3aed';
      if(gy>=18 && gy<=21 && ((gx>=7&&gx<=9)||(gx>=11&&gx<=13))) return '#4a4a4a';
      if(gy>=10 && gy<=13 && ((gx>=4&&gx<=5)||(gx>=15&&gx<=16))) return '#7c3aed';
      return null;
    }},
    roupa_listrada: { slot:'roupa', nome:'Camiseta Listrada', paint(gx,gy){
      if(gy>=9 && gy<=17 && gx>=7 && gx<=13) return (gy%2===0) ? '#ffffff' : '#e63946';
      if(gy>=18 && gy<=21 && ((gx>=7&&gx<=9)||(gx>=11&&gx<=13))) return '#2f6fb0';
      if(gy>=10 && gy<=13 && ((gx>=4&&gx<=5)||(gx>=15&&gx<=16))) return (gy%2===0) ? '#ffffff' : '#e63946';
      return null;
    }},
    roupa_armadura: { slot:'roupa', nome:'Armadura', paint(gx,gy){
      if(gy>=9 && gy<=17 && gx>=7 && gx<=13) return (gx===10) ? '#8a8a94' : '#c9c9d4';
      if(gy>=18 && gy<=21 && ((gx>=7&&gx<=9)||(gx>=11&&gx<=13))) return '#8a8a94';
      if(gy>=10 && gy<=13 && ((gx>=4&&gx<=5)||(gx>=15&&gx<=16))) return '#c9c9d4';
      return null;
    }},

    chapeu_bone: { slot:'chapeu', nome:'Boné', paint(gx,gy){
      if(dentroCirculo(gx,gy,CX,4,3.3) && gy<=5) return '#e63946';
      if(gy===5 && gx>=11 && gx<=15) return '#e63946';
      return null;
    }},
    chapeu_coroa: { slot:'chapeu', nome:'Coroa', paint(gx,gy){
      if(gy===3 && gx>=7 && gx<=13) return '#ffd23f';
      if(gy===2 && (gx===8||gx===10||gx===12)) return '#ffd23f';
      if(gy===1 && gx===10) return '#ffd23f';
      return null;
    }},
    chapeu_capacete: { slot:'chapeu', nome:'Capacete', paint(gx,gy){
      if(dentroCirculo(gx,gy,CX,5,4.5) && gy<=6) return '#5c7a99';
      if(gy===6 && gx>=7 && gx<=13) return '#2c3e50';
      return null;
    }},
    chapeu_mago: { slot:'chapeu', nome:'Chapéu de Mago', paint(gx,gy){
      const largura = Math.max(0, gy*1.1);
      if(gy>=0 && gy<=4 && Math.abs(gx-CX) <= largura*0.6) return '#5e3a87';
      if(gy===5 && gx>=6 && gx<=14) return '#5e3a87';
      return null;
    }},

    acessorio_oculos: { slot:'acessorio', nome:'Óculos', paint(gx,gy){
      if(gy===6 && ((gx>=7&&gx<=8)||(gx>=12&&gx<=13))) return '#1a1a1a';
      return null;
    }},
    acessorio_mochila: { slot:'acessorio', nome:'Mochila', paint(gx,gy){
      if(gy>=10 && gy<=16 && gx>=1 && gx<=3) return '#6b4226';
      return null;
    }},
    acessorio_asas: { slot:'acessorio', nome:'Asas', paint(gx,gy){
      const alturaCentro = 11.5;
      if(gy>=9 && gy<=14 && gx<=4 && Math.abs(gy-alturaCentro) <= gx*0.9) return '#f4f4f4';
      if(gy>=9 && gy<=14 && gx>=16 && Math.abs(gy-alturaCentro) <= (GRID_W-1-gx)*0.9) return '#f4f4f4';
      return null;
    }},
    acessorio_cachecol: { slot:'acessorio', nome:'Cachecol', paint(gx,gy){
      if(gy>=8 && gy<=9 && gx>=7 && gx<=13) return '#e63946';
      if(gy>=10 && gy<=12 && gx>=8 && gx<=9) return '#e63946';
      return null;
    }}
  };

  function corPixel(gx, gy, equip){
    const corPele = (PELES[equip.pele] || PELES.clara).cor;

    // ordem: pele/roupa (base) -> acessório -> chapéu (sempre por cima)
    if(equip.chapeu && ITENS[equip.chapeu]){
      const c = ITENS[equip.chapeu].paint(gx, gy);
      if(c) return c;
    }
    if(equip.acessorio && ITENS[equip.acessorio]){
      const c = ITENS[equip.acessorio].paint(gx, gy);
      if(c) return c;
    }
    if(equip.roupa && ITENS[equip.roupa]){
      const c = ITENS[equip.roupa].paint(gx, gy);
      if(c) return c;
    }
    const roupaPadrao = corRoupaDefault(gx, gy);
    if(roupaPadrao) return roupaPadrao;

    return corBase(gx, gy, corPele);
  }

  // desenha o avatar dentro de um elemento container, usando uma grid de divs
  function render(container, equip, cellPx){
    cellPx = cellPx || 6;
    container.style.display = 'grid';
    container.style.gridTemplateColumns = `repeat(${GRID_W}, ${cellPx}px)`;
    container.style.gridTemplateRows = `repeat(${GRID_H}, ${cellPx}px)`;
    container.style.lineHeight = '0';
    let html = '';
    for(let gy=0; gy<GRID_H; gy++){
      for(let gx=0; gx<GRID_W; gx++){
        const cor = corPixel(gx, gy, equip || {});
        html += `<div style="width:100%;height:100%;background:${cor||'transparent'};"></div>`;
      }
    }
    container.innerHTML = html;
  }

  function itensPorSlot(slot){
    return Object.entries(ITENS).filter(([id,it]) => it.slot === slot).map(([id,it]) => ({ id, ...it }));
  }

  return { render, ITENS, PELES, GRID_W, GRID_H, itensPorSlot };
})();
