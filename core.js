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
	createTerrain();
	createOcean();
	
	for (let towerCount = 0; towerCount < 6; towerCount++) { // create a pillar of doom
		let targetX = -120 + Math.floor(Math.random() * 240);
		let targetZ = -15 - (Math.floor(Math.random() * 120));
		createBlock({pos: {x:targetX, y:1, z:targetZ}, size: {x:10, y:2, z:10}}); // foundation
		for (let z=targetZ - 3; z<= targetZ + 3; z+=2) {
			for (let y=3; y<29; y+=2) {
				for (let x=targetX - 3; x<=targetX + 3; x+=2) {
					createBlock({pos: {x:x, y:y, z:z}, size: {x:2, y:2, z:2}, mass: 0.05});
				}	
			}
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
	camera.lookAt(player.position); // follow the player position
	renderer.render(scene, camera);
	requestAnimationFrame(renderFrame);
}

function createTerrain() {
	heightData = generateHeight( 100, 100, -2, 6); // example terrain
	
	// build the geometry
	const geometry = new THREE.PlaneGeometry( 300, 300, 99, 99);
	geometry.rotateX( - Math.PI / 2 );
	const vertices = geometry.attributes.position.array;
	for ( let i = 0, j = 0, l = vertices.length; i < l; i ++, j += 3 ) {
		vertices[ j + 1 ] = -1.5 + (Math.random() * 3); // random height map
//		vertices[ j + 1 ] = heightData[ i ]; // use example height map
	}
	
	geometry.computeVertexNormals();
	
	let terrain = new THREE.Mesh( geometry, new THREE.MeshPhongMaterial({color: 0x004000}));
		
	terrain.castShadow = true;
	terrain.receiveShadow = true;
	terrain.position.set(0,0,0);
	scene.add(terrain);
	terrain.rigidBody({physicsWorld: physicsWorld});
}

function createOcean() {
	const oceanGeometry = new THREE.PlaneGeometry( 300, 300, 100, 100);
	
	let ocean = new THREE.Mesh( oceanGeometry, new THREE.MeshPhongMaterial({color: 0x0000ff}));
	ocean.rotateX( - Math.PI / 2 );
	ocean.material.transparent = true;
	ocean.material.opacity = 0.5;
	ocean.receiveShadow = true;
	ocean.position.set(0,0,0);
	scene.add(ocean);
}

function createBlock(settings){
	settings = Object.assign({pos: {x:0, y:0, z:0}, size: {x:1, y:1, z:1}, mass: 0, color: Math.floor((1<<24)*Math.random())}, settings);
	let blockPlane = new THREE.Mesh(
		new THREE.BoxBufferGeometry(settings.size.x,settings.size.y,settings.size.z)
		,new THREE.MeshPhongMaterial({color: settings.color})
	);
	blockPlane.position.set(settings.pos.x, settings.pos.y, settings.pos.z);
	blockPlane.scale.set(1, 1, 1);
	blockPlane.castShadow = true;
	blockPlane.receiveShadow = true;
	scene.add(blockPlane);
	blockPlane.rigidBody({physicsWorld: physicsWorld, rigidBodies: rigidBodies, mass:settings.mass});
}

function createPlayer(){
	let pos = {x: 0, y: 6, z: 0};
	let mass = 1;

	player = new THREE.Mesh(new THREE.BoxBufferGeometry(4,2,7), new THREE.MeshPhongMaterial({color: 0xff0505}));
	player.scale.set(1,1,1);
	player.rotation.set(0.2,0,0.1);
	player.position.set(pos.x, pos.y, pos.z);
	player.castShadow = true;
	player.receiveShadow = true;
	
	let cockpit = new THREE.Mesh(new THREE.BoxBufferGeometry(2,1.5,3), new THREE.MeshPhongMaterial({color: 0x0000ff}));
	cockpit.material.transparent = true;
	cockpit.material.opacity = 0.5;
	cockpit.scale.set(1,1,1);
	cockpit.position.set(
		0//(player.geometry.parameters.width*0.5) - (cockpit.geometry.parameters.width*0.5)
		,(player.geometry.parameters.height*0.5) - (cockpit.geometry.parameters.height*0.5) + 0.2
		,(cockpit.geometry.parameters.depth*0.5) - (player.geometry.parameters.depth*0.5) - 1
	);
	player.add(cockpit);
	
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
		player.add(engine);
	});
	
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

// hackery

function generateHeight( width, depth, minHeight, maxHeight ) {
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
				Math.pow( ( i - w2 ) / w2, 2.0 ) +
					Math.pow( ( j - d2 ) / d2, 2.0 ) );

			const height = ( Math.sin( radius * phaseMult ) + 1 ) * 0.5 * hRange + minHeight;

			data[ p ] = height;

			p ++;

		}

	}

	return data;

}