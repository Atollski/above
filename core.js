/* global THREE, Ammo, Player */
import {Player, Block, Terrain, Ocean} from './objects.js';

//variable declaration section
let world = {scene: null, camera: null, render: null, dirLight: null, worldTransform: null, physicsWorld: null, rigidBodies: [], clock:null};
let keys = [];

let player = null; // this will eventually get set up with the player object

//Ammojs Initialization
Ammo().then(start);

// monitor input events for 
// monitor key press
window.addEventListener("keydown", event=>{keys[event.keyCode] = 1;});
//window.addEventListener("keydown", event=>{console.log(event.keyCode);});
window.addEventListener("keyup", event=>{keys[event.keyCode] = 0;});
window.addEventListener("wheel", event=>{
	if (player) {
		player.impulse = player.impulse || new THREE.Vector3();
		player.impulse.y = Math.max(player.impulse.y - event.deltaY*0.1, 0); // y scrolling controls vertical impulse - cannot go below 0
		// torque impulse relative to the player orientation (mainly pitch and roll)
		player.torqueImpulse = player.torqueImpulse || new THREE.Vector3();
		player.torqueImpulse.z -= event.deltaX*0.5; // roll applied via mouse wheel x scrolling
	}
});
window.addEventListener("mousemove", event=>{
	if (player) {
		// player rotation around the Y axis (yaw) should not factor in the orientation of the player and remain in line with the horizon
		player.horizonTorqueImpulse = player.horizonTorqueImpulse || new THREE.Vector3();
		// torque impulse relative to the player orientation (mainly pitch and roll)
		player.torqueImpulse = player.torqueImpulse || new THREE.Vector3();

		// just add forces in for now
		player.horizonTorqueImpulse.y -= event.movementX * 2.0;
		player.torqueImpulse.x += event.movementY * 2.0;
	}
});
window.addEventListener('contextmenu', event => event.preventDefault()); // disable right click

function start () {
	world.worldTransform = new Ammo.btTransform();
	setupPhysicsWorld();
	setupGraphics();
	new Terrain({world: world});
	new Ocean({world: world});
	
	for (let towerCount = 0; towerCount < 10; towerCount++) { // create a pillar of doom
		let angle = Math.random() * Math.PI * 2;
		let distance = 15 + Math.random() * 120;
		let targetX = distance * Math.sin(angle);
		let targetZ = distance * Math.cos(angle);
		new Block({world: world, pos: {x:targetX, y:1, z:targetZ}, size: {x:10, y:2, z:10}}); // foundation
		for (let z=targetZ - 2; z<= targetZ + 2; z+=2) {
			for (let y=3; y<19; y+=2) {
				for (let x=targetX - 2; x<=targetX + 2; x+=2) {
					new Block({world: world, pos: {x:x, y:y, z:z}, size: {x:2, y:2, z:2}, mass: 0.05});
				}	
			}
		}
	}

	player = new Player({world: world});
	renderFrame();
}

function setupPhysicsWorld() {
	let collisionConfiguration = new Ammo.btDefaultCollisionConfiguration();
	let dispatcher = new Ammo.btCollisionDispatcher(collisionConfiguration);
	let overlappingPairCache = new Ammo.btDbvtBroadphase();
	let solver = new Ammo.btSequentialImpulseConstraintSolver();
	world.physicsWorld = new Ammo.btDiscreteDynamicsWorld(dispatcher, overlappingPairCache, solver, collisionConfiguration);
	world.physicsWorld.setGravity(new Ammo.btVector3(0, -10, 0));
}

