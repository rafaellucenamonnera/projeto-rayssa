import logoMonnera from "@/assets/logo-monnera.jpg";

const landingStyles = `
    :root {
      --green-dark: #003729;
      --green-deep: #06251d;
      --green-light: #6BB0A1;
      --green-mist: #eaf5f1;
      --paper: #f4faf7;
      --paper-soft: #fbfdfb;
      --ink: #0a221b;
      --muted: #52645f;
      --line: rgba(0, 55, 41, .14);
      --accent-warm: #d89528;
      --shadow: 0 18px 44px rgba(0, 55, 41, .10);
    }

    .landing-shell, .landing-shell * { box-sizing: border-box; }

    html { scroll-behavior: smooth; }

    .landing-shell {
      margin: 0;
      font-family: "Mark Pro", Montserrat, Inter, Aptos, Arial, sans-serif;
      color: var(--ink);
      background: var(--paper-soft);
    }

    .landing-shell a { color: inherit; text-decoration: none; }

    .page {
      min-height: 100vh;
      overflow: hidden;
      background:
        linear-gradient(135deg, rgba(107, 176, 161, .16), transparent 32rem),
        linear-gradient(180deg, #fbfdfb 0%, #f4faf7 48%, #eaf5f1 100%);
    }

    .wrap {
      width: min(1180px, calc(100% - 40px));
      margin: 0 auto;
    }

    .nav {
      position: sticky;
      top: 0;
      z-index: 20;
      backdrop-filter: blur(18px);
      background: rgba(251, 253, 251, .92);
      border-bottom: 1px solid rgba(0, 55, 41, .10);
    }

    .nav-inner {
      min-height: 86px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 24px;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 16px;
      font-weight: 900;
      color: var(--green-dark);
      min-width: 0;
    }

    .brand-logo {
      width: 58px;
      height: 58px;
      border-radius: 10px;
      object-fit: contain;
      background: var(--green-dark);
      box-shadow: 0 8px 22px rgba(0, 55, 41, .10);
      flex: 0 0 auto;
    }

    .brand-text {
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 4px;
      min-width: 0;
    }

    .brand-text small {
      display: block;
      color: var(--green-light);
      font-size: 12px;
      letter-spacing: .34em;
      text-transform: uppercase;
      line-height: 1;
    }

    .brand-text strong {
      display: block;
      font-size: 24px;
      line-height: 1;
      color: var(--green-dark);
    }

    .nav-links {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .btn {
      min-height: 54px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      border-radius: 8px;
      padding: 14px 22px;
      border: 1px solid var(--line);
      background: rgba(255, 255, 255, .86);
      color: var(--green-dark);
      font-size: 15px;
      font-weight: 800;
      cursor: pointer;
      transition: transform .2s ease, box-shadow .2s ease, background .2s ease;
    }

    .btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 10px 24px rgba(0, 55, 41, .10);
    }

    .btn svg {
      width: 20px;
      height: 20px;
      flex: 0 0 auto;
    }

    .btn.primary {
      border-color: var(--green-dark);
      background: var(--green-dark);
      color: white;
      box-shadow: 0 14px 30px rgba(0, 55, 41, .16);
    }

    .btn.dark {
      border-color: rgba(0, 55, 41, .20);
      background: var(--green-mist);
      color: var(--green-dark);
    }

    .hero {
      position: relative;
      padding: 64px 0 72px;
    }

    .hero::before {
      content: "";
      position: absolute;
      inset: 0 0 auto auto;
      width: 46vw;
      height: 620px;
      background:
        linear-gradient(135deg, transparent 0 43%, rgba(0, 55, 41, .045) 43% 44%, transparent 44% 100%),
        linear-gradient(45deg, transparent 0 54%, rgba(107, 176, 161, .10) 54% 55%, transparent 55% 100%);
      opacity: .72;
      pointer-events: none;
    }

    .hero-grid {
      position: relative;
      display: grid;
      grid-template-columns: 1.08fr .92fr;
      gap: 48px;
      align-items: center;
    }

    .eyebrow {
      margin: 0 0 18px;
      color: var(--green-dark);
      font-size: 12px;
      font-weight: 900;
      letter-spacing: .22em;
      text-transform: uppercase;
    }

    .hero h1 {
      margin: 0;
      max-width: 720px;
      color: var(--green-dark);
      font-size: clamp(42px, 5.4vw, 70px);
      line-height: 1.04;
      letter-spacing: 0;
    }

    .hero h1 span {
      color: var(--green-light);
    }

    .lead {
      max-width: 650px;
      margin: 28px 0 0;
      color: var(--muted);
      font-size: 19px;
      line-height: 1.62;
    }

    .hero-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 14px;
      margin-top: 34px;
    }

    .note {
      margin-top: 24px;
      max-width: 650px;
      display: flex;
      gap: 12px;
      align-items: flex-start;
      padding: 18px;
      border: 1px solid var(--line);
      border-radius: 10px;
      background: rgba(255, 255, 255, .82);
      color: #405550;
      line-height: 1.55;
      box-shadow: 0 10px 28px rgba(0, 55, 41, .06);
    }

    .note strong {
      color: var(--green-dark);
    }

    .hero-card {
      position: relative;
      max-width: 570px;
      margin-left: auto;
      padding: 14px;
      border-radius: 18px;
      background: rgba(255, 255, 255, .72);
      border: 1px solid rgba(0, 55, 41, .12);
      box-shadow: var(--shadow);
    }

    .ambassador-card {
      min-height: 560px;
      padding: 48px 48px 38px;
      border-radius: 25px;
      background: var(--green-dark);
      color: white;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .08);
    }

    .ambassador-card h2 {
      margin: 0 0 38px;
      font-size: clamp(38px, 4.5vw, 56px);
      line-height: 1.05;
      text-align: center;
      letter-spacing: 0;
    }

    .ambassador-card ul {
      margin: 0;
      padding-left: 26px;
      display: grid;
      gap: 17px;
      font-size: clamp(20px, 2.3vw, 30px);
      line-height: 1.14;
    }

    .ambassador-card li::marker {
      color: white;
      font-size: .75em;
    }

    .card-cta {
      align-self: center;
      margin-top: 44px;
      width: min(100%, 360px);
      background: var(--green-light);
      color: var(--green-dark);
      border-color: var(--green-light);
      font-size: 20px;
    }

    .audience-stack {
      display: grid;
      gap: 16px;
    }

    .audience-card {
      padding: 28px;
      border-radius: 12px;
      border: 1px solid rgba(0, 55, 41, .12);
      background: white;
      color: var(--ink);
      box-shadow: 0 16px 40px rgba(0, 55, 41, .08);
    }

    .audience-card.dark {
      color: white;
      background: linear-gradient(180deg, #003729, #06251d);
      border-color: rgba(255, 255, 255, .12);
      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .06);
    }

    .audience-card small {
      display: block;
      margin-bottom: 10px;
      color: var(--green-light);
      font-weight: 850;
      letter-spacing: .14em;
      text-transform: uppercase;
    }

    .audience-card h2 {
      margin: 0;
      font-size: clamp(26px, 2.8vw, 36px);
      line-height: 1.08;
      letter-spacing: 0;
    }

    .audience-card p {
      margin: 14px 0 0;
      color: var(--muted);
      line-height: 1.6;
    }

    .audience-card.dark p {
      color: rgba(255, 255, 255, .76);
    }

    .audience-card ul {
      margin: 18px 0 0;
      padding-left: 20px;
      display: grid;
      gap: 9px;
      line-height: 1.45;
    }

    .audience-card .btn {
      width: 100%;
      margin-top: 22px;
    }

    .section {
      padding: 84px 0;
    }

    .authority-strip {
      width: 100%;
      padding: 28px 0 32px;
      overflow: hidden;
      background: #ffffff;
      border-top: 1px solid rgba(0, 55, 41, .08);
      border-bottom: 1px solid rgba(0, 55, 41, .08);
      box-shadow: 0 18px 60px rgba(0, 55, 41, .06);
    }

    .authority-kicker {
      margin: 0 auto 22px;
      color: var(--green-dark);
      font-size: 13px;
      font-weight: 950;
      letter-spacing: .22em;
      text-align: center;
      text-transform: uppercase;
    }

    .authority-track {
      width: max-content;
      display: flex;
      align-items: center;
      animation: authority-marquee 70s linear infinite;
      will-change: transform;
    }

    .authority-strip:hover .authority-track {
      animation-play-state: paused;
    }

    .authority-logo-list {
      display: flex;
      align-items: center;
      gap: 38px;
      flex: 0 0 auto;
      padding-right: 38px;
    }

    .authority-logo-card {
      width: 220px;
      height: 96px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex: 0 0 auto;
      border: 1px solid rgba(0, 55, 41, .1);
      border-radius: 10px;
      background: #fff;
      box-shadow: 0 10px 28px rgba(0, 55, 41, .07);
      padding: 5px 8px;
    }

    .authority-logo-card img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: contain;
      object-position: center;
    }

    .authority-logo-card.logo-wide {
      width: 260px;
    }

    .authority-logo-card.logo-compact {
      width: 190px;
    }

    @keyframes authority-marquee {
      from { transform: translate3d(0, 0, 0); }
      to { transform: translate3d(-50%, 0, 0); }
    }

    .section.light {
      background: #ffffff;
    }

    .section.mist {
      background: var(--green-mist);
    }

    .section.dark {
      color: white;
      background:
        linear-gradient(135deg, #06251d, #003729 72%, #0a4636);
    }

    .section-head {
      max-width: 800px;
      margin-bottom: 42px;
    }

    .section h2 {
      margin: 0;
      color: var(--green-dark);
      font-size: clamp(34px, 4vw, 58px);
      line-height: 1.04;
      letter-spacing: 0;
    }

    .dark h2,
    .dark .eyebrow {
      color: white;
    }

    .section-text {
      max-width: 760px;
      margin: 18px 0 0;
      color: var(--muted);
      font-size: 18px;
      line-height: 1.7;
    }

    .dark .section-text {
      color: rgba(255, 255, 255, .74);
    }

    .value-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 18px;
    }

    .value-card {
      min-height: 270px;
      padding: 28px;
      border-radius: 10px;
      border: 1px solid var(--line);
      background: white;
      box-shadow: 0 14px 40px rgba(0, 55, 41, .06);
    }

    .value-card.dark-card {
      background: var(--green-dark);
      color: white;
    }

    .icon {
      width: 46px;
      height: 46px;
      display: grid;
      place-items: center;
      margin-bottom: 28px;
      border-radius: 10px;
      color: var(--green-dark);
      background: var(--green-mist);
      font-weight: 900;
      font-size: 22px;
    }

    .dark-card .icon {
      color: white;
      background: rgba(255, 255, 255, .12);
    }

    .value-card h3 {
      margin: 0;
      font-size: 24px;
      line-height: 1.12;
      color: var(--green-dark);
    }

    .value-card.dark-card h3 {
      color: white;
    }

    .value-card p {
      margin: 14px 0 0;
      color: var(--muted);
      font-size: 16px;
      line-height: 1.65;
    }

    .value-card.dark-card p {
      color: rgba(255, 255, 255, .76);
    }

    .value-card.compact {
      min-height: 235px;
    }

    .legal-note {
      margin-top: 24px;
      padding: 18px 20px;
      border-radius: 10px;
      border: 1px solid rgba(255, 255, 255, .16);
      background: rgba(255, 255, 255, .08);
      color: rgba(255, 255, 255, .74);
      line-height: 1.6;
    }

    .flow {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 14px;
      counter-reset: flow;
    }

    .flow-step {
      position: relative;
      min-height: 230px;
      padding: 26px;
      border-radius: 10px;
      background: rgba(255, 255, 255, .1);
      border: 1px solid rgba(255, 255, 255, .16);
      overflow: hidden;
    }

    .flow-step::before {
      counter-increment: flow;
      content: "0" counter(flow);
      display: block;
      margin-bottom: 42px;
      color: var(--green-light);
      font-size: 18px;
      font-weight: 900;
      letter-spacing: .14em;
    }

    .flow-step h3 {
      margin: 0;
      font-size: 24px;
      line-height: 1.1;
    }

    .flow-step p {
      margin: 12px 0 0;
      color: rgba(255, 255, 255, .72);
      line-height: 1.55;
    }

    .trust-grid {
      display: grid;
      grid-template-columns: .85fr 1.15fr;
      gap: 44px;
      align-items: center;
    }

    .trust-list {
      display: grid;
      gap: 14px;
    }

    .trust-item {
      display: grid;
      grid-template-columns: 54px 1fr;
      gap: 16px;
      align-items: start;
      padding: 22px;
      border-radius: 10px;
      background: white;
      border: 1px solid var(--line);
      box-shadow: 0 12px 36px rgba(0, 55, 41, .05);
    }

    .trust-item h3 {
      margin: 0;
      color: var(--green-dark);
      font-size: 22px;
    }

    .trust-item p {
      margin: 8px 0 0;
      color: var(--muted);
      line-height: 1.6;
    }

    .final {
      padding: 92px 0;
      text-align: center;
      color: white;
      background:
        radial-gradient(circle at 50% 0%, rgba(107, 176, 161, .20), transparent 28rem),
        var(--green-dark);
    }

    .final h2 {
      max-width: 860px;
      margin: 0 auto;
      font-size: clamp(38px, 5vw, 66px);
      line-height: 1.02;
      letter-spacing: 0;
    }

    .final p {
      max-width: 720px;
      margin: 24px auto 0;
      color: rgba(255, 255, 255, .78);
      font-size: 19px;
      line-height: 1.7;
    }

    .final .btn {
      margin-top: 36px;
    }

    .footer-actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 16px;
      margin-top: 36px;
    }

    .footer-actions .btn {
      margin-top: 0;
      min-width: 300px;
    }

    .footer-actions .btn.primary {
      border-color: var(--green-light);
      background: var(--green-light);
      color: #07110f;
      box-shadow: 0 14px 30px rgba(107, 176, 161, .18);
    }

    .footer-actions .btn.outline {
      border-color: rgba(255, 255, 255, .18);
      background: rgba(255, 255, 255, .03);
      color: white;
      box-shadow: none;
    }

    .footer-actions .btn.admin-link {
      min-width: 230px;
      border-color: transparent;
      background: transparent;
      color: rgba(210, 224, 238, .7);
      box-shadow: none;
    }

    @media (max-width: 980px) {
      .hero-grid,
      .trust-grid {
        grid-template-columns: 1fr;
      }

      .hero-card {
        margin: 0;
      }

      .value-grid,
      .flow {
        grid-template-columns: 1fr 1fr;
      }
    }

    @media (max-width: 720px) {
      .wrap {
        width: min(100% - 28px, 1180px);
      }

      .nav-inner {
        min-height: 76px;
      }

      .brand-logo {
        width: 48px;
        height: 48px;
      }

      .brand-text strong {
        font-size: 18px;
      }

      .brand-text small {
        font-size: 10px;
        letter-spacing: .26em;
      }

      .nav-links {
        display: none;
      }

      .hero {
        padding: 46px 0 58px;
      }

      .hero h1 {
        font-size: clamp(42px, 14vw, 58px);
      }

      .lead {
        font-size: 18px;
      }

      .hero-actions,
      .final .btn,
      .footer-actions {
        width: 100%;
      }

      .footer-actions {
        flex-direction: column;
      }

      .btn {
        width: 100%;
        padding-left: 16px;
        padding-right: 16px;
      }

      .ambassador-card {
        min-height: auto;
        padding: 34px 24px 28px;
      }

      .ambassador-card h2 {
        text-align: left;
        margin-bottom: 28px;
      }

      .ambassador-card ul {
        font-size: 22px;
      }

      .section {
        padding: 64px 0;
      }

      .authority-strip {
        padding: 22px 0 26px;
      }

      .authority-track {
        animation-duration: 60s;
      }

      .authority-logo-list {
        gap: 28px;
        padding-right: 28px;
      }

      .authority-logo-card {
        width: 176px;
        height: 82px;
        padding: 5px 8px;
      }

      .authority-logo-card.logo-wide {
        width: 210px;
      }

      .authority-logo-card.logo-compact {
        width: 164px;
      }

      .value-grid,
      .flow {
        grid-template-columns: 1fr;
      }

      .trust-item {
        grid-template-columns: 1fr;
      }
    }
  `;

