import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const textures = [
	["none", "Colour only", ""],
	["sun", "Sun", "./textures/sun.jpg"],
	["mercury", "Mercury", "./textures/mercury.jpg"],
	["venus", "Venus", "./textures/venus_surface.jpg"],
	["earth", "Earth", "./textures/earth_daymap.jpg"],
	["mars", "Mars", "./textures/mars.jpg"],
	["jupiter", "Jupiter", "./textures/jupiter.jpg"],
	["saturn", "Saturn", "./textures/saturn.jpg"],
	["uranus", "Uranus", "./textures/uranus.jpg"],
	["neptune", "Neptune", "./textures/neptune.jpg"],
	["moon", "Moon", "./textures/moon.jpg"],
];

const bodies = [
	["sun", "Sun", "star", null, 1392700, 0, 0, 609, "#ffbf45", "sun", 0],
	[
		"mercury",
		"Mercury",
		"planet",
		"sun",
		4879,
		57900000,
		88,
		1408,
		"#9f968d",
		"mercury",
		0.7,
	],
	[
		"venus",
		"Venus",
		"planet",
		"sun",
		12104,
		108200000,
		225,
		-5832,
		"#d6a55b",
		"venus",
		1.9,
	],
	[
		"earth",
		"Earth",
		"planet",
		"sun",
		12742,
		149600000,
		365.25,
		23.9,
		"#4b79c8",
		"earth",
		3.2,
	],
	[
		"moon",
		"Moon",
		"moon",
		"earth",
		3474,
		384400,
		27.3,
		655.7,
		"#b8b8b8",
		"moon",
		1.4,
	],
	[
		"mars",
		"Mars",
		"planet",
		"sun",
		6779,
		227900000,
		687,
		24.6,
		"#b75d42",
		"mars",
		4.1,
	],
	[
		"jupiter",
		"Jupiter",
		"planet",
		"sun",
		139820,
		778500000,
		4333,
		9.9,
		"#c8a783",
		"jupiter",
		5.4,
	],
	[
		"io",
		"Io",
		"moon",
		"jupiter",
		3643,
		421700,
		1.77,
		42.5,
		"#d7c15d",
		"none",
		0.9,
	],
	[
		"europa",
		"Europa",
		"moon",
		"jupiter",
		3122,
		671100,
		3.55,
		85.2,
		"#d6d0bd",
		"none",
		2.7,
	],
	[
		"saturn",
		"Saturn",
		"planet",
		"sun",
		116460,
		1433500000,
		10759,
		10.7,
		"#d5bd82",
		"saturn",
		0.2,
	],
	[
		"titan",
		"Titan",
		"moon",
		"saturn",
		5150,
		1221870,
		15.95,
		382.8,
		"#c89145",
		"none",
		2.1,
	],
	[
		"uranus",
		"Uranus",
		"planet",
		"sun",
		50724,
		2872500000,
		30687,
		-17.2,
		"#8bcfd1",
		"uranus",
		1.2,
	],
	[
		"neptune",
		"Neptune",
		"planet",
		"sun",
		49244,
		4495100000,
		60190,
		16.1,
		"#4167c8",
		"neptune",
		2.9,
	],
].map(
	([
		id,
		name,
		type,
		parent,
		diameter,
		distance,
		year,
		rotation,
		color,
		texture,
		angle,
	]) => ({
		id,
		name,
		type,
		parent,
		diameter,
		distance,
		year,
		rotation,
		color,
		texture,
		angle,
	}),
);

const $ = (selector) => document.querySelector(selector);
const canvas = $("#scene");
const tooltip = $("#tooltip");
const list = $("#body-list");
const form = $("#body-form");
const fields = Object.fromEntries(
	["name", "color", "diameter", "year", "distance", "texture"].map((id) => [
		id,
		$(`#${id}`),
	]),
);
const state = { selected: "earth", running: true, speed: 1, hover: null };

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050505);
const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 1000);
const defaultCameraPosition = new THREE.Vector3(0, 230, 430);
camera.position.copy(defaultCameraPosition);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.maxDistance = 900;

