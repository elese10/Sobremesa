const { JuegoTruco } = window.TrucoGame;
const { esCantoEnvidoValido, calcularEnvido } = window.TrucoRules;
const { ejecutarTurnoBot, registrarAprendizajeRival } = window.TrucoBot;
const { guardarPartidaEnHistorial, obtenerPerfilRival } = window.TrucoHeuristics || {};

const HUMANO_ID = "j1";
const BOT_ID = "j2";
const STORAGE_DIFICULTAD_KEY = "truco_carpincho_dificultad";
const DIFICULTADES_VALIDAS = ["normal", "dificil", "muy_dificil"];

const ETIQUETAS_DIFICULTAD = {
    normal: "Normal",
    dificil: "Difícil",
    muy_dificil: "Muy Difícil"
};

let dificultadActual = cargarDificultadGuardada();
let dificultadSeleccionadaModal = dificultadActual;
let partidaIniciada = false;

let juego = new JuegoTruco(2, 30);
juego.dificultad = dificultadActual;

let bloqueadoPorAnimacion = false;
let modalEnvidoAbierto = false;
let modalDificultadAbierto = true;
let mesaVisual = [];
let cartasVisiblesHumano = [...juego.obtenerJugador(HUMANO_ID).cartas];
let cartasVisiblesBotCount = juego.obtenerJugador(BOT_ID).cartas.length;
let globoTimeout = null;

// Registro de la ronda actual para alimentar el aprendizaje de la IA
let rondaStats = {
    humanoCantoEnvido: false,
    humanoCantoTruco: false,
    cartasInicialesHumano: [...juego.obtenerJugador(HUMANO_ID).cartas]
};

// Referencias DOM - Header y Dificultad
const elHeaderDiffBtn = document.getElementById("header-difficulty-btn");
const elHeaderDiffLabel = document.getElementById("header-difficulty-label");
const elRivalAiBadge = document.getElementById("rival-ai-badge");
const elDifficultyModal = document.getElementById("difficulty-modal");
const elDifficultyStartBtn = document.getElementById("difficulty-start-btn");
const elModalMemoryBadge = document.getElementById("modal-memory-badge");
const elDiffOptionCards = document.querySelectorAll(".diff-option-card");

// Referencias DOM - Anotador
const elScoreColumn = document.getElementById("score-column");
const elMobileScoreToggle = document.getElementById("mobile-score-toggle");
const elMobileYouScore = document.getElementById("mobile-you-score");
const elMobileYouStage = document.getElementById("mobile-you-stage");
const elMobileRivalScore = document.getElementById("mobile-rival-score");
const elMobileRivalStage = document.getElementById("mobile-rival-stage");
const elYouScore = document.getElementById("you-score");
const elYouStage = document.getElementById("you-stage");
const elYouTally = document.getElementById("you-tally");
const elRivalScore = document.getElementById("rival-score");
const elRivalStage = document.getElementById("rival-stage");
const elRivalTally = document.getElementById("rival-tally");

// Referencias DOM - Mesa y Rival
const elRivalStatus = document.getElementById("rival-status");
const elRivalCards = document.querySelector(".rival-cards");
const elCapyWrap = document.querySelector(".capy-wrap");
const elCapySpeech = document.getElementById("capy-speech");
const elCapySpeechText = document.getElementById("capy-speech-text");
const elTableCards = document.getElementById("table-cards");
const elHand = document.querySelector(".hand");
const elRoundMessage = document.getElementById("round-message");

// Referencias DOM - Panel de Acciones y Móvil
const elDrawerBackdrop = document.getElementById("drawer-backdrop");
const elActionColumn = document.getElementById("action-column");
const elMobileDrawerClose = document.getElementById("mobile-drawer-close");
const elMobileQuickAction = document.getElementById("mobile-quick-action");
const elMobileCallsToggle = document.getElementById("mobile-calls-toggle");
const elMobileCallsToggleLabel = document.getElementById("mobile-calls-toggle-label");
const elTurnTitle = document.getElementById("turn-title");
const elTurnCaption = document.getElementById("turn-caption");
const elHandValue = document.getElementById("hand-value");
const elCalls = document.querySelector(".calls");
const elFoldButton = document.querySelector(".fold-button");

// Referencias Modal Envido
const elEnvidoModal = document.getElementById("envido-modal");
const elEnvidoModalCard = document.getElementById("envido-modal-card");
const elEnvidoModalClose = document.getElementById("envido-modal-close");
const elEnvidoModalChain = document.getElementById("envido-modal-chain");
const elEnvidoModalTitle = document.getElementById("envido-modal-title");
const elEnvidoModalReason = document.getElementById("envido-modal-reason");
const elEnvidoBoxYou = document.getElementById("envido-box-you");
const elEnvidoBoxRival = document.getElementById("envido-box-rival");
const elEnvidoPointsYou = document.getElementById("envido-points-you");
const elEnvidoPointsRival = document.getElementById("envido-points-rival");
const elEnvidoModalAward = document.getElementById("envido-modal-award");

const NOMBRES_CARTA = {
    1: "Ancho",
    2: "Dos",
    3: "Tres",
    4: "Cuatro",
    5: "Cinco",
    6: "Seis",
    7: "Siete",
    10: "Sota",
    11: "Caballo",
    12: "Rey"
};

const NOMBRES_CANTO_ENVIDO = {
    ENVIDO: "Envido",
    REAL_ENVIDO: "Real Envido",
    FALTA_ENVIDO: "Falta Envido"
};

function cargarDificultadGuardada() {
    try {
        const params = new URLSearchParams(window.location.search);
        const porUrl = params.get("dificultad") || params.get("nivel");
        if (porUrl && DIFICULTADES_VALIDAS.includes(porUrl)) {
            guardarDificultadSeleccionada(porUrl);
            return porUrl;
        }
        const guardada = localStorage.getItem(STORAGE_DIFICULTAD_KEY);
        if (guardada && DIFICULTADES_VALIDAS.includes(guardada)) {
            return guardada;
        }
    } catch (_) {
        // Ignorar si localStorage no está disponible
    }
    return "dificil";
}

function guardarDificultadSeleccionada(nivel) {
    try {
        localStorage.setItem(STORAGE_DIFICULTAD_KEY, nivel);
    } catch (_) {
        // Ignorar si localStorage no está disponible
    }
}

