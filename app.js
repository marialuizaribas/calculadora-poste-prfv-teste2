// ============================================================
//  app.js — Interface, login, gráficos e geração de PDF
// ============================================================

// ============================================================
//  LOGIN (simulado — substituir por Supabase na próxima fase)
// ============================================================
const USUARIOS_DEMO = [
  { email: "demo@prfv.com",  senha: "123456", nome: "Usuário Demo" },
  { email: "admin@prfv.com", senha: "admin",  nome: "Administrador" },
];

function fazerLogin() {
  const email = document.getElementById("login-email").value.trim();
  const senha = document.getElementById("login-senha").value;
  const erro  = document.getElementById("login-erro");

  if (!email || !senha) { mostrarErroLogin("Preencha e-mail e senha."); return; }

  const u = USUARIOS_DEMO.find(u => u.email === email && u.senha === senha);
  if (u) {
    erro.style.display = "none";
    document.getElementById("nome-usuario").textContent = u.nome;
    document.getElementById("tela-login").style.display = "none";
    document.getElementById("tela-app").style.display   = "block";
  } else {
    mostrarErroLogin("E-mail ou senha incorretos.\nUse demo@prfv.com / 123456");
  }
}

function criarConta() {
  alert("Criação de conta será habilitada com Supabase.\n\nPor enquanto:\nE-mail: demo@prfv.com\nSenha: 123456");
}

function sair() {
  document.getElementById("tela-app").style.display   = "none";
  document.getElementById("tela-login").style.display = "flex";
  document.getElementById("login-email").value = "";
  document.getElementById("login-senha").value = "";
}

function mostrarErroLogin(msg) {
  const el = document.getElementById("login-erro");
  el.textContent = msg;
  el.style.display = "block";
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("login-senha")
    .addEventListener("keydown", e => { if (e.key === "Enter") fazerLogin(); });
});

// ============================================================
//  LER OS DADOS DO FORMULÁRIO
// ============================================================
function lerDados() {
  return {
    Ef:  n("Ef",  81400), nuf: n("nuf", 0.2),  df:  n("df",  2.68),
    Em:  n("Em",  3275),  Gm:  n("Gm",  2300), num: n("num", 0.3),
    dm:  n("dm",  1.1),
    sig_t: n("sig_t", 300), sig_f: n("sig_f", 350), sig_c: n("sig_c", 230),
    altura:     n("altura",     10.5),
    L_emp:      n("L_emp",      1.75),
    D_cima:     n("D_cima",     17),
    conicidade: n("conicidade", 1.5),
    F_nom:      n("F_nom",      1200),
    F_comp:     n("F_comp",     1500),
    CS_min:     n("CS_min",     2.0),
    flecha_max: n("flecha_max", 10),
    angulo:         n("angulo",         15),
    n_fios:         n("n_fios",         50),
    largura_pente:  n("largura_pente",  150),
    tex:            n("tex",            2200),
  };
}
function n(id, def) { return parseFloat(document.getElementById(id)?.value) || def; }

// ============================================================
//  BOTÃO CALCULAR
// ============================================================
let graficos = {};

function calcular() {
  const dados = lerDados();

  // Indicador de progresso
  const btn = document.querySelector(".btn-calcular");
  btn.textContent = "⏳ Calculando…";
  btn.disabled = true;

  // Pequeno delay para o navegador redesenhar o botão antes de calcular
  setTimeout(() => {
    let res;
    try {
      res = calcularPoste(dados);
    } catch(e) {
      btn.textContent = "▶ Calcular dimensionamento";
      btn.disabled = false;
      alert("Erro no cálculo: " + e.message + "\n\nVerifique os valores inseridos.");
      console.error(e);
      return;
    }

    btn.textContent = "▶ Calcular dimensionamento";
    btn.disabled = false;

    document.getElementById("estado-inicial").style.display  = "none";
    document.getElementById("area-resultados").style.display = "block";

    preencherMetricas(res, dados);
    mostrarAvisoAprovacao(res, dados);
    desenharPerfilPoste(res);
    construirGraficos(res, dados);
    preencherTabela(res, dados);
    mostrarEstrutura(res);
    document.getElementById("painel-resultados").scrollTop = 0;
  }, 50);
}

