/* globals AFRAME,THREE,CANNON */

function LoadPuzzleByName(puzzleName) {
  ClearPreviousPuzzle();
  let scene = document.querySelector('a-scene');
  let newEl = document.createElement("a-entity");
  newEl.setAttribute('id', 'puzzle-generator');
  newEl.setAttribute('puzzle-generator', '');
  newEl.puzzleUrl = "./puzzles/" + puzzleName + ".cube";
  scene.appendChild(newEl);
}


AFRAME.registerComponent('puzzle-generator', {
  init: function () {
    var el = this.el;
    var self = this;
    var CELL_SIZE = 0.04;

    // url set by LoadPuzzleByName function
    let requestURL = this.el.puzzleUrl;
    // let requestURL = 'https://github.com/cubismvr/Mods/raw/main/CustomPuzzles/Example.cube';
    let request = new XMLHttpRequest();
    request.onload = function() {
      //sample = request.response;
      var sample = request.response;

      // generate grid
      var gridEl = document.createElement("a-entity");
      gridEl.setAttribute('id', 'grid');
      gridEl.setAttribute('body', 'type: static; shape: none;');
      gridEl.setAttribute('shape__off', 'shape: box; halfExtents: 1 1 1;');

      gridEl.addEventListener("body-loaded", () => {
        gridEl.body.position.set(0.4, 1, 0.2);
        gridEl.setAttribute('collision-filter', {collisionForces: false});
        ClearPhysicsShapes(gridEl);
        self.createPhysicsGrid(gridEl, sample.grid, CELL_SIZE);
        // TODO shader material for grid
        // var gridMesh = self.createGeometry(gridEl.body, null);
        // gridEl.setObject3D("grid", gridMesh);
      })
      el.appendChild(gridEl);

      // create individual piece generators
      for (var i = 0; i < sample.pieces.length; i++) {
        var newEl = document.createElement("a-entity");
        newEl.setAttribute('mixin', 'piece-body-init');
        newEl.setAttribute('piece', '');
        newEl.setAttribute('class', 'piece');
        // IMPORTANT dynamic-body component removal does not work if set in mixin, so setting attributes separately
        newEl.setAttribute('body', 'type: dynamic; shape: none;');
        newEl.setAttribute('shape__off', 'shape: box; halfExtents: 1 1 1;');
        newEl.pieceInitPos = new THREE.Vector3(0.2 + (i * 0.5), 1, 0.2 );
        newEl.pieceData = sample.pieces[i];
        newEl.pieceSize = CELL_SIZE;

        el.appendChild(newEl);
      }
    }
    request.open('GET', requestURL);
    request.responseType = 'json';
    request.send();
  },


  createPhysicsGrid: function(gridEl, gridLocs, gridCellSize) {
    var s = gridCellSize;
    console.log(s);
    var shape = new CANNON.Box(new CANNON.Vec3(0.5*s,0.5*s,0.5*s));
    gridLocs.forEach((cell) => {
      var pos = cell.localPos;
      gridEl.body.addShape( shape, new CANNON.Vec3( pos.x*s, pos.y*s, pos.z*s));
    })
  }
});


