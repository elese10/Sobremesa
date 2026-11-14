const {
    resolverBaza,
    resolverRonda,
    cantarTruco,
    responderTruco,
    calcularEnvido
} = require("../src/engine/rules.js");

function crearEstadoTruco() {
    return {
        nivel: 0,
        pendiente: false,
        equipoQueCanto: null,
        equipoQueDebeResponder: null,
        equipoQuePuedeSubir: null
    };
}

describe("resolverBaza()", () => {

    test("Debe ganar el equipo con la carta más fuerte", () => {
        const jugadas = [
            { equipo: "A", carta: { id: "bastos-01" } },
            { equipo: "B", carta: { id: "espadas-01" } }
        ];

        const resultado = resolverBaza(jugadas);

        expect(resultado).toEqual({
            ganador: "B",
            empate: false
        });
    });

    test("Debe detectar un empate entre equipos", () => {
        const jugadas = [
            { equipo: "A", carta: { id: "oros-01" } },
            { equipo: "B", carta: { id: "copas-01" } }
        ];

        const resultado = resolverBaza(jugadas);

        expect(resultado.empate).toBe(true);
        expect(resultado.ganador).toBe(null);
    });

});

describe("resolverRonda()", () => {

    test("Debe ganar el equipo que consigue dos bazas", () => {
        const resultados = [
            { ganador: "A", empate: false },
            { ganador: "A", empate: false }
        ];

        const resultado = resolverRonda(resultados, "A");

        expect(resultado.ganador).toBe("A");
    });

    test("Debe ganar A cuando gana la primera y empata la segunda", () => {
        const resultados = [
            { ganador: "A", empate: false },
            { ganador: null, empate: true }
        ];

        const resultado = resolverRonda(resultados, "A");

        expect(resultado.ganador).toBe("A");
    });

});

describe("cantarTruco() y responderTruco()", () => {
    test("Debe permitir subir directamente de Truco a Retruco", () => {
        let estado = crearEstadoTruco();

        const truco = cantarTruco(estado, "A", 1);
        estado = truco.nuevoEstado;

        const retruco = responderTruco(estado, "B", "subir");

        expect(retruco.nuevoEstado).toMatchObject({
            nivel: 2,
            pendiente: true,
            equipoQueCanto: "B",
            equipoQueDebeResponder: "A",
            equipoQuePuedeSubir: null
        });
    });

    test("Debe permitir subir directamente de Retruco a Vale Cuatro", () => {
        let estado = crearEstadoTruco();
        const truco = cantarTruco(estado, "A", 1);
        estado = truco.nuevoEstado;
        const retruco = responderTruco(estado, "B", "subir");
        estado = retruco.nuevoEstado;
        const valeCuatro = responderTruco(estado, "A", "subir");
        expect(valeCuatro.nuevoEstado).toMatchObject({
            nivel: 3,
            pendiente: true,
            equipoQueCanto: "A",
            equipoQueDebeResponder: "B",
            equipoQuePuedeSubir: null
        });
    });

    test("No debe permitir subir después de Vale Cuatro", () => {
        let estado = crearEstadoTruco();

        estado = cantarTruco(estado, "A", 1).nuevoEstado;
        estado = responderTruco(estado, "B", "subir").nuevoEstado;
        estado = responderTruco(estado, "A", "subir").nuevoEstado;

        const resultado = responderTruco(estado, "B", "subir");

        expect(resultado).toEqual({
            error: "Ya se cantó Vale 4, no se puede subir más"
        });
    });

    test("Debe permitir cantar Retruco después de aceptar Truco", () => {
        let estado = crearEstadoTruco();

        estado = cantarTruco(estado, "A", 1).nuevoEstado;

        const aceptacion = responderTruco(estado, "B", "aceptar");
        estado = aceptacion.nuevoEstado;

        expect(estado.equipoQuePuedeSubir).toBe("B");

        const retruco = cantarTruco(estado, "B", 2);

        expect(retruco.nuevoEstado).toMatchObject({
            nivel: 2,
            pendiente: true,
            equipoQueCanto: "B",
            equipoQueDebeResponder: "A"
        });
    });
});

describe("calcularEnvido()", () => {
    test("Debe calcular 33 puntos con dos cartas del mismo palo", () => {
        const cartas = [
            { id: "espadas-07" },
            { id: "espadas-06" },
            { id: "oros-12" }
        ];

        expect(calcularEnvido(cartas)).toBe(33);
    });
})