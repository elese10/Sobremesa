const { JuegoTruco } = window.TrucoGame;
const { esCantoEnvidoValido, calcularEnvido } = window.TrucoRules;
const { ejecutarTurnoBot } = window.TrucoBot;
const HUMANO_ID = "j1";
const BOT_ID = "j2";
let juego = new JuegoTruco(2, 30);
let bloqueadoPorAnimacion = false;
let mesaVisual = [];
let cartasVisiblesHumano = [...juego.obtenerJugador(HUMANO_ID).cartas];
let cartasVisiblesBotCount = juego.obtenerJugador(BOT_ID).cartas.length;

const elYouScore = document.getElementById("you-score");
const elYouStage = document.getElementById("you-stage");
const elYouTally = document.getElementById("you-tally");
const elRivalScore = document.getElementById("rival-score");
const elRivalStage = document.getElementById("rival-stage");
const elRivalTally = document.getElementById("rival-tally");
const elRivalStatus = document.getElementById("rival-status");
const elRivalCards = document.querySelector(".rival-cards");
const elTableCards = document.getElementById("table-cards");
const elHand = document.querySelector(".hand");
const elTurnTitle = document.getElementById("turn-title");
const elTurnCaption = document.getElementById("turn-caption");
const elHandValue = document.getElementById("hand-value");
const elCalls = document.querySelector(".calls");
const elFoldButton = document.querySelector(".fold-button");
const elRoundMessage = document.getElementById("round-message");
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

function formatearCarta(carta) {
    return `${NOMBRES_CARTA[carta.valor]} de ${carta.palo}`;
}

function mostrarMensaje(texto) {
    elRoundMessage.textContent = texto || "";
}

function sincronizarCartasVisibles() {
    cartasVisiblesHumano = [...juego.obtenerJugador(HUMANO_ID).cartas];
    cartasVisiblesBotCount = juego.obtenerJugador(BOT_ID).cartas.length;
}

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
    elYouScore.textContent = ptsA;
    elYouStage.textContent = ptsA >= 15 ? "BUENAS" : "MALAS";
    elYouTally.alt = `Anotador con ${ptsA} tantos`;
    elRivalScore.textContent = ptsB;
    elRivalStage.textContent = ptsB >= 15 ? "BUENAS" : "MALAS";
    elRivalTally.alt = `Anotador con ${ptsB} tantos`;
}

function renderRival() {
    elRivalCards.innerHTML = "";
    for (let i = 0; i < cartasVisiblesBotCount; i++) {
        const img = document.createElement("img");
        img.src = `../src/img/assets/card-back-${i + 1}.svg`;
        img.alt = "Carta del carpincho";
        elRivalCards.appendChild(img);
    }
}

function renderMesa() {
    elTableCards.innerHTML = "";
    const bazas = [];
    for (let i = 0; i < mesaVisual.length; i += 2) {
        bazas.push(mesaVisual.slice(i, i + 2));
    }
    bazas.forEach(par => {
        const col = document.createElement("div");
        col.className = "baza-pair";
        const jugadaBot = par.find(j => j.jugadorId === BOT_ID);
        const jugadaHumano = par.find(j => j.jugadorId === HUMANO_ID);
        const slotBot = document.createElement("div");
        slotBot.className = "table-card-slot";
        if (jugadaBot) {
            slotBot.innerHTML = `<img src="../src/img/cards/sobremesa-${jugadaBot.carta.id}.jpg" alt="${formatearCarta(jugadaBot.carta)}">`;
        }
        const slotHumano = document.createElement("div");
        slotHumano.className = "table-card-slot";
        if (jugadaHumano) {
            slotHumano.innerHTML = `<img src="../src/img/cards/sobremesa-${jugadaHumano.carta.id}.jpg" alt="${formatearCarta(jugadaHumano.carta)}">`;
        }
        col.appendChild(slotBot);
        col.appendChild(slotHumano);
        elTableCards.appendChild(col);
    });
}

