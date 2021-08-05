/* globals AFRAME,THREE,CANNON */

function LoadPuzzleByName(puzzleName) {
    // <a-entity id="pieces-generator" pieces-generator></a-entity>
    ClearPreviousPuzzle();
    let scene = document.querySelector('a-scene');
    let newEl = document.createElement("a-entity");
    newEl.setAttribute('id', 'pieces-generator');
    newEl.setAttribute('pieces-generator', '');
    newEl.puzzleUrl = "./puzzles/" + puzzleName + ".cube";
    scene.appendChild(newEl);
}


AFRAME.registerComponent('pieces-generator', {
    init: function () {
        var el = this.el;

        // url set by LoadPuzzleByName function
        let requestURL = this.el.puzzleUrl;
        // let requestURL = 'https://github.com/cubismvr/Mods/raw/main/CustomPuzzles/Example.cube';
        let request = new XMLHttpRequest();
        request.onload = function() {
          //sample = request.response;
          var sample = request.response;
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

            el.appendChild(newEl);
          }
          
        }
        request.open('GET', requestURL);
        request.responseType = 'json';
        request.send();
    },
});


AFRAME.registerComponent('piece', {
  init: function() {
    this.el.addEventListener("body-loaded", () => {
      this.generatePiece(this.el.pieceData, this.el.pieceInitPos);
    })
  },

  createGeometry : function(body, pieceColor){
    var hexStr = ("0x" + pieceColor).toLowerCase();
    var hexNum = parseInt(hexStr,16)
    var material = new THREE.MeshLambertMaterial( {color: hexNum} );

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

  // adapted from https://schteppe.github.io/cannon.js/docs/files/src_objects_Body.js.html#l507
  // https://schteppe.github.io/cannon.js/docs/classes/Body.html#method_addShape
  clearShape: function(element){
    element.body.shapes.length = 0;
    element.body.shapeOffsets.length = 0;
    element.body.shapeOrientations.length = 0;
    element.body.updateMassProperties();
    element.body.updateBoundingRadius();

    element.body.aabbNeedsUpdate = true;
  },

  createPhysicsBody: function(element, segments) {
    var s = 0.04;
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
    this.clearShape(this.el);
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
  },
});

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

function GrabMove(grabbed, grabbedBy) {
    grabbedBy.object3D.attach(grabbed.object3D);
}

function GrabMoveReleased(released, parent) {
    parent.object3D.attach(released.object3D);
}

function ClearPreviousPuzzle() {
  let elements = document.querySelectorAll('#pieces-generator');
  for (var i = elements.length - 1; i >= 0; i--) {
    elements[i].parentNode.removeChild(elements[i]);
  }
}