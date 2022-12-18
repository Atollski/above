/* global THREE, Ammo */
import {DefaultFlightController} from './controller.js';

class Engine extends THREE.Mesh {
	constructor(settings) {
		super(new THREE.CylinderGeometry(1,1,1,10,1), new THREE.MeshPhongMaterial({color: 0x999999}));
		this.position.set(settings.pos.x, settings.pos.y, settings.pos.z);
		this.castShadow = true;
		this.receiveShadow = true;
	}
}

class Rocket extends THREE.Mesh {
	fuel = 4; // seconds of flight
	constructor(world, settings) {
		super(new THREE.CylinderGeometry(0.1,0.1,1.5,6,1), new THREE.MeshPhongMaterial({color: 0x999999}));
		settings = Object.assign (
			{
				pos: {x:0, y:-1, z:0}
				, mass: 1
				, color: 0x101022
			}, settings
		);
		this.scale.set(1,1,1);
		this.position.set(settings.pos.x, settings.pos.y, settings.pos.z);
		if (settings.quaternion) {
			this.setRotationFromQuaternion(settings.quaternion);
		}
		
		// collision group 4, avoid collision with aircraft collision group 2
		let body = this.rigidBody({physicsWorld: world.physicsWorld, rigidBodies: world.rigidBodies, mass: settings.mass}, 4, 5); // construct rigidbody
		
		let force = new THREE.Vector3(0,-20,0); // shouldn't be on the Y axis, should be +100 Z
		
		force.applyQuaternion(this.quaternion); // convert impulse to relative to player orientation
		body.applyCentralImpulse(force.ammo());

		body.setDamping(0.6, 0.6); // general, angular
		world.systems.push(this);// this rocket has ongoing propulsion
		world.scene.add(this);
	}
	
	process(delta, world) {
		this.fuel -= delta;
		if (this.fuel > 0) { // rocket can only fly so far!
			let impulse = new THREE.Vector3(0,-40,0); // shouldn't be on the Y axis, should be +100 Z
			impulse.multiplyScalar(delta);
			impulse.applyQuaternion(this.quaternion); // convert impulse to relative to player orientation
			this.userData.physicsBody.applyCentralImpulse(impulse.ammo());
		}
	}
}

class RocketPod extends THREE.Mesh {
	active = false;
	cooldown = 0;
	constructor(settings) {
		// CylinderGeometry(radiusTop : Float, radiusBottom : Float, height : Float, radialSegments : Integer, heightSegments : Integer, openEnded : Boolean, thetaStart : Float, thetaLength : Float)
		super(new THREE.CylinderGeometry(0.5,0.5,2,6,1), new THREE.MeshPhongMaterial({color: 0x999999}));
		settings = Object.assign (
			{
				pos: {x:0, y:-1, z:0}
				,rot:{x: Math.PI/2, y: 0, z: 0}
				, mass: 1
				, color: 0x101022
			}, settings
		);
		this.scale.set(1,1,1);
		this.position.set(settings.pos.x, settings.pos.y, settings.pos.z);
		this.rotation.set(settings.rot.x, settings.rot.y, settings.rot.z);
		
		this.castShadow = true;
		this.receiveShadow = true;
	}
	
	process(delta, world) {
		if (this.cooldown > 0) this.cooldown -= delta;
		if (this.active && this.cooldown <= 0) {
			new Rocket(world, {
				pos: this.getWorldPosition(new THREE.Vector3(0,0,0))
				,quaternion: this.getWorldQuaternion(new THREE.Quaternion(0,0,0,0))
			});
			this.cooldown = 0.2; // what is the unit...?
		}
	}
}

class Aircraft extends THREE.Mesh {
	systems = [];
	settings = null;
	constructor(world, settings) {
		super();
		this.settings = Object.assign (
			{
				pos: {x:0, y:6, z:0}
				, rot:{x:0, y:0, z:0}
				, mass:1
				, color:0x101022
			}, settings
		);

		this.scale.set(1,1,1);
		this.position.set(this.settings.pos.x, this.settings.pos.y, this.settings.pos.z);
		this.rotation.set(this.settings.rot.x, this.settings.rot.y, this.settings.rot.z);
		this.castShadow = true;
		this.receiveShadow = true;
	}
	
	connectSystems() {
		this.systems.forEach(systemList=>{
			if (systemList) {
				systemList.forEach(system=>{
					this.add(system);
				});
			}
		});
	}
}

export class TestAircraft extends Aircraft { // test aircraft
	constructor(world, settings) {
		super(world, settings);
		
		this.geometry = new THREE.BoxBufferGeometry(4,2,7);
		this.material = new THREE.MeshPhongMaterial({color: 0xff0505});
		
		let cockpit = new THREE.Mesh(new THREE.BoxBufferGeometry(2,1.5,3), new THREE.MeshPhongMaterial({color: this.settings.color}));
		cockpit.material.transparent = true;
		cockpit.material.opacity = 0.5;
		cockpit.scale.set(1,1,1);
		cockpit.position.set(
			0//(player.geometry.parameters.width*0.5) - (cockpit.geometry.parameters.width*0.5)
			,(this.geometry.parameters.height*0.5) - (cockpit.geometry.parameters.height*0.5) + 0.2
			,(cockpit.geometry.parameters.depth*0.5) - (this.geometry.parameters.depth*0.5) - 1
		);
		this.add(cockpit);

		this.add(new Engine({pos:{x:2, y:0.8, z:2}}));
		this.add(new Engine({pos:{x:-2, y:0.8, z:2}}));
		this.add(new Engine({pos:{x:2, y:0.8, z:-2}}));
		this.add(new Engine({pos:{x:-2, y:0.8, z:-2}}));
		
		this.systems[0] = [ // left mouse button
			new RocketPod({pos:{x:2.5, y:-0.5, z:0}})
			,new RocketPod({pos:{x:-2.5, y:-0.5, z:0}})
		];
		
		world.systems = world.systems.concat(
			this.systems[0]
		);

		this.connectSystems();

		world.scene.add(this);

		//Ammojs Section
		let body = this.rigidBody({physicsWorld: world.physicsWorld, rigidBodies: world.rigidBodies, mass: this.settings.mass}, 2); // construct rigidbody - collision group 2 for aircraft

		body.setDamping(0.6, 0.6); // general, angular
	}
}

export class Block extends THREE.Mesh {
	constructor(world, settings){
		settings = Object.assign({pos: {x:0, y:0, z:0}, size: {x:1, y:1, z:1}, mass: 0, color: Math.floor((1<<24)*Math.random())}, settings);
		super( // basic shaded box
			new THREE.BoxBufferGeometry(settings.size.x,settings.size.y,settings.size.z)
			,new THREE.MeshPhongMaterial({color: settings.color})
		);
		this.position.set(settings.pos.x, settings.pos.y, settings.pos.z);
		this.scale.set(1, 1, 1);
		this.castShadow = true;
		this.receiveShadow = true;
		world.scene.add(this);
		this.rigidBody({physicsWorld: world.physicsWorld, rigidBodies: world.rigidBodies, mass:settings.mass});
	}
}

export class Terrain extends THREE.Mesh {
	constructor(world, settings) {
		let heightData = generateHeight( 100, 100, -7, 2); // example terrain

		// build the geometry
		const geometry = new THREE.PlaneGeometry( 300, 300, 99, 99);
		geometry.rotateX( - Math.PI / 2 );
		const vertices = geometry.attributes.position.array;
		for ( let i = 0, j = 0, l = vertices.length; i < l; i ++, j += 3 ) {
//			vertices[ j + 1 ] = -1.5 + (Math.random() * 3); // random height map
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