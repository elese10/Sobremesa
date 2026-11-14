const { crearMazo, mazoRandom, compararCartas } = require("./cards.js");
const {
    resolverBaza,
    resolverRonda,
    cantarTruco,
    responderTruco,
    resolverEnvido,
    cantarEnvido,
    responderEnvido,
    calcularPuntosEnvido
} = require("./rules.js");

class JuegoTruco {
    constructor(cantidadJugadores = 2, limitePuntos = 30, azar = Math.random) {
        if (![2, 4, 6].includes(cantidadJugadores)) {
            throw new Error("La cantidad de jugadores debe ser 2, 4 o 6.");
        }
        this.jugadores = [];
        for (let i = 0; i < cantidadJugadores; i++) {
            const numero = i + 1;
            this.jugadores.push({
                id: `j${numero}`,
                numero,
                equipo: numero % 2 !== 0 ? "A" : "B",
                cartas: []
            });
        }
        this.limitePuntos = limitePuntos;
        this.puntos = { A: 0, B: 0 };
        this.partidaTerminada = false;
        this.ganadorPartida = null;
        this.indiceMano = Math.floor(azar() * this.jugadores.length);
        this.iniciarRonda(false);
    }

    iniciarRonda(rotarMano = true) {
        if (this.partidaTerminada) return;
        if (rotarMano) {
            this.indiceMano = (this.indiceMano + 1) % this.jugadores.length;
        }
        this.indiceTurno = this.indiceMano;
        const mazo = mazoRandom(crearMazo());
        for (let i = 0; i < this.jugadores.length; i++) {
            this.jugadores[i].cartas = mazo.splice(0, 3);
        }
        this.bazaActual = [];
        this.resultadosBazas = [];
        this.estadoTruco = {
            nivel: 0,
            pendiente: false,
            equipoQueCanto: null,
            equipoQueDebeResponder: null,
            equipoQuePuedeSubir: null
        };
        this.estadoEnvido = {
            jugado: false,
            pendiente: false,
            cantos: [],
            equipoQueCanto: null,
            equipoQueDebeResponder: null
        };
    }

    //helpers//
    obtenerJugador(jugadorId) {
        return this.jugadores.find(j => j.id === jugadorId);
    }

    obtenerJugadorTurno() {
        return this.jugadores[this.indiceTurno];
    }

    obtenerJugadorMano() {
        return this.jugadores[this.indiceMano];
    }

    obtenerEquipoMano() {
        const numeroJugador = this.jugadores[this.indiceMano].numero;
        return numeroJugador % 2 !== 0 ? "A" : "B";
    }

    avanzarTurno() {
        this.indiceTurno = (this.indiceTurno + 1) % this.jugadores.length;
    }

    obtenerGanadorBazaJugadorId(jugadas) {
        let mejor = jugadas[0];
        for (let i = 1; i < jugadas.length; i++) {
            if (compararCartas(jugadas[i].carta, mejor.carta) === 1) {
                mejor = jugadas[i];
            }
        }
        return mejor.jugadorId;
    }

    sumarPuntos(equipo, cantidad) {
        this.puntos[equipo] += cantidad;
        if (this.puntos[equipo] >= this.limitePuntos) {
            this.puntos[equipo] = this.limitePuntos;
            this.partidaTerminada = true;
            this.ganadorPartida = equipo;
        }
    }

    //jugar//
    jugarCarta(jugadorId, cartaId) {
        if (this.partidaTerminada) return { error: "La partida ya terminó" };
        if (this.estadoTruco.pendiente || this.estadoEnvido.pendiente) {
            return { error: "Hay un canto pendiente de respuesta" };
        }
        const jugadorActual = this.obtenerJugadorTurno();
        if (jugadorActual.id !== jugadorId) {
            return { error: "No es tu turno" };
        }
        const indiceCarta = jugadorActual.cartas.findIndex(c => c.id === cartaId);
        if (indiceCarta === -1) {
            return { error: "No tenés esa carta en la mano" };
        }
        const [cartaJugada] = jugadorActual.cartas.splice(indiceCarta, 1);
        this.bazaActual.push({
            jugadorId: jugadorActual.id,
            equipo: jugadorActual.equipo,
            carta: cartaJugada
        });
        if (this.bazaActual.length < this.jugadores.length) {
            this.avanzarTurno();
            return { ok: true, bazaTerminada: false, rondaTerminada: false };
        }
        const resultadoBaza = resolverBaza(this.bazaActual);
        this.resultadosBazas.push(resultadoBaza);
        const jugadasDeEstaBaza = [...this.bazaActual];
        this.bazaActual = [];
        const resultadoRonda = resolverRonda(this.resultadosBazas, this.obtenerEquipoMano());
        if (resultadoRonda.ganador !== null) {
            const puntosGanados = this.estadoTruco.nivel === 0 ? 1 : this.estadoTruco.nivel;
            this.sumarPuntos(resultadoRonda.ganador, puntosGanados);
            const ganadorRonda = resultadoRonda.ganador;
            if (!this.partidaTerminada) {
                this.iniciarRonda(true);
            }
            return {
                ok: true,
                bazaTerminada: true,
                rondaTerminada: true,
                ganadorRonda,
                puntosGanados
            };
        }
        if (resultadoBaza.empate) {
            this.indiceTurno = this.indiceMano;
        } else {
            const idGanadorBaza = this.obtenerGanadorBazaJugadorId(jugadasDeEstaBaza);
            this.indiceTurno = this.jugadores.findIndex(j => j.id === idGanadorBaza);
        }
        return { ok: true, bazaTerminada: true, rondaTerminada: false };
    }

