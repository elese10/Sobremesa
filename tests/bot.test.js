const { JuegoTruco } = require("../src/engine/game.js");
const { decidirJugadaBot, ejecutarTurnoBot } = require("../src/ai/bot.js");

describe("AI - Orquestador del Bot (decidirJugadaBot y ejecutarTurnoBot)", () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    test("devuelve null cuando no es turno del bot y lanza error si el botId no existe", () => {
        const juego = new JuegoTruco(2, 30, () => 0); // Arranca j1

        expect(decidirJugadaBot(juego, "j2", 50)).toBeNull();
        expect(() => decidirJugadaBot(juego, "j99", 50)).toThrow("No existe el jugador j99");
    });

    test("aplica la regla 'el envido está primero' si el humano canta Truco en primera y el bot tiene 33", () => {
        const juego = new JuegoTruco(2, 30, () => 0); // j1 mano

        juego.jugadores[1].cartas = [
            { id: "espadas-07", palo: "espadas", valor: 7 },
            { id: "espadas-06", palo: "espadas", valor: 6 },
            { id: "oros-12", palo: "oros", valor: 12 }
        ]; // 33 de envido

        juego.cantarTruco("j1");
        const ejecucion = ejecutarTurnoBot(juego, "j2");

        expect(ejecucion.decision.tipo).toBe("CANTAR_ENVIDO");
        expect(juego.estadoTruco.pendiente).toBe(false);
        expect(juego.estadoEnvido.pendiente).toBe(true);
        expect(juego.estadoEnvido.equipoQueDebeResponder).toBe("A");
    });

    test("responde al envido del humano y actualiza el marcador al aceptar", () => {
        const juego = new JuegoTruco(2, 30, () => 0);

        juego.jugadores[0].cartas = [
            { id: "bastos-07", palo: "bastos", valor: 7 },
            { id: "bastos-05", palo: "bastos", valor: 5 },
            { id: "copas-10", palo: "copas", valor: 10 }
        ]; // 32
        juego.jugadores[1].cartas = [
            { id: "espadas-07", palo: "espadas", valor: 7 },
            { id: "espadas-06", palo: "espadas", valor: 6 },
            { id: "oros-12", palo: "oros", valor: 12 }
        ]; // 33

        juego.cantarEnvido("j1", "ENVIDO");
        const ejecucion = ejecutarTurnoBot(juego, "j2");

        // Con 33 sube a REAL_ENVIDO
        expect(ejecucion.decision).toEqual({
            tipo: "RESPONDER_ENVIDO",
            accion: "subir",
            nuevoCanto: "REAL_ENVIDO"
        });
        expect(juego.estadoEnvido.cantos).toEqual(["ENVIDO", "REAL_ENVIDO"]);
    });

    test("se va al mazo en segunda baza cuando la mano es matemáticamente imposible (< 8%)", () => {
        const juego = new JuegoTruco(2, 30, () => 0); // j1 mano

        juego.jugadores[0].cartas = [
            { id: "espadas-01", palo: "espadas", valor: 1 },
            { id: "bastos-01", palo: "bastos", valor: 1 },
            { id: "espadas-07", palo: "espadas", valor: 7 }
        ];
        juego.jugadores[1].cartas = [
            { id: "bastos-04", palo: "bastos", valor: 4 },
            { id: "copas-04", palo: "copas", valor: 4 },
            { id: "oros-04", palo: "oros", valor: 4 }
        ];

        // Baza 1: gana j1
        juego.jugarCarta("j1", "espadas-01");
        juego.jugarCarta("j2", "bastos-04");

        // Baza 2: j1 tira ancho de bastos; j2 solo tiene cuatros (0% de ganar)
        juego.jugarCarta("j1", "bastos-01");

        const ejecucion = ejecutarTurnoBot(juego, "j2");
        expect(ejecucion.decision).toEqual({ tipo: "IRSE_AL_MAZO" });
        expect(juego.puntos.A).toBe(1);
    });

    test("juega una carta válida en su turno cuando no corresponde cantar ni irse al mazo", () => {
        jest.spyOn(Math, "random").mockReturnValue(0.9); // Evita faroles aleatorios
        const juego = new JuegoTruco(2, 30, () => 0.9); // j2 es mano

        // Mano neutra: ni envido alto ni truco seguro
        juego.jugadores[1].cartas = [
            { id: "espadas-12", palo: "espadas", valor: 12 },
            { id: "bastos-11", palo: "bastos", valor: 11 },
            { id: "oros-10", palo: "oros", valor: 10 }
        ];

        const ejecucion = ejecutarTurnoBot(juego, "j2");

        expect(ejecucion.decision.tipo).toBe("JUGAR_CARTA");
        expect(["espadas-12", "bastos-11", "oros-10"]).toContain(ejecucion.decision.cartaId);
        expect(juego.obtenerJugador("j2").cartas).toHaveLength(2);
        expect(juego.obtenerJugadorTurno().id).toBe("j1");
    });
});