AFRAME.registerComponent('piece', {
  init: function() {
    this.el.addEventListener("body-loaded", () => {
      this.generatePiece(this.el.pieceData, this.el.pieceInitPos);
    })
  },


  createGeometry : function(body, pieceColor){
    var material = null;
    if (pieceColor) {
      var hexStr = ("0x" + pieceColor).toLowerCase();
      var hexNum = parseInt(hexStr,16)
      material = new THREE.MeshLambertMaterial( {color: hexNum} );
    } else { // Can be used for grid
      material = new THREE.MeshBasicMaterial( {wireframe: true} );
    }

    var geom = new THREE.Geometry();

    for (var l = 0; l < body.shapes.length; l++) {
        var shape = body.shapes[l];

        var mesh;

        var box_geometry = new THREE.BoxGeometry(  shape.halfExtents.x*2,
                                                        shape.halfExtents.y*2,
                                                        shape.halfExtents.z*2 );
            mesh = new THREE.Mesh( box_geometry, material );


        mesh.receiveShadow = true;
        mesh.castShadow = true;
        if(mesh.children){
            for(var i=0; i<mesh.children.length; i++){
                mesh.children[i].castShadow = true;
                mesh.children[i].receiveShadow = true;
                if(mesh.children[i]){
                    for(var j=0; j<mesh.children[i].length; j++){
                        mesh.children[i].children[j].castShadow = true;
                        mesh.children[i].children[j].receiveShadow = true;
                    }
                }
            }
        }

        var o = body.shapeOffsets[l];
        var q = body.shapeOrientations[l];
        mesh.position.set(o.x, o.y, o.z);
        mesh.quaternion.set(q.x, q.y, q.z, q.w);

        mesh.updateMatrix();
        geom.merge(mesh.geometry, mesh.matrix);
    }
    return new THREE.Mesh(geom, material);
  },


  createPhysicsBody: function(element, segments) {
    var s = this.el.pieceSize;;
    var shape = new CANNON.Box(new CANNON.Vec3(0.5*s,0.5*s,0.5*s));
    for (var i = 0; i < segments.length; i++) {
      var pos = segments[i].localPos;
      element.body.addShape(shape, new CANNON.Vec3( pos.x*s, pos.y*s, pos.z*s));
    }
  },


  generatePiece: function(puzzlePiece, pos) {
    var self = this;
    // TODO For some reason create a completely new body is not working
    // So take element with physics body, clear and then add new shapes
    var posC = new CANNON.Vec3(pos.x,pos.y,pos.z)
    ClearPhysicsShapes(this.el);
    this.createPhysicsBody(this.el, puzzlePiece.segments);
    this.el.body.position = posC;
    this.el.body.quaternion.setFromEuler(0, 0, 0);

    var posThree = new THREE.Vector3(pos.x, pos.y, pos.z );
    var newMesh = this.createGeometry(this.el.body, puzzlePiece.color);
    this.el.setObject3D("geom", newMesh);

    // Add events for transparency on hover
    this.el.addEventListener('hover-start', function (e) {
      // var mat = self.el.getObject3D('geom').material;
      newMesh.material.opacity = 0.7;
      newMesh.material.transparent = true;
        
    });

    this.el.addEventListener('hover-end', function (e) {
      newMesh.material.opacity = 1;
      newMesh.material.transparent = false;
    });

    // Show or hide ghost of this piece snapped to a global grid
    // piece state variables for ghost actions
    self.isGrabbed = false;
    self.isCollidingWithGrid = false;
    self.isGhostActive = false;

    // initialize ghost mesh for this piece
    var ghostEl = document.querySelector('#snap-ghost');
    self.snapGhostEl = ghostEl;
    var ghostMesh = newMesh.clone();
    ghostMesh.visible = true;
    ghostMesh.material = newMesh.material.clone();
    ghostMesh.material.opacity = 0.5;
    ghostMesh.material.transparent = true;
    self.snapGhostMesh = ghostMesh;


    this.el.addEventListener('grab-start', function (e) {
      self.isGrabbed = true;
      self.el.setAttribute('collision-filter', {collisionForces: true});
    });

    this.el.addEventListener('grab-end', function (e) {
      self.isGrabbed = false;
      if (self.isGhostActive) {
        self.disableGhost();
        self.snapPiece();
      }
    });

    var gridEl = document.querySelector("#grid");
    this.el.addEventListener('collide', function (e) {
      if (e.detail.body.el.id === "grid") {
        console.log('Piece collided with grid');
        self.isCollidingWithGrid = true;
      }
    });

    // Collision exit
    // https://github.com/pmndrs/cannon-es/blob/28248468d27496ff3b029aa141b0a930505f8ac3/examples/trigger.html#L54-L62
    var currWorld = this.el.sceneEl.systems.physics.driver.world;
    currWorld.addEventListener('endContact', (event) => {
      if (
        (event.bodyA === gridEl.body && event.bodyB === self.el.body) ||
        (event.bodyB === self.el.body && event.bodyA === gridEl.body)
      ) {
        console.log('The piece exited the grid!', event);
        self.isCollidingWithGrid = false;
      }
    });
  },


  snapPiece: function() {
    // adapted from https://github.com/schteppe/cannon.js/issues/215
    var self = this;

    let pbody = self.el.body;
    // Position
    pbody.position.setZero();
    pbody.previousPosition.setZero();
    pbody.interpolatedPosition.setZero();
    pbody.initPosition.setZero();

    // orientation
    pbody.quaternion.set(0,0,0,1);
    pbody.initQuaternion.set(0,0,0,1);
    pbody.previousQuaternion.set(0,0,0,1);
    pbody.interpolatedQuaternion.set(0,0,0,1);

    // Velocity
    pbody.velocity.setZero();
    pbody.initVelocity.setZero();
    pbody.angularVelocity.setZero();
    pbody.initAngularVelocity.setZero();

    // Force
    pbody.force.setZero();
    pbody.torque.setZero();

    // Sleep state reset
    pbody.sleepState = 0;
    pbody.timeLastSleepy = 0;
    pbody._wakeUpAfterNarrowphase = false;


    // move piece to ghost location to insert in grid
    let p = self.snapGhostMesh.position;
    let q = self.snapGhostMesh.quaternion;
    self.el.body.position.set(p.x, p.y, p.z);
    self.el.body.quaternion.set(q.x, q.y, q.z, q.w);
    self.el.setAttribute('collision-filter', {collisionForces: false});
    console.log("snapped to grid");
  },


  // TODO determine and fix the pivot positions
  snap: function(objEl, refEl) {
    var posStepSize = this.el.pieceSize;

    // Position snap
    var pos = refEl.body.position;
    var vec = new THREE.Vector3(pos.x, pos.y, pos.z);
    vec.multiplyScalar(1 / posStepSize);
    vec.round();
    vec.multiplyScalar(posStepSize);
    objEl.getObject3D("mesh").position.set(vec.x, vec.y, vec.z);
    console.log(objEl.getObject3D("mesh").position);

    // Rotation snap
    let quatC = refEl.body.quaternion;
    let quatT = new THREE.Quaternion(quatC.x, quatC.y, quatC.z, quatC.w);
    var final = ThreeSnapToNearestRightAngle(quatT);
    objEl.getObject3D("mesh").quaternion.set(final.x, final.y, final.z, final.w);
    objEl.getObject3D("mesh").updateMatrix();
    console.log(objEl.getObject3D("mesh").quaternion);
  },


  tick: function(time, deltaTime) {
    var self = this;

    if (self.isGrabbed && self.isCollidingWithGrid) {
      if (!self.isGhostActive) {
        self.enableGhost();
      }
      // snap ghost to grid
      self.snap(self.snapGhostEl, self.el);

    } else {
      if (self.isGhostActive) {
        self.disableGhost();
      }
    }
  },


  enableGhost: function () {
    var self = this;
    self.snapGhostEl.setObject3D("mesh", self.snapGhostMesh);
    self.snapGhostMesh.visible = true;
    self.isGhostActive = true;
    console.log("enable ghost called");
  },


  disableGhost: function () {
    var self = this;
    let ghostMesh = self.snapGhostEl.getObject3D("mesh");
    if (ghostMesh && ghostMesh.visible) {
      ghostMesh.visible = false;
    }
    self.isGhostActive = false;
    console.log("disable ghost called");
  }
});