function estaBloqueadaInteraccion() {
    return bloqueadoPorAnimacion || modalEnvidoAbierto || modalDificultadAbierto;
}

/* ================= GESTIÓN DE DIFICULTAD Y MODAL ================= */
function actualizarUIBadgesDificultad() {
    const nombre = ETIQUETAS_DIFICULTAD[dificultadActual] || "Difícil";
    if (elHeaderDiffBtn) {
        elHeaderDiffBtn.dataset.diff = dificultadActual;
    }
    if (elHeaderDiffLabel) {
        elHeaderDiffLabel.textContent = nombre;
    }
    if (elRivalAiBadge) {
        elRivalAiBadge.textContent = `IA · ${nombre.toUpperCase()}`;
    }
    actualizarBadgeMemoriaModal();
}

function actualizarBadgeMemoriaModal() {
    if (!elModalMemoryBadge) return;
    let cant = 0;
    try {
        const raw = localStorage.getItem("truco_carpincho_historial_3p_v1");
        const parsed = raw ? JSON.parse(raw) : [];
        if (Array.isArray(parsed)) cant = Math.min(3, parsed.length);
    } catch (_) {
        cant = 0;
    }
    elModalMemoryBadge.textContent = cant > 0
        ? `Memoria: ${cant}/3 ${cant === 1 ? "partida" : "partidas"}`
        : "Memoria 3 partidas";
}

function marcarOpcionModal(nivel) {
    dificultadSeleccionadaModal = nivel;
    elDiffOptionCards.forEach(card => {
        const activa = card.dataset.selectDiff === nivel;
        card.classList.toggle("is-selected", activa);
        card.setAttribute("aria-checked", activa ? "true" : "false");
    });
}

function abrirModalDificultad() {
    cerrarDrawersMovil();
    modalDificultadAbierto = true;
    dificultadSeleccionadaModal = dificultadActual;
    marcarOpcionModal(dificultadActual);
    actualizarBadgeMemoriaModal();

    if (elDifficultyStartBtn) {
        elDifficultyStartBtn.textContent = partidaIniciada
            ? "Aplicar dificultad"
            : "¡Sentarse a jugar!";
    }
    if (elDifficultyModal) {
        elDifficultyModal.hidden = false;
    }
    render();
}

function confirmarModalDificultad() {
    const cambioNivel = dificultadSeleccionadaModal !== dificultadActual;
    dificultadActual = dificultadSeleccionadaModal;
    guardarDificultadSeleccionada(dificultadActual);
    juego.dificultad = dificultadActual;

    if (obtenerPerfilRival) {
        obtenerPerfilRival(juego, true);
    }

    modalDificultadAbierto = false;
    if (elDifficultyModal) {
        elDifficultyModal.hidden = true;
    }

    actualizarUIBadgesDificultad();

    const eraInicio = !partidaIniciada;
    partidaIniciada = true;

    if (cambioNivel && !eraInicio) {
        const descripciones = {
            normal: "Cambiaste a Normal · Carpincho juega clásico",
            dificil: "Cambiaste a Difícil · Lectura táctica activa",
            muy_dificil: "Cambiaste a Muy Difícil · Memoria de 3 partidas activa"
        };
        mostrarMensaje(descripciones[dificultadActual] || "");
    }

    render();

    if (dificultadActual === "muy_dificil" && obtenerPerfilRival && (eraInicio || cambioNivel)) {
        const perfil = obtenerPerfilRival(juego);
        if ((perfil.partidasRecordadas || 0) > 0) {
            mostrarGloboCarpincho("Ya te tengo junado...", "truco", 2300);
        }
    }

    verificarTurnoBot();
}

function inicializarEventosDificultad() {
    elDiffOptionCards.forEach(card => {
        card.addEventListener("click", () => {
            const nivel = card.dataset.selectDiff;
            if (nivel && DIFICULTADES_VALIDAS.includes(nivel)) {
                marcarOpcionModal(nivel);
            }
        });
    });

    if (elDifficultyStartBtn) {
        elDifficultyStartBtn.addEventListener("click", confirmarModalDificultad);
    }

    if (elHeaderDiffBtn) {
        elHeaderDiffBtn.addEventListener("click", () => {
            if (bloqueadoPorAnimacion || modalEnvidoAbierto) return;
            abrirModalDificultad();
        });
    }

    if (elDifficultyModal) {
        elDifficultyModal.addEventListener("click", (e) => {
            if (e.target === elDifficultyModal && partidaIniciada) {
                modalDificultadAbierto = false;
                elDifficultyModal.hidden = true;
                render();
                verificarTurnoBot();
            }
        });
    }
}

/* ================= DRAWERS MÓVILES ================= */
function cerrarDrawersMovil() {
    if (elScoreColumn) elScoreColumn.classList.remove("is-open");
    if (elMobileScoreToggle) elMobileScoreToggle.setAttribute("aria-expanded", "false");
    if (elActionColumn) elActionColumn.classList.remove("is-open");
    if (elMobileCallsToggle) elMobileCallsToggle.setAttribute("aria-expanded", "false");
    if (elDrawerBackdrop) elDrawerBackdrop.hidden = true;
}

function inicializarEventosMovil() {
    if (elMobileScoreToggle && elScoreColumn) {
        elMobileScoreToggle.addEventListener("click", () => {
            const abrir = !elScoreColumn.classList.contains("is-open");
            cerrarDrawersMovil();
            if (abrir) {
                elScoreColumn.classList.add("is-open");
                elMobileScoreToggle.setAttribute("aria-expanded", "true");
                if (elDrawerBackdrop) elDrawerBackdrop.hidden = false;
            }
        });
    }

    if (elMobileCallsToggle && elActionColumn) {
        elMobileCallsToggle.addEventListener("click", () => {
            const abrir = !elActionColumn.classList.contains("is-open");
            cerrarDrawersMovil();
            if (abrir) {
                elActionColumn.classList.add("is-open");
                elMobileCallsToggle.setAttribute("aria-expanded", "true");
                if (elDrawerBackdrop) elDrawerBackdrop.hidden = false;
            }
        });
    }

    if (elMobileDrawerClose) {
        elMobileDrawerClose.addEventListener("click", cerrarDrawersMovil);
    }

    if (elDrawerBackdrop) {
        elDrawerBackdrop.addEventListener("click", cerrarDrawersMovil);
    }
}

