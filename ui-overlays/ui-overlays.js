//#region node_modules/svelte/src/internal/shared/utils.js
var e = Array.isArray, t = Array.prototype.indexOf, n = Array.prototype.includes, r = Array.from, i = Object.defineProperty, a = Object.getOwnPropertyDescriptor, o = Object.getOwnPropertyDescriptors, s = Object.prototype, c = Array.prototype, l = Object.getPrototypeOf, u = Object.isExtensible, d = () => {};
function f(e) {
	return e();
}
function p(e) {
	for (var t = 0; t < e.length; t++) e[t]();
}
function m() {
	var e, t;
	return {
		promise: new Promise((n, r) => {
			e = n, t = r;
		}),
		resolve: e,
		reject: t
	};
}
var h = 1024, g = 2048, _ = 4096, ee = 8192, te = 16384, ne = 32768, re = 1 << 25, ie = 65536, ae = 1 << 19, oe = 1 << 20, se = 65536, ce = 1 << 21, le = 1 << 22, ue = 1 << 23, de = Symbol("$state"), fe = Symbol("attributes"), pe = Symbol("class"), me = Symbol("style"), he = Symbol("text"), ge = new class extends Error {
	name = "StaleReactionError";
	message = "The reaction that called `getAbortSignal()` was re-run or destroyed";
}();
globalThis.document?.contentType;
function _e(e) {
	throw Error("https://svelte.dev/e/lifecycle_outside_component");
}
//#endregion
//#region node_modules/svelte/src/internal/client/errors.js
function ve() {
	throw Error("https://svelte.dev/e/async_derived_orphan");
}
function ye(e) {
	throw Error("https://svelte.dev/e/effect_in_teardown");
}
function be() {
	throw Error("https://svelte.dev/e/effect_in_unowned_derived");
}
function xe(e) {
	throw Error("https://svelte.dev/e/effect_orphan");
}
function Se() {
	throw Error("https://svelte.dev/e/effect_update_depth_exceeded");
}
function Ce() {
	throw Error("https://svelte.dev/e/state_descriptors_fixed");
}
function we() {
	throw Error("https://svelte.dev/e/state_prototype_fixed");
}
function Te() {
	throw Error("https://svelte.dev/e/state_unsafe_mutation");
}
function Ee() {
	throw Error("https://svelte.dev/e/svelte_boundary_reset_onerror");
}
//#endregion
//#region node_modules/svelte/src/constants.js
var De = {}, v = Symbol("uninitialized");
function Oe() {
	console.warn("https://svelte.dev/e/derived_inert");
}
function ke(e) {
	console.warn("https://svelte.dev/e/hydration_mismatch");
}
function Ae() {
	console.warn("https://svelte.dev/e/svelte_boundary_reset_noop");
}
//#endregion
//#region node_modules/svelte/src/internal/client/dom/hydration.js
var y = !1;
function je(e) {
	y = e;
}
var b;
function x(e) {
	if (e === null) throw ke(), De;
	return b = e;
}
function Me() {
	return x(/* @__PURE__ */ L(b));
}
function Ne(e) {
	if (y) {
		if (/* @__PURE__ */ L(b) !== null) throw ke(), De;
		b = e;
	}
}
function Pe(e = 1) {
	if (y) {
		for (var t = e, n = b; t--;) n = /* @__PURE__ */ L(n);
		b = n;
	}
}
function Fe(e = !0) {
	for (var t = 0, n = b;;) {
		if (n.nodeType === 8) {
			var r = n.data;
			if (r === "]") {
				if (t === 0) return n;
				--t;
			} else (r === "[" || r === "[!" || r[0] === "[" && !isNaN(Number(r.slice(1)))) && (t += 1);
		}
		var i = /* @__PURE__ */ L(n);
		e && n.remove(), n = i;
	}
}
function Ie(e) {
	if (!e || e.nodeType !== 8) throw ke(), De;
	return e.data;
}
//#endregion
//#region node_modules/svelte/src/internal/client/reactivity/equality.js
function Le(e) {
	return e === this.v;
}
function Re(e, t) {
	return e == e ? e !== t || typeof e == "object" && !!e || typeof e == "function" : t == t;
}
function ze(e) {
	return !Re(e, this.v);
}
//#endregion
//#region node_modules/svelte/src/internal/flags/index.js
var S = !1, Be = !1;
function Ve() {
	Be = !0;
}
//#endregion
//#region node_modules/svelte/src/internal/client/context.js
var C = null;
function w(e) {
	C = e;
}
function He(e, t = !1, n) {
	C = {
		p: C,
		i: !1,
		c: null,
		e: null,
		s: e,
		x: null,
		r: G,
		l: Be && !t ? {
			s: null,
			u: null,
			$: []
		} : null
	};
}
function Ue(e) {
	var t = C, n = t.e;
	if (n !== null) {
		t.e = null;
		for (var r of n) on(r);
	}
	return e !== void 0 && (t.x = e), t.i = !0, C = t.p, e ?? {};
}
function We() {
	return !Be || C !== null && C.l === null;
}
//#endregion
//#region node_modules/svelte/src/internal/client/dom/task.js
var T = [];
function Ge() {
	var e = T;
	T = [], p(e);
}
function E(e) {
	if (T.length === 0 && !vt) {
		var t = T;
		queueMicrotask(() => {
			t === T && Ge();
		});
	}
	T.push(e);
}
function Ke(e) {
	var t = G;
	if (t === null) return H.f |= ue, e;
	if (!(t.f & 32768) && !(t.f & 4)) throw e;
	D(e, t);
}
function D(e, t) {
	if (!(t !== null && t.f & 16384)) {
		for (; t !== null;) {
			if (t.f & 128) {
				if (!(t.f & 32768)) throw e;
				try {
					t.b.error(e);
					return;
				} catch (t) {
					e = t;
				}
			}
			t = t.parent;
		}
		throw e;
	}
}
//#endregion
//#region node_modules/svelte/src/internal/client/reactivity/status.js
var qe = ~(g | _ | h);
function O(e, t) {
	e.f = e.f & qe | t;
}
function Je(e) {
	e.f & 512 || e.deps === null ? O(e, h) : O(e, _);
}
//#endregion
//#region node_modules/svelte/src/internal/client/reactivity/utils.js
function Ye(e) {
	if (e !== null) for (let t of e) !(t.f & 2) || !(t.f & 65536) || (t.f ^= se, Ye(t.deps));
}
function Xe(e, t, n) {
	e.f & 2048 ? t.add(e) : e.f & 4096 && n.add(e), Ye(e.deps), O(e, h);
}
//#endregion
//#region node_modules/svelte/src/internal/client/reactivity/store.js
var Ze = !1;
//#endregion
//#region node_modules/svelte/src/reactivity/create-subscriber.js
function Qe(e) {
	let t = 0, n = Pt(0), r;
	return () => {
		nn() && ($(n), un(() => (t === 0 && (r = zn(() => e(() => Rt(n)))), t += 1, () => {
			E(() => {
				--t, t === 0 && (r?.(), r = void 0, Rt(n));
			});
		})));
	};
}
//#endregion
//#region node_modules/svelte/src/internal/client/dom/blocks/boundary.js
var $e = ie | ae;
function et(e, t, n, r) {
	new tt(e, t, n, r);
}
var tt = class {
	parent;
	is_pending = !1;
	transform_error;
	#e;
	#t = y ? b : null;
	#n;
	#r;
	#i;
	#a = null;
	#o = null;
	#s = null;
	#c = null;
	#l = 0;
	#u = 0;
	#d = !1;
	#f = /* @__PURE__ */ new Set();
	#p = /* @__PURE__ */ new Set();
	#m = null;
	#h = Qe(() => (this.#m = Pt(this.#l), () => {
		this.#m = null;
	}));
	constructor(e, t, n, r) {
		this.#e = e, this.#n = t, this.#r = (e) => {
			var t = G;
			t.b = this, t.f |= 128, n(e);
		}, this.parent = G.b, this.transform_error = r ?? this.parent?.transform_error ?? ((e) => e), this.#i = fn(() => {
			if (y) {
				let e = this.#t;
				Me();
				let t = e.data === "[!";
				if (e.data.startsWith("[?")) {
					let t = JSON.parse(e.data.slice(2));
					this.#_(t);
				} else t ? this.#v() : this.#g();
			} else this.#y();
		}, $e), y && (this.#e = b);
	}
	#g() {
		try {
			this.#a = z(() => this.#r(this.#e));
		} catch (e) {
			this.error(e);
		}
	}
	#_(e) {
		let t = this.#n.failed;
		t && (this.#s = z(() => {
			t(this.#e, () => e, () => () => {});
		}));
	}
	#v() {
		let e = this.#n.pending;
		e && (this.is_pending = !0, this.#o = z(() => e(this.#e)), E(() => {
			var e = this.#c = document.createDocumentFragment(), t = I();
			e.append(t), this.#a = this.#x(() => z(() => this.#r(t))), this.#u === 0 && (this.#e.before(e), this.#c = null, vn(this.#o, () => {
				this.#o = null;
			}), this.#b(A));
		}));
	}
	#y() {
		try {
			if (this.is_pending = this.has_pending_snippet(), this.#u = 0, this.#l = 0, this.#a = z(() => {
				this.#r(this.#e);
			}), this.#u > 0) {
				var e = this.#c = document.createDocumentFragment();
				Sn(this.#a, e);
				let t = this.#n.pending;
				this.#o = z(() => t(this.#e));
			} else this.#b(A);
		} catch (e) {
			this.error(e);
		}
	}
	#b(e) {
		this.is_pending = !1, e.transfer_effects(this.#f, this.#p);
	}
	defer_effect(e) {
		Xe(e, this.#f, this.#p);
	}
	is_rendered() {
		return !this.is_pending && (!this.parent || this.parent.is_rendered());
	}
	has_pending_snippet() {
		return !!this.#n.pending;
	}
	#x(e) {
		var t = G, n = H, r = C;
		K(this.#i), W(this.#i), w(this.#i.ctx);
		try {
			return wt.ensure(), e();
		} catch (e) {
			return Ke(e), null;
		} finally {
			K(t), W(n), w(r);
		}
	}
	#S(e, t) {
		if (!this.has_pending_snippet()) {
			this.parent && this.parent.#S(e, t);
			return;
		}
		this.#u += e, this.#u === 0 && (this.#b(t), this.#o && vn(this.#o, () => {
			this.#o = null;
		}), this.#c &&= (this.#e.before(this.#c), null));
	}
	update_pending_count(e, t) {
		this.#S(e, t), this.#l += e, !(!this.#m || this.#d) && (this.#d = !0, E(() => {
			this.#d = !1, this.#m && It(this.#m, this.#l);
		}));
	}
	get_effect_pending() {
		return this.#h(), $(this.#m);
	}
	error(e) {
		if (!this.#n.onerror && !this.#n.failed) throw e;
		A?.is_fork ? (this.#a && A.skip_effect(this.#a), this.#o && A.skip_effect(this.#o), this.#s && A.skip_effect(this.#s), A.oncommit(() => {
			this.#C(e);
		})) : this.#C(e);
	}
	#C(e) {
		this.#a &&= (B(this.#a), null), this.#o &&= (B(this.#o), null), this.#s &&= (B(this.#s), null), y && (x(this.#t), Pe(), x(Fe()));
		var t = this.#n.onerror;
		let n = this.#n.failed;
		var r = !1, i = !1;
		let a = () => {
			if (r) {
				Ae();
				return;
			}
			r = !0, i && Ee(), this.#s !== null && vn(this.#s, () => {
				this.#s = null;
			}), this.#x(() => {
				this.#y();
			});
		}, o = (e) => {
			try {
				i = !0, t?.(e, a), i = !1;
			} catch (e) {
				D(e, this.#i && this.#i.parent);
			}
			n && (this.#s = this.#x(() => {
				try {
					return z(() => {
						var t = G;
						t.b = this, t.f |= 128, n(this.#e, () => e, () => a);
					});
				} catch (e) {
					return D(e, this.#i.parent), null;
				}
			}));
		};
		E(() => {
			var t;
			try {
				t = this.transform_error(e);
			} catch (e) {
				D(e, this.#i && this.#i.parent);
				return;
			}
			typeof t == "object" && t && typeof t.then == "function" ? t.then(o, (e) => D(e, this.#i && this.#i.parent)) : o(t);
		});
	}
};
//#endregion
//#region node_modules/svelte/src/internal/client/reactivity/async.js
function nt(e, t, n, r) {
	let i = We() ? ot : lt;
	var a = e.filter((e) => !e.settled), o = t.map(i);
	if (n.length === 0 && a.length === 0) {
		r(o);
		return;
	}
	var s = G, c = rt(), l = a.length === 1 ? a[0].promise : a.length > 1 ? Promise.all(a.map((e) => e.promise)) : null;
	function u(e) {
		if (!(s.f & 16384)) {
			c();
			try {
				r([...o, ...e]);
			} catch (e) {
				D(e, s);
			}
			it();
		}
	}
	var d = at();
	if (n.length === 0) {
		l.then(() => u([])).finally(d);
		return;
	}
	function f() {
		Promise.all(n.map((e) => /* @__PURE__ */ ct(e))).then(u).catch((e) => D(e, s)).finally(d);
	}
	l ? l.then(() => {
		c(), f(), it();
	}) : f();
}
function rt() {
	var e = G, t = H, n = C, r = A;
	return function(i = !0) {
		K(e), W(t), w(n), i && !(e.f & 16384) && (r?.activate(), r?.apply());
	};
}
function it(e = !0) {
	K(null), W(null), w(null), e && A?.deactivate();
}
function at() {
	var e = G, t = e.b, n = A, r = !!t?.is_rendered();
	return t?.update_pending_count(1, n), n.increment(r, e), () => {
		t?.update_pending_count(-1, n), n.decrement(r, e);
	};
}
/*#__NO_SIDE_EFFECTS__*/
function ot(e) {
	var t = 2 | g;
	return G !== null && (G.f |= ae), {
		ctx: C,
		deps: null,
		effects: null,
		equals: Le,
		f: t,
		fn: e,
		reactions: null,
		rv: 0,
		v,
		wv: 0,
		parent: G,
		ac: null
	};
}
var st = Symbol("obsolete");
/*#__NO_SIDE_EFFECTS__*/
function ct(e, t, n) {
	let r = G;
	r === null && ve();
	var i = void 0, a = Pt(v), o = !H, s = /* @__PURE__ */ new Set();
	return ln(() => {
		var t = G, n = m();
		i = n.promise;
		try {
			Promise.resolve(e()).then(n.resolve, (e) => {
				e !== ge && n.reject(e);
			}).finally(it);
		} catch (e) {
			n.reject(e), it();
		}
		var c = A;
		if (o) {
			if (t.f & 32768) var l = at();
			if (r.b?.is_rendered()) c.async_deriveds.get(t)?.reject(st);
			else for (let e of s.values()) e.reject(st);
			s.add(n), c.async_deriveds.set(t, n);
		}
		let u = (e, t = void 0) => {
			l?.(), s.delete(n), t !== st && (c.activate(), t ? (a.f |= ue, It(a, t)) : (a.f & 8388608 && (a.f ^= ue), It(a, e)), c.deactivate());
		};
		n.promise.then(u, (e) => u(null, e || "unknown"));
	}), rn(() => {
		for (let e of s) e.reject(st);
	}), new Promise((e) => {
		function t(n) {
			function r() {
				n === i ? e(a) : t(i);
			}
			n.then(r, r);
		}
		t(i);
	});
}
/*#__NO_SIDE_EFFECTS__*/
function lt(e) {
	let t = /* @__PURE__ */ ot(e);
	return t.equals = ze, t;
}
function ut(e) {
	var t = e.effects;
	if (t !== null) {
		e.effects = null;
		for (var n = 0; n < t.length; n += 1) B(t[n]);
	}
}
function dt(e) {
	var t, n = G, r = e.parent;
	if (!V && r !== null && e.v !== v && r.f & 24576) return Oe(), e.v;
	K(r);
	try {
		e.f &= ~se, ut(e), t = Nn(e);
	} finally {
		K(n);
	}
	return t;
}
function ft(e) {
	var t = dt(e);
	if (!e.equals(t) && (e.wv = An(), (!A?.is_fork || e.deps === null) && (A === null ? e.v = t : (A.capture(e, t, !0), gt?.capture(e, t, !0)), e.deps === null))) {
		O(e, h);
		return;
	}
	V || (j === null ? Je(e) : (nn() || A?.is_fork) && j.set(e, t));
}
function pt(e) {
	if (e.effects !== null) for (let t of e.effects) (t.teardown || t.ac) && (t.teardown?.(), t.ac?.abort(ge), t.fn !== null && (t.teardown = d), t.ac = null, Fn(t, 0), mn(t));
}
function mt(e) {
	if (e.effects !== null) for (let t of e.effects) t.teardown && t.fn !== null && In(t);
}
//#endregion
//#region node_modules/svelte/src/internal/client/reactivity/batch.js
var ht = null, k = null, A = null, gt = null, j = null, _t = null, vt = !1, yt = !1, bt = null, xt = null, St = 0, Ct = 1, wt = class e {
	id = Ct++;
	#e = !1;
	linked = !0;
	#t = null;
	#n = null;
	async_deriveds = /* @__PURE__ */ new Map();
	current = /* @__PURE__ */ new Map();
	previous = /* @__PURE__ */ new Map();
	#r = /* @__PURE__ */ new Set();
	#i = /* @__PURE__ */ new Set();
	#a = 0;
	#o = /* @__PURE__ */ new Map();
	#s = null;
	#c = [];
	#l = [];
	#u = /* @__PURE__ */ new Set();
	#d = /* @__PURE__ */ new Set();
	#f = /* @__PURE__ */ new Map();
	#p = /* @__PURE__ */ new Set();
	is_fork = !1;
	#m = !1;
	constructor() {
		k === null ? ht = k = this : (k.#n = this, this.#t = k), k = this;
	}
	#h() {
		if (this.is_fork) return !0;
		for (let n of this.#o.keys()) {
			for (var e = n, t = !1; e.parent !== null;) {
				if (this.#f.has(e)) {
					t = !0;
					break;
				}
				e = e.parent;
			}
			if (!t) return !0;
		}
		return !1;
	}
	skip_effect(e) {
		this.#f.has(e) || this.#f.set(e, {
			d: [],
			m: []
		}), this.#p.delete(e);
	}
	unskip_effect(e, t = (e) => this.schedule(e)) {
		var n = this.#f.get(e);
		if (n) {
			this.#f.delete(e);
			for (var r of n.d) O(r, g), t(r);
			for (r of n.m) O(r, _), t(r);
		}
		this.#p.add(e);
	}
	#g() {
		this.#e = !0, St++ > 1e3 && (this.#S(), Tt());
		for (let e of this.#u) this.#d.delete(e), O(e, g), this.schedule(e);
		for (let e of this.#d) O(e, _), this.schedule(e);
		let t = this.#c;
		this.#c = [], this.apply();
		var n = bt = [], r = [], i = xt = [];
		for (let e of t) try {
			this.#_(e, n, r);
		} catch (t) {
			throw jt(e), this.#h() || this.discard(), t;
		}
		if (A = null, i.length > 0) {
			var a = e.ensure();
			for (let e of i) a.schedule(e);
		}
		if (bt = null, xt = null, this.#h()) {
			this.#b(r), this.#b(n);
			for (let [e, t] of this.#f) At(e, t);
			i.length > 0 && A.#g();
			return;
		}
		let o = this.#v();
		if (o) {
			this.#b(r), this.#b(n), o.#y(this);
			return;
		}
		this.#u.clear(), this.#d.clear();
		for (let e of this.#r) e(this);
		this.#r.clear(), gt = this, Et(r), Et(n), gt = null, this.#s?.resolve();
		var s = A;
		if (this.#a === 0 && (this.#c.length === 0 || s !== null) && (this.#S(), S && (this.#x(), A = s)), this.#c.length > 0) if (s !== null) {
			let e = s;
			e.#c.push(...this.#c.filter((t) => !e.#c.includes(t)));
		} else s = this;
		s !== null && s.#g();
	}
	#_(e, t, n) {
		e.f ^= h;
		for (var r = e.first; r !== null;) {
			var i = r.f, a = (i & 96) != 0;
			if (!(a && i & 1024 || i & 8192 || this.#f.has(r)) && r.fn !== null) {
				a ? r.f ^= h : i & 4 ? t.push(r) : S && i & 16777224 ? n.push(r) : jn(r) && (i & 16 && this.#d.add(r), In(r));
				var o = r.first;
				if (o !== null) {
					r = o;
					continue;
				}
			}
			for (; r !== null;) {
				var s = r.next;
				if (s !== null) {
					r = s;
					break;
				}
				r = r.parent;
			}
		}
	}
	#v() {
		for (var e = this.#t; e !== null;) {
			if (!e.is_fork) {
				for (let [t, [, n]] of this.current) if (e.current.has(t) && !n) return e;
			}
			e = e.#t;
		}
		return null;
	}
	#y(e) {
		for (let [t, n] of e.current) !this.previous.has(t) && e.previous.has(t) && this.previous.set(t, e.previous.get(t)), this.current.set(t, n);
		for (let [t, n] of e.async_deriveds) {
			let e = this.async_deriveds.get(t);
			e && n.promise.then(e.resolve).catch(e.reject);
		}
		e.async_deriveds.clear(), this.transfer_effects(e.#u, e.#d);
		let t = (e) => {
			var n = e.reactions;
			if (n !== null) for (let e of n) {
				var r = e.f;
				if (r & 2) t(e);
				else {
					var i = e;
					r & 4194320 && !this.async_deriveds.has(i) && (this.#d.delete(i), O(i, g), this.schedule(i));
				}
			}
		};
		for (let e of this.current.keys()) t(e);
		this.oncommit(() => e.discard()), e.#S(), A = this, this.#g();
	}
	#b(e) {
		for (var t = 0; t < e.length; t += 1) Xe(e[t], this.#u, this.#d);
	}
	capture(e, t, n = !1) {
		e.v !== v && !this.previous.has(e) && this.previous.set(e, e.v), e.f & 8388608 || (this.current.set(e, [t, n]), j?.set(e, t)), this.is_fork || (e.v = t);
	}
	activate() {
		A = this;
	}
	deactivate() {
		A = null, j = null;
	}
	flush() {
		try {
			yt = !0, A = this, this.#g();
		} finally {
			St = 0, _t = null, bt = null, xt = null, yt = !1, A = null, j = null, N.clear();
		}
	}
	discard() {
		for (let e of this.#i) e(this);
		this.#i.clear();
		for (let e of this.async_deriveds.values()) e.reject(st);
		this.#S(), this.#s?.resolve();
	}
	register_created_effect(e) {
		this.#l.push(e);
	}
	#x() {
		for (let u = ht; u !== null; u = u.#n) {
			var e = u.id < this.id, t = [];
			for (let [r, [i, a]] of this.current) {
				if (u.current.has(r)) {
					var n = u.current.get(r)[0];
					if (e && i !== n) u.current.set(r, [i, a]);
					else continue;
				}
				t.push(r);
			}
			if (e) for (let [e, t] of this.async_deriveds) {
				let n = u.async_deriveds.get(e);
				n && t.promise.then(n.resolve).catch(n.reject);
			}
			var r = [...u.current.keys()].filter((e) => !u.current.get(e)[1]);
			if (!(!u.#e || r.length === 0)) {
				var i = r.filter((e) => !this.current.has(e));
				if (i.length === 0) e && u.discard();
				else if (t.length > 0) {
					if (e) for (let e of this.#p) u.unskip_effect(e, (e) => {
						e.f & 4194320 ? u.schedule(e) : u.#b([e]);
					});
					u.activate();
					var a = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Map();
					for (var s of t) Dt(s, i, a, o);
					o = /* @__PURE__ */ new Map();
					var c = [...u.current].filter(([e, t]) => {
						let n = this.current.get(e);
						return n ? n[0] !== t[0] || n[1] !== t[1] : !0;
					}).map(([e]) => e);
					if (c.length > 0) for (let e of this.#l) !(e.f & 155648) && Ot(e, c, o) && (e.f & 4194320 ? (O(e, g), u.schedule(e)) : u.#u.add(e));
					if (u.#c.length > 0 && !u.#m) {
						u.apply();
						for (var l of u.#c) u.#_(l, [], []);
						u.#c = [];
					}
					u.deactivate();
				}
			}
		}
	}
	increment(e, t) {
		if (this.#a += 1, e) {
			let e = this.#o.get(t) ?? 0;
			this.#o.set(t, e + 1);
		}
	}
	decrement(e, t) {
		if (--this.#a, e) {
			let e = this.#o.get(t) ?? 0;
			e === 1 ? this.#o.delete(t) : this.#o.set(t, e - 1);
		}
		this.#m || (this.#m = !0, E(() => {
			this.#m = !1, this.linked && this.flush();
		}));
	}
	transfer_effects(e, t) {
		for (let t of e) this.#u.add(t);
		for (let e of t) this.#d.add(e);
		e.clear(), t.clear();
	}
	oncommit(e) {
		this.#r.add(e);
	}
	ondiscard(e) {
		this.#i.add(e);
	}
	settled() {
		return (this.#s ??= m()).promise;
	}
	static ensure() {
		if (A === null) {
			let t = A = new e();
			!yt && !vt && E(() => {
				t.#e || t.flush();
			});
		}
		return A;
	}
	apply() {
		if (!S || !this.is_fork && this.#t === null && this.#n === null) {
			j = null;
			return;
		}
		j = /* @__PURE__ */ new Map();
		for (let [e, [t]] of this.current) j.set(e, t);
		for (let t = ht; t !== null; t = t.#n) if (!(t === this || t.is_fork)) {
			var e = !1;
			if (t.id < this.id) {
				for (let [n, [, r]] of t.current) if (!r && this.current.has(n)) {
					e = !0;
					break;
				}
			}
			if (!e) for (let [e, n] of t.previous) j.has(e) || j.set(e, n);
		}
	}
	schedule(e) {
		if (_t = e, e.b?.is_pending && e.f & 16777228 && !(e.f & 32768)) {
			e.b.defer_effect(e);
			return;
		}
		for (var t = e; t.parent !== null;) {
			t = t.parent;
			var n = t.f;
			if (bt !== null && t === G && (S || (H === null || !(H.f & 2)) && !Ze)) return;
			if (n & 96) {
				if (!(n & 1024)) return;
				t.f ^= h;
			}
		}
		this.#c.push(t);
	}
	#S() {
		if (this.linked) {
			var e = this.#t, t = this.#n;
			e === null ? ht = t : e.#n = t, t === null ? k = e : t.#t = e, this.linked = !1;
		}
	}
};
function Tt() {
	try {
		Se();
	} catch (e) {
		D(e, _t);
	}
}
var M = null;
function Et(e) {
	var t = e.length;
	if (t !== 0) {
		for (var n = 0; n < t;) {
			var r = e[n++];
			if (!(r.f & 24576) && jn(r) && (M = /* @__PURE__ */ new Set(), In(r), r.deps === null && r.first === null && r.nodes === null && r.teardown === null && r.ac === null && _n(r), M?.size > 0)) {
				N.clear();
				for (let e of M) {
					if (e.f & 24576) continue;
					let t = [e], n = e.parent;
					for (; n !== null;) M.has(n) && (M.delete(n), t.push(n)), n = n.parent;
					for (let e = t.length - 1; e >= 0; e--) {
						let n = t[e];
						n.f & 24576 || In(n);
					}
				}
				M.clear();
			}
		}
		M = null;
	}
}
function Dt(e, t, n, r) {
	if (!n.has(e) && (n.add(e), e.reactions !== null)) for (let i of e.reactions) {
		let e = i.f;
		e & 2 ? Dt(i, t, n, r) : e & 4194320 && !(e & 2048) && Ot(i, t, r) && (O(i, g), kt(i));
	}
}
function Ot(e, t, r) {
	let i = r.get(e);
	if (i !== void 0) return i;
	if (e.deps !== null) for (let i of e.deps) {
		if (n.call(t, i)) return !0;
		if (i.f & 2 && Ot(i, t, r)) return r.set(i, !0), !0;
	}
	return r.set(e, !1), !1;
}
function kt(e) {
	A.schedule(e);
}
function At(e, t) {
	if (!(e.f & 32 && e.f & 1024)) {
		e.f & 2048 ? t.d.push(e) : e.f & 4096 && t.m.push(e), O(e, h);
		for (var n = e.first; n !== null;) At(n, t), n = n.next;
	}
}
function jt(e) {
	O(e, h);
	for (var t = e.first; t !== null;) jt(t), t = t.next;
}
//#endregion
//#region node_modules/svelte/src/internal/client/reactivity/sources.js
var Mt = /* @__PURE__ */ new Set(), N = /* @__PURE__ */ new Map(), Nt = !1;
function Pt(e, t) {
	return {
		f: 0,
		v: e,
		reactions: null,
		equals: Le,
		rv: 0,
		wv: 0
	};
}
/*#__NO_SIDE_EFFECTS__*/
function P(e, t) {
	let n = Pt(e, t);
	return En(n), n;
}
/*#__NO_SIDE_EFFECTS__*/
function Ft(e, t = !1, n = !0) {
	let r = Pt(e);
	return t || (r.equals = ze), Be && n && C !== null && C.l !== null && (C.l.s ??= []).push(r), r;
}
function F(e, t, n = !1) {
	return H !== null && (!U || H.f & 131072) && We() && H.f & 4325394 && (q === null || !q.has(e)) && Te(), It(e, n ? Bt(t) : t, xt);
}
function It(e, t, n = null) {
	if (!e.equals(t)) {
		N.set(e, V ? t : e.v);
		var r = wt.ensure();
		if (r.capture(e, t), e.f & 2) {
			let t = e;
			e.f & 2048 && dt(t), j === null && Je(t);
		}
		e.wv = An(), zt(e, g, n), We() && G !== null && G.f & 1024 && !(G.f & 96) && (X === null ? Dn([e]) : X.push(e)), !r.is_fork && Mt.size > 0 && !Nt && Lt();
	}
	return t;
}
function Lt() {
	Nt = !1;
	for (let e of Mt) {
		e.f & 1024 && O(e, _);
		let t;
		try {
			t = jn(e);
		} catch {
			t = !0;
		}
		t && In(e);
	}
	Mt.clear();
}
function Rt(e) {
	F(e, e.v + 1);
}
function zt(e, t, n) {
	var r = e.reactions;
	if (r !== null) for (var i = We(), a = r.length, o = 0; o < a; o++) {
		var s = r[o], c = s.f;
		if (!(!i && s === G)) {
			var l = (c & g) === 0;
			if (l && O(s, t), c & 131072) Mt.add(s);
			else if (c & 2) {
				var u = s;
				j?.delete(u), c & 65536 || (c & 512 && (G === null || !(G.f & 2097152)) && (s.f |= se), zt(u, _, n));
			} else if (l) {
				var d = s;
				c & 16 && M !== null && M.add(d), n === null ? kt(d) : n.push(d);
			}
		}
	}
}
function Bt(t) {
	if (typeof t != "object" || !t || de in t) return t;
	let n = l(t);
	if (n !== s && n !== c) return t;
	var r = /* @__PURE__ */ new Map(), i = e(t), o = /* @__PURE__ */ P(0), u = null, d = Q, f = (e) => {
		if (Q === d) return e();
		var t = H, n = Q;
		W(null), kn(d);
		var r = e();
		return W(t), kn(n), r;
	};
	return i && r.set("length", /* @__PURE__ */ P(t.length, u)), new Proxy(t, {
		defineProperty(e, t, n) {
			(!("value" in n) || n.configurable === !1 || n.enumerable === !1 || n.writable === !1) && Ce();
			var i = r.get(t);
			return i === void 0 ? f(() => {
				var e = /* @__PURE__ */ P(n.value, u);
				return r.set(t, e), e;
			}) : F(i, n.value, !0), !0;
		},
		deleteProperty(e, t) {
			var n = r.get(t);
			if (n === void 0) {
				if (t in e) {
					let e = f(() => /* @__PURE__ */ P(v, u));
					r.set(t, e), Rt(o);
				}
			} else F(n, v), Rt(o);
			return !0;
		},
		get(e, n, i) {
			if (n === de) return t;
			var o = r.get(n), s = n in e;
			if (o === void 0 && (!s || a(e, n)?.writable) && (o = f(() => /* @__PURE__ */ P(Bt(s ? e[n] : v), u)), r.set(n, o)), o !== void 0) {
				var c = $(o);
				return c === v ? void 0 : c;
			}
			return Reflect.get(e, n, i);
		},
		getOwnPropertyDescriptor(e, t) {
			var n = Reflect.getOwnPropertyDescriptor(e, t);
			if (n && "value" in n) {
				var i = r.get(t);
				i && (n.value = $(i));
			} else if (n === void 0) {
				var a = r.get(t), o = a?.v;
				if (a !== void 0 && o !== v) return {
					enumerable: !0,
					configurable: !0,
					value: o,
					writable: !0
				};
			}
			return n;
		},
		has(e, t) {
			if (t === de) return !0;
			var n = r.get(t), i = n !== void 0 && n.v !== v || Reflect.has(e, t);
			return (n !== void 0 || G !== null && (!i || a(e, t)?.writable)) && (n === void 0 && (n = f(() => /* @__PURE__ */ P(i ? Bt(e[t]) : v, u)), r.set(t, n)), $(n) === v) ? !1 : i;
		},
		set(e, t, n, s) {
			var c = r.get(t), l = t in e;
			if (i && t === "length") for (var d = n; d < c.v; d += 1) {
				var p = r.get(d + "");
				p === void 0 ? d in e && (p = f(() => /* @__PURE__ */ P(v, u)), r.set(d + "", p)) : F(p, v);
			}
			if (c === void 0) (!l || a(e, t)?.writable) && (c = f(() => /* @__PURE__ */ P(void 0, u)), F(c, Bt(n)), r.set(t, c));
			else {
				l = c.v !== v;
				var m = f(() => Bt(n));
				F(c, m);
			}
			var h = Reflect.getOwnPropertyDescriptor(e, t);
			if (h?.set && h.set.call(s, n), !l) {
				if (i && typeof t == "string") {
					var g = r.get("length"), _ = Number(t);
					Number.isInteger(_) && _ >= g.v && F(g, _ + 1);
				}
				Rt(o);
			}
			return !0;
		},
		ownKeys(e) {
			$(o);
			var t = Reflect.ownKeys(e).filter((e) => {
				var t = r.get(e);
				return t === void 0 || t.v !== v;
			});
			for (var [n, i] of r) i.v !== v && !(n in e) && t.push(n);
			return t;
		},
		setPrototypeOf() {
			we();
		}
	});
}
new Set([
	"copyWithin",
	"fill",
	"pop",
	"push",
	"reverse",
	"shift",
	"sort",
	"splice",
	"unshift"
]);
var Vt, Ht, Ut, Wt;
function Gt() {
	if (Vt === void 0) {
		Vt = window, Ht = /Firefox/.test(navigator.userAgent);
		var e = Element.prototype, t = Node.prototype, n = Text.prototype;
		Ut = a(t, "firstChild").get, Wt = a(t, "nextSibling").get, u(e) && (e[pe] = void 0, e[fe] = null, e[me] = void 0, e.__e = void 0), u(n) && (n[he] = void 0);
	}
}
function I(e = "") {
	return document.createTextNode(e);
}
/*@__NO_SIDE_EFFECTS__*/
function Kt(e) {
	return Ut.call(e);
}
/*@__NO_SIDE_EFFECTS__*/
function L(e) {
	return Wt.call(e);
}
function qt(e, t) {
	if (!y) return /* @__PURE__ */ Kt(e);
	var n = /* @__PURE__ */ Kt(b);
	if (n === null) n = b.appendChild(I());
	else if (t && n.nodeType !== 3) {
		var r = I();
		return n?.before(r), x(r), r;
	}
	return t && Qt(n), x(n), n;
}
function Jt(e, t = !1) {
	if (!y) {
		var n = /* @__PURE__ */ Kt(e);
		return n instanceof Comment && n.data === "" ? /* @__PURE__ */ L(n) : n;
	}
	if (t) {
		if (b?.nodeType !== 3) {
			var r = I();
			return b?.before(r), x(r), r;
		}
		Qt(b);
	}
	return b;
}
function Yt(e, t = 1, n = !1) {
	let r = y ? b : e;
	for (var i; t--;) i = r, r = /* @__PURE__ */ L(r);
	if (!y) return r;
	if (n) {
		if (r?.nodeType !== 3) {
			var a = I();
			return r === null ? i?.after(a) : r.before(a), x(a), a;
		}
		Qt(r);
	}
	return x(r), r;
}
function Xt() {
	return !S || M !== null ? !1 : (G.f & ne) !== 0;
}
function Zt(e, t, n) {
	return t == null || t === "http://www.w3.org/1999/xhtml" ? n ? document.createElement(e, { is: n }) : document.createElement(e) : n ? document.createElementNS(t, e, { is: n }) : document.createElementNS(t, e);
}
function Qt(e) {
	if (e.nodeValue.length < 65536) return;
	let t = e.nextSibling;
	for (; t !== null && t.nodeType === 3;) t.remove(), e.nodeValue += t.nodeValue, t = e.nextSibling;
}
//#endregion
//#region node_modules/svelte/src/internal/client/dom/elements/bindings/shared.js
function $t(e) {
	var t = H, n = G;
	W(null), K(null);
	try {
		return e();
	} finally {
		W(t), K(n);
	}
}
//#endregion
//#region node_modules/svelte/src/internal/client/reactivity/effects.js
function en(e) {
	G === null && (H === null && xe(e), be()), V && ye(e);
}
function tn(e, t) {
	var n = t.last;
	n === null ? t.last = t.first = e : (n.next = e, e.prev = n, t.last = e);
}
function R(e, t) {
	var n = G;
	n !== null && n.f & 8192 && (e |= ee);
	var r = {
		ctx: C,
		deps: null,
		nodes: null,
		f: e | g | 512,
		first: null,
		fn: t,
		last: null,
		next: null,
		parent: n,
		b: n && n.b,
		prev: null,
		teardown: null,
		wv: 0,
		ac: null
	};
	A?.register_created_effect(r);
	var i = r;
	if (e & 4) bt === null ? wt.ensure().schedule(r) : bt.push(r);
	else if (t !== null) {
		try {
			In(r);
		} catch (e) {
			throw B(r), e;
		}
		i.deps === null && i.teardown === null && i.nodes === null && i.first === i.last && !(i.f & 524288) && (i = i.first, e & 16 && e & 65536 && i !== null && (i.f |= ie));
	}
	if (i !== null && (i.parent = n, n !== null && tn(i, n), H !== null && H.f & 2 && !(e & 64))) {
		var a = H;
		(a.effects ??= []).push(i);
	}
	return r;
}
function nn() {
	return H !== null && !U;
}
function rn(e) {
	let t = R(8, null);
	return O(t, h), t.teardown = e, t;
}
function an(e) {
	en("$effect");
	var t = G.f;
	if (!H && t & 32 && C !== null && !C.i) {
		var n = C;
		(n.e ??= []).push(e);
	} else return on(e);
}
function on(e) {
	return R(4 | oe, e);
}
function sn(e) {
	return en("$effect.pre"), R(8 | oe, e);
}
function cn(e) {
	wt.ensure();
	let t = R(64 | ae, e);
	return (e = {}) => new Promise((n) => {
		e.outro ? vn(t, () => {
			B(t), n(void 0);
		}) : (B(t), n(void 0));
	});
}
function ln(e) {
	return R(le | ae, e);
}
function un(e, t = 0) {
	return R(8 | t, e);
}
function dn(e, t = [], n = [], r = []) {
	nt(r, t, n, (t) => {
		R(8, () => {
			e(...t.map($));
		});
	});
}
function fn(e, t = 0) {
	return R(16 | t, e);
}
function z(e) {
	return R(32 | ae, e);
}
function pn(e) {
	var t = e.teardown;
	if (t !== null) {
		let e = V, n = H;
		Tn(!0), W(null);
		try {
			t.call(null);
		} finally {
			Tn(e), W(n);
		}
	}
}
function mn(e, t = !1) {
	var n = e.first;
	for (e.first = e.last = null; n !== null;) {
		let e = n.ac;
		e !== null && $t(() => {
			e.abort(ge);
		});
		var r = n.next;
		n.f & 64 ? n.parent = null : B(n, t), n = r;
	}
}
function hn(e) {
	for (var t = e.first; t !== null;) {
		var n = t.next;
		t.f & 32 || B(t), t = n;
	}
}
function B(e, t = !0) {
	var n = !1;
	(t || e.f & 262144) && e.nodes !== null && e.nodes.end !== null && (gn(e.nodes.start, e.nodes.end), n = !0), e.f |= re, mn(e, t && !n), Fn(e, 0);
	var r = e.nodes && e.nodes.t;
	if (r !== null) for (let e of r) e.stop();
	pn(e), e.f ^= re, e.f |= te;
	var i = e.parent;
	i !== null && i.first !== null && _n(e), e.next = e.prev = e.teardown = e.ctx = e.deps = e.fn = e.nodes = e.ac = e.b = null;
}
function gn(e, t) {
	for (; e !== null;) {
		var n = e === t ? null : /* @__PURE__ */ L(e);
		e.remove(), e = n;
	}
}
function _n(e) {
	var t = e.parent, n = e.prev, r = e.next;
	n !== null && (n.next = r), r !== null && (r.prev = n), t !== null && (t.first === e && (t.first = r), t.last === e && (t.last = n));
}
function vn(e, t, n = !0) {
	var r = [];
	yn(e, r, !0);
	var i = () => {
		n && B(e), t && t();
	}, a = r.length;
	if (a > 0) {
		var o = () => --a || i();
		for (var s of r) s.out(o);
	} else i();
}
function yn(e, t, n) {
	if (!(e.f & 8192)) {
		e.f ^= ee;
		var r = e.nodes && e.nodes.t;
		if (r !== null) for (let e of r) (e.is_global || n) && t.push(e);
		for (var i = e.first; i !== null;) {
			var a = i.next;
			if (!(i.f & 64)) {
				var o = (i.f & 65536) != 0 || (i.f & 32) != 0 && (e.f & 16) != 0;
				yn(i, t, o ? n : !1);
			}
			i = a;
		}
	}
}
function bn(e) {
	xn(e, !0);
}
function xn(e, t) {
	if (e.f & 8192) {
		e.f ^= ee, e.f & 1024 || (O(e, g), wt.ensure().schedule(e));
		for (var n = e.first; n !== null;) {
			var r = n.next, i = (n.f & 65536) != 0 || (n.f & 32) != 0;
			xn(n, i ? t : !1), n = r;
		}
		var a = e.nodes && e.nodes.t;
		if (a !== null) for (let e of a) (e.is_global || t) && e.in();
	}
}
function Sn(e, t) {
	if (e.nodes) for (var n = e.nodes.start, r = e.nodes.end; n !== null;) {
		var i = n === r ? null : /* @__PURE__ */ L(n);
		t.append(n), n = i;
	}
}
//#endregion
//#region node_modules/svelte/src/internal/client/legacy.js
var Cn = null, wn = !1, V = !1;
function Tn(e) {
	V = e;
}
var H = null, U = !1;
function W(e) {
	H = e;
}
var G = null;
function K(e) {
	G = e;
}
var q = null;
function En(e) {
	H !== null && (!S || H.f & 2) && (q ??= /* @__PURE__ */ new Set()).add(e);
}
var J = null, Y = 0, X = null;
function Dn(e) {
	X = e;
}
var On = 1, Z = 0, Q = Z;
function kn(e) {
	Q = e;
}
function An() {
	return ++On;
}
function jn(e) {
	var t = e.f;
	if (t & 2048) return !0;
	if (t & 2 && (e.f &= ~se), t & 4096) {
		for (var n = e.deps, r = n.length, i = 0; i < r; i++) {
			var a = n[i];
			if (jn(a) && ft(a), a.wv > e.wv) return !0;
		}
		t & 512 && j === null && O(e, h);
	}
	return !1;
}
function Mn(e, t, n = !0) {
	var r = e.reactions;
	if (r !== null && !(!S && q !== null && q.has(e))) for (var i = 0; i < r.length; i++) {
		var a = r[i];
		a.f & 2 ? Mn(a, t, !1) : t === a && (n ? O(a, g) : a.f & 1024 && O(a, _), kt(a));
	}
}
function Nn(e) {
	var t = J, n = Y, r = X, i = H, a = q, o = C, s = U, c = Q, l = e.f;
	J = null, Y = 0, X = null, H = l & 96 ? null : e, q = null, w(e.ctx), U = !1, Q = ++Z, e.ac !== null && ($t(() => {
		e.ac.abort(ge);
	}), e.ac = null);
	try {
		e.f |= ce;
		var u = e.fn, d = u();
		e.f |= ne;
		var f = e.deps, p = A?.is_fork;
		if (J !== null) {
			var m;
			if (p || Fn(e, Y), f !== null && Y > 0) for (f.length = Y + J.length, m = 0; m < J.length; m++) f[Y + m] = J[m];
			else e.deps = f = J;
			if (nn() && e.f & 512) for (m = Y; m < f.length; m++) (f[m].reactions ??= []).push(e);
		} else !p && f !== null && Y < f.length && (Fn(e, Y), f.length = Y);
		if (We() && X !== null && !U && f !== null && !(e.f & 6146)) for (m = 0; m < X.length; m++) Mn(X[m], e);
		if (i !== null && i !== e) {
			if (Z++, i.deps !== null) for (let e = 0; e < n; e += 1) i.deps[e].rv = Z;
			if (t !== null) for (let e of t) e.rv = Z;
			X !== null && (r === null ? r = X : r.push(...X));
		}
		return e.f & 8388608 && (e.f ^= ue), d;
	} catch (e) {
		return Ke(e);
	} finally {
		e.f ^= ce, J = t, Y = n, X = r, H = i, q = a, w(o), U = s, Q = c;
	}
}
function Pn(e, r) {
	let i = r.reactions;
	if (i !== null) {
		var a = t.call(i, e);
		if (a !== -1) {
			var o = i.length - 1;
			o === 0 ? i = r.reactions = null : (i[a] = i[o], i.pop());
		}
	}
	if (i === null && r.f & 2 && (J === null || !n.call(J, r))) {
		var s = r;
		s.f & 512 && (s.f ^= 512, s.f &= ~se), s.v !== v && Je(s), pt(s), Fn(s, 0);
	}
}
function Fn(e, t) {
	var n = e.deps;
	if (n !== null) for (var r = t; r < n.length; r++) Pn(e, n[r]);
}
function In(e) {
	var t = e.f;
	if (!(t & 16384)) {
		O(e, h);
		var n = G, r = wn;
		G = e, wn = !0;
		try {
			t & 16777232 ? hn(e) : mn(e), pn(e);
			var i = Nn(e);
			e.teardown = typeof i == "function" ? i : null, e.wv = On;
		} finally {
			wn = r, G = n;
		}
	}
}
function $(e) {
	var t = (e.f & 2) != 0;
	if (Cn?.add(e), H !== null && !U && !(G !== null && G.f & 16384) && (q === null || !q.has(e))) {
		var r = H.deps;
		if (H.f & 2097152) e.rv < Z && (e.rv = Z, J === null && r !== null && r[Y] === e ? Y++ : J === null ? J = [e] : J.push(e));
		else {
			H.deps ??= [], n.call(H.deps, e) || H.deps.push(e);
			var i = e.reactions;
			i === null ? e.reactions = [H] : n.call(i, H) || i.push(H);
		}
	}
	if (V && N.has(e)) return N.get(e);
	if (t) {
		var a = e;
		if (V) {
			var o = a.v;
			return (!(a.f & 1024) && a.reactions !== null || Rn(a)) && (o = dt(a)), N.set(a, o), o;
		}
		var s = (a.f & 512) == 0 && !U && H !== null && (wn || (H.f & 512) != 0), c = (a.f & ne) === 0;
		jn(a) && (s && (a.f |= 512), ft(a)), s && !c && (mt(a), Ln(a));
	}
	if (j?.has(e)) return j.get(e);
	if (e.f & 8388608) throw e.v;
	return e.v;
}
function Ln(e) {
	if (e.f |= 512, e.deps !== null) for (let t of e.deps) (t.reactions ??= []).push(e), t.f & 2 && !(t.f & 512) && (mt(t), Ln(t));
}
function Rn(e) {
	if (e.v === v) return !0;
	if (e.deps === null) return !1;
	for (let t of e.deps) if (N.has(t) || t.f & 2 && Rn(t)) return !0;
	return !1;
}
function zn(e) {
	var t = U;
	try {
		return U = !0, e();
	} finally {
		U = t;
	}
}
function Bn(e) {
	if (!(typeof e != "object" || !e || e instanceof EventTarget)) {
		if (de in e) Vn(e);
		else if (!Array.isArray(e)) for (let t in e) {
			let n = e[t];
			typeof n == "object" && n && de in n && Vn(n);
		}
	}
}
function Vn(e, t = /* @__PURE__ */ new Set()) {
	if (typeof e == "object" && e && !(e instanceof EventTarget) && !t.has(e)) {
		t.add(e), e instanceof Date && e.getTime();
		for (let n in e) try {
			Vn(e[n], t);
		} catch {}
		let n = l(e);
		if (n !== Object.prototype && n !== Array.prototype && n !== Map.prototype && n !== Set.prototype && n !== Date.prototype) {
			let t = o(n);
			for (let n in t) {
				let r = t[n].get;
				if (r) try {
					r.call(e);
				} catch {}
			}
		}
	}
}
[.../* @__PURE__ */ "allowfullscreen.async.autofocus.autoplay.checked.controls.default.disabled.formnovalidate.indeterminate.inert.ismap.loop.multiple.muted.nomodule.novalidate.open.playsinline.readonly.required.reversed.seamless.selected.webkitdirectory.defer.disablepictureinpicture.disableremoteplayback".split(".")];
var Hn = ["touchstart", "touchmove"];
function Un(e) {
	return Hn.includes(e);
}
//#endregion
//#region node_modules/svelte/src/internal/client/dom/elements/events.js
var Wn = Symbol("events"), Gn = /* @__PURE__ */ new Set(), Kn = /* @__PURE__ */ new Set(), qn = null;
function Jn(e) {
	var t = this, n = t.ownerDocument, r = e.type, a = e.composedPath?.() || [], o = a[0] || e.target;
	qn = e;
	var s = 0, c = qn === e && e[Wn];
	if (c) {
		var l = a.indexOf(c);
		if (l !== -1 && (t === document || t === window)) {
			e[Wn] = t;
			return;
		}
		var u = a.indexOf(t);
		if (u === -1) return;
		l <= u && (s = l);
	}
	if (o = a[s] || e.target, o !== t) {
		i(e, "currentTarget", {
			configurable: !0,
			get() {
				return o || n;
			}
		});
		var d = H, f = G;
		W(null), K(null);
		try {
			for (var p, m = []; o !== null && o !== t;) {
				try {
					var h = o[Wn]?.[r];
					h != null && (!o.disabled || e.target === o) && h.call(o, e);
				} catch (e) {
					p ? m.push(e) : p = e;
				}
				if (e.cancelBubble) break;
				s++, o = s < a.length ? a[s] : null;
			}
			if (p) {
				for (let e of m) queueMicrotask(() => {
					throw e;
				});
				throw p;
			}
		} finally {
			e[Wn] = t, delete e.currentTarget, W(d), K(f);
		}
	}
}
//#endregion
//#region node_modules/svelte/src/internal/client/dom/reconciler.js
var Yn = globalThis?.window?.trustedTypes && /* @__PURE__ */ globalThis.window.trustedTypes.createPolicy("svelte-trusted-html", { createHTML: (e) => e });
function Xn(e) {
	return Yn?.createHTML(e) ?? e;
}
function Zn(e) {
	var t = Zt("template");
	return t.innerHTML = Xn(e.replaceAll("<!>", "<!---->")), t.content;
}
//#endregion
//#region node_modules/svelte/src/internal/client/dom/template.js
function Qn(e, t) {
	var n = G;
	n.nodes === null && (n.nodes = {
		start: e,
		end: t,
		a: null,
		t: null
	});
}
/*#__NO_SIDE_EFFECTS__*/
function $n(e, t) {
	var n = (t & 1) != 0, r = (t & 2) != 0, i, a = !e.startsWith("<!>");
	return () => {
		if (y) return Qn(b, null), b;
		i === void 0 && (i = Zn(a ? e : "<!>" + e), n || (i = /* @__PURE__ */ Kt(i)));
		var t = r || Ht ? document.importNode(i, !0) : i.cloneNode(!0);
		if (n) {
			var o = /* @__PURE__ */ Kt(t), s = t.lastChild;
			Qn(o, s);
		} else Qn(t, t);
		return t;
	};
}
function er() {
	if (y) return Qn(b, null), b;
	var e = document.createDocumentFragment(), t = document.createComment(""), n = I();
	return e.append(t, n), Qn(t, n), e;
}
function tr(e, t) {
	if (y) {
		var n = G;
		(!(n.f & 32768) || n.nodes.end === null) && (n.nodes.end = b), Me();
		return;
	}
	e !== null && e.before(t);
}
function nr(e, t) {
	var n = t == null ? "" : typeof t == "object" ? `${t}` : t;
	n !== (e[he] ??= e.nodeValue) && (e[he] = n, e.nodeValue = `${n}`);
}
function rr(e, t) {
	return ar(e, t);
}
var ir = /* @__PURE__ */ new Map();
function ar(e, { target: t, anchor: n, props: i = {}, events: a, context: o, intro: s = !0, transformError: c }) {
	Gt();
	var l = void 0, u = cn(() => {
		var s = n ?? t.appendChild(I());
		et(s, { pending: () => {} }, (t) => {
			He({});
			var n = C;
			if (o && (n.c = o), a && (i.$$events = a), y && Qn(t, null), l = e(t, i) || {}, y && (G.nodes.end = b, b === null || b.nodeType !== 8 || b.data !== "]")) throw ke(), De;
			Ue();
		}, c);
		var u = /* @__PURE__ */ new Set(), d = (e) => {
			for (var n = 0; n < e.length; n++) {
				var r = e[n];
				if (!u.has(r)) {
					u.add(r);
					var i = Un(r);
					for (let e of [t, document]) {
						var a = ir.get(e);
						a === void 0 && (a = /* @__PURE__ */ new Map(), ir.set(e, a));
						var o = a.get(r);
						o === void 0 ? (e.addEventListener(r, Jn, { passive: i }), a.set(r, 1)) : a.set(r, o + 1);
					}
				}
			}
		};
		return d(r(Gn)), Kn.add(d), () => {
			for (var e of u) for (let n of [t, document]) {
				var r = ir.get(n), i = r.get(e);
				--i == 0 ? (n.removeEventListener(e, Jn), r.delete(e), r.size === 0 && ir.delete(n)) : r.set(e, i);
			}
			Kn.delete(d), s !== n && s.parentNode?.removeChild(s);
		};
	});
	return or.set(l, u), l;
}
var or = /* @__PURE__ */ new WeakMap(), sr = class {
	anchor;
	#e = /* @__PURE__ */ new Map();
	#t = /* @__PURE__ */ new Map();
	#n = /* @__PURE__ */ new Map();
	#r = /* @__PURE__ */ new Set();
	#i = !0;
	constructor(e, t = !0) {
		this.anchor = e, this.#i = t;
	}
	#a = (e) => {
		if (this.#e.has(e)) {
			var t = this.#e.get(e), n = this.#t.get(t);
			if (n) bn(n), this.#r.delete(t);
			else {
				var r = this.#n.get(t);
				r && (bn(r.effect), this.#t.set(t, r.effect), this.#n.delete(t), r.fragment.lastChild.remove(), this.anchor.before(r.fragment), n = r.effect);
			}
			for (let [t, n] of this.#e) {
				if (this.#e.delete(t), t === e) break;
				let r = this.#n.get(n);
				r && (B(r.effect), this.#n.delete(n));
			}
			for (let [e, r] of this.#t) {
				if (e === t || this.#r.has(e)) continue;
				let i = () => {
					if (Array.from(this.#e.values()).includes(e)) {
						var t = document.createDocumentFragment();
						Sn(r, t), t.append(I()), this.#n.set(e, {
							effect: r,
							fragment: t
						});
					} else B(r);
					this.#r.delete(e), this.#t.delete(e);
				};
				this.#i || !n ? (this.#r.add(e), vn(r, i, !1)) : i();
			}
		}
	};
	#o = (e) => {
		this.#e.delete(e);
		let t = Array.from(this.#e.values());
		for (let [e, n] of this.#n) t.includes(e) || (B(n.effect), this.#n.delete(e));
	};
	ensure(e, t) {
		var n = A, r = Xt();
		if (t && !this.#t.has(e) && !this.#n.has(e)) if (r) {
			var i = document.createDocumentFragment(), a = I();
			i.append(a), this.#n.set(e, {
				effect: z(() => t(a)),
				fragment: i
			});
		} else this.#t.set(e, z(() => t(this.anchor)));
		if (this.#e.set(n, e), r) {
			for (let [t, r] of this.#t) t === e ? n.unskip_effect(r) : n.skip_effect(r);
			for (let [t, r] of this.#n) t === e ? n.unskip_effect(r.effect) : n.skip_effect(r.effect);
			n.oncommit(this.#a), n.ondiscard(this.#o);
		} else y && (this.anchor = b), this.#a(n);
	}
};
//#endregion
//#region node_modules/svelte/src/internal/client/dom/blocks/if.js
function cr(e, t, n = !1) {
	var r;
	y && (r = b, Me());
	var i = new sr(e), a = n ? ie : 0;
	function o(e, t) {
		if (y) {
			var n = Ie(r);
			if (e !== parseInt(n.substring(1))) {
				var a = Fe();
				x(a), i.anchor = a, je(!1), i.ensure(e, t), je(!0);
				return;
			}
		}
		i.ensure(e, t);
	}
	fn(() => {
		var e = !1;
		t((t, n = 0) => {
			e = !0, o(n, t);
		}), e || o(-1, null);
	}, a);
}
//#endregion
//#region node_modules/svelte/src/internal/client/dom/legacy/lifecycle.js
function lr(e = !1) {
	let t = C, n = t.l.u;
	if (!n) return;
	let r = () => Bn(t.s);
	if (e) {
		let e = 0, n = {}, i = /* @__PURE__ */ ot(() => {
			let r = !1, i = t.s;
			for (let e in i) i[e] !== n[e] && (n[e] = i[e], r = !0);
			return r && e++, e;
		});
		r = () => $(i);
	}
	n.b.length && sn(() => {
		ur(t, r), p(n.b);
	}), an(() => {
		let e = zn(() => n.m.map(f));
		return () => {
			for (let t of e) typeof t == "function" && t();
		};
	}), n.a.length && an(() => {
		ur(t, r), p(n.a);
	});
}
function ur(e, t) {
	if (e.l.s) for (let t of e.l.s) $(t);
	t();
}
function dr(e) {
	C === null && _e("onMount"), Be && C.l !== null ? fr(C).m.push(e) : an(() => {
		let t = zn(e);
		if (typeof t == "function") return t;
	});
}
function fr(e) {
	var t = e.l;
	return t.u ??= {
		a: [],
		b: [],
		m: []
	};
}
//#endregion
//#region node_modules/svelte/src/internal/flags/legacy.js
typeof window < "u" && ((window.__svelte ??= {}).v ??= /* @__PURE__ */ new Set()).add("5"), Ve();
//#endregion
//#region src/ui/ArchitectureOverlay.svelte
var pr = /* @__PURE__ */ $n("<aside class=\"grove-architecture-badge svelte-q3yg9f\" aria-label=\"Orchestrator Grove architecture status\"><b class=\"svelte-q3yg9f\">Grove Architecture</b> <span class=\"svelte-q3yg9f\"> </span> <span class=\"svelte-q3yg9f\"> </span></aside>");
function mr(e, t) {
	He(t, !1);
	let n = /* @__PURE__ */ Ft(null), r = /* @__PURE__ */ Ft("starting"), i = /* @__PURE__ */ Ft("starting");
	function a(e) {
		F(n, e), F(i, e?.getRendererLabel?.() || "renderer pending"), F(r, e?.getSimWorkerStatus?.() || "sim worker pending");
	}
	dr(() => {
		let e = (e) => a(e.detail), t = (e) => {
			e.detail?.renderer && F(i, e.detail.renderer), e.detail?.simStatus && F(r, e.detail.simStatus);
		};
		window.addEventListener("orchestrator:ui-ready", e), window.addEventListener("orchestrator:ui-state", t), window.orchestratorUiBridge && a(window.orchestratorUiBridge);
		let n = window.setInterval(() => {
			window.orchestratorUiBridge && a(window.orchestratorUiBridge);
		}, 1e3);
		return () => {
			window.removeEventListener("orchestrator:ui-ready", e), window.removeEventListener("orchestrator:ui-state", t), window.clearInterval(n);
		};
	}), lr();
	var o = er(), s = Jt(o), c = (e) => {
		var t = pr(), n = Yt(qt(t), 2), a = qt(n, !0);
		Ne(n);
		var o = Yt(n, 2), s = qt(o, !0);
		Ne(o), Ne(t), dn(() => {
			nr(a, $(i)), nr(s, $(r));
		}), tr(e, t);
	};
	cr(s, (e) => {
		$(n) && e(c);
	}), tr(e, o), Ue();
}
//#endregion
//#region src/ui/main.js
var hr = document.getElementById("svelteOverlayRoot");
hr && rr(mr, { target: hr });
//#endregion
