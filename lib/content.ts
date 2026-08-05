// All user-facing copy for the thesis site, in English and Czech.
// Content is drawn directly from the thesis "Adaptive Portfolio
// Optimization" (Bc. Tomáš Procházka, FNSPE CTU Prague, 2025/2026).
//
// `en` is the source of truth for the shape; `cs` must match it (enforced
// by the `Content` type below).

export const PDF_PATH = "/Prochazka-Adaptive-Portfolio-Optimization.pdf";
export const CODE_URL = "https://github.com/ProchTomas/ResearchProject";

const en = {
  locale: {
    label: "EN",
    switchTo: "Čeština",
  },

  nav: {
    abstract: "Abstract",
    pipeline: "Approach",
    contributions: "Contributions",
    chapters: "Contents",
    findings: "Findings",
    future: "Future work",
    references: "References",
  },

  header: {
    home: "Adaptive Portfolio Optimization",
    downloadPdf: "Download PDF",
    viewCode: "View code",
  },

  hero: {
    kicker: "Master's Thesis · Academic Year 2025/2026",
    title: "Adaptive Portfolio Optimization",
    lead:
      "A fully probabilistic, adaptive framework for portfolio optimization — " +
      "unifying Bayesian learning, model-structure estimation, uncertainty-aware " +
      "control design, and numerically stable optimization into one methodological pipeline.",
    authorLabel: "Author",
    author: "Bc. Tomáš Procházka",
    supervisorLabel: "Supervisor",
    supervisor: "Ing. Miroslav Kárný, DrSc.",
    supervisorAffil: "ÚTIA, Czech Academy of Sciences",
    coSupervisorLabel: "Co-Supervisor",
    coSupervisor: "doc. Ing. Quang Van Tran, Ph.D.",
    coSupervisorAffil: "FNSPE, CTU in Prague",
    university: "Czech Technical University in Prague",
    faculty: "Faculty of Nuclear Sciences and Physical Engineering",
    department: "Department of Mathematics",
    programLabel: "Programme",
    program: "Applied Mathematical and Stochastic Methods",
    submittedLabel: "Submitted",
    submitted: "8 May 2026",
    downloadPdf: "Download the thesis (PDF)",
    viewCode: "Implementation on GitHub",
  },

  abstract: {
    heading: "Abstract",
    body:
      "This thesis develops a Bayesian learning framework for autoregressive models " +
      "with exogenous variables. The proposed approach optimally selects a conjugate " +
      "prior for unknown parameters, infers the model structure, and tracks parameter " +
      "variations through a data-driven optimized forgetting algorithm. Building on this " +
      "model, the thesis introduces an expected multi-step decision policy design under " +
      "quadratic loss, formulated via feasible square-root optimization and implemented " +
      "in a receding-horizon setting. The policy exploits a fully probabilistic design " +
      "that provides consistent and principled risk handling, enabling an off-line design " +
      "strategy based on Thompson sampling of parameters. The resulting framework offers a " +
      "theoretically complete and analytical solution to a challenging decision-making " +
      "problem and is applicable to a broad class of related problems. The number of " +
      "hyperparameters requiring expert tuning is low. Experiments on real-world data " +
      "demonstrate that the proposed portfolio optimization strategy consistently " +
      "outperforms the uniform portfolio benchmark under relevant and reasonable " +
      "conditions, validating the effectiveness of the approach.",
    keywordsLabel: "Keywords",
    keywords: [
      "portfolio optimization",
      "probabilistic modeling",
      "forgetting",
      "adaptive decision-making",
      "fully probabilistic design",
    ],
  },

  pipeline: {
    heading: "The approach",
    intro:
      "An entity that uses the scheme and receives the returns is the investor. " +
      "The market produces the observed returns of individual assets; the rest of " +
      "the world supplies information potentially useful for predicting them. Data " +
      "drives model-structure estimation, the choice of Bayesian prior, and forgetting. " +
      "The learned model informs a quantitative expression of the investor's aims and " +
      "the optimal allocation of funds — before the returns are realized.",
    caption: "Fig. 1.1 — Solution pipeline",
    nodes: {
      market: "Market",
      marketSub: "observed returns yₜ",
      world: "Rest of the world",
      worldSub: "exogenous data xₜ",
      learning: "Adaptive model learning",
      learningSub: "predictor",
      prior: "Prior PDF choice & structure estimation",
      preference: "Preference quantification & optimization",
      preferenceSub: "constraints · hyperparameters",
      policy: "Policy",
      allocation: "Allocation",
      allocationSub: "aₜᵀyₜ",
      user: "Investor",
    },
  },

  contributions: {
    heading: "Core contributions",
    intro:
      "The core contribution lies in unifying, improving, and connecting several " +
      "well-established areas into one algorithmic decision-making approach with a " +
      "strong theoretical foundation and minimal need for user input.",
    items: [
      {
        title: "Multivariate ARX modeling with an optimized conjugate GiW prior",
        section: "Section 2.1",
        desc:
          "An autoregressive returns model with exogenous variables, paired with an " +
          "optimally selected Gauss–inverse-Wishart conjugate prior for the unknown parameters.",
      },
      {
        title: "Adaptive data-driven forgetting via minimum relative entropy",
        section: "Section 2.3",
        desc:
          "Forgetting weights are optimized to balance historical information, new " +
          "observations, and prior regularization — improving responsiveness in volatile " +
          "markets while staying stable in stationary periods.",
      },
      {
        title: "Heuristic initiation of global structure-estimation maximization",
        section: "Section 2.5",
        desc:
          "Model structure is inferred through hierarchical Bayesian estimation applied to " +
          "the conjugate prior, with a heuristic that seeds the global maximization.",
      },
      {
        title: "Fully probabilistic design of risk-aware multi-step strategies",
        section: "Section 3.3",
        desc:
          "Parameter uncertainty is propagated into the decision itself: risk handling is " +
          "derived from a principled probabilistic formulation rather than bolted on heuristically.",
      },
      {
        title: "Square-root constrained sequential quadratic optimization",
        section: "Section 4.1",
        desc:
          "Optimization in numerically stable Cholesky square roots preserves analytical " +
          "traceability and removes the need for externally tuned correction heuristics.",
      },
    ],
  },

  chapters: {
    heading: "Contents",
    items: [
      {
        n: "1",
        title: "Introduction",
        sub: [],
      },
      {
        n: "2",
        title: "Model for Returns",
        sub: [
          "Multivariate Linear Regression",
          "Transformations",
          "Forgetting",
          "Optimal Prior",
          "Structure Estimation",
        ],
      },
      {
        n: "3",
        title: "Fully Probabilistic Design",
        sub: ["Formalism", "Exploration", "Linear Quadratic Regulator"],
      },
      {
        n: "4",
        title: "Optimization Algorithm",
        sub: ["Multi-Step Optimization", "One-Step Loss Propagation"],
      },
      {
        n: "5",
        title: "Experiments",
        sub: [
          "200 Portfolios with Custom Regressor",
          "200 Portfolios with Structure Estimation",
          "Live Trading",
        ],
      },
      {
        n: "6",
        title: "Conclusions",
        sub: [],
      },
      {
        n: "A–B",
        title: "Appendices",
        sub: ["Lemmas", "Data"],
      },
    ],
  },

  findings: {
    heading: "What the experiments show",
    intro:
      "Empirical evaluation on real-world financial data (Chapter 5) supports the following:",
    items: [
      "The adaptive Risk-Averse strategy consistently outperforms the uniform-portfolio benchmark under reasonable conditions with an expertly chosen exogenous input.",
      "Uncertainty-aware allocation improves robustness and manages risk more successfully than the Risk-Seeking strategy.",
      "Multi-step optimization with uncertainty included via parameter sampling enhances even the purely return-maximizing (Risk-Seeking) strategy.",
      "Classical Markowitz optimization fails in the long run once transaction costs are accounted for.",
      "Performance decays when automated structure estimation replaces an expertly chosen regressor.",
    ],
  },

  future: {
    heading: "Future directions",
    items: [
      {
        title: "Heavy-tailed dynamics",
        desc:
          "Adaptively weighted Gaussian mixtures or regime-switching models to capture heavy " +
          "tails and structural breaks — without abandoning analytical feasibility.",
      },
      {
        title: "Richer exogenous data",
        desc:
          "Beyond return-derived metrics: quantified news text, derivatives-market data, and expert opinions.",
      },
      {
        title: "Large-investor extension",
        desc:
          "Adapting the optimization and an optimal re-balancing method for investors whose trades " +
          "move the market, with respect to volume and the current order book.",
      },
    ],
  },

  references: {
    heading: "Selected references",
    note: "Recommended literature underpinning the thesis.",
    items: [
      "A. Gunjan, S. Bhattacharyya. A brief review of portfolio optimization techniques. Artificial Intelligence Review, 56:3847–3886, 2023.",
      "Z. X. Loke, S. L. Goh, G. Kendall, S. Abdullah, N. R. Sabar. Portfolio optimization problem: a taxonomic review of solution methodologies. IEEE Access, 11:33100–33120, 2023.",
      "D. P. Bertsekas. Dynamic Programming and Optimal Control. Athena Scientific, 2001.",
      "Z. Dostál. Optimal Quadratic Programming Algorithms: With Applications to Variational Inequalities. Springer, 2009.",
      "M. Kárný. Towards fully probabilistic control design. Automatica, 32(12):1719–1722, 1996.",
      "M. Kárný. Axiomatisation of Fully Probabilistic Design Revisited. Systems & Control Letters, 141, 2020.",
      "M. Kárný. Optimised conjugate prior for model structure estimation in the exponential family. Expert Systems With Applications, 283, 2025.",
      "T. Procházka. Probabilistic modelling in adaptive portfolio optimization. Bachelor thesis, FNSPE, CTU Prague, 2024.",
      "T. Procházka. Tools for adaptive portfolio optimization. Research project, FNSPE, CTU Prague, 2025.",
      "M. Kárný, A. Halousková, J. Böhm, R. Kulhavý, P. Nedoma. Design of linear quadratic adaptive control: Theory and algorithms for practice. Kybernetika, 21, Suppl. 3–6, 1985.",
    ],
  },

  footer: {
    ackHeading: "Acknowledgment",
    ack:
      "I thank my supervisor Ing. Miroslav Kárný, DrSc. for his patience, friendly " +
      "approach, and support, and my co-supervisor doc. Ing. Quang Van Tran, Ph.D. for " +
      "fruitful conversations.",
    fundingHeading: "Support",
    funding:
      "Supported by the Joint Research Laboratory TALISMAN, EU COST Action CA24136, " +
      "SGS25/167/OHK4/3T/14 and SGS26/170/OHK4/3T/14.",
    rights: "Bc. Tomáš Procházka · CTU in Prague · 2026",
  },
};

