(function () {
    const {
        calcularEnvido,
        resolverEnvido,
        esCantoEnvidoValido,
        calcularPuntosEnvido
    } = typeof require !== "undefined"
        ? require("../engine/rules.js")
        : window.TrucoRules;

    function calcularWinRateEnvido(bot, mundos, botEsMano) {
        const cartasBotCompletas = bot.cartas;
        const equipoMano = botEsMano ? "BOT" : "RIVAL";
        let ganados = 0;
        for (let i = 0; i < mundos.length; i++) {
            const res = resolverEnvido(
                [
                    { equipo: "BOT", cartas: cartasBotCompletas },
                    { equipo: "RIVAL", cartas: mundos[i] }
                ],
                equipoMano
            );
            if (res.ganador === "BOT") ganados++;
        }
        return {
            tantosBot: calcularEnvido(cartasBotCompletas),
            winRate: mundos.length > 0 ? ganados / mundos.length : 0
        };
    }

    function decidirEnvido(juego, bot, mundos, modoRespuesta = false) {
        const botEsMano = juego.obtenerEquipoMano() === bot.equipo;
        const { tantosBot, winRate } = calcularWinRateEnvido(bot, mundos, botEsMano);
        const cantos = juego.estadoEnvido.cantos;
        const puntosFaltantesBot = juego.limitePuntos - juego.puntos[bot.equipo];

        if (modoRespuesta) {
            const puntosSiRechaza = calcularPuntosEnvido(cantos, true, juego.puntos, juego.limitePuntos);
            const puntosSiAcepta = calcularPuntosEnvido(cantos, false, juego.puntos, juego.limitePuntos);
            const evAceptar = puntosSiAcepta * (2 * winRate - 1);
            const evRechazar = -puntosSiRechaza;
            if (tantosBot >= 32 && esCantoEnvidoValido(cantos, "FALTA_ENVIDO") && puntosFaltantesBot <= 10) {
                return { tipo: "RESPONDER_ENVIDO", accion: "subir", nuevoCanto: "FALTA_ENVIDO" };
            }
            if (tantosBot >= 31 && esCantoEnvidoValido(cantos, "REAL_ENVIDO")) {
                return { tipo: "RESPONDER_ENVIDO", accion: "subir", nuevoCanto: "REAL_ENVIDO" };
            }
            if (tantosBot >= 29 && esCantoEnvidoValido(cantos, "ENVIDO")) {
                return { tipo: "RESPONDER_ENVIDO", accion: "subir", nuevoCanto: "ENVIDO" };
            }
            if (evAceptar >= evRechazar) {
                return { tipo: "RESPONDER_ENVIDO", accion: "aceptar" };
            }
            return { tipo: "RESPONDER_ENVIDO", accion: "rechazar" };
        }
        if (juego.resultadosBazas.length > 0 || juego.estadoEnvido.jugado || juego.estadoEnvido.pendiente) {
            return null;
        }
        if (tantosBot >= 32 && puntosFaltantesBot <= 8 && winRate > 0.85) {
            return { tipo: "CANTAR_ENVIDO", tipoCanto: "FALTA_ENVIDO" };
        }
        if (tantosBot >= 31 && winRate > 0.78) {
            return { tipo: "CANTAR_ENVIDO", tipoCanto: "REAL_ENVIDO" };
        }
        if (tantosBot >= 27 || (tantosBot >= 25 && botEsMano)) {
            return { tipo: "CANTAR_ENVIDO", tipoCanto: "ENVIDO" };
        }
        if (!botEsMano && tantosBot < 24 && Math.random() < 0.14) {
            return { tipo: "CANTAR_ENVIDO", tipoCanto: "ENVIDO" };
        }
        return null;
    }

    function decidirTruco(juego, bot, mejorWinRateRonda, modoRespuesta = false) {
        const nivelActual = juego.estadoTruco.nivel;
        const puntosRival = juego.puntos[bot.equipo === "A" ? "B" : "A"];
        const rivalEnMatchPoint = juego.limitePuntos - puntosRival <= 2;
        if (modoRespuesta) {
            const puntosSiAcepta = nivelActual;
            const puntosSiRechaza = nivelActual === 1 ? 1 : nivelActual - 1;
            const evAceptar = puntosSiAcepta * (2 * mejorWinRateRonda - 1);
            const evRechazar = -puntosSiRechaza;
            if (mejorWinRateRonda >= 0.78 && nivelActual < 3) {
                return { tipo: "RESPONDER_TRUCO", accion: "subir" };
            }
            if (rivalEnMatchPoint && mejorWinRateRonda >= 0.25) {
                return { tipo: "RESPONDER_TRUCO", accion: "aceptar" };
            }
            if (evAceptar >= evRechazar) {
                return { tipo: "RESPONDER_TRUCO", accion: "aceptar" };
            }
            return { tipo: "RESPONDER_TRUCO", accion: "rechazar" };
        }
        if (juego.estadoTruco.pendiente || nivelActual >= 3) return null;
        if (nivelActual > 0 && juego.estadoTruco.equipoQuePuedeSubir !== bot.equipo) return null;
        const umbral = nivelActual === 0 ? 0.62 : 0.72;
        if (mejorWinRateRonda >= umbral) {
            return { tipo: "CANTAR_TRUCO" };
        }
        if (nivelActual === 0 && juego.resultadosBazas.length >= 1 && mejorWinRateRonda >= 0.35 && Math.random() < 0.12) {
            return { tipo: "CANTAR_TRUCO" };
        }
        return null;
    }
    const HeuristicsAPI = {
        decidirEnvido,
        decidirTruco
    };
    if (typeof module !== "undefined" && module.exports) {
        module.exports = HeuristicsAPI;
    } else {
        window.TrucoHeuristics = HeuristicsAPI;
    }
})();