/* ================= UTILIDADES Y GLOBO ================= */
function formatearCarta(carta) {
    return `${NOMBRES_CARTA[carta.valor]} de ${carta.palo}`;
}

function mostrarMensaje(texto) {
    elRoundMessage.textContent = texto || "";
}

function mostrarGloboCarpincho(texto, variante = "truco", duracion = 2800) {
    if (globoTimeout) {
        clearTimeout(globoTimeout);
        globoTimeout = null;
    }
    elCapySpeech.classList.remove("is-envido", "is-truco", "is-reject");
    if (variante) {
        elCapySpeech.classList.add(`is-${variante}`);
    }
    elCapySpeechText.textContent = texto;
    elCapySpeech.hidden = false;
    elCapyWrap.classList.add("is-speaking");

    elCapySpeech.style.animation = "none";
    void elCapySpeech.offsetWidth;
    elCapySpeech.style.animation = "";

    globoTimeout = setTimeout(() => {
        ocultarGloboCarpincho();
    }, duracion);
}

function ocultarGloboCarpincho() {
    if (globoTimeout) {
        clearTimeout(globoTimeout);
        globoTimeout = null;
    }
    elCapySpeech.hidden = true;
    elCapyWrap.classList.remove("is-speaking");
}

function abrirModalEnvido({ ganador, tantosHumano, tantosBot, puntosGanados, cadenaCantos, eraManoHumano }) {
    cerrarDrawersMovil();
    modalEnvidoAbierto = true;
    const ganoHumano = ganador === "A";

    elEnvidoModalCard.classList.remove("is-win", "is-lose");
    elEnvidoModalCard.classList.add(ganoHumano ? "is-win" : "is-lose");

    elEnvidoBoxYou.classList.toggle("is-winner", ganoHumano);
    elEnvidoBoxRival.classList.toggle("is-winner", !ganoHumano);

    const etiquetaCadena = (cadenaCantos || ["ENVIDO"])
        .map(c => NOMBRES_CANTO_ENVIDO[c] || c)
        .join(" · ");
    elEnvidoModalChain.textContent = etiquetaCadena.toUpperCase();

    elEnvidoModalTitle.textContent = ganoHumano
        ? "¡Ganaste el envido!"
        : "Perdiste el envido";

    if (tantosHumano === tantosBot) {
        elEnvidoModalReason.textContent = eraManoHumano
            ? `Empate en ${tantosHumano} · Ganás por ser mano`
            : `Empate en ${tantosHumano} · Gana Carpincho por ser mano`;
    } else {
        elEnvidoModalReason.textContent = ganoHumano
            ? `${tantosHumano} tantos contra ${tantosBot}`
            : `${tantosBot} tantos contra ${tantosHumano}`;
    }

    elEnvidoPointsYou.textContent = tantosHumano;
    elEnvidoPointsRival.textContent = tantosBot;

    const palabraTantos = puntosGanados === 1 ? "tanto" : "tantos";
    elEnvidoModalAward.textContent = ganoHumano
        ? `+${puntosGanados} ${palabraTantos} para vos`
        : `+${puntosGanados} ${palabraTantos} para Carpincho`;

    elEnvidoModal.hidden = false;
    elEnvidoModalClose.focus();
}

function cerrarModalEnvido() {
    if (!modalEnvidoAbierto) return;
    elEnvidoModal.hidden = true;
    modalEnvidoAbierto = false;
    render();
    verificarTurnoBot();
}

elEnvidoModalClose.addEventListener("click", cerrarModalEnvido);
elEnvidoModal.addEventListener("click", (e) => {
    if (e.target === elEnvidoModal) cerrarModalEnvido();
});
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        if (modalEnvidoAbierto) cerrarModalEnvido();
        else if (modalDificultadAbierto && partidaIniciada) {
            modalDificultadAbierto = false;
            elDifficultyModal.hidden = true;
            render();
            verificarTurnoBot();
        } else {
            cerrarDrawersMovil();
        }
    }
});

function sincronizarCartasVisibles() {
    cartasVisiblesHumano = [...juego.obtenerJugador(HUMANO_ID).cartas];
    cartasVisiblesBotCount = juego.obtenerJugador(BOT_ID).cartas.length;
}

function prepararTrackingNuevaRonda() {
    rondaStats = {
        humanoCantoEnvido: false,
        humanoCantoTruco: false,
        cartasInicialesHumano: [...juego.obtenerJugador(HUMANO_ID).cartas]
    };
}

function reiniciarPartida() {
    if (guardarPartidaEnHistorial) {
        guardarPartidaEnHistorial(juego, false);
    }

    cerrarDrawersMovil();
    ocultarGloboCarpincho();
    modalEnvidoAbierto = false;
    elEnvidoModal.hidden = true;
    bloqueadoPorAnimacion = false;

    juego = new JuegoTruco(2, 30);
    juego.dificultad = dificultadActual;
    mesaVisual = [];

    sincronizarCartasVisibles();
    prepararTrackingNuevaRonda();
    actualizarUIBadgesDificultad();

    elRivalStatus.textContent = "Esperando";
    mostrarMensaje("");
    render();

    if (dificultadActual === "muy_dificil" && obtenerPerfilRival) {
        const perfil = obtenerPerfilRival(juego);
        if ((perfil.partidasRecordadas || 0) > 0) {
            mostrarGloboCarpincho("Ya te tengo junado...", "truco", 2200);
        }
    }

    verificarTurnoBot();
}

