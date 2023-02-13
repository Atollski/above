/* global THREE, Ammo, Player */
import {TestAircraft, Block} from './objects.js';
import {Chunk, WorldGen} from './worldgen.js';
import {DefaultFlightController, PositionController} from './controller.js';

//variable declaration section
let world = {
	scene: null, camera: null, render: null, dirLight: null, worldTransform: null, clock: null // graphics 
	, physicsWorld: null, rigidBodies: [] // physics
	, controllers: [], controllableVehicles: [], systems: [] //game
	, seed: 69420 // world generation seed
};
let keys = [];
let playerController = null;

window.addEventListener('contextmenu', event => event.preventDefault()); // disable right click

//Ammojs Initialization
Ammo().then(start);

function start () {
	world.worldTransform = new Ammo.btTransform();
	setupPhysicsWorld();
	setupGraphics();
	
	// initiate an infinite world generator
	world.worldgen = new WorldGen(world, {size: 30, segments: 2, viewDistance: 200});
//	world.worldgen = new WorldGen(world, {size: 10, segments: 3, viewDistance: 200});
	
	world.controllableVehicles.push(new TestAircraft(world, {pos: {x: 0, y: Chunk.perlin(0, 0) + 60, z: 0}}));
	world.controllableVehicles.push(new TestAircraft(world, {pos: {x: -10, y: Chunk.perlin(-10, 0) + 60, z: 0}}));
	world.controllableVehicles.push(new TestAircraft(world, {pos: {x: 10, y: Chunk.perlin(10, 0) + 60, z: 0}}));

	// attach flight controller
	playerController = new DefaultFlightController(world, world.controllableVehicles[0]);
//	playerController = new PositionController(world, world.controllableVehicles[0]); // for debugging position related stuff
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
//	world.cameraMode = "overhead";
	//Add directional light. It follows the player so shadows are always effective
	world.dirLight = new THREE.DirectionalLight( 0xffffff , 1);
	world.dirLight.color.setHSL(0.1, 1, 0.95);
	world.scene.add(world.dirLight);

	world.dirLight.castShadow = true;
	world.dirLight.shadow.mapSize.width = 2048;
	world.dirLight.shadow.mapSize.height = 2048;

	let shadowClip = 150;
	world.dirLight.shadow.camera.left = -shadowClip;
	world.dirLight.shadow.camera.right = shadowClip;
	world.dirLight.shadow.camera.top = shadowClip;
	world.dirLight.shadow.camera.bottom = -shadowClip;
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
}

var nextTime = nextTime ? nextTime : new Date().getTime(); // temporary time for console debug
function renderFrame() {
	let deltaTime = world.clock.getDelta();

	// handle forces here

	world.controllers.forEach(controller=>controller.process(deltaTime));
	world.systems.forEach(system=>system.process(deltaTime, world));
	
	updatePhysics(deltaTime);
	
	if ("chase" === world.cameraMode) {
		// chase camera position
		world.camera.position.set(
			playerController.vehicle.position.x
			, playerController.vehicle.position.y + 3
			, playerController.vehicle.position.z
		);

		// chase camera orientation
		let motionState = playerController.vehicle.userData.physicsBody.getMotionState();
		if (motionState) {
			motionState.getWorldTransform(world.worldTransform);
			let rot = world.worldTransform.getRotation();
			world.camera.quaternion.set(rot.x(), rot.y(), rot.z(), rot.w());
		}
	} else if ("overhead" === world.cameraMode) { // overhead view
		// overhead camera position
		world.camera.position.set(
			playerController.vehicle.position.x
			, playerController.vehicle.position.y + 50
			, playerController.vehicle.position.z
		);
		world.camera.lookAt(playerController.vehicle.position); // follow the player position
	} else { // virus style camera position
		world.camera.position.set(
			playerController.vehicle.position.x
			, Math.max(Chunk.perlin(playerController.vehicle.position.x, playerController.vehicle.position.z + 70), 0) + 100
			, playerController.vehicle.position.z + 70
		); // maintain height
		world.camera.lookAt(playerController.vehicle.position); // follow the player position
	}
	
	// console data debugging here
	if (new Date().getTime() >= nextTime) {
		nextTime += 500;
		console.clear();
		console.log("x: " + playerController.vehicle.position.x);
		console.log("y: " + playerController.vehicle.position.y);
		console.log("z: " + playerController.vehicle.position.z);
		console.log("Perlin: " + Chunk.perlin(playerController.vehicle.position.x, playerController.vehicle.position.z));
		console.log("Height: " + (playerController.vehicle.position.y - Chunk.perlin(playerController.vehicle.position.x, playerController.vehicle.position.z)));
	}

	world.worldgen.generateChunks(world);

	// have the light point at the player
	world.dirLight.target = playerController.vehicle;
	world.dirLight.position.set(playerController.vehicle.position.x-30, playerController.vehicle.position.y+100, playerController.vehicle.position.z+60);
	
	world.renderer.render(world.scene, world.camera);
	requestAnimationFrame(renderFrame);
}

function updatePhysics(deltaTime){
	// Step world
	world.physicsWorld.stepSimulation(deltaTime, 10);

	// Update rigid bodies to match physics co-ordinates
	for (let rigidBodiesIndex = 0; rigidBodiesIndex < world.rigidBodies.length; rigidBodiesIndex++) {
		let objThree = world.rigidBodies[rigidBodiesIndex];
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