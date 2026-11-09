const palos = ["oros", "copas", "espadas", "bastos"];
const valores = [1,2,3,4,5,6,7,10,11,12];

function idsDeValor(valor, palosIncluidos = palos) {
    const numero = String(valor).padStart(2, "0");
    const ids = [];
    for (let i = 0; i < palosIncluidos.length; i++) {
        ids.push(`${palosIncluidos[i]}-${numero}`);
    }
    return ids;
}

const gruposDeFuerza = [
    ["espadas-01"],
    ["bastos-01"],
    ["espadas-07"],
    ["oros-07"],
    idsDeValor(3),
    idsDeValor(2),
    ["oros-01", "copas-01"],
    idsDeValor(12),
    idsDeValor(11),
    idsDeValor(10),
    idsDeValor(7, ["bastos", "copas"]),
    idsDeValor(6),
    idsDeValor(5),
    idsDeValor(4)
];

const fuerzaPorId = new Map();
for (let i = 0; i < gruposDeFuerza.length; i++) {
    const fuerza = gruposDeFuerza.length - i;

    for (let j = 0; j < gruposDeFuerza[i].length; j++) {
        fuerzaPorId.set(gruposDeFuerza[i][j], fuerza);
    }
}

function crearMazo() {
    const mazo = [];
    for (let i = 0; i < palos.length; i++) {
        for (let j = 0; j < valores.length; j++) {
            const palo = palos[i];
            const valor = valores[j];
            const numero = String(valor).padStart(2,"0");

            mazo.push({
                id: `${palo}-${numero}`,
                palo: palo,
                valor: valor
            })
        }
    }
    return mazo;
}

function mazoRandom(mazo, azar = Math.random) {
    const shuffled = [...mazo];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(azar() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}
function obtenerFuerza(carta) {
    if (!carta || !fuerzaPorId.has(carta.id)) {
        throw new Error("La carta no tiene un id válido para las reglas del truco.");
    }
    return fuerzaPorId.get(carta.id);
}
function compararCartas(cartaA, cartaB) {
    const diferencia = obtenerFuerza(cartaA) - obtenerFuerza(cartaB);

    if (diferencia === 0) {
        return 0;
    }
    return diferencia > 0 ? 1 : -1;
}

module.exports = { crearMazo, mazoRandom, obtenerFuerza, compararCartas };