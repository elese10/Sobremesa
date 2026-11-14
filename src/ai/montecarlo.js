(function () {
    const { crearMazo, mazoRandom, obtenerFuerza } = typeof require !== "undefined"
        ? require("../engine/cards.js")
        : window.TrucoCards;
    const { resolverBaza, resolverRonda, calcularEnvido } = typeof require !== "undefined"
        ? require("../engine/rules.js")
        : window.TrucoRules;

    function generarMundosPosibles(juego, bot, cantidadMundos = 300) {
        const idsConocidos = new Set([
            ...bot.cartas.map(c => c.id),
            ...(juego.cartasJugadasRonda || []).map(c => c.id)
        ]);
        const cartasDesconocidas = crearMazo().filter(c => !idsConocidos.has(c.id));
        const rival = juego.jugadores.find(j => j.id !== bot.id);
        const cantidadCartasRival = rival.cartas.length;
        const rivalCantoEnvido =
            juego.estadoEnvido.cantos.length > 0 &&
            (juego.estadoEnvido.equipoQueCanto === rival.equipo || juego.estadoEnvido.jugado);
        const mundos = [];
        let intentos = 0;

        while (mundos.length < cantidadMundos && intentos < cantidadMundos * 5) {
            intentos++;
            const mezcladas = mazoRandom(cartasDesconocidas);
            const manoRival = mezcladas.slice(0, cantidadCartasRival);
            if (rivalCantoEnvido && cantidadCartasRival === 3) {
                const envidoRival = calcularEnvido(manoRival);
                if (envidoRival < 26 && Math.random() > 0.15) {
                    continue;
                }
            }
            mundos.push(manoRival);
        }
        return mundos;
    }

    function minimaxRonda(cartasBot, cartasRival, mesaActual, resultadosBazas, turno, botEsMano) {
        const equipoMano = botEsMano ? "BOT" : "RIVAL";
        const estadoRonda = resolverRonda(resultadosBazas, equipoMano);
        if (estadoRonda.ganador !== null) {
            return estadoRonda.ganador === "BOT" ? 1 : -1;
        }
        if (cartasBot.length === 0 && cartasRival.length === 0 && mesaActual.length === 0) {
            return botEsMano ? 1 : -1;
        }
        if (turno === "BOT") {
            let mejorValor = -Infinity;
            for (let i = 0; i < cartasBot.length; i++) {
                const carta = cartasBot[i];
                const restantes = cartasBot.filter((_, idx) => idx !== i);
                const valor = simularPaso(
                    restantes,
                    cartasRival,
                    [...mesaActual, { equipo: "BOT", carta }],
                    resultadosBazas,
                    "RIVAL",
                    botEsMano
                );
                if (valor > mejorValor) mejorValor = valor;
                if (mejorValor === 1) break;
            }
            return mejorValor;
        } else {
            let peorValor = Infinity;
            for (let i = 0; i < cartasRival.length; i++) {
                const carta = cartasRival[i];
                const restantes = cartasRival.filter((_, idx) => idx !== i);
                const valor = simularPaso(
                    cartasBot,
                    restantes,
                    [...mesaActual, { equipo: "RIVAL", carta }],
                    resultadosBazas,
                    "BOT",
                    botEsMano
                );
                if (valor < peorValor) peorValor = valor;
                if (peorValor === -1) break;
            }
            return peorValor;
        }
    }

    function simularPaso(cartasBot, cartasRival, mesa, resultadosBazas, siguienteTurno, botEsMano) {
        if (mesa.length < 2) {
            return minimaxRonda(cartasBot, cartasRival, mesa, resultadosBazas, siguienteTurno, botEsMano);
        }
        const resBaza = resolverBaza(mesa);
        const nuevosResultados = [...resultadosBazas, resBaza];
        let proximoTurno;
        if (resBaza.empate) {
            proximoTurno = botEsMano ? "BOT" : "RIVAL";
        } else {
            proximoTurno = resBaza.ganador;
        }
        return minimaxRonda(cartasBot, cartasRival, [], nuevosResultados, proximoTurno, botEsMano);
    }

    function evaluarCartasConMonteCarlo(juego, bot, mundos) {
        const botEsMano = juego.obtenerEquipoMano() === bot.equipo;
        const resultadosPrevios = juego.resultadosBazas.map(b => ({
            ganador: b.ganador === null ? null : (b.ganador === bot.equipo ? "BOT" : "RIVAL"),
            empate: b.empate
        }));
        const mesaActual = juego.bazaActual.map(j => ({
            equipo: j.equipo === bot.equipo ? "BOT" : "RIVAL",
            carta: j.carta
        }));
        const evaluaciones = [];
        for (let i = 0; i < bot.cartas.length; i++) {
            const cartaCandidata = bot.cartas[i];
            const restantesBot = bot.cartas.filter((_, idx) => idx !== i);
            let victorias = 0;
            for (let m = 0; m < mundos.length; m++) {
                const cartasRival = mundos[m];
                const res = simularPaso(
                    restantesBot,
                    cartasRival,
                    [...mesaActual, { equipo: "BOT", carta: cartaCandidata }],
                    resultadosPrevios,
                    "RIVAL",
                    botEsMano
                );
                if (res === 1) victorias++;
            }
            const winRate = mundos.length > 0 ? victorias / mundos.length : 0.5;
            const fuerza = obtenerFuerza(cartaCandidata);
            const bonusTactico = mesaActual.length === 1
                ? (15 - fuerza) * 0.001
                : fuerza * 0.0005;

            evaluaciones.push({
                carta: cartaCandidata,
                winRate,
                score: winRate + bonusTactico
            });
        }
        evaluaciones.sort((a, b) => b.score - a.score);
        return evaluaciones;
    }
    const MonteCarloAPI = {
        generarMundosPosibles,
        evaluarCartasConMonteCarlo
    };
    if (typeof module !== "undefined" && module.exports) {
        module.exports = MonteCarloAPI;
    } else {
        window.TrucoMonteCarlo = MonteCarloAPI;
    }
})();