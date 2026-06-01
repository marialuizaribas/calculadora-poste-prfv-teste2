// ============================================================
//  calculo.js — Motor de cálculo estrutural para postes PRFV
//
//  LÓGICA PRINCIPAL:
//  Para cada segmento, o software testa automaticamente o número
//  mínimo de camadas necessário para atender simultaneamente:
//    (a) CS à flexão >= CS_min (critério de tensão máxima)
//    (b) CS à compressão >= CS_min
//    (c) Flecha total <= flecha máxima permitida
//
//  O número de camadas é encontrado por busca iterativa:
//  começa em 1 camada e aumenta até todos os critérios serem
//  atendidos, ou até o limite de 30 camadas.
//
//  Equações conforme memorial de cálculo (Eq. 1 a 64).
// ============================================================

function calcularPoste(dados) {

  // ----------------------------------------------------------
  // LEITURA DOS DADOS DE ENTRADA
  // ----------------------------------------------------------
  const Ef  = dados.Ef;
  const Em  = dados.Em;
  const Gm  = dados.Gm;
  const nuf = dados.nuf;
  const num = dados.num;
  const df  = dados.df;
  const dm  = dados.dm;

  const sig_f   = dados.sig_f;
  const sig_c   = dados.sig_c;

  const altura      = dados.altura;
  const L_emp       = dados.L_emp;
  const D_cima_cm   = dados.D_cima;
  const conicidade  = dados.conicidade;
  const F_nom       = dados.F_nom;
  const F_comp      = dados.F_comp;
  const CS_min      = dados.CS_min;
  const flecha_max_pct = dados.flecha_max;

  const angulo_graus   = dados.angulo;
  const n_fios         = dados.n_fios;
  const largura_pente  = dados.largura_pente;
  const tex            = dados.tex;

  // ----------------------------------------------------------
  // CONVERSÕES
  // ----------------------------------------------------------
  const angulo_rad = angulo_graus * Math.PI / 180;
  const L_livre    = altura - L_emp;
  const flecha_limite_mm = (flecha_max_pct / 100) * L_livre * 1000;
  const F_N  = F_nom  * 10;   // daN → N
  const Fc_N = F_comp * 10;

  // ----------------------------------------------------------
  // PASSO 1 — FRAÇÕES VOLUMÉTRICAS (Eq. 10)
  // Proporção em massa: 70% fibra, 30% resina
  // ----------------------------------------------------------
  const vol_f = 0.7 / df;
  const vol_m = 0.3 / dm;
  const vol_T = vol_f + vol_m;
  const Vf = vol_f / vol_T;
  const Vm = vol_m / vol_T;

  // ----------------------------------------------------------
  // PASSO 2 — PROPRIEDADES DA LÂMINA (Eq. 1 a 6)
  // ----------------------------------------------------------
  const E1   = Vf * Ef + Vm * Em;                                               // Eq. 1
  const E2   = (Em / (1 - num*num)) *
               (1 + 0.85*Vf*Vf) /
               (Math.pow(1-Vf, 1.25) + (Em/Ef)*Vf/(1-num*num));                // Eq. 2
  const nu12 = Vf*nuf + Vm*num;                                                 // Eq. 3
  const nu21 = nu12 * E2 / E1;                                                  // Eq. 4
  const G12  = Gm * (1 + 0.6*Math.pow(Vf,0.5)) /
               (Math.pow(1-Vf,1.25) + Vf/(1-num*num));                         // Eq. 5
  const dens_laminado = Vf*df + Vm*dm;                                          // Eq. 6

  // ----------------------------------------------------------
  // PASSO 3 — MATRIZ Q NO EIXO LOCAL (Eq. 18 a 23)
  // ----------------------------------------------------------
  const dQ   = 1 - nu12*nu21;
  const Q11  = E1  / dQ;
  const Q12  = nu12*E2 / dQ;
  const Q22  = E2  / dQ;
  const Q66  = G12;

  // ----------------------------------------------------------
  // PASSO 4 — MATRIZES Qxy TRANSFORMADAS (Eq. 24 a 26)
  // Calculadas para +θ e −θ e somadas (Eq. 48)
  // ----------------------------------------------------------
  function qxy(th) {
    const c=Math.cos(th), s=Math.sin(th);
    const c2=c*c, s2=s*s;
    return {
      xx: Q11*c2*c2 + 2*(Q12+2*Q66)*s2*c2 + Q22*s2*s2,
      yy: Q11*s2*s2 + 2*(Q12+2*Q66)*s2*c2 + Q22*c2*c2,
      xy: (Q11+Q22-4*Q66)*s2*c2 + Q12*(s2*s2+c2*c2),
      zz: (Q11+Q22-2*Q12-2*Q66)*s2*c2 + Q66*(s2*s2+c2*c2),
    };
  }
  const Qp = qxy( angulo_rad);
  const Qn = qxy(-angulo_rad);

  // Matriz total (+θ) + (−θ) por camada (Eq. 48)
  const Qxx_cam = Qp.xx + Qn.xx;
  const Qyy_cam = Qp.yy + Qn.yy;
  const Qxy_cam = Qp.xy + Qn.xy;
  const Qzz_cam = Qp.zz + Qn.zz;

  // ----------------------------------------------------------
  // PASSO 5 — E1 efetivo do laminado (Eq. 49)
  // E1 = (Qxx - Qxy²/Qyy) / t_total
  // Como t_total cancela na divisão por segmento, usamos por camada:
  // ----------------------------------------------------------
  const E1_lam = (Qxx_cam - (Qxy_cam*Qxy_cam)/Qyy_cam);   // N/mm² × mm (por camada)
  // Será dividido pelo t_total ao calcular cada segmento

  // ----------------------------------------------------------
  // PASSO 6 — ESPESSURA POR CAMADA em cada segmento
  // Depende do diâmetro local e do equipamento de bobinamento
  // ----------------------------------------------------------
  function espessuraPorCamada(Di_mm) {
    // Comprimento de hélice por mm linear do mandril: 1/sin(θ)
    // Gramatura (g/m²) = n_fios × TEX [g/km] / (sin(θ) × largura_pente [m])
    // Espessura (mm) = gramatura / (densidade [g/cm³] × 1000 [cm²/m² → mm])
    const gram = (n_fios * tex / 1000) / (Math.sin(angulo_rad) * largura_pente / 1000); // g/m²
    return gram / (dens_laminado * 1000); // mm
  }

  // ----------------------------------------------------------
  // PASSO 7 — SEGMENTOS do poste (a cada 0,5 m)
  // ----------------------------------------------------------
  const segmentos = [];
  for (let p = 0.5; p <= altura + 0.001; p += 0.5) {
    segmentos.push(parseFloat(p.toFixed(2)));
  }

  // ----------------------------------------------------------
  // PASSO 8 — FUNÇÃO QUE CALCULA UM SEGMENTO COM n CAMADAS
  // Retorna todos os resultados para aquele segmento.
  // ----------------------------------------------------------
  function calcSegmento(seg, n_cam) {
    const dist_do_topo = altura - seg;          // m, desde o topo
    const Di_cm = D_cima_cm + conicidade * dist_do_topo;
    const Di_mm = Di_cm * 10;

    const e_cam   = espessuraPorCamada(Di_mm);  // mm por camada
    const e_total = n_cam * e_cam;              // mm total (Eq. 8)
    const De_mm   = Di_mm + 2 * e_total;
    const De_cm   = De_mm / 10;
    const Di_cm_c = Di_mm / 10;

    // Momento de inércia (cm⁴)
    const I_cm4 = (Math.PI/64) * (Math.pow(De_cm,4) - Math.pow(Di_cm_c,4));
    const I_mm4 = I_cm4 * 1e4;

    // Área da seção (mm²)
    const A_mm2 = (Math.PI/4) * (De_mm*De_mm - Di_mm*Di_mm);

    // E1 do laminado neste segmento (Eq. 49): divide pelo t_total
    const E1_seg = e_total > 0 ? E1_lam / e_total : E1;

    // Distância do engaste até este segmento (comprimento livre acima do solo)
    const L_ao_seg_m = L_livre - Math.max(0, seg - L_emp);
    if (L_ao_seg_m <= 0) {
      // Segmento no empotramiento
      return { seg, Di_mm, De_mm, e_cam, e_total, n_cam, I_cm4, A_mm2, E1_seg,
               empotrado: true, w_mm: 0, S_eff_MPa: 0, sigma_cr: 0,
               sigma_comp: 0, CS_flexao: null, CS_comp: null };
    }

    const L_mm = L_ao_seg_m * 1000; // mm

    // Deflexão do segmento — Eq. 52/53
    // w(x) = P·x²/(6EI) · (3L - x), onde x = comprimento do segmento = L_mm
    const w_mm = I_mm4 > 0
      ? (F_N * L_mm*L_mm * (3*L_livre*1000 - L_mm)) / (6 * E1_seg * I_mm4)
      : 0;

    // Momento fletor máximo — Eq. 54: M = P × L
    const M_Nmm  = F_N * L_mm;           // N·mm
    const M_daNcm = M_Nmm / 100;         // daN·cm

    // Raio médio e espessura para Brazier
    const R_med_mm = Di_mm/2 + e_total/2;

    // Curvatura local — Eq. 57: k = M / (E·I)
    const k = I_mm4 > 0 ? M_Nmm / (E1_seg * I_mm4) : 0;  // 1/mm

    // Ovalização — Eq. 58: δ = M / (E·t·R)
    const delta = (E1_seg * e_total * R_med_mm) > 0
      ? M_Nmm / (E1_seg * e_total * R_med_mm)
      : 0;  // mm

    // I e W efetivos com ovalização — Eq. 59/60
    const De_eff = Math.max(De_mm - delta, Di_mm + 0.1);
    const Di_eff = Math.max(Di_mm - delta, 1);
    const De_eff_cm = De_eff/10, Di_eff_cm = Di_eff/10;
    const I_eff_cm4 = (Math.PI/64)*(Math.pow(De_eff_cm,4)-Math.pow(Di_eff_cm,4));
    const I_eff_mm4 = I_eff_cm4 * 1e4;
    const W_eff_cm3 = De_eff_cm > 0
      ? (Math.PI/32)*(Math.pow(De_eff_cm,4)-Math.pow(Di_eff_cm,4))/De_eff_cm
      : 1;

    // Momento efetivo — Eq. 59b
    const M_eff_daNcm = M_daNcm + E1_seg * (I_eff_mm4/1e4) * k * 10; // fator de unidades

    // Tensão efetiva por flexão — Eq. 61
    const S_eff_kgf = W_eff_cm3 > 0 ? M_eff_daNcm / W_eff_cm3 : 0;
    const S_eff_MPa = S_eff_kgf * 0.0981;  // kgf/cm² → MPa

    // Flambagem de Euler — Eq. 62/63
    // K=2 (viga engastada-livre)
    const r_mm    = A_mm2 > 0 ? Math.sqrt(I_eff_mm4 / A_mm2) : 1;
    const esbeltez = r_mm > 0 ? (2 * L_mm) / r_mm : 9999;
    const sigma_cr = esbeltez > 0
      ? (Math.PI*Math.PI * E1_seg) / (esbeltez*esbeltez)   // N/mm² = MPa
      : 9999;

    // Compressão axial — Eq. 64
    const sigma_comp = A_mm2 > 0 ? Fc_N / A_mm2 : 0;  // MPa

    // Tensão crítica considerada = mínimo entre sig_f e sigma_cr (conforme memorial)
    const sigma_crit = Math.min(sig_f, sigma_cr);

    // Coeficientes de segurança
    const CS_flexao = S_eff_MPa > 0 ? sigma_crit / S_eff_MPa : 9999;
    const CS_comp   = sigma_comp > 0 ? sig_c / sigma_comp     : 9999;

    return {
      seg, Di_mm, De_mm, e_cam, e_total, n_cam, I_cm4, I_eff_cm4,
      A_mm2, E1_seg, empotrado: false,
      w_mm, M_daNcm, delta, W_eff_cm3, M_eff_daNcm,
      S_eff_MPa, sigma_cr, sigma_comp,
      CS_flexao, CS_comp,
      aprovado: CS_flexao >= CS_min && CS_comp >= CS_min
    };
  }

  // ----------------------------------------------------------
  // PASSO 9 — BUSCA ITERATIVA DO NÚMERO MÍNIMO DE CAMADAS
  //
  // Estratégia:
  //  1. Pré-calcula todos os segmentos com 1 camada para ter
  //     uma primeira estimativa da flecha total.
  //  2. Para cada segmento, aumenta as camadas até que CS ≥ CS_min
  //     E a flecha total fique dentro do limite.
  //  3. Itera até convergir (a flecha depende de todos juntos).
  // ----------------------------------------------------------

  const MAX_CAM = 30;
  const MAX_ITER = 20;

  // Inicia com 1 camada por segmento
  let n_cams = segmentos.map(() => 1);

  for (let iter = 0; iter < MAX_ITER; iter++) {
    let mudou = false;

    // Calcula todos os segmentos com as camadas atuais
    const segs_calc = segmentos.map((seg, i) => calcSegmento(seg, n_cams[i]));

    // Flecha total atual
    const flecha_atual = segs_calc
      .filter(s => !s.empotrado)
      .reduce((acc, s) => acc + s.w_mm, 0);

    // Para cada segmento, verifica se precisa de mais camadas
    for (let i = 0; i < segmentos.length; i++) {
      const s = segs_calc[i];
      if (s.empotrado) continue;

      // Critério 1: CS à flexão e compressão
      let cs_ok = s.CS_flexao >= CS_min && s.CS_comp >= CS_min;

      // Critério 2: contribuição deste segmento para a flecha total
      // (simplificado: se flecha total excede limite, todos aumentam 1)
      let fl_ok = flecha_atual <= flecha_limite_mm * 1.05; // tolerância 5%

      if ((!cs_ok || !fl_ok) && n_cams[i] < MAX_CAM) {
        n_cams[i]++;
        mudou = true;
      }
    }

    // Se não mudou nada nesta iteração, convergiu
    if (!mudou) break;
  }

  // ----------------------------------------------------------
  // PASSO 10 — CÁLCULO FINAL com as camadas determinadas
  // ----------------------------------------------------------
  const resultados = segmentos.map((seg, i) => calcSegmento(seg, n_cams[i]));

  // Métricas globais
  const flecha_total = resultados
    .filter(s => !s.empotrado)
    .reduce((acc, s) => acc + s.w_mm, 0);

  const flecha_pct = (flecha_total / (L_livre * 1000)) * 100;

  const cs_vals = resultados
    .filter(s => !s.empotrado && s.CS_flexao !== null && s.CS_flexao < 900)
    .map(s => s.CS_flexao);
  const CS_minimo = cs_vals.length > 0 ? Math.min(...cs_vals) : 0;

  const todos_aprovados = resultados
    .filter(s => !s.empotrado)
    .every(s => s.aprovado);

  // Peso e consumo de materiais
  let peso_total = 0, fibra_total = 0, resina_total = 0;
  resultados.forEach(s => {
    const De_cm = s.De_mm / 10;
    const Di_cm = s.Di_mm / 10;
    const vol_cm3 = (Math.PI/4) * (De_cm*De_cm - Di_cm*Di_cm) * 50; // 0,5m = 50cm
    const peso_kg = vol_cm3 * dens_laminado / 1000;
    peso_total   += peso_kg;
    fibra_total  += peso_kg * Vf;
    resina_total += peso_kg * Vm;
  });

  return {
    // Propriedades do material
    Vf, Vm, E1, E2, nu12, nu21, G12, dens_laminado,
    E1_lam,   // por camada (antes de dividir por t)
    // Resultados globais
    flecha_total_mm: flecha_total,
    flecha_pct,
    flecha_ok: flecha_total <= flecha_limite_mm,
    flecha_limite_mm,
    CS_minimo,
    todos_aprovados,
    peso_total_kg: peso_total,
    fibra_total_kg: fibra_total,
    resina_total_kg: resina_total,
    // Por segmento
    segmentos: resultados,
    // Estrutura de fabricação
    estrutura: gerarEstrutura(resultados),
    // Parâmetros usados
    params: dados
  };
}

// ----------------------------------------------------------
// Descreve a estrutura de camadas resultante
// ----------------------------------------------------------
function gerarEstrutura(resultados) {
  const linhas = [];
  const segs_vis = resultados.filter(s => !s.empotrado);

  // Agrupa trechos com mesmo nº de camadas
  let grupo_ini  = segs_vis[0]?.seg;
  let grupo_cam  = segs_vis[0]?.n_cam;

  for (let i = 1; i < segs_vis.length; i++) {
    const s = segs_vis[i];
    if (s.n_cam !== grupo_cam) {
      linhas.push(`${grupo_cam} camada${grupo_cam > 1 ? 's' : ''} de ${grupo_ini.toFixed(1)} m até ${segs_vis[i-1].seg.toFixed(1)} m`);
      grupo_ini = s.seg;
      grupo_cam = s.n_cam;
    }
  }
  // Último grupo
  if (segs_vis.length > 0) {
    const ultimo = segs_vis[segs_vis.length - 1];
    linhas.push(`${grupo_cam} camada${grupo_cam > 1 ? 's' : ''} de ${grupo_ini.toFixed(1)} m até ${ultimo.seg.toFixed(1)} m`);
  }

  return linhas;
}
