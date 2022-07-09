/* global THREE, Ammo */
export class Player extends THREE.Mesh {
	constructor(settings) {
		super(new THREE.BoxBufferGeometry(4,2,7), new THREE.MeshPhongMaterial({color: 0xff0505}));
		
		settings = Object.assign (
			{
				pos: {x:0, y:6, z:0}
				, mass: 1
				, color: 0x101022
			}, settings
		);
		
		this.scale.set(1,1,1);
		this.rotation.set(0,0,0); // no specific rotation to start
		this.position.set(settings.pos.x, settings.pos.y, settings.pos.z);
		this.castShadow = true;
		this.receiveShadow = true;

		let cockpit = new THREE.Mesh(new THREE.BoxBufferGeometry(2,1.5,3), new THREE.MeshPhongMaterial({color: settings.color}));
		cockpit.material.transparent = true;
		cockpit.material.opacity = 0.5;
		cockpit.scale.set(1,1,1);
		cockpit.position.set(
			0//(player.geometry.parameters.width*0.5) - (cockpit.geometry.parameters.width*0.5)
			,(this.geometry.parameters.height*0.5) - (cockpit.geometry.parameters.height*0.5) + 0.2
			,(cockpit.geometry.parameters.depth*0.5) - (this.geometry.parameters.depth*0.5) - 1
		);
		this.add(cockpit);

		// CylinderGeometry(radiusTop : Float, radiusBottom : Float, height : Float, radialSegments : Integer, heightSegments : Integer, openEnded : Boolean, thetaStart : Float, thetaLength : Float)
		let engines = [
			{x:2, y: 0.8, z:2}
			,{x:-2, y: 0.8, z:2}
			,{x:2, y: 0.8, z:-2}
			,{x:-2, y: 0.8, z:-2}
		];
		engines.forEach(enginePos=>{
			let engine = new THREE.Mesh(new THREE.CylinderGeometry(1,1,1,10,1), new THREE.MeshPhongMaterial({color: 0x999999}));
			engine.position.set(enginePos.x, enginePos.y, enginePos.z);
			engine.castShadow = true;
			engine.receiveShadow = true;
			this.add(engine);
		});

		// have the light point at the player
		settings.world.dirLight.target = this;

		settings.world.scene.add(this);

		//Ammojs Section
		let body = this.rigidBody({physicsWorld: settings.world.physicsWorld, rigidBodies: settings.world.rigidBodies, mass: settings.mass}); // construct rigidbody
		body.setActivationState(4); // 4 prevents deactivation
		body.setDamping(0.6, 0.6); // general, angular
	}
}

export class Block extends THREE.Mesh {
	constructor(settings){
		settings = Object.assign({pos: {x:0, y:0, z:0}, size: {x:1, y:1, z:1}, mass: 0, color: Math.floor((1<<24)*Math.random())}, settings);
		super( // basic shaded box
			new THREE.BoxBufferGeometry(settings.size.x,settings.size.y,settings.size.z)
			,new THREE.MeshPhongMaterial({color: settings.color})
		);
		this.position.set(settings.pos.x, settings.pos.y, settings.pos.z);
		this.scale.set(1, 1, 1);
		this.castShadow = true;
		this.receiveShadow = true;
		settings.world.scene.add(this);
		this.rigidBody({physicsWorld: settings.world.physicsWorld, rigidBodies: settings.world.rigidBodies, mass:settings.mass});
	}
}

export class Terrain extends THREE.Mesh {
	constructor(settings) {
		let heightData = generateHeight( 100, 100, -7, 2); // example terrain

		// build the geometry
		const geometry = new THREE.PlaneGeometry( 300, 300, 99, 99);
		geometry.rotateX( - Math.PI / 2 );
		const vertices = geometry.attributes.position.array;
		for ( let i = 0, j = 0, l = vertices.length; i < l; i ++, j += 3 ) {
	//		vertices[ j + 1 ] = -1.5 + (Math.random() * 3); // random height map
			vertices[j + 1] = heightData[i]; // use example height map
		}

		geometry.computeVertexNormals();

		super(geometry, new THREE.MeshPhongMaterial({color: 0x004000}));

		this.castShadow = true;
		this.receiveShadow = true;
		this.position.set(0,0,0);
		settings.world.scene.add(this);
		this.rigidBody({physicsWorld: settings.world.physicsWorld});
	}
}

export class Ocean extends THREE.Mesh {
	constructor(settings) {
		const geometry = new THREE.PlaneGeometry( 300, 300, 100, 100);
		super(geometry, new THREE.MeshPhongMaterial({color: 0x0000ff}));
		this.rotateX( - Math.PI / 2 );
		this.material.transparent = true;
		this.material.opacity = 0.5;
		this.receiveShadow = true;
		this.position.set(0,0,0);
		settings.world.scene.add(this);
	}
}

// create a height map suitable for the game
function generateHeight(width, depth, minHeight, maxHeight) {
	// Generates the height data (a sinus wave)

	const size = width * depth;
	const data = new Float32Array( size );
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