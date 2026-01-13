const Config = {
	Assets: {
		chandelier: './public/imgs/chandelier_top_view.png',
		candle_on: './public/imgs/candle_top_view_light.png',
		candle_off: './public/imgs/candle_top_view_nolight.png',
	},
	GridSize: 5,
	BaseSize: 1000,
	CandleRatio: 72 / 1000,
	CandleCoords: [
		{ x: 500, y: 58 },
		{ x: 949, y: 500 },
		{ x: 725, y: 889 },
		{ x: 276, y: 889 },
		{ x: 52, y: 500 },
	],
	ChandelierConfigs: {
		'2_2': [1, 0, 1, 0, 0],
		'2_4': [0, 0, 1, 0, 1],
		'4_2': [0, 1, 0, 1, 1],
		'4_4': [0, 0, 0, 0, 1],
	},
	ChandelierLabels: {
		'2_2': '1',
		'2_4': '2',
		'4_2': '4',
		'4_4': '3',
	},
	PointerMap: {
		1: { r: 2, c: 4 },
		2: { r: 4, c: 4 },
		3: { r: 4, c: 2 },
		4: { r: 2, c: 2 },
		0: null,
	},
	Patterns: [
		'1,2;2,1;2,1,1;2',
		'1,2;2,1;1,2,1;2',
		'1,2;2,1;1,1,2;2',
		'1,2;1,2;2,1,1;2',
		'1,2;1,2;1,2,1;2',
		'1,2;1,2;1,1,2;2',
		'2,1;1,2;2,1,1;2',
		'2,1;1,2;1,2,1;2',
		'2,1;1,2;1,1,2;2',
		'2,1;2,1;2,1,1;2',
		'2,1;2,1;1,2,1;2',
		'2,1;2,1;1,1,2;2',
	],
	LabelToGrid: {
		1: { r: 2, c: 2 },
		2: { r: 2, c: 4 },
		3: { r: 4, c: 4 },
		4: { r: 4, c: 2 },
	},
};

const State = {
	chandeliers: [],
	isLocked: true,
	lastSequence: null,
	isSolutionActive: false,
	savedProgress: [],
	pendingEntry: null,
	offPatterns: {},
	theoryModalAlreadyOpen: false,
	candlesModalAlreadyOpen: false,
};

class Candle {
	constructor(parentId, index, x, y, parentChandelier, initialState = 0) {
		this.id = `${parentId}_candle_${index}`;
		this.index = index;
		this.x = x;
		this.y = y;
		this.parentChandelier = parentChandelier;
		this.initialState = initialState;
		this.state = initialState;

		this.elements = this.createElements();
		this.updateVisuals();
		this.attachEvents();
	}

	createElements() {
		const glow = document.createElement('div');
		glow.className = 'candle-glow';

		const img = document.createElement('img');
		img.src = Config.Assets.candle_off;
		img.className = 'candle-element';

		const leftPct = (this.x / Config.BaseSize) * 100;
		const topPct = (this.y / Config.BaseSize) * 100;
		const widthPct = Config.CandleRatio * 100;

		[img, glow].forEach((el) => {
			el.style.left = `${leftPct}%`;
			el.style.top = `${topPct}%`;
			el.style.transform = 'translate(-50%, -50%)';
		});

		img.style.width = `${widthPct}%`;
		glow.style.width = '25%';
		glow.style.height = '25%';

		return { img, glow };
	}

	attachEvents() {
		this.elements.img.addEventListener('click', () => this.toggleState());
		this.elements.img.addEventListener('mouseenter', () =>
			this.parentChandelier.bringToFront(true),
		);
		this.elements.img.addEventListener('mouseleave', () =>
			this.parentChandelier.bringToFront(false),
		);
	}

	toggleState() {
		GameManager.clearSolution();

		if (State.isLocked) {
			if (this.state === 0) return;

			if (this.state === 1) {
				this.parentChandelier.candles.forEach((c) => {
					if (c.state === 2) {
						c.state = 1;
						c.updateVisuals();
					}
				});
				this.state = 2;
			} else {
				this.state = 1;
			}
		} else {
			this.state = (this.state + 1) % 3;
		}

		this.updateVisuals();
		GameManager.checkCurrentPattern();
	}

	setState(newState) {
		this.state = newState;
		this.updateVisuals();
	}

	reset() {
		this.state = this.initialState;
		this.updateVisuals();
	}