/* ================= RENDER ANOTADOR ================= */
function generarSVGFosforos(puntos) {
    const boxes = [
        { x: 12, y: 8 },
        { x: 68, y: 8 },
        { x: 124, y: 8 },
        { x: 12, y: 54 },
        { x: 68, y: 54 },
        { x: 124, y: 54 }
    ];
    const size = 34;
    let svgContent = `<line x1="8" y1="48" x2="162" y2="48" stroke="rgba(36,28,20,0.22)" stroke-width="1.2" stroke-dasharray="3 3"/>`;

    boxes.forEach((box, idx) => {
        const count = Math.max(0, Math.min(5, puntos - idx * 5));
        svgContent += `<rect x="${box.x}" y="${box.y}" width="${size}" height="${size}" rx="3" fill="none" stroke="rgba(36,28,20,0.08)" stroke-width="1"/>`;

        const palitos = [
            { x1: box.x, y1: box.y + size, x2: box.x, y2: box.y, hx: box.x, hy: box.y },
            { x1: box.x, y1: box.y, x2: box.x + size, y2: box.y, hx: box.x + size, hy: box.y },
            { x1: box.x + size, y1: box.y, x2: box.x + size, y2: box.y + size, hx: box.x + size, hy: box.y + size },
            { x1: box.x + size, y1: box.y + size, x2: box.x, y2: box.y + size, hx: box.x, hy: box.y + size },
            { x1: box.x + 2, y1: box.y + size - 2, x2: box.x + size - 2, y2: box.y + 2, hx: box.x + size - 2, hy: box.y + 2 }
        ];

        for (let i = 0; i < count; i++) {
            const p = palitos[i];
            svgContent += `<line x1="${p.x1}" y1="${p.y1}" x2="${p.x2}" y2="${p.y2}" stroke="#8a5a2b" stroke-width="3.2" stroke-linecap="round"/>`;
            svgContent += `<circle cx="${p.hx}" cy="${p.hy}" r="2.7" fill="#c8432b"/>`;
        }
    });

    return `<svg viewBox="0 0 170 96" aria-hidden="true">${svgContent}</svg>`;
}

/* ================= RENDER GENERAL ================= */
function render() {
    renderMarcador();
    renderRival();
    renderMesa();
    renderManoHumano();
    renderEstadoTurno();
    renderBotonesCanto();
    renderBotonMazo();
}

function renderMarcador() {
    const ptsA = juego.puntos.A;
    const ptsB = juego.puntos.B;
    const etapaA = ptsA >= 15 ? "BUENAS" : "MALAS";
    const etapaB = ptsB >= 15 ? "BUENAS" : "MALAS";

    elYouScore.textContent = ptsA;
    elYouStage.textContent = etapaA;
    elYouTally.setAttribute("aria-label", `Anotador con ${ptsA} tantos`);
    elYouTally.innerHTML = generarSVGFosforos(ptsA);

    elRivalScore.textContent = ptsB;
    elRivalStage.textContent = etapaB;
    elRivalTally.setAttribute("aria-label", `Anotador con ${ptsB} tantos`);
    elRivalTally.innerHTML = generarSVGFosforos(ptsB);

    if (elMobileYouScore) elMobileYouScore.textContent = ptsA;
    if (elMobileYouStage) elMobileYouStage.textContent = etapaA;
    if (elMobileRivalScore) elMobileRivalScore.textContent = ptsB;
    if (elMobileRivalStage) elMobileRivalStage.textContent = etapaB;
}

function renderRival() {
    elRivalCards.innerHTML = "";
    for (let i = 0; i < cartasVisiblesBotCount; i++) {
        const img = document.createElement("img");
        img.src = `../src/img/assets/card-back-${(i % 3) + 1}.svg`;
        img.alt = "Carta del carpincho";
        elRivalCards.appendChild(img);
    }
}

function renderMesa() {
    elTableCards.innerHTML = "";
    const nombresBaza = ["1ª mano", "2ª mano", "3ª mano"];

    for (let b = 0; b < 3; b++) {
        const par = mesaVisual.slice(b * 2, b * 2 + 2);
        const col = document.createElement("div");
        col.className = "baza-pair";

        const label = document.createElement("span");
        label.className = "baza-label";
        label.textContent = nombresBaza[b];
        col.appendChild(label);

        const jugadaBot = par.find(j => j.jugadorId === BOT_ID);
        const jugadaHumano = par.find(j => j.jugadorId === HUMANO_ID);
        const resultadoBaza = juego.resultadosBazas[b];

        const slotBot = document.createElement("div");
        slotBot.className = "table-card-slot";
        if (jugadaBot) {
            slotBot.classList.add("has-card");
            if (resultadoBaza && resultadoBaza.ganador === "B") {
                slotBot.classList.add("is-baza-winner");
            }
            slotBot.innerHTML = `<img src="../src/img/cards/sobremesa-${jugadaBot.carta.id}.jpg" alt="${formatearCarta(jugadaBot.carta)}">`;
        }

        const slotHumano = document.createElement("div");
        slotHumano.className = "table-card-slot";
        if (jugadaHumano) {
            slotHumano.classList.add("has-card");
            if (resultadoBaza && resultadoBaza.ganador === "A") {
                slotHumano.classList.add("is-baza-winner");
            }
            slotHumano.innerHTML = `<img src="../src/img/cards/sobremesa-${jugadaHumano.carta.id}.jpg" alt="${formatearCarta(jugadaHumano.carta)}">`;
        }

        col.appendChild(slotBot);
        col.appendChild(slotHumano);
        elTableCards.appendChild(col);
    }
}

function renderManoHumano() {
    elHand.innerHTML = "";
    const puedeTirar =
        !estaBloqueadaInteraccion() &&
        !juego.partidaTerminada &&
        !juego.estadoTruco.pendiente &&
        !juego.estadoEnvido.pendiente &&
        juego.obtenerJugadorTurno().id === HUMANO_ID;

    cartasVisiblesHumano.forEach(carta => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "playing-card";
        btn.disabled = !puedeTirar;
        btn.title = formatearCarta(carta);
        btn.innerHTML = `<img src="../src/img/cards/sobremesa-${carta.id}.jpg" alt="${formatearCarta(carta)}">`;
        btn.addEventListener("click", () => onJugarCarta(carta));
        elHand.appendChild(btn);
    });
}

