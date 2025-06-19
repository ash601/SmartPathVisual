import Dijkstra from "./algorithms/Dijkstra";
import PathfindingAlgorithm from "./algorithms/PathfindingAlgorithm";

export default class PathfindingState {
    static #instance;
    // # make it private
    constructor() {
        if (!PathfindingState.#instance) {
            this.endNode = null;
            this.graph = null;
            this.finished = false;
            this.algorithm = new PathfindingAlgorithm();
            PathfindingState.#instance = this;
        }
        return PathfindingState.#instance;
    }

    get startNode() {
        return this.graph.startNode;
    }

    getNode(id) {
        return this.graph?.getNode(id);
    }

    reset() {
        this.finished = false;
        if(!this.graph) return;
        for(const key of this.graph.nodes.keys()) {
            this.graph.nodes.get(key).reset();
        }
    }

    start(algorithmType) {
        this.reset();
        switch(algorithmType) {
            case "dijkstra":
                this.algorithm = new Dijkstra();
                break;
            default:
                this.algorithm = new Dijkstra();
                break;
        }
        this.algorithm.start(this.startNode, this.endNode);
    }

    nextStep() {
        const updatedNodes = this.algorithm.nextStep();
        if(this.algorithm.finished || updatedNodes.length === 0) {
            this.finished = true;
        }
        return updatedNodes;
    }
}