// adapted from https://schteppe.github.io/cannon.js/docs/files/src_objects_Body.js.html#l507
// https://schteppe.github.io/cannon.js/docs/classes/Body.html#method_addShape
function ClearPhysicsShapes(element){
  element.body.shapes.length = 0;
  element.body.shapeOffsets.length = 0;
  element.body.shapeOrientations.length = 0;
  element.body.updateMassProperties();
  element.body.updateBoundingRadius();
  element.body.aabbNeedsUpdate = true;
}


AFRAME.registerComponent('puzzle-listen', {
  init: function () {
    var comp = this;
    var puzzle = document.querySelector('#puzzle');
    var scene = document.querySelector('a-scene');
    this.el.addEventListener('thumbstickdown', function (e) {
      comp.arrangePieces();
      comp.grabmove(puzzle, this);
    });

    this.el.addEventListener('thumbstickup', function (e) {
      comp.grabmovereleased(puzzle, scene);
    });
  },

  grabmove: function (grabbed, grabbedBy) {
    grabbedBy.object3D.attach(grabbed.object3D);
  },

  grabmovereleased: function (released, parent) {
    parent.object3D.attach(released.object3D);
  }
});


AFRAME.registerComponent('anim-grippers-listen', {
    init: function () {
      var lg = document.querySelector("#left-gripper");
      var rg = document.querySelector("#right-gripper");

      function selectStart() {
        lg.emit("gd");
        rg.emit("gd");
      }

      function selectEnd() {
        lg.emit("gu");
        rg.emit("gu");
      }

      this.el.addEventListener('gripdown', selectStart);
      this.el.addEventListener('triggerdown', selectStart);

      this.el.addEventListener('gripup', selectEnd);
      this.el.addEventListener('triggerup', selectEnd);
  },
});


