import * as THREE from 'three';
import TWEEN from 'three/addons/libs/tween.module.js';
import { TrackballControls } from 'three/addons/controls/TrackballControls.js';
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';
import { GOOGLE_CLIENT_ID, SHEET_CSV_URL } from './config.js';

let camera, scene, renderer, controls;
let selectedElement = null;

const objects = [];
const targets = { table: [], sphere: [], helix: [], grid: [] };

const DEFAULT_CAMERA_POSITION = new THREE.Vector3(0, 0, 3000);
const DEFAULT_TARGET = new THREE.Vector3(0, 0, 0);

// (column, period) for each of the 118 real periodic table positions,
// taken from the three.js css3d_periodictable example - this is what
// gives the Table layout its recognisable stepped shape (columns 1-18,
// with the lanthanide/actinide rows split out below row 7).
const TABLE_POSITIONS = [
	[1, 1], [18, 1],
	[1, 2], [2, 2], [13, 2], [14, 2], [15, 2], [16, 2], [17, 2], [18, 2],
	[1, 3], [2, 3], [13, 3], [14, 3], [15, 3], [16, 3], [17, 3], [18, 3],
	[1, 4], [2, 4], [3, 4], [4, 4], [5, 4], [6, 4], [7, 4], [8, 4], [9, 4], [10, 4], [11, 4], [12, 4], [13, 4], [14, 4], [15, 4], [16, 4], [17, 4], [18, 4],
	[1, 5], [2, 5], [3, 5], [4, 5], [5, 5], [6, 5], [7, 5], [8, 5], [9, 5], [10, 5], [11, 5], [12, 5], [13, 5], [14, 5], [15, 5], [16, 5], [17, 5], [18, 5],
	[1, 6], [2, 6],
	[4, 9], [5, 9], [6, 9], [7, 9], [8, 9], [9, 9], [10, 9], [11, 9], [12, 9], [13, 9], [14, 9], [15, 9], [16, 9], [17, 9], [18, 9],
	[4, 6], [5, 6], [6, 6], [7, 6], [8, 6], [9, 6], [10, 6], [11, 6], [12, 6], [13, 6], [14, 6], [15, 6], [16, 6], [17, 6], [18, 6],
	[1, 7], [2, 7],
	[4, 10], [5, 10], [6, 10], [7, 10], [8, 10], [9, 10], [10, 10], [11, 10], [12, 10], [13, 10], [14, 10], [15, 10], [16, 10], [17, 10], [18, 10],
	[4, 7], [5, 7], [6, 7], [7, 7], [8, 7], [9, 7], [10, 7], [11, 7], [12, 7], [13, 7], [14, 7], [15, 7], [16, 7], [17, 7], [18, 7],
];

const loginScreen = document.getElementById('login-screen');
const loginError = document.getElementById('login-error');
const loadingScreen = document.getElementById('loading-screen');
const loadingText = document.getElementById('loading-text');
const appEl = document.getElementById('app');

initGoogleSignIn();

// ---------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------

function initGoogleSignIn() {
	if (!window.google || !window.google.accounts) {
		loginError.textContent = 'Google Sign-In failed to load. Check your connection and reload.';
		loginError.classList.remove('hidden');
		return;
	}

	window.google.accounts.id.initialize({
		client_id: GOOGLE_CLIENT_ID,
		callback: onCredential,
		auto_select: false,
	});

	window.google.accounts.id.renderButton(
		document.getElementById('gsi-button'),
		{ theme: 'filled_black', size: 'large', shape: 'pill', text: 'signin_with' }
	);
}

function decodeJwt(token) {
	const base64Url = token.split('.')[1];
	const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
	const json = decodeURIComponent(
		atob(base64)
			.split('')
			.map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
			.join('')
	);
	return JSON.parse(json);
}

function onCredential(response) {
	const payload = decodeJwt(response.credential);

	document.getElementById('user-avatar').src = payload.picture || '';
	document.getElementById('user-name').textContent = payload.name || payload.email || 'Signed in';

	loginScreen.classList.add('hidden');
	loadPeopleAndStart();
}