const landingMarkup = `<div class="landing-shell"><main class="page">
    <header class="nav">
      <div class="wrap nav-inner">
        <a class="brand" href="/" aria-label="Monnera">
          <img class="brand-logo" src="${logoMonnera}" alt="Monnera" />
          <span class="brand-text">
            <small>MONNERA</small>
            <strong>Embaixadores</strong>
          </span>
        </a>
        <nav class="nav-links" aria-label="Acoes principais">
          <a class="btn" href="#dores">Dores que resolve</a>
          <a class="btn primary" href="#quero-ser">Quero participar</a>
        </nav>
      </div>
    </header>

    <section class="hero">
      <div class="wrap hero-grid">
        <div>
          <p class="eyebrow">Gestão de incentivo de vendas</p>
          <h1>A Monnera conecta estratégia, operação e pessoas para construir desempenho <span>extraordinário.</span></h1>
          <p class="lead">
            Transformamos dados de vendas em campanhas de incentivo mais claras, centralizadas e seguras. Clientes e
            embaixadores podem indicar empresas que precisam sair da planilha e operar premiações com mais governança.
          </p>
          <div class="hero-actions">
            <a class="btn primary" href="#quero-ser">Quero participar</a>
            <a class="btn" href="/login">Já sou Embaixador</a>
          </div>
          <div class="note">
            <span aria-hidden="true">✓</span>
            <span>
              <strong>Seguimos juntos:</strong> plataforma, inteligência e acompanhamento próximo para transformar
              incentivo de vendas em uma operação mais prática, rastreável e orientada a resultado.
            </span>
          </div>
        </div>

        <aside class="hero-card" id="quero-ser" aria-label="Perfis do programa de indicação Monnera">
          <div class="audience-stack">
            <article class="audience-card dark">
              <small>Member Get Member Monnera</small>
              <h2>Cliente Embaixador</h2>
              <p>
                Se você já utiliza a Monnera, pode indicar empresas próximas que também precisam organizar incentivos
                de vendas com mais controle, clareza e acompanhamento.
              </p>
              <ul>
                <li>Cashback por indicação no Monnera</li>
                <li>Link rastreável para acompanhar suas indicações</li>
                <li>Atendimento diferenciado para a empresa indicada</li>
                <li>Acompanhamento qualificado pelo time Monnera</li>
              </ul>
              <a class="btn primary" href="/cadastro">Quero indicar como Cliente Embaixador</a>
            </article>

            <article class="audience-card">
              <small>Consultores, contadores e representantes</small>
              <h2>Embaixador Comercial</h2>
              <p>
                Se você atua próximo a empresas que precisam melhorar gestão comercial, performance e governança de
                incentivos, pode indicar a Monnera e gerar ganho recorrente quando a oportunidade se converte em cliente.
              </p>
              <ul>
                <li>Plataforma individual do consultor</li>
                <li>Ganho real e recorrente por cliente convertido</li>
                <li>Materiais de divulgação disponíveis na plataforma</li>
                <li>Acompanhamento das oportunidades em ambiente próprio</li>
              </ul>
              <a class="btn dark" href="/cadastro">Quero atuar como Embaixador Comercial</a>
            </article>
          </div>
        </aside>
      </div>
    </section>

    <section class="authority-strip" aria-label="Parceiros comerciais Monnera">
      <p class="authority-kicker">Parceiros comerciais Monnera</p>
      <div class="authority-track">
        <div class="authority-logo-list">
          <span class="authority-logo-card logo-compact"><img src="/assets-clientes-monnera/parceiros-comerciais/parceiro-01.png" alt="Parceiro comercial Monnera 01" /></span>
          <span class="authority-logo-card logo-wide"><img src="/assets-clientes-monnera/parceiros-comerciais/parceiro-02.png" alt="Parceiro comercial Monnera 02" /></span>
          <span class="authority-logo-card logo-wide"><img src="/assets-clientes-monnera/parceiros-comerciais/parceiro-03.png" alt="Parceiro comercial Monnera 03" /></span>
          <span class="authority-logo-card logo-compact"><img src="/assets-clientes-monnera/parceiros-comerciais/parceiro-04.png" alt="Parceiro comercial Monnera 04" /></span>
          <span class="authority-logo-card logo-wide"><img src="/assets-clientes-monnera/parceiros-comerciais/parceiro-05.png" alt="Parceiro comercial Monnera 05" /></span>
          <span class="authority-logo-card logo-wide"><img src="/assets-clientes-monnera/parceiros-comerciais/parceiro-06.png" alt="Parceiro comercial Monnera 06" /></span>
          <span class="authority-logo-card logo-wide"><img src="/assets-clientes-monnera/parceiros-comerciais/parceiro-07.png" alt="Parceiro comercial Monnera 07" /></span>
          <span class="authority-logo-card logo-wide"><img src="/assets-clientes-monnera/parceiros-comerciais/parceiro-08.png" alt="Parceiro comercial Monnera 08" /></span>
          <span class="authority-logo-card logo-wide"><img src="/assets-clientes-monnera/parceiros-comerciais/parceiro-09.png" alt="Parceiro comercial Monnera 09" /></span>
          <span class="authority-logo-card logo-wide"><img src="/assets-clientes-monnera/parceiros-comerciais/parceiro-10.png" alt="Parceiro comercial Monnera 10" /></span>
          <span class="authority-logo-card logo-wide"><img src="/assets-clientes-monnera/parceiros-comerciais/parceiro-11.png" alt="Parceiro comercial Monnera 11" /></span>
          <span class="authority-logo-card logo-wide"><img src="/assets-clientes-monnera/parceiros-comerciais/parceiro-12.png" alt="Parceiro comercial Monnera 12" /></span>
          <span class="authority-logo-card logo-wide"><img src="/assets-clientes-monnera/parceiros-comerciais/parceiro-13.png" alt="Parceiro comercial Monnera 13" /></span>
          <span class="authority-logo-card logo-wide"><img src="/assets-clientes-monnera/parceiros-comerciais/parceiro-14.png" alt="Parceiro comercial Monnera 14" /></span>
          <span class="authority-logo-card logo-wide"><img src="/assets-clientes-monnera/parceiros-comerciais/parceiro-15.png" alt="Parceiro comercial Monnera 15" /></span>
          <span class="authority-logo-card logo-wide"><img src="/assets-clientes-monnera/parceiros-comerciais/parceiro-16.png" alt="Parceiro comercial Monnera 16" /></span>
          <span class="authority-logo-card logo-wide"><img src="/assets-clientes-monnera/parceiros-comerciais/parceiro-17.png" alt="Parceiro comercial Monnera 17" /></span>
          <span class="authority-logo-card logo-wide"><img src="/assets-clientes-monnera/parceiros-comerciais/parceiro-18.png" alt="Parceiro comercial Monnera 18" /></span>
          <span class="authority-logo-card logo-wide"><img src="/assets-clientes-monnera/parceiros-comerciais/parceiro-19.png" alt="Parceiro comercial Monnera 19" /></span>
          <span class="authority-logo-card logo-wide"><img src="/assets-clientes-monnera/parceiros-comerciais/parceiro-20.png" alt="Parceiro comercial Monnera 20" /></span>
          <span class="authority-logo-card logo-compact"><img src="/assets-clientes-monnera/parceiros-comerciais/parceiro-21.png" alt="Parceiro comercial Monnera 21" /></span>
          <span class="authority-logo-card logo-compact"><img src="/assets-clientes-monnera/parceiros-comerciais/parceiro-22.png" alt="Parceiro comercial Monnera 22" /></span>
          <span class="authority-logo-card logo-wide"><img src="/assets-clientes-monnera/parceiros-comerciais/parceiro-23.png" alt="Parceiro comercial Monnera 23" /></span>
          <span class="authority-logo-card logo-compact"><img src="/assets-clientes-monnera/parceiros-comerciais/parceiro-24.png" alt="Parceiro comercial Monnera 24" /></span>
        </div>
        <div class="authority-logo-list" aria-hidden="true">
          <span class="authority-logo-card logo-compact"><img src="/assets-clientes-monnera/parceiros-comerciais/parceiro-01.png" alt="" /></span>
          <span class="authority-logo-card logo-wide"><img src="/assets-clientes-monnera/parceiros-comerciais/parceiro-02.png" alt="" /></span>
          <span class="authority-logo-card logo-wide"><img src="/assets-clientes-monnera/parceiros-comerciais/parceiro-03.png" alt="" /></span>
          <span class="authority-logo-card logo-compact"><img src="/assets-clientes-monnera/parceiros-comerciais/parceiro-04.png" alt="" /></span>
          <span class="authority-logo-card logo-wide"><img src="/assets-clientes-monnera/parceiros-comerciais/parceiro-05.png" alt="" /></span>
          <span class="authority-logo-card logo-wide"><img src="/assets-clientes-monnera/parceiros-comerciais/parceiro-06.png" alt="" /></span>
          <span class="authority-logo-card logo-wide"><img src="/assets-clientes-monnera/parceiros-comerciais/parceiro-07.png" alt="" /></span>
          <span class="authority-logo-card logo-wide"><img src="/assets-clientes-monnera/parceiros-comerciais/parceiro-08.png" alt="" /></span>
          <span class="authority-logo-card logo-wide"><img src="/assets-clientes-monnera/parceiros-comerciais/parceiro-09.png" alt="" /></span>
          <span class="authority-logo-card logo-wide"><img src="/assets-clientes-monnera/parceiros-comerciais/parceiro-10.png" alt="" /></span>
          <span class="authority-logo-card logo-wide"><img src="/assets-clientes-monnera/parceiros-comerciais/parceiro-11.png" alt="" /></span>
          <span class="authority-logo-card logo-wide"><img src="/assets-clientes-monnera/parceiros-comerciais/parceiro-12.png" alt="" /></span>
          <span class="authority-logo-card logo-wide"><img src="/assets-clientes-monnera/parceiros-comerciais/parceiro-13.png" alt="" /></span>
          <span class="authority-logo-card logo-wide"><img src="/assets-clientes-monnera/parceiros-comerciais/parceiro-14.png" alt="" /></span>
          <span class="authority-logo-card logo-wide"><img src="/assets-clientes-monnera/parceiros-comerciais/parceiro-15.png" alt="" /></span>
          <span class="authority-logo-card logo-wide"><img src="/assets-clientes-monnera/parceiros-comerciais/parceiro-16.png" alt="" /></span>
          <span class="authority-logo-card logo-wide"><img src="/assets-clientes-monnera/parceiros-comerciais/parceiro-17.png" alt="" /></span>
          <span class="authority-logo-card logo-wide"><img src="/assets-clientes-monnera/parceiros-comerciais/parceiro-18.png" alt="" /></span>
          <span class="authority-logo-card logo-wide"><img src="/assets-clientes-monnera/parceiros-comerciais/parceiro-19.png" alt="" /></span>
          <span class="authority-logo-card logo-wide"><img src="/assets-clientes-monnera/parceiros-comerciais/parceiro-20.png" alt="" /></span>
          <span class="authority-logo-card logo-compact"><img src="/assets-clientes-monnera/parceiros-comerciais/parceiro-21.png" alt="" /></span>
          <span class="authority-logo-card logo-compact"><img src="/assets-clientes-monnera/parceiros-comerciais/parceiro-22.png" alt="" /></span>
          <span class="authority-logo-card logo-wide"><img src="/assets-clientes-monnera/parceiros-comerciais/parceiro-23.png" alt="" /></span>
          <span class="authority-logo-card logo-compact"><img src="/assets-clientes-monnera/parceiros-comerciais/parceiro-24.png" alt="" /></span>
        </div>
      </div>
    </section>
    <section class="section light" id="dores">
      <div class="wrap">
        <div class="section-head">
          <p class="eyebrow">Dores que a Monnera resolve</p>
          <h2>A Monnera resolve dores que tornam a operação de incentivos mais difícil, manual e insegura.</h2>
          <p class="section-text">
            Muitas empresas já incentivam seus times comerciais, mas ainda fazem isso com controles dispersos,
            regras pouco claras e baixa visibilidade para participantes e gestores. A Monnera centraliza essa operação
            em uma plataforma de Governance & Performance.
          </p>
        </div>

        <div class="value-grid">
          <article class="value-card compact">
            <div class="icon">01</div>
            <h3>Planilhas e controles manuais</h3>
            <p>Reduza retrabalho, erro humano e dificuldade de auditoria em campanhas de incentivo.</p>
          </article>
          <article class="value-card compact dark-card">
            <div class="icon">02</div>
            <h3>Premiação confusa</h3>
            <p>Dê mais clareza sobre metas, regras, saldo, progresso e desempenho para quem opera e participa.</p>
          </article>
          <article class="value-card compact">
            <div class="icon">03</div>
            <h3>Metas injustas ou globais</h3>
            <p>Organize metas por participante, loja, CPF, produto, fabricante ou grupo.</p>
          </article>
          <article class="value-card compact">
            <div class="icon">04</div>
            <h3>Baixa visibilidade</h3>
            <p>Permita que o participante acompanhe sua evolução com mais rapidez e clareza.</p>
          </article>
          <article class="value-card compact">
            <div class="icon">05</div>
            <h3>Dados que não viram ação</h3>
            <p>Transforme informações do ERP em campanhas, metas, apuração e reconhecimento.</p>
          </article>
          <article class="value-card compact dark-card">
            <div class="icon">06</div>
            <h3>Incentivo ao sell-out</h3>
            <p>Conecte indústria, distribuidores, varejo e força de vendas com mais rastreabilidade.</p>
          </article>
          <article class="value-card compact">
            <div class="icon">07</div>
            <h3>Risco operacional e jurídico</h3>
            <p>Estruture a premiação com regras documentadas, registros e formalização digital.</p>
          </article>
          <article class="value-card compact">
            <div class="icon">08</div>
            <h3>Pouca governança</h3>
            <p>Centralize planejamento, execução, acompanhamento, apuração e pagamento.</p>
          </article>
        </div>
      </div>
    </section>

    <section class="section dark" id="fundamentos">
      <div class="wrap">
        <div class="section-head">
          <p class="eyebrow">Fundamentos legais e governança</p>
          <h2>Premiação comercial com mais rastreabilidade, clareza e governança.</h2>
          <p class="section-text">
            A Monnera apoia empresas na estruturação de campanhas de incentivo com regras claras, registros operacionais
            e Termo de Aceite digital. A operação considera fundamentos informados pela Lei 13.467/2017 e pelo Art. 457,
            parágrafos 2 e 4 da CLT, que tratam da premiação por desempenho extraordinário.
          </p>
        </div>

        <div class="flow">
          <article class="flow-step">
            <h3>Termo de Aceite digital</h3>
            <p>Formaliza a adesão voluntária do participante à campanha.</p>
          </article>
          <article class="flow-step">
            <h3>Regras documentadas</h3>
            <p>Ajuda a deixar critérios, metas e condições mais claros.</p>
          </article>
          <article class="flow-step">
            <h3>Rastreabilidade da operação</h3>
            <p>Registra etapas importantes da campanha e da apuração.</p>
          </article>
          <article class="flow-step">
            <h3>Desempenho extraordinário</h3>
            <p>Posiciona o incentivo como reconhecimento vinculado a objetivos claros.</p>
          </article>
        </div>
        <p class="legal-note">
          As informações legais e fiscais devem ser avaliadas conforme o contexto de cada empresa, com validação jurídica
          e contábil própria.
        </p>
      </div>
    </section>

    <section class="section mist" id="como-resolve">
      <div class="wrap trust-grid">
        <div>
          <p class="eyebrow">Como a Monnera resolve</p>
          <h2>Da venda ao reconhecimento, a Monnera conecta dados, metas e premiação.</h2>
          <p class="section-text">
            A plataforma organiza a jornada de incentivo de vendas com integração de dados, regras configuráveis,
            apuração estruturada e visibilidade para quem constrói resultado.
          </p>
        </div>

        <div class="trust-list">
          <article class="trust-item">
            <div class="icon">01</div>
            <div>
              <h3>Integração com ERP</h3>
              <p>A Monnera espelha dados de venda via API, SFTP, views ou estruturas equivalentes.</p>
            </div>
          </article>
          <article class="trust-item">
            <div class="icon">02</div>
            <div>
              <h3>Atualização D-1</h3>
              <p>O participante pode visualizar hoje o resultado apurado a partir dos dados de ontem.</p>
            </div>
          </article>
          <article class="trust-item">
            <div class="icon">03</div>
            <div>
              <h3>Metas inteligentes</h3>
              <p>Campanhas podem ter meta mínima, meta, super meta e faixas de desempenho.</p>
            </div>
          </article>
          <article class="trust-item">
            <div class="icon">04</div>
            <div>
              <h3>Totalização por CPF</h3>
              <p>Reconhece o desempenho individual com mais justiça e clareza.</p>
            </div>
          </article>
          <article class="trust-item">
            <div class="icon">05</div>
            <div>
              <h3>Cálculo sobre valor líquido</h3>
              <p>Apoia apurações com base no valor faturado líquido, excluindo impostos como ICMS e ST.</p>
            </div>
          </article>
          <article class="trust-item">
            <div class="icon">06</div>
            <div>
              <h3>Operação centralizada</h3>
              <p>Reúne campanhas, participantes, regras, comunicação, apuração e pagamento.</p>
            </div>
          </article>
        </div>
      </div>
    </section>

    <section class="final" id="formulario">
      <div class="wrap">
        <h2>Ajude mais empresas a transformar dados em desempenho extraordinário.</h2>
        <p>
          Indique a Monnera para empresas que precisam sair da planilha, reduzir improvisos e operar incentivos de vendas
          com mais clareza, governança e segurança. Seja como Cliente Embaixador ou Embaixador Comercial, você participa
          de um ecossistema que conecta tecnologia, inteligência e acompanhamento próximo.
        </p>
        <div class="footer-actions" aria-label="Acessos do projeto Monnera Comercial">
          <a class="btn primary" href="/cadastro">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <circle cx="9" cy="7" r="4" stroke="currentColor" stroke-width="2"/>
              <path d="M19 8v6M22 11h-6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
            Quero participar do programa
          </a>
          <a class="btn outline" href="/login">
            Já sou Embaixador Monnera
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M5 12h14M13 5l7 7-7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </a>
          <a class="btn admin-link" href="/admin/login">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Retaguarda Monnera
          </a>
        </div>
      </div>
    </section>
  </main></div>`;

const IndexFigma = () => (
  <>
    <style>{landingStyles}</style>
    <div dangerouslySetInnerHTML={{ __html: landingMarkup }} />
  </>
);

export default IndexFigma;