function renderEstadoTurno() {
    const nombresVuelta = ["Primera vuelta", "Segunda vuelta", "Tercera vuelta"];
    const vueltaTxt = nombresVuelta[Math.min(juego.resultadosBazas.length, 2)];
    const manoTxt = juego.obtenerEquipoMano() === "A" ? "sos mano" : "es mano Carpincho";
    elTurnCaption.textContent = `${vueltaTxt} · ${manoTxt}`;

    const valorMano = juego.estadoTruco.nivel + 1;
    elHandValue.textContent = `${valorMano} ${valorMano === 1 ? "tanto" : "tantos"}`;

    const requiereRespuestaHumana =
        (juego.estadoEnvido.pendiente && juego.estadoEnvido.equipoQueDebeResponder === "A") ||
        (juego.estadoTruco.pendiente && juego.estadoTruco.equipoQueDebeResponder === "A");

    elActionColumn.classList.toggle("is-urgent", requiereRespuestaHumana && !juego.partidaTerminada);

    if (juego.partidaTerminada) {
        elTurnTitle.textContent = juego.ganadorPartida === "A" ? "¡Ganaste la partida!" : "Ganó Carpincho";
        elTurnCaption.textContent = `Resultado final: ${juego.puntos.A} a ${juego.puntos.B}`;
        return;
    }

    if (juego.estadoEnvido.pendiente && juego.estadoEnvido.equipoQueDebeResponder === "A") {
        elTurnTitle.textContent = "Respondé el envido";
    } else if (juego.estadoTruco.pendiente && juego.estadoTruco.equipoQueDebeResponder === "A") {
        elTurnTitle.textContent = "Respondé el truco";
    } else if (juego.obtenerJugadorTurno().id === HUMANO_ID && !estaBloqueadaInteraccion()) {
        elTurnTitle.textContent = "Es tu turno";
    } else {
        elTurnTitle.textContent = "Turno de Carpincho";
    }
}

function crearBotonCanto({ titulo, subtitulo, variante, icono, habilitado, onClick }) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `call-button ${habilitado ? variante : "call-muted"}`;
    btn.disabled = !habilitado || estaBloqueadaInteraccion() || juego.partidaTerminada;
    const iconSrc = habilitado ? `../src/img/assets/${icono}` : "../src/img/assets/icon-disabled.svg";
    btn.innerHTML = `<span><strong>${titulo}</strong><small>${subtitulo}</small></span><img src="${iconSrc}" alt="">`;
    if (habilitado && onClick) {
        btn.addEventListener("click", () => {
            cerrarDrawersMovil();
            onClick();
        });
    }
    return btn;
}

function actualizarBotonRapidoMovil(config) {
    if (!elMobileQuickAction) return;
    if (!config || estaBloqueadaInteraccion()) {
        elMobileQuickAction.hidden = true;
        elMobileQuickAction.onclick = null;
        return;
    }
    elMobileQuickAction.hidden = false;
    elMobileQuickAction.textContent = config.texto;
    elMobileQuickAction.className = `mobile-quick-btn ${config.clase || ""}`.trim();
    elMobileQuickAction.onclick = () => {
        cerrarDrawersMovil();
        config.onClick();
    };
}

