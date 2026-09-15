declare module 'clipper-lib' {
  export interface IntPoint { X: number; Y: number }
  export type Path = IntPoint[];
  export type Paths = Path[];
  export enum ClipType { ctIntersection = 0, ctUnion = 1, ctDifference = 2, ctXor = 3 }
  export enum PolyType { ptSubject = 0, ptClip = 1 }
  export enum PolyFillType { pftEvenOdd = 0, pftNonZero = 1, pftPositive = 2, pftNegative = 3 }
  export class PolyNode {
    Contour(): Path;
    IsHole(): boolean;
    Childs(): PolyNode[];
    ChildCount(): number;
    IsOpen: boolean;
  }
  export class PolyTree extends PolyNode {
    Clear(): void;
    Total(): number;
  }
  export class Clipper {
    constructor(initOptions?: number);
    StrictlySimple: boolean;
    PreserveCollinear: boolean;
    ReverseSolution: boolean;
    AddPath(path: Path, polyType: PolyType, closed: boolean): boolean;
    AddPaths(paths: Paths, polyType: PolyType, closed: boolean): boolean;
    Execute(clipType: ClipType, solution: Paths | PolyTree, subjFillType?: PolyFillType, clipFillType?: PolyFillType): boolean;
    static Orientation(path: Path): boolean;
    static Area(path: Path): number;
    static CleanPolygons(paths: Paths, distance?: number): Paths;
    static SimplifyPolygons(paths: Paths, fillType?: PolyFillType): Paths;
    static ioStrictlySimple: number;
    static ioPreserveCollinear: number;
  }
}
