(function () {
    const { crearMazo, mazoRandom, obtenerFuerza } = typeof require !== "undefined"
        ? require("../engine/cards.js")
        : window.TrucoCards;
    const { resolverBaza, resolverRonda, calcularEnvido } = typeof require !== "undefined"
        ? require("../engine/rules.js")
        : window.TrucoRules;
    const { obtenerConfigDificultad, obtenerPerfilRival } = typeof require !== "undefined"
        ? require("./heuristics.js")
        : window.TrucoHeuristics;

    function fuerzaPromedioMano(cartas) {
        if (!cartas || cartas.length === 0) return 0;
        let suma = 0;
        for (let i = 0; i < cartas.length; i++) {
            suma += obtenerFuerza(cartas[i]);
        }
        return suma / cartas.length;
    }

    function fuerzaMaximaMano(cartas) {
        if (!cartas || cartas.length === 0) return 0;
        let max = 0;
        for (let i = 0; i < cartas.length; i++) {
            const f = obtenerFuerza(cartas[i]);
            if (f > max) max = f;
        }
        return max;
    }

    function fuerzaMinimaMano(cartas) {
        if (!cartas || cartas.length === 0) return 0;
        let min = Infinity;
        for (let i = 0; i < cartas.length; i++) {
            const f = obtenerFuerza(cartas[i]);
            if (f < min) min = f;
        }
        return min;
    }

    function deducirManosExactasPorEnvido(cartasDesconocidas, cartasJugadasRival, cantidadRestante, tantosObjetivo, maxMundos) {
        if (cantidadRestante === 0) return [[]];
        if (cantidadRestante === 1) {
            const exactas = [];
            for (let i = 0; i < cartasDesconocidas.length; i++) {
                const candidata = [cartasDesconocidas[i]];
                if (calcularEnvido([...cartasJugadasRival, ...candidata]) === tantosObjetivo) {
                    exactas.push(candidata);
                }
            }
            return exactas;
        }
        if (cantidadRestante === 2) {
            const exactas = [];
            for (let i = 0; i < cartasDesconocidas.length - 1; i++) {
                for (let j = i + 1; j < cartasDesconocidas.length; j++) {
                    const candidata = [cartasDesconocidas[i], cartasDesconocidas[j]];
                    if (calcularEnvido([...cartasJugadasRival, ...candidata]) === tantosObjetivo) {
                        exactas.push(candidata);
                    }
                }
            }
            if (exactas.length <= maxMundos) return exactas;
            return mazoRandom(exactas).slice(0, maxMundos);
        }
        const exactas = [];
        const firmas = new Set();
        let intentos = 0;
        while (exactas.length < maxMundos && intentos < 14000) {
            intentos++;
            const trio = mazoRandom(cartasDesconocidas).slice(0, 3);
            if (calcularEnvido(trio) === tantosObjetivo) {
                const firma = trio.map(c => c.id).sort().join("|");
                if (!firmas.has(firma)) {
                    firmas.add(firma);
                    exactas.push(trio);
                }
            }
        }
        return exactas;
    }

    function generarMundosPosibles(juego, bot, cantidadMundos = 300) {
        const cfg = obtenerConfigDificultad(juego);
        const perfil = obtenerPerfilRival(juego);

        const idsConocidos = new Set([
            ...bot.cartas.map(c => c.id),
            ...(juego.cartasJugadasRonda || []).map(c => c.id)
        ]);
        const cartasDesconocidas = crearMazo().filter(c => !idsConocidos.has(c.id));
        const rival = juego.jugadores.find(j => j.id !== bot.id);
        const rivalEsMano = juego.obtenerEquipoMano() === rival.equipo;
        const cantidadCartasRival = rival.cartas.length;
        const cartasJugadasRival = (juego.historialJugadasRonda || [])
            .filter(h => h.equipo === rival.equipo)
            .map(h => h.carta);

        // 1. Deducción combinatoria exacta si ya se mostró el envido
        const tantosReveladosRival = juego.envidoRevelado
            ? juego.envidoRevelado[rival.equipo]
            : null;
        if (tantosReveladosRival !== null && tantosReveladosRival !== undefined) {
            const mundosExactos = deducirManosExactasPorEnvido(
                cartasDesconocidas,
                cartasJugadasRival,
                cantidadCartasRival,
                tantosReveladosRival,
                cantidadMundos
            );
            if (mundosExactos.length > 0) {
                return mundosExactos;
            }
        }

        // 2. Inferencia bayesiana según acciones, historial y posibles trampas del rival
        const rivalRechazoEnvido = juego.envidoRechazadoPor === rival.equipo;
        const rivalCantoEnvido =
            !rivalRechazoEnvido &&
            juego.estadoEnvido.cantos.length > 0 &&
            (juego.estadoEnvido.equipoQueCanto === rival.equipo || juego.estadoEnvido.jugado);
        const rivalPasoEnvido =
            !rivalCantoEnvido &&
            !rivalRechazoEnvido &&
            !juego.estadoEnvido.jugado &&
            (juego.resultadosBazas.length > 0 || juego.bazaActual.some(j => j.equipo === rival.equipo));
        const rivalCantoTruco =
            juego.estadoTruco.nivel > 0 &&
            (juego.estadoTruco.equipoQueCanto === rival.equipo || juego.estadoTruco.equipoQuePuedeSubir === bot.equipo);

        const rivalGanoPrimera =
            juego.resultadosBazas.length > 0 &&
            juego.resultadosBazas[0].ganador === rival.equipo;

        const rivalSalioConCeboPrimera =
            cfg.detectarTrampas &&
            rivalEsMano &&
            cartasJugadasRival.length >= 1 &&
            obtenerFuerza(cartasJugadasRival[0]) <= 2 &&
            !rivalCantoEnvido;

        const rivalPescandoEnSegunda =
            cfg.detectarTrampas &&
            rivalGanoPrimera &&
            cantidadCartasRival === 1 &&
            cartasJugadasRival.length === 2 &&
            obtenerFuerza(cartasJugadasRival[1]) <= 6;

        // Inferencia negativa extra en Muy Difícil: si ganó primera con un 2 o 3 (fuerza 9-10) sin tirar ancho,
        // es menos probable que tenga también el Macho guardado
        const rivalGanoPrimeraSinAncho =
            juego.dificultad === "muy_dificil" &&
            rivalGanoPrimera &&
            cartasJugadasRival.length >= 1 &&
            obtenerFuerza(cartasJugadasRival[0]) >= 9 &&
            obtenerFuerza(cartasJugadasRival[0]) <= 10;

        const tasaMentiraEnvido = perfil.tasaMentiraEnvido ?? 0.20;
        const tasaMentiraTruco = perfil.tasaMentiraTruco ?? 0.20;
        const mundos = [];
        let intentos = 0;

        while (mundos.length < cantidadMundos && intentos < cantidadMundos * 8) {
            intentos++;
            const mezcladas = mazoRandom(cartasDesconocidas);
            const manoRival = mezcladas.slice(0, cantidadCartasRival);
            const manoInicialEstimada = [...cartasJugadasRival, ...manoRival];

            if (manoInicialEstimada.length === 3) {
                const envidoEstimado = calcularEnvido(manoInicialEstimada);
                if (rivalRechazoEnvido) {
                    if (envidoEstimado >= 26 && Math.random() > 0.08) {
                        continue;
                    }
                } else if (rivalCantoEnvido) {
                    if (envidoEstimado < 26 && Math.random() > tasaMentiraEnvido) {
                        continue;
                    }
                } else if (rivalPasoEnvido) {
                    const probAceptarAltoOculto = !cfg.detectarTrampas
                        ? 0.14
                        : (rivalSalioConCeboPrimera ? 0.35 : 0.22);
                    if (envidoEstimado >= 27 && Math.random() > probAceptarAltoOculto) {
                        continue;
                    }
                }
            }

            if (cantidadCartasRival > 0) {
                const maxFuerzaRival = fuerzaMaximaMano(manoRival);
                const fuerzaMedia = fuerzaPromedioMano(manoRival);

                if (rivalCantoTruco) {
                    let manoCreible;
                    if (!cfg.detectarTrampas) {
                        manoCreible = fuerzaMedia >= 7.5;
                    } else if (rivalGanoPrimera) {
                        manoCreible = maxFuerzaRival >= 5 || fuerzaMedia >= 4.0;
                    } else {
                        manoCreible = maxFuerzaRival >= 9 || fuerzaMedia >= 6.2;
                    }

                    if (!manoCreible && Math.random() > tasaMentiraTruco) {
                        continue;
                    }
                } else if (cfg.detectarTrampas) {
                    if (rivalSalioConCeboPrimera && maxFuerzaRival < 9 && Math.random() < 0.24) {
                        continue;
                    }
                    if (rivalPescandoEnSegunda && maxFuerzaRival < 9 && Math.random() < 0.34) {
                        continue;
                    }
                    if (rivalGanoPrimeraSinAncho && maxFuerzaRival === 14 && Math.random() < 0.28) {
                        continue;
                    }
                }
            }

            mundos.push(manoRival);
        }

        while (mundos.length < cantidadMundos) {
            mundos.push(mazoRandom(cartasDesconocidas).slice(0, cantidadCartasRival));
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
        const cfg = obtenerConfigDificultad(juego);
        const botEsMano = juego.obtenerEquipoMano() === bot.equipo;
        const resultadosPrevios = juego.resultadosBazas.map(b => ({
            ganador: b.ganador === null ? null : (b.ganador === bot.equipo ? "BOT" : "RIVAL"),
            empate: b.empate
        }));
        const mesaActual = juego.bazaActual.map(j => ({
            equipo: j.equipo === bot.equipo ? "BOT" : "RIVAL",
            carta: j.carta
        }));

        const maxFuerzaBot = fuerzaMaximaMano(bot.cartas);
        const minFuerzaBot = fuerzaMinimaMano(bot.cartas);
        const puntosFaltantesBot = juego.limitePuntos - juego.puntos[bot.equipo];

        const puedePescarEnSegunda =
            cfg.pescaSegunda &&
            resultadosPrevios.length === 1 &&
            resultadosPrevios[0].ganador === "BOT" &&
            mesaActual.length === 0 &&
            bot.cartas.length === 2 &&
            maxFuerzaBot >= 12 &&
            minFuerzaBot < maxFuerzaBot &&
            puntosFaltantesBot > 1;

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

            let bonusTactico = 0;
            let esTrampaSegunda = false;

            if (mesaActual.length === 1) {
                bonusTactico = (15 - fuerza) * 0.001;
            } else if (puedePescarEnSegunda && winRate >= 0.90) {
                if (fuerza === minFuerzaBot) {
                    bonusTactico = 0.008;
                    esTrampaSegunda = true;
                } else {
                    bonusTactico = -0.008;
                }
            } else if (cfg.dormirAnchoPrimera && resultadosPrevios.length === 0 && winRate >= 0.72 && maxFuerzaBot >= 12) {
                if (fuerza >= 12) {
                    bonusTactico = -0.0035;
                } else if (fuerza >= 4 && fuerza <= 8) {
                    bonusTactico = 0.002;
                } else {
                    bonusTactico = fuerza * 0.0003;
                }
            } else if (!cfg.dormirAnchoPrimera && resultadosPrevios.length === 0 && winRate > 0.85 && fuerza === 14) {
                bonusTactico = -0.002;
            } else {
                bonusTactico = fuerza * 0.0005;
            }

            evaluaciones.push({
                carta: cartaCandidata,
                winRate,
                score: winRate + bonusTactico,
                esTrampaSegunda
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