	updateVisuals() {
		const { img, glow } = this.elements;
		if (this.state === 0) {
			img.style.opacity = '0';
			glow.style.opacity = '0';
			glow.style.animationName = 'none';
		} else if (this.state === 1) {
			img.src = Config.Assets.candle_off;
			img.style.opacity = '1';
			glow.style.opacity = '0';
			glow.style.animationName = 'none';
		} else {
			img.src = Config.Assets.candle_on;
			img.style.opacity = '1';
			glow.style.opacity = '1';
			glow.style.animationName = 'flicker';
			glow.style.animationDuration = '2s';
			glow.style.animationIterationCount = 'infinite';
		}
	}
}

class Chandelier {
	constructor(row, col) {
		this.row = row;
		this.col = col;
		this.id = `chandelier_r${row}_c${col}`;
		this.candles = [];
		this.dom = this.buildDOM();
		this.initCandles();
	}

	buildDOM() {
		const wrapper = document.createElement('div');
		wrapper.className = 'chandelier-wrapper';

		const aspectBox = document.createElement('div');
		aspectBox.className = 'chandelier-aspect-box';
		wrapper.appendChild(aspectBox);

		const bg = document.createElement('img');
		bg.src = Config.Assets.chandelier;
		bg.className = 'bg-chandelier';
		aspectBox.appendChild(bg);

		const labelKey = `${this.row}_${this.col}`;
		const txt = Config.ChandelierLabels[labelKey];
		if (txt) {
			const lbl = document.createElement('div');
			lbl.className = 'chandelier-label';
			lbl.textContent = txt;
			aspectBox.appendChild(lbl);
		}

		this.badge = document.createElement('div');
		this.badge.className = 'solution-badge';
		aspectBox.appendChild(this.badge);

		return { wrapper, aspectBox };
	}

	initCandles() {
		const key = `${this.row}_${this.col}`;
		const config = Config.ChandelierConfigs[key];

		Config.CandleCoords.forEach((pos, idx) => {
			const startState = config[idx] === 1 ? 1 : 0;
			const candle = new Candle(
				this.id,
				idx,
				pos.x,
				pos.y,
				this,
				startState,
			);
			this.candles.push(candle);
			this.dom.aspectBox.appendChild(candle.elements.glow);
			this.dom.aspectBox.appendChild(candle.elements.img);
		});
	}

	bringToFront(isFront) {
		const parentCell = this.dom.wrapper.parentElement;
		if (parentCell) parentCell.style.zIndex = isFront ? '100' : '2';
	}

	getActivePointer() {
		const lit = this.candles.find((c) => c.state === 2);
		return lit ? Config.PointerMap[lit.index] : null;
	}

	showBadge(text) {
		if (text) {
			this.badge.textContent = text;
			this.badge.classList.add('visible');
		} else {
			this.badge.classList.remove('visible');
		}
	}

	reset() {
		this.candles.forEach((c) => c.reset());
		this.showBadge(null);
	}

	getCenter() {
		const rect = this.dom.aspectBox.getBoundingClientRect();
		return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
	}
}