function renderBotonesCanto() {
    elCalls.innerHTML = "";

    if (juego.partidaTerminada) {
        if (elMobileCallsToggleLabel) elMobileCallsToggleLabel.textContent = "Opciones";
        actualizarBotonRapidoMovil({
            texto: "Jugar de nuevo",
            clase: "is-green",
            onClick: reiniciarPartida
        });
        elCalls.insertAdjacentHTML("beforeend", `<p class="section-kicker">PARTIDA FINALIZADA</p>`);
        const btnReset = document.createElement("button");
        btnReset.type = "button";
        btnReset.className = "call-button call-green";
        btnReset.innerHTML = `<span><strong>Jugar de nuevo</strong><small>Arrancar una mesa nueva a 30</small></span><img src="../src/img/assets/icon-truco.svg" alt="">`;
        btnReset.addEventListener("click", () => {
            cerrarDrawersMovil();
            reiniciarPartida();
        });
        elCalls.appendChild(btnReset);
        return;
    }

    const esTurnoHumano = juego.obtenerJugadorTurno().id === HUMANO_ID;

    if (juego.estadoEnvido.pendiente && juego.estadoEnvido.equipoQueDebeResponder === "A") {
        if (elMobileCallsToggleLabel) elMobileCallsToggleLabel.textContent = "Responder";
        actualizarBotonRapidoMovil({
            texto: "Quiero",
            clase: "is-gold",
            onClick: () => onResponderEnvido("aceptar")
        });

        const cantos = juego.estadoEnvido.cantos;
        elCalls.insertAdjacentHTML("beforeend", `<p class="section-kicker">RESPUESTA DE ENVIDO</p>`);
        elCalls.appendChild(crearBotonCanto({
            titulo: "Quiero",
            subtitulo: "Aceptar y cantar tantos",
            variante: "call-gold",
            icono: "icon-envido.svg",
            habilitado: true,
            onClick: () => onResponderEnvido("aceptar")
        }));
        elCalls.appendChild(crearBotonCanto({
            titulo: "No quiero",
            subtitulo: "Ceder los tantos",
            variante: "call-green",
            icono: "icon-flag.svg",
            habilitado: true,
            onClick: () => onResponderEnvido("rechazar")
        }));
        const subidas = [
            { tipo: "ENVIDO", titulo: "Envido", sub: "Subir la apuesta" },
            { tipo: "REAL_ENVIDO", titulo: "Real envido", sub: "Sumar 3 tantos" },
            { tipo: "FALTA_ENVIDO", titulo: "Falta envido", sub: "Por lo que falta" }
        ];
        subidas.forEach(s => {
            if (esCantoEnvidoValido(cantos, s.tipo)) {
                elCalls.appendChild(crearBotonCanto({
                    titulo: s.titulo,
                    subtitulo: s.sub,
                    variante: "call-gold",
                    icono: "icon-envido.svg",
                    habilitado: true,
                    onClick: () => onResponderEnvido("subir", s.tipo)
                }));
            }
        });
        return;
    }

    if (juego.estadoTruco.pendiente && juego.estadoTruco.equipoQueDebeResponder === "A") {
        if (elMobileCallsToggleLabel) elMobileCallsToggleLabel.textContent = "Responder";
        actualizarBotonRapidoMovil({
            texto: "Quiero",
            clase: "is-green",
            onClick: () => onResponderTruco("aceptar")
        });

        const nivel = juego.estadoTruco.nivel;
        const nombresSubida = { 1: "Quiero retruco", 2: "Quiero vale cuatro" };
        elCalls.insertAdjacentHTML("beforeend", `<p class="section-kicker">RESPUESTA DE TRUCO</p>`);
        elCalls.appendChild(crearBotonCanto({
            titulo: "Quiero",
            subtitulo: `Jugar por ${nivel + 1} tantos`,
            variante: "call-green",
            icono: "icon-truco.svg",
            habilitado: true,
            onClick: () => onResponderTruco("aceptar")
        }));
        elCalls.appendChild(crearBotonCanto({
            titulo: "No quiero",
            subtitulo: `Ceder ${nivel} ${nivel === 1 ? "tanto" : "tantos"}`,
            variante: "call-gold",
            icono: "icon-flag.svg",
            habilitado: true,
            onClick: () => onResponderTruco("rechazar")
        }));
        if (nivel < 3) {
            elCalls.appendChild(crearBotonCanto({
                titulo: nombresSubida[nivel],
                subtitulo: `Subir el valor a ${nivel + 2}`,
                variante: "call-green",
                icono: "icon-truco.svg",
                habilitado: true,
                onClick: () => onResponderTruco("subir")
            }));
        }
        if (nivel === 1 && juego.resultadosBazas.length === 0 && !juego.estadoEnvido.jugado) {
            elCalls.insertAdjacentHTML("beforeend", `<p class="section-kicker trick-kicker">EL ENVIDO ESTÁ PRIMERO</p>`);
            elCalls.appendChild(crearBotonCanto({
                titulo: "Envido",
                subtitulo: "Cantar envido primero",
                variante: "call-gold",
                icono: "icon-envido.svg",
                habilitado: true,
                onClick: () => onCantarEnvido("ENVIDO")
            }));
            elCalls.appendChild(crearBotonCanto({
                titulo: "Real envido",
                subtitulo: "Cantar real primero",
                variante: "call-gold",
                icono: "icon-envido.svg",
                habilitado: true,
                onClick: () => onCantarEnvido("REAL_ENVIDO")
            }));
            elCalls.appendChild(crearBotonCanto({
                titulo: "Falta envido",
                subtitulo: "Por lo que falta",
                variante: "call-gold",
                icono: "icon-envido.svg",
                habilitado: true,
                onClick: () => onCantarEnvido("FALTA_ENVIDO")
            }));
        }
        return;
    }

    if (elMobileCallsToggleLabel) elMobileCallsToggleLabel.textContent = "Cantos";

    const puedeCantarEnvido =
        esTurnoHumano &&
        juego.resultadosBazas.length === 0 &&
        !juego.estadoEnvido.jugado &&
        !juego.estadoEnvido.pendiente &&
        !juego.estadoTruco.pendiente;

    const puedeSubirTruco =
        esTurnoHumano &&
        !juego.estadoTruco.pendiente &&
        !juego.estadoEnvido.pendiente &&
        (juego.estadoTruco.nivel === 0 || juego.estadoTruco.equipoQuePuedeSubir === "A");

    if (puedeSubirTruco && juego.estadoTruco.nivel === 0) {
        actualizarBotonRapidoMovil({
            texto: "Truco",
            clase: "is-green",
            onClick: () => onCantarTruco()
        });
    } else if (puedeCantarEnvido) {
        actualizarBotonRapidoMovil({
            texto: "Envido",
            clase: "is-gold",
            onClick: () => onCantarEnvido("ENVIDO")
        });
    } else {
        actualizarBotonRapidoMovil(null);
    }

    elCalls.insertAdjacentHTML("beforeend", `<p class="section-kicker">POR LOS TANTOS</p>`);
    elCalls.appendChild(crearBotonCanto({
        titulo: "Envido",
        subtitulo: "Vale 2 si quiere",
        variante: "call-gold",
        icono: "icon-envido.svg",
        habilitado: puedeCantarEnvido,
        onClick: () => onCantarEnvido("ENVIDO")
    }));
    elCalls.appendChild(crearBotonCanto({
        titulo: "Real envido",
        subtitulo: "Vale 3 si quiere",
        variante: "call-gold",
        icono: "icon-envido.svg",
        habilitado: puedeCantarEnvido,
        onClick: () => onCantarEnvido("REAL_ENVIDO")
    }));
    elCalls.appendChild(crearBotonCanto({
        titulo: "Falta envido",
        subtitulo: "Por lo que falta",
        variante: "call-gold",
        icono: "icon-envido.svg",
        habilitado: puedeCantarEnvido,
        onClick: () => onCantarEnvido("FALTA_ENVIDO")
    }));

    elCalls.insertAdjacentHTML("beforeend", `<p class="section-kicker trick-kicker">POR LA MANO</p>`);
    elCalls.appendChild(crearBotonCanto({
        titulo: "Truco",
        subtitulo: "Subí el valor a 2",
        variante: "call-green",
        icono: "icon-truco.svg",
        habilitado: puedeSubirTruco && juego.estadoTruco.nivel === 0,
        onClick: () => onCantarTruco()
    }));
    elCalls.appendChild(crearBotonCanto({
        titulo: "Retruco",
        subtitulo: "Subí el valor a 3",
        variante: "call-green",
        icono: "icon-truco.svg",
        habilitado: puedeSubirTruco && juego.estadoTruco.nivel === 1,
        onClick: () => onCantarTruco()
    }));
    elCalls.appendChild(crearBotonCanto({
        titulo: "Vale cuatro",
        subtitulo: "Subí el valor a 4",
        variante: "call-green",
        icono: "icon-truco.svg",
        habilitado: puedeSubirTruco && juego.estadoTruco.nivel === 2,
        onClick: () => onCantarTruco()
    }));
}

function renderBotonMazo() {
    let costoMazo = juego.estadoTruco.pendiente
        ? juego.estadoTruco.nivel
        : juego.estadoTruco.nivel + 1;
    if (juego.resultadosBazas.length === 0 && !juego.estadoEnvido.jugado && !juego.estadoEnvido.pendiente) {
        costoMazo += 1;
    }
    elFoldButton.innerHTML = `<span><img src="../src/img/assets/icon-flag.svg" alt="">Irse al mazo</span><small>Cedés la mano · <b>${costoMazo}</b> ${costoMazo === 1 ? "tanto" : "tantos"}</small>`;
    elFoldButton.disabled = estaBloqueadaInteraccion() || juego.partidaTerminada || juego.estadoEnvido.pendiente;
}