scene.add(new THREE.AmbientLight(0xffffff, 0.08));
const sunlight = new THREE.PointLight(0xffedba, 3.8, 0, 0);
scene.add(sunlight);
const root = new THREE.Group();
scene.add(root);

const loader = new THREE.TextureLoader();
const textureCache = new Map();
const records = new Map();
const orbitRadii = new Map();
const targets = [];
const raycaster = new THREE.Raycaster();
raycaster.params.Line.threshold = 2;
const pointer = new THREE.Vector2();
const clock = new THREE.Clock();

textures.forEach(([id, label]) => fields.texture.add(new Option(label, id)));
bindEvents();
resize();
rebuild();
select("earth");
animate();

function bindEvents() {
	$("#play").onclick = () => {
		state.running = !state.running;
		$("#play").textContent = state.running ? "Pause" : "Start";
	};
	$("#reset").onclick = () => {
		camera.position.copy(defaultCameraPosition);
		controls.target.set(0, 0, 0);
	};
	$("#speed").oninput = (event) => {
		state.speed = Number(event.target.value);
		$("#speed-value").textContent =
			`${state.speed.toFixed(state.speed < 1 ? 1 : 0)}x`;
	};
	$("#add-planet").onclick = () => addBody("planet");
	$("#add-moon").onclick = () => addBody("moon");
	$("#delete").onclick = removeSelected;
	form.oninput = updateSelected;
	canvas.onpointermove = hover;
	canvas.onpointerleave = hideTooltip;
	canvas.onclick = () => state.hover && select(state.hover);
	window.onresize = resize;
}

function rebuild() {
	root.traverse((object) => {
		object.geometry?.dispose();
		if (object.material) object.material.dispose();
	});
	root.clear();
	records.clear();
	targets.length = 0;
	calculateOrbitRadii();

	for (const body of bodies) {
		if (body.type === "star") {
			const mesh = makeBody(body);
			root.add(mesh);
			records.set(body.id, { body, mesh, pivot: root });
			targets.push(mesh);
			continue;
		}

		const parent = records.get(body.parent) || records.get("sun");
		const pivot = new THREE.Group();
		const orbit = makeOrbit(body);
		const mesh = makeBody(body);
		parent.pivot.add(orbit, pivot);
		pivot.add(mesh);
		records.set(body.id, { body, mesh, pivot, orbit });
		targets.push(mesh, orbit);
	}
	positionBodies();
	highlight();
}

function makeBody(body) {
	const radius = bodyRadius(body);
	const map = getTexture(body.texture);
	const color = map ? 0xffffff : body.color;
	const material =
		body.type === "star"
			? new THREE.MeshBasicMaterial({ color, map })
			: new THREE.MeshStandardMaterial({ color, map, roughness: 0.9 });
	const mesh = new THREE.Mesh(
		new THREE.SphereGeometry(radius, 32, 24),
		material,
	);
	mesh.userData.id = body.id;

	if (body.id === "saturn") {
		const ring = new THREE.Mesh(
			new THREE.RingGeometry(radius * 1.35, radius * 2.1, 64),
			new THREE.MeshBasicMaterial({
				color: 0xcdbb8b,
				side: THREE.DoubleSide,
				transparent: true,
				opacity: 0.55,
			}),
		);
		ring.rotation.x = Math.PI / 2.6;
		mesh.add(ring);
	}
	return mesh;
}

function makeOrbit(body) {
	const radius = orbitRadius(body);
	const points = Array.from({ length: 97 }, (_, index) => {
		const angle = (index / 96) * Math.PI * 2;
		return new THREE.Vector3(
			Math.cos(angle) * radius,
			0,
			Math.sin(angle) * radius,
		);
	});
	const orbit = new THREE.Line(
		new THREE.BufferGeometry().setFromPoints(points),
		new THREE.LineBasicMaterial({
			color: body.type === "moon" ? 0x777777 : 0x4d6775,
			transparent: true,
			opacity: 0.45,
		}),
	);
	orbit.userData.id = body.id;
	return orbit;
}

