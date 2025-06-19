import PathfindingAlgorithm from "./PathfindingAlgorithm";

class Dijkstra extends PathfindingAlgorithm {
    constructor() {
        super(); // calls parent constructor
        this.openList = []; // act like a   queue
    }
    start(startNode, endNode) {
        super.start(startNode, endNode);
        this.openList = [startNode];
    }
nextStep() {
    // 1. Handle empty openList:
    if (this.openList.length === 0) {
        this.finished = true; // Stop if no nodes left to check.
        return [];            // Return nothing.
    }

    // 2. Initialize list for UI updates:
    const updatedNodes = []; // Stores nodes changed in this step for return.

    // 3. Get current node:
    const currentNode = this.openList.shift(); // Take the first node from openList.

    // 4. Mark current node visited:
    currentNode.visited = true;

    // 5. Mark edge to current node visited (if applicable):
    const refEdge = currentNode.edges.find(e => e.getOtherNode(currentNode) === currentNode.referer);
    if (refEdge) refEdge.visited = true; // Marks the path taken to currentNode.

    // 6. Check if destination reached:
    if (currentNode.id === this.endNode.id) {
        this.openList = [];     // Clear openList.
        this.finished = true;  // Stop.
        return [currentNode]; // Return the destination node.
    }

    // 7. Process neighbors:
    for (const n of currentNode.neighbors) {
        const neighbor = n.node;
        const edge = n.edge;
        // 7a. Special update for visited neighbor via new edge:
        if (neighbor.visited && !edge.visited) {
            edge.visited = true;           // Mark edge as used.
            neighbor.referer = currentNode; // Update how this neighbor was referenced.
            updatedNodes.push(neighbor);   // Add to list for UI.
        }

    // 7b. Skip already fully processed neighbors:
        if (neighbor.visited) continue;

    // 7c. Calculate cost to this neighbor:
        const neighborCurrentCost = currentNode.distanceFromStart + edge.weight;

        // 7d. Handle neighbor if already in openList:
        if (this.openList.includes(neighbor)) {
            if (neighborCurrentCost >= neighbor.distanceFromStart) {
                continue; // Skip if new path isn't shorter.
            }
        // 7e. Handle new neighbor (not in openList):
        } else {
            this.openList.push(neighbor); // Add new neighbor to openList.
        }

        // 7f. Update neighbor's path details:
        neighbor.distanceFromStart = neighborCurrentCost; // Update distance.
        neighbor.parent = currentNode;                   // Set parent for path reconstruction.
        neighbor.referer = currentNode;                  // Update how it was reached.
    }

    // 8. Return updated nodes for this step:
    return [...updatedNodes, currentNode]; // Returns current node and specifically updated neighbors.
}






}

export default Dijkstra;