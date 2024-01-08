class IntervalNode {
	constructor(interval) {
		this.interval = interval;
		this.max = interval[1];
		this.left = null;
		this.right = null;
		this.height = 1;
		this.content = "";
		this.summary = "";
	}
}

class IntervalTree {
	constructor() {
		this.root = null;
	}

	insert(interval) {
		this.root = this._insert(this.root, interval);
	}

	// _insert(node, interval) {
	// 	if (!node) {
	// 		return new IntervalNode(interval);
	// 	}

	// 	if (interval[0] < node.interval[0]) {
	// 		node.left = this._insert(node.left, interval);
	// 	} else {
	// 		node.right = this._insert(node.right, interval);
	// 	}

	// 	if (node.max < interval[1]) {
	// 		node.max = interval[1];
	// 	}

	// 	return node;
	// }

	// Implement the search, deletion, and balancing methods similarly
	searchPoint(point) {
		return this._searchPoint(this.root, point);
	}

	_searchPoint(node, point) {
		if (!node) return false;

		// Check if the current node's interval covers the point
		if (node.interval[0] <= point && point <= node.interval[1]) {
			return true;
		}

		// If the point is less than the start of the current interval,
		// it could only be in the left subtree.
		if (point < node.interval[0] && node.left) {
			return this._searchPoint(node.left, point);
		}

		// Otherwise, check the right subtree
		return this._searchPoint(node.right, point);
	}

	//avl tree
	_getHeight(node) {
		if (!node) return 0;
		return node.height;
	}

	_getBalanceFactor(node) {
		if (!node) return 0;
		return this._getHeight(node.left) - this._getHeight(node.right);
	}

	_updateHeight(node) {
		node.height =
			Math.max(this._getHeight(node.left), this._getHeight(node.right)) + 1;
	}

	//rotations
	_rightRotate(y) {
		let x = y.left;
		let T2 = x.right;

		// Perform rotation
		x.right = y;
		y.left = T2;

		// Update heights
		this._updateHeight(y);
		this._updateHeight(x);

		// Update max values
		y.max =
			Math.max(this._getMax(y.left), this._getMax(y.right)) + y.interval[1];
		x.max =
			Math.max(this._getMax(x.left), this._getMax(x.right)) + x.interval[1];

		return x;
	}

	_leftRotate(x) {
		let y = x.right;
		let T2 = y.left;

		// Perform rotation
		y.left = x;
		x.right = T2;

		// Update heights
		this._updateHeight(x);
		this._updateHeight(y);

		// Update max values
		x.max =
			Math.max(this._getMax(x.left), this._getMax(x.right)) + x.interval[1];
		y.max =
			Math.max(this._getMax(y.left), this._getMax(y.right)) + y.interval[1];

		return y;
	}

	_getMax(node) {
		if (!node) return -Infinity;
		return node.max;
	}

	//insert with rotation
	_insert(node, interval) {
		if (!node) {
			return new IntervalNode(interval);
		}

		if (interval[0] < node.interval[0]) {
			node.left = this._insert(node.left, interval);
		} else {
			node.right = this._insert(node.right, interval);
		}

		// Update height and max value of the ancestor node
		this._updateHeight(node);
		node.max = Math.max(node.max, interval[1]);

		// Get the balance factor
		let balance = this._getBalanceFactor(node);

		// Left Left Case
		if (balance > 1 && interval[0] < node.left.interval[0]) {
			return this._rightRotate(node);
		}

		// Right Right Case
		if (balance < -1 && interval[0] > node.right.interval[0]) {
			return this._leftRotate(node);
		}

		// Left Right Case
		if (balance > 1 && interval[0] > node.left.interval[0]) {
			node.left = this._leftRotate(node.left);
			return this._rightRotate(node);
		}

		// Right Left Case
		if (balance < -1 && interval[0] < node.right.interval[0]) {
			node.right = this._rightRotate(node.right);
			return this._leftRotate(node);
		}

		return node;
	}
}

// Example usage
let itree = new IntervalTree();
itree.insert([15, 20]);
itree.insert([10, 30]);
itree.insert([17, 19]);
// Add search, delete functions as needed