function getTexture(id) {
	const source = textures.find(([textureId]) => textureId === id)?.[2];
	if (!source) return null;
	if (!textureCache.has(id)) {
		const texture = loader.load(source);
		texture.colorSpace = THREE.SRGBColorSpace;
		texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
		textureCache.set(id, texture);
	}
	return textureCache.get(id);
}

function bodyRadius(body) {
	return THREE.MathUtils.clamp(
		0.9 + Math.log10(body.diameter / 4879 + 1) * 3.4,
		0.8,
		12,
	);
}

function calculateOrbitRadii() {
	orbitRadii.clear();
	const planets = bodies
		.filter(({ type }) => type === "planet")
		.sort((a, b) => a.distance - b.distance);
	const systemRadii = new Map();

	for (const planet of planets) {
		const moons = bodies
			.filter(({ type, parent }) => type === "moon" && parent === planet.id)
			.sort((a, b) => a.distance - b.distance);
		const planetEdge = bodyRadius(planet) * (planet.id === "saturn" ? 2.1 : 1);
		let previousMoon = null;
		let systemRadius = planetEdge;

		for (const moon of moons) {
			const moonRadius = bodyRadius(moon);
			const base =
				planetEdge +
				moonRadius +
				3 +
				Math.log10(moon.distance / 100000 + 1) * 2;
			const minimum = previousMoon
				? orbitRadii.get(previousMoon.id) +
					bodyRadius(previousMoon) +
					moonRadius +
					1.5
				: base;
			const radius = Math.max(base, minimum);
			orbitRadii.set(moon.id, radius);
			systemRadius = Math.max(systemRadius, radius + moonRadius);
			previousMoon = moon;
		}
		systemRadii.set(planet.id, systemRadius);
	}

	let previousPlanet = null;
	for (const planet of planets) {
		const base = 24 + Math.log10(planet.distance / 57900000 + 1) * 90;
		const extent = systemRadii.get(planet.id);
		const minimum = previousPlanet
			? orbitRadii.get(previousPlanet.id) +
				systemRadii.get(previousPlanet.id) +
				extent +
				8
			: base;
		orbitRadii.set(planet.id, Math.max(base, minimum));
		previousPlanet = planet;
	}
}

function orbitRadius(body) {
	return orbitRadii.get(body.id) || 0;
}

function positionBodies() {
	records.forEach(({ body, pivot }) => {
		if (body.type === "star") return;
		const radius = orbitRadius(body);
		pivot.position.set(
			Math.cos(body.angle) * radius,
			0,
			Math.sin(body.angle) * radius,
		);
	});
}

function animate() {
	const delta = Math.min(clock.getDelta(), 0.05);
	if (state.running) {
		records.forEach(({ body, mesh }) => {
			if (body.year) body.angle += (delta * state.speed * 6.57) / body.year;
			if (body.rotation)
				mesh.rotation.y +=
					(delta * state.speed * Math.sign(body.rotation)) /
					Math.max(Math.abs(body.rotation) / 24, 0.35);
		});
		positionBodies();
	}
	controls.update();
	renderer.render(scene, camera);
	requestAnimationFrame(animate);
}

function renderList() {
	list.replaceChildren();
	bodies.forEach((body) => {
		const button = document.createElement("button");
		button.type = "button";
		button.className = `body${body.id === state.selected ? " active" : ""}`;
		if (body.type === "moon") button.style.marginLeft = "14px";
		button.innerHTML = `<span class="dot" style="background:${body.color}"></span><span>${escapeHtml(body.name)}</span><small>${body.type}</small>`;
		button.onclick = () => select(body.id);
		list.append(button);
	});
}

