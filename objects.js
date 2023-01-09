/* global THREE, Ammo */
import {DefaultFlightController} from './controller.js';

class Tower {
	constructor(world, settings) {
		for (let towerCount = 0; towerCount < 10; towerCount++) { // create a pillar of doom
			let angle = Math.random() * Math.PI * 2;
			let distance = 15 + Math.random() * 120;
			let targetX = distance * Math.sin(angle);
			let targetZ = distance * Math.cos(angle);
			new Block(world, {pos: {x:targetX, y:-2, z:targetZ}, size: {x:10, y:8, z:10}}); // foundation ending at +2
			for (let z=targetZ - 2; z< targetZ + 2.01; z+=2) {
				for (let y=3; y<19; y+=2) {
					for (let x=targetX - 2; x<targetX + 2.01; x+=2) {
						new Block(world, {pos: {x:x, y:y, z:z}, size: {x:2, y:2, z:2}, mass: 1});
					}	
				}
			}
		}
	}
}

class Engine extends THREE.Mesh {
	constructor(settings) {
		super(new THREE.CylinderGeometry(1,1,1,10,1), new THREE.MeshPhongMaterial({color: 0x999999}));
		this.position.set(settings.pos.x, settings.pos.y, settings.pos.z);
		this.castShadow = true;
		this.receiveShadow = true;
	}
}

class Rocket extends THREE.Mesh {
	age = 0; // maintain age of rocket for disposal
	constructor(world, settings) {
		// create default settings
		settings = Object.assign (
			{
				pos: {x:0, y:-1, z:0}
				,mass: 1
				,color: 0x999999 // light grey
				,fuel: 4 // seconds of flight
			}, settings
		);

		super(new THREE.CylinderGeometry(0.1,0.1,1.5,6,1), new THREE.MeshPhongMaterial({color: settings.color}));
		
		this.fuel = settings.fuel;
		this.scale.set(1,1,1);
		this.position.set(settings.pos.x, settings.pos.y, settings.pos.z);
		if (settings.quaternion) {
			this.setRotationFromQuaternion(settings.quaternion);
		}
		
		this.castShadow = true;
		
		// collision group 4, avoid collision with aircraft collision group 2
		let body = this.ammoRigidBody({physicsWorld: world.physicsWorld, rigidBodies: world.rigidBodies, mass: settings.mass}, 4, 5); // construct rigid body
		
		let force = new THREE.Vector3(0,-20,0); // shouldn't be on the Y axis, should be +100 Z
		
		force.applyQuaternion(this.quaternion); // convert impulse to relative to player orientation
		body.applyCentralImpulse(force.ammo());

		body.setDamping(0.6, 0.6); // general, angular
		world.systems.push(this);// this rocket has ongoing propulsion
		world.scene.add(this);
	}
	
	process(delta, world) {
		this.fuel -= delta;
		this.age += delta;
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
		let body = this.ammoRigidBody({physicsWorld: world.physicsWorld, rigidBodies: world.rigidBodies, mass: this.settings.mass}, 2); // construct rigid body - collision group 2 for aircraft

		body.setDamping(0.6, 0.6); // (general, angular) - easy high friction
//		body.setDamping(0.1, 0.6); // (general, angular) - more difficult, low general friction
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
		this.ammoRigidBody({physicsWorld: world.physicsWorld, rigidBodies: world.rigidBodies, mass:settings.mass});
	}
}