document.getElementById('signout-btn').addEventListener('click', () => {
	window.google.accounts.id.disableAutoSelect();
	window.location.reload();
});

// ---------------------------------------------------------------------
// Data loading
// ---------------------------------------------------------------------

async function loadPeopleAndStart() {
	loadingScreen.classList.remove('hidden');

	try {
		const response = await fetch(SHEET_CSV_URL, { cache: 'no-store' });
		if (!response.ok) {
			throw new Error(`Sheet request failed (${response.status}). Is it shared as "Anyone with the link"?`);
		}

		const csvText = await response.text();
		const rows = parseCSV(csvText);
		const people = rowsToPeople(rows);

		if (people.length === 0) {
			throw new Error('No rows were found in the Google Sheet.');
		}

		loadingScreen.classList.add('hidden');
		appEl.classList.remove('hidden');

		init(people);
		animate();
	} catch (err) {
		loadingText.textContent = `Could not load data: ${err.message}`;
	}
}

function parseCSV(text) {
	const rows = [];
	let row = [];
	let field = '';
	let inQuotes = false;

	for (let i = 0; i < text.length; i++) {
		const c = text[i];

		if (inQuotes) {
			if (c === '"') {
				if (text[i + 1] === '"') {
					field += '"';
					i++;
				} else {
					inQuotes = false;
				}
			} else {
				field += c;
			}
			continue;
		}

		if (c === '"') {
			inQuotes = true;
		} else if (c === ',') {
			row.push(field);
			field = '';
		} else if (c === '\n') {
			row.push(field);
			rows.push(row);
			row = [];
			field = '';
		} else if (c === '\r') {
			// skip
		} else {
			field += c;
		}
	}

	if (field.length || row.length) {
		row.push(field);
		rows.push(row);
	}

	return rows.filter((r) => r.length > 1 || r[0] !== '');
}

function rowsToPeople(rows) {
	if (rows.length === 0) return [];

	const header = rows[0].map((h) => h.trim().toLowerCase());
	const idx = {
		name: header.indexOf('name'),
		photo: header.indexOf('photo'),
		age: header.indexOf('age'),
		country: header.indexOf('country'),
		interest: header.indexOf('interest'),
		netWorth: header.indexOf('net worth'),
	};

	const people = [];
	for (let i = 1; i < rows.length; i++) {
		const r = rows[i];
		if (!r || r.every((f) => f === '')) continue;

		const netWorthRaw = r[idx.netWorth] || '0';
		const netWorth = parseFloat(netWorthRaw.replace(/[^0-9.-]/g, '')) || 0;

		people.push({
			name: r[idx.name] || 'Unknown',
			photo: r[idx.photo] || '',
			age: r[idx.age] || '',
			country: r[idx.country] || '',
			interest: r[idx.interest] || '',
			netWorth,
		});
	}

	return people;
}

function netWorthColor(value) {
	if (value < 100000) return 'rgba(190, 50, 50, 0.85)';
	if (value < 200000) return 'rgba(215, 130, 25, 0.85)';
	return 'rgba(45, 155, 75, 0.85)';
}

