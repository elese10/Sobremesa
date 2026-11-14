(function () {
    const { compararCartas } = typeof require !== "undefined"
        ? require("./cards.js")
        : window.TrucoCards;

    function resolverBaza(jugadas) {
        let mejorJugada = jugadas[0];
        let empate = false;
        for (let i = 1; i < jugadas.length; i++) {
            const actual = jugadas[i];
            const resultado = compararCartas(actual.carta, mejorJugada.carta);
            if (resultado === 1) {
                mejorJugada = actual;
                empate = false;
            } else if (resultado === 0 && actual.equipo !== mejorJugada.equipo) {
                empate = true;
            }
        }
        if (empate) {
            return {
                ganador: null,
                empate: true
            };
        }
        return {
            ganador: mejorJugada.equipo,
            empate: false
        };
    }

    function resolverRonda(resultados, equipoMano) {
        const victorias = new Map();
        for (let i = 0; i < resultados.length; i++) {
            const baza = resultados[i];
            if (baza.ganador !== null) {
                const victoriasActuales = (victorias.get(baza.ganador) || 0) + 1;
                victorias.set(baza.ganador, victoriasActuales);
                if (victoriasActuales === 2) {
                    return {
                        ganador: baza.ganador,
                        victorias
                    };
                }
            }
        }
        if (resultados.length < 2) {
            return { ganador: null, victorias };
        }
        const ganadores = resultados.map(baza => baza.ganador);
        if (ganadores[0] === null && ganadores[1] === null) {
            if (resultados.length < 3) return { ganador: null, victorias };
            return {
                ganador: ganadores[2] ?? equipoMano,
                victorias
            };
        }
        if (ganadores[0] === null) {
            return {
                ganador: ganadores[1],
                victorias
            };
        }
        if (ganadores[1] === null) {
            return {
                ganador: ganadores[0],
                victorias
            };
        }
        if (resultados.length < 3) {
            return { ganador: null, victorias };
        }
        if (ganadores[2] === null) {
            return {
                ganador: ganadores[0],
                victorias
            };
        }
        return {
            ganador: ganadores[2],
            victorias
        };
    }

    function cantarTruco(estadoTruco, equipoActual, nuevoNivel) {
        if (estadoTruco.pendiente) {
            return { error: "Ya hay un canto pendiente de respuesta" };
        }
        if (!Number.isInteger(nuevoNivel) ||
            nuevoNivel !== estadoTruco.nivel + 1 ||
            nuevoNivel > 3) {
            return { error: "Canto inválido" };
        }
        if (
            estadoTruco.nivel > 0 &&
            equipoActual !== estadoTruco.equipoQuePuedeSubir
        ) {
            return { error: "No te corresponde subir el canto" };
        }
        const equipoRival = equipoActual === "A" ? "B" : "A";
        return {
            nuevoEstado: {
                ...estadoTruco,
                nivel: nuevoNivel,
                pendiente: true,
                equipoQueCanto: equipoActual,
                equipoQueDebeResponder: equipoRival,
                equipoQuePuedeSubir: null
            }
        };
    }

    function responderTruco(estadoTruco, equipoActual, accion) {
        if (!estadoTruco.pendiente) {
            return { error: "No hay ningún canto pendiente" };
        }
        if (equipoActual !== estadoTruco.equipoQueDebeResponder) {
            return { error: "No te corresponde responder" };
        }
        if (accion === "rechazar") {
            return {
                finalizar: true,
                ganador: estadoTruco.equipoQueCanto,
                puntos: estadoTruco.nivel
            };
        }
        if (accion === "aceptar") {
            return {
                finalizar: false,
                nuevoEstado: {
                    ...estadoTruco,
                    pendiente: false,
                    equipoQueCanto: null,
                    equipoQueDebeResponder: null,
                    equipoQuePuedeSubir: equipoActual
                }
            };
        }
        if (accion === "subir") {
            if (estadoTruco.nivel >= 3) {
                return { error: "Ya se cantó Vale 4, no se puede subir más" };
            }
            return {
                finalizar: false,
                nuevoEstado: {
                    ...estadoTruco,
                    nivel: estadoTruco.nivel + 1,
                    pendiente: true,
                    equipoQueCanto: equipoActual,
                    equipoQueDebeResponder: estadoTruco.equipoQueCanto,
                    equipoQuePuedeSubir: null
                }
            };
        }
        return { error: "Respuesta inválida" };
    }

    function calcularEnvido(cartas) {
        const porPalo = new Map();
        for (let i = 0; i < cartas.length; i++) {
            const [palo, numeroStr] = cartas[i].id.split("-");
            const numero = Number(numeroStr);
            const valorEnvido = numero >= 10 ? 0 : numero;

            if (!porPalo.has(palo)) {
                porPalo.set(palo, []);
            }
            porPalo.get(palo).push(valorEnvido);
        }
        let mejorEnvido = 0;
        for (const valores of porPalo.values()) {
            if (valores.length >= 2) {
                valores.sort((a, b) => b - a);
                const puntos = 20 + valores[0] + valores[1];
                if (puntos > mejorEnvido) {
                    mejorEnvido = puntos;
                }
            } else if (valores[0] > mejorEnvido) {
                mejorEnvido = valores[0];
            }
        }
        return mejorEnvido;
    }

    function resolverEnvido(jugadores, equipoMano) {
        let mejorPuntaje = -1;
        let equipoGanador = null;
        for (let i = 0; i < jugadores.length; i++) {
            const jugador = jugadores[i];
            const puntaje = calcularEnvido(jugador.cartas);
            if (puntaje > mejorPuntaje) {
                mejorPuntaje = puntaje;
                equipoGanador = jugador.equipo;
            } else if (puntaje === mejorPuntaje && jugador.equipo === equipoMano) {
                equipoGanador = equipoMano;
            }
        }
        return {
            ganador: equipoGanador,
            tantos: mejorPuntaje
        };
    }

    function esCantoEnvidoValido(cantosActuales, nuevoCanto) {
        const validos = ["ENVIDO", "REAL_ENVIDO", "FALTA_ENVIDO"];
        if (!validos.includes(nuevoCanto)) return false;
        if (cantosActuales.length === 0) return true;
        const ultimo = cantosActuales[cantosActuales.length - 1];
        if (ultimo === "FALTA_ENVIDO") return false;
        if (ultimo === "REAL_ENVIDO") return nuevoCanto === "FALTA_ENVIDO";
        if (nuevoCanto === "ENVIDO") {
            return cantosActuales.length === 1;
        }
        return true;
    }

    function cantarEnvido(estadoEnvido, equipoActual, tipoCanto) {
        if (estadoEnvido.jugado) {
            return { error: "El envido ya se jugó en esta ronda" };
        }
        if (estadoEnvido.pendiente) {
            return { error: "Ya hay un canto de envido pendiente de respuesta" };
        }
        if (!esCantoEnvidoValido(estadoEnvido.cantos, tipoCanto)) {
            return { error: "Canto de envido inválido" };
        }
        const equipoRival = equipoActual === "A" ? "B" : "A";
        return {
            nuevoEstado: {
                ...estadoEnvido,
                pendiente: true,
                cantos: [tipoCanto],
                equipoQueCanto: equipoActual,
                equipoQueDebeResponder: equipoRival
            }
        };
    }

    function responderEnvido(estadoEnvido, equipoActual, accion, nuevoCanto = null) {
        if (!estadoEnvido.pendiente) {
            return { error: "No hay ningún envido pendiente" };
        }
        if (equipoActual !== estadoEnvido.equipoQueDebeResponder) {
            return { error: "No te corresponde responder el envido" };
        }

        if (accion === "rechazar") {
            return {
                finalizar: true,
                resolverTantos: false,
                ganador: estadoEnvido.equipoQueCanto,
                puntos: calcularPuntosEnvido(estadoEnvido.cantos, true),
                nuevoEstado: {
                    ...estadoEnvido,
                    jugado: true,
                    pendiente: false
                }
            };
        }
        if (accion === "aceptar") {
            return {
                finalizar: true,
                resolverTantos: true,
                cantos: estadoEnvido.cantos,
                nuevoEstado: {
                    ...estadoEnvido,
                    jugado: true,
                    pendiente: false
                }
            };
        }
        if (accion === "subir") {
            if (!esCantoEnvidoValido(estadoEnvido.cantos, nuevoCanto)) {
                return { error: "No se puede subir con ese canto" };
            }
            return {
                finalizar: false,
                nuevoEstado: {
                    ...estadoEnvido,
                    pendiente: true,
                    cantos: [...estadoEnvido.cantos, nuevoCanto],
                    equipoQueCanto: equipoActual,
                    equipoQueDebeResponder: estadoEnvido.equipoQueCanto
                }
            };
        }
        return { error: "Respuesta inválida" };
    }

    function calcularPuntosEnvido(cantos, rechazado, puntosActuales = { A: 0, B: 0 }, limite = 30) {
        if (rechazado && cantos.length === 1) {
            return 1;
        }
        const cantosAValuar = rechazado ? cantos.slice(0, -1) : cantos;
        let total = 0;
        for (let i = 0; i < cantosAValuar.length; i++) {
            const canto = cantosAValuar[i];
            if (canto === "ENVIDO") total += 2;
            if (canto === "REAL_ENVIDO") total += 3;
            if (canto === "FALTA_ENVIDO") {
                const mayorPuntaje = Math.max(puntosActuales.A, puntosActuales.B);
                return limite - mayorPuntaje;
            }
        }
        return total;
    }

    const RulesAPI = {
        resolverBaza,
        resolverRonda,
        cantarTruco,
        responderTruco,
        calcularEnvido,
        resolverEnvido,
        esCantoEnvidoValido,
        cantarEnvido,
        responderEnvido,
        calcularPuntosEnvido
    };
    if (typeof module !== "undefined" && module.exports) {
        module.exports = RulesAPI;
    } else {
        window.TrucoRules = RulesAPI;
    }
})();