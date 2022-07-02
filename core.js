/* global THREE, Ammo */

//variable declaration section
let physicsWorld, scene, camera, renderer, rigidBodies = [];
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
	tmpTrans = new Ammo.btTransform();
	setupPhysicsWorld();
	setupGraphics();
	createBlock();
//	
//	createBlock2({x:3,y:7,z:1});
//	createBlock2({x:6,y:7,z:-4});
//	
//	
	for (let y=0; y<20; y+=2) {
		for (let x=-20; x<20; x+=2) {
			createBlock2({x:x,y:y,z:-15});
		}	
	}
	
	createPlayer();
	renderFrame();
}

function setupPhysicsWorld() {
	let collisionConfiguration = new Ammo.btDefaultCollisionConfiguration();
	let dispatcher = new Ammo.btCollisionDispatcher(collisionConfiguration);
	let overlappingPairCache = new Ammo.btDbvtBroadphase();
	let solver = new Ammo.btSequentialImpulseConstraintSolver();
	physicsWorld = new Ammo.btDiscreteDynamicsWorld(dispatcher, overlappingPairCache, solver, collisionConfiguration);
	physicsWorld.setGravity(new Ammo.btVector3(0, -10, 0));
}

function setupGraphics(){
	//create clock for timing
	clock = new THREE.Clock();

	//create the scene
	scene = new THREE.Scene();
	scene.background = new THREE.Color(0xbfd1e5);

	//create camera
	camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.2, 5000);
	camera.position.set(0, 30, 70);
	camera.lookAt(new THREE.Vector3(0, 0, 0));

	//Add hemisphere light
	let hemiLight = new THREE.HemisphereLight( 0xffffff, 0xffffff, 0.1 );
	hemiLight.color.setHSL( 0.6, 0.6, 0.6 );
	hemiLight.groundColor.setHSL( 0.1, 1, 0.4 );
	hemiLight.position.set( 0, 50, 0 );
	scene.add( hemiLight );

	//Add directional light
	let dirLight = new THREE.DirectionalLight( 0xffffff , 1);
	dirLight.color.setHSL(0.1, 1, 0.95);
	dirLight.position.set(-1, 1.75, 1);
	dirLight.position.multiplyScalar(100);
	scene.add(dirLight);

	dirLight.castShadow = true;
	dirLight.shadow.mapSize.width = 2048;
	dirLight.shadow.mapSize.height = 2048;

	let d = 50;
	dirLight.shadow.camera.left = -d;
	dirLight.shadow.camera.right = d;
	dirLight.shadow.camera.top = d;
	dirLight.shadow.camera.bottom = -d;
	dirLight.shadow.camera.far = 13500;

	//Setup the renderer
	renderer = new THREE.WebGLRenderer({antialias: true});
	renderer.setClearColor(0xbfd1e5);
	renderer.setPixelRatio(window.devicePixelRatio);
	renderer.setSize(window.innerWidth, window.innerHeight);
	document.body.appendChild(renderer.domElement);
	renderer.gammaInput = true;
	renderer.gammaOutput = true;
	renderer.shadowMap.enabled = true;
	renderer.domElement.onclick = () => {renderer.domElement.requestPointerLock();}; // lock pointer to world
}

function renderFrame() {
	let deltaTime = clock.getDelta();

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
	renderer.render(scene, camera);
	requestAnimationFrame(renderFrame);
}

function createBlock(){
	let pos = {x: 0, y: 0, z: 0};
	
	//threeJS Section
	let blockPlane = new THREE.Mesh(new THREE.BoxBufferGeometry(50,2,50), new THREE.MeshPhongMaterial({color: 0xa0afa4}));
	blockPlane.position.set(pos.x, pos.y, pos.z);
	blockPlane.scale.set(1, 1, 1);
	blockPlane.castShadow = true;
	blockPlane.receiveShadow = true;
	scene.add(blockPlane);

	let body = blockPlane.rigidBody({physicsWorld: physicsWorld});
//	physicsWorld.addRigidBody(body);
}

function createBlock2(pos) {
	//threeJS Section
//	let blockPlane = new THREE.Mesh(new THREE.BoxBufferGeometry(2,2,2), new THREE.MeshPhongMaterial({color: 0xa0afa4}));
	let blockPlane = new THREE.Mesh(new THREE.BoxBufferGeometry(2,2,2), new THREE.MeshPhongMaterial({color: Math.floor((1<<24)*Math.random())}));
	blockPlane.position.set(pos.x, pos.y, pos.z);
	blockPlane.scale.set(1, 1, 1);
	blockPlane.castShadow = true;
	blockPlane.receiveShadow = true;
	scene.add(blockPlane);

	blockPlane.rigidBody({physicsWorld: physicsWorld, rigidBodies: rigidBodies, mass:0.05});
}

function createPlayer(){
	let pos = {x: 0, y: 20, z: 0};
	//let scale = {x: 2, y: 2, z: 2};
	let mass = 1;

	//threeJS Section
	player = new THREE.Mesh(new THREE.BoxBufferGeometry(4,2,7), new THREE.MeshPhongMaterial({color: 0xff0505}));
	player.scale.set(1,1,1);
	player.rotation.set(0.2,0,0.1);
	player.position.set(pos.x, pos.y, pos.z);
	player.castShadow = true;
	player.receiveShadow = true;
	
	let cockpit = new THREE.Mesh(new THREE.BoxBufferGeometry(3,1.5,3), new THREE.MeshPhongMaterial({color: 0x0000ff}));
	cockpit.material.transparent = true;
	cockpit.material.opacity = 0.5;
	cockpit.scale.set(1,1,1);
	cockpit.position.set(
		0//(player.geometry.parameters.width*0.5) - (cockpit.geometry.parameters.width*0.5)
		,(player.geometry.parameters.height*0.5) - (cockpit.geometry.parameters.height*0.5) + 0.2
		,(cockpit.geometry.parameters.depth*0.5) - (player.geometry.parameters.depth*0.5) - 1
	);
	player.add(cockpit);
	
	scene.add(player);

	//Ammojs Section
	let body = player.rigidBody({physicsWorld: physicsWorld, rigidBodies: rigidBodies, mass: 1}); // construct rigidbody
	body.setActivationState(4); // 4 prevents deactivation
	body.setDamping(0.6, 0.6); // general, angular
}

function updatePhysics(deltaTime){
	// Step world
	physicsWorld.stepSimulation(deltaTime, 10);

	// Update rigid bodies
	for (let i = 0; i < rigidBodies.length; i++) {
		let objThree = rigidBodies[ i ];
		let objAmmo = objThree.userData.physicsBody;
		let ms = objAmmo.getMotionState();
		if (ms) {
			ms.getWorldTransform(tmpTrans);
			let p = tmpTrans.getOrigin();
			let q = tmpTrans.getRotation();
			objThree.position.set( p.x(), p.y(), p.z() );
			objThree.quaternion.set(q.x(), q.y(), q.z(), q.w());
		}
	}
}