const GameManager = {
	init() {
		this.renderGrid();
		this.generateOffPatterns();
		this.renderPatternMenu();
		this.setupEventListeners();
		this.checkCurrentPattern();
		this.updateLockUI();
	},

	renderGrid() {
		const container = document.getElementById('grid-container');
		container.innerHTML = '';
		State.chandeliers = [];

		for (let r = 1; r <= 5; r++) {
			for (let c = 1; c <= 5; c++) {
				const cell = document.createElement('div');
				cell.className = 'grid-cell';

				const isChan = [2, 4].includes(r) && [2, 4].includes(c);

				if (isChan) {
					const chan = new Chandelier(r, c);
					State.chandeliers.push(chan);
					cell.appendChild(chan.dom.wrapper);
				} else {
					let content = '';
					if (r === 1 && c === 3) content = '⏫ WUNDERFIZZ ⏫';
					else if (r === 3 && c === 2)
						content =
							'<span style="transform: rotate(-90deg); display:block;">ROCKET</span>';
					else if (r === 5 && c === 3) content = '⏬ SPAWN ⏬';
					else if (r === 3 && c === 3)
						content =
							'<span style="position: absolute; right: 0; transform: translateX(50%) rotate(90deg); white-space: nowrap;">SPEED COLA</span>';

					if (content) {
						cell.innerHTML = `<div class="grid-label">${content}</div>`;
					}
				}
				container.appendChild(cell);
			}
		}
	},

	setupEventListeners() {
		document
			.getElementById('menu-toggle-btn')
			.addEventListener('click', this.toggleBottomMenu);
		document
			.getElementById('btn-pattern')
			.addEventListener('click', (e) => {
				e.stopPropagation();
				document
					.getElementById('pattern-menu')
					.classList.toggle('show');
			});
		document
			.getElementById('btn-lock')
			.addEventListener('click', this.toggleLock.bind(this));
		document
			.getElementById('btn-solve')
			.addEventListener('click', this.toggleSolution.bind(this));
		document
			.getElementById('btn-tracker')
			.addEventListener('click', this.toggleTracker.bind(this));
		document
			.getElementById('close-tracker')
			.addEventListener('click', this.toggleTracker.bind(this));
		document
			.getElementById('btn-reset')
			.addEventListener('click', this.resetGame.bind(this));
		document
			.getElementById('btn-save-entry')
			.addEventListener('click', Tracker.checkAndSave.bind(Tracker));

		document.addEventListener('click', (e) => {
			const menu = document.getElementById('pattern-menu');
			const btn = document.getElementById('btn-pattern');
			if (
				menu.classList.contains('show') &&
				!menu.contains(e.target) &&
				e.target !== btn
			) {
				menu.classList.remove('show');
			}
		});

		window.addEventListener('resize', () => {
			if (State.isSolutionActive)
				this.drawArrows(
					State.lastSequence,
					'solution-arrow',
					'arrowhead',
				);
			else Tracker.updatePreview();
		});

		document
			.getElementById('btn-export')
			.addEventListener('click', Tracker.exportExcel);
		document
			.getElementById('btn-import-trigger')
			.addEventListener('click', () =>
				document.getElementById('file-upload').click(),
			);
		document
			.getElementById('file-upload')
			.addEventListener('change', (e) => Tracker.importExcel(e.target));

		document
			.getElementById('btn-overwrite-yes')
			.addEventListener('click', Tracker.confirmOverwrite.bind(Tracker));
		document
			.getElementById('btn-overwrite-no')
			.addEventListener('click', Tracker.closeModal.bind(Tracker));

		document
			.getElementById('btn-theory-close')
			.addEventListener('click', this.closeTheoryModal.bind(this));

		document
			.getElementById('btn-candles-close')
			.addEventListener('click', this.closeCandlesModal.bind(this));

		document
			.getElementById('trk-project')
			.addEventListener('input', (e) => {
				e.target.value = e.target.value.replace(/[<>:"/\\|?*]/g, '');
			});

		this.setupDragDrop();
	},

	setupDragDrop() {
		const draggables = document.querySelectorAll('.drag-item');
		const slots = document.querySelectorAll('.order-slot, .order-pool');

		draggables.forEach((d) => {
			d.addEventListener('dragstart', (e) => {
				e.dataTransfer.setData('text/plain', e.target.id);
				e.dataTransfer.effectAllowed = 'move';
			});

			d.addEventListener('click', (e) => {
				const parent = e.target.parentElement;
				if (parent.classList.contains('order-pool')) {
					for (let i = 1; i <= 4; i++) {
						const slot = document.getElementById(`slot-${i}`);
						if (
							slot.style.display !== 'none' &&
							!slot.hasChildNodes()
						) {
							slot.appendChild(e.target);
							break;
						}
					}
				} else {
					document.getElementById('order-pool').appendChild(e.target);
				}
				Tracker.updatePreview();
			});
		});

		slots.forEach((s) => {
			s.addEventListener('dragover', (e) => {
				e.preventDefault();
				e.dataTransfer.dropEffect = 'move';
			});

			s.addEventListener('drop', (e) => {
				e.preventDefault();
				const id = e.dataTransfer.getData('text/plain');
				const el = document.getElementById(id);
				if (!el) return;

				const originParent = el.parentElement;

				if (s.classList.contains('order-slot')) {
					if (s.hasChildNodes()) {
						const existing = s.firstChild;
						if (existing !== el) {
							originParent.appendChild(existing);
						}
					}
					s.appendChild(el);
				} else {
					s.appendChild(el);
				}
				Tracker.updatePreview();
			});
		});

		document
			.getElementById('btn-clear-order')
			.addEventListener('click', () => {
				const pool = document.getElementById('order-pool');
				[1, 2, 3, 4].forEach((i) => {
					const el = document.getElementById(`drag-${i}`);
					if (el) pool.appendChild(el);
				});
				this.clearArrows();
			});
	},

	toggleBottomMenu() {
		const menu = document.getElementById('bottom-menu');
		const btn = document.getElementById('menu-toggle-btn');
		menu.classList.toggle('open');
		btn.textContent = menu.classList.contains('open')
			? 'Close Menu ▼'
			: 'Options Menu ▲';
	},

	showCandlesModal() {
		if (State.candlesModalAlreadyOpen) return;
		State.candlesModalAlreadyOpen = true;
		const modal = document.getElementById('candles-modal');
		modal.style.display = 'flex';
	},

	toggleLock() {
		State.isLocked = !State.isLocked;
		this.updateLockUI();
	},

	updateLockUI() {
		const btn = document.getElementById('btn-lock');
		if (State.isLocked) {
			btn.textContent = 'Unlock Candles';
			btn.className = 'btn-ui locked';
		} else {
			this.showCandlesModal();
			btn.textContent = 'Lock Candles';
			btn.className = 'btn-ui unlocked';
		}
	},

	closeCandlesModal() {
		const modal = document.getElementById('candles-modal');
		modal.style.display = 'none';
	},

	toggleTracker() {
		const p = document.getElementById('tracker-panel');
		p.classList.toggle('open');
		if (!p.classList.contains('open')) this.clearArrows();
	},

	resetGame() {
		State.chandeliers.forEach((c) => c.reset());
		this.clearSolution();
		this.checkCurrentPattern();
		const pool = document.getElementById('order-pool');
		[1, 2, 3, 4].forEach((i) => {
			const el = document.getElementById(`drag-${i}`);
			if (el) pool.appendChild(el);
		});
	},

	generateOffPatterns() {
		const order = ['1', '2', '4', '3'];
		const replacements = {
			unlit: ['1,1', '1,1', '1,1,1', '1'],
			hidden: ['0,0', '0,0', '0,0,0', '0'],
		};

		Config.Patterns.forEach((pat, idx) => {
			const parts = pat.split(';');
			for (let i = 0; i < 4; i++) {
				// CHANGE: Replaced "OffPattern" with "OffLayout"
				const name = `OffLayout ${idx + 1}-${order[i]}`;

				let pUnlit = [...parts];
				pUnlit[i] = replacements.unlit[i];
				const strUnlit = pUnlit.join(';');
				State.offPatterns[strUnlit] = name;

				let pHidden = [...parts];
				pHidden[i] = replacements.hidden[i];
				const strHidden = pHidden.join(';');
				State.offPatterns[strHidden] = name;
			}
		});
	},

	getCurrentPatternStr() {
		const keys = ['2_2', '2_4', '4_2', '4_4'];
		const parts = keys.map((k) => {
			const chan = State.chandeliers.find(
				(c) => c.row == k[0] && c.col == k[2],
			);
			if (!chan) return '';
			const config = Config.ChandelierConfigs[k];
			const activeStates = chan.candles
				.filter((_, i) => config[i] === 1)
				.map((c) => c.state);
			return activeStates.join(',');
		});
		return parts.join(';');
	},

	checkCurrentPattern() {
		const currentStr = this.getCurrentPatternStr();
		const idx = Config.Patterns.indexOf(currentStr);
		const display = document.getElementById('pattern-display');

		this.updateDragConstraints(currentStr);

		if (idx !== -1) {
			display.textContent = `LAYOUT ${idx + 1}`;
			display.style.color = '#fff';
		} else if (State.offPatterns[currentStr]) {
			display.textContent = State.offPatterns[currentStr].toUpperCase();
			display.style.color = '#e74c3c';
		} else {
			display.textContent = 'CUSTOM LAYOUT';
			display.style.color = 'rgba(255,255,255,0.5)';
		}
	},

	updateDragConstraints(patternStr) {
		const parts = patternStr.split(';');
		const replacements = {
			unlit: ['1,1', '1,1', '1,1,1', '1'],
			hidden: ['0,0', '0,0', '0,0,0', '0'],
		};
		const activeIndices = [];

		parts.forEach((part, i) => {
			if (
				part !== replacements.unlit[i] &&
				part !== replacements.hidden[i]
			) {
				activeIndices.push(i);
			}
		});

		const labels = ['1', '2', '4', '3'];
		const activeLabels = activeIndices.map((i) => labels[i]);

		for (let i = 1; i <= 4; i++) {
			const dragEl = document.getElementById(`drag-${i}`);
			const slotEl = document.getElementById(`slot-${i}`);

			if (activeLabels.includes(String(i))) {
				dragEl.style.display = 'flex';
			} else {
				dragEl.style.display = 'none';
				if (!dragEl.parentElement.classList.contains('order-pool')) {
					document.getElementById('order-pool').appendChild(dragEl);
				}
			}

			if (i <= activeIndices.length) {
				slotEl.style.display = 'flex';
			} else {
				slotEl.style.display = 'none';
				if (slotEl.hasChildNodes())
					document
						.getElementById('order-pool')
						.appendChild(slotEl.firstChild);
			}
		}
		Tracker.updatePreview();
	},

	applyPattern(str) {
		const parts = str.split(';');
		const mapping = ['2_2', '2_4', '4_2', '4_4'];

		const pool = document.getElementById('order-pool');
		[1, 2, 3, 4].forEach((i) => {
			const el = document.getElementById(`drag-${i}`);
			if (el) pool.appendChild(el);
		});

		mapping.forEach((key, idx) => {
			const chan = State.chandeliers.find(
				(c) => c.row == key[0] && c.col == key[2],
			);
			const vals = parts[idx].split(',').map(Number);
			const config = Config.ChandelierConfigs[key];

			let vPtr = 0;
			chan.candles.forEach((c, cIdx) => {
				if (config[cIdx] === 1) {
					c.setState(vals[vPtr] || 0);
					vPtr++;
				} else {
					c.setState(0);
				}
			});
		});

		this.checkCurrentPattern();
		document.getElementById('pattern-menu').classList.remove('show');
	},

	renderPatternMenu() {
		const menu = document.getElementById('pattern-menu');
		menu.innerHTML = '';

		Config.Patterns.forEach((pat, i) => {
			const btn = document.createElement('button');
			btn.className = 'pattern-item';
			btn.textContent = `Layout ${i + 1}`;
			btn.onclick = () => {
				this.applyPattern(pat);
				this.clearSolution();
			};
			menu.appendChild(btn);
		});

		const div = document.createElement('div');
		div.style.cssText =
			'border-top: 1px solid rgba(255,255,255,0.2); margin: 5px 0;';
		menu.appendChild(div);

		const uniqueNames = new Set();
		Object.values(State.offPatterns).forEach((n) => uniqueNames.add(n));

		uniqueNames.forEach((name) => {
			const pat = Object.keys(State.offPatterns).find(
				(key) => State.offPatterns[key] === name,
			);
			const btn = document.createElement('button');
			btn.className = 'pattern-item';
			btn.style.color = '#e74c3c';
			btn.textContent = name;
			btn.onclick = () => {
				this.applyPattern(pat);
				this.clearSolution();
			};
			menu.appendChild(btn);
		});
	},

	showTheoryModal() {
		if (State.theoryModalAlreadyOpen) return;
		State.theoryModalAlreadyOpen = true;
		const modal = document.getElementById('theory-modal');
		modal.style.display = 'flex';
	},

	toggleSolution() {
		if (State.isSolutionActive) {
			this.clearSolution();
		} else {
			this.showTheoryModal();
			this.solve();
		}
	},

	closeTheoryModal() {
		document.getElementById('theory-modal').style.display = 'none';
	},

	solve() {
		const nodes = State.chandeliers.map((c) => {
			const targetPos = c.getActivePointer();
			let targetId = null;
			if (targetPos) {
				const t = State.chandeliers.find(
					(tc) => tc.row === targetPos.r && tc.col === targetPos.c,
				);
				if (t) targetId = t.id;
			}
			return { instance: c, id: c.id, targetId, inDegree: 0 };
		});

		nodes.forEach((n) => {
			if (n.targetId) {
				const t = nodes.find((x) => x.id === n.targetId);
				if (t) t.inDegree++;
			}
		});

		let start = nodes.find((n) => n.inDegree === 0) || nodes[0];

		const seq = [];
		const visited = new Set();
		let curr = start;

		while (curr && !visited.has(curr.id)) {
			visited.add(curr.id);
			seq.push(curr);
			if (curr.targetId) {
				curr = nodes.find((n) => n.id === curr.targetId);
			} else {
				curr = null;
			}
		}

		nodes.forEach((n) => {
			if (!visited.has(n.id)) seq.push(n);
		});

		State.lastSequence = seq;
		State.isSolutionActive = true;

		seq.forEach((item, idx) => {
			const rank = ['1st', '2nd', '3rd', '4th'][idx] || '';
			item.instance.showBadge(rank);
		});

		this.drawArrows(seq, 'solution-arrow', 'arrowhead');
	},

	clearSolution() {
		State.chandeliers.forEach((c) => c.showBadge(null));
		this.clearArrows();
		State.isSolutionActive = false;
		State.lastSequence = null;
	},

	drawArrows(sequence, cssClass, markerId) {
		this.clearArrows();
		if (!sequence || sequence.length < 2) return;

		const svg = document.getElementById('arrow-layer');
		const fragment = document.createDocumentFragment();

		for (let i = 0; i < sequence.length - 1; i++) {
			const item1 = sequence[i];
			const item2 = sequence[i + 1];

			if (!item1 || !item2) continue;

			const start = item1.instance || item1;
			const end = item2.instance || item2;

			if (!start || !end) continue;

			const p1 = start.getCenter();
			const p2 = end.getCenter();

			const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
			const offset = 60;

			const x1 = p1.x + Math.cos(angle) * offset;
			const y1 = p1.y + Math.sin(angle) * offset;
			const x2 = p2.x - Math.cos(angle) * offset;
			const y2 = p2.y - Math.sin(angle) * offset;

			const line = document.createElementNS(
				'http://www.w3.org/2000/svg',
				'line',
			);
			line.setAttribute('x1', x1);
			line.setAttribute('y1', y1);
			line.setAttribute('x2', x2);
			line.setAttribute('y2', y2);
			line.setAttribute('class', cssClass);
			line.setAttribute('marker-end', `url(#${markerId})`);
			fragment.appendChild(line);
		}
		svg.appendChild(fragment);
	},

	clearArrows() {
		const svg = document.getElementById('arrow-layer');
		const lines = svg.querySelectorAll('line');
		lines.forEach((l) => l.remove());
	},
};

const Tracker = {
	checkAndSave() {
		const roundVal = parseInt(document.getElementById('trk-round').value);
		const existingIdx = State.savedProgress.findIndex(
			(x) => x.round === roundVal,
		);

		if (existingIdx !== -1) {
			State.pendingEntry = this.buildEntryObject(roundVal);
			State.pendingEntry._index = existingIdx;
			document.getElementById('overwrite-modal').style.display = 'flex';
		} else {
			this.save(this.buildEntryObject(roundVal));
		}
	},

	buildEntryObject(round) {
		const order = [];
		for (let i = 1; i <= 4; i++) {
			const slot = document.getElementById(`slot-${i}`);
			if (slot.style.display !== 'none') {
				order.push(
					slot.firstChild
						? slot.firstChild.getAttribute('data-val')
						: '?',
				);
			}
		}

		const patStr = GameManager.getCurrentPatternStr();
		let pName = 'Custom';
		const pIdx = Config.Patterns.indexOf(patStr);
		if (pIdx !== -1) pName = `Layout ${pIdx + 1}`;
		else if (State.offPatterns[patStr]) pName = State.offPatterns[patStr];

		return {
			round: round,
			patternName: pName,
			rawPattern: patStr,
			order: order.join('-'),
			result: document.getElementById('trk-result').value,
		};
	},

	confirmOverwrite() {
		if (State.pendingEntry) {
			State.savedProgress[State.pendingEntry._index] = State.pendingEntry;
			delete State.pendingEntry._index;
			this.renderTable();
			this.closeModal();
			this.advanceRound(State.pendingEntry.round);
		}
	},

	save(entry) {
		State.savedProgress.push(entry);
		State.savedProgress.sort((a, b) => a.round - b.round);
		this.renderTable();
		this.advanceRound(entry.round);
	},

	advanceRound(current) {
		document.getElementById('trk-round').value = current + 1;
		const pool = document.getElementById('order-pool');
		[1, 2, 3, 4].forEach((i) => {
			const el = document.getElementById(`drag-${i}`);
			if (el) pool.appendChild(el);
		});
		this.updatePreview();
	},

	deleteEntry(round) {
		State.savedProgress = State.savedProgress.filter(
			(x) => x.round !== round,
		);
		this.renderTable();
	},

	editEntry(round) {
		const entry = State.savedProgress.find((x) => x.round === round);
		if (!entry) return;

		document.getElementById('trk-round').value = entry.round;
		document.getElementById('trk-result').value = entry.result;
		GameManager.applyPattern(entry.rawPattern);

		const parts = entry.order.split('-');
		parts.forEach((val, idx) => {
			if (val !== '?') {
				const slot = document.getElementById(`slot-${idx + 1}`);
				const drag = document.getElementById(`drag-${val}`);
				if (slot && drag) slot.appendChild(drag);
			}
		});
		this.updatePreview();
	},

	updatePreview() {
		GameManager.clearSolution();
		const seq = [];
		for (let i = 1; i <= 4; i++) {
			const slot = document.getElementById(`slot-${i}`);
			if (slot.style.display !== 'none' && slot.hasChildNodes()) {
				const val = slot.firstChild.getAttribute('data-val');
				const pos = Config.LabelToGrid[val];
				const chan = State.chandeliers.find(
					(c) => c.row === pos.r && c.col === pos.c,
				);
				seq.push(chan);
			} else {
				seq.push(null);
			}
		}
		GameManager.drawArrows(seq, 'preview-arrow', 'arrowhead-blue');
	},

	closeModal() {
		document.getElementById('overwrite-modal').style.display = 'none';
		State.pendingEntry = null;
	},

	renderTable() {
		const tbody = document.getElementById('tracker-body');
		tbody.innerHTML = '';
		State.savedProgress.forEach((item) => {
			const tr = document.createElement('tr');
			const css =
				item.result === 'Success' ? 'status-success' : 'status-fail';
			tr.innerHTML = `
                <td>${item.round}</td>
                <td>${item.patternName}</td>
                <td>${item.order}</td>
                <td class="${css}">${item.result}</td>
                <td class="action-cell">
                    <button class="btn-sm btn-edit">✎</button>
                    <button class="btn-sm btn-del">✕</button>
                </td>
            `;
			tr.querySelector('.btn-edit').onclick = () =>
				this.editEntry(item.round);
			tr.querySelector('.btn-del').onclick = () =>
				this.deleteEntry(item.round);
			tbody.appendChild(tr);
		});
	},

	exportExcel() {
		if (State.savedProgress.length === 0) return alert('No data to export');
		const name =
			document.getElementById('trk-project').value ||
			`Astra_Data_${Date.now()}`;

		const styleBase = {
			font: { name: 'Calibri', sz: 11 },
			border: {
				top: { style: 'thick' },
				bottom: { style: 'thick' },
				left: { style: 'thick' },
				right: { style: 'thick' },
			},
			alignment: { horizontal: 'center', vertical: 'center' },
		};
		const styleHead = {
			...styleBase,
			fill: { fgColor: { rgb: '8497B0' } },
			font: {
				name: 'Calibri',
				sz: 11,
				bold: true,
				color: { rgb: 'FFFFFF' },
			},
		};

		const data = [];
		data.push(Array(16).fill(''));

		const h1 = [
			'',
			'ROUND',
			'PATTERN NAME',
			'ORDER GIVEN',
			'',
			'',
			'',
			'CANDLE POSITION CHANDELIER INFORMATION',
			'',
			'',
			'',
			'',
			'',
			'',
			'',
			'RESULT',
		].map((v, i) => ({ v, s: i > 0 ? styleHead : {} }));
		const h2 = [
			'',
			'',
			'',
			'1',
			'2',
			'3',
			'4',
			'C1 - T',
			'C1 - B',
			'C2 - T',
			'C2 - B',
			'C3',
			'C4 - R',
			'C4 - LB',
			'C4 - LT',
			'',
		].map((v, i) => ({ v, s: i > 0 ? styleHead : {} }));
		data.push(h1, h2);

		State.savedProgress.forEach((row) => {
			const r = [];
			r.push({ v: '', s: {} });
			r.push({
				v: row.round,
				t: 'n',
				s: { ...styleBase, font: { sz: 20, bold: true } },
			});
			r.push({
				v: (row.patternName || '').toUpperCase(),
				s: { ...styleBase, font: { sz: 14, bold: true } },
			});

			const ord = row.order.split('-');
			for (let i = 0; i < 4; i++)
				r.push({
					v: ord[i] || '-',
					s: { ...styleBase, font: { sz: 16, bold: true } },
				});

			const grps = row.rawPattern.split(';');
			const candles = [
				...grps[0].split(','),
				grps[1].split(',')[1],
				grps[1].split(',')[0],
				...grps[3].split(','),
				...grps[2].split(','),
			];

			candles.forEach((c) => {
				let cell = {
					v: '',
					s: { ...styleBase, fill: { fgColor: { rgb: 'F2F2F2' } } },
				};
				if (c === '2')
					cell = {
						v: 'O',
						s: {
							...styleBase,
							fill: { fgColor: { rgb: 'FFFF00' } },
							font: { sz: 16, bold: true },
						},
					};
				if (c === '1')
					cell = {
						v: '-',
						s: {
							...styleBase,
							fill: { fgColor: { rgb: '000000' } },
							font: {
								sz: 16,
								bold: true,
								color: { rgb: 'FFFFFF' },
							},
						},
					};
				r.push(cell);
			});

			const resColor = row.result === 'Success' ? '00B050' : 'FF0000';
			r.push({
				v: row.result,
				s: {
					...styleBase,
					fill: { fgColor: { rgb: resColor } },
					font: { sz: 18, bold: true, color: { rgb: 'FFFFFF' } },
				},
			});
			data.push(r);
		});

		const ws = XLSX.utils.aoa_to_sheet(data);

		ws['!merges'] = [
			{ s: { r: 1, c: 1 }, e: { r: 2, c: 1 } },
			{ s: { r: 1, c: 2 }, e: { r: 2, c: 2 } },
			{ s: { r: 1, c: 3 }, e: { r: 1, c: 6 } },
			{ s: { r: 1, c: 7 }, e: { r: 1, c: 14 } },
			{ s: { r: 1, c: 15 }, e: { r: 2, c: 15 } },
		];

		ws['!cols'] = [
			{ wpx: 12 },
			{ wpx: 89 },
			{ wpx: 166 },
			...Array(12).fill({ wpx: 54 }),
			{ wpx: 103 },
		];

		const heights = [{ hpx: 12 }, { hpx: 21 }, { hpx: 21 }];
		State.savedProgress.forEach(() => heights.push({ hpx: 40 }));
		ws['!rows'] = heights;

		ws['!views'] = [{ showGridLines: false, showRowColHeaders: false }];

		const wb = XLSX.utils.book_new();
		XLSX.utils.book_append_sheet(wb, ws, 'Progress');
		XLSX.writeFile(wb, `${name}.xlsx`);
	},

	importExcel(input) {
		const file = input.files[0];
		if (!file) return;

		document.getElementById('trk-project').value = file.name.replace(
			/\.[^/.]+$/,
			'',
		);

		const reader = new FileReader();
		reader.onload = (e) => {
			const data = new Uint8Array(e.target.result);
			const wb = XLSX.read(data, { type: 'array' });
			const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {
				header: 1,
			});

			const newDat = [];
			for (let i = 3; i < rows.length; i++) {
				const r = rows[i];
				if (!r[1]) continue;

				const parseC = (v) => (v === 'O' ? '2' : v === '-' ? '1' : '0');

				const c1 = `${parseC(r[7])},${parseC(r[8])}`;
				const c2 = `${parseC(r[10])},${parseC(r[9])}`;
				const c3 = `${parseC(r[11])}`;
				const c4 = `${parseC(r[12])},${parseC(r[13])},${parseC(r[14])}`;

				const rawPattern = `${c1};${c2};${c4};${c3}`;

				let pName = 'Custom';
				const pIdx = Config.Patterns.indexOf(rawPattern);
				if (pIdx !== -1) {
					pName = `Layout ${pIdx + 1}`;
				} else if (State.offPatterns[rawPattern]) {
					pName = State.offPatterns[rawPattern];
				}

				let ops = [r[3], r[4], r[5], r[6]];

				ops = ops.map((x) =>
					x === '-' || x == null || x === '' ? null : x,
				);

				while (ops.length > 0 && ops[ops.length - 1] === null) {
					ops.pop();
				}

				const cleanOrder = ops
					.map((x) => (x === null ? '?' : x))
					.join('-');

				newDat.push({
					round: parseInt(r[1]),
					patternName: pName,
					order: cleanOrder,
					result: r[15] || 'Failure',
					rawPattern: rawPattern,
				});
			}
			State.savedProgress = newDat;
			State.savedProgress.sort((a, b) => a.round - b.round);
			this.renderTable();

			if (State.savedProgress.length > 0) {
				const max = Math.max(
					...State.savedProgress.map((x) => x.round),
				);
				document.getElementById('trk-round').value = max + 1;
			}
		};
		reader.readAsArrayBuffer(file);
		input.value = '';
	},
};

window.onload = () => GameManager.init();
