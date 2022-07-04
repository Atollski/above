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