// ============================================================
//  MÉTRICAS
// ============================================================
function preencherMetricas(res, dados) {
  // Flecha
  const mf = document.getElementById("m-flecha");
  mf.querySelector(".metrica-valor").textContent = arred(res.flecha_total_mm) + " mm";
  const pct = arred(res.flecha_pct, 1);
  mf.querySelector(".metrica-status").textContent = pct + "% " + (res.flecha_ok ? "✓ ok" : "✗ excede limite");
  mf.querySelector(".metrica-status").className   = "metrica-status " + (res.flecha_ok ? "status-ok" : "status-erro");

  // CS mínimo
  const mc = document.getElementById("m-cs");
  const cs_ok = res.CS_minimo >= dados.CS_min;
  mc.querySelector(".metrica-valor").textContent = arred(res.CS_minimo, 2);
  mc.querySelector(".metrica-status").textContent = (cs_ok ? "✓ ≥ " : "✗ < ") + dados.CS_min;
  mc.querySelector(".metrica-status").className   = "metrica-status " + (cs_ok ? "status-ok" : "status-erro");

  // Camadas máximas (nova métrica útil)
  const mp = document.getElementById("m-peso");
  const max_cam = Math.max(...res.segmentos.map(s => s.n_cam));
  const min_cam = Math.min(...res.segmentos.filter(s => !s.empotrado).map(s => s.n_cam));
  mp.querySelector(".metrica-valor").textContent = min_cam + "–" + max_cam;
  mp.querySelector(".metrica-rotulo").textContent = "Camadas (mín–máx)";
  mp.querySelector(".metrica-status").textContent = "por segmento";
  mp.querySelector(".metrica-status").className   = "metrica-status status-ok";

  // Peso estimado
  const mfi = document.getElementById("m-fibra");
  mfi.querySelector(".metrica-rotulo").textContent = "Peso estimado";
  mfi.querySelector(".metrica-valor").textContent  = arred(res.peso_total_kg) + " kg";
  mfi.querySelector(".metrica-status").textContent = "fibra: " + arred(res.fibra_total_kg) + " kg";
  mfi.querySelector(".metrica-status").className   = "metrica-status status-ok";
}

// ============================================================
//  AVISO APROVAÇÃO
// ============================================================
function mostrarAvisoAprovacao(res, dados) {
  const el = document.getElementById("aviso-aprovacao");
  const ok = res.todos_aprovados && res.flecha_ok;
  if (ok) {
    el.textContent = "✓ Poste APROVADO — todos os segmentos atendem CS ≥ " + dados.CS_min + " e deflexão dentro do limite.";
    el.className = "aviso aviso-aprovado";
  } else {
    const p = [];
    if (!res.todos_aprovados) p.push("algum segmento não atingiu CS ≥ " + dados.CS_min + " com o limite de 30 camadas");
    if (!res.flecha_ok) p.push("deflexão excede o limite de " + arred(res.flecha_limite_mm) + " mm");
    el.textContent = "✗ Atenção: " + p.join("; ") + ". Revise a geometria ou as resistências características.";
    el.className = "aviso aviso-reprovado";
  }
}

