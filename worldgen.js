/* global THREE, Ammo */
import {SeededRandom} from './random.js';

export class WorldGen {
	/**
	 * Create a world generation system to create terrain and content for the world.
	 * @param {Object} world the world this builder will put its content in
	 * @param {Object} settings parameters for the world generator:
	 * <b>size</b> The size of each chunk
	 * <b>segments</b> The number of segments each chunk is divided into
	 * <b>viewDistance</b> The distance around the player the chunks get generated
	 *
	 * @returns {undefined}
	 */
	constructor(world, settings) {
		this.settings = Object.assign ({size: 100, viewDistance: 700}, settings);
		this.chunks = {};
		
		this.generateChunks(world, settings);
	}
	
	/**
	 * Generate chunks around camera position
	 * @param {type} world
	 * @param {type} settings
	 * @returns {undefined}
	 */
	generateChunks(world, settings) {
		settings = Object.assign(this.settings, settings);
		
		// convert position to an index
		let xcentre = Math.round(world.camera.position.x / settings.size);
		let zcentre = Math.round(world.camera.position.z / settings.size);
		let validChunks = [];
		
		let chunkRadius = Math.ceil(settings.viewDistance / settings.size);
		
		for (let xindex = xcentre - chunkRadius; xindex <= xcentre + chunkRadius; xindex++) {
			for (let zindex = zcentre - chunkRadius; zindex <= zcentre + chunkRadius; zindex++) {
				let chunkName = xindex + "," + zindex;
				if (!this.chunks[chunkName]) {
					this.chunks[chunkName] = new Chunk(world, Object.assign(settings,{x: xindex * settings.size , z: zindex * settings.size}));
				}
				validChunks.push(this.chunks[chunkName]);
			}
		}
		
		// cull things
		for (let chunk in this.chunks) {
			if (validChunks.includes(this.chunks[chunk]) === false) {
				this.chunks[chunk].destroy();
				delete this.chunks[chunk];
			}
		}
	}
}

export class Chunk {
	constructor(world, settings) {
		settings = Object.assign (
			{
				x: 0
				,z: 0
				, size: 100
				, segments: 32
			}, settings
		);

		this.ownedObjects = [];
		this.world = world;
		
		{ // build the terrain height map
			let heightMap = Chunk.generateHeightMap(settings.x, settings.z, settings.size, settings.segments, world.seed); // example terrain
			const geometry = new THREE.PlaneGeometry(settings.size, settings.size, settings.segments, settings.segments);
			geometry.rotateX(-Math.PI / 2); // adjust rotation to match physics
			const vertices = geometry.attributes.position.array;

			for (let i=0, j=0, l=vertices.length; i<l; i++, j+=3) {
				vertices[j + 1] = heightMap[i]; // use generated height map
			}

			geometry.computeVertexNormals();
			let colour = 0x004000;
			colour = Math.floor(Math.random()*16777215);
			colour &= 0x00ff00;
			colour |= 0x008000;
			
			let terrain = new THREE.Mesh(geometry, new THREE.MeshPhongMaterial({color: colour}));
//			let terrain = new THREE.Mesh(geometry, new THREE.MeshPhongMaterial({color: 0x004000}));

			terrain.castShadow = true;
			terrain.receiveShadow = true;
			terrain.position.set(settings.x + settings.size / 2, 0,settings.z + settings.size / 2);
			this.world.scene.add(terrain);
			terrain.ammoRigidBody({physicsWorld: this.world.physicsWorld}, 1); // collision group 1 represents terrain
			this.ownedObjects.push(terrain);
		}
		
		{ // add the ocean
			const geometry = new THREE.PlaneGeometry(settings.size, settings.size, 1, 1);
			let ocean = new THREE.Mesh(geometry, new THREE.MeshPhongMaterial({color: 0x0000ff}));
			ocean.rotateX( - Math.PI / 2 );
			ocean.material.transparent = true;
			ocean.material.opacity = 0.5;
			ocean.receiveShadow = true;
			ocean.position.set(settings.x + (settings.size / 2),0,settings.z + (settings.size / 2));
			this.world.scene.add(ocean);
			this.ownedObjects.push(ocean);
		}
	}
	
	/**
	 * Interpolate between two values
	 * @param {type} a0 first value
	 * @param {type} a1 second value
	 * @param {type} w weight
	 * @returns {Number}
	 */
	static interpolate(a0, a1, w) {
//		return (a1 - a0) * w + a0; // linear interpolation
//		return (a1 - a0) * (3.0 - w * 2.0) * w * w + a0; // cubic interpolation (smoothstep)
		return (a1 - a0) * ((w * (w * 6.0 - 15.0) + 10.0) * w * w * w) + a0; // smootherstep
	}
	
