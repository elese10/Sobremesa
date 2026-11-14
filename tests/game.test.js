const { JuegoTruco } = require("../src/engine/game.js");

describe("JuegoTruco - Motor de partida", () => {
    describe("Inicialización y rotación de mano", () => {
        test("asigna equipos correctamente (impares A, pares B) para 2, 4 y 6 jugadores", () => {
            const juego4 = new JuegoTruco(4, 30, () => 0);

            expect(juego4.jugadores).toHaveLength(4);
            expect(juego4.jugadores.map(j => ({ id: j.id, equipo: j.equipo }))).toEqual([
                { id: "j1", equipo: "A" },
                { id: "j2", equipo: "B" },
                { id: "j3", equipo: "A" },
                { id: "j4", equipo: "B" }
            ]);
            expect(juego4.jugadores.every(j => j.cartas.length === 3)).toBe(true);
        });

        test("lanza error si la cantidad de jugadores no es 2, 4 o 6", () => {
            expect(() => new JuegoTruco(1)).toThrow();
            expect(() => new JuegoTruco(3)).toThrow();
            expect(() => new JuegoTruco(5)).toThrow();
        });

        test("elige la mano inicial al azar y rota al siguiente jugador al terminar la ronda", () => {
            // azar = 0.9 en 2 jugadores -> indiceMano = 1 (j2, Equipo B)
            const juego = new JuegoTruco(2, 30, () => 0.9);

            expect(juego.obtenerJugadorMano().id).toBe("j2");
            expect(juego.obtenerEquipoMano()).toBe("B");
            expect(juego.obtenerJugadorTurno().id).toBe("j2");

            // j2 se va al mazo para cerrar la ronda y verificar que la mano pase a j1
            juego.irseAlMazo("j2");

            expect(juego.obtenerJugadorMano().id).toBe("j1");
            expect(juego.obtenerEquipoMano()).toBe("A");
            expect(juego.obtenerJugadorTurno().id).toBe("j1");
        });
    });

    describe("Turnos, bazas y resolución de rondas", () => {
        test("no permite jugar fuera de turno ni tirar una carta que no se tiene", () => {
            const juego = new JuegoTruco(2, 30, () => 0); // Arranca j1
            const cartaJ1 = juego.jugadores[0].cartas[0].id;

            expect(juego.jugarCarta("j2", cartaJ1)).toEqual({ error: "No es tu turno" });
            expect(juego.jugarCarta("j1", "carta-inexistente")).toEqual({
                error: "No tenés esa carta en la mano"
            });
        });

        test("el ganador de la primera baza arranca la segunda y gana la ronda al ganar 2 bazas", () => {
            const juego = new JuegoTruco(2, 30, () => 0); // j1 es mano

            // Inyectamos manos determinísticas para probar el flujo
            juego.jugadores[0].cartas = [
                { id: "bastos-04", palo: "bastos", valor: 4 },
                { id: "oros-05", palo: "oros", valor: 5 },
                { id: "copas-06", palo: "copas", valor: 6 }
            ];
            juego.jugadores[1].cartas = [
                { id: "espadas-01", palo: "espadas", valor: 1 },
                { id: "bastos-01", palo: "bastos", valor: 1 },
                { id: "espadas-07", palo: "espadas", valor: 7 }
            ];

            // Baza 1: gana j2 con ancho de espadas
            expect(juego.jugarCarta("j1", "bastos-04")).toEqual({
                ok: true,
                bazaTerminada: false,
                rondaTerminada: false
            });
            expect(juego.jugarCarta("j2", "espadas-01")).toEqual({
                ok: true,
                bazaTerminada: true,
                rondaTerminada: false
            });

            // Como j2 ganó primera, debe ser el turno de j2 en segunda
            expect(juego.obtenerJugadorTurno().id).toBe("j2");

            // Baza 2: gana j2 con ancho de bastos -> cierra la ronda (2-0) y suma 1 punto a B
            juego.jugarCarta("j2", "bastos-01");
            const resFinal = juego.jugarCarta("j1", "oros-05");

            expect(resFinal).toEqual({
                ok: true,
                bazaTerminada: true,
                rondaTerminada: true,
                ganadorRonda: "B",
                puntosGanados: 1
            });
            expect(juego.puntos).toEqual({ A: 0, B: 1 });
        });

        test("resuelve correctamente parda en primera baza (define la segunda)", () => {
            const juego = new JuegoTruco(2, 30, () => 0); // j1 es mano

            juego.jugadores[0].cartas = [
                { id: "espadas-03", palo: "espadas", valor: 3 },
                { id: "oros-04", palo: "oros", valor: 4 },
                { id: "copas-05", palo: "copas", valor: 5 }
            ];
            juego.jugadores[1].cartas = [
                { id: "bastos-03", palo: "bastos", valor: 3 },
                { id: "espadas-07", palo: "espadas", valor: 7 },
                { id: "copas-04", palo: "copas", valor: 4 }
            ];

            // Baza 1: parda con los dos 3
            juego.jugarCarta("j1", "espadas-03");
            juego.jugarCarta("j2", "bastos-03");

            // Al ser parda, vuelve a arrancar el mano (j1)
            expect(juego.obtenerJugadorTurno().id).toBe("j1");

            // Baza 2: gana j2 con 7 de espadas y gana la ronda directamente
            juego.jugarCarta("j1", "oros-04");
            const res = juego.jugarCarta("j2", "espadas-07");

            expect(res.rondaTerminada).toBe(true);
            expect(res.ganadorRonda).toBe("B");
        });
    });

    describe("Cantos y respuestas de Truco", () => {
        test("bloquea tirar cartas mientras hay un canto pendiente y suma puntos al rechazar", () => {
            const juego = new JuegoTruco(2, 30, () => 0);
            const cartaJ1 = juego.jugadores[0].cartas[0].id;

            const canto = juego.cantarTruco("j1");
            expect(canto.ok).toBe(true);
            expect(juego.estadoTruco.pendiente).toBe(true);

            // No deja jugar carta hasta responder
            expect(juego.jugarCarta("j1", cartaJ1)).toEqual({
                error: "Hay un canto pendiente de respuesta"
            });

            // j2 rechaza -> gana equipo A (1 punto) y arranca nueva ronda
            const resp = juego.responderTruco("j2", "rechazar");
            expect(resPropiedades(resp)).toEqual({
                ok: true,
                rondaTerminada: true,
                ganadorRonda: "A",
                puntosGanados: 1
            });
            expect(juego.puntos.A).toBe(1);
        });

        test("permite subir directamente ('Quiero retruco') y luego aceptar", () => {
            const juego = new JuegoTruco(2, 30, () => 0);

            juego.cantarTruco("j1"); // Truco (nivel 1)
            const subida = juego.responderTruco("j2", "subir"); // Quiero retruco (nivel 2)

            expect(subida.ok).toBe(true);
            expect(juego.estadoTruco.nivel).toBe(2);
            expect(juego.estadoTruco.pendiente).toBe(true);
            expect(juego.estadoTruco.equipoQueDebeResponder).toBe("A");

            const aceptacion = juego.responderTruco("j1", "aceptar");
            expect(aceptacion.ok).toBe(true);
            expect(juego.estadoTruco.pendiente).toBe(false);
            expect(juego.estadoTruco.equipoQuePuedeSubir).toBe("A");
        });
    });

    describe("Envido, encadenamientos y desempate por mano", () => {
        test("compara tantos al aceptar envido y suma 2 puntos al ganador", () => {
            const juego = new JuegoTruco(2, 30, () => 0);

            juego.jugadores[0].cartas = [
                { id: "espadas-07", palo: "espadas", valor: 7 },
                { id: "espadas-06", palo: "espadas", valor: 6 },
                { id: "oros-12", palo: "oros", valor: 12 }
            ]; // 33 de envido
            juego.jugadores[1].cartas = [
                { id: "bastos-07", palo: "bastos", valor: 7 },
                { id: "bastos-05", palo: "bastos", valor: 5 },
                { id: "copas-10", palo: "copas", valor: 10 }
            ]; // 32 de envido

            juego.cantarEnvido("j1", "ENVIDO");
            const res = juego.responderEnvido("j2", "aceptar");

            expect(res).toEqual({
                ok: true,
                envidoResuelto: true,
                ganador: "A",
                tantosGanadores: 33,
                puntosGanados: 2
            });
            expect(juego.puntos).toEqual({ A: 2, B: 0 });
        });

        test("en caso de empate en tantos, gana el equipo que es mano en esa ronda", () => {
            // Caso 1: j2 (Equipo B) es mano
            const juegoManoB = new JuegoTruco(2, 30, () => 0.9);
            juegoManoB.jugadores[0].cartas = [
                { id: "espadas-07", palo: "espadas", valor: 7 },
                { id: "oros-10", palo: "oros", valor: 10 },
                { id: "copas-11", palo: "copas", valor: 11 }
            ]; // 7
            juegoManoB.jugadores[1].cartas = [
                { id: "bastos-07", palo: "bastos", valor: 7 },
                { id: "oros-12", palo: "oros", valor: 12 },
                { id: "copas-10", palo: "copas", valor: 10 }
            ]; // 7

            juegoManoB.cantarEnvido("j2", "ENVIDO");
            const res = juegoManoB.responderEnvido("j1", "aceptar");

            expect(res.ganador).toBe("B");
            expect(res.tantosGanadores).toBe(7);
        });

        test("encadena Envido -> Real Envido y al rechazar suma los puntos del canto anterior (2 pts)", () => {
            const juego = new JuegoTruco(2, 30, () => 0);

            juego.cantarEnvido("j1", "ENVIDO");
            juego.responderEnvido("j2", "subir", "REAL_ENVIDO");
            const res = juego.responderEnvido("j1", "rechazar");

            expect(res).toEqual({
                ok: true,
                envidoResuelto: true,
                ganador: "B",
                puntosGanados: 2
            });
            expect(juego.puntos).toEqual({ A: 0, B: 2 });
        });

        test("aplica la regla 'el envido está primero' si cantan Truco en primera baza", () => {
            const juego = new JuegoTruco(2, 30, () => 0); // j1 mano

            juego.cantarTruco("j1");
            expect(juego.estadoTruco.pendiente).toBe(true);

            // j2 responde cantando Envido encima del Truco en primera
            const envidoPrimero = juego.cantarEnvido("j2", "ENVIDO");

            expect(envidoPrimero.ok).toBe(true);
            expect(juego.estadoTruco.pendiente).toBe(false);
            expect(juego.estadoTruco.nivel).toBe(0);
            expect(juego.estadoEnvido.pendiente).toBe(true);
        });
    });

    describe("Irse al mazo y fin de partida", () => {
        test("irse al mazo en primera sin haberse jugado el envido otorga 2 puntos al rival", () => {
            const juego = new JuegoTruco(2, 30, () => 0);

            const res = juego.irseAlMazo("j1");

            expect(res).toEqual({
                ok: true,
                rondaTerminada: true,
                ganadorRonda: "B",
                puntosGanados: 2
            });
            expect(juego.puntos.B).toBe(2);
        });

        test("finaliza la partida cuando un equipo alcanza el límite de puntos", () => {
            const juego = new JuegoTruco(2, 2, () => 0); // Partida corta a 2 puntos

            juego.irseAlMazo("j1"); // Le da 2 puntos a B

            expect(juego.partidaTerminada).toBe(true);
            expect(juego.ganadorPartida).toBe("B");
            expect(juego.cantarTruco("j2")).toEqual({ error: "La partida ya terminó" });
        });
    });
});

function resPropiedades(obj) {
    return {
        ok: obj.ok,
        rondaTerminada: obj.rondaTerminada,
        ganadorRonda: obj.ganadorRonda,
        puntosGanados: obj.puntosGanados
    };
}