/* ================= ACCIONES DEL JUGADOR ================= */
function onJugarCarta(carta) {
    const res = juego.jugarCarta(HUMANO_ID, carta.id);
    if (res.error) return;
    mesaVisual.push({ jugadorId: HUMANO_ID, carta });
    if (res.rondaTerminada) {
        cartasVisiblesHumano = cartasVisiblesHumano.filter(c => c.id !== carta.id);
        cerrarRondaVisual(res.ganadorRonda, res.puntosGanados);
        return;
    }
    sincronizarCartasVisibles();
    render();
    verificarTurnoBot();
}

function onCantarTruco() {
    const res = juego.cantarTruco(HUMANO_ID);
    if (res.error) return;
    rondaStats.humanoCantoTruco = true;
    registrarAprendizajeRival(juego, { tipo: "RIVAL_CANTO_TRUCO" });
    const nombres = { 1: "¡Truco!", 2: "¡Retruco!", 3: "¡Vale cuatro!" };
    mostrarMensaje(`Cantaste ${nombres[juego.estadoTruco.nivel]}`);
    render();
    verificarTurnoBot();
}

function onResponderTruco(accion) {
    registrarAprendizajeRival(juego, { tipo: "RIVAL_RESPONDIO_TRUCO", accion });
    if (accion === "subir") {
        rondaStats.humanoCantoTruco = true;
    }
    const res = juego.responderTruco(HUMANO_ID, accion);
    if (res.error) return;
    if (accion === "rechazar") {
        cerrarRondaVisual(res.ganadorRonda, res.puntosGanados, "Dijiste no quiero");
        return;
    }
    mostrarMensaje(accion === "aceptar" ? "Dijiste quiero" : "Subiste el canto");
    render();
    verificarTurnoBot();
}

function onCantarEnvido(tipoCanto) {
    const res = juego.cantarEnvido(HUMANO_ID, tipoCanto);
    if (res.error) return;
    rondaStats.humanoCantoEnvido = true;
    registrarAprendizajeRival(juego, { tipo: "RIVAL_CANTO_ENVIDO" });
    const sufijo = juego.trucoEnSuspenso ? " (está primero)" : "";
    mostrarMensaje(`Cantaste ${NOMBRES_CANTO_ENVIDO[tipoCanto]}${sufijo}`);
    render();
    verificarTurnoBot();
}

function onResponderEnvido(accion, nuevoCanto = null) {
    const cadenaCantos = [...juego.estadoEnvido.cantos];
    const eraManoHumano = juego.obtenerEquipoMano() === "A";
    const tantosHumano = calcularEnvido(juego.obtenerCartasInicialesJugador(HUMANO_ID));
    const tantosBot = calcularEnvido(juego.obtenerCartasInicialesJugador(BOT_ID));
    registrarAprendizajeRival(juego, { tipo: "RIVAL_RESPONDIO_ENVIDO", accion });
    if (accion === "subir") {
        rondaStats.humanoCantoEnvido = true;
    }
    const res = juego.responderEnvido(HUMANO_ID, accion, nuevoCanto);
    if (res.error) return;
    if (!res.envidoResuelto) {
        mostrarMensaje(`Subiste a ${NOMBRES_CANTO_ENVIDO[nuevoCanto]}`);
        render();
        verificarTurnoBot();
    } else if (accion === "rechazar") {
        if (juego.partidaTerminada && guardarPartidaEnHistorial) {
            guardarPartidaEnHistorial(juego, true);
        }
        elRivalStatus.textContent = `Sumó ${res.puntosGanados} pt`;
        mostrarMensaje(`No quisiste · Carpincho suma ${res.puntosGanados}`);
        render();
        verificarTurnoBot();
    } else {
        registrarAprendizajeRival(juego, {
            tipo: "SHOWDOWN_ENVIDO",
            cantoRival: rondaStats.humanoCantoEnvido,
            tantosRival: tantosHumano
        });
        if (juego.partidaTerminada && guardarPartidaEnHistorial) {
            guardarPartidaEnHistorial(juego, true);
        }
        const quien = res.ganador === "A" ? "Ganaste el envido" : "Ganó Carpincho";
        elRivalStatus.textContent = `${tantosBot} de envido`;
        mostrarMensaje(`Vos: ${tantosHumano} · Carpincho: ${tantosBot} · ${quien} (+${res.puntosGanados})`);
        render();
        abrirModalEnvido({
            ganador: res.ganador,
            tantosHumano,
            tantosBot,
            puntosGanados: res.puntosGanados,
            cadenaCantos,
            eraManoHumano
        });
    }
}

elFoldButton.addEventListener("click", () => {
    cerrarDrawersMovil();
    registrarAprendizajeRival(juego, { tipo: "RIVAL_AL_MAZO" });
    const res = juego.irseAlMazo(HUMANO_ID);
    if (res.error) return;
    cerrarRondaVisual(res.ganadorRonda, res.puntosGanados, "Te fuiste al mazo");
});