// ============================================================
//  PERFIL SVG DO POSTE
// ============================================================
function desenharPerfilPoste(res) {
  const svg = document.getElementById("svg-poste");
  svg.innerHTML = "";
  const segs = res.segmentos.filter(s => s.De_mm > 0);
  if (!segs.length) return;

  const W = 700, H = 320, mH = 60, mV = 30;
  const aH = W - mH*2, aV = H - mV*2;
  const cx = W/2;
  const altura = res.params.altura;
  const De_max = Math.max(...segs.map(s => s.De_mm));
  const escH = (aH/2) / (De_max/2);
  const escV = aV / (altura * 1000);

  const toY  = h  => mV + aV - h*escV;
  const toXr = d  => cx + (d/2)*escH;
  const toXl = d  => cx - (d/2)*escH;

  const ext_r=[], ext_l=[], int_r=[], int_l=[];
  segs.forEach(s => {
    const h = s.seg*1000;
    ext_r.push([toXr(s.De_mm), toY(h)]);
    ext_l.push([toXl(s.De_mm), toY(h)]);
    int_r.push([toXr(s.Di_mm), toY(h)]);
    int_l.push([toXl(s.Di_mm), toY(h)]);
  });

  const poly = (pts, fill, stroke, sw) => {
    const el = document.createElementNS("http://www.w3.org/2000/svg","polygon");
    el.setAttribute("points", pts.map(p=>p.join(",")).join(" "));
    el.setAttribute("fill", fill);
    el.setAttribute("stroke", stroke);
    el.setAttribute("stroke-width", sw);
    svg.appendChild(el);
  };

  poly([...ext_r, ...[...ext_l].reverse()], "#dbeafe", "#2563eb", "1.5");
  poly([...int_r, ...[...int_l].reverse()], "white",   "#93c5fd", "1");

  // Linha do solo
  const y_solo = toY(res.params.L_emp*1000);
  const ln = document.createElementNS("http://www.w3.org/2000/svg","line");
  ln.setAttribute("x1", mH-20); ln.setAttribute("x2", W-mH+20);
  ln.setAttribute("y1", y_solo); ln.setAttribute("y2", y_solo);
  ln.setAttribute("stroke","#92400e"); ln.setAttribute("stroke-width","2");
  ln.setAttribute("stroke-dasharray","6,4");
  svg.appendChild(ln);

  const txt = (x,y,t,anc,col) => {
    const el = document.createElementNS("http://www.w3.org/2000/svg","text");
    el.setAttribute("x",x); el.setAttribute("y",y);
    el.setAttribute("font-size","10"); el.setAttribute("fill",col||"#6b7280");
    el.setAttribute("text-anchor",anc||"end");
    el.setAttribute("font-family","Segoe UI,sans-serif");
    el.textContent = t; svg.appendChild(el);
  };

  txt(mH-10, y_solo-5, "Nível do solo", "end", "#92400e");

  // Escala vertical
  for (let h=0; h<=altura; h++) {
    const y = toY(h*1000);
    const t = document.createElementNS("http://www.w3.org/2000/svg","line");
    t.setAttribute("x1",mH-8); t.setAttribute("x2",mH);
    t.setAttribute("y1",y); t.setAttribute("y2",y);
    t.setAttribute("stroke","#9ca3af"); t.setAttribute("stroke-width","1");
    svg.appendChild(t);
    txt(mH-10, y+4, h+"m", "end");
  }

  // Cotas Ø
  const cota = (s, label) => {
    const y = toY(s.seg*1000);
    txt(toXr(s.De_mm)+6, y+4, label, "start", "#1e40af");
  };
  const s_topo = segs[segs.length-1];
  const s_base = segs[0];
  if (s_topo) cota(s_topo, "Ø "+arred(s_topo.De_mm)+" mm");
  if (s_base) cota(s_base, "Ø "+arred(s_base.De_mm)+" mm");
}

// ============================================================
//  GRÁFICOS
// ============================================================
function carregarChartJS(cb) {
  if (window.Chart) { cb(); return; }
  const s = document.createElement("script");
  s.src = "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js";
  s.onload = cb; document.head.appendChild(s);
}

