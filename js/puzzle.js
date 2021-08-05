class Puzzle {
    constructor(meta, grid, pieces) {
        this.meta = meta;
        this.grid = grid;
        this.pieces = pieces;
    }
}


class PuzzleMetaInfo {
    constructor(name, id, difficulty, puzzleFormatVersion, angle, created, author) {
        this.name = name;
        this.id = id;
        this.difficulty = difficulty;
        this.puzzleFormatVersion = puzzleFormatVersion;
        this.angle = angle;
        this.created = created;
        this.author = author;
    }
}

class PuzzlePiece {
    constructor(color, segments) {
        this.color = color;
        this.segments = segments;
    }
}

class PuzzleCell {
    constructor(localPos) {
        this.localPos = localPos;
    }
}

class Int3 {
    constructor(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
    }
}

function LoadPuzzleFromJSON(json) {
    return unserialize(json, Puzzle);
}

function GenerateSample(){
    var piece1 = new PuzzlePiece("E39CAC", [ new PuzzleCell(new Int3(0, 0, 0)),
                                             new PuzzleCell(new Int3(1, 0, 0)),
                                             new PuzzleCell(new Int3(0, 1, 0))
                                           ]);
    var piece2 = new PuzzlePiece("ACF495", [ new PuzzleCell(new Int3(1, 1, 0)),
                                             new PuzzleCell(new Int3(1, 2, 0)),
                                             new PuzzleCell(new Int3(0, 2, 0))
                                           ]);

    var info = new PuzzleMetaInfo("Example", "08H8SVX1P3YDD7GL", "easy", 1, 0, "2020-12-12 10:46 AM", "Vanbo");

    var grid = [ new PuzzleCell(new Int3(0, 0, 0)),
                 new PuzzleCell(new Int3(0, 1, 0)),
                 new PuzzleCell(new Int3(0, 2, 0)),
                 new PuzzleCell(new Int3(1, 0, 0)),
                 new PuzzleCell(new Int3(1, 1, 0)),
                 new PuzzleCell(new Int3(1, 2, 0))];
    var pieces = [ piece1, piece2 ];

    var samplePuzzle = new Puzzle(info, grid, pieces);
    return samplePuzzle;
}
// https://stackoverflow.com/questions/51461461/serializing-a-javascript-class-object/51461516
function serialize(obj) {
    var str = JSON.stringify(obj);
    return str;
}

function unserialize(str, theClass) {
    var instance = new theClass();
    var serializedObject = JSON.parse(str);
    Object.assign(instance, serializedObject);
    return instance;
}

var str = serialize(GenerateSample());
console.log(str);