function formatCurrency(value) {
	return '$' + value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ---------------------------------------------------------------------
// Scene
// ---------------------------------------------------------------------

function init(people) {
	const N = people.length;

	camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 1, 10000);
	camera.position.z = 3000;

	scene = new THREE.Scene();

	people.forEach((person) => {
		const element = document.createElement('div');
		element.className = 'element';
		element.style.backgroundColor = netWorthColor(person.netWorth);

		const photo = document.createElement('img');
		photo.className = 'photo';
		photo.src = person.photo;
		photo.loading = 'lazy';
		photo.referrerPolicy = 'no-referrer';
		photo.onerror = () => {
			photo.style.display = 'none';
		};
		element.appendChild(photo);

		const name = document.createElement('div');
		name.className = 'name';
		name.textContent = person.name;
		element.appendChild(name);

		const details = document.createElement('div');
		details.className = 'details';
		details.innerHTML = `${person.age} &middot; ${person.country}<br>${person.interest}<br>${formatCurrency(person.netWorth)}`;
		element.appendChild(details);

		const objectCSS = new CSS3DObject(element);
		objectCSS.position.x = Math.random() * 4000 - 2000;
		objectCSS.position.y = Math.random() * 4000 - 2000;
		objectCSS.position.z = Math.random() * 4000 - 2000;
		scene.add(objectCSS);

		objects.push(objectCSS);

		attachTileClick(element, objectCSS);
	});

	buildTableTargets(N);
	buildSphereTargets(N);
	buildHelixTargets(N);
	buildGridTargets(N);

	renderer = new CSS3DRenderer();
	renderer.setSize(window.innerWidth, window.innerHeight);
	document.getElementById('container').appendChild(renderer.domElement);

	controls = new TrackballControls(camera, renderer.domElement);
	controls.minDistance = 500;
	controls.maxDistance = 8000;
	controls.addEventListener('change', render);

	document.getElementById('table').addEventListener('click', () => activate('table'));
	document.getElementById('sphere').addEventListener('click', () => activate('sphere'));
	document.getElementById('helix').addEventListener('click', () => activate('helix'));
	document.getElementById('grid').addEventListener('click', () => activate('grid'));

	attachBackgroundClick();

	transform(targets.table, 2000);

	window.addEventListener('resize', onWindowResize);
}

// ---------------------------------------------------------------------
// Click-to-focus
// ---------------------------------------------------------------------

function attachTileClick(element, objectCSS) {
	let downX = 0;
	let downY = 0;

	element.addEventListener('pointerdown', (e) => {
		downX = e.clientX;
		downY = e.clientY;
	});

	element.addEventListener('pointerup', (e) => {
		const moved = Math.hypot(e.clientX - downX, e.clientY - downY);
		if (moved < 5) focusOnPerson(objectCSS, element);
	});
}

function attachBackgroundClick() {
	let downX = 0;
	let downY = 0;

	renderer.domElement.addEventListener('pointerdown', (e) => {
		downX = e.clientX;
		downY = e.clientY;
	});

	renderer.domElement.addEventListener('pointerup', (e) => {
		if (e.target !== renderer.domElement) return;
		const moved = Math.hypot(e.clientX - downX, e.clientY - downY);
		if (moved < 5) resetView();
	});
}

function focusOnPerson(objectCSS, element) {
	if (selectedElement === element) {
		resetView();
		return;
	}

	if (selectedElement) selectedElement.classList.remove('selected');
	selectedElement = element;
	element.classList.add('selected');

	const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(objectCSS.quaternion);
	const focusDistance = 480;
	const camPos = objectCSS.position.clone().add(forward.multiplyScalar(focusDistance));

	tweenCameraTo(camPos, objectCSS.position, 1200);
}

function resetView(duration = 1200) {
	if (selectedElement) {
		selectedElement.classList.remove('selected');
		selectedElement = null;
	}
	tweenCameraTo(DEFAULT_CAMERA_POSITION, DEFAULT_TARGET, duration);
}

function tweenCameraTo(position, target, duration) {
	new TWEEN.Tween(camera.position)
		.to({ x: position.x, y: position.y, z: position.z }, duration)
		.easing(TWEEN.Easing.Exponential.InOut)
		.onUpdate(render)
		.start();

	new TWEEN.Tween(controls.target)
		.to({ x: target.x, y: target.y, z: target.z }, duration)
		.easing(TWEEN.Easing.Exponential.InOut)
		.onUpdate(render)
		.start();
}

