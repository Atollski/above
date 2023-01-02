/* global THREE, Ammo */
import {SeededRandom} from './random.js';

export class Terrain extends THREE.Mesh {
	constructor(world, settings) {
//		let heightData = generateHeight(16, 16, -7, 2); // example terrain
		let chunkSize = 564;
		let heightData = Terrain.generateChunk(0, 0, chunkSize, 69420); // example terrain

		// build the geometry
		const geometry = new THREE.PlaneGeometry(3500, 3500, chunkSize-1, chunkSize-1);
		geometry.rotateX(-Math.PI / 2);
		const vertices = geometry.attributes.position.array;
		let random = new SeededRandom(95839);
		for (let i=0, j=0, l=vertices.length; i<l; i++, j+=3) {
//			vertices[j + 1] = -1.5 + (random.next * 3); // random height map
			vertices[j + 1] = heightData[i]; // use example height map
		}

		geometry.computeVertexNormals();

		super(geometry, new THREE.MeshPhongMaterial({color: 0x004000}));

		this.castShadow = true;
		this.receiveShadow = true;
		this.position.set(0,0,0);
		world.scene.add(this);
		this.rigidBody({physicsWorld: world.physicsWorld}, 1); // collision group 1 represents terrain
	}
	
	/**
	* Create a chunk of land given co-ordinates and 
	* @param {type} x
	* @param {type} y
	* @param {type} resolution
	* @param {type} seed
	* @returns {undefined}
	*/
   static generateChunk(x, y, resolution, seed) {
		let random = new SeededRandom(seed);
		const data = new Float32Array(resolution * resolution);
		for (let xindex = 0; xindex < resolution; xindex++) {
		   for (let yindex = 0; yindex < resolution; yindex++) {
			   data[xindex * resolution + yindex] = -1.5 + (random.next * 3); // random height map
		   }
		}
		return data;
	}
}

export class Ocean extends THREE.Mesh {
	constructor(world, settings) {
		const geometry = new THREE.PlaneGeometry( 300, 300, 100, 100);
		super(geometry, new THREE.MeshPhongMaterial({color: 0x0000ff}));
		this.rotateX( - Math.PI / 2 );
		this.material.transparent = true;
		this.material.opacity = 0.5;
		this.receiveShadow = true;
		this.position.set(0,0,0);
		world.scene.add(this);
	}
}




// create a height map suitable for the game
function generateHeight(width, depth, minHeight, maxHeight) {
	// Generates the height data (a sinus wave)

	const data = new Float32Array( width * depth );
	const hRange = maxHeight - minHeight;
	const w2 = width / 2;
	const d2 = depth / 2;
	const phaseMult = 12;

	let p = 0;

	for ( let j = 0; j < depth; j ++ ) {
		for ( let i = 0; i < width; i ++ ) {
			const radius = Math.sqrt(
				Math.pow((i - w2 ) / w2, 2.0)
				+Math.pow( ( j - d2 ) / d2, 2.0)
			);

			const height = ( Math.sin( radius * phaseMult ) + 1 ) * 0.5 * hRange + minHeight;
			data[ p ] = height;
			p ++;
		}
	}

	return data;
}