(function () {
    const { generarMundosPosibles, evaluarCartasConMonteCarlo } = typeof require !== "undefined"
        ? require("./montecarlo.js")
        : window.TrucoMonteCarlo;
    const { decidirEnvido, decidirTruco } = typeof require !== "undefined"
        ? require("./heuristics.js")
        : window.TrucoHeuristics;

    function decidirJugadaBot(juego, botId = "j2", iteracionesMonteCarlo = 300) {
        if (juego.partidaTerminada) return null;
        const bot = juego.obtenerJugador(botId);
        if (!bot) throw new Error(`No existe el jugador ${botId}`);
        const mundos = generarMundosPosibles(juego, bot, iteracionesMonteCarlo);
        if (juego.estadoEnvido.pendiente && juego.estadoEnvido.equipoQueDebeResponder === bot.equipo) {
            return decidirEnvido(juego, bot, mundos, true);
        }
        if (juego.estadoTruco.pendiente && juego.estadoTruco.equipoQueDebeResponder === bot.equipo) {
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
        if (juego.obtenerJugadorTurno().id !== bot.id) {
            return null;
        }
        const accionEnvido = decidirEnvido(juego, bot, mundos, false);
        if (accionEnvido) return accionEnvido;
        const evalCartas = evaluarCartasConMonteCarlo(juego, bot, mundos);
        const mejorJugada = evalCartas[0];
        const accionTruco = decidirTruco(juego, bot, mejorJugada.winRate, false);
        if (accionTruco) return accionTruco;
        if (mejorJugada.winRate < 0.08 && juego.resultadosBazas.length > 0) {
            return { tipo: "IRSE_AL_MAZO" };
        }
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
        decidirJugadaBot,
        ejecutarTurnoBot
    };
    if (typeof module !== "undefined" && module.exports) {
        module.exports = BotAPI;
    } else {
        window.TrucoBot = BotAPI;
    }
})();