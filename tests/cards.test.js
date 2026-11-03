const { crearMazo, mazoRandom } = require("../src/engine/cards");

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