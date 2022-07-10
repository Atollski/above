/* global THREE, Ammo, Player */
import {TestAircraft, Block, Terrain, Ocean} from './objects.js';
import {DefaultFlightController} from './controller.js';

//variable declaration section
let world = {
	scene: null, camera: null, render: null, dirLight: null, worldTransform: null, clock: null // graphhics 
	, physicsWorld: null, rigidBodies: [] // physics
	, controllers: [], controllableVehicles: [], systems: [] //game
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
	
	new Terrain(world);
	new Ocean(world);
	
	for (let towerCount = 0; towerCount < 10; towerCount++) { // create a pillar of doom
		let angle = Math.random() * Math.PI * 2;
		let distance = 15 + Math.random() * 120;
		let targetX = distance * Math.sin(angle);
		let targetZ = distance * Math.cos(angle);
		new Block(world, {pos: {x:targetX, y:-2, z:targetZ}, size: {x:10, y:8, z:10}}); // foundation ending at +2
		for (let z=targetZ - 2; z< targetZ + 2.01; z+=2) {
			for (let y=3; y<19; y+=2) {
				for (let x=targetX - 2; x<targetX + 2.01; x+=2) {
					new Block(world, {pos: {x:x, y:y, z:z}, size: {x:2, y:2, z:2}, mass: 0.05});
				}	
			}
		}
	}

	world.controllableVehicles.push(new TestAircraft(world));
	world.controllableVehicles.push(new TestAircraft(world, {pos: {x: -10, y: 6, z: 0}}));
	world.controllableVehicles.push(new TestAircraft(world, {pos: {x: 10, y: 6, z: 0}}));

	// attach flight controller
	playerController = new DefaultFlightController(world, world.controllableVehicles[0]);
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
}

function renderFrame() {
	let deltaTime = world.clock.getDelta();

	// handle forces here

	world.controllers.forEach(controller=>controller.process(deltaTime));
	world.systems.forEach(system=>system.process(deltaTime, world));
	
	updatePhysics(deltaTime);
	world.camera.position.set(playerController.vehicle.position.x, world.camera.position.y, playerController.vehicle.position.z + 70); // maintain height
	world.camera.lookAt(playerController.vehicle.position); // follow the player position
	
	
	// have the light point at the player
	world.dirLight.target = playerController.vehicle;
	world.dirLight.position.set(playerController.vehicle.position.x-30, playerController.vehicle.position.y+100, playerController.vehicle.position.z+60);
	
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