	/**
	 * 
	 * @param {type} x
	 * @param {type} z
	 * @returns {Chunk.randomGradient.worldgenAnonym$6}
	 */
	static randomGradient(x, z) {
		let w = 32; // length of an unsigned value
		let s = w / 2; // rotation width
		x >>>= 0; // convert to unsigned value
		z >>>= 0; // convert to unsigned value
		x *= 3284157443; z ^= x << s | x >> w-s;
		z *= 1911520717; x ^= z << s | z >> w-s;
		x *= 2048419325;
		let random = x * (Math.PI / ~(~0 >>> 1)); // in [0, 2*Pi]
		return {x: Math.cos(random), z: Math.sin(random)};
	}
	
	// Computes the dot product of the distance and gradient vectors.
	static dotGridGradient(ix, iz, x, z) {
		// Get gradient from integer coordinates
		let gradient = Chunk.randomGradient(ix, iz);

		// Compute the distance vector
		let dx = x - ix;
		let dz = z - iz;

		// Compute the dot-product
		return (dx*gradient.x + dz*gradient.z);
	}

	// Compute Perlin noise at coordinates x, y
	static perlin(x, z) {
		let perlinScale = 600;
		let extremity = 140;
		x /= perlinScale;
		z /= perlinScale;
		
		// Determine grid cell coordinates
		let x0 = Math.floor(x);
		let x1 = x0 + 1;
		let z0 = Math.floor(z);
		let z1 = z0 + 1;

		// Determine interpolation weights
		// Could also use higher order polynomial/s-curve here
		let sx = x - x0;
		let sz = z - z0;

		// Interpolate between grid point gradients
		let n0 = Chunk.dotGridGradient(x0, z0, x, z);
		let n1 = Chunk.dotGridGradient(x1, z0, x, z);
		let ix0 = Chunk.interpolate(n0, n1, sx);

		n0 = Chunk.dotGridGradient(x0, z1, x, z);
		n1 = Chunk.dotGridGradient(x1, z1, x, z);
		let ix1 = Chunk.interpolate(n0, n1, sx);

		let value = Chunk.interpolate(ix0, ix1, sz);
		return value * extremity; // Will return in range -1 to 1. To make it in range 0 to 1, multiply by 0.5 and add 0.5
	}
	
	/**
	 * Create a height map of land given co-ordinates and 
	 * @param {type} x
	 * @param {type} z
	 * @param {type} size the size of each chunk
	 * @param {type} segments the number of segments in each chunk
	 * @param {type} seed
	 * @returns {undefined}
	 */
	static generateHeightMap(x, z, size, segments, seed) {
//		let random = new SeededRandom(seed);
		const data = new Float32Array(Math.pow((segments + 1),2));
		let height = 0;
		let segmentSize = (size / (segments));
		for (let xindex = 0; xindex < segments + 1; xindex++) {
			for (let zindex = 0; zindex < segments + 1; zindex++) {
				height = Chunk.perlin(x + xindex * segmentSize, z + zindex * segmentSize);
				data[zindex * (segments + 1) + xindex] = height; // random height map
			}
		}
		
		return data;
	}
	
	/**
	 * Destroy the chunk and all objects within.
	 * @returns {undefined}
	 */
	destroy() {
		let physicsBody = null;
		if (this.ownedObjects) {
			for (let index = this.ownedObjects.length - 1; index >= 0; index--) {
				physicsBody = this.ownedObjects[index].userData.physicsBody;
				if (physicsBody) {
					if (physicsBody.physicsWorld) { // this physics body exists in a physics world
						physicsBody.physicsWorld.removeRigidBody(physicsBody);
					}
					
					// the heap appears to be unmanageable, try recycling the addresses... but this does not seem to work
					if (physicsBody.heapAddress) {
						Ammo.freeHeap = Ammo.freeHeap || [];
						Ammo.freeHeap.push(physicsBody.heapAddress);
					}
					
					// the physics body is destroyed OK but the heap remains allocated
					Ammo.destroy(physicsBody);
					this.ownedObjects[index].userData.physicsBody = null;
				}
				this.world.scene.remove(this.ownedObjects[index]);
				this.ownedObjects[index].geometry.dispose();
				this.ownedObjects[index].material.dispose(); // might need to do textures at some point
			}
		}
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