function construirGraficos(res, dados) {
  carregarChartJS(() => {
    Object.values(graficos).forEach(g => g && g.destroy());
    graficos = {};

    const sv = res.segmentos.filter(s => !s.empotrado);
    const lb = sv.map(s => s.seg.toFixed(1));

    const az = "#2563eb", vd = "#16a34a", am = "#ca8a04", rx = "#7c3aed", vm = "#dc2626";

    // CS flexão
    graficos.cs = new Chart(document.getElementById("grafico-cs"), {
      type: "line",
      data: { labels: lb, datasets: [
        { label: "CS flexão",
          data: sv.map(s => s.CS_flexao < 900 ? arred(s.CS_flexao,2) : null),
          borderColor: vd, backgroundColor: "rgba(22,163,74,0.08)",
          borderWidth: 2, pointRadius: 4, fill: true, tension: 0.3, spanGaps: true },
        { label: "Mínimo ("+dados.CS_min+")",
          data: sv.map(() => dados.CS_min),
          borderColor: vm, borderDash: [6,4], borderWidth: 1.5, pointRadius: 0 }
      ]},
      options: optsGraf("CS",0,6)
    });

    // Camadas por segmento
    graficos.cam = new Chart(document.getElementById("grafico-tensao"), {
      type: "bar",
      data: { labels: lb, datasets: [{
        label: "Nº de camadas",
        data: sv.map(s => s.n_cam),
        backgroundColor: az+"99", borderColor: az, borderWidth: 1, borderRadius: 2
      }]},
      options: optsGraf("camadas", 0)
    });
    // Atualiza o título do gráfico
    document.querySelector("#grafico-tensao").closest(".cartao-grafico")
      .querySelector(".grafico-titulo").textContent = "Número de camadas calculado por segmento";

    // Flecha acumulada
    let acc = 0;
    const fl = sv.map(s => { acc += s.w_mm; return arred(acc); });
    graficos.fl = new Chart(document.getElementById("grafico-flecha"), {
      type: "line",
      data: { labels: lb, datasets: [
        { label: "Flecha acum. (mm)", data: fl,
          borderColor: rx, backgroundColor: "rgba(124,58,237,0.07)",
          borderWidth: 2, pointRadius: 3, fill: true, tension: 0.3 },
        { label: "Limite ("+arred(res.flecha_limite_mm)+" mm)",
          data: sv.map(() => arred(res.flecha_limite_mm)),
          borderColor: vm, borderDash: [6,4], borderWidth: 1.5, pointRadius: 0 }
      ]},
      options: optsGraf("mm", 0)
    });

    // Espessura total por segmento
    graficos.esp = new Chart(document.getElementById("grafico-diam"), {
      type: "bar",
      data: { labels: lb, datasets: [{
        label: "Espessura (mm)",
        data: sv.map(s => arred(s.e_total,2)),
        backgroundColor: am+"99", borderColor: am, borderWidth: 1, borderRadius: 2
      }]},
      options: optsGraf("mm", 0)
    });
    document.querySelector("#grafico-diam").closest(".cartao-grafico")
      .querySelector(".grafico-titulo").textContent = "Espessura total do laminado por segmento (mm)";
  });
}

function optsGraf(unidade, yMin, yMax) {
  const o = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { font:{size:10}, color:"#9ca3af", maxRotation:0 }, grid:{display:false} },
      y: { ticks: { font:{size:10}, color:"#9ca3af" },
           title: { display:true, text:unidade, font:{size:10}, color:"#9ca3af" } }
    }
  };
  if (yMin !== undefined) o.scales.y.min = yMin;
  if (yMax !== undefined) o.scales.y.max = yMax;
  return o;
}

