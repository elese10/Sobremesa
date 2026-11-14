(function () {
    const { obtenerFuerza } = typeof require !== "undefined"
        ? require("../engine/cards.js")
        : window.TrucoCards;
    const { generarMundosPosibles, evaluarCartasConMonteCarlo } = typeof require !== "undefined"
        ? require("./montecarlo.js")
        : window.TrucoMonteCarlo;
    const {
        obtenerConfigDificultad,
        obtenerPerfilRival,
        recalcularTasasPerfil,
        decidirEnvido,
        decidirTruco
    } = typeof require !== "undefined"
        ? require("./heuristics.js")
        : window.TrucoHeuristics;

    // Registra acciones del humano durante la partida para que el bot aprenda su estilo
    function registrarAprendizajeRival(juego, evento) {
        const perfil = obtenerPerfilRival(juego);
        switch (evento.tipo) {
            case "RIVAL_CANTO_ENVIDO":
                perfil.envidosCantados += 1;
                break;
            case "SHOWDOWN_ENVIDO":
                if (evento.cantoRival) {
                    perfil.envidosShowdowns += 1;
                    if (evento.tantosRival < 25) {
                        perfil.envidosBluff += 1;
                    }
                }
                break;
            case "RIVAL_RESPONDIO_ENVIDO":
                perfil.envidosRecibidos += 1;
                if (evento.accion === "rechazar") {
                    perfil.envidosRechazados += 1;
                }
                break;
            case "RIVAL_CANTO_TRUCO":
                perfil.trucosCantados += 1;
                break;
            case "SHOWDOWN_TRUCO":
                if (evento.cantoRival && Array.isArray(evento.cartasRival)) {
                    perfil.trucosShowdowns += 1;
                    const maxFuerza = evento.cartasRival.reduce(
                        (max, c) => Math.max(max, obtenerFuerza(c)),
                        0
                    );
                    if (maxFuerza < 9) {
                        perfil.trucosBluff += 1;
                    }
                }
                break;
            case "RIVAL_RESPONDIO_TRUCO":
                perfil.trucosRecibidos += 1;
                if (evento.accion === "rechazar") {
                    perfil.trucosRechazados += 1;
                }
                break;
            case "RIVAL_AL_MAZO":
                perfil.vecesAlMazo += 1;
                perfil.trucosRecibidos += 1;
                perfil.trucosRechazados += 1;
                break;
        }
        recalcularTasasPerfil(juego);
    }

    function decidirJugadaBot(juego, botId = "j2", iteracionesCustom = null) {
        if (juego.partidaTerminada) return null;
        const bot = juego.obtenerJugador(botId);
        if (!bot) throw new Error(`No existe el jugador ${botId}`);

        const cfg = obtenerConfigDificultad(juego);
        const iteracionesMonteCarlo = iteracionesCustom ?? cfg.iteracionesMonteCarlo;

        const rivalEquipo = bot.equipo === "A" ? "B" : "A";
        const puntosFaltantesRival = juego.limitePuntos - juego.puntos[rivalEquipo];
        const rivalAUnPunto = cfg.endgameDesesperado && puntosFaltantesRival === 1;

        const mundos = generarMundosPosibles(juego, bot, iteracionesMonteCarlo);

        // 1. Responder Envido pendiente
        if (juego.estadoEnvido.pendiente && juego.estadoEnvido.equipoQueDebeResponder === bot.equipo) {
            return decidirEnvido(juego, bot, mundos, true);
        }

        // 2. Responder Truco pendiente
        if (juego.estadoTruco.pendiente && juego.estadoTruco.equipoQueDebeResponder === bot.equipo) {
            // Jugada avanzada: "El envido está primero" si el humano cantó Truco en primera baza
            if (
                juego.resultadosBazas.length === 0 &&
                !juego.estadoEnvido.jugado &&
                juego.estadoTruco.nivel === 1
            ) {
                const envidoPrimero = decidirEnvido(juego, bot, mundos, false);
                if (envidoPrimero) return envidoPrimero;
            }
            const evalCartas = evaluarCartasConMonteCarlo(juego, bot, mundos);
            const mejorWinRate = evalCartas[0]?.winRate ?? 0;
            return decidirTruco(juego, bot, mejorWinRate, true);
        }

        // 3. Verificar turno
        if (juego.obtenerJugadorTurno().id !== bot.id) {
            return null;
        }

        // 4. Evaluar Envido en primera baza
        const accionEnvido = decidirEnvido(juego, bot, mundos, false);
        if (accionEnvido) return accionEnvido;

        // 5. Evaluar cartas con Monte Carlo + Minimax
        const evalCartas = evaluarCartasConMonteCarlo(juego, bot, mundos);
        const mejorJugada = evalCartas[0];

        // 6. Evaluar Truco
        const inicioAbsolutoRonda = juego.resultadosBazas.length === 0 && juego.bazaActual.length === 0;
        if (cfg.farolApertura || !inicioAbsolutoRonda || mejorJugada.winRate >= 0.90) {
            const accionTruco = decidirTruco(juego, bot, mejorJugada.winRate, false, {
                esTrampaSegunda: Boolean(mejorJugada.esTrampaSegunda)
            });
            if (accionTruco) return accionTruco;
        }

        // 7. Irse al mazo táctico
        if (!rivalAUnPunto) {
            if (mejorJugada.winRate < 0.08 && juego.resultadosBazas.length > 0) {
                return { tipo: "IRSE_AL_MAZO" };
            }
            // En Muy Difícil, si en primera ya vio un Ancho/Hembra rival y está totalmente muerto (< 5%), ahorra riesgos
            if (
                cfg.mazoPreventivoPrimera &&
                juego.resultadosBazas.length === 0 &&
                juego.bazaActual.length === 1 &&
                mejorJugada.winRate < 0.05
            ) {
                return { tipo: "IRSE_AL_MAZO" };
            }
        }

        // 8. Jugar la carta óptima
        return {
            tipo: "JUGAR_CARTA",
            cartaId: mejorJugada.carta.id
        };
    }

    function ejecutarTurnoBot(juego, botId = "j2") {
        const decision = decidirJugadaBot(juego, botId);
        if (!decision) return null;
        switch (decision.tipo) {
            case "RESPONDER_ENVIDO":
                return { decision, resultado: juego.responderEnvido(botId, decision.accion, decision.nuevoCanto) };
            case "CANTAR_ENVIDO":
                return { decision, resultado: juego.cantarEnvido(botId, decision.tipoCanto) };
            case "RESPONDER_TRUCO":
                return { decision, resultado: juego.responderTruco(botId, decision.accion) };
            case "CANTAR_TRUCO":
                return { decision, resultado: juego.cantarTruco(botId) };
            case "IRSE_AL_MAZO":
                return { decision, resultado: juego.irseAlMazo(botId) };
            case "JUGAR_CARTA":
                return { decision, resultado: juego.jugarCarta(botId, decision.cartaId) };
            default:
                return null;
        }
    }

    const BotAPI = {
        registrarAprendizajeRival,
        decidirJugadaBot,
        ejecutarTurnoBot
    };
    if (typeof module !== "undefined" && module.exports) {
        module.exports = BotAPI;
    } else {
        window.TrucoBot = BotAPI;
    }
})();