// Table: real periodic-table shape (18 columns x 10 rows, with the
// lanthanide/actinide rows split out) inside a 20x10 bounding box. Since
// the shape only has 118 real positions but we have 200 people, extra
// people re-use the same shape stacked as layers behind the front one
// (visible when you orbit) rather than breaking the recognisable outline.
function buildTableTargets(N) {
	const spacingX = 150;
	const spacingY = 190;
	const layerSpacing = 260;
	const centerCol = 9.5; // columns run 1-18
	const centerRow = 5.5; // rows run 1-10

	for (let i = 0; i < N; i++) {
		const [col, row] = TABLE_POSITIONS[i % TABLE_POSITIONS.length];
		const layer = Math.floor(i / TABLE_POSITIONS.length);

		const object = new THREE.Object3D();
		object.position.x = (col - centerCol) * spacingX;
		object.position.y = -(row - centerRow) * spacingY;
		object.position.z = -layer * layerSpacing;

		targets.table.push(object);
	}
}

// Sphere: Fibonacci/golden-angle distribution, same formula as the
// three.js css3d_periodictable example, scaled to N points.
function buildSphereTargets(N) {
	const vector = new THREE.Vector3();

	for (let i = 0; i < N; i++) {
		const phi = Math.acos(-1 + (2 * i) / N);
		const theta = Math.sqrt(N * Math.PI) * phi;

		const object = new THREE.Object3D();
		object.position.setFromSphericalCoords(800, phi, theta);

		vector.copy(object.position).multiplyScalar(2);
		object.lookAt(vector);

		targets.sphere.push(object);
	}
}

// Double helix: two intertwined strands (like DNA) instead of the demo's
// single strand. Consecutive people alternate strands; each strand pair
// shares a height so the two strands wind around each other.
function buildHelixTargets(N) {
	const vector = new THREE.Vector3();
	const angleStep = 0.35;
	const heightStep = 16;
	const radius = 900;

	for (let i = 0; i < N; i++) {
		const pairIndex = Math.floor(i / 2);
		const strand = i % 2; // 0 = strand A, 1 = strand B (offset by PI)

		const theta = pairIndex * angleStep + strand * Math.PI;
		const y = -(pairIndex * heightStep) + (Math.ceil(N / 2) * heightStep) / 2;

		const object = new THREE.Object3D();
		object.position.setFromCylindricalCoords(radius, theta, y);

		vector.x = object.position.x * 2;
		vector.y = object.position.y;
		vector.z = object.position.z * 2;
		object.lookAt(vector);

		targets.helix.push(object);
	}
}

// Grid: 5 (x) x 4 (y) x 10 (z) volume - exactly 200 slots.
function buildGridTargets(N) {
	const gx = 5;
	const gy = 4;
	const gz = 10;
	const spacing = 420;

	for (let i = 0; i < N; i++) {
		const xi = i % gx;
		const yi = Math.floor(i / gx) % gy;
		const zi = Math.floor(i / (gx * gy));

		const object = new THREE.Object3D();
		object.position.x = xi * spacing - (spacing * (gx - 1)) / 2;
		object.position.y = -yi * spacing + (spacing * (gy - 1)) / 2;
		object.position.z = zi * spacing - (spacing * (gz - 1)) / 2;

		targets.grid.push(object);
	}
}

function activate(name) {
	document.querySelectorAll('.layout-btn').forEach((b) => b.classList.remove('active'));
	document.getElementById(name).classList.add('active');
	transform(targets[name], 2000);
	resetView(800);
}

function transform(targetList, duration) {
	TWEEN.removeAll();

	for (let i = 0; i < objects.length; i++) {
		const object = objects[i];
		const target = targetList[i];

		new TWEEN.Tween(object.position)
			.to({ x: target.position.x, y: target.position.y, z: target.position.z }, Math.random() * duration + duration)
			.easing(TWEEN.Easing.Exponential.InOut)
			.start();

		new TWEEN.Tween(object.rotation)
			.to({ x: target.rotation.x, y: target.rotation.y, z: target.rotation.z }, Math.random() * duration + duration)
			.easing(TWEEN.Easing.Exponential.InOut)
			.start();
	}

	new TWEEN.Tween({})
		.to({}, duration * 2)
		.onUpdate(render)
		.start();
}

function onWindowResize() {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

	renderer.setSize(window.innerWidth, window.innerHeight);

	render();
}

function animate() {
	requestAnimationFrame(animate);

	TWEEN.update();
	controls.update();
}

function render() {
	renderer.render(scene, camera);
}
