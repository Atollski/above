/**
 * Simple Lehmer seeded random number generator
 * https://en.wikipedia.org/wiki/Lehmer_random_number_generator
 * @type type
 */
export class SeededRandom {
	constructor(seed) {
		this.modulo = 0x7fffffff; // 2147483647
		this.multiplier = 48271; // 
		this.state = seed >>> 0; // convert to unsigned int
	}
	
	get next() {
		this.state = this.state * this.multiplier % this.modulo; // calculate the next value
		return this.state / (this.modulo + 1); // 0 <= x < 1
	}
}