    //cantos de truco//
    cantarTruco(jugadorId) {
        if (this.partidaTerminada) return { error: "La partida ya terminó" };
        if (this.estadoEnvido.pendiente) return { error: "Primero hay que responder el envido" };
        const jugador = this.obtenerJugador(jugadorId);
        if (!jugador) return { error: "Jugador inválido" };

        if (this.obtenerJugadorTurno().equipo !== jugador.equipo) {
            return { error: "Solo podés cantar en el turno de tu equipo" };
        }
        const resultado = cantarTruco(this.estadoTruco, jugador.equipo, this.estadoTruco.nivel + 1);
        if (resultado.error) return resultado;

        this.estadoTruco = resultado.nuevoEstado;
        return { ok: true, estadoTruco: this.estadoTruco };
    }

    responderTruco(jugadorId, accion) {
        if (this.partidaTerminada) return { error: "La partida ya terminó" };
        const jugador = this.obtenerJugador(jugadorId);
        if (!jugador) return { error: "Jugador inválido" };
        const resultado = responderTruco(this.estadoTruco, jugador.equipo, accion);
        if (resultado.error) return resultado;
        if (resultado.finalizar) {
            this.sumarPuntos(resultado.ganador, resultado.puntos);
            if (!this.partidaTerminada) {
                this.iniciarRonda(true);
            }
            return {
                ok: true,
                rondaTerminada: true,
                ganadorRonda: resultado.ganador,
                puntosGanados: resultado.puntos
            };
        }
        this.estadoTruco = resultado.nuevoEstado;
        return { ok: true, rondaTerminada: false, estadoTruco: this.estadoTruco };
    }

    //cantos de envido//
    cantarEnvido(jugadorId, tipoCanto) {
        if (this.partidaTerminada) return { error: "La partida ya terminó" };
        if (this.resultadosBazas.length > 0) {
            return { error: "El envido solo se canta en la primera mano" };
        }
        const jugador = this.obtenerJugador(jugadorId);
        if (!jugador) return { error: "Jugador inválido" };
        const esEnvidoPrimero =
            this.estadoTruco.pendiente &&
            this.estadoTruco.nivel === 1 &&
            this.estadoTruco.equipoQueDebeResponder === jugador.equipo;
        if (!esEnvidoPrimero && this.obtenerJugadorTurno().equipo !== jugador.equipo) {
            return { error: "No es el turno de tu equipo" };
        }
        const resultado = cantarEnvido(this.estadoEnvido, jugador.equipo, tipoCanto);
        if (resultado.error) return resultado;
        if (esEnvidoPrimero) {
            this.estadoTruco = {
                nivel: 0,
                pendiente: false,
                equipoQueCanto: null,
                equipoQueDebeResponder: null,
                equipoQuePuedeSubir: null
            };
        }
        this.estadoEnvido = resultado.nuevoEstado;
        return { ok: true, estadoEnvido: this.estadoEnvido };
    }

    responderEnvido(jugadorId, accion, nuevoCanto = null) {
        if (this.partidaTerminada) return { error: "La partida ya terminó" };
        const jugador = this.obtenerJugador(jugadorId);
        if (!jugador) return { error: "Jugador inválido" };
        const resultado = responderEnvido(this.estadoEnvido, jugador.equipo, accion, nuevoCanto);
        if (resultado.error) return resultado;
        this.estadoEnvido = resultado.nuevoEstado;
        if (!resultado.finalizar) {
            return { ok: true, envidoResuelto: false, estadoEnvido: this.estadoEnvido };
        }
        if (!resultado.resolverTantos) {
            const puntos = calcularPuntosEnvido(this.estadoEnvido.cantos, true, this.puntos, this.limitePuntos);
            this.sumarPuntos(resultado.ganador, puntos);
            return {
                ok: true,
                envidoResuelto: true,
                ganador: resultado.ganador,
                puntosGanados: puntos
            };
        }
        const { ganador, tantos } = resolverEnvido(this.jugadores, this.obtenerEquipoMano());
        const puntos = calcularPuntosEnvido(this.estadoEnvido.cantos, false, this.puntos, this.limitePuntos);
        this.sumarPuntos(ganador, puntos);
        return {
            ok: true,
            envidoResuelto: true,
            ganador,
            tantosGanadores: tantos,
            puntosGanados: puntos
        };
    }

    irseAlMazo(jugadorId) {
        if (this.partidaTerminada) return { error: "La partida ya terminó" };
        const jugador = this.obtenerJugador(jugadorId);
        if (!jugador) return { error: "Jugador inválido" };
        const equipoRival = jugador.equipo === "A" ? "B" : "A";
        let puntos = this.estadoTruco.nivel === 0 ? 1 : this.estadoTruco.nivel;
        if (this.resultadosBazas.length === 0 && !this.estadoEnvido.jugado && !this.estadoEnvido.pendiente) {
            puntos += 1;
        }
        this.sumarPuntos(equipoRival, puntos);
        if (!this.partidaTerminada) {
            this.iniciarRonda(true);
        }
        return {
            ok: true,
            rondaTerminada: true,
            ganadorRonda: equipoRival,
            puntosGanados: puntos
        };
    }
}

module.exports = { JuegoTruco };