function renderManoHumano() {
    elHand.innerHTML = "";
    const puedeTirar =
        !bloqueadoPorAnimacion &&
        !juego.partidaTerminada &&
        !juego.estadoTruco.pendiente &&
        !juego.estadoEnvido.pendiente &&
        juego.obtenerJugadorTurno().id === HUMANO_ID;
    cartasVisiblesHumano.forEach(carta => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "playing-card";
        btn.disabled = !puedeTirar;
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
    const valorMano = juego.estadoTruco.nivel === 0 ? 1 : juego.estadoTruco.nivel;
    elHandValue.textContent = `${valorMano} ${valorMano === 1 ? "tanto" : "tantos"}`;
    if (juego.partidaTerminada) {
        elTurnTitle.textContent = juego.ganadorPartida === "A" ? "¡Ganaste la partida!" : "Ganó Carpincho";
        return;
    }
    if (juego.estadoEnvido.pendiente && juego.estadoEnvido.equipoQueDebeResponder === "A") {
        elTurnTitle.textContent = "Respondé el envido";
    } else if (juego.estadoTruco.pendiente && juego.estadoTruco.equipoQueDebeResponder === "A") {
        elTurnTitle.textContent = "Respondé el truco";
    } else if (juego.obtenerJugadorTurno().id === HUMANO_ID && !bloqueadoPorAnimacion) {
        elTurnTitle.textContent = "Es tu turno";
    } else {
        elTurnTitle.textContent = "Turno de Carpincho";
    }
}

function crearBotonCanto({ titulo, subtitulo, variante, icono, habilitado, onClick }) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `call-button ${habilitado ? variante : "call-muted"}`;
    btn.disabled = !habilitado || bloqueadoPorAnimacion || juego.partidaTerminada;
    const iconSrc = habilitado ? `../src/img/assets/${icono}` : "../src/img/assets/icon-disabled.svg";
    btn.innerHTML = `<span><strong>${titulo}</strong><small>${subtitulo}</small></span><img src="${iconSrc}" alt="">`;
    if (habilitado && onClick) {
        btn.addEventListener("click", onClick);
    }
    return btn;
}

function renderBotonesCanto() {
    elCalls.innerHTML = "";
    const esTurnoHumano = juego.obtenerJugadorTurno().id === HUMANO_ID;
    if (juego.estadoEnvido.pendiente && juego.estadoEnvido.equipoQueDebeResponder === "A") {
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
        }
        return;
    }

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
        subtitulo: "Subí el valor de la mano a 2",
        variante: "call-green",
        icono: "icon-truco.svg",
        habilitado: puedeSubirTruco && juego.estadoTruco.nivel === 0,
        onClick: () => onCantarTruco()
    }));
    elCalls.appendChild(crearBotonCanto({
        titulo: "Retruco",
        subtitulo: "Subí el valor de la mano a 3",
        variante: "call-green",
        icono: "icon-truco.svg",
        habilitado: puedeSubirTruco && juego.estadoTruco.nivel === 1,
        onClick: () => onCantarTruco()
    }));
    elCalls.appendChild(crearBotonCanto({
        titulo: "Vale cuatro",
        subtitulo: "Subí el valor de la mano a 4",
        variante: "call-green",
        icono: "icon-truco.svg",
        habilitado: puedeSubirTruco && juego.estadoTruco.nivel === 2,
        onClick: () => onCantarTruco()
    }));
}

function renderBotonMazo() {
    let costoMazo = juego.estadoTruco.nivel === 0 ? 1 : juego.estadoTruco.nivel;
    if (juego.resultadosBazas.length === 0 && !juego.estadoEnvido.jugado && !juego.estadoEnvido.pendiente) {
        costoMazo += 1;
    }
    elFoldButton.innerHTML = `<span><img src="../src/img/assets/icon-flag.svg" alt="">Irse al mazo</span><small>Cedés la mano · <b>${costoMazo}</b> ${costoMazo === 1 ? "tanto" : "tantos"}</small>`;
    elFoldButton.disabled = bloqueadoPorAnimacion || juego.partidaTerminada || juego.estadoEnvido.pendiente;
}

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
    const nombres = { 1: "¡Truco!", 2: "¡Retruco!", 3: "¡Vale cuatro!" };
    mostrarMensaje(`Cantaste ${nombres[juego.estadoTruco.nivel]}`);
    render();
    verificarTurnoBot();
}

function onResponderTruco(accion) {
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
    const etiquetas = { ENVIDO: "Envido", REAL_ENVIDO: "Real Envido", FALTA_ENVIDO: "Falta Envido" };
    mostrarMensaje(`Cantaste ${etiquetas[tipoCanto]}`);
    render();
    verificarTurnoBot();
}

function onResponderEnvido(accion, nuevoCanto = null) {
    const tantosHumano = calcularEnvido(juego.obtenerJugador(HUMANO_ID).cartas);
    const tantosBot = calcularEnvido(juego.obtenerJugador(BOT_ID).cartas);
    const res = juego.responderEnvido(HUMANO_ID, accion, nuevoCanto);
    if (res.error) return;
    if (!res.envidoResuelto) {
        mostrarMensaje(`Subiste a ${nuevoCanto.replace("_", " ")}`);
    } else if (accion === "rechazar") {
        elRivalStatus.textContent = `Sumó ${res.puntosGanados} pt`;
        mostrarMensaje(`No quisiste · Carpincho suma ${res.puntosGanados}`);
    } else {
        const quien = res.ganador === "A" ? "Ganaste el envido" : "Ganó Carpincho";
        elRivalStatus.textContent = `${tantosBot} de envido`;
        mostrarMensaje(`Vos: ${tantosHumano} · Carpincho: ${tantosBot} · ${quien} (+${res.puntosGanados})`);
    }
    render();
    verificarTurnoBot();
}