// Turn controller's physics presence on only while button held down
AFRAME.registerComponent('phase-shift', {
    init: function () {
        var el = this.el

        el.addEventListener('gripdown', function () {
            el.setAttribute('collision-filter', {collisionForces: true})
        })
        el.addEventListener('gripup', function () {
            el.setAttribute('collision-filter', {collisionForces: false})
        })
    }
})


function ClearPreviousPuzzle() {
  let elements = document.querySelectorAll('#puzzle-generator');
  for (var i = elements.length - 1; i >= 0; i--) {
    elements[i].parentNode.removeChild(elements[i]);
  }
}


// Adapted from https://gamedev.stackexchange.com/questions/83601/from-3d-rotation-snap-to-nearest-90-directions/183342#183342
function ThreeSnappedToNearestAxis(dir) {
  let direction = new THREE.Vector3(dir.x, dir.y, dir.z);
  x = Math.abs(direction.x);
  y = Math.abs(direction.y);
  z = Math.abs(direction.z);
  if (x > y && x > z) {
      return new THREE.Vector3(Math.sign(direction.x), 0, 0);
  }
  else if (y > x && y > z) {
      return new THREE.Vector3(0, Math.sign(direction.y), 0);
  }
  else {
      return new THREE.Vector3(0, 0, Math.sign(direction.z));
  }
}


// Adapted from https://gamedev.stackexchange.com/questions/83601/from-3d-rotation-snap-to-nearest-90-directions/183342#183342
function ThreeSnapToNearestRightAngle(currentRotation) {
  let closestToForward = new THREE.Vector3(0, 0, 0);
  let forwardDir = new THREE.Vector3(0, 0, 1);
  let currForwardDir = forwardDir.clone();
  currForwardDir.applyQuaternion(currentRotation);
  closestToForward = ThreeSnappedToNearestAxis(currForwardDir);

  let closestToUp = new THREE.Vector3(0, 0, 0);
  let upDir = new THREE.Vector3(0, 1, 0);
  let currUpDir = upDir.clone();
  currUpDir.applyQuaternion(currentRotation);
  closestToUp = ThreeSnappedToNearestAxis(currUpDir);

  var q = LookRotation(closestToForward, closestToUp);
  return new THREE.Quaternion(q.x, q.y, q.z, q.w);
}


// Adapted from https://gist.github.com/aeroson/043001ca12fe29ee911e
function LookRotation(forward, up) {
  forward.normalize();

  var right = new THREE.Vector3();
  (right.crossVectors(up, forward)).normalize();
  up.crossVectors(forward, right);
  var m00 = right.x;
  var m01 = right.y;
  var m02 = right.z;
  var m10 = up.x;
  var m11 = up.y;
  var m12 = up.z;
  var m20 = forward.x;
  var m21 = forward.y;
  var m22 = forward.z;


  var num8 = (m00 + m11) + m22;
  var quaternion = new THREE.Quaternion();
  if (num8 > 0)
  {
    var num = Math.sqrt(num8 + 1);
    quaternion.w = num * 0.5;
    num = 0.5 / num;
    quaternion.x = (m12 - m21) * num;
    quaternion.y = (m20 - m02) * num;
    quaternion.z = (m01 - m10) * num;
    return quaternion;
  }
  if ((m00 >= m11) && (m00 >= m22))
  {
    var num7 = Math.sqrt(((1 + m00) - m11) - m22);
    var num4 = 0.5 / num7;
    quaternion.x = 0.5 * num7;
    quaternion.y = (m01 + m10) * num4;
    quaternion.z = (m02 + m20) * num4;
    quaternion.w = (m12 - m21) * num4;
    return quaternion;
  }
  if (m11 > m22)
  {
    var num6 = Math.sqrt(((1 + m11) - m00) - m22);
    var num3 = 0.5 / num6;
    quaternion.x = (m10 + m01) * num3;
    quaternion.y = 0.5 * num6;
    quaternion.z = (m21 + m12) * num3;
    quaternion.w = (m20 - m02) * num3;
    return quaternion;
  }
  var num5 = Math.sqrt(((1 + m22) - m00) - m11);
  var num2 = 0.5 / num5;
  quaternion.x = (m20 + m02) * num2;
  quaternion.y = (m21 + m12) * num2;
  quaternion.z = 0.5 * num5;
  quaternion.w = (m01 - m10) * num2;
  return quaternion;
}
