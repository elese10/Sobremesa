const {
    crearMazo,
    mazoRandom,
    obtenerFuerza,
    compararCartas
} = require("../src/engine/cards.js");

function buscarCarta(mazo, palo, valor) {
    return mazo.find(carta => carta.palo === palo && carta.valor === valor);
}

test("crea 40 cartas sin ochos ni nueves", () => {
    const mazo = crearMazo();
    expect(mazo).toHaveLength(40);
    expect(new Set(mazo.map(carta => carta.id)).size).toBe(40);
    expect(mazo.some(carta => [8, 9].includes(carta.valor))).toBe(false);
});

test("mezcla las cartas sin perderlas ni modificar el mazo original", () => {
    const mazo = crearMazo();
    const idsOriginales = mazo.map(carta => carta.id);
    const mezclado = mazoRandom(mazo, () => 0);
    expect(mezclado).toHaveLength(40);
    expect(mezclado).not.toBe(mazo);
    expect(mezclado.map(carta => carta.id).sort()).toEqual([...idsOriginales].sort());
    expect(mazo.map(carta => carta.id)).toEqual(idsOriginales);
    expect(mezclado.map(carta => carta.id)).not.toEqual(idsOriginales);
});

test("el 1 de espadas le gana al 1 de bastos", () => {
    const mazo = crearMazo();
    const espada = buscarCarta(mazo, "espadas", 1);
    const basto = buscarCarta(mazo, "bastos", 1);

    expect(compararCartas(espada, basto)).toBe(1);
});

test("el 7 de oros le gana al 7 de copas", () => {
    const mazo = crearMazo();
    const oro = buscarCarta(mazo, "oros", 7);
    const copa = buscarCarta(mazo, "copas", 7);

    expect(compararCartas(oro, copa)).toBe(1);
});

test("el 1 de oros empata con el 1 de copas", () => {
    const mazo = crearMazo();
    const oro = buscarCarta(mazo, "oros", 1);
    const copa = buscarCarta(mazo, "copas", 1);

    expect(compararCartas(oro, copa)).toBe(0);
});

test("todas las cartas del mazo tienen una fuerza asignada", () => {
    const mazo = crearMazo();

    expect(mazo.every(carta => Number.isInteger(obtenerFuerza(carta)))).toBe(true);
});