elFoldButton.addEventListener("click", () => {
    const res = juego.irseAlMazo(HUMANO_ID);
    if (res.error) return;
    cerrarRondaVisual(res.ganadorRonda, res.puntosGanados, "Te fuiste al mazo");
});

function verificarTurnoBot() {
    if (juego.partidaTerminada) return;
    const debeResponderBot =
        (juego.estadoEnvido.pendiente && juego.estadoEnvido.equipoQueDebeResponder === BOT_ID.replace("j2", "B")) ||
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
        const tantosHumano = calcularEnvido(juego.obtenerJugador(HUMANO_ID).cartas);
        const tantosBot = calcularEnvido(bot.cartas);
        const cartasBotAntes = [...bot.cartas];

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
            const txt = decision.tipoCanto.replace("_", " ");
            elRivalStatus.textContent = `¡${txt}!`;
            mostrarMensaje(`Carpincho cantó ${txt}`);
        } else if (decision.tipo === "RESPONDER_ENVIDO") {
            if (decision.accion === "aceptar") {
                const quien = resultado.ganador === "A" ? "Ganaste vos" : "Ganó Carpincho";
                elRivalStatus.textContent = `Quiero (${tantosBot})`;
                mostrarMensaje(`Quiero · Vos: ${tantosHumano} · Carpincho: ${tantosBot} · ${quien} (+${resultado.puntosGanados})`);
            } else if (decision.accion === "rechazar") {
                elRivalStatus.textContent = "No quiero";
                mostrarMensaje(`Carpincho no quiso (+${resultado.puntosGanados})`);
            } else {
                const txt = decision.nuevoCanto.replace("_", " ");
                elRivalStatus.textContent = `¡${txt}!`;
                mostrarMensaje(`Carpincho subió a ${txt}`);
            }
        } else if (decision.tipo === "CANTAR_TRUCO") {
            const nombres = { 1: "¡Truco!", 2: "¡Retruco!", 3: "¡Vale cuatro!" };
            elRivalStatus.textContent = nombres[juego.estadoTruco.nivel];
            mostrarMensaje(`Carpincho cantó ${nombres[juego.estadoTruco.nivel]}`);
        } else if (decision.tipo === "RESPONDER_TRUCO") {
            if (decision.accion === "rechazar") {
                elRivalStatus.textContent = "No quiero";
                cerrarRondaVisual(resultado.ganadorRonda, resultado.puntosGanados, "Carpincho no quiso");
                return;
            } else if (decision.accion === "aceptar") {
                elRivalStatus.textContent = "¡Quiero!";
                mostrarMensaje("Carpincho aceptó el truco");
            } else {
                const nombres = { 2: "¡Quiero retruco!", 3: "¡Quiero vale cuatro!" };
                elRivalStatus.textContent = nombres[juego.estadoTruco.nivel];
                mostrarMensaje(`Carpincho dijo ${nombres[juego.estadoTruco.nivel]}`);
            }
        } else if (decision.tipo === "IRSE_AL_MAZO") {
            elRivalStatus.textContent = "Me voy al mazo";
            cerrarRondaVisual(resultado.ganadorRonda, resultado.puntosGanados, "Carpincho se fue al mazo");
            return;
        }
        sincronizarCartasVisibles();
        render();
        verificarTurnoBot();
    }, 750);
}

function cerrarRondaVisual(ganadorEquipo, puntos, motivo = "") {
    bloqueadoPorAnimacion = true;
    const textoGanador = ganadorEquipo === "A" ? "Ganaste la mano" : "Carpincho ganó la mano";
    const prefijo = motivo ? `${motivo} · ` : "";
    mostrarMensaje(`${prefijo}${textoGanador} (+${puntos} ${puntos === 1 ? "tanto" : "tantos"})`);
    render();
    setTimeout(() => {
        bloqueadoPorAnimacion = false;
        mesaVisual = [];
        sincronizarCartasVisibles();
        if (!juego.partidaTerminada) {
            elRivalStatus.textContent = "Esperando";
            mostrarMensaje("");
        }
        render();
        verificarTurnoBot();
    }, 1800);
}

render();
verificarTurnoBot();