// ============================================================
//  TABELA DETALHADA
// ============================================================
function preencherTabela(res, dados) {
  const tbody = document.getElementById("tbody-resultados");
  tbody.innerHTML = "";

  res.segmentos.forEach(s => {
    const tr = document.createElement("tr");
    if (s.empotrado) {
      tr.innerHTML = `
        <td>${s.seg.toFixed(1)}</td>
        <td>${arred(s.De_mm,1)}</td>
        <td>${arred(s.e_total,2)}</td>
        <td style="text-align:center">${s.n_cam}</td>
        <td class="cel-cinza" colspan="4">Região de empotramiento (enterrada)</td>
        <td class="cel-cinza">—</td>`;
    } else {
      const csf = s.CS_flexao < 900 ? arred(s.CS_flexao,2) : "—";
      const csc = s.CS_comp   < 900 ? arred(s.CS_comp,1)   : "—";
      const cf_class = s.CS_flexao >= dados.CS_min*1.2 ? "cel-ok"
                     : s.CS_flexao >= dados.CS_min      ? "cel-aviso"
                     : "cel-erro";
      tr.innerHTML = `
        <td>${s.seg.toFixed(1)}</td>
        <td>${arred(s.De_mm,1)}</td>
        <td>${arred(s.e_total,2)}</td>
        <td style="text-align:center"><strong>${s.n_cam}</strong></td>
        <td class="${cf_class}">${csf}</td>
        <td class="cel-ok">${csc}</td>
        <td>${arred(s.S_eff_MPa,1)}</td>
        <td>${s.sigma_cr < 9000 ? arred(s.sigma_cr,1) : "—"}</td>
        <td class="${s.aprovado ? 'cel-ok' : 'cel-erro'}">${s.aprovado ? "✓ Sim" : "✗ Não"}</td>`;
    }
    tbody.appendChild(tr);
  });
}

// ============================================================
//  ESTRUTURA DE FABRICAÇÃO
// ============================================================
function mostrarEstrutura(res) {
  const el = document.getElementById("estrutura-texto");
  const sv = res.segmentos.filter(s => !s.empotrado);
  const max_cam = Math.max(...sv.map(s => s.n_cam));
  const min_cam = Math.min(...sv.map(s => s.n_cam));

  el.innerHTML = `
<strong>Distribuição de camadas calculada:</strong><br><br>
${res.estrutura.map(l => "• " + l).join("<br>")}
<br><br>
<strong>Resumo do laminado:</strong><br>
• Camadas mínimas (topo): ${min_cam}<br>
• Camadas máximas (base): ${max_cam}<br>
• Ângulo de bobinamento: ±${res.params.angulo}°<br>
• Espessura por camada (base): ${arred(sv[0]?.e_cam,2)} mm<br>
• Fração volumétrica de fibra (Vf): ${(res.Vf*100).toFixed(1)}%<br>
• E₁ longitudinal da lâmina: ${arred(res.E1)} N/mm²<br>
• Consumo estimado de fibra: ${arred(res.fibra_total_kg)} kg<br>
• Consumo estimado de resina: ${arred(res.resina_total_kg)} kg<br>
• Peso total estimado: ${arred(res.peso_total_kg)} kg`;
}

// ============================================================
//  GERAÇÃO DE PDF
// ============================================================
function gerarPDF() {
  if (!window.jspdf) {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    s.onload = gerarPDFInterno;
    document.head.appendChild(s);
  } else {
    gerarPDFInterno();
  }
}