export type Content = typeof en;

const cs: Content = {
  locale: {
    label: "CZ",
    switchTo: "English",
  },

  nav: {
    abstract: "Abstrakt",
    pipeline: "Přístup",
    contributions: "Přínosy",
    chapters: "Obsah",
    findings: "Výsledky",
    future: "Další práce",
    references: "Literatura",
  },

  header: {
    home: "Adaptivní optimalizace portfolia",
    downloadPdf: "Stáhnout PDF",
    viewCode: "Zdrojový kód",
  },

  hero: {
    kicker: "Diplomová práce · Akademický rok 2025/2026",
    title: "Adaptivní optimalizace portfolia",
    lead:
      "Plně pravděpodobnostní adaptivní rámec pro optimalizaci portfolia — " +
      "spojuje bayesovské učení, odhad struktury modelu, návrh řízení respektující " +
      "neurčitost a numericky stabilní optimalizaci do jednoho metodologického schématu.",
    authorLabel: "Autor",
    author: "Bc. Tomáš Procházka",
    supervisorLabel: "Vedoucí práce",
    supervisor: "Ing. Miroslav Kárný, DrSc.",
    supervisorAffil: "ÚTIA AV ČR",
    coSupervisorLabel: "Spoluvedoucí",
    coSupervisor: "doc. Ing. Quang Van Tran, Ph.D.",
    coSupervisorAffil: "FJFI ČVUT v Praze",
    university: "České vysoké učení technické v Praze",
    faculty: "Fakulta jaderná a fyzikálně inženýrská",
    department: "Katedra matematiky",
    programLabel: "Studijní program",
    program: "Aplikované matematicko-stochastické metody",
    submittedLabel: "Odevzdáno",
    submitted: "8. května 2026",
    downloadPdf: "Stáhnout práci (PDF)",
    viewCode: "Implementace na GitHubu",
  },

  abstract: {
    heading: "Abstrakt",
    body:
      "Tato práce se věnuje vývoji schématu bayesovského učení pro autoregresivní " +
      "modely s exogenními proměnnými. Navržený přístup optimálně volí sdružené " +
      "apriorní rozdělení neznámých parametrů, odhaduje strukturu modelu a sleduje " +
      "časové změny parametrů pomocí datově řízeného zapomínání. Na tomto základě je " +
      "formulován návrh vícekrokové rozhodovací strategie s kvadratickým kritériem, " +
      "řešený pomocí optimalizace v maticových odmocninách a realizovaný v rámci " +
      "adaptivní strategie s klouzavým horizontem. Výsledná strategie využívá plně " +
      "pravděpodobnostní návrh, který zajišťuje konzistentní a metodologické řízení " +
      "rizika a umožňuje návrh založený na Thompsonově vzorkování z distribuce " +
      "parametrů. Tento postup poskytuje teoreticky kompletní analytické řešení " +
      "náročného rozhodovacího problému a je aplikovatelný na širokou třídu příbuzných " +
      "úloh. Počet hyperparametrů vyžadujících expertní ladění je malý. Experimenty na " +
      "reálných datech demonstrují, že navržená strategie pro adaptivní optimalizaci " +
      "portfolia překonává referenční rovnoměrné portfolio, což potvrzuje efektivitu " +
      "celého přístupu.",
    keywordsLabel: "Klíčová slova",
    keywords: [
      "optimalizace portfolia",
      "pravděpodobnostní modelování",
      "zapomínání",
      "adaptivní rozhodování",
      "plně pravděpodobnostní návrh",
    ],
  },

  pipeline: {
    heading: "Přístup",
    intro:
      "Entita, která schéma používá a přijímá výnosy, je investor. Trh produkuje " +
      "pozorované výnosy jednotlivých aktiv; zbytek světa dodává informace potenciálně " +
      "užitečné pro jejich predikci. Data slouží k odhadu struktury modelu, volbě " +
      "bayesovského apriorního rozdělení a zapomínání. Naučený model slouží pro " +
      "kvantitativní vyjádření cílů investora a pro optimální alokaci prostředků — " +
      "dříve, než jsou výnosy realizovány.",
    caption: "Obr. 1.1 — Schéma řešení",
    nodes: {
      market: "Trh",
      marketSub: "pozorované výnosy yₜ",
      world: "Zbytek světa",
      worldSub: "exogenní data xₜ",
      learning: "Adaptivní učení modelu",
      learningSub: "prediktor",
      prior: "Volba apriorního rozdělení a odhad struktury",
      preference: "Kvantifikace preferencí a optimalizace",
      preferenceSub: "omezení · hyperparametry",
      policy: "Strategie",
      allocation: "Alokace",
      allocationSub: "aₜᵀyₜ",
      user: "Investor",
    },
  },

  contributions: {
    heading: "Hlavní přínosy",
    intro:
      "Hlavní přínos spočívá ve sjednocení, zlepšení a propojení několika zavedených " +
      "oblastí do jednoho algoritmického přístupu k rozhodování se silným teoretickým " +
      "základem a minimální potřebou zásahů uživatele.",
    items: [
      {
        title: "Vícerozměrné ARX modelování s optimalizovaným sdruženým GiW apriornem",
        section: "Kapitola 2.1",
        desc:
          "Autoregresivní model výnosů s exogenními proměnnými spolu s optimálně zvoleným " +
          "sdruženým apriorním rozdělením typu Gauss–inverzní Wishart pro neznámé parametry.",
      },
      {
        title: "Adaptivní datově řízené zapomínání pomocí minimální relativní entropie",
        section: "Kapitola 2.3",
        desc:
          "Váhy zapomínání jsou optimalizovány tak, aby vyvážily historickou informaci, nová " +
          "pozorování a apriorní regularizaci — zlepšují reaktivitu na volatilních trzích a " +
          "zachovávají stabilitu ve stacionárních obdobích.",
      },
      {
        title: "Heuristická inicializace globální maximalizace při odhadu struktury",
        section: "Kapitola 2.5",
        desc:
          "Struktura modelu je odhadována hierarchickým bayesovským odhadem aplikovaným na " +
          "sdružené apriorní rozdělení, s heuristikou pro nastartování globální maximalizace.",
      },
      {
        title: "Plně pravděpodobnostní návrh vícekrokových strategií respektujících riziko",
        section: "Kapitola 3.3",
        desc:
          "Neurčitost parametrů je propagována přímo do rozhodnutí: řízení rizika vychází z " +
          "principiální pravděpodobnostní formulace, nikoli z dodatečné heuristiky.",
      },
      {
        title: "Sekvenční kvadratická optimalizace s omezeními v maticových odmocninách",
        section: "Kapitola 4.1",
        desc:
          "Optimalizace v numericky stabilních Choleského odmocninách zachovává analytickou " +
          "sledovatelnost a odstraňuje potřebu externě laděných korekčních heuristik.",
      },
    ],
  },

  chapters: {
    heading: "Obsah",
    items: [
      {
        n: "1",
        title: "Úvod",
        sub: [],
      },
      {
        n: "2",
        title: "Model výnosů",
        sub: [
          "Vícerozměrná lineární regrese",
          "Transformace",
          "Zapomínání",
          "Optimální apriorno",
          "Odhad struktury",
        ],
      },
      {
        n: "3",
        title: "Plně pravděpodobnostní návrh",
        sub: ["Formalismus", "Explorace", "Lineárně-kvadratický regulátor"],
      },
      {
        n: "4",
        title: "Optimalizační algoritmus",
        sub: ["Vícekroková optimalizace", "Propagace jednokrokové ztráty"],
      },
      {
        n: "5",
        title: "Experimenty",
        sub: [
          "200 portfolií s vlastním regresorem",
          "200 portfolií s odhadem struktury",
          "Živé obchodování",
        ],
      },
      {
        n: "6",
        title: "Závěr",
        sub: [],
      },
      {
        n: "A–B",
        title: "Přílohy",
        sub: ["Lemmata", "Data"],
      },
    ],
  },

  findings: {
    heading: "Co experimenty ukazují",
    intro:
      "Empirické vyhodnocení na reálných finančních datech (Kapitola 5) podporuje následující:",
    items: [
      "Adaptivní strategie averzní k riziku (Risk-Averse) konzistentně překonává referenční rovnoměrné portfolio za rozumných podmínek při expertně zvoleném exogenním vstupu.",
      "Alokace respektující neurčitost zvyšuje robustnost a řídí riziko úspěšněji než strategie vyhledávající riziko (Risk-Seeking).",
      "Vícekroková optimalizace zahrnující neurčitost pomocí vzorkování parametrů vylepšuje i čistě výnos maximalizující strategii (Risk-Seeking).",
      "Klasická Markowitzova optimalizace v dlouhém horizontu selhává, jakmile se započítají transakční náklady.",
      "Výkonnost klesá, když je expertně zvolený regresor nahrazen automatickým odhadem struktury.",
    ],
  },

  future: {
    heading: "Směry dalšího vývoje",
    items: [
      {
        title: "Těžké chvosty",
        desc:
          "Adaptivně vážené směsi gaussovských modelů nebo modely s přepínáním režimů pro " +
          "zachycení těžkých chvostů a strukturních zlomů — bez ztráty analytické řešitelnosti.",
      },
      {
        title: "Bohatší exogenní data",
        desc:
          "Nad rámec metrik odvozených z výnosů: kvantifikovaný text zpráv, data z trhu derivátů a expertní názory.",
      },
      {
        title: "Rozšíření pro velké investory",
        desc:
          "Úprava optimalizace a metody optimálního rebalancování pro investory, jejichž obchody " +
          "hýbou trhem, s ohledem na objem a aktuální knihu objednávek.",
      },
    ],
  },

  references: {
    heading: "Vybraná literatura",
    note: "Doporučená literatura, o niž se práce opírá.",
    items: [
      "A. Gunjan, S. Bhattacharyya. A brief review of portfolio optimization techniques. Artificial Intelligence Review, 56:3847–3886, 2023.",
      "Z. X. Loke, S. L. Goh, G. Kendall, S. Abdullah, N. R. Sabar. Portfolio optimization problem: a taxonomic review of solution methodologies. IEEE Access, 11:33100–33120, 2023.",
      "D. P. Bertsekas. Dynamic Programming and Optimal Control. Athena Scientific, 2001.",
      "Z. Dostál. Optimal Quadratic Programming Algorithms: With Applications to Variational Inequalities. Springer, 2009.",
      "M. Kárný. Towards fully probabilistic control design. Automatica, 32(12):1719–1722, 1996.",
      "M. Kárný. Axiomatisation of Fully Probabilistic Design Revisited. Systems & Control Letters, 141, 2020.",
      "M. Kárný. Optimised conjugate prior for model structure estimation in the exponential family. Expert Systems With Applications, 283, 2025.",
      "T. Procházka. Probabilistic modelling in adaptive portfolio optimization. Bakalářská práce, FJFI ČVUT v Praze, 2024.",
      "T. Procházka. Tools for adaptive portfolio optimization. Výzkumný úkol, FJFI ČVUT v Praze, 2025.",
      "M. Kárný, A. Halousková, J. Böhm, R. Kulhavý, P. Nedoma. Design of linear quadratic adaptive control: Theory and algorithms for practice. Kybernetika, 21, Suppl. 3–6, 1985.",
    ],
  },

  footer: {
    ackHeading: "Poděkování",
    ack:
      "Děkuji svému školiteli Ing. Miroslavu Kárnému, DrSc. za trpělivost, přátelský " +
      "přístup a podporu a svému spoluvedoucímu doc. Ing. Quang Van Tranovi, Ph.D. za " +
      "přínosné konzultace.",
    fundingHeading: "Podpora",
    funding:
      "Podpořeno Joint Research Laboratory TALISMAN, EU COST Action CA24136, " +
      "SGS25/167/OHK4/3T/14 a SGS26/170/OHK4/3T/14.",
    rights: "Bc. Tomáš Procházka · ČVUT v Praze · 2026",
  },
};

export const content: Record<Lang, Content> = { en, cs };

export type Lang = "en" | "cs";
