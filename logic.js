import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";

import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    updateProfile,
    sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
    getFirestore,
    collection,
    addDoc,
    onSnapshot,
    doc,
    updateDoc,
    increment,
    query
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* -------------------- FIREBASE CONFIG -------------------- */

const firebaseConfig = {
    apiKey: "AIzaSyA2ptp6pNzg1r5175vyFE-P4nPV-bnVTa4",
    authDomain: "crowdfunding-app-3e434.firebaseapp.com",
    projectId: "crowdfunding-app-3e434",
    storageBucket: "crowdfunding-app-3e434.firebasestorage.app",
    messagingSenderId: "652773811994",
    appId: "1:652773811994:web:04e0e15d7b4ba26e38aea3",
    measurementId: "G-1D22VDXLK7"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const appId = "vhitefund-v3-edem";

let user = null;
let projects = [];

/* -------------------- AUTH UI UTILS -------------------- */

window.openModal = (mode) => {
    const modal = document.getElementById('modal-auth');
    document.getElementById('auth-error').style.display = 'none';
    document.getElementById('auth-success').style.display = 'none';

    modal.style.display = 'flex';

    document.getElementById('section-login').classList.toggle('hidden', mode !== 'login');
    document.getElementById('section-register').classList.toggle('hidden', mode !== 'register');
    document.getElementById('section-reset').classList.toggle('hidden', mode !== 'reset');

    document.body.style.overflow = 'hidden';
};

window.closeModal = () => {
    document.getElementById('modal-auth').style.display = 'none';
    document.body.style.overflow = 'auto';
};

const showError = (msg) => {
    const el = document.getElementById('auth-error');
    el.innerText = msg;
    el.style.display = 'block';
    document.getElementById('auth-success').style.display = 'none';
};

const showSuccess = (msg) => {
    const el = document.getElementById('auth-success');
    el.innerText = msg;
    el.style.display = 'block';
    document.getElementById('auth-error').style.display = 'none';
};

/* -------------------- AUTH HANDLERS -------------------- */

document.getElementById('login-form').onsubmit = async (e) => {
    e.preventDefault();

    const btn = e.target.querySelector('button');
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-password').value;

    btn.disabled = true;
    btn.innerHTML = '<div class="loader"></div>';

    try {
        await signInWithEmailAndPassword(auth, email, pass);
        closeModal();
    } catch {
        showError("Invalid email or password.");
    } finally {
        btn.disabled = false;
        btn.innerText = "Login";
    }
};

document.getElementById('register-form').onsubmit = async (e) => {
    e.preventDefault();

    const btn = e.target.querySelector('button');
    const name = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const pass = document.getElementById('reg-password').value;

    btn.disabled = true;
    btn.innerHTML = '<div class="loader"></div>';

    try {
        const cred = await createUserWithEmailAndPassword(auth, email, pass);
        await updateProfile(cred.user, { displayName: name });
        closeModal();
    } catch (err) {
        showError(err.message);
    } finally {
        btn.disabled = false;
        btn.innerText = "Sign Up";
    }
};

/* -------------------- PASSWORD RESET (FIREBASE) -------------------- */

document.getElementById('reset-form').onsubmit = async (e) => {
    e.preventDefault();

    const btn = e.target.querySelector('button');
    const email = document.getElementById('reset-email').value;

    btn.disabled = true;
    btn.innerHTML = '<div class="loader"></div>';
    document.getElementById('auth-error').style.display = 'none';
    document.getElementById('auth-success').style.display = 'none';

    try {
        await sendPasswordResetEmail(auth, email);
        showSuccess("Password reset link sent. Please check your email.");
        e.target.reset();
    } catch (err) {
        showError(err.message || "Failed to send reset email.");
    } finally {
        btn.disabled = false;
        btn.innerText = "Send Reset Link";
    }
};

/* -------------------- AUTH STATE -------------------- */

window.handleLogout = () => {
    signOut(auth);
    showView('browse');
};

onAuthStateChanged(auth, (u) => {
    user = u;
    document.getElementById('nav-auth').classList.toggle('hidden', !u);
    document.getElementById('nav-guest').classList.toggle('hidden', !!u);
    syncProjects();
});

/* -------------------- PROJECT SYNC -------------------- */

function syncProjects() {
    const path = `artifacts/${appId}/public/data/projects`;
    const q = query(collection(db, path));

    onSnapshot(q, (snap) => {
        projects = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderGrid();
        if (!document.getElementById('view-profile').classList.contains('hidden')) {
            renderProfile();
        }
    });
}

/* -------------------- UI NAV -------------------- */

window.showView = (name) => {
    document.querySelectorAll('main > section').forEach(s => s.classList.add('hidden'));
    document.getElementById(`view-${name}`).classList.remove('hidden');
    window.scrollTo(0, 0);
    if (name === 'profile') renderProfile();
};

window.toggleTheme = () => {
    const current = document.body.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.body.setAttribute('data-theme', next);
};

/* -------------------- PROFILE -------------------- */

function renderProfile() {
    if (!user) return showView('browse');

    document.getElementById('profile-name').innerText = user.displayName || 'Contributor';
    document.getElementById('profile-email').innerText = user.email;
    document.getElementById('profile-avatar').innerText =
        (user.displayName || 'U')[0].toUpperCase();

    const grid = document.getElementById('user-projects-grid');
    const mine = projects.filter(p => p.creatorId === user.uid);

    grid.innerHTML = mine.length
        ? mine.map(p => renderCardHTML(p)).join('')
        : `<div style="grid-column:1/-1;text-align:center;color:var(--text-muted);padding:40px;">
            You haven't started any campaigns yet.
           </div>`;
}

/* -------------------- CAMPAIGN -------------------- */

document.getElementById('campaign-form').onsubmit = async (e) => {
    e.preventDefault();
    if (!user) return openModal('login');

    const btn = e.target.querySelector('button');
    btn.disabled = true;
    btn.innerHTML = '<div class="loader"></div>';

    const fd = new FormData(e.target);

    try {
        await addDoc(collection(db, `artifacts/${appId}/public/data/projects`), {
            title: fd.get('title'),
            description: fd.get('description'),
            goal: Number(fd.get('goal')),
            raised: 0,
            category: fd.get('category'),
            creatorName: user.displayName || 'Anonymous',
            creatorId: user.uid,
            createdAt: Date.now()
        });

        e.target.reset();
        showView('browse');
    } catch (err) {
        alert(err.message);
    } finally {
        btn.disabled = false;
        btn.innerText = "Launch Campaign";
    }
};

/* -------------------- RENDERING -------------------- */

function renderCardHTML(p) {
    const perc = Math.min(100, (p.raised / p.goal) * 100);
    return `
      <div class="card" onclick="openDetail('${p.id}')" style="cursor:pointer;">
            
            <div class="card-banner">
                <img src="https://picsum.photos/seed/${p.id}/400/250" alt="Campaign Image">
            </div>

            <div class="card-body">
                <h3>${p.title}</h3>

                <div class="progress-bar">
                    <div class="progress-fill" 
                         style="width:${Math.min(100, (p.raised / p.goal) * 100)}%">
                    </div>
                </div>

                <small>
                    ₦${p.raised.toLocaleString()} raised of ₦${p.goal.toLocaleString()}
                </small>
            </div>

        </div>
    `;
}

window.openDetail = (id) => {
    const p = projects.find(item => item.id === id);
    if (!p) return;

    const perc = Math.min(100, (p.raised / p.goal) * 100);

    showView('detail');

    document.getElementById('detail-box').innerHTML = `
        <div style="display: flex; flex-wrap: wrap; gap: 30px;">
            <div style="flex: 1; min-width: 300px;">
                <img src="https://picsum.photos/seed/${p.id}/800/450"
                     style="width:100%; border-radius: 24px; margin-bottom: 24px;">
                <h1 style="margin-bottom: 15px;">${p.title}</h1>
                <p style="color: var(--text-muted); line-height: 1.8;">
                    ${p.description}
                </p>
            </div>

            <div style="width: 100%; max-width: 380px; margin: 0 auto;">
                <div class="modal-content" style="position: sticky; top: 100px;">
                    <span style="font-size: 1.8rem; font-weight: 800;">
                        ₦${p.raised.toLocaleString()}
                    </span>
                    <p style="color: var(--text-muted);">
                        raised of ₦${p.goal.toLocaleString()}
                    </p>

                    <div class="progress-bar">
                        <div class="progress-fill" style="width:${perc}%"></div>
                    </div>

                    <div class="form-group">
                        <label>Donation Amount (₦)</label>
                        <input type="number"
                               id="donation-amt-${p.id}"
                               value="5000"
                               min="500">
                    </div>

                    <button onclick="donate('${p.id}', this)"
                            class="btn btn-primary"
                            style="width:100%; height:55px;">
                        Donate Now
                    </button>
                </div>
            </div>
        </div>
    `;
};

window.donate = async (id, btn) => {
    if (!user) {
        openModal('login');
        return;
    }

    const amt = Number(
        document.getElementById(`donation-amt-${id}`).value
    );

    if (!amt || amt < 500) {
        alert("Minimum donation is ₦500");
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<div class="loader"></div>';

    try {
        await updateDoc(
            doc(db, `artifacts/${appId}/public/data/projects/${id}`),
            { raised: increment(amt) }
        );
        alert("Thank you for your donation!");
        openDetail(id);
    } catch (err) {
        alert("Error: " + err.message);
    } finally {
        btn.disabled = false;
        btn.innerText = "Donate Now";
    }
};

function renderGrid() {
    const grid = document.getElementById('projects-grid');
    grid.innerHTML = projects.length
        ? projects.map(p => renderCardHTML(p)).join('')
        : `<div style="grid-column:1/-1;text-align:center;color:var(--text-muted);padding:50px;">
            No active campaigns.
           </div>`;
}