function select(id) {
	state.selected = id;
	const body = selectedBody();
	$("#selected-name").textContent = body.name;
	Object.keys(fields).forEach((key) => {
		fields[key].value = body[key];
	});
	const locked = body.type === "star";
	[...form.elements].forEach((control) => {
		control.disabled = locked;
	});
	$("#delete").disabled = locked;
	renderList();
	highlight();
}

function updateSelected(event) {
	const body = selectedBody();
	if (body.type === "star") return;
	if (event.target === fields.color) fields.texture.value = "none";
	body.name = fields.name.value.trim() || body.name;
	body.color = fields.color.value;
	body.diameter = number(fields.diameter, body.diameter);
	body.year = number(fields.year, body.year);
	body.distance = number(fields.distance, body.distance);
	body.texture = fields.texture.value;
	$("#selected-name").textContent = body.name;
	rebuild();
	renderList();
}

function addBody(type) {
	const selected = selectedBody();
	const parent =
		type === "planet"
			? "sun"
			: selected.type === "star"
				? "earth"
				: selected.type === "moon"
					? selected.parent
					: selected.id;
	const id = `${type}-${Math.random().toString(36).slice(2, 8)}`;
	bodies.push({
		id,
		name: type === "planet" ? "New Planet" : "New Moon",
		type,
		parent,
		diameter: type === "planet" ? 12000 : 3200,
		distance: type === "planet" ? 188000000 : 460000,
		year: type === "planet" ? 430 : 12,
		rotation: 24,
		color: type === "planet" ? "#75b8c8" : "#cccccc",
		texture: type === "planet" ? "none" : "moon",
		angle: Math.random() * Math.PI * 2,
	});
	rebuild();
	select(id);
}

function removeSelected() {
	if (state.selected === "sun") return;
	const removed = new Set([state.selected]);
	let size;
	do {
		size = removed.size;
		bodies.forEach((body) => removed.has(body.parent) && removed.add(body.id));
	} while (removed.size !== size);
	for (let index = bodies.length - 1; index >= 0; index -= 1) {
		if (removed.has(bodies[index].id)) bodies.splice(index, 1);
	}
	rebuild();
	select(bodies.some((body) => body.id === "earth") ? "earth" : "sun");
}

function highlight() {
	records.forEach(({ body, mesh, orbit }) => {
		mesh.scale.setScalar(body.id === state.selected ? 1.18 : 1);
		if (orbit) orbit.material.opacity = body.id === state.selected ? 0.9 : 0.45;
	});
}

function hover(event) {
	const rect = canvas.getBoundingClientRect();
	pointer.set(
		((event.clientX - rect.left) / rect.width) * 2 - 1,
		-(((event.clientY - rect.top) / rect.height) * 2 - 1),
	);
	raycaster.setFromCamera(pointer, camera);
	const hit = raycaster
		.intersectObjects(targets, true)
		.find(({ object }) => object.userData.id);
	if (!hit) return hideTooltip();
	const body = bodies.find(({ id }) => id === hit.object.userData.id);
	state.hover = body.id;
	tooltip.hidden = false;
	tooltip.style.left = `${event.clientX}px`;
	tooltip.style.top = `${event.clientY}px`;
	tooltip.innerHTML = `<b>${escapeHtml(body.name)}</b><span>Diameter: ${format(body.diameter)} km</span><span>Distance: ${format(body.distance)} km</span>`;
}

function hideTooltip() {
	state.hover = null;
	tooltip.hidden = true;
}

function selectedBody() {
	return bodies.find(({ id }) => id === state.selected) || bodies[0];
}

function number(input, fallback) {
	return Number.isFinite(input.valueAsNumber)
		? THREE.MathUtils.clamp(
				input.valueAsNumber,
				Number(input.min),
				Number(input.max),
			)
		: fallback;
}

function resize() {
	camera.aspect = innerWidth / innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize(innerWidth, innerHeight, false);
}

function format(value) {
	return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(
		value,
	);
}

function escapeHtml(value) {
	return value.replace(
		/[&<>"']/g,
		(char) =>
			({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
				char
			],
	);
}
