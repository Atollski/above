/* global THREE, Ammo */

import {Chunk, WorldGen} from './worldgen.js';

export class PositionController {
	bind(vehicle) {
		this.vehicle = vehicle; // bind to new vehicle
		
//		this.vehicle.userData.physicsBody.setActivationState(0); // 1: Active (allow deactivation for previous vehicle)
//		this.vehicle.userData.physicsBody.__destroy__()
	}

	constructor(world, vehicle) {
		this.bind(vehicle); // direct this controller to the specified vehicle
		window.addEventListener("mousemove", event => {
			// player rotation around the Y axis (yaw) should not factor in the orientation of the player and remain in line with the horizon
			let newPositionX = this.vehicle.position.x + event.movementX * 1.0;
			let newPositionZ = this.vehicle.position.z + event.movementY * 1.0;
			this.vehicle.position.set(
				newPositionX
				,Chunk.perlin(newPositionX, newPositionZ) + 30
				,newPositionZ
			);
	
//			this.vehicle.userData.physicsBody.getMotionState().transform.setOrigin(new THREE.Vector3(newPositionX, 100, newPositionZ).ammo());
		});
		
		world.renderer.domElement.onmousedown = event => {
			if (document.pointerLockElement === null) { // lock pointer to world
				world.renderer.domElement.requestPointerLock();
			}
		};
	}
}

export class DefaultFlightController {
	keys = [];

	bind(vehicle) {
		if (this.vehicle) { // if vehicle bound to this controller, allow deactivation
			this.vehicle.userData.physicsBody.setActivationState(1); // 1: Active (allow deactivation for previous vehicle)
		}
		this.vehicle = vehicle; // bind to new vehicle
		this.vehicle.userData.physicsBody.setActivationState(4); //  4: Disable deactivation for current vehicle
	}

	constructor(world, vehicle) {
		this.bind(vehicle); // direct this controller to the specified vehicle

		//window.addEventListener("keydown", event=>{console.log(event.keyCode);});
		window.addEventListener("keydown", event => {
			this.keys[event.keyCode] = 1;
			let vehicleIndex = world.controllableVehicles.indexOf(this.vehicle);
			vehicleIndex += 1;
			this.bind(world.controllableVehicles[vehicleIndex % world.controllableVehicles.length]); // move to another vehicle
			console.log();
		});
		window.addEventListener("keyup", event => {
			this.keys[event.keyCode] = 0;
		});
		
		window.addEventListener("wheel", event => {
			this.vehicle.impulse = this.vehicle.impulse || new THREE.Vector3();
			this.vehicle.impulse.y = Math.max(this.vehicle.impulse.y - event.deltaY * 0.1, 0); // y scrolling controls vertical impulse - cannot go below 0
			// torque impulse relative to the player orientation (mainly pitch and roll)
			this.vehicle.torqueImpulse = this.vehicle.torqueImpulse || new THREE.Vector3();
			this.vehicle.torqueImpulse.z -= event.deltaX * 0.5; // roll applied via mouse wheel x scrolling
		});
		window.addEventListener("mousemove", event => {
			// player rotation around the Y axis (yaw) should not factor in the orientation of the player and remain in line with the horizon
			this.vehicle.horizonTorqueImpulse = this.vehicle.horizonTorqueImpulse || new THREE.Vector3();
			// torque impulse relative to the player orientation (mainly pitch and roll)
			this.vehicle.torqueImpulse = this.vehicle.torqueImpulse || new THREE.Vector3();

			// just add forces in for now
			this.vehicle.horizonTorqueImpulse.y -= event.movementX * 2.0;
			this.vehicle.torqueImpulse.x += event.movementY * 2.0;
		});
		world.renderer.domElement.onmousedown = event => {
			if (document.pointerLockElement === null) { // lock pointer to world
				world.renderer.domElement.requestPointerLock();
			} else { // pointer already locked - active mapped systems
				if (this.vehicle.systems[event.button]) {
					this.vehicle.systems[event.button].forEach(system=> {
						system.active = true; // engage the system
					});
				}
			}
		};
		world.renderer.domElement.onmouseup = event => {
			if (this.vehicle.systems[event.button]) {
				this.vehicle.systems[event.button].forEach(system=> {
					system.active = false; // disengage the system
				});
			}
		};
		world.controllers.push(this);
	}

	process(deltaTime) {
		if (this.vehicle.impulse) {
			let impulse = this.vehicle.impulse.clone();
			impulse.multiplyScalar(deltaTime);
			impulse.applyQuaternion(this.vehicle.quaternion); // convert impulse to relative to player orientation
			this.vehicle.userData.physicsBody.applyCentralImpulse(impulse.ammo());
		}

		if (this.vehicle.horizonTorqueImpulse) {
			let horizonTorqueImpulse = this.vehicle.horizonTorqueImpulse.clone();
			horizonTorqueImpulse.multiplyScalar(deltaTime);
			this.vehicle.userData.physicsBody.applyTorqueImpulse(horizonTorqueImpulse.ammo());
			this.vehicle.horizonTorqueImpulse.multiplyScalar(0); // remove input force
		}

		if (this.vehicle.torqueImpulse) {
			// before applying torque impulse, calculate roll relative to horizon and correct for it to stabilize the aircraft
			let euler = new THREE.Euler().setFromQuaternion(this.vehicle.quaternion, "YXZ"); // euler order important here since I want to process purely the Z rotation
			this.vehicle.torqueImpulse.z -= euler.z * 5.0; // firstly, attempt to stabilise any roll around Z axis
			this.vehicle.torqueImpulse.x -= euler.x * 4 * Math.max(0, Math.abs(euler.x) - (Math.PI / 4)); // ±45° dead zone

			let torqueImpulse = this.vehicle.torqueImpulse.clone();
			torqueImpulse.multiplyScalar(deltaTime);
			torqueImpulse.applyQuaternion(this.vehicle.quaternion);
			this.vehicle.userData.physicsBody.applyTorqueImpulse(torqueImpulse.ammo());
			this.vehicle.torqueImpulse.multiplyScalar(0); // remove input force
		}
	}
}