/* ================= TURNO DEL BOT ================= */
function verificarTurnoBot() {
    if (juego.partidaTerminada || modalEnvidoAbierto || modalDificultadAbierto) return;
    const debeResponderBot =
        (juego.estadoEnvido.pendiente && juego.estadoEnvido.equipoQueDebeResponder === "B") ||
        (juego.estadoTruco.pendiente && juego.estadoTruco.equipoQueDebeResponder === "B");
    const esTurnoBot =
        !juego.estadoEnvido.pendiente &&
        !juego.estadoTruco.pendiente &&
        juego.obtenerJugadorTurno().id === BOT_ID;
    if (!debeResponderBot && !esTurnoBot) return;
    bloqueadoPorAnimacion = true;
    elRivalStatus.textContent = "Pensando...";
    render();

    setTimeout(() => {
        bloqueadoPorAnimacion = false;
        const bot = juego.obtenerJugador(BOT_ID);
        const tantosHumano = calcularEnvido(juego.obtenerCartasInicialesJugador(HUMANO_ID));
        const tantosBot = calcularEnvido(juego.obtenerCartasInicialesJugador(BOT_ID));
        const cartasBotAntes = [...bot.cartas];
        const cadenaCantosAntes = [...juego.estadoEnvido.cantos];
        const eraManoHumano = juego.obtenerEquipoMano() === "A";
        const ejecucion = ejecutarTurnoBot(juego, BOT_ID);
        if (!ejecucion) {
            render();
            return;
        }
        const { decision, resultado } = ejecucion;
        if (decision.tipo === "JUGAR_CARTA") {
            const cartaTirada = cartasBotAntes.find(c => c.id === decision.cartaId);
            if (cartaTirada) {
                mesaVisual.push({ jugadorId: BOT_ID, carta: cartaTirada });
            }
            elRivalStatus.textContent = `Jugó ${formatearCarta(cartaTirada)}`;
            if (resultado.rondaTerminada) {
                cartasVisiblesBotCount = Math.max(0, cartasVisiblesBotCount - 1);
                cerrarRondaVisual(resultado.ganadorRonda, resultado.puntosGanados);
                return;
            }
        } else if (decision.tipo === "CANTAR_ENVIDO") {
            const txt = NOMBRES_CANTO_ENVIDO[decision.tipoCanto];
            elRivalStatus.textContent = `¡${txt}!`;
            mostrarGloboCarpincho(`¡${txt}!`, "envido");
            mostrarMensaje(`Carpincho cantó ${txt}`);
        } else if (decision.tipo === "RESPONDER_ENVIDO") {
            if (decision.accion === "aceptar") {
                registrarAprendizajeRival(juego, {
                    tipo: "SHOWDOWN_ENVIDO",
                    cantoRival: rondaStats.humanoCantoEnvido,
                    tantosRival: tantosHumano
                });
                if (juego.partidaTerminada && guardarPartidaEnHistorial) {
                    guardarPartidaEnHistorial(juego, true);
                }
                const quien = resultado.ganador === "A" ? "Ganaste vos" : "Ganó Carpincho";
                elRivalStatus.textContent = `Quiero (${tantosBot})`;
                mostrarGloboCarpincho("¡Quiero!", "envido");
                mostrarMensaje(`Quiero · Vos: ${tantosHumano} · Carpincho: ${tantosBot} · ${quien} (+${resultado.puntosGanados})`);
                sincronizarCartasVisibles();
                render();
                abrirModalEnvido({
                    ganador: resultado.ganador,
                    tantosHumano,
                    tantosBot,
                    puntosGanados: resultado.puntosGanados,
                    cadenaCantos: cadenaCantosAntes,
                    eraManoHumano
                });
                return;
            } else if (decision.accion === "rechazar") {
                if (juego.partidaTerminada && guardarPartidaEnHistorial) {
                    guardarPartidaEnHistorial(juego, true);
                }
                elRivalStatus.textContent = "No quiero";
                mostrarGloboCarpincho("No quiero", "reject");
                mostrarMensaje(`Carpincho no quiso (+${resultado.puntosGanados})`);
                bloqueadoPorAnimacion = true;
                sincronizarCartasVisibles();
                render();
                setTimeout(() => {
                    bloqueadoPorAnimacion = false;
                    render();
                    verificarTurnoBot();
                }, 1150);
                return;
            } else {
                const txt = NOMBRES_CANTO_ENVIDO[decision.nuevoCanto];
                elRivalStatus.textContent = `¡${txt}!`;
                mostrarGloboCarpincho(`¡${txt}!`, "envido");
                mostrarMensaje(`Carpincho subió a ${txt}`);
            }
        } else if (decision.tipo === "CANTAR_TRUCO") {
            const nombres = { 1: "¡Truco!", 2: "¡Retruco!", 3: "¡Vale cuatro!" };
            const frase = nombres[juego.estadoTruco.nivel];
            elRivalStatus.textContent = frase;
            mostrarGloboCarpincho(frase, "truco");
            mostrarMensaje(`Carpincho cantó ${frase}`);
        } else if (decision.tipo === "RESPONDER_TRUCO") {
            if (decision.accion === "rechazar") {
                elRivalStatus.textContent = "No quiero";
                mostrarGloboCarpincho("No quiero", "reject");
                cerrarRondaVisual(resultado.ganadorRonda, resultado.puntosGanados, "Carpincho no quiso");
                return;
            } else if (decision.accion === "aceptar") {
                elRivalStatus.textContent = "¡Quiero!";
                mostrarGloboCarpincho("¡Quiero!", "truco");
                mostrarMensaje("Carpincho aceptó el truco");
            } else {
                const nombres = { 2: "¡Quiero retruco!", 3: "¡Quiero vale cuatro!" };
                const frase = nombres[juego.estadoTruco.nivel];
                elRivalStatus.textContent = frase;
                mostrarGloboCarpincho(frase, "truco");
                mostrarMensaje(`Carpincho dijo ${frase}`);
            }
        } else if (decision.tipo === "IRSE_AL_MAZO") {
            elRivalStatus.textContent = "Me voy al mazo";
            mostrarGloboCarpincho("Me voy al mazo", "reject");
            cerrarRondaVisual(resultado.ganadorRonda, resultado.puntosGanados, "Carpincho se fue al mazo");
            return;
        }
        sincronizarCartasVisibles();
        render();
        verificarTurnoBot();
    }, 750);
}

function cerrarRondaVisual(ganadorEquipo, puntos, motivo = "") {
    if (rondaStats.humanoCantoTruco && !motivo) {
        registrarAprendizajeRival(juego, {
            tipo: "SHOWDOWN_TRUCO",
            cantoRival: true,
            cartasRival: rondaStats.cartasInicialesHumano
        });
    }
    if (juego.partidaTerminada && guardarPartidaEnHistorial) {
        guardarPartidaEnHistorial(juego, true);
    }

    bloqueadoPorAnimacion = true;
    const textoGanador = ganadorEquipo === "A" ? "Ganaste la mano" : "Carpincho ganó la mano";
    const prefijo = motivo ? `${motivo} · ` : "";
    mostrarMensaje(`${prefijo}${textoGanador} (+${puntos} ${puntos === 1 ? "tanto" : "tantos"})`);
    render();
    setTimeout(() => {
        bloqueadoPorAnimacion = false;
        mesaVisual = [];
        sincronizarCartasVisibles();
        prepararTrackingNuevaRonda();
        if (!juego.partidaTerminada) {
            elRivalStatus.textContent = "Esperando";
            mostrarMensaje("");
        }
        render();
        verificarTurnoBot();
    }, 1850);
}

inicializarEventosDificultad();
inicializarEventosMovil();
actualizarUIBadgesDificultad();
marcarOpcionModal(dificultadActual);
render();