function gerarPDFInterno() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation:"portrait", unit:"mm", format:"a4" });
  const dados = lerDados();
  const res   = calcularPoste(dados);

  const mg = 20; let y = 20;
  const tit = (t) => {
    doc.setFontSize(12); doc.setFont("helvetica","bold");
    doc.text(t, mg, y); y+=7;
  };
  const campo = (r, v) => {
    doc.setFontSize(10); doc.setFont("helvetica","normal");
    doc.text(r+": "+v, mg, y); y+=5.5;
  };

  // Cabeçalho
  doc.setFillColor(37,99,235);
  doc.rect(0,0,210,18,"F");
  doc.setTextColor(255,255,255);
  doc.setFontSize(14); doc.setFont("helvetica","bold");
  doc.text("Memorial de Cálculo — Postes PRFV", mg, 12);
  doc.setTextColor(0,0,0); y=28;

  tit("1. Identificação");
  campo("Modelo",          dados.F_nom+" daN / "+dados.altura+" m");
  campo("CS mínimo",       dados.CS_min);
  campo("Deflexão máxima", dados.flecha_max+"% da altura livre");
  y+=4;

  tit("2. Dados do Poste");
  campo("Altura total",       dados.altura+" m");
  campo("Empotramento",       dados.L_emp+" m");
  campo("Ø interno topo",     dados.D_cima+" cm");
  campo("Conicidade",         dados.conicidade+" cm/m");
  campo("Carga de flexão",    dados.F_nom+" daN");
  campo("Carga de compressão",dados.F_comp+" daN");
  y+=4;

  tit("3. Equipamento de Bobinamento");
  campo("Ângulo",        "±"+dados.angulo+"°");
  campo("Nº de fios",    dados.n_fios);
  campo("Largura pente", dados.largura_pente+" mm");
  campo("TEX da fibra",  dados.tex+" g/km");
  y+=4;

  tit("4. Propriedades do Material");
  campo("E fibra",   dados.Ef+" N/mm²");
  campo("E resina",  dados.Em+" N/mm²");
  campo("Vf calculado", (res.Vf*100).toFixed(1)+"%");
  campo("E1 lâmina", arred(res.E1)+" N/mm²");
  y+=4;

  tit("5. Resultados Globais");
  campo("Flecha total",      arred(res.flecha_total_mm)+" mm ("+arred(res.flecha_pct,1)+"%)");
  campo("Limite de flecha",  arred(res.flecha_limite_mm)+" mm");
  campo("CS mínimo flexão",  arred(res.CS_minimo,2));
  campo("Peso estimado",     arred(res.peso_total_kg)+" kg");
  campo("Fibra consumida",   arred(res.fibra_total_kg)+" kg");
  campo("Resina consumida",  arred(res.resina_total_kg)+" kg");
  campo("Aprovado",          (res.todos_aprovados && res.flecha_ok) ? "SIM" : "NÃO");
  y+=4;

  // Tabela por segmento
  doc.addPage(); y=20;
  tit("6. Camadas Calculadas por Segmento");
  y+=2;

  const cols = [18,22,22,18,22,22,22,24];
  const hdrs = ["Seg(m)","Øext(mm)","Esp(mm)","Cam.","CS flex","CS comp","σeff(MPa)","σflamb(MPa)"];

  doc.setFillColor(243,244,246);
  doc.rect(mg,y,170,7,"F");
  doc.setFontSize(8); doc.setFont("helvetica","bold");
  let x=mg;
  hdrs.forEach((h,i) => { doc.text(h, x+1, y+5); x+=cols[i]; });
  y+=8;

  res.segmentos.forEach(s => {
    if (y>270) { doc.addPage(); y=20; }
    doc.setFont("helvetica","normal");
    const vals = [
      s.seg.toFixed(1),
      arred(s.De_mm,1).toString(),
      arred(s.e_total,2).toString(),
      s.n_cam.toString(),
      (s.CS_flexao && s.CS_flexao<900) ? arred(s.CS_flexao,2).toString() : "—",
      (s.CS_comp   && s.CS_comp  <900) ? arred(s.CS_comp,1).toString()   : "—",
      arred(s.S_eff_MPa,1).toString(),
      (s.sigma_cr && s.sigma_cr<9000)  ? arred(s.sigma_cr,1).toString()  : "—",
    ];
    x=mg;
    vals.forEach((v,i) => {
      if (i===4 && s.CS_flexao < dados.CS_min) doc.setTextColor(220,38,38);
      else doc.setTextColor(0);
      doc.text(v, x+1, y+4); x+=cols[i];
    });
    doc.setDrawColor(229,231,235);
    doc.line(mg, y+6, mg+170, y+6);
    y+=7;
  });

  doc.setTextColor(0);
  const np = doc.getNumberOfPages();
  for (let i=1; i<=np; i++) {
    doc.setPage(i);
    doc.setFontSize(8); doc.setTextColor(150);
    doc.text("Postes PRFV — Memorial de Cálculo — Pág. "+i+"/"+np, mg, 290);
  }

  const dt = new Date().toLocaleDateString("pt-BR").replace(/\//g,"-");
  doc.save("memorial_poste_"+dados.F_nom+"daN_"+dados.altura+"m_"+dt+".pdf");
}

// ============================================================
//  UTILITÁRIOS
// ============================================================
function arred(v, casas=0) {
  if (v===null||v===undefined||isNaN(v)) return "—";
  return parseFloat(v.toFixed(casas));
}
