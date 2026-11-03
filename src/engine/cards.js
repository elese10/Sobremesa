const palos = ["oros", "copas", "espadas", "bastos"];
const valores = [1,2,3,4,5,6,7,10,11,12];

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


module.exports = { crearMazo, mazoRandom };