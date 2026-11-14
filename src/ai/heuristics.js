(function () {
    const { obtenerFuerza } = typeof require !== "undefined"
        ? require("../engine/cards.js")
        : window.TrucoCards;
    const {
        calcularEnvido,
        resolverEnvido,
        esCantoEnvidoValido,
        calcularPuntosEnvido
    } = typeof require !== "undefined"
        ? require("../engine/rules.js")
        : window.TrucoRules;

    const STORAGE_HISTORIAL_KEY = "truco_carpincho_historial_3p_v1";
    const MAX_PARTIDAS_HISTORIAL = 3;
    let historialMemoriaFallback = [];

    const CONFIGS_DIFICULTAD = {
        normal: {
            iteracionesMonteCarlo: 180,
            usarMemoriaMultipartida: false,
            priorSuavizado: 5.0,
            detectarTrampas: false,
            pescaSegunda: false,
            dormirAnchoPrimera: false,
            endgameDesesperado: false,
            farolApertura: false,
            envidoEncadenado: false,
            farolPostEnvido: false,
            mazoPreventivoPrimera: false,
            ajusteAgresividad: 0
        },
        dificil: {
            iteracionesMonteCarlo: 320,
            usarMemoriaMultipartida: false,
            priorSuavizado: 5.0,
            detectarTrampas: true,
            pescaSegunda: true,
            dormirAnchoPrimera: true,
            endgameDesesperado: true,
            farolApertura: true,
            envidoEncadenado: true,
            farolPostEnvido: true,
            mazoPreventivoPrimera: false,
            ajusteAgresividad: 0
        },
        muy_dificil: {
            iteracionesMonteCarlo: 500,
            usarMemoriaMultipartida: true,
            priorSuavizado: 3.4,
            detectarTrampas: true,
            pescaSegunda: true,
            dormirAnchoPrimera: true,
            endgameDesesperado: true,
            farolApertura: true,
            envidoEncadenado: true,
            farolPostEnvido: true,
            mazoPreventivoPrimera: true,
            ajusteAgresividad: 0.03
        }
    };

    function obtenerConfigDificultad(juego) {
        const nivel = (juego && juego.dificultad) || "dificil";
        return CONFIGS_DIFICULTAD[nivel] || CONFIGS_DIFICULTAD.dificil;
    }

    function leerHistorialPartidas() {
        try {
            const raw = localStorage.getItem(STORAGE_HISTORIAL_KEY);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                return parsed.slice(-MAX_PARTIDAS_HISTORIAL);
            }
        } catch (_) {
            // Fallback en memoria si localStorage está bloqueado
        }
        return historialMemoriaFallback.slice(-MAX_PARTIDAS_HISTORIAL);
    }

    function escribirHistorialPartidas(lista) {
        const recortada = lista.slice(-MAX_PARTIDAS_HISTORIAL);
        historialMemoriaFallback = recortada;
        try {
            localStorage.setItem(STORAGE_HISTORIAL_KEY, JSON.stringify(recortada));
        } catch (_) {
            // Ignorar si localStorage está bloqueado
        }
    }

    function guardarPartidaEnHistorial(juego, partidaCompleta = true) {
        if (!juego || !juego._perfilIA) return;
        const p = juego._perfilIA;
        if (p.guardadaEnHistorial) return;

        const muestrasTotales =
            p.envidosShowdowns +
            p.envidosRecibidos +
            p.trucosShowdowns +
            p.trucosRecibidos;

        // Si reinició temprano sin jugar casi nada, no contamina el historial
        if (!partidaCompleta && muestrasTotales < 3) return;
        if (muestrasTotales === 0) return;

        const historial = leerHistorialPartidas();
        historial.push({
            fecha: Date.now(),
            envidosShowdowns: p.envidosShowdowns,
            envidosBluff: p.envidosBluff,
            envidosRecibidos: p.envidosRecibidos,
            envidosRechazados: p.envidosRechazados,
            trucosShowdowns: p.trucosShowdowns,
            trucosBluff: p.trucosBluff,
            trucosRecibidos: p.trucosRecibidos,
            trucosRechazados: p.trucosRechazados
        });
        escribirHistorialPartidas(historial);
        p.guardadaEnHistorial = true;
    }

    function recalcularTasasPerfil(juego) {
        const p = juego._perfilIA;
        if (!p) return;
        const cfg = obtenerConfigDificultad(juego);
        const prior = cfg.priorSuavizado;

        let envidosShowdowns = p.envidosShowdowns;
        let envidosBluff = p.envidosBluff;
        let envidosRecibidos = p.envidosRecibidos;
        let envidosRechazados = p.envidosRechazados;
        let trucosShowdowns = p.trucosShowdowns;
        let trucosBluff = p.trucosBluff;
        let trucosRecibidos = p.trucosRecibidos;
        let trucosRechazados = p.trucosRechazados;
        let partidasRecordadas = 0;

        if (cfg.usarMemoriaMultipartida) {
            const pasadas = leerHistorialPartidas();
            partidasRecordadas = pasadas.length;
            for (let i = 0; i < pasadas.length; i++) {
                const h = pasadas[i];
                envidosShowdowns += h.envidosShowdowns || 0;
                envidosBluff += h.envidosBluff || 0;
                envidosRecibidos += h.envidosRecibidos || 0;
                envidosRechazados += h.envidosRechazados || 0;
                trucosShowdowns += h.trucosShowdowns || 0;
                trucosBluff += h.trucosBluff || 0;
                trucosRecibidos += h.trucosRecibidos || 0;
                trucosRechazados += h.trucosRechazados || 0;
            }
        }

        p.partidasRecordadas = partidasRecordadas;
        p.tasaMentiraEnvido = (prior * 0.20 + envidosBluff) / (prior + envidosShowdowns);
        p.tasaFoldEnvido = (prior * 0.34 + envidosRechazados) / (prior + envidosRecibidos);
        p.tasaMentiraTruco = (prior * 0.20 + trucosBluff) / (prior + trucosShowdowns);
        p.tasaFoldTruco = (prior * 0.32 + trucosRechazados) / (prior + trucosRecibidos);
    }

    function obtenerPerfilRival(juego, forzarRecalculo = false) {
        if (!juego._perfilIA) {
            juego._perfilIA = {
                guardadaEnHistorial: false,
                partidasRecordadas: 0,
                envidosCantados: 0,
                envidosShowdowns: 0,
                envidosBluff: 0,
                envidosRecibidos: 0,
                envidosRechazados: 0,
                trucosCantados: 0,
                trucosShowdowns: 0,
                trucosBluff: 0,
                trucosRecibidos: 0,
                trucosRechazados: 0,
                vecesAlMazo: 0,
                tasaMentiraEnvido: 0.20,
                tasaFoldEnvido: 0.34,
                tasaMentiraTruco: 0.20,
                tasaFoldTruco: 0.32
            };
            recalcularTasasPerfil(juego);
        } else if (forzarRecalculo) {
            recalcularTasasPerfil(juego);
        }
        return juego._perfilIA;
    }

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

    function evaluarLecturaMesaRival(juego, botEquipo) {
        const cfg = obtenerConfigDificultad(juego);
        const rivalEquipo = botEquipo === "A" ? "B" : "A";
        const rivalEsMano = juego.obtenerEquipoMano() === rivalEquipo;
        const jugadasRivalBazaActual = (juego.bazaActual || []).filter(j => j.equipo === rivalEquipo);

        let rivalDebil = false;
        let posibleTrampa = false;

        if (jugadasRivalBazaActual.length > 0) {
            const fuerzaCarta = obtenerFuerza(jugadasRivalBazaActual[0].carta);

            // En dificultad Normal no detecta trampas: toma cualquier carta <= 4 como debilidad literal
            if (!cfg.detectarTrampas) {
                if (fuerzaCarta <= 4) rivalDebil = true;
                return { rivalDebil, posibleTrampa: false };
            }

            if (juego.resultadosBazas.length === 0) {
                if (fuerzaCarta <= 4) {
                    const salioSilenciosoSiendoMano =
                        rivalEsMano &&
                        juego.bazaActual.length === 1 &&
                        !juego.estadoEnvido.jugado &&
                        !juego.estadoEnvido.pendiente;

                    if (salioSilenciosoSiendoMano && fuerzaCarta <= 2) {
                        posibleTrampa = true;
                    } else if (salioSilenciosoSiendoMano && Math.random() < 0.45) {
                        posibleTrampa = true;
                    } else {
                        rivalDebil = true;
                    }
                }
            } else if (juego.resultadosBazas.length === 1) {
                const rivalGanoPrimera = juego.resultadosBazas[0].ganador === rivalEquipo;
                if (rivalGanoPrimera && fuerzaCarta <= 6) {
                    posibleTrampa = true;
                } else if (!rivalGanoPrimera && fuerzaCarta <= 4) {
                    rivalDebil = true;
                }
            }
        }

        return { rivalDebil, posibleTrampa };
    }

    function decidirEnvido(juego, bot, mundos, modoRespuesta = false) {
        const cfg = obtenerConfigDificultad(juego);
        const botEsMano = juego.obtenerEquipoMano() === bot.equipo;
        const { tantosBot, winRate } = calcularWinRateEnvido(bot, mundos, botEsMano);
        const cantos = juego.estadoEnvido.cantos;

        const rivalEquipo = bot.equipo === "A" ? "B" : "A";
        const puntosFaltantesBot = juego.limitePuntos - juego.puntos[bot.equipo];
        const puntosFaltantesRival = juego.limitePuntos - juego.puntos[rivalEquipo];
        const rivalCercaDeGanar = cfg.endgameDesesperado && puntosFaltantesRival <= 2;

        const perfil = obtenerPerfilRival(juego);
        const { rivalDebil, posibleTrampa } = evaluarLecturaMesaRival(juego, bot.equipo);

        // MODO 1: Responder canto de Envido del humano
        if (modoRespuesta) {
            const puntosSiRechaza = calcularPuntosEnvido(cantos, true, juego.puntos, juego.limitePuntos);
            const puntosSiAcepta = calcularPuntosEnvido(cantos, false, juego.puntos, juego.limitePuntos);
            const evAceptar = puntosSiAcepta * (2 * winRate - 1);
            const evRechazar = -puntosSiRechaza;

            if (
                rivalCercaDeGanar &&
                (tantosBot >= 25 || winRate >= 0.42) &&
                esCantoEnvidoValido(cantos, "FALTA_ENVIDO")
            ) {
                return { tipo: "RESPONDER_ENVIDO", accion: "subir", nuevoCanto: "FALTA_ENVIDO" };
            }

            if (tantosBot >= 32 && esCantoEnvidoValido(cantos, "FALTA_ENVIDO") && puntosFaltantesBot <= 10) {
                return { tipo: "RESPONDER_ENVIDO", accion: "subir", nuevoCanto: "FALTA_ENVIDO" };
            }

            if (cfg.envidoEncadenado) {
                if (tantosBot >= 33 && esCantoEnvidoValido(cantos, "REAL_ENVIDO")) {
                    return { tipo: "RESPONDER_ENVIDO", accion: "subir", nuevoCanto: "REAL_ENVIDO" };
                }
                if (tantosBot >= 30 && esCantoEnvidoValido(cantos, "ENVIDO")) {
                    return { tipo: "RESPONDER_ENVIDO", accion: "subir", nuevoCanto: "ENVIDO" };
                }
            }

            if (tantosBot >= 31 && esCantoEnvidoValido(cantos, "REAL_ENVIDO")) {
                return { tipo: "RESPONDER_ENVIDO", accion: "subir", nuevoCanto: "REAL_ENVIDO" };
            }
            if (tantosBot >= 29 && esCantoEnvidoValido(cantos, "ENVIDO")) {
                return { tipo: "RESPONDER_ENVIDO", accion: "subir", nuevoCanto: "ENVIDO" };
            }

            const evSubirFarol =
                perfil.tasaFoldEnvido * puntosSiRechaza -
                (1 - perfil.tasaFoldEnvido) * (puntosSiAcepta + 2);
            if (
                tantosBot >= 24 &&
                tantosBot <= 27 &&
                perfil.tasaMentiraEnvido >= 0.35 &&
                perfil.tasaFoldEnvido >= 0.40 &&
                evSubirFarol > 0 &&
                esCantoEnvidoValido(cantos, "ENVIDO") &&
                Math.random() < 0.35
            ) {
                return { tipo: "RESPONDER_ENVIDO", accion: "subir", nuevoCanto: "ENVIDO" };
            }

            if (cfg.endgameDesesperado && puntosFaltantesRival <= puntosSiAcepta && puntosFaltantesRival <= 2 && winRate >= 0.32) {
                return { tipo: "RESPONDER_ENVIDO", accion: "aceptar" };
            }

            const margenPosicional = (juego.dificultad === "muy_dificil" && botEsMano) ? -0.06 : 0;
            if (evAceptar >= evRechazar + margenPosicional) {
                return { tipo: "RESPONDER_ENVIDO", accion: "aceptar" };
            }
            return { tipo: "RESPONDER_ENVIDO", accion: "rechazar" };
        }

        // MODO 2: Iniciar canto de Envido en primera baza
        if (juego.resultadosBazas.length > 0 || juego.estadoEnvido.jugado || juego.estadoEnvido.pendiente) {
            return null;
        }

        if (rivalCercaDeGanar) {
            if (tantosBot >= 25 || winRate >= 0.40) {
                return { tipo: "CANTAR_ENVIDO", tipoCanto: "FALTA_ENVIDO" };
            }
            if (puntosFaltantesRival === 1 && Math.random() < 0.35) {
                return { tipo: "CANTAR_ENVIDO", tipoCanto: "FALTA_ENVIDO" };
            }
        }

        if (tantosBot >= 32 && puntosFaltantesBot <= 8 && winRate > 0.85) {
            return { tipo: "CANTAR_ENVIDO", tipoCanto: "FALTA_ENVIDO" };
        }
        if (tantosBot >= 31 && winRate > 0.78) {
            if (cfg.envidoEncadenado && Math.random() < 0.55) {
                return { tipo: "CANTAR_ENVIDO", tipoCanto: "ENVIDO" };
            }
            return { tipo: "CANTAR_ENVIDO", tipoCanto: "REAL_ENVIDO" };
        }
        if (tantosBot >= 27 || (tantosBot >= 25 && botEsMano)) {
            return { tipo: "CANTAR_ENVIDO", tipoCanto: "ENVIDO" };
        }

        if (tantosBot < 24) {
            let probFoldEstimada = perfil.tasaFoldEnvido;
            if (!botEsMano) probFoldEstimada += 0.08;
            if (rivalDebil) probFoldEstimada += 0.12;
            if (posibleTrampa) probFoldEstimada -= 0.10;
            probFoldEstimada = Math.max(0.05, Math.min(0.80, probFoldEstimada));

            const evMentiraEnvido = probFoldEstimada * 1 - (1 - probFoldEstimada) * 2;
            const probDispararFarol = evMentiraEnvido > 0
                ? Math.min(0.42, 0.16 + evMentiraEnvido * 0.45)
                : (!botEsMano && !posibleTrampa ? 0.14 : 0.05);

            if (Math.random() < probDispararFarol) {
                if (probFoldEstimada >= 0.62 && puntosFaltantesBot > 6 && !posibleTrampa && Math.random() < 0.25) {
                    return { tipo: "CANTAR_ENVIDO", tipoCanto: "REAL_ENVIDO" };
                }
                return { tipo: "CANTAR_ENVIDO", tipoCanto: "ENVIDO" };
            }
        }
        return null;
    }

    function decidirTruco(juego, bot, mejorWinRateRonda, modoRespuesta = false, opciones = {}) {
        const cfg = obtenerConfigDificultad(juego);
        const nivelActual = juego.estadoTruco.nivel;
        const botEsMano = juego.obtenerEquipoMano() === bot.equipo;
        const puntosBot = juego.puntos[bot.equipo];
        const rivalEquipo = bot.equipo === "A" ? "B" : "A";
        const puntosRival = juego.puntos[rivalEquipo];
        const puntosFaltantesRival = juego.limitePuntos - puntosRival;

        const rivalAUnPunto = cfg.endgameDesesperado && puntosFaltantesRival === 1;
        const rivalEnMatchPoint = cfg.endgameDesesperado && puntosFaltantesRival <= 2;
        const botEnDesventajaFuerte = puntosRival - puntosBot >= 7 && puntosRival >= 18;
        const perfil = obtenerPerfilRival(juego);
        const { rivalDebil, posibleTrampa } = evaluarLecturaMesaRival(juego, bot.equipo);

        // MODO 1: Responder un canto de Truco / Retruco / Vale 4 del humano
        if (modoRespuesta) {
            const puntosSiAcepta = nivelActual + 1;
            const puntosSiRechaza = nivelActual;
            const evAceptar = puntosSiAcepta * (2 * mejorWinRateRonda - 1);
            const evRechazar = -puntosSiRechaza;

            const umbralSubida = 0.78 - cfg.ajusteAgresividad;
            if (mejorWinRateRonda >= umbralSubida && nivelActual < 3) {
                return { tipo: "RESPONDER_TRUCO", accion: "subir" };
            }

            if (rivalAUnPunto && nivelActual === 1) {
                if (mejorWinRateRonda < 0.22 && perfil.tasaFoldTruco >= 0.35 && Math.random() < 0.35) {
                    return { tipo: "RESPONDER_TRUCO", accion: "subir" };
                }
                return { tipo: "RESPONDER_TRUCO", accion: "aceptar" };
            }

            if (nivelActual < 3 && mejorWinRateRonda < 0.28 && !rivalEnMatchPoint && !posibleTrampa) {
                let probFoldSubida = perfil.tasaFoldTruco;
                if (perfil.tasaMentiraTruco >= 0.32) probFoldSubida += 0.14;
                if (rivalDebil) probFoldSubida += 0.10;
                probFoldSubida = Math.min(0.75, probFoldSubida);

                const puntosSiSubeYRechaza = nivelActual + 1;
                const puntosSiSubeYAcepta = nivelActual + 2;
                const evSubirFarol =
                    probFoldSubida * puntosSiSubeYRechaza +
                    (1 - probFoldSubida) * (puntosSiSubeYAcepta * (2 * mejorWinRateRonda - 1));

                if (evSubirFarol > evRechazar + 0.25 && Math.random() < 0.34) {
                    return { tipo: "RESPONDER_TRUCO", accion: "subir" };
                }
            }

            if (rivalEnMatchPoint && mejorWinRateRonda >= 0.24) {
                return { tipo: "RESPONDER_TRUCO", accion: "aceptar" };
            }
            if (evAceptar >= evRechazar) {
                return { tipo: "RESPONDER_TRUCO", accion: "aceptar" };
            }
            return { tipo: "RESPONDER_TRUCO", accion: "rechazar" };
        }

        // MODO 2: Evaluar cantar o subir Truco en su turno
        if (juego.estadoTruco.pendiente || nivelActual >= 3) return null;
        if (nivelActual > 0 && juego.estadoTruco.equipoQuePuedeSubir !== bot.equipo) return null;

        if (opciones.esTrampaSegunda) {
            const probEsperarTercera = nivelActual === 0 ? 0.75 : 0.85;
            if (Math.random() < probEsperarTercera) {
                return null;
            }
        }

        if (rivalAUnPunto && nivelActual === 0) {
            return { tipo: "CANTAR_TRUCO" };
        }

        const inicioAbsolutoRonda = juego.resultadosBazas.length === 0 && juego.bazaActual.length === 0;

        let umbral = nivelActual === 0 ? 0.62 : 0.72;
        if (inicioAbsolutoRonda && cfg.farolApertura) umbral = 0.76;
        if (botEnDesventajaFuerte) umbral -= 0.06;
        umbral -= cfg.ajusteAgresividad;

        if (mejorWinRateRonda >= umbral) {
            return { tipo: "CANTAR_TRUCO" };
        }

        if (cfg.farolApertura && inicioAbsolutoRonda && mejorWinRateRonda < 0.40) {
            const probAperturaFarol = botEsMano
                ? (perfil.tasaFoldTruco >= 0.30 ? 0.16 : 0.10)
                : (perfil.tasaFoldTruco >= 0.42 ? 0.08 : 0.04);
            if (Math.random() < probAperturaFarol) {
                return { tipo: "CANTAR_TRUCO" };
            }
        }

        const tantosMostradosBot = juego.envidoRevelado ? juego.envidoRevelado[bot.equipo] : null;
        if (
            cfg.farolPostEnvido &&
            tantosMostradosBot !== null &&
            tantosMostradosBot >= 31 &&
            nivelActual === 0 &&
            mejorWinRateRonda < 0.38 &&
            !posibleTrampa &&
            Math.random() < 0.28
        ) {
            return { tipo: "CANTAR_TRUCO" };
        }

        const hayInfoEnMesa = juego.resultadosBazas.length >= 1 || rivalDebil;
        if (hayInfoEnMesa && !posibleTrampa && mejorWinRateRonda < 0.42) {
            let probFold = perfil.tasaFoldTruco;
            if (rivalDebil) probFold += 0.12;
            if (juego.resultadosBazas.length === 2) probFold += 0.08;
            probFold = Math.min(0.78, probFold);

            const recompensaFold = nivelActual + 1;
            const riesgoSiPaga = nivelActual + 2;
            const evFarol =
                probFold * recompensaFold +
                (1 - probFold) * (riesgoSiPaga * (2 * mejorWinRateRonda - 1));

            if (evFarol > 0.10 && Math.random() < 0.28) {
                return { tipo: "CANTAR_TRUCO" };
            }
        }

        if (
            nivelActual === 0 &&
            juego.resultadosBazas.length >= 1 &&
            !posibleTrampa &&
            mejorWinRateRonda >= 0.35 &&
            Math.random() < 0.14
        ) {
            return { tipo: "CANTAR_TRUCO" };
        }
        return null;
    }

    const HeuristicsAPI = {
        obtenerConfigDificultad,
        obtenerPerfilRival,
        recalcularTasasPerfil,
        guardarPartidaEnHistorial,
        decidirEnvido,
        decidirTruco
    };
    if (typeof module !== "undefined" && module.exports) {
        module.exports = HeuristicsAPI;
    } else {
        window.TrucoHeuristics = HeuristicsAPI;
    }
})();