function setupGraphics(){
	//create clock for timing
	world.clock = new THREE.Clock();

	//create the scene
	world.scene = new THREE.Scene();
	world.scene.background = new THREE.Color(0xbfd1e5);

	//create camera
	world.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.2, 5000);
	world.camera.position.set(0, 50, 70);
	world.camera.lookAt(new THREE.Vector3(0, 0, 0));

	//Add directional light. It follows the player so shadows are always effective
	world.dirLight = new THREE.DirectionalLight( 0xffffff , 1);
	world.dirLight.color.setHSL(0.1, 1, 0.95);
	world.scene.add(world.dirLight);

	world.dirLight.castShadow = true;
	world.dirLight.shadow.mapSize.width = 2048;
	world.dirLight.shadow.mapSize.height = 2048;

	let d = 150;
	world.dirLight.shadow.camera.left = -d;
	world.dirLight.shadow.camera.right = d;
	world.dirLight.shadow.camera.top = d;
	world.dirLight.shadow.camera.bottom = -d;
	world.dirLight.shadow.camera.far = 1000;

	//Setup the renderer
	world.renderer = new THREE.WebGLRenderer({antialias: false});
	world.renderer.setClearColor(0xbfd1e5);
	world.renderer.setPixelRatio(window.devicePixelRatio);
	world.renderer.setSize(window.innerWidth, window.innerHeight);
	document.body.appendChild(world.renderer.domElement);
	world.renderer.gammaInput = true;
	world.renderer.gammaOutput = true;
	world.renderer.shadowMap.enabled = true;
	world.renderer.domElement.onmousedown = event => {
		if (document.pointerLockElement === null) {
			world.renderer.domElement.requestPointerLock();
		} else {
//			console.log(event.button);
		}
	}; // lock pointer to world
}

function renderFrame() {
	let deltaTime = world.clock.getDelta();

	// handle forces here

	if (player.impulse) {
		let impulse = player.impulse.clone();
		impulse.multiplyScalar(deltaTime);
		impulse.applyQuaternion(player.quaternion); // convert impulse to relative to player orientation
		player.userData.physicsBody.applyCentralImpulse(impulse.ammo());
	}
	
	if (player.horizonTorqueImpulse) {
		let horizonTorqueImpulse = player.horizonTorqueImpulse.clone();
		horizonTorqueImpulse.multiplyScalar(deltaTime);
		player.userData.physicsBody.applyTorqueImpulse(horizonTorqueImpulse.ammo());
		player.horizonTorqueImpulse.multiplyScalar(0); // remove input force
	}
	
	if (player.torqueImpulse) {
		// before applying torque impulse, calculate roll relative to horizon and correct for it to stabilize the aircraft
		let euler = new THREE.Euler().setFromQuaternion(player.quaternion, "YXZ"); // euler order important here since I want to process purely the Z rotation
		player.torqueImpulse.z -= euler.z * 5.0; // firstly, attempt to stabilise any roll around Z axis
		player.torqueImpulse.x -= euler.x * 4 * Math.max(0,Math.abs(euler.x)-(Math.PI / 4)); // ±45° dead zone
		
		let torqueImpulse = player.torqueImpulse.clone();
		torqueImpulse.multiplyScalar(deltaTime);
		torqueImpulse.applyQuaternion(player.quaternion);
		player.userData.physicsBody.applyTorqueImpulse(torqueImpulse.ammo());
		player.torqueImpulse.multiplyScalar(0); // remove input force
	}
	
	updatePhysics(deltaTime);
	world.camera.position.set(player.position.x, world.camera.position.y, player.position.z + 70); // maintain height
	world.camera.lookAt(player.position); // follow the player position
	world.dirLight.position.set(player.position.x-30, player.position.y+100, player.position.z+60);
	world.renderer.render(world.scene, world.camera);
	requestAnimationFrame(renderFrame);
}

function updatePhysics(deltaTime){
	// Step world
	world.physicsWorld.stepSimulation(deltaTime, 10);

	// Update rigid bodies
	for (let i = 0; i < world.rigidBodies.length; i++) {
		let objThree = world.rigidBodies[ i ];
		let objAmmo = objThree.userData.physicsBody;
		let motionState = objAmmo.getMotionState();
		if (motionState) {
			motionState.getWorldTransform(world.worldTransform);
			let pos = world.worldTransform.getOrigin();
			let rot = world.worldTransform.getRotation();
			objThree.position.set( pos.x(), pos.y(), pos.z() );
			objThree.quaternion.set(rot.x(), rot.y(), rot.z(), rot.w());
		}
	}
}