const { JuegoTruco } = require("../src/engine/game.js");
const { decidirEnvido, decidirTruco } = require("../src/ai/heuristics.js");

describe("AI - Heurísticas de Envido y Truco", () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe("decidirEnvido", () => {
        test("canta ENVIDO con 27 tantos y REAL_ENVIDO con 31 tantos en primera baza", () => {
            const juego = new JuegoTruco(2, 30, () => 0.9); // j2 (bot) es mano
            const bot = juego.obtenerJugador("j2");

            // 27 tantos (7 + 0 de sota + 20)
            bot.cartas = [
                { id: "espadas-07", palo: "espadas", valor: 7 },
                { id: "espadas-10", palo: "espadas", valor: 10 },
                { id: "oros-04", palo: "oros", valor: 4 }
            ];
            const mundos = [
                [
                    { id: "copas-04", palo: "copas", valor: 4 },
                    { id: "bastos-05", palo: "bastos", valor: 5 },
                    { id: "oros-06", palo: "oros", valor: 6 }
                ]
            ];

            expect(decidirEnvido(juego, bot, mundos, false)).toEqual({
                tipo: "CANTAR_ENVIDO",
                tipoCanto: "ENVIDO"
            });

            // 31 tantos (7 + 4 + 20) con winRate alto -> REAL_ENVIDO
            bot.cartas = [
                { id: "espadas-07", palo: "espadas", valor: 7 },
                { id: "espadas-04", palo: "espadas", valor: 4 },
                { id: "oros-04", palo: "oros", valor: 4 }
            ];
            expect(decidirEnvido(juego, bot, mundos, false)).toEqual({
                tipo: "CANTAR_ENVIDO",
                tipoCanto: "REAL_ENVIDO"
            });
        });

        test("canta FALTA_ENVIDO directo con 32+ tantos cuando le faltan <= 8 puntos para ganar", () => {
            const juego = new JuegoTruco(2, 30, () => 0.9);
            const bot = juego.obtenerJugador("j2");
            juego.puntos.B = 24; // Le faltan 6 puntos

            bot.cartas = [
                { id: "espadas-07", palo: "espadas", valor: 7 },
                { id: "espadas-06", palo: "espadas", valor: 6 },
                { id: "oros-12", palo: "oros", valor: 12 }
            ];
            const mundos = [
                [
                    { id: "copas-04", palo: "copas", valor: 4 },
                    { id: "bastos-05", palo: "bastos", valor: 5 },
                    { id: "oros-06", palo: "oros", valor: 6 }
                ]
            ];

            expect(decidirEnvido(juego, bot, mundos, false)).toEqual({
                tipo: "CANTAR_ENVIDO",
                tipoCanto: "FALTA_ENVIDO"
            });
        });

        test("maneja correctamente el farol de envido cuando es pie (< 24 tantos)", () => {
            const juego = new JuegoTruco(2, 30, () => 0); // j1 es mano -> j2 es pie
            const bot = juego.obtenerJugador("j2");
            bot.cartas = [
                { id: "espadas-04", palo: "espadas", valor: 4 },
                { id: "oros-05", palo: "oros", valor: 5 },
                { id: "copas-06", palo: "copas", valor: 6 }
            ]; // 6 tantos

            // Con random < 0.14 mete mentira
            jest.spyOn(Math, "random").mockReturnValue(0.05);
            expect(decidirEnvido(juego, bot, [], false)).toEqual({
                tipo: "CANTAR_ENVIDO",
                tipoCanto: "ENVIDO"
            });

            // Con random >= 0.14 no canta
            jest.spyOn(Math, "random").mockReturnValue(0.5);
            expect(decidirEnvido(juego, bot, [], false)).toBeNull();
        });

        test("en modo respuesta: sube con 31, acepta con EV positivo y rechaza con mano mala", () => {
            const juego = new JuegoTruco(2, 30, () => 0);
            const bot = juego.obtenerJugador("j2");
            juego.cantarEnvido("j1", "ENVIDO");

            const mundoRival27 = [
                [
                    { id: "copas-07", palo: "copas", valor: 7 },
                    { id: "copas-10", palo: "copas", valor: 10 },
                    { id: "oros-04", palo: "oros", valor: 4 }
                ]
            ];

            // 31 tantos -> sube a REAL_ENVIDO
            bot.cartas = [
                { id: "espadas-07", palo: "espadas", valor: 7 },
                { id: "espadas-04", palo: "espadas", valor: 4 },
                { id: "oros-12", palo: "oros", valor: 12 }
            ];
            expect(decidirEnvido(juego, bot, mundoRival27, true)).toEqual({
                tipo: "RESPONDER_ENVIDO",
                accion: "subir",
                nuevoCanto: "REAL_ENVIDO"
            });

            // 5 tantos -> rechaza
            bot.cartas = [
                { id: "espadas-04", palo: "espadas", valor: 4 },
                { id: "bastos-05", palo: "bastos", valor: 5 },
                { id: "oros-12", palo: "oros", valor: 12 }
            ];
            expect(decidirEnvido(juego, bot, mundoRival27, true)).toEqual({
                tipo: "RESPONDER_ENVIDO",
                accion: "rechazar"
            });
        });
    });

    describe("decidirTruco", () => {
        test("canta TRUCO cuando winRate >= 0.62 y respeta el turno de subida", () => {
            const juego = new JuegoTruco(2, 30, () => 0.9);
            const bot = juego.obtenerJugador("j2");

            expect(decidirTruco(juego, bot, 0.65, false)).toEqual({ tipo: "CANTAR_TRUCO" });
            expect(decidirTruco(juego, bot, 0.50, false)).toBeNull();

            // Si el equipo A tiene el derecho a subir, el bot no puede cantar
            juego.estadoTruco.nivel = 1;
            juego.estadoTruco.equipoQuePuedeSubir = "A";
            expect(decidirTruco(juego, bot, 0.95, false)).toBeNull();
        });

        test("en modo respuesta: sube con >= 0.78, rechaza con mano mala y acepta en match point rival", () => {
            const juego = new JuegoTruco(2, 30, () => 0);
            const bot = juego.obtenerJugador("j2");
            juego.cantarTruco("j1");

            expect(decidirTruco(juego, bot, 0.82, true)).toEqual({
                tipo: "RESPONDER_TRUCO",
                accion: "subir"
            });

            expect(decidirTruco(juego, bot, 0.15, true)).toEqual({
                tipo: "RESPONDER_TRUCO",
                accion: "rechazar"
            });

            // Rival a 1 punto de ganar (match point) -> acepta con 0.30 para defenderse
            juego.puntos.A = 29;
            expect(decidirTruco(juego, bot, 0.30, true)).toEqual({
                tipo: "RESPONDER_TRUCO",
                accion: "aceptar"
            });
        });
    });
});