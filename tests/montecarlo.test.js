const { JuegoTruco } = require("../src/engine/game.js");
const { calcularEnvido } = require("../src/engine/rules.js");
const { generarMundosPosibles, evaluarCartasConMonteCarlo } = require("../src/ai/montecarlo.js");

describe("AI - Monte Carlo y Minimax", () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe("generarMundosPosibles", () => {
        test("no incluye cartas de la mano del bot ni cartas ya jugadas en la ronda", () => {
            const juego = new JuegoTruco(2, 30, () => 0); // j1 mano
            const bot = juego.obtenerJugador("j2");

            juego.jugadores[0].cartas = [
                { id: "espadas-01", palo: "espadas", valor: 1 },
                { id: "oros-05", palo: "oros", valor: 5 },
                { id: "copas-06", palo: "copas", valor: 6 }
            ];
            bot.cartas = [
                { id: "bastos-01", palo: "bastos", valor: 1 },
                { id: "espadas-07", palo: "espadas", valor: 7 },
                { id: "oros-07", palo: "oros", valor: 7 }
            ];

            // j1 juega el ancho de espadas
            juego.jugarCarta("j1", "espadas-01");

            const mundos = generarMundosPosibles(juego, bot, 100);
            const prohibidas = new Set(["bastos-01", "espadas-07", "oros-07", "espadas-01"]);

            expect(mundos).toHaveLength(100);
            for (const manoRival of mundos) {
                // Al rival le quedan 2 cartas porque ya tiró 1
                expect(manoRival).toHaveLength(2);
                for (const carta of manoRival) {
                    expect(prohibidas.has(carta.id)).toBe(false);
                }
            }
        });

        test("sesga los mundos hacia manos con >= 26 de envido cuando el rival ya cantó envido", () => {
            const juego = new JuegoTruco(2, 30, () => 0);
            const bot = juego.obtenerJugador("j2");

            juego.cantarEnvido("j1", "ENVIDO");

            const mundos = generarMundosPosibles(juego, bot, 200);
            const mundosConBuenEnvido = mundos.filter(m => calcularEnvido(m) >= 26).length;

            // Sin sesgo rondaría el ~35%; con el filtro de creencias supera ampliamente el 65%
            expect(mundosConBuenEnvido / mundos.length).toBeGreaterThan(0.65);
        });
    });

    describe("evaluarCartasConMonteCarlo", () => {
        test("calcula winRate = 1 con cartas imbatibles y winRate = 0 cuando la ronda está perdida", () => {
            const juego = new JuegoTruco(2, 30, () => 0); // j1 mano
            const bot = juego.obtenerJugador("j2");

            // Bot tiene los 3 mejores naipes del mazo
            bot.cartas = [
                { id: "espadas-01", palo: "espadas", valor: 1 },
                { id: "bastos-01", palo: "bastos", valor: 1 },
                { id: "espadas-07", palo: "espadas", valor: 7 }
            ];

            const mundos = generarMundosPosibles(juego, bot, 80);
            const evalImbatible = evaluarCartasConMonteCarlo(juego, bot, mundos);

            expect(evalImbatible[0].winRate).toBe(1);

            juego.resultadosBazas = [{ ganador: "A", empate: false }];
            juego.bazaActual = [
                { jugadorId: "j1", equipo: "A", carta: { id: "espadas-01", palo: "espadas", valor: 1 } }
            ];
            bot.cartas = [
                { id: "copas-04", palo: "copas", valor: 4 },
                { id: "oros-04", palo: "oros", valor: 4 }
            ];

            const evalPerdida = evaluarCartasConMonteCarlo(juego, bot, mundos);
            expect(evalPerdida[0].winRate).toBe(0);
        });

        test("aplica el desempate táctico de matar con lo justo al responder en una baza", () => {
            const juego = new JuegoTruco(2, 30, () => 0); // j1 mano
            const bot = juego.obtenerJugador("j2");

            // j1 tiró un 10 de espadas; el bot tiene un 3 (mata justo) y el 1 de espadas (sobra)
            juego.bazaActual = [
                { jugadorId: "j1", equipo: "A", carta: { id: "espadas-10", palo: "espadas", valor: 10 } }
            ];
            bot.cartas = [
                { id: "espadas-01", palo: "espadas", valor: 1 },
                { id: "espadas-03", palo: "espadas", valor: 3 },
                { id: "bastos-01", palo: "bastos", valor: 1 }
            ];

            const mundos = [
                [
                    { id: "copas-04", palo: "copas", valor: 4 },
                    { id: "oros-04", palo: "oros", valor: 4 }
                ]
            ];

            const evaluaciones = evaluarCartasConMonteCarlo(juego, bot, mundos);
            expect(evaluaciones[0].carta.id).toBe("espadas-03");
        });
    });
});