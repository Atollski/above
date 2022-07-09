/* global THREE, Ammo */

/**
 * Convert a THREE vector to Ammo
 * @returns {Ammo.btVector3} the Ammo equivalent of the THREE vector
 */
THREE.Vector3.prototype.ammo = function() { // Vector conversion
	return new Ammo.btVector3(this.x,this.y,this.z);
};

/**
 * Convert a THREE quaternion to Ammo
 * @returns {Ammo.btQuaternion} Ammo equivalent of a THREE quaternion
 */
THREE.Quaternion.prototype.ammo = function() { // Quaternion conversion
	return new Ammo.btQuaternion(this.x,this.y,this.z, this.w);
};

THREE.BoxBufferGeometry.prototype.ammoGeometry = function() {
	return new Ammo.btBoxShape(new Ammo.btVector3(
		this.parameters.width*0.5
		, this.parameters.height*0.5
		, this.parameters.depth*0.5
	));
};

THREE.CylinderGeometry.prototype.ammoGeometry = function() {
	return new Ammo.btCylinderShape(new Ammo.btVector3(
		this.parameters.radiusTop
		,this.parameters.height*0.5
		,this.parameters.height*0.5 // not sure about this one
	));
};


THREE.PlaneGeometry.prototype.ammoGeometry = function() {
	const upAxis = 1; // Up axis = 0 for X, 1 for Y, 2 for Z. Normally 1 = Y is used.
	const hdt = 'PHY_FLOAT'; // hdt, height data type. "PHY_FLOAT" is used. Possible values are "PHY_FLOAT", "PHY_UCHAR", "PHY_SHORT"
	const flipQuadEdges = false; // Set this to your needs (inverts the triangles)
	const terrainWidth = this.parameters.widthSegments + 1;
	const terrainDepth = this.parameters.heightSegments + 1;
	// Creates height data buffer in Ammo heap
	ammoHeightData = Ammo._malloc( 4 * terrainWidth * terrainDepth );

	// Copy the javascript height data array to the Ammo one.
	let p = 0;
	let p2 = 0;
	
	// pull height map out
	let maximum = 0; // keep track of max size (absolute of both positive and negative)
	const vertices = this.attributes.position.array;
	for (let threeIndex = 1; threeIndex < vertices.length; threeIndex += 3) { // only iterate over Y components of vertices
		Ammo.HEAPF32[(ammoHeightData + p) >> 2] = vertices[threeIndex];
		maximum = Math.max(maximum, Math.abs(vertices[threeIndex]));
		p += 4; // no fucking idea why
	}
	
	// Creates the heightfield physics shape
	const heightFieldShape = new Ammo.btHeightfieldTerrainShape(
		terrainWidth,
		terrainDepth,
		ammoHeightData,
		1, // height scale is not really used, since we are using PHY_FLOAT height data type and hence it is ignored
		-maximum, // minimum height
		maximum, // maximum height
		upAxis,
		hdt,
		flipQuadEdges
	);

	// Set horizontal scale
	const scaleX = this.parameters.width / ( terrainWidth - 1 );
	const scaleZ = this.parameters.height / ( terrainDepth - 1 );
	heightFieldShape.setLocalScaling( new Ammo.btVector3( scaleX, 1, scaleZ ) );
	
	heightFieldShape.setMargin( 0.05 );

	return heightFieldShape;
};

THREE.Mesh.prototype.rigidBody = function(settings) {
	settings = settings || {}; // ensure settings not null
	
	let transform = new Ammo.btTransform();
	transform.setIdentity();
	transform.setOrigin(this.position.ammo());
	transform.setRotation(this.quaternion.ammo());
	
	let motionState = new Ammo.btDefaultMotionState(transform);
	
	colShape = new Ammo.btCompoundShape();
	
	let ammoGeometry = this.geometry.ammoGeometry();
	if (ammoGeometry) {
		let childTransform = new Ammo.btTransform();
		childTransform.setIdentity();
		colShape.addChildShape(childTransform, ammoGeometry);
	}
	
	this.children.forEach(child=>{
		let ammoGeometry = child.geometry.ammoGeometry();
		if (ammoGeometry) {
			let childTransform = new Ammo.btTransform();
			childTransform.setIdentity();
			childTransform.setOrigin(child.position.ammo());
			childTransform.setRotation(child.quaternion.ammo());
			colShape.addChildShape(childTransform, ammoGeometry);
		}
	});
	
	let localInertia = new Ammo.btVector3(0, 0, 0);
	colShape.calculateLocalInertia(settings.mass || 0, localInertia);
	let rbInfo = new Ammo.btRigidBodyConstructionInfo(settings.mass || 0, motionState, colShape, localInertia);
	
	let rigidBody = new Ammo.btRigidBody(rbInfo);
	
	if (settings.physicsWorld) settings.physicsWorld.addRigidBody(rigidBody);
	if (settings.rigidBodies) { // add this thing to the rigid bodies list
		this.userData.physicsBody = rigidBody; // affected by physics
		settings.rigidBodies.push(this);
	}
	return rigidBody;
};