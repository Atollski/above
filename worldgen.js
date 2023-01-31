/* global THREE, Ammo */
import {SeededRandom} from './random.js';

export class WorldGen {
	constructor(world, settings) {
		this.settings = Object.assign ({size: 100}, settings);
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
		
		for (let xindex = xcentre - 5; xindex <= xcentre + 5; xindex++) {
			for (let zindex = zcentre - 5; zindex <= zcentre + 2; zindex++) {
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

class Chunk {
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
			let heightMap = Chunk.generateHeightMap(settings.x, settings.z, settings.segments, world.seed); // example terrain
			const geometry = new THREE.PlaneGeometry(settings.size, settings.size, settings.segments-1, settings.segments-1);
			geometry.rotateX(-Math.PI / 2); // adjust rotation to match physics
			const vertices = geometry.attributes.position.array;

			for (let i=0, j=0, l=vertices.length; i<l; i++, j+=3) {
				vertices[j + 1] = heightMap[i]; // use generated height map
			}

			geometry.computeVertexNormals();

			let terrain = new THREE.Mesh(geometry, new THREE.MeshPhongMaterial({color: 0x004000}));

			terrain.castShadow = true;
			terrain.receiveShadow = true;
			terrain.position.set(settings.x, 0,settings.z);
			this.world.scene.add(terrain);
			terrain.ammoRigidBody({physicsWorld: this.world.physicsWorld}, 1); // collision group 1 represents terrain
			this.ownedObjects.push(terrain);
		}
	}
	
	/**
	 * Create a height map of land given co-ordinates and 
	 * @param {type} x
	 * @param {type} z
	 * @param {type} segments
	 * @param {type} seed
	 * @returns {undefined}
	 */
	static generateHeightMap(x, z, segments, seed) {
		let random = new SeededRandom(seed);
		const data = new Float32Array(segments * segments);
		for (let xindex = 0; xindex < segments; xindex++) {
			for (let yindex = 0; yindex < segments; yindex++) {
				data[xindex * segments + yindex] = -1 + (random.next * 3); // random height map
//				data[xindex * segments + yindex] = 1; // flat height 1e
			}
		}
		
		// set fixed height borders
		for (let borderIndex = 0; borderIndex < segments; borderIndex++) {
			data[borderIndex] = 0; // top row, (y = 0)
			data[borderIndex * segments + 0] = 0; // left column (x = 0)
			data[borderIndex * segments + segments -1] = 0; // right column
			data[(segments-1) * (segments) + borderIndex] = 0; // bottom row
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