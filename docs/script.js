// ==================================
// FIREBASE CONFIGURATION
// ==================================

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAQtsoB-z4jlgOSli-znmE5C8I3YF9IWVo",
  authDomain: "knowladge-game.firebaseapp.com",
  projectId: "knowladge-game",
  storageBucket: "knowladge-game.firebasestorage.app",
  messagingSenderId: "304687615923",
  appId: "1:304687615923:web:3e9b6707ca7f82a13ac5c6",
  measurementId: "G-ZP2FKYV4SN"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();



let activePlayer = {
    uid: null,
    name: null
};

let leaderboardListener = null;
let firebaseReady = false;

let nextQuizAction = null;

let soundEnabled = true;
let masterVolume = 0.8;

// --- SISTEM SKOR & PENYIMPANAN ---

let totalScore = 0;

let subjectScores = {
    matematika: 0,
    agama: 0,
    sejarah_indonesia: 0,
    pjok: 0,
    Bahasa_Indonesia: 0,
    b_madura: 0,
    b_inggris: 0,
    pendidikan_pancasila: 0
};


// Fungsi yang memutar file musik asli saat tombol "Mulai Main" ditekan
function startTheGame() {
    const bgmAudio = document.getElementById("bgm-audio");
    const bgmToggle = document.getElementById("bgm-toggle");

    if (bgmAudio && bgmToggle?.checked && soundEnabled) {
        bgmAudio.volume = masterVolume;
        bgmAudio.play().catch(error => {
            console.warn("Audio tidak dapat diputar:", error);
        });
    };
    showScreen(activePlayer.name ? "category-menu" : "player-screen");
}

function playSound(type) {
    if (!soundEnabled) return;
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        gain.gain.value = masterVolume * 0.2;

        if (type === 'correct') {
            osc.frequency.setValueAtTime(523.25, ctx.currentTime); 
            osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); 
            osc.start();
            osc.stop(ctx.currentTime + 0.25);
        } else if (type === 'wrong') {
            osc.frequency.setValueAtTime(220, ctx.currentTime); 
            osc.frequency.setValueAtTime(180, ctx.currentTime + 0.1);
            osc.start();
            osc.stop(ctx.currentTime + 0.25);
        }
    } catch (e) {}
}

function updateVolume(val) {
    masterVolume = val / 100;
    const volValEl = document.getElementById('vol-val');
    if (volValEl) {
        volValEl.innerText = val + '%';
    }
    
    const bgmAudio = document.getElementById('bgm-audio');
    if (bgmAudio) {
        bgmAudio.volume = masterVolume;
    }
}

function saveSettings() {
    const soundToggleEl = document.getElementById('sound-toggle');
    if (soundToggleEl) {
        soundEnabled = soundToggleEl.checked;
    }
    const bgmAudio = document.getElementById('bgm-audio');
    if (!soundEnabled && bgmAudio) {
        bgmAudio.pause();
    }
}

function toggleBGM() {
    const bgmAudio = document.getElementById('bgm-audio');
    const bgmToggleEl = document.getElementById('bgm-toggle');

    if (bgmAudio && bgmToggleEl) {
        const bgmEnabled = bgmToggleEl.checked;
        if (bgmEnabled && soundEnabled) {
            bgmAudio.volume = masterVolume;
            bgmAudio.play().catch(error => console.log("Gagal memutar audio:", error));
        } else {
            bgmAudio.pause();
        }
    }
}

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.classList.add('active');
    }
}

// ==================================
// SISTEM PEMAIN ONLINE
// ==================================

async function initializeOnlineGame() {
    const status = document.getElementById("player-status");

    try {
        firebaseReady = false;

        if (!auth.currentUser) {
            await auth.signInAnonymously();
        }

        activePlayer.uid = auth.currentUser.uid;

        const playerRef = db
            .collection("players")
            .doc(activePlayer.uid);

        const playerDoc = await playerRef.get();

        if (playerDoc.exists) {
            const data = playerDoc.data();

            activePlayer.name = data.name || null;

            totalScore = Number(data.score) || 0;

            subjectScores = {
                ...subjectScores,
                ...(data.subjectScores || {})
            };

            unlockedLevels = data.unlockedLevels || {};

            localStorage.setItem(
                "unlockedLevels",
                JSON.stringify(unlockedLevels)
            );

        } else {
            activePlayer.name = null;
        }

        firebaseReady = true;

        // Pemain lama langsung masuk halaman utama
        if (activePlayer.name) {
            showScreen("main-menu");
        } else {
            showScreen("player-screen");
        }

        if (status) {
            status.textContent = activePlayer.name
                ? "Selamat datang kembali, " + activePlayer.name
                : "Silakan masukkan nama pemain.";
        }

    } catch (error) {
        console.error("Firebase Error:", error);

        firebaseReady = false;

        showScreen("player-screen");

        if (status) {
            status.textContent =
                "Koneksi gagal: " + error.message;
        }
    }
}

// ==================================
// DAFTAR PEMAIN
// ==================================

async function registerPlayer() {

    const nameInput = document.getElementById("player-name");
    const status = document.getElementById("player-status");
    const btn = document.getElementById("player-start-btn");

    if (!nameInput || !status || !btn) return;

    const name = nameInput.value.trim();

    if (name.length < 3 || name.length > 25) {
        alert("Nama harus terdiri dari 3 sampai 25 karakter!");
        return;
    }

    if (!firebaseReady || !activePlayer.uid) {
        status.textContent = "Menghubungkan ke server, tunggu sebentar...";
        return;
    }

    try {

        btn.disabled = true;
        status.textContent = "Mendaftarkan pemain...";

        const playerRef = db
            .collection("players")
            .doc(activePlayer.uid);

        const playerDoc = await playerRef.get();

        if (playerDoc.exists) {

            const data = playerDoc.data();

            activePlayer.name = data.name;

            totalScore = data.score || 0;

            subjectScores = {
                ...subjectScores,
                ...(data.subjectScores || {})
            };

            unlockedLevels = data.unlockedLevels || {};

        } else {

            activePlayer.name = name;

            await playerRef.set({
                name: name,
                score: 0,
                subjectScores: subjectScores,
                unlockedLevels: {},
                createdAt:
                    firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt:
                    firebase.firestore.FieldValue.serverTimestamp()
            });

        }

        localStorage.setItem(
            "unlockedLevels",
            JSON.stringify(unlockedLevels)
        );

        status.textContent = "";

        showScreen("main-menu");

    } catch (error) {

        console.error("Pendaftaran gagal:", error);

        status.textContent =
            "Gagal mendaftar: " + error.message;

    } finally {

        btn.disabled = false;

    }
}




// ==================================
// MENYIMPAN SKOR ONLINE
// ==================================

async function updatePlayerScore() {

    if (!firebaseReady || !activePlayer.uid || !activePlayer.name) {
        return false;
    }

    try {

        const playerRef = db
            .collection("players")
            .doc(activePlayer.uid);

        await playerRef.set({
            name: activePlayer.name,
            score: Number(totalScore) || 0,
            subjectScores: subjectScores,
            unlockedLevels: unlockedLevels,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        return true;

    } catch (error) {

        console.error("Gagal menyimpan skor:", error);

        return false;
    }
}

// --- FITUR LEADERBOARD & PEMBERITAHUAN RESET SKOR ---

// ==================================
// LEADERBOARD ONLINE
// ==================================

function showLeaderboard() {

    const content =
        document.getElementById("leaderboard-content");

    content.innerHTML =
        "<p>Memuat peringkat pemain...</p>";

    document.getElementById(
        "leaderboard-popup"
    ).classList.add("show");

    // Hentikan listener lama
    if (leaderboardListener) {
        leaderboardListener();
        leaderboardListener = null;
    }

    leaderboardListener = db
        .collection("players")
        .orderBy("score", "desc")
        .limit(100)
        .onSnapshot(snapshot => {

            content.innerHTML = "";

            let ranking = [];

            snapshot.forEach(doc => {

                ranking.push({
                    id: doc.id,
                    ...doc.data()
                });

            });

            if (ranking.length === 0) {

                content.innerHTML =
                    "<p>Belum ada pemain.</p>";

                return;
            }

            ranking.forEach((player, index) => {

                const item =
                    document.createElement("div");

                item.className = "leaderboard-item";

                const rank =
                    document.createElement("span");

                rank.className = "leaderboard-rank";

                rank.textContent =
                    index === 0 ? "🥇" :
                    index === 1 ? "🥈" :
                    index === 2 ? "🥉" :
                    "#" + (index + 1);

                const name =
                    document.createElement("span");

                name.textContent =
                    player.name || "Pemain";

                if (player.id === activePlayer.uid) {
                    name.textContent += " (Kamu)";
                    name.style.fontWeight = "bold";
                }

                const score =
                    document.createElement("span");

                score.textContent =
                    (player.score || 0) + " Poin";

                item.appendChild(rank);
                item.appendChild(name);
                item.appendChild(score);

                content.appendChild(item);

            });

            document.getElementById(
                "leaderboard-rangking-pemain"
            ).textContent =
                ranking.length + "pemain";

        }, error => {

            console.error("Leaderboard error:", error);

            content.innerHTML =
                "<p>Gagal memuat leaderboard.</p>";

        });
}


function closeLeaderboard() {
    const popup = document.getElementById("leaderboard-popup");

    if (popup) {
        popup.classList.remove("show");
    }

    if (leaderboardListener) {
        leaderboardListener();
        leaderboardListener = null;
    }
}

function confirmResetScore() {
    document.getElementById('reset-confirm-popup')
        .classList.add('show');
}

function closeResetConfirm() {
    document.getElementById('reset-confirm-popup')
        .classList.remove('show');
}

async function executeResetLevel() {
    closeResetLevel();

    unlockedLevels = {};

    saveProgress();

    await updatePlayerScore();

    const popup = document.getElementById("reset-level-success");

    if (popup) {
        popup.classList.add("show");
    }

    if (currentCategory && currentSubCategory) {
        selectSubCategory(currentSubCategory);
    }
}

function closeResetSuccess() {
    document.getElementById('reset-success-popup')
        .classList.remove('show');

    // Tutup leaderboard setelah pesan keberhasilan
    closeLeaderboard();
}



function resetScore() {
    totalScore = 0;
    for (let key in subjectScores) {
        subjectScores[key] = 0;
    }
    alert("🔄 Semua skor berhasil direset kembali menjadi 0!");
}

// --- STRUKTUR DATA KUIS (10 SOAL PER SUB-KATEGORI) ---
const quizData = {
    matematika: {
        name: "Matematika",
        subCategories: {
            "pertambahan": [
                { q: "Berapakah hasil dari 5 + 5?", options: ["10", "5", "15"], a: 0 , materi: "Penjumlahan adalah operasi matematika untuk menggabungkan dua bilangan. Pada soal ini, 5 + 5 = 10. Jadi jawaban yang benar adalah 10."},
                { q: "Berapakah hasil dari 7 + 9?", options: ["15", "18", "16"], a: 2 , materi: "Penjumlahan adalah operasi matematika untuk menggabungkan dua bilangan. Pada soal ini, 5 + 5 = 10. Jadi jawaban yang benar adalah 10."},
                { q: "Berapakah hasil dari 4 + 7?", options: ["10", "12", "11"], a: 2 ,materi: "Penjumlahan adalah operasi matematika untuk menggabungkan dua bilangan. Pada soal ini, 4 + 7 = 11. Jadi jawaban yang benar adalah 11."},
                { q: "Berapakah hasil dari 23 + 14?", options: ["35", "37", "39"], a: 1 ,materi: "Penjumlahan adalah operasi matematika untuk menggabungkan dua bilangan. Pada soal ini, 23 + 14 = 37. Jadi jawaban yang benar adalah 37."},
                { q: "Berapakah hasil dari 15 + 28?", options: ["44", "41", "43"], a: 2 ,materi: "Penjumlahan adalah operasi matematika untuk menggabungkan dua bilangan. Pada soal ini, 15 + 28 = 43. Jadi jawaban yang benar adalah 43."},
                { q: "Berapakah hasil dari 47 + 36?", options: ["81", "83", "82"], a: 1 ,materi: "Penjumlahan adalah operasi matematika untuk menggabungkan dua bilangan. Pada soal ini, 47 + 36 = 83. Jadi jawaban yang benar adalah 83."},
                { q: "Berapakah hasil dari 342 + 125?", options: ["467", "447", "477"], a: 0 ,materi: "Penjumlahan adalah operasi matematika untuk menggabungkan dua bilangan. Pada soal ini, 342 + 125 = 467. Jadi jawaban yang benar adalah 467."},
                { q: "Berapakah hasil dari 486 + 275?", options: ["741", "771", "761"], a: 2 ,materi: "Penjumlahan adalah operasi matematika untuk menggabungkan dua bilangan. Pada soal ini, 486 + 275 = 761. Jadi jawaban yang benar adalah 761."},
                { q: "Berapakah hasil dari 539 + 384?", options: ["913", "923", "903"], a: 1 ,materi: "Penjumlahan adalah operasi matematika untuk menggabungkan dua bilangan. Pada soal ini, 539 + 384 = 923. Jadi jawaban yang benar adalah 923."},
                { q: "Berapakah hasil dari 2.450 + 1.320?", options: ["3.870", "3.570", "3.770"], a: 2 ,materi: "Penjumlahan adalah operasi matematika untuk menggabungkan dua bilangan. Pada soal ini, 2.450 + 1.320 = 3.770. Jadi jawaban yang benar adalah 3.770."},
                { q: "Berapakah hasil dari 3.425 + 1.897?", options: ["5.212", "5.312", "5.322"], a: 2 ,materi: "Penjumlahan adalah operasi matematika untuk menggabungkan dua bilangan. Pada soal ini, 3.425 + 1.897 = 5.322. Jadi jawaban yang benar adalah 5.322."},
                { q: "Berapakah hasil dari 2,5 + 1,75?", options: ["4,15", "4,25", "3,25"], a: 1 ,materi: "Penjumlahan adalah operasi matematika untuk menggabungkan dua bilangan. Pada soal ini, 2,5 + 1,75 = 4,25. Jadi jawaban yang benar adalah 4,25."},
                { q: "Berapakah hasil dari 45.672 + 38.948?", options: ["84.520", "85.610", "84.620"], a: 2 ,materi: "Penjumlahan adalah operasi matematika untuk menggabungkan dua bilangan. Pada soal ini, 45.672 + 38.948 = 84.620. Jadi jawaban yang benar adalah 84.620."},
                { q: "Berapakah hasil dari 7.500 + 28.325?", options: ["35.825", "33.825", "36.825"], a: 0 ,materi: "Penjumlahan adalah operasi matematika untuk menggabungkan dua bilangan. Pada soal ini, 7.500 + 28.325 = 35.825. Jadi jawaban yang benar adalah 35.825."},
                { q: "Berapakah hasil dari 323.820 + 210.350?", options: ["534.170", "524.170", "514.170"], a: 0 ,materi: "Penjumlahan adalah operasi matematika untuk menggabungkan dua bilangan. Pada soal ini, 323.820 + 210.350 = 534.170. Jadi jawaban yang benar adalah 534.170."},
            ],
            "pengurangan": [
                { q: "Berapakah hasil dari 9 - 4?", options: ["6", "5", "7"], a: 1 ,materi: "Pengurangan adalah operasi matematika untuk menggabungkan dua bilangan. Pada soal ini, 9 - 4 = 5. Jadi jawaban yang benar adalah 5."},
                { q: "Berapakah hasil dari 25 - 12?", options: ["11", "13", "14"], a: 1 ,materi: "Pengurangan adalah operasi matematika untuk menggabungkan dua bilangan. Pada soal ini, 25 - 12 = 13. Jadi jawaban yang benar adalah 13."},
                { q: "Berapakah hasil dari 50 - 20?", options: ["30", "25", "35"], a: 0 ,materi: "Pengurangan adalah operasi matematika untuk menggabungkan dua bilangan. Pada soal ini, 50 - 20 = 30. Jadi jawaban yang benar adalah 30."},
                { q: "Berapakah hasil dari 48 - 25?", options: ["21", "25", "23"], a: 2 ,materi: "Pengurangan adalah operasi matematika untuk menggabungkan dua bilangan. Pada soal ini, 48 - 25 = 23. Jadi jawaban yang benar adalah 23."},
                { q: "Berapakah hasil dari 52 - 27?", options: ["25", "24", "35"], a: 0 ,materi: "Pengurangan adalah operasi matematika untuk menggabungkan dua bilangan. Pada soal ini, 52 - 27 = 25. Jadi jawaban yang benar adalah 25."},
                { q: "Berapakah hasil dari 70 - 36?", options: ["44", "34", "36"], a: 1 ,materi: "Pengurangan adalah operasi matematika untuk menggabungkan dua bilangan. Pada soal ini, 70 - 36 = 34. Jadi jawaban yang benar adalah 34."},
                { q: "Berapakah hasil dari 542 - 278?", options: ["254", "274", "264"], a: 2 ,materi: "Pengurangan adalah operasi matematika untuk menggabungkan dua bilangan. Pada soal ini, 542 - 278 = 264. Jadi jawaban yang benar adalah 264."},
                { q: "Berapakah hasil dari 703 - 456?", options: ["347", "247", "357"], a: 1 ,materi: "Pengurangan adalah operasi matematika untuk menggabungkan dua bilangan. Pada soal ini, 703 - 456 = 247. Jadi jawaban yang benar adalah 247."},
                { q: "Berapakah hasil dari 821 - 475?", options: ["346", "356", "456"], a: 0 ,materi: "Pengurangan adalah operasi matematika untuk menggabungkan dua bilangan. Pada soal ini, 821 - 475 = 346. Jadi jawaban yang benar adalah 346."},
                { q: "Berapakah hasil dari 5.312 - 2.845?", options: ["2.637", "2.467", "2.457"], a: 1 ,materi: "Pengurangan adalah operasi matematika untuk menggabungkan dua bilangan. Pada soal ini, 5.312 - 2.845 = 2.467. Jadi jawaban yang benar adalah 2.467."},
                { q: "Berapakah hasil dari 6.000 - 3.429?", options: ["2.471", "2.671", "2.571"], a: 2 ,materi: "Pengurangan adalah operasi matematika untuk menggabungkan dua bilangan. Pada soal ini, 6.000 - 3.429  = 2.571. Jadi jawaban yang benar adalah 2.571."},
                { q: "Berapakah hasil dari 45,8 - 12,35?", options: ["33,55", "34,45", "33,45"], a: 2 ,materi: "Pengurangan adalah operasi matematika untuk menggabungkan dua bilangan. Pada soal ini, 45,8 - 12,35 = 33,45. Jadi jawaban yang benar adalah 33,45."},
                { q: "Berapakah hasil dari 65.420 - 38.915?", options: ["26.505", "25.505", "26.405"], a: 0 ,materi: "Pengurangan adalah operasi matematika untuk menggabungkan dua bilangan. Pada soal ini, 65.420 - 38.915 = 26.505. Jadi jawaban yang benar adalah 26.505."},
                { q: "Berapakah hasil dari 250.000 - 148.650?", options: ["102.450", "100.350", "101.350"], a: 2 ,materi: "Pengurangan adalah operasi matematika untuk menggabungkan dua bilangan. Pada soal ini, 250.000 - 148.650 = 101.350. Jadi jawaban yang benar adalah 101.350."},
                { q: "Berapakah hasil dari 125.500 - 83.950?", options: ["41.550", "41.450", "40.550"], a: 0 ,materi: "Pengurangan adalah operasi matematika untuk menggabungkan dua bilangan. Pada soal ini, 125.500 - 83.950 = 41.550. Jadi jawaban yang benar adalah 41.550."},
            ],
            "perkalian": [
                { q: "Berapakah hasil dari 3 x 4?", options: ["12", "14", "10"], a: 0 ,materi: "Perkalian adalah operasi matematika untuk menggabungkan dua bilangan. Pada soal ini, 3 x 4 = 12. Jadi jawaban yang benar adalah 12."},
                { q: "Berapakah hasil dari 5 x 6?", options: ["25", "30", "35"], a: 1 ,materi: "Perkalian adalah operasi matematika untuk menggabungkan dua bilangan. Pada soal ini, 5 x 6 = 30. Jadi jawaban yang benar adalah 30."},
                { q: "Berapakah hasil dari 7 x 8?", options: ["54", "56", "64"], a: 1 ,materi: "Perkalian adalah operasi matematika untuk menggabungkan dua bilangan. Pada soal ini, 7 x 8 = 56. Jadi jawaban yang benar adalah 56."},
                { q: "Berapakah hasil dari 24 x 3?", options: ["62", "72", "76"], a: 1 ,materi: "Perkalian adalah operasi matematika untuk menggabungkan dua bilangan. Pada soal ini, 24 x 3 = 72. Jadi jawaban yang benar adalah 72."},
                { q: "Berapakah hasil dari 4 x 35?", options: ["140", "145", "125"], a: 0 ,materi: "Perkalian adalah operasi matematika untuk menggabungkan dua bilangan. Pada soal ini, 4 x 35 = 140. Jadi jawaban yang benar adalah 140."},
                { q: "Berapakah hasil dari 48 x 5?", options: ["230", "220", "240"], a: 2 ,materi: "Perkalian adalah operasi matematika untuk menggabungkan dua bilangan. Pada soal ini, 48 x 5 = 240. Jadi jawaban yang benar adalah 240."},
                { q: "Berapakah hasil dari 14 x 23?", options: ["332", "322", "302"], a: 1 ,materi: "Perkalian adalah operasi matematika untuk menggabungkan dua bilangan. Pada soal ini, 14 x 23 = 322. Jadi jawaban yang benar adalah 322."},
                { q: "Berapakah hasil dari 345 x 2?", options: ["680", "670", "690"], a: 2 ,materi: "Perkalian adalah operasi matematika untuk menggabungkan dua bilangan. Pada soal ini, 345 x 2 = 690. Jadi jawaban yang benar adalah 690."},
                { q: "Berapakah hasil dari 18 x 25?", options: ["450", "430", "460"], a: 0 ,materi: "Perkalian adalah operasi matematika untuk menggabungkan dua bilangan. Pada soal ini, 18 x 25 = 450. Jadi jawaban yang benar adalah 450."},
                { q: "Berapakah hasil dari 215 x 12?", options: ["2.680", "2.560", "2.580"], a: 2 ,materi: "Perkalian adalah operasi matematika untuk menggabungkan dua bilangan. Pada soal ini, 215 x 12 = 2.580. Jadi jawaban yang benar adalah 2.580."},
                { q: "Berapakah hasil dari 3,4 x 1,5?", options: ["5,1", "5,4", "4,9"], a: 0 ,materi: "Perkalian adalah operasi matematika untuk menggabungkan dua bilangan. Pada soal ini, 3,4 x 1,5 = 5,1. Jadi jawaban yang benar adalah 5,1."},
                { q: "Berapakah hasil dari 24 x 420?", options: ["9.980", "10.080", "10.180"], a: 1 ,materi: "Perkalian adalah operasi matematika untuk menggabungkan dua bilangan. Pada soal ini, 24 x 420 = 10.080. Jadi jawaban yang benar adalah 10.080."},
                { q: "Berapakah hasil dari 1.245 x 36?", options: ["43.820", "44.820", "44.720"], a: 1 ,materi: "Perkalian adalah operasi matematika untuk menggabungkan dua bilangan. Pada soal ini, 1.245 x 36 = 44.820. Jadi jawaban yang benar adalah 44.820."},
                { q: "Berapakah hasil dari 30 x 83?", options: ["2.490", "2.480", "2.390"], a: 0 ,materi: "Perkalian adalah operasi matematika untuk menggabungkan dua bilangan. Pada soal ini, 30 x 83 = 2.490. Jadi jawaban yang benar adalah 2.490."},
                { q: "Berapakah hasil dari 800 x 18?", options: ["14.444", "14.400", "14.600"], a: 1 ,materi: "Perkalian adalah operasi matematika untuk menggabungkan dua bilangan. Pada soal ini, 800 x 18 = 14.400. Jadi jawaban yang benar adalah 14.400."},
            ],
            "pembagian": [
                { q: "Berapakah hasil dari 12 : 3?", options: ["4", "3", "5"], a: 0 ,materi: "Pembagian adalah operasi matematika untuk menggabungkan dua bilangan. Pada soal ini, 12 : 3 = 4. Jadi jawaban yang benar adalah 4."},
                { q: "Berapakah hasil dari 20 : 5?", options: ["5", "4", "6"], a: 1 ,materi: "Pembagian adalah operasi matematika untuk menggabungkan dua bilangan. Pada soal ini, 20 : 5 = 4. Jadi jawaban yang benar adalah 4."},
                { q: "Berapakah hasil dari 36 : 6?", options: ["6", "7", "8"], a: 0 ,materi: "Pembagian adalah operasi matematika untuk menggabungkan dua bilangan. Pada soal ini, 36 : 6 = 6. Jadi jawaban yang benar adalah 6."},
                { q: "Berapakah hasil dari 49 : 7?", options: ["6", "7", "8"], a: 1 ,materi: "Pembagian adalah operasi matematika untuk menggabungkan dua bilangan. Pada soal ini, 49 : 7 = 7. Jadi jawaban yang benar adalah 7."},
                { q: "Berapakah hasil dari 81 : 9?", options: ["9", "8", "10"], a: 0 ,materi: "Pembagian adalah operasi matematika untuk menggabungkan dua bilangan. Pada soal ini, 81 : 9 = 9. Jadi jawaban yang benar adalah 9."},
                { q: "Berapakah hasil dari 100 : 10?", options: ["10", "100", "1"], a: 0 ,materi: "Pembagian adalah operasi matematika untuk menggabungkan dua bilangan. Pada soal ini, 100 : 10 = 10. Jadi jawaban yang benar adalah 10."},
                { q: "Berapakah hasil dari 64 : 8?", options: ["7", "8", "9"], a: 1 ,materi: "Pembagian adalah operasi matematika untuk menggabungkan dua bilangan. Pada soal ini, 64 : 8 = 8. Jadi jawaban yang benar adalah 8."},
                { q: "Berapakah hasil dari 50 : 2?", options: ["20", "25", "30"], a: 1 ,materi: "Pembagian adalah operasi matematika untuk menggabungkan dua bilangan. Pada soal ini, 50 : 2 = 25. Jadi jawaban yang benar adalah 25."},
                { q: "Berapakah hasil dari 144 : 12?", options: ["12", "11", "14"], a: 0 ,materi: "Pembagian adalah operasi matematika untuk menggabungkan dua bilangan. Pada soal ini, 144 : 12 = 12. Jadi jawaban yang benar adalah 12."},
                { q: "Berapakah hasil dari 150 : 3?", options: ["40", "50", "60"], a: 1 ,materi: ""}
            ],
            "rumus": [
                { q: "Apakah rumus volume balok?", options: ["s x s x s", "p x l x t", "1/2 x a x t"], a: 1 ,materi: "Volume balok diperoleh dengan mengalikan ketiga ukuran rusuk utamanya, yaitu panjang, lebar, dan tinggi bangun ruang tersebut. Jawabannya adalah p x l x t."},
                { q: "Berapakah luas persegi panjang dengan panjang=6 dan lebar=12?", options: ["68", "72", "80"], a: 1 ,materi: "Luas persegi panjang dihitung menggunakan rumus panjang dikali lebar, sehingga 6 dikali 12 menghasilkan 72. Jawabannya adalah 72."},
                { q: "Apakah rumus luas persegi?", options: ["s x s", "p x l", "s + s + s"], a: 0 ,materi: "Karena keempat sisi pada persegi memiliki panjang yang sama, luasnya ditentukan dengan mengalikan panjang sisi dengan sisinya sendiri. Jawabannya adalah s x s."},
                { q: "Apakah rumus keliling lingkaran?", options: ["2 x pi x r", "pi x r x r", "s x 4"], a: 0 , materi: "Keliling lingkaran adalah panjang garis lengkung yang mengelilingi lingkaran, yang dihitung dari perkalian 2, konstanta pi, dan jari-jari (r). Jawabannya adalah 2 x pi x r."},
                { q: "Berapakah hasil dari 20 + 12 - 6?", options: ["34", "15", "26"], a: 2 ,materi: "Penjumlahan dan pengurangan memiliki kedudukan setara sehingga dikerjakan urut dari kiri: 20 + 12 = 32, lalu 32 - 6 = 26. Jawabannya adalah 26."},
                { q: "Apakah rumus luas segitiga?", options: ["1/2 x a x t", "p x l", "s x s x s"], a: 0 ,materi: "Luas segitiga merupakan setengah dari luas persegi panjang yang membingkainya, yakni setengah dikali panjang alas (a) dan tinggi (t). Jawabannya adalah 1/2 x a x t."},
                { q: "Berapakah keliling persegi dengan sisi 5 cm?", options: ["15 cm", "20 cm", "25 cm"], a: 1 ,materi: "Keliling persegi dihitung dengan menjumlahkan keempat sisinya atau menggunakan rumus 4 x sisi (4 x 5 cm = 20 cm). Jawabannya adalah 20 cm."},
                { q: "Apakah rumus volume kubus?", options: ["p x l x t", "s x s x s", "6 x s"], a: 1 , materi: "Kubus memiliki panjang, lebar, dan tinggi yang seluruhnya sama panjang (s), sehingga volumenya adalah sisi pangkat tiga. Jawabannya adalah s x s x s."},
                { q: "Berapakah hasil dari 10 x 5 - 10?", options: ["40", "50", "30"], a: 0 ,materi: "Sesuai aturan urutan operasi hitung, perkalian dikerjakan terlebih dahulu (10 x 5 = 50), baru kemudian dikurangi 10 menjadi 40. Jawabannya adalah 40."},
                { q: "Berapakah luas lingkaran dengan jari-jari 7 cm?", options: ["154 cm2", "144 cm2", "134 cm2"], a: 0 ,materi: "Gunakan rumus luas lingkaran pi x r x r dengan pi = 22/7, sehingga perhitungannya menjadi 22/7 x 7 x 7 = 22 x 7 = 154 cm2. Jawabannya adalah 154 cm2."},
                { q: "Apakah rumus luas lingkaran?", options: ["pi x r x r", "2 x pi x r", "2 x (p + l)"], a: 0, materi: "Luas daerah di dalam lingkaran dihitung dengan mengalikan nilai pi (22/7 atau 3,14) dengan kuadrat panjang jari-jarinya. Jawabannya adalah pi x r x r."},
                { q: "Berapakah keliling persegi panjang dengan panjang 10 cm dan lebar 4 cm?", options: ["28 cm", "40 cm", "14 cm"], a: 0, materi: "Keliling persegi panjang dirumuskan sebagai 2 x (p + l), yaitu 2 x (10 + 4) = 2 x 14 = 28 cm. Jawabannya adalah 28 cm."},
                { q: "Berapakah luas segitiga yang memiliki alas 8 cm dan tinggi 5 cm?", options: ["20 cm2", "40 cm2", "13 cm2"], a: 0, materi: "Masukkan nilai ke dalam rumus 1/2 x alas x tinggi, yaitu 1/2 x 8 x 5 = 4 x 5 = 20 cm2. Jawabannya adalah 20 cm2."},
                { q: "Berapakah volume kubus jika panjang rusuknya 4 cm?", options: ["64 cm3", "16 cm3", "24 cm3"], a: 0, materi: "Volume kubus dihitung dengan mengalikan rusuk sebanyak tiga kali (s x s x s), yaitu 4 x 4 x 4 = 64 cm3. Jawabannya adalah 64 cm3."},
                { q: "Apakah rumus mencari kecepatan rata-rata?", options: ["Jarak / Waktu", "Jarak x Waktu", "Waktu / Jarak"], a: 0, materi: "Kecepatan menyatakan seberapa jauh jarak yang ditempuh dalam setiap satuan waktu, sehingga diperoleh dengan membagi jarak tempuh dengan waktu. Jawabannya adalah Jarak / Waktu."}
            ]
        }
    },
    agama: {
        name: "Pendidikan Agama Islam",
        subCategories: {
            "Fiqih & Ibadah": [
                { q: "Rukun Islam yang pertama adalah...", options: ["Shalat", "Syahadat", "Zakat"], a: 1 ,materi: "Rukun Islam terdiri atas lima pilar utama, dan fondasi pertamanya adalah mengucapkan dua kalimat persaksian keesaan Allah serta kerasulan Nabi Muhammad SAW. Jawabannya adalah Syahadat."},
                { q: "Shalat fardhu dalam sehari semalam dikerjakan sebanyak...", options: ["4 waktu", "5 waktu", "6 waktu"], a: 1 ,materi: "Umat Islam diwajibkan mendirikan shalat wajib pada lima waktu yang telah ditentukan, yakni Subuh, Zuhur, Asar, Magrib, dan Isya. Jawabannya adalah 5 waktu."},
                { q: "Kitab suci umat Islam adalah...", options: ["Injil", "Taurat", "Al-Qur'an"], a: 2 ,materi: "Al-Qur'an adalah kalam Allah SWT yang diturunkan kepada Nabi Muhammad SAW melalui Malaikat Jibril sebagai pedoman hidup seluruh umat manusia. Jawabannya adalah Al-Qur'an."},
                { q: "Malaikat yang bertugas menyampaikan wahyu adalah...", options: ["Mikail", "Jibril", "Izrail"], a: 1 ,materi: "Di antara sepuluh malaikat yang wajib diimani, Malaikat Jibril mendapat amanah khusus untuk menyampaikan wahyu Allah kepada para nabi dan rasul. Jawabannya adalah Jibril."},
                { q: "Puasa wajib umat Islam dikerjakan pada bulan...", options: ["Syawal", "Ramadhan", "Rajab"], a: 1 ,materi: "Ibadah puasa fardhu dilaksanakan selama satu bulan penuh pada bulan kesembilan dalam kalender Hijriah dengan menahan diri dari makan, minum, dan pembatal puasa sejak fajar hingga magrib. Jawabannya adalah Ramadhan."},
                { q: "Nabi dan Rasul terakhir bagi umat Islam adalah...", options: ["Nabi Musa AS", "Nabi Isa AS", "Nabi Muhammad SAW"], a: 2 ,materi: "Nabi Muhammad SAW bergelar Khatamul Anbiya yang berarti penutup seluruh rangkaian nabi dan rasul sehingga tidak ada lagi nabi setelah beliau. Jawabannya adalah Nabi Muhammad SAW."},
                { q: "Jumlah rakaat pada shalat Subuh adalah...", options: ["2 rakaat", "3 rakaat", "4 rakaat"], a: 0 ,materi: "Shalat fardhu yang dikerjakan sejak terbit fajar hingga menjelang matahari terbit ini memiliki jumlah rakaat paling sedikit di antara shalat wajib lainnya. Jawabannya adalah 2 rakaat."},
                { q: "Arah kiblat umat Islam saat shalat menghadap ke...", options: ["Gereja", "Ka'bah/Mekkah", "Timur"], a: 1 ,materi: "Seluruh umat Islam di berbagai penjuru dunia menghadapkan wajah dan tubuh ke arah bangunan suci Baitullah di Masjidil Haram ketika mendirikan shalat. Jawabannya adalah Ka'bah/Mekkah."},
                { q: "Malaikat yang bertugas mencabut nyawa adalah...", options: ["Israfil", "Izrail", "Munkar"], a: 1 ,materi: "Setiap makhluk yang bernyawa pasti akan mengalami kematian, dan tugas mencabut ruh ketika ajal tiba diamanahkan kepada Malaikat Izrail. Jawabannya adalah Izrail."},
                { q: "Membayar zakat fitrah dikeluarkan pada bulan...", options: ["Ramadhan", "Dzulhijjah", "Muharram"], a: 0 ,materi: "Zakat fitrah berupa makanan pokok wajib ditunaikan oleh setiap muslim yang mampu sejak awal Ramadhan hingga sebelum pelaksanaan shalat Idul Fitri. Jawabannya adalah Ramadhan."},
                { q: "Bersuci dari hadas kecil sebelum melaksanakan shalat dilakukan dengan cara...", options: ["Wudhu", "Tayamum saja", "Mandi besar"], a: 0 ,materi: "Wudhu menggunakan air suci yang menyucikan merupakan syarat sah shalat untuk menghilangkan hadas kecil pada anggota tubuh tertentu. Jawabannya adalah Wudhu."},
                { q: "Jumlah rakaat pada shalat Magrib adalah...", options: ["3 rakaat", "2 rakaat", "4 rakaat"], a: 0 ,materi: "Shalat Magrib merupakan satu-satunya shalat fardhu lima waktu yang memiliki jumlah rakaat ganjil, yakni dikerjakan setelah matahari terbenam. Jawabannya adalah 3 rakaat."},
                { q: "Ibadah haji diwajibkan bagi umat Islam yang...", options: ["Mampu secara fisik dan biaya", "Berusia di bawah 10 tahun", "Tinggal di kota besar saja"], a: 0 ,materi: "Rukun Islam kelima ini memiliki syarat istitha'ah, artinya kewajiban tersebut berlaku bagi muslim yang sehat jasmani, aman perjalanan, dan memiliki bekal cukup. Jawabannya adalah Mampu secara fisik dan biaya."},
                { q: "Rukun Iman dalam ajaran Islam berjumlah...", options: ["6 perkara", "5 perkara", "4 perkara"], a: 0 ,materi: "Rukun Iman mencakup keyakinan kepada Allah, malaikat, kitab-kitab, rasul-rasul, hari akhir, serta qada dan qadar. Jawabannya adalah 6 perkara."},
                { q: "Perbuatan membasuh seluruh tubuh dengan air suci untuk menghilangkan hadas besar disebut...", options: ["Mandi wajib / janabah", "Istinja", "Wudhu"], a: 0 ,materi: "Apabila seseorang mengalami hadas besar, ia diwajibkan meratakan air ke seluruh tubuh disertai niat bersuci sebelum melaksanakan ibadah shalat. Jawabannya adalah Mandi wajib / janabah."}
            ],
            "Sejarah": [
                { q: "Nabi yang dijuluki sebagai bapak para nabi adalah...", options: ["Nabi Ibrahim AS", "Nabi Nuh AS", "Nabi Adam AS"], a: 0 ,materi: "Nabi Ibrahim AS mendapat gelar Abul Anbiya karena dari garis keturunan beliaulah lahir banyak nabi dan rasul besar, seperti Nabi Ismail, Nabi Ishaq, Nabi Yaqub, hingga Nabi Muhammad SAW. Jawabannya adalah Nabi Ibrahim AS."},
                { q: "Kota tempat kelahiran Nabi Muhammad SAW adalah...", options: ["Madinah", "Mekkah", "Jerusalem"], a: 1 ,materi: "Nabi Muhammad SAW dilahirkan pada hari Senin, 12 Rabiul Awal Tahun Gajah di kota suci tempat berdirinya Ka'bah [20.1.12]. Jawabannya adalah Mekkah."},
                { q: "Gelar yang diberikan kepada Nabi Muhammad SAW sebelum diangkat menjadi nabi adalah...", options: ["Al-Amin", "Al-Faruq", "As-Siddiq"], a: 0 ,materi: "Sejak muda sebelum menerima wahyu kenabian, masyarakat Quraisy menjuluki Nabi Muhammad SAW dengan gelar Al-Amin karena kejujuran dan sifat dapat dipercaya beliau. Jawabannya adalah Al-Amin."},
                { q: "Sahabat Nabi yang mendapat gelar Ash-Shiddiq adalah...", options: ["Umar bin Khattab", "Abu Bakar", "Ali bin Abi Thalib"], a: 1 ,materi: "Sahabat terdekat Rasulullah SAW ini diberi gelar Ash-Shiddiq karena selalu membenarkan perkataan Nabi tanpa ragu, termasuk saat peristiwa Isra Mikraj [20.1.2]. Jawabannya adalah Abu Bakar."},
                { q: "Perang pertama dalam sejarah Islam adalah perang...", options: ["Badar", "Uhud", "Khandak"], a: 0 ,},
                { q: "Tempat hijrah Nabi Muhammad SAW dari Mekkah adalah ke kota...", options: ["Thif", "Madinah", "Syam"], a: 1 ,},
                { q: "Istri pertama Nabi Muhammad SAW bernama...", options: ["Aisyah", "Khadijah", "Fatimah"], a: 1 ,},
                { q: "Paman Nabi Muhammad SAW yang merawat beliau sejak kecil bernama...", options: ["Abu Lahab", "Abu Thalib", "Hamzah"], a: 1 ,},
                { q: "Masjid pertama yang dibangun oleh Nabi Muhammad SAW di Madinah adalah...", options: ["Masjidil Haram", "Masjid Nabawi", "Masjid Quba"], a: 2 ,},
                { q: "Khulafaur Rasyidin yang pertama adalah...", options: ["Abu Bakar Ash-Shiddiq", "Umar bin Khattab", "Usman bin Affan"], a: 0 }
            ]
        }
    },
    "sejarah_indonesia": {
        name: "Sejarah Indonesia",
        subCategories: {
            "Awal periode baru": [
                { q: "Kapan proklamasi kemerdekaan Republik Indonesia dikumandangkan?", options: ["17 Agustus 1945", "18 Agustus 1945", "1 Juni 1945"], a: 0 ,materi: ""},
                { q: "Siapa tokoh yang menjahit bendera Sang Saka Merah Putih?", options: ["Fatmawati", "Kartini", "Cut Nyak Dien"], a: 0 ,materi: ""},
                { q: "Teks proklamasi kemerdekaan dibacakan di Jalan...", options: ["Pegangsaan Timur No. 56", "Malioboro No. 10", "Diponegoro No. 5"], a: 0 ,materi: ""},
                { q: "Siapa yang mengetik naskah proklamasi kemerdekaan Indonesia?", options: ["Sayuti Melik", "Sukarni", "B.M. Diah"], a: 0 ,},
                { q: "Tokoh yang merumuskan teks proklamasi di rumah Admiral Maeda adalah...", options: ["Soekarno, Hatta, dan Achmad Subardjo", "Sutan Sjahrir dan Amir", "Sudirman dan Oerip"], a: 0 ,},
                { q: "Organisasi pergerakan nasional pertama di Indonesia adalah...", options: ["Budi Utomo", "Sarikat Islam", "Indische Partij"], a: 0 ,},
          ,     { q: "Sumpah Pemuda diikrarkan pada tanggal...", options: ["28 Oktober 1928", "20 Mei 1908", "10 November 1945"], a: 0 ,},
                { q: "Siapa tokoh yang memimpin perlawanan di Bali dengan perang Puputan Margarana?", options: ["I Gusti Ngurah Rai", "Pangeran Diponegoro", "Sultan Hasanuddin"], a: 0 ,},
                { q: "Peristiwa Rengasdengklok terjadi pada tanggal...", options: ["16 Agustus 1945", "17 Agustus 1945", "15 Agustus 1945"], a: 0 ,},
                { q: "Gelar Bapak Proklamator Indonesia disematkan kepada...", options: ["Soekarno dan Mohammad Hatta", "Soedirman dan Ki Hajar", "Tan Malaka dan Sjahrir"], a: 0 ,},
                { q: "Kapan Indonesia resmi menjadi Negara Kesatuan Republik Indonesia kembali?", options: ["17 Agustus 1950", "27 Desember 1949", "18 Agustus 1945", "1 Juni 1945"],a: 0 ,},
                { q: "Siapa presiden pertama Republik Indonesia?", options: ["Soekarno", "Soeharto", "Mohammad Hatta", "B.J. Habibie"], a: 0 ,},
                { q: "Apa kepanjangan dari PPKI?", options: ["Panitia Persiapan Kemerdekaan Indonesia", "Persatuan Pemuda Kemerdekaan Indonesia", "Panitia Perjuangan Kemerdekaan Indonesia", "Persatuan Pergerakan Kemerdekaan Indonesia"],a: 0 ,},
                { q: "Kapan peristiwa Rengasdengklok terjadi?", options: ["16 Agustus 1945", "17 Agustus 1945", "18 Agustus 1945", "10 November 1945"],a: 0 ,},
                { q: "Siapa wakil presiden pertama Indonesia?", options: ["Mohammad Hatta", "Sutan Sjahrir", "Ahmad Soebardjo", "Ki Hajar Dewantara"],a: 0 ,},
            ],
            "periode lama": [
                { q: "Kerajaan Hindu tertua di Indonesia berdasarkan yupa adalah...", options: ["Kutai", "Tarumanegara", "Sriwijaya"], a: 0 ,},
                { q: "Candi Borobudur merupakan peninggalan dari kerajaan bercorak...", options: ["Buddha", "Hindu", "Islam"], a: 0 },
                { q: "Raja terkenal dari Kerajaan Singasari yang mencetuskan Sumpah Palapa adalah...", options: ["Hayam Wuruk", "Gajah Mada", "Kertanegara"], a: 1 ,},
                { q: "Kerajaan Islam pertama di pulau Jawa adalah...", options: ["Demak", "Samudera Pasai", "Mataram Islam"], a: 0 ,},
                { q: "Peninggalan berupa prasasti Tugu berasal dari kerajaan...", options: ["Tarumanegara", "Kutai", "Majapahit"], a: 0 ,},
                { q: "Sultan Hasanuddin dijuluki sebagai Ayam Jantan dari...", options: ["Timur", "Barat", "Selatan"], a: 0 ,},
                { q: "Pangeran Diponegoro memimpin perang melawan Belanda pada tahun...", options: ["1825 - 1830", "1908 - 1912", "1942 - 1945"], a: 0 ,},
                { q: "Cut Nyak Dien adalah pahlawan nasional wanita yang berasal dari...", options: ["Aceh", "Sumatera Barat", "Maluku"], a: 0 ,},
                { q: "Pelaut Portugis yang pertama kali mendarat di Malaka adalah...", options: ["Alfonso de Albuquerque", "Cornelis de Houtman", "Magelhaens"], a: 0 ,},
                { q: "Benteng Vredeburg merupakan peninggalan sejarah yang terletak di kota...", options: ["Yogyakarta", "Semarang", "Surabaya"], a: 0 ,},
                { q: "Kitab Negarakertagama merupakan karya sastra yang ditulis pada masa kerajaan...",options: ["Majapahit", "Sriwijaya", "Kutai", "Tarumanegara"],a: 0 ,materi: "Karya sastra pada masa kerajaan Hindu-Buddha digunakan untuk mencatat kehidupan kerajaan, perjalanan sejarah, serta kebesaran para penguasa."},
                { q: "Siapa tokoh yang mengucapkan Sumpah Palapa?", options: ["Gajah Mada", "Hayam Wuruk", "Ken Arok", "Raden Wijaya"],a: 0 ,materi: "Dalam sejarah kerajaan Nusantara, terdapat tokoh penting yang memiliki cita-cita besar untuk menyatukan berbagai wilayah kepulauan di bawah satu kekuasaan."},
                { q: "Apa fungsi utama candi pada masa kerajaan Hindu-Buddha?", options: ["Tempat ibadah", "Tempat perdagangan", "Tempat tinggal rakyat", "Tempat penyimpanan senjata"],a: 0 ,materi: "Candi merupakan salah satu peninggalan sejarah yang memiliki nilai keagamaan, kebudayaan, dan arsitektur pada masa kerajaan kuno di Indonesia."},
                { q: "Apa tujuan utama bangsa Eropa datang ke Nusantara pada awal kedatangannya?", options: ["Mencari rempah-rempah", "Membangun sekolah", "Menyebarkan teknologi", "Mencari tempat wisata"],a: 0 ,materi: "Kepulauan Nusantara memiliki kekayaan alam yang menarik perhatian bangsa asing. Hubungan perdagangan kemudian berkembang dan memengaruhi kehidupan masyarakat Indonesia."},
                { q: "Organisasi dagang Belanda yang memiliki hak istimewa di Nusantara disebut...", options: ["VOC", "EIC", "PETA", "BPUPKI"],a: 0 ,materi: "Pada masa kolonial, bangsa Eropa membentuk organisasi perdagangan untuk menguasai jalur perdagangan dan memperoleh keuntungan dari kekayaan alam Nusantara."}

            ]
        }
    },
    "pjok": {
        name: "PJOK",
        subCategories: {
            "bola voli": [
                { q: "Induk organisasi bola voli di Indonesia adalah...", options: ["PBVSI", "PSSI", "PERBASI"], a: 0 ,materi: "Persatuan Bola Voli Seluruh Indonesia didirikan pada 22 Januari 1955 untuk menaungi pembinaan atlet serta kompetisi bola voli di tingkat nasional. Jawabannya adalah PBVSI."},
                { q: "Teknik memukul bola dari atas garis belakang lapangan dalam voli disebut...", options: ["Service", "Smash", "Passing"], a: 0 ,materi: "Pukulan pembuka dari belakang garis akhir lapangan ini dilakukan untuk memulai reli permainan sekaligus menjadi serangan pertama ke area lawan. Jawabannya adalah Service."},
                { q: "Jumlah pemain bola voli setiap regu di lapangan adalah...", options: ["6 orang", "5 orang", "11 orang"], a: 0 ,materi: "Dalam pertandingan bola voli indoor standar, setiap tim memainkan enam orang pemain inti yang terbagi dalam tiga posisi barisan depan dan tiga barisan belakang. Jawabannya adalah 6 orang."},
                { q: "Teknik dasar untuk mengoper bola kepada teman dalam voli adalah...", options: ["Passing", "Dribbling", "Heading"], a: 0 ,materi: "Mengumpan atau mengoper bola kepada rekan setim menggunakan kedua lengan bawah maupun jari-jari tangan di atas kepala bertujuan membangun pola serangan. Jawabannya adalah Passing."},
                { q: "Pukulan keras menukik ke daerah lawan untuk mencetak poin disebut...", options: ["Smash", "Block", "Service"], a: 0 ,materi: "Serangan utama dalam bola voli dilakukan dengan melompat tinggi di dekat net dan memukul bola sekeras mungkin menuju area kosong pertahanan lawan. Jawabannya adalah Smash."},
                { q: "Posisi pemain yang bertugas khusus sebagai bertahan dalam bola voli disebut...", options: ["Libero", "Setter", "Spiker"], a: 0 ,materi: "Pemain bertahan khusus ini mengenakan seragam berbeda warna, bertugas menerima servis serta menahan serangan lawan, namun tidak diperbolehkan melakukan smash maupun servis. Jawabannya adalah Libero."},
                { q: "Setiap satu set dalam permainan bola voli umumnya dimenangkan tim yang mencapai angka...", options: ["25", "15", "20"], a: 0 ,materi: "Menggunakan sistem rally point pada set pertama hingga keempat, sebuah tim dinyatakan memenangkan set apabila lebih dulu meraih 25 poin dengan selisih minimal dua angka. Jawabannya adalah 25."},
                { q: "Organisasi bola voli internasional adalah...", options: ["FIVB", "FIFA", "FIBA"], a: 0 , materi: "Federation Internationale de Volleyball adalah badan induk olahraga bola voli dunia yang bermarkas di Swiss dan mengatur peraturan resmi pertandingan internasional. Jawabannya adalah FIVB."},
                { q: "Teknik bendungan untuk menahan serangan lawan di atas net disebut...", options: ["Blocking", "Passing", "Service"], a: 0 ,materi: "Pertahanan lini depan ini dilakukan satu hingga tiga pemain dengan melompat sambil menjulurkan kedua tangan lurus ke atas net guna memantulkan kembali smash lawan. Jawabannya adalah Blocking."},
                { q: "Ukuran standar tinggi net bola voli untuk putra adalah...", options: ["2,43 meter", "2,24 meter", "2,50 meter"], a: 0 ,materi: "Berdasarkan ketetapan peraturan resmi permainan bola voli internasional, jaring net untuk kategori putra dipasang tepat pada ketinggian 2,43 meter. Jawabannya adalah 2,43 meter."},
                { q: "Ukuran standar tinggi net bola voli untuk putri adalah...", options: ["2,24 meter", "2,43 meter", "2,15 meter", "2,30 meter"], a: 0,materi: "Ukuran standar tinggi net bola voli untuk kategori putri adalah 2,24 meter, sedangkan untuk kategori putra adalah 2,43 meter." },
                { q: "Panjang dan lebar standar lapangan bola voli adalah...", options: ["18 m x 9 m", "20 m x 10 m", "16 m x 8 m", "22 m x 11 m"], a: 0,materi: "Lapangan bola voli berbentuk persegi panjang dengan ukuran standar internasional panjang 18 meter dan lebar 9 meter." },
                { q: "Pemain yang bertugas mengatur serangan atau mengumpan bola kepada smasher disebut...", options: ["Tosser (Setter)", "Libero", "Blocker", "Server"], a: 0,materi: "Tosser atau setter adalah pemain yang bertugas mengatur jalannya serangan sekaligus memberikan umpan matang kepada smasher." },
                { q: "Teknik dasar untuk menerima dan menahan pukulan smash keras dari lawan disebut...", options: ["Passing bawah", "Passing atas", "Servis atas", "Blocking"], a: 0,materi: "Passing bawah merupakan teknik dasar menggunakan kedua lengan yang dirapatkan untuk menerima servis atau menahan smash keras lawan." },
                { q: "Pergeseran posisi pemain dalam permainan bola voli dilakukan searah dengan...", options: ["Jarum jam", "Lawan arah jarum jam", "Bebas sesuai keinginan", "Diagonal lapangan"], a: 0,materi: "Setiap kali sebuah regu berhasil merebut hak servis dari lawan, pemain di lapangan wajib melakukan rotasi posisi searah jarum jam." }
            ],
            "senam mentari pagi": [
    {
        q: "Apa tujuan utama diadakannya Senam Mentari Pagi bagi para peserta?",
        options: [
            "Melatih teknik pernapasan di bawah air",
            "Mempersiapkan atlet untuk kompetisi angkat beban",
            "Meningkatkan kebugaran jasmani, semangat, dan keceriaan sebelum memulai aktivitas"
        ],
        a: 2 ,materi: "Senam pagi dirancang sebagai aktivitas fisik ringan hingga sedang untuk menyegarkan tubuh dan membangkitkan suasana hati positif sebelum belajar atau bekerja. Jawabannya adalah Meningkatkan kebugaran jasmani, semangat, dan keceriaan sebelum memulai aktivitas."
    },
    {
        q: "Gerakan apa yang umumnya dilakukan terlebih dahulu saat pemanasan Senam Mentari Pagi?",
        options: [
            "Peregangan otot dan persendian dari kepala hingga kaki secara bertahap",
            "Lari sprint jarak jauh secepat mungkin",
            "Melakukan lompat tinggi secara terus-menerus"
        ],
        a: 0 ,materi: "Pemanasan bertujuan menaikkan suhu tubuh secara perlahan dan melemaskan otot serta sendi agar terhindar dari risiko cedera saat masuk gerakan inti. Jawabannya adalah Peregangan otot dan persendian dari kepala hingga kaki secara bertahap."
    },
    {
        q: "Apa manfaat utama Senam Mentari Pagi bagi sistem kardiovaskular?",
        options: [
            "Menurunkan kapasitas paru-paru",
            "Membantu meningkatkan sirkulasi darah dan menjaga kesehatan jantung",
            "Menyebabkan penurunan kekuatan otot"
        ],
        a: 1 ,materi: "Gerakan senam yang ritmis melatih kerja jantung memompa darah lebih optimal sehingga aliran oksigen ke seluruh tubuh menjadi lancar. Jawabannya adalah Membantu meningkatkan sirkulasi darah dan menjaga kesehatan jantung."
    },
    {
        q: "Bagaimana karakteristik musik yang cocok untuk mengiringi Senam Mentari Pagi?",
        options: [
            "Suara alam tanpa irama musik",
            "Bertempo ceria, bersemangat, dan memiliki ketukan yang teratur",
            "Bertempo sangat lambat dan bernuansa sedih"
        ],
        a: 1
    },
    {
        q: "Mengapa Senam Mentari Pagi dianjurkan dilakukan di luar ruangan pada pagi hari?",
        options: [
            "Karena aktivitas olahraga tidak boleh dilakukan di dalam ruangan",
            "Agar peserta mendapatkan udara segar dan paparan sinar matahari pagi",
            "Agar peserta tidak terlihat oleh instruktur"
        ],
        a: 1 ,materi: "Iringan musik berirama ceria dengan ketukan stabil memudahkan peserta menyamakan tempo gerakan sekaligus meningkatkan motivasi berolahraga. Jawabannya adalah Bertempo ceria, bersemangat, dan memiliki ketukan yang teratur."
    },
    {
        q: "Dalam senam aerobik, kapan pergantian variasi gerakan biasanya dilakukan agar sesuai dengan irama musik?",
        options: [
            "Pada awal rangkaian hitungan atau sesuai aba-aba instruktur",
            "Secara acak tanpa mengikuti irama",
            "Hanya pada hitungan ke-3 dan ke-7"
        ],
        a: 0 ,materi: "Senam berirama menggunakan pola hitungan 1 sampai 8 sehingga transisi gerakan dilakukan tepat pada awal hitungan baru mengikuti komando instruktur. Jawabannya adalah Pada awal rangkaian hitungan atau sesuai aba-aba instruktur."
    },
    {
        q: "Mengapa perpindahan dari gerakan pemanasan ke gerakan inti harus dilakukan secara bertahap?",
        options: [
            "Agar durasi senam menjadi lebih singkat",
            "Agar peserta tidak perlu mengikuti urutan gerakan",
            "Agar jantung dan otot dapat beradaptasi dengan peningkatan intensitas latihan"
        ],
        a: 2 ,materi: "Peningkatan intensitas secara bertahap mencegah lonjakan detak jantung mendadak serta mengurangi risiko kram atau ketegangan otot. Jawabannya adalah Agar jantung dan otot dapat beradaptasi dengan peningkatan intensitas latihan."
    },
    {
        q: "Apa fungsi utama pengaturan jarak dan barisan saat ratusan siswa SMKN 1 SUMBERASIH mengikuti Senam Mentari Pagi?",
        options: [
            "Mencegah benturan antar peserta dan memberikan ruang gerak yang cukup",
            "Mengurangi volume suara musik",
            "Membatasi jumlah peserta yang berkeringat"
        ],
        a: 0 ,materi: "Jarak rentang tangan yang teratur menjamin keamanan dan keleluasaan setiap peserta saat mengayunkan lengan maupun melangkahkan kaki. Jawabannya adalah Mencegah benturan antar peserta dan memberikan ruang gerak yang cukup."
    },
    {
        q: "Apa tujuan utama gerakan pendinginan (cool-down) setelah Senam Mentari Pagi?",
        options: [
            "Membantu menurunkan denyut jantung secara bertahap dan merilekskan otot",
            "Menggantikan kebutuhan minum air setelah olahraga",
            "Memaksa otot melakukan peregangan secara berlebihan"
        ],
        a: 0 , materi: "Pendinginan mengembalikan kondisi detak jantung, tekanan darah, dan suhu tubuh ke keadaan normal secara perlahan setelah beraktivitas fisik. Jawabannya adalah Membantu menurunkan denyut jantung secara bertahap dan merilekskan otot."
    },
    {
        q: "Sikap apa yang mencerminkan kerja sama dan kedisiplinan saat mengikuti Senam Mentari Pagi bersama?",
        options: [
            "Menjaga kekompakan gerakan dan mengikuti aba-aba instruktur",
            "Melakukan gerakan sendiri agar terlihat paling menonjol",
            "Berhenti sesuka hati tanpa mengikuti instruksi"
        ],
        a: 0 ,materi: "Senam massal melatih keseragaman gerak, kebersamaan, serta kepatuhan peserta terhadap arahan pemandu senam. Jawabannya adalah Menjaga kekompakan gerakan dan mengikuti aba-aba instruktur."
    },
    {
        q: "Urutan sistematika pelaksanaan Senam Mentari Pagi yang benar adalah...",
    options: [
      "Pemanasan, gerakan inti, dan pendinginan",
      "Gerakan inti, pendinginan, dan pemanasan",
      "Pendinginan, pemanasan, dan gerakan inti"
    ],
    a: 0,
    materi: "Setiap sesi senam kebugaran wajib diawali persiapan otot, dilanjutkan latihan utama dengan intensitas lebih tinggi, dan ditutup relaksasi. Jawabannya adalah Pemanasan, gerakan inti, dan pendinginan."
  },
  {
    q: "Pakaian yang paling tepat digunakan saat mengikuti Senam Mentari Pagi adalah...",
    options: [
      "Pakaian olahraga yang menyerap keringat dan sepatu olahraga",
      "Seragam formal lengkap dengan sepatu pantofel",
      "Jaket tebal berbahan kulit"
    ],
    a: 0,
    materi: "Pakaian berbahan ringan yang menyerap keringat serta alas kaki yang tepat memberikan kenyamanan dan melindungi kaki dari cedera saat bergerak aktif. Jawabannya adalah Pakaian olahraga yang menyerap keringat dan sepatu olahraga."
  },
  {
    q: "Apa fungsi pengaturan pernapasan yang teratur selama melakukan gerakan senam?",
    options: [
      "Menjaga pasokan oksigen ke otot agar tubuh tidak cepat lelah",
      "Membuat gerakan menjadi lebih lambat",
      "Menghentikan pengeluaran keringat"
    ],
    a: 0,
    materi: "Bernapas secara teratur dengan menarik napas melalui hidung dan mengembuskannya lewat mulut membantu suplai oksigen tetap stabil selama berolahraga. Jawabannya adalah Menjaga pasokan oksigen ke otot agar tubuh tidak cepat lelah."
  },
  {
    q: "Unsur kebugaran jasmani yang paling dominan dilatih dalam gerakan Senam Mentari Pagi adalah...",
    options: [
      "Kelenturan, koordinasi gerak, dan daya tahan jantung-paru",
      "Kekuatan mengangkat beban maksimal",
      "Kecepatan lari jarak pendek"
    ],
    a: 0,
    materi: "Kombinasi ayunan tangan, langkah kaki, dan irama musik melatih keselarasan gerak tubuh sekaligus daya tahan kardiorespirasi. Jawabannya adalah Kelenturan, koordinasi gerak, dan daya tahan jantung-paru."
  },
  {
     q: "Dampak positif rutin mengikuti Senam Mentari Pagi bagi siswa di sekolah adalah...",
    options: [
      "Meningkatkan konsentrasi dan kesiapan fisik saat mengikuti pelajaran",
      "Membuat tubuh mudah mengantuk di kelas",
      "Mengurangi waktu istirahat siang"
    ],
    a: 0,
    materi: "Aliran oksigen yang lancar ke otak setelah senam pagi membuat siswa lebih segar, fokus, dan siap menerima materi pembelajaran. Jawabannya adalah Meningkatkan konsentrasi dan kesiapan fisik saat mengikuti pelajaran."
  }
],
            "bola sepak": [
    {
        q: "Induk organisasi sepak bola di Indonesia adalah...",
        options: ["PBVSI", "PSSI", "PERBASI"],
        a: 1 ,materi: "Persatuan Sepak Bola Seluruh Indonesia (PSSI) didirikan pada 19 April 1930 dan bertugas menaungi seluruh kompetisi sepak bola nasional. Jawabannya adalah PSSI."
    },
    {
        q: "Berapa jumlah pemain sepak bola dalam satu tim di lapangan?",
        options: ["6 orang", "10 orang", "11 orang"],
        a: 2 ,materi: "Dalam pertandingan resmi sepak bola lapangan besar, setiap tim menurunkan 11 pemain yang terdiri atas 10 pemain lapangan dan 1 penjaga gawang. Jawabannya adalah 11 orang."
    },
    {
        q: "Teknik mengoper bola kepada teman satu tim disebut...",
        options: ["Passing", "Shooting", "Heading"],
        a: 0 ,materi: "Passing merupakan teknik dasar memindahkan bola dari satu pemain ke rekan setim menggunakan kaki bagian dalam, luar, maupun punggung kaki. Jawabannya adalah Passing."
    },
    {
        q: "Teknik menendang bola ke arah gawang untuk mencetak gol disebut...",
        options: ["Dribbling", "Shooting", "Throw-in"],
        a: 1 ,materi: "Shooting adalah tendangan keras dan terarah menuju gawang lawan dengan tujuan menghasilkan gol. Jawabannya adalah Shooting."
    },
    {
        q: "Pemain yang bertugas menjaga gawang disebut...",
        options: ["Striker", "Gelandang", "Kiper"],
        a: 2 ,materi: "Kiper atau penjaga gawang (goalkeeper) adalah satu-satunya pemain yang diperbolehkan menyentuh bola dengan tangan di dalam area penalti timnya sendiri. Jawabannya adalah Kiper."
    },
    {
        q: "Teknik menggiring bola dalam permainan sepak bola disebut...",
        options: ["Dribbling", "Passing", "Heading"],
        a: 0 ,materi: "Dribbling dilakukan dengan menendang bola secara terputus-putus sambil berlari untuk membawa bola melewati lawan atau mencari ruang kosong. Jawabannya adalah Dribbling."
    },
    {
        q: "Berapa lama waktu normal pertandingan sepak bola?",
        options: ["60 menit", "90 menit", "120 menit"],
        a: 1 ,materi: "Pertandingan sepak bola standar dimainkan dalam dua babak yang masing-masing berdurasi 45 menit dengan waktu istirahat 15 menit di antaranya. Jawabannya adalah 90 menit."
    },
    {
        q: "Induk organisasi sepak bola internasional adalah...",
        options: ["FIVB", "FIFA", "FIBA"],
        a: 1 ,materi: "Federation Internationale de Football Association (FIFA) adalah badan pengendali sepak bola dunia yang menyelenggarakan Piala Dunia. Jawabannya adalah FIFA."
    },
    {
        q: "Teknik memainkan bola menggunakan kepala disebut...",
        options: ["Heading", "Dribbling", "Tackling"],
        a: 0 , materi: "Heading atau menyundul bola dilakukan menggunakan dahi untuk mengoper, menghalau serangan lawan, maupun mencetak gol dari bola lambung. Jawabannya adalah Heading."
    },
    {
        q: "Berapa ukuran tinggi gawang sepak bola standar?",
        options: ["2,44 meter", "2,24 meter", "2,50 meter"],
        a: 0 , materi: "Menurut aturan resmi FIFA, gawang sepak bola memiliki ukuran tinggi 2,44 meter (8 kaki) dan lebar 7,32 meter (24 kaki). Jawabannya adalah 2,44 meter."
    },
    {
         q: "Teknik menghentikan atau mengontrol bola yang datang ke arah pemain disebut...",
    options: ["Controlling / Stopping", "Shooting", "Clearing"],
    a: 0,
    materi: "Controlling bertujuan meredam laju bola agar tetap berada dalam penguasaan pemain menggunakan kaki, paha, atau dada. Jawabannya adalah Controlling / Stopping."
  },
  {
    q: "Lemparan ke dalam dilakukan apabila bola keluar melewati...",
    options: ["Garis samping lapangan", "Garis gawang", "Garis tengah lapangan"],
    a: 0,
    materi: "Throw-in atau lemparan ke dalam diberikan kepada tim lawan dari pemain yang terakhir menyentuh bola sebelum melewati garis tepi lapangan. Jawabannya adalah Garis samping lapangan."
  },
  {
    q: "Tendangan sudut (corner kick) diberikan apabila bola keluar melewati garis gawang setelah terakhir disentuh oleh...",
    options: ["Pemain bertahan", "Pemain penyerang", "Wasit pertandingan"],
    a: 0,
    materi: "Jika bola keluar melewati garis belakang lapangan dan sentuhan terakhir berasal dari pemain tim yang bertahan, tim penyerang mendapat tendangan sudut. Jawabannya adalah Pemain bertahan."
  },
  {
    q: "Kartu yang diberikan wasit sebagai tanda pemain harus keluar lapangan karena pelanggaran berat adalah...",
    options: ["Kartu merah", "Kartu kuning", "Kartu hijau"],
    a: 0,
    materi: "Kartu merah berarti pengusiran langsung dari pertandingan (sent off), baik akibat pelanggaran fatal maupun akumulasi dua kartu kuning. Jawabannya adalah Kartu merah."
  },
  {
    q: "Tendangan penalti diberikan jika pemain bertahan melakukan pelanggaran di dalam...",
    options: ["Kotak penalti sendiri", "Lingkaran tengah lapangan", "Area sudut lapangan"],
    a: 0,
    materi: "Pelanggaran langsung (direct free kick) yang dilakukan tim bertahan di dalam kotak 16 meter mereka sendiri berbuah tendangan penalti dari titik 11 meter. Jawabannya adalah Kotak penalti sendiri."
  }
]
        }
    },
    "Bahasa_Indonesia": {
        name: "Bahasa Indonesia",
        subCategories: {
            "Teks Prosedur": [
                { q: "Bagian awal dalam struktur teks prosedur berisi tentang...", options: ["Tujuan / Pengantar", "Langkah-langkah", "Penutup"], a: 0 ,materi: "Bagian awal teks prosedur menjelaskan hasil akhir yang akan dicapai setelah mengikuti seluruh panduan. Jawabannya adalah Tujuan / Pengantar. "},
                { q: "Kata yang berisi perintah dalam teks prosedur disebut kata...", options: ["Imperatif", "Nomina", "Adjektiva"], a: 0 ,materi: "Kata kerja yang dibentuk menggunakan akhiran -kan, -i, atau partikel -lah untuk memberikan perintah atau larangan disebut kata kerja perintah. Jawabannya adalah Imperatif."},
                { q: "Bagian akhir dari teks prosedur biasanya berisi...", options: ["Kesimpulan / Penutup", "Alat dan Bahan", "Tujuan"], a: 0 , materi: "Bagian akhir pada teks prosedur bersifat opsional dan biasanya berisi ucapan selamat mencoba atau penekanan ulang manfaat kegiatan. Jawabannya adalah Kesimpulan / Penutup."},
                { q: "Contoh kalimat imperatif adalah...", options: ["Masukkan air ke dalam gelas!", "Ibu memasak di dapur.", "Di mana letak buku itu?"], a: 0 ,materi: "Kalimat imperatif berfungsi untuk memerintah atau meminta seseorang melakukan sesuatu dan biasanya diakhiri tanda seru. Jawabannya adalah Masukkan air ke dalam gelas!."},
                { q: "Teks prosedur bertujuan untuk memberikan...", options: ["Panduan cara melakukan sesuatu", "Cerita khayalan", "Laporan kejadian"], a: 0 ,materi: "Fungsi utama teks prosedur adalah membantu pembaca memahami urutan kegiatan agar hasil yang dicapai tepat dan aman. Jawabannya adalah Panduan cara melakukan sesuatu."},
                { q: "Konjungsi penurutan waktu yang sering digunakan adalah...", options: ["Kemudian, lalu, setelah itu", "Tetapi, namun", "Karena, sebab"], a: 0 ,materi: "Kata penghubung temporal digunakan untuk mengurutkan tahapan kegiatan dari awal hingga akhir secara kronologis. Jawabannya adalah Kemudian, lalu, setelah itu."},
                { q: "Bagian tengah teks prosedur memuat...", options: ["Langkah-langkah kerja", "Judul teks", "Biodata penulis"], a: 0 ,materi: "Inti dari teks prosedur terletak pada bagian tengah yang menjabarkan tahapan kerja secara berurutan dan tidak boleh dibolak-balik. Jawabannya adalah Langkah-langkah kerja."},
                { q: "Kata 'potonglah' dan 'aduklah' termasuk jenis kata...", options: ["Verba / Perintah", "Nomina", "Pronomina"], a: 0 , materi: "Kata dasar 'potong' dan 'aduk' yang mendapat partikel -lah berubah fungsi menjadi kata kerja yang menyatakan tindakan perintah. Jawabannya adalah Verba / Perintah."},
                { q: "Ciri kebahasaan teks prosedur menggunakan kalimat...", options: ["Perintah (Imperatif)", "Tanya (Interogatif)", "Berita (Deklaratif)"], a: 0 ,materi: "Teks prosedur banyak memakai kalimat yang menginstruksikan pembaca untuk melakukan tindakan fisik secara langsung. Jawabannya adalah Perintah (Imperatif)."},
                { q: "Resep masakan merupakan salah satu contoh bentuk dari...", options: ["Teks Prosedur", "Teks Narasi", "Teks Deskripsi"], a: 0 ,materi: "Resep masakan menyajikan tujuan, daftar bahan, dan urutan langkah memasak yang terstruktur dengan jelas. Jawabannya adalah Prosedur."},
                { q: "Bagian yang mencantumkan takaran dan perlengkapan sebelum memulai langkah kerja disebut...", options: ["Alat dan bahan", "Tujuan", "Penegasan ulang", "Abstraksi"], a: 0, materi: "Pada teks prosedur membuat sesuatu, terdapat bagian khusus yang merinci perlengkapan dan takaran yang dibutuhkan. Jawabannya adalah Alat dan bahan." },
                { q: "Teks prosedur yang berisi langkah-langkah rumit dan terdiri dari banyak sub-langkah disebut teks prosedur...", options: ["Kompleks", "Sederhana", "Protokol", "Singkat"], a: 0, materi: "Jenis teks prosedur ini memuat banyak tahapan dan sub-tahapan yang saling berkaitan, misalnya prosedur pembuatan KTP atau SIM. Jawabannya adalah Kompleks." },
                { q: "Teks prosedur yang langkah-langkahnya boleh diubah urutannya asalkan tujuan akhirnya tetap tercapai disebut teks prosedur...", options: ["Protokol", "Kompleks", "Sederhana", "Imperatif"], a: 0, materi: "Teks prosedur ini memiliki langkah kerja yang fleksibel dan tidak terlalu ketat urutannya, misalnya cara memasak mi instan. Jawabannya adalah Protokol." },
                { q: "Kata bilangan yang menunjukkan urutan seperti 'pertama', 'kedua', dan 'ketiga' disebut...", options: ["Numeralia", "Adverbia", "Preposisi", "Interjeksi"], a: 0, materi: "Kata bilangan dipakai dalam teks prosedur untuk menandai urutan langkah secara jelas maupun menyebutkan jumlah takaran bahan. Jawabannya adalah Numeralia." },
                { q: "Keterangan yang menjelaskan cara melakukan suatu tindakan, seperti 'dengan perlahan' atau 'secara merata', disebut...", options: ["Adverbia cara", "Konjungsi syarat", "Verba tingkah laku", "Kalimat persuasif"], a: 0, materi: "Kata keterangan cara digunakan dalam teks prosedur untuk memperjelas bagaimana suatu langkah harus dikerjakan agar hasilnya maksimal. Jawabannya adalah Adverbia cara." }
            ],
            "Teks Laporan Hasil Observasi": [
                { q: "Teks laporan hasil observasi berisi penjabaran umum mengenai...", options: ["Objek berdasarkan fakta", "Khayalan penulis", "Opini pribadi"], a: 0 ,materi: "Teks laporan hasil observasi disusun berdasarkan pengamatan langsung terhadap suatu objek nyata tanpa rekayasa. Jawabannya adalah Objek berdasarkan fakta."},
                { q: "Struktur isi teks laporan hasil observasi terdiri atas...", options: ["Pernyataan umum dan anggota yang dilaporkan", "Tujuan dan penutup", "Orientasi dan krisis"], a: 0 ,materi: "Struktur inti teks ini diawali dengan klasifikasi umum lalu diikuti dengan perincian bagian atau aspek yang diamati. Jawabannya adalah Pernyataan umum dan anggota yang dilaporkan."},
                { q: "Ciri utama dari teks laporan hasil observasi adalah bersifat...", options: ["Objektif dan faktual", "Subjektif dan imajinatif", "Persuasif dan menghibur"], a: 0 ,materi: "Laporan hasil observasi harus disampaikan apa adanya sesuai data pengamatan di lapangan tanpa dipengaruhi perasaan pribadi. Jawabannya adalah Objektif dan faktual."},
                { q: "Bagian awal atau pembuka dalam teks laporan hasil observasi disebut...", options: ["Pernyataan umum / klasifikasi", "Deskripsi bagian", "Kesimpulan"], a: 0 , materi: "Bagian pembuka berfungsi memperkenalkan objek yang diamati beserta pengertian atau pengelompokannya secara garis besar. Jawabannya adalah Pernyataan umum / klasifikasi."},
                { q: "Bagian yang merinci isi atau aspek-aspek dari objek yang diamati dinamakan...", options: ["Deskripsi bagian", "Abstraksi", "Koda"], a: 0 ,materi: "Setelah klasifikasi umum, penulis menjabarkan ciri fisik, perilaku, habitat, atau rincian spesifik lainnya dari objek tersebut. Jawabannya adalah Deskripsi bagian."},
                { q: "Kata kerja yang sering digunakan dalam teks laporan hasil observasi adalah...", options: ["Verba penghubung (adalah, merupakan)", "Kata sifat ekstrem", "Kata tanya"], a: 0 ,materi: "Verba relasional atau kata kerja penghubung sering dipakai pada bagian definisi untuk menjelaskan pengertian suatu objek. Jawabannya adalah Verba penghubung (adalah, merupakan)."},
                { q: "Tujuan utama penulisan teks laporan hasil observasi adalah...", options: ["Memberikan informasi secara objektif", "Membujuk pembaca", "Menyampaikan cerita fiksi"], a: 0 ,materi: "Teks ini bertujuan menyampaikan pengetahuan atau fakta hasil pengamatan kepada pembaca secara sistematis dan akurat. Jawabannya adalah Memberikan informasi secara objektif."},
                { q: "Objek yang diamati dalam teks laporan hasil observasi harus bersifat...", options: ["Nyata / ada di dunia nyata", "Gaib / abstrak", "Rekayasa"], a: 0 ,materi: "Karena berbasis penelitian dan pengamatan indrawi, objek observasi wajib memiliki wujud nyata dan dapat dibuktikan kebenarannya. Jawabannya adalah Nyata / ada di dunia nyata."},
                { q: "Manakah yang merupakan contoh judul teks laporan hasil observasi?", options: ["Kehidupan Singa di Padang Rumput", "Kisah Kancil dan Buaya", "Liburanku yang Menyenangkan"], a: 0 ,materi: "Judul laporan hasil observasi bersifat informatif, netral, dan merujuk langsung pada objek faktual yang diteliti. Jawabannya adalah Kehidupan Singa di Padang Rumput."},
                { q: "Simpulan dalam teks laporan hasil observasi biasanya terletak di bagian...", options: ["Akhir teks", "Awal teks", "Tengah teks"], a: 0 ,materi: "Bagian penutup atau simpulan diletakkan di akhir tulisan untuk merangkum inti pengamatan atau manfaat dari objek yang dibahas. Jawabannya adalah Akhir teks."},
                { q: "Bagian yang menjelaskan kegunaan atau kelebihan dari objek yang diamati disebut...", options: ["Deskripsi manfaat", "Pernyataan umum", "Orientasi"], a: 0, materi: "Pada bagian akhir sebelum simpulan, penulis sering memaparkan fungsi atau manfaat objek tersebut bagi manusia maupun lingkungan. Jawabannya adalah Deskripsi manfaat."},
                { q: "Informasi dalam teks laporan hasil observasi didapatkan melalui kegiatan...", options: ["Pengamatan langsung dan pencatatan", "Berimajinasi di kamar", "Wawancara tokoh fiksi"], a: 0, materi: "Data yang akurat dalam laporan observasi hanya dapat diperoleh dengan cara mengamati objek secara langsung dan mencatat faktanya. Jawabannya adalah Pengamatan langsung dan pencatatan." },
                { q: "Kalimat yang berisi penjelasan pengertian suatu objek disebut kalimat...", options: ["Definisi", "Imperatif", "Interogatif"], a: 0, materi: "Kalimat definisi digunakan untuk memberikan batasan makna terhadap suatu istilah atau objek menggunakan kata 'adalah' atau 'ialah'. Jawabannya adalah Definisi."},
                { q: "Teks laporan hasil observasi disajikan secara sistematis, artinya...", options: ["Disusun secara urut dan teratur", "Ditulis secara acak", "Menggunakan bahasa gaul"], a: 0, materi: "Penyajian yang sistematis mengikuti urutan struktur dari umum ke khusus sehingga informasi mudah dipahami oleh pembaca. Jawabannya adalah Disusun secara urut dan teratur."},
                { q: "Bahasa yang digunakan dalam penulisan teks laporan hasil observasi adalah bahasa...", options: ["Baku dan ilmiah", "Santai dan puitis", "Kiasan dan bermakna ganda"], a: 0, materi: "Sebagai tulisan faktual yang bersifat informatif, laporan hasil observasi wajib menggunakan bahasa Indonesia yang baku dan lugas. Jawabannya adalah Baku dan ilmiah."}
            ],
            "Teks Ceramah": [
                { q: "Ceramah adalah pidato yang bertujuan untuk...", options: ["Memberikan nasihat dan petunjuk", "Menghibur penonton dengan komedi", "Berdebat dengan pendengar"], a: 0 ,materi: "Ceramah merupakan kegiatan berbicara di depan umum yang berfokus pada penyampaian wawasan, nilai kebaikan, dan nasihat kepada pendengar. Jawabannya adalah Memberikan nasihat dan petunjuk."},
                { q: "Struktur teks ceramah yang benar adalah...", options: ["Pendahuluan, isi, penutup", "Abstraksi, orientasi, krisis", "Tujuan, langkah-langkah, penutup"], a: 0 ,materi: "Secara umum, sistematika penyusunan teks ceramah terbagi menjadi tiga bagian utama yang runtut dari pembuka hingga akhir. Jawabannya adalah Pendahuluan, isi, penutup."},
                { q: "Bagian pendahuluan dalam teks ceramah berisi...", options: ["Salam pembuka, ucapan syukur, dan pengantar", "Kesimpulan materi", "Argumen pendukung"], a: 0 ,materi: "Pendahuluan berfungsi membangun kedekatan dengan audiens sekaligus memperkenalkan topik yang akan dibahas secara singkat. Jawabannya adalah Salam pembuka, ucapan syukur, dan pengantar."},
                { q: "Bagian isi ceramah memuat tentang...", options: ["Materi utama atau gagasan yang disampaikan", "Biodata penceramah", "Daftar pustaka"], a: 0 ,materi: "Bagian isi merupakan inti ceramah yang memaparkan pokok pembahasan, argumen, serta contoh-contoh yang mendukung topik. Jawabannya adalah Materi utama atau gagasan yang disampaikan."},
                { q: "Penutup teks ceramah biasanya berisi...", options: ["Kesimpulan, permohonan maaf, dan salam penutup", "Pertanyaan dari audiens", "Cerita lucu"], a: 0 ,materi: "Bagian akhir ceramah digunakan untuk merangkum pesan utama, menyampaikan harapan, meminta maaf atas kekhilafan, dan mengakhiri pembicaraan. Jawabannya adalah Kesimpulan, permohonan maaf, dan salam penutup."},
                { q: "Sifat bahasa yang digunakan dalam ceramah umumnya adalah...", options: ["Persuasif dan komunikatif", "Kaku dan baku sepenuhnya", "Kasar dan provokatif"], a: 0 ,materi: "Bahasa dalam ceramah harus mudah dipahami oleh pendengar yang beragam sekaligus mampu menyentuh hati agar pesan tersampaikan dengan baik. Jawabannya adalah Persuasif dan komunikatif."},
                { q: "Orang yang menyampaikan ceramah di depan umum disebut...", options: ["Penceramah / Da'i", "Moderator", "Notulen"], a: 0 ,materi: "Individu yang bertindak sebagai pembicara utama untuk memberikan wejangan atau informasi kepada khalayak ramai memiliki sebutan khusus. Jawabannya adalah Penceramah / Da'i."},
                { q: "Metode ceramah di mana pembicara membaca naskah secara lengkap disebut...", options: ["Metode naskah / manuskrip", "Metode impromptu", "Metode memoriter"], a: 0 ,materi: "Metode manuskrip sering dipakai dalam acara resmi agar tidak ada kata atau informasi penting yang terlewat saat berbicara. Jawabannya adalah Metode naskah / manuskrip."},
                { q: "Metode ceramah tanpa persiapan yang mengandalkan pengalaman disebut...", options: ["Impromptu (serta-merta)", "Ekstemporan", "Memoriter"], a: 0 ,materi: "Metode impromptu dilakukan secara mendadak tanpa naskah maupun catatan sehingga sangat bergantung pada wawasan dan jam terbang pembicara. Jawabannya adalah Impromptu (serta-merta)."},
                { q: "Kalimat yang digunakan untuk meyakinkan pendengar dalam ceramah bersifat...", options: ["Persuasif / ajakan", "Interogatif", "Perintah keras"], a: 0 ,materi: "Penceramah kerap memakai kata-kata seperti 'hendaknya', 'marilah', atau 'sebaiknya' untuk mendorong pendengar melakukan kebaikan. Jawabannya adalah Persuasif / ajakan."},
                { q: "Metode ceramah yang dilakukan dengan membawa catatan kecil berisi garis besar materi disebut...", options: ["Ekstemporan", "Manuskrip", "Memoriter"], a: 0, materi: "Metode ekstemporan membantu penceramah tetap fokus pada alur materi tanpa harus terpaku membaca seluruh teks secara kaku. Jawabannya adalah Ekstemporan."},
                { q: "Metode ceramah dengan cara menghafalkan seluruh teks yang telah disiapkan sebelumnya disebut...", options: ["Memoriter / hafalan", "Impromptu", "Ekstemporan"], a: 0, materi: "Pada metode memoriter, pembicara menulis naskah secara utuh lalu menghafalkannya kata demi kata sebelum tampil di depan umum. Jawabannya adalah Memoriter / hafalan."},
                { q: "Kata ganti orang pertama tunggal yang sering digunakan penceramah untuk merujuk dirinya sendiri adalah...",options: ["Saya atau aku", "Mereka", "Kalian"], a: 0, materi: "Penggunaan kata ganti orang pertama menunjukkan sudut pandang penceramah yang berbicara langsung di hadapan audiens. Jawabannya adalah Saya atau aku."},
                { q: "Kata sapaan yang tepat untuk menyapa pendengar di awal ceramah adalah...", options: ["Hadirin sekalian", "Hei kamu", "Para pembaca"], a: 0, materi: "Kata sapaan yang santun berfungsi menghormati audiens yang hadir sekaligus menarik perhatian mereka sebelum materi dimulai. Jawabannya adalah Hadirin sekalian."},
                { q: "Unsur terpenting yang harus diperhatikan agar ceramah tidak menyinggung pendengar adalah...", options: ["Etika dan kesantunan berbahasa", "Kecepatan berbicara", "Volume suara yang sangat keras"], a: 0, materi: "Penyampaian pesan dan nasihat harus menjaga perasaan audiens dengan menghindari ujaran kebencian maupun kata-kata yang merendahkan. Jawabannya adalah Etika dan kesantunan berbahasa."}
            ],
            "Resensi": [
                { q: "Resensi adalah sebuah tulisan yang berisi tentang...", options: ["Ulasan atau penilaian sebuah karya", "Laporan penelitian ilmiah", "Panduan cara memasak"], a: 0 ,materi: "Resensi berasal dari bahasa Latin 'revidere' atau 'recensere' yang berarti menimbang, melihat kembali, atau menilai mutu suatu karya. Jawabannya adalah Ulasan atau penilaian sebuah karya."},
                { q: "Unsur utama yang diulas dalam resensi buku adalah...", options: ["Kelebihan dan kekurangan buku", "Harga dan jumlah halaman saja", "Biografi lengkap pengarang"], a: 0 , materi: "Inti dari kegiatan meresensi adalah menimbang kualitas karya dengan memaparkan sisi keunggulan sekaligus kelemahannya secara berimbang. Jawabannya adalah Kelebihan dan kekurangan buku."},
                { q: "Struktur teks resensi umumnya meliputi...", options: ["Identitas karya, orientasi, sinopsis, analisis, evaluasi", "Pendahuluan, isi, penutup singkat", "Tujuan, bahan, langkah-langkah"], a: 0 ,materi: "Teks resensi disusun secara sistematis mulai dari data fisik karya, pengenalan, ringkasan isi, paparan unsur karya, hingga penilaian akhir. Jawabannya adalah Identitas karya, orientasi, sinopsis, analisis, evaluasi."},
                { q: "Bagian identitas buku dalam resensi mencakup...", options: ["Judul, pengarang, penerbit, tahun terbit, tebal", "Nama toko buku tempat membeli", "Warna sampul buku"], a: 0 , materi: "Data bibliografi atau identitas dicantumkan di bagian awal resensi agar pembaca mengetahui informasi dasar dan detail penerbitan karya tersebut. Jawabannya adalah Judul, pengarang, penerbit, tahun terbit, tebal."},
                { q: "Sinopsis dalam resensi berfungsi untuk...", options: ["Memberikan ringkasan isi cerita atau buku", "Menjatuhkan karya penulis", "Menambah jumlah halaman resensi"], a: 0 ,materi: "Sinopsis menyajikan gambaran umum alur cerita atau garis besar isi buku tanpa membocorkan bagian akhir secara berlebihan. Jawabannya adalah Memberikan ringkasan isi cerita atau buku."},
                { q: "Tujuan utama penulis membuat resensi adalah...", options: ["Memberikan pertimbangan kualitas buku kepada pembaca", "Mencari keuntungan penjualan", "Membuat cerita baru"], a: 0 , materi: "Resensi menjadi panduan bagi calon pembaca atau penonton dalam menentukan apakah suatu karya layak untuk dinikmati atau dibeli. Jawabannya adalah Memberikan pertimbangan kualitas buku kepada pembaca."},
                { q: "Penilaian dalam resensi harus bersifat...", options: ["Objektif berdasarkan isi karya", "Subjektif suka atau tidak suka", "Penuh rekayasa"], a: 0 ,materi: "Penulis resensi atau resensator wajib menilai karya secara adil berdasarkan bukti nyata di dalam karya, bukan sekadar sentimen pribadi. Jawabannya adalah Objektif berdasarkan isi karya."},
                { q: "Bagian yang menunjukkan nilai lebih dari suatu karya disebut...", options: ["Kelebihan buku", "Kekurangan buku", "Kesimpulan"], a: 0 ,materi: "Pada bagian analisis dan evaluasi, penulis menonjolkan daya tarik, keunikan, atau manfaat yang menjadi keunggulan karya tersebut. Jawabannya adalah Kelebihan buku."},
                { q: "Resensi dapat diterapkan pada karya berupa...", options: ["Buku, film, drama, dan musik", "Hanya buku pelajaran sekolah", "Catatan harian pribadi"], a: 0 , materi: "Objek resensi tidak terbatas pada karya tulis fiksi maupun nonfiksi, tetapi juga mencakup berbagai bentuk karya seni pertunjukan dan audio visual. Jawabannya adalah Buku, film, drama, dan musik."},
                { q: "Bahasa yang digunakan dalam menulis resensi harus bersifat...", options: ["Komunikatif dan informatif", "Sangat rumit", "Puitis berlebihan"], a: 0 ,materi: "Ulasan resensi ditujukan untuk khalayak luas sehingga bahasanya perlu jelas, lugas, dan mudah dipahami agar informasi penilaian tersampaikan. Jawabannya adalah Komunikatif dan informatif."},
                { q: "Orang yang menulis ulasan atau penilaian terhadap suatu karya disebut...", options: ["Resensator", "Narator", "Editor"], a: 0 ,materi: "Istilah khusus yang merujuk pada penulis atau pengulas dalam kegiatan meresensi sebuah buku maupun film adalah peresensi. Jawabannya adalah Resensator."},
                { q: "Bagian orientasi dalam teks resensi berisi tentang...", options: ["Pengenalan karya dan penghargaan yang pernah diraih", "Daftar bab dalam buku", "Kritik tajam terhadap penerbit"], a: 0 ,materi: "Orientasi berfungsi membuka ulasan dengan memperkenalkan latar belakang karya, reputasi pengarang, atau prestasi yang diraih karya tersebut. Jawabannya adalah Pengenalan karya dan penghargaan yang pernah diraih."},
                { q: "Bagian penutup resensi biasanya berisi rekomendasi yang ditujukan kepada...", options: ["Calon pembaca atau sasaran audiens", "Pencetak buku saja", "Tokoh dalam cerita"], a: 0 ,materi: "Di akhir resensi, penulis biasanya menyimpulkan kelayakan karya serta menyebutkan kelompok pembaca yang paling cocok menikmati karya tersebut. Jawabannya adalah Calon pembaca atau sasaran audiens."},
                { q: "Salah satu hal yang termasuk kekurangan buku nonfiksi dalam resensi adalah...", options: ["Banyak istilah asing tanpa penjelasan", "Alur cerita terlalu menegangkan", "Tokoh utama kurang menarik"], a: 0 ,materi: "Buku nonfiksi dinilai dari kejelasan penyampaian informasi dan sistematika penulisan, sehingga penggunaan istilah sulit tanpa glosarium menjadi kelemahan. Jawabannya adalah Banyak istilah asing tanpa penjelasan."},
                { q: "Langkah pertama yang harus dilakukan sebelum menulis resensi buku adalah...", options: ["Membaca dan memahami isi buku secara keseluruhan", "Langsung menulis kesimpulan", "Menyalin sinopsis di sampul belakang"], a: 0 ,materi: "Penilaian yang akurat dan objektif hanya dapat disusun setelah peresensi membaca tuntas dan mencatat poin-poin penting dari buku tersebut. Jawabannya adalah Membaca dan memahami isi buku secara keseluruhan."}
            ],
            "Teks Negosiasi": [
                { q: "Teks negosiasi adalah bentuk interaksi sosial yang bertujuan untuk...", options: ["Mencapai kesepakatan bersama", "Menimbulkan perdebatan", "Memaksa kehendak sebelah pihak"], a: 0 , materi: "Negosiasi dilakukan oleh dua pihak atau lebih yang memiliki kepentingan berbeda guna menemukan jalan tengah yang menguntungkan semua pihak. Jawabannya adalah Mencapai kesepakatan bersama."},
                { q: "Struktur teks negosiasi yang lazim dalam jual beli adalah...", options: ["Orientasi, pengajuan, penawaran, persetujuan, penutup", "Abstraksi, orientasi, krisis", "Tujuan, langkah-langkah, penutup"], a: 0 , materi: "Alur percakapan negosiasi dalam transaksi bisnis atau jual beli tersusun secara runtut dari pembukaan hingga tercapainya kesepakatan dan salam akhir. Jawabannya adalah Orientasi, pengajuan, penawaran, persetujuan, penutup."},
                { q: "Bagian awal yang berisi salam dan pembuka percakapan negosiasi disebut...", options: ["Orientasi", "Persetujuan", "Penutup"], a: 0 ,materi: "Orientasi menjadi tahap perkenalan atau basa-basi awal untuk mencairkan suasana sebelum masuk ke pokok pembicaraan. Jawabannya adalah Orientasi."},
                { q: "Bagian di mana pembeli menyampaikan permintaan barang atau jasa dinamakan...", options: ["Pengajuan", "Penawaran", "Krisis"], a: 0 ,materi: "Pada tahap pengajuan, salah satu pihak mulai mengutarakan maksud, kebutuhan, atau harga awal yang diinginkan kepada pihak lawan. Jawabannya adalah Pengajuan."},
                { q: "Proses tawar-menawar harga antara kedua belah pihak terjadi pada bagian...", options: ["Penawaran", "Persetujuan", "Orientasi"], a: 0 ,materi: "Tahap penawaran merupakan inti dari negosiasi, di mana masing-masing pihak saling mengajukan argumen dan kompromi hingga menemukan titik temu. Jawabannya adalah Penawaran."},
                { q: "Ciri kebahasaan dalam teks negosiasi ditandai dengan adanya...", options: ["Bahasa persuasif dan kesepakatan", "Kalimat perintah mutlak", "Kata-kata sarkasme"], a: 0 ,materi: "Negosiator menggunakan kalimat yang halus, membujuk, dan menunjukkan kesediaan berkompromi agar pihak lain bersedia menerima tawaran. Jawabannya adalah Bahasa persuasif dan kesepakatan."},
                { q: "Hasil akhir dari sebuah teks negosiasi yang sukses adalah...", options: ["Kesepakatan / mufakat", "Perpecahan", "Pembatalan transaksi"], a: 0 ,materi: "Keberhasilan negosiasi ditandai dengan tercapainya solusi menang-menang (win-win solution) yang disetujui secara sadar oleh kedua belah pihak. Jawabannya adalah Kesepakatan / mufakat."},
                { q: "Pihak yang melakukan negosiasi hendaknya bersikap...", options: ["Santun dan tidak merugikan pihak lain", "Egois", "Acuh tak acuh"], a: 0 ,materi: "Sikap saling menghargai dan bertutur kata sopan sangat diperlukan agar komunikasi berjalan lancar tanpa memicu konflik. Jawabannya adalah Santun dan tidak merugikan pihak lain."},
                { q: "Contoh nyata penerapan teks negosiasi dalam kehidupan sehari-hari adalah...", options: ["Tawar-menawar di pasar tradisional", "Membaca buku cerita di kamar", "Menonton bioskop sendiri"], a: 0 , materi: "Kegiatan transaksi jual beli di pasar melibatkan interaksi langsung antara penjual dan pembeli untuk menyepakati harga suatu barang. Jawabannya adalah Tawar-menawar di pasar tradisional."},
                { q: "Bagian penutup dalam teks negosiasi biasanya berisi...", options: ["Ucapan terima kasih dan salam", "Rangkuman materi pelajaran", "Biodata negosiator"], a: 0 ,materi: "Setelah kesepakatan tercapai dan transaksi selesai, percakapan diakhiri dengan ungkapan apresiasi dan salam perpisahan yang ramah. Jawabannya adalah Ucapan terima kasih dan salam."},
                { q: "Tahap ketika kedua belah pihak menyatakan sepakat atas hasil tawar-menawar disebut...", options: ["Persetujuan", "Pengajuan", "Orientasi"], a: 0 ,materi: "Bagian persetujuan menandai berakhirnya proses tawar-menawar karena kedua pihak telah menerima syarat atau harga yang disepakati bersama. Jawabannya adalah Persetujuan."},
                { q: "Pasangan tuturan yang sering muncul dalam dialog negosiasi adalah...", options: ["Menawarkan dan menerima/menolak tawaran", "Menyuruh dan membentak", "Mengejek dan membalas ejekan"], a: 0 ,materi: "Dialog negosiasi bersifat interaktif dua arah sehingga selalu memuat aksi dan reaksi berupa pengajuan tawaran serta tanggapan dari lawan bicara. Jawabannya adalah Menawarkan dan menerima/menolak tawaran."},
                { q: "Berikut ini yang merupakan contoh kalimat persuasif dalam negosiasi adalah...", options: ["Boleh kurang sedikit, Bu? Nanti saya beli dua.", "Pokoknya harus segini harganya!", "Kalau tidak mau ya sudah."], a: 0 ,materi: "Kalimat persuasif disampaikan dengan nada sopan dan memberikan alasan atau keuntungan tambahan untuk meluluhkan hati lawan bicara. Jawabannya adalah Boleh kurang sedikit, Bu? Nanti saya beli dua.."},
                { q: "Faktor utama yang menentukan keberhasilan suatu proses negosiasi adalah...", options: ["Kesediaan untuk berkompromi", "Suara yang paling lantang", "Mempertahankan ego masing-masing"], a: 0 ,materi: "Tanpa adanya kelonggaran atau kompromi dari kedua belah pihak, kesepakatan bersama akan sangat sulit terwujud. Jawabannya adalah Kesediaan untuk berkompromi."},
                { q: "Selain dalam bentuk dialog, teks negosiasi juga dapat disajikan dalam bentuk...", options: ["Surat penawaran niaga", "Puisi rakyat", "Cerita pendek"], a: 0 ,materi: "Dalam dunia bisnis formal, proses pengajuan dan penawaran kerja sama sering ditulis melalui surat resmi seperti surat permintaan dan surat penawaran barang. Jawabannya adalah Surat penawaran niaga."}
            ]
        }
    },
    "b_madura": {
        name: "Bahasa Madura",
        subCategories: {
            "madura halus": [
                { q: "Apa bahasa Maduranya 'makan' dalam tingkatan halus?", options: ["Ngakan", "Adhâ'âr", "Neka"], a: 1 ,materi: "Dalam tingkatan bahasa Madura halus (Engghi-Bhunten), kata 'ngakan' berubah menjadi bentuk yang lebih sopan untuk menghormati orang lain. Jawabannya adalah Adhâ'âr."},
                { q: "Apa bahasa Maduranya 'tidur' dalam ragam halus?", options: ["Asaren", "Kater tidur", "Pote"], a: 0 , materi: "Kata 'tedung' (tidur) merupakan ragam kasar/biasa, sedangkan dalam ragam halus digunakan istilah khusus yang sopan. Jawabannya adalah Asaren."},
                { q: "Kata 'bâ’na' dalam bahasa Madura artinya adalah...", options: ["Panjenengan", "Kaulâ", "Salèrana"], a: 0 ,materi: "Kata bâ'na termasuk dalam ragam biasa/akrab (Enjâ'-Îya) yang digunakan untuk menyebut lawan bicara sebaya atau lebih muda. Jawabannya adalah Panjenengan ."},
                { q: "Apa bahasa Maduranya 'terima kasih'?", options: ["Mator sakalangkong", "Salam santong", "Aje' aje'"], a: 0 ,materi: "Ungkapan standar dan sopan untuk menyampaikan rasa terima kasih dalam bahasa Madura adalah mator sakalangkong. Jawabannya adalah Mator sakalangkong."},
                { q: "Apa bahasa Maduranya 'rumah'?", options: ["Panggonan", "Bâḍâ", "Bengko"], a: 2 ,materi: "Dalam ragam biasa (Enjâ'-Îya), rumah disebut bengko (sedangkan dalam ragam halus disebut compo' atau dâlem). Jawabannya adalah Bengko."},
                { q: "Bahasa Madura halus untuk kata 'pergi' adalah...", options: ["Mangsah", "Olad", "Mole"], a: 0 ,materi: "Untuk menyatakan pergi atau berangkat secara sopan dalam ragam halus digunakan kata mangsah (berbeda dengan èntar pada ragam biasa). Jawabannya adalah Mangsah."},
                { q: "Apa arti kata 'Maju' dalam bahasa Indonesia?", options: ["Bhubhâr", "Majhu", "Rabu"], a: 1 ,materi: "Kata maju memiliki arti yang sama dalam bahasa Indonesia, yakni bergerak ke depan atau berkembang. Jawabannya adalah Majhu."},
                { q: "Bahasa Madura halus untuk kata 'melihat' adalah...", options: ["Ngeneng", "Meleng", "Mangsah"], a: 0 ,materi: "Untuk menghaluskan kata kerja melihat/memandang kepada lawan bicara yang dihormati, digunakan kata ngeneng (atau mèrsanè). Jawabannya adalah Ngeneng."},
                { q: "Apa arti kata 'Sore' dalam bahasa Madura?", options: ["Lemmal", "Soro", "Pagi"], a: 0 ,materi: "Penyebutan keterangan waktu sore pada opsi soal tersebut merujuk pada kata lemmal (dalam dialek umum sering juga disebut sorè). Jawabannya adalah Lemmal."},
                { q: "Tingkatan bahasa Madura yang paling halus disebut...", options: ["Engghi-Bhunten", "Enjâ'-Îya", "Biasa"], a: 0 ,materi: "Bahasa Madura memiliki tiga tingkatan utama, dan tingkatan tertinggi yang paling halus untuk menghormati orang tua atau tokoh adalah Èngghi-Bhunten. Jawabannya adalah Èngghi-Bhunten."},
                { q: "Bahasa Madura halus untuk kata 'saya' atau 'aku' adalah...", options: ["Kaulâ / abdina", "Sengko'", "Bâ'na"], a: 0 ,materi: "Untuk merendahkan diri dan menghormati lawan bicara dalam ragam Engghi-Bhunten, kata 'sengko'' diganti dengan kata ganti yang lebih halus. Jawabannya adalah Kaulâ / abdina."},
                { q: "Bahasa Madura halus untuk kata 'kamu' atau 'Anda' adalah...", options: ["Panjenengan / sampèyan", "Bâ'na", "Kake"], a: 0 ,materi: "Sapaan kepada orang kedua yang lebih tua atau baru dikenal menggunakan kata ganti yang menunjukkan rasa hormat. Jawabannya adalah Panjenengan / sampèyan."},
                { q: "Apa bahasa Madura halus untuk kata 'minum'?", options: ["Ngobhi", "Ngenom", "Adhâ'âr"], a: 0 ,materi: "Kata 'ngenom' (minum) merupakan ragam biasa, sedangkan dalam ragam halus (Engghi-Bhunten) digunakan istilah yang lebih santun. Jawabannya adalah Ngobhi."},
                { q: "Apa bahasa Madura halus untuk kata 'pulang'?", options: ["Paleman / kondur", "Mole", "Entar"], a: 0 ,materi: "Kata 'mole' (pulang) dalam bahasa Madura akrab berubah menjadi bentuk halus saat ditujukan kepada orang yang dihormati. Jawabannya adalah Paleman / kondur."},
                { q: "Ungkapan bahasa Madura yang digunakan untuk meminta maaf adalah...", options: ["Saporana", "Sakalangkong", "Engghi bhunten"], a: 0 ,materi: "Kata dasar 'sapora' berarti maaf, sehingga 'saporana' atau 'nyo'on sapora' digunakan untuk memohon maaf dengan sopan. Jawabannya adalah Saporana."}
            ]
        }
    },
    "b_inggris": {
        name: "Bahasa Inggris",
        subCategories: {
            "teks prosedur": [
                { q: "What is the social function of a procedure text?", options: ["To tell how to make or do something", "To describe a specific place", "To tell past experiences"], a: 0 ,materi: "Fungsi sosial dari procedure text adalah menjelaskan kepada pembaca cara membuat atau melakukan sesuatu melalui urutan langkah yang jelas. Jawabannya adalah To tell how to make or do something."},
                { q: "What is the first generic structure of a procedure text?", options: ["Goal / Aim", "Materials", "Steps"], a: 0 ,materi: "Struktur umum pertama pada procedure text terletak di bagian judul atau pembuka yang menyatakan tujuan akhir dari kegiatan yang akan dilakukan. Jawabannya adalah Goal / Aim."},
                { q: "What tense is mostly used in procedure texts?", options: ["Simple Present Tense", "Simple Past Tense", "Present Continuous"], a: 0 ,materi: "Procedure text menggunakan bentuk waktu dasar (kata kerja bentuk pertama / V1) karena menyatakan instruksi atau fakta tindakan secara langsung. Jawabannya adalah Simple Present Tense."},
                { q: "Words like 'First', 'Second', 'Next', and 'Finally' are called...", options: ["Connectives / Temporal Conjunctions", "Adjectives", "Pronouns"], a: 0 ,materi: "Kata penghubung urutan waktu dipakai untuk menyusun tahapan langkah-langkah agar runtut dari awal hingga akhir. Jawabannya adalah Connectives / Temporal Conjunctions."},
                { q: "Which one is an example of an imperative sentence?", options: ["Cut the paper into two pieces.", "You can cut the paper.", "She cuts the paper."], a: 0 ,materi: "Kalimat perintah (imperative sentence) dalam bahasa Inggris selalu diawali langsung oleh kata kerja dasar (bare infinitive) tanpa subjek di depannya. Jawabannya adalah Cut the paper into two pieces."},
                { q: "What section lists the ingredients or tools needed?", options: ["Materials / Equipment", "Goal", "Resolution"], a: 0 ,materi: "Bagian kedua dalam struktur procedure text berisi daftar bahan makanan maupun peralatan yang harus disiapkan sebelum memulai langkah kerja. Jawabannya adalah Materials / Equipment."},
                { q: "Which of these is a recipe an example of?", options: ["Procedure Text", "Narrative Text", "Recount Text"], a: 0 ,materi: "Resep masakan atau minuman memuat tujuan, daftar bahan, serta urutan cara pembuatan sehingga termasuk jenis teks prosedur. Jawabannya adalah Procedure Text."},
                { q: "What does 'Add' mean in Indonesian?", options: ["To put in", "To cut", "To stir"], a: 0 , materi: "Kata kerja 'add' sering muncul dalam instruksi resep untuk meminta pembaca memasukkan bahan tambahan ke dalam adonan atau wadah. Jawabannya adalah To put in."},
                { q: "What does 'Stir well' mean?", options: ["Mix evenly", "Boil until cooked", "Cut into small pieces"], a: 0 ,materi: "Kata 'stir' berarti mengaduk, sedangkan kata keterangan 'well' menunjukkan cara melakukannya dengan baik hingga tercampur merata. Jawabannya adalah Mix evenly."},
                { q: "Which sentence uses action verbs?", options: ["Pour the water into the glass.", "The water is cold.", "Water is good."], a: 0 ,materi: "Action verb adalah kata kerja yang menunjukkan tindakan fisik secara nyata seperti menuangkan (pour), memotong, atau mencampur. Jawabannya adalah Pour the water into the glass."},
                { q: "What is the last part of a procedure text structure?", options: ["Steps / Methods", "Orientation", "Complication"], a: 0 ,materi: "Setelah tujuan dan bahan dijelaskan, bagian penutup utama pada procedure text adalah urutan langkah pengerjaan dari awal sampai selesai. Jawabannya adalah Steps / Methods."},
                { q: "Which word is an adverb of manner commonly found in recipes?", options: ["Slowly", "Knife", "Bowl"], a: 0, materi: "Adverb of manner digunakan untuk menjelaskan cara melakukan suatu tindakan, dan biasanya berakhiran -ly seperti 'slowly' (secara perlahan) atau 'carefully'. Jawabannya adalah Slowly."},
                { q: "What does 'Boil the water for 5 minutes' mean?", options: ["Heat the water until it bubbles for 5 minutes", "Cool the water for 5 minutes", "Pour out the water after 5 minutes"], a: 0, materi: "Kata kerja 'boil' berarti merebus hingga mendidih, diikuti keterangan durasi waktu pengerjaan. Jawabannya adalah Rebus air selama 5 menit."},
                { q: "Which of the following is NOT a procedure text?", options: ["A fairy tale about Cinderella", "How to use a washing machine", "How to make fried rice"], a: 0, materi: "Dongeng atau cerita rakyat seperti Cinderella termasuk dalam Narrative Text yang bertujuan menghibur, bukan memberikan panduan langkah kerja. Jawabannya adalah A fairy tale about Cinderella."},
                { q: "What does 'Peel the onion' mean?", options: ["Remove the outer skin of the onion", "Fry the onion", "Chop the onion"], a: 0, materi: "Kata kerja 'peel' digunakan dalam instruksi memasak untuk perintah mengupas kulit buah atau sayuran. Jawabannya adalah Kupas bawangnya."}
            ]
        }
    },
    "pendidikan_pancasila": {
        name: "Pendidikan Pancasila",
        subCategories: {
            "UUD 1945": [
                { q: "Pembukaan UUD 1945 terdiri dari berapa alinea?", options: ["4 alinea", "3 alinea", "5 alinea"], a: 0 ,materi: "Pembukaan Undang-Undang Dasar 1945 memuat pokok-pokok pikiran fundamental negara yang tersusun secara runtut dalam empat bagian paragraf atau alinea. Jawabannya adalah 4 alinea."},
                { q: "Dasar negara Republik Indonesia adalah...", options: ["Pancasila", "UUD 1945", "Bhinneka Tunggal Ika"], a: 0 , materi: "Pancasila merupakan sumber dari segala sumber hukum dan pandangan hidup bangsa yang tercantum secara sah di dalam alinea keempat Pembukaan UUD 1945. Jawabannya adalah Pancasila."},
                { q: "Sila pertama Pancasila berbunyi...", options: ["Ketuhanan Yang Maha Esa", "Kemanusiaan yang adil dan beradab", "Persatuan Indonesia"], a: 0 ,materi: "Sila pertama menjadi landasan moral dan spiritual bangsa Indonesia yang menjamin kebebasan beragama serta bertakwa kepada Tuhan. Jawabannya adalah Ketuhanan Yang Maha Esa."},
                { q: "Lambang sila ke-4 Pancasila adalah...", options: ["Kepala Banteng", "Pohon Beringin", "Padi dan Kapas"], a: 0 ,materi: "Banteng merupakan hewan sosial yang suka berkumpul, sehingga melambangkan budaya musyawarah untuk mufakat dalam mengambil keputusan bersama. Jawabannya adalah Kepala Banteng."},
                { q: "Bhinneka Tunggal Ika memiliki arti...", options: ["Berbeda-beda tetapi tetap satu jua", "Bersatu kita teguh", "Bersama kita bisa"], a: 0 ,materi: "Semboyan negara yang dikutip dari kitab Sutasoma karya Mpu Tantular ini menegaskan bahwa keberagaman suku, agama, dan budaya tetap menyatu dalam bingkai NKRI. Jawabannya adalah Berbeda-beda tetapi tetap satu jua."},
                { q: "Negara Indonesia adalah negara hukum tercantum dalam UUD 1945 pasal...", options: ["Pasal 1 ayat (3)", "Pasal 27", "Pasal 30"], a: 0 ,materi: "Ketentuan hasil amandemen UUD 1945 ini menegaskan bahwa seluruh penyelenggaraan pemerintahan dan kehidupan bernegara harus tunduk pada aturan hukum, bukan kekuasaan semata. Jawabannya adalah Pasal 1 ayat (3)."},
                { q: "Lagu kebangsaan Indonesia adalah...", options: ["Indonesia Raya", "Garuda Pancasila", "Halo-Halo Bandung"], a: 0 ,materi: "Berdasarkan Pasal 36B UUD 1945, lagu ciptaan Wage Rudolf Supratman yang pertama kali dikumandangkan pada Kongres Pemuda II ditetapkan sebagai lagu kebangsaan. Jawabannya adalah Indonesia Raya."},
                { q: "Hari Kesaktian Pancasila diperingati setiap tanggal...", options: ["1 Oktober", "1 Juni", "17 Agustus"], a: 0 ,materi: "Peringatan ini ditetapkan untuk mengenang keberhasilan bangsa Indonesia mempertahankan ideologi Pancasila dari ancaman pemberontakan G30S/PKI pada tahun 1965. Jawabannya adalah 1 Oktober."},
                { q: "Badan yang merumuskan Pancasila adalah...", options: ["BPUPKI", "PPKI", "KNIP"], a: 0 ,materi: "Badan Penyelidik Usaha-usaha Persiapan Kemerdekaan Indonesia (BPUPKI) menggelar sidang pertama pada 29 Mei hingga 1 Juni 1945 khusus untuk merumuskan dasar negara. Jawabannya adalah BPUPKI."},
                { q: "Bentuk negara Indonesia berdasarkan UUD 1945 adalah...", options: ["Republik / Kesatuan", "Serikat", "Kerajaan"], a: 0 , materi: "Pasal 1 ayat (1) UUD 1945 menyatakan secara tegas bahwa Negara Indonesia ialah Negara Kesatuan yang berbentuk Republik. Jawabannya adalah Republik / Kesatuan."},
                { q: "UUD 1945 disahkan sebagai konstitusi negara oleh PPKI pada tanggal...", options: ["18 Agustus 1945", "17 Agustus 1945", "1 Juni 1945"], a: 0, materi: "Sehari setelah proklamasi kemerdekaan, Panitia Persiapan Kemerdekaan Indonesia (PPKI) bersidang untuk mengesahkan UUD 1945 serta memilih Presiden dan Wakil Presiden. Jawabannya adalah 18 Agustus 1945."},
                { q: "Kedaulatan berada di tangan rakyat dan dilaksanakan menurut Undang-Undang Dasar diatur dalam...", options: ["Pasal 1 ayat (2) UUD 1945", "Pasal 2 ayat (1) UUD 1945", "Pasal 3 ayat (1) UUD 1945"], a: 0, materi: "Pasal ini menegaskan prinsip demokrasi konstitusional di Indonesia, di mana kekuasaan tertinggi berada di tangan rakyat dan dijalankan sesuai aturan konstitusi. Jawabannya adalah Pasal 1 ayat (2) UUD 1945."},
                { q: "Bagian UUD 1945 yang tidak boleh diubah oleh siapa pun termasuk MPR adalah...", options: ["Pembukaan UUD 1945", "Pasal tentang pemerintahan daerah", "Aturan Peralihan"], a: 0, materi: "Mengubah Pembukaan UUD 1945 sama artinya dengan membubarkan Negara Kesatuan Republik Indonesia karena di dalamnya termuat Pancasila dan tujuan berdirinya negara. Jawabannya adalah Pembukaan UUD 1945."},
                { q: "Bendera Negara Indonesia ialah Sang Merah Putih tercantum dalam UUD 1945 pasal...", options: ["Pasal 35", "Pasal 36", "Pasal 36A"], a: 0, materi: "Bab XV UUD 1945 mengatur tentang atribut kenegaraan, dan pasal pertamanya secara khusus menetapkan bendera negara Sang Merah Putih. Jawabannya adalah Pasal 35."},
                { q: "Setiap warga negara berhak mendapat pendidikan tercantum dalam UUD 1945 pasal...", options: ["Pasal 31 ayat (1)", "Pasal 28A", "Pasal 33 ayat (1)"], a: 0, materi: "Konstitusi menjamin hak dasar setiap warga negara untuk memperoleh pengajaran dan pendidikan guna mencerdaskan kehidupan bangsa. Jawabannya adalah Pasal 31 ayat (1)."}
            ]
        }
    }
};

let currentCategory = '';      
let currentSubCategory = '';   
let currentLevel = 0;  
let currentQuestionIndex = 0;
let correctAnswers = 0;
let wrongAnswers = 0;
let initialScore = 0;

const QUESTIONS_PER_LEVEL = 3;

// Menyimpan level tertinggi yang sudah terbuka
let unlockedLevels = {};        

// 1. Dipanggil saat tombol Mapel ditekan

// 1. Dipanggil saat tombol Mapel ditekan
function selectCategory(cat) {
    currentCategory = cat;
    const subjectData = quizData[cat];

    if (!subjectData) {
        console.error("Data mapel tidak ditemukan untuk key:", cat);
        return;
    }

    const titleEl = document.getElementById('category-title');
    if (titleEl) {
        titleEl.innerText = "Pilih Kategori: " + subjectData.name.toUpperCase();
    }

    const btnContainer = document.getElementById('level-buttons');
    if (!btnContainer) return;
    btnContainer.innerHTML = '';

    // Mengatur tombol Sub Category menjadi vertikal
    btnContainer.style.display = 'flex';
    btnContainer.style.flexDirection = 'column';
    btnContainer.style.alignItems = 'stretch';
    btnContainer.style.gap = '12px';
    btnContainer.style.width = '100%';

    for (let subCatName in subjectData.subCategories) {
        const btn = document.createElement('button');
        btn.className = 'btn btn-level';
        btn.innerText = subCatName;

        btn.style.width = '100%';
        btn.style.display = 'block';

        btn.onclick = () => selectSubCategory(subCatName);
        btnContainer.appendChild(btn);
    }

    showScreen('level-menu');
}

// 2. Dipanggil saat Sub-Kategori dipilih (Membuat tombol Level)
function selectSubCategory(subCatName) {

    currentSubCategory = subCatName;

    const questionsList =
        quizData[currentCategory].subCategories[subCatName];

    const progressKey =
        `${currentCategory}_${currentSubCategory}`;

    const maxUnlocked =
        Number(unlockedLevels[progressKey] ?? 0);

    const totalLevels = Math.ceil(
        questionsList.length / QUESTIONS_PER_LEVEL
    );

    document.getElementById('category-title').innerText =
        "Level: " + subCatName.toUpperCase();

    const btnContainer =
        document.getElementById('level-buttons');

    btnContainer.innerHTML = '';

    for (let index = 0; index < totalLevels; index++) {

        const btn = document.createElement('button');

        btn.className = 'btn btn-level';

        if (index <= maxUnlocked) {

            btn.innerText = "⭐ Level " + (index + 1);

            btn.disabled = false;

            btn.onclick = () => startQuiz(index);

        } else {

            btn.innerText = "🔒 Level " + (index + 1);

            btn.disabled = true;
        }

        btnContainer.appendChild(btn);
    }

    showScreen('level-menu');
}



// 3. Memulai Kuis (Menampilkan Skor Mapel Secara Langsung di Layar)
function startQuiz(levelIndex) {

    currentLevel = levelIndex;
    currentQuestionIndex = 0;

    if (levelIndex === 0) {
        correctAnswers = 0;
        wrongAnswers = 0;
        initialScore = totalScore;
    }

    renderQuestion();
}
function renderQuestion() {

    const questionsList =
        quizData[currentCategory].subCategories[currentSubCategory];

    const questionIndex =
        (currentLevel * 3) + currentQuestionIndex;

    const data = questionsList[questionIndex];

    if (!data) {
        console.error("Soal tidak ditemukan:", questionIndex);
        return;
    }

    document.getElementById('quiz-category-text').innerText =
        quizData[currentCategory].name + " > " + currentSubCategory;

    document.getElementById('quiz-level-text').innerText =
        `Level ${currentLevel + 1} | Soal ${currentQuestionIndex + 1}/3`;

    document.getElementById('question-text').innerText = data.q;

    const optionsContainer =
    document.getElementById('options-container');

optionsContainer.innerHTML = '';

data.options.forEach((opt, idx) => {

    const btn = document.createElement("button");

    btn.type = "button";
    btn.className = "btn option-btn";
    btn.disabled = false;

    btn.textContent =
        String.fromCharCode(65 + idx) + ". " + opt;

    btn.onclick = function(event) {
        event.preventDefault();
        answerQuiz(idx);
    };

    optionsContainer.appendChild(btn);
});

    updateQuizScore();

    showScreen('quiz-screen');
}

// 4. Mengecek Jawaban, Menghitung Skor & Pengurangan saat Salah


function loadProgress() {
    try {
        const saved = localStorage.getItem("unlockedLevels");
        unlockedLevels = saved ? JSON.parse(saved) : {};

        if (!unlockedLevels || typeof unlockedLevels !== "object") {
            unlockedLevels = {};
        }
    } catch (error) {
        console.error("Gagal memuat progres:", error);
        unlockedLevels = {};
    }
}

function saveProgress() {
    try {
        localStorage.setItem(
            "unlockedLevels",
            JSON.stringify(unlockedLevels)
        );
    } catch (error) {
        console.error("Gagal menyimpan progres:", error);
    }
}



async function unlockNextLevel() {

    const progressKey =
        `${currentCategory}_${currentSubCategory}`;

    const currentUnlocked =
        Number(unlockedLevels[progressKey] || 0);

    unlockedLevels[progressKey] = Math.max(
        currentUnlocked,
        currentLevel + 1
    );

    saveProgress();

    await updatePlayerScore();
}

function saveProgress() {
    try {
        localStorage.setItem(
            "unlockedLevels",
            JSON.stringify(unlockedLevels)
        );
    } catch (error) {
        console.error("Gagal menyimpan progres:", error);
    }
}

function resetAllLevels() {
    document.getElementById('reset-level-popup')
        .classList.add('show');
}

function closeResetLevel() {
    document.getElementById('reset-level-popup')
        .classList.remove('show');
}

function closeResetLevelSuccess() {
    document.getElementById("reset-level-success")
        .classList.remove("show");
}

async function executeResetScore() {

    closeResetConfirm();

    totalScore = 0;

    for (let key in subjectScores) {
        subjectScores[key] = 0;
    }

    await updatePlayerScore();

    showLeaderboard();

    document.getElementById(
        "reset-success-popup"
    ).classList.add("show");
}

function updateQuizScore() {
    const subjectScoreEl =
        document.getElementById('quiz-subject-score');

    const totalScoreEl =
        document.getElementById('quiz-total-score');

    if (subjectScoreEl) {
        subjectScoreEl.innerText =
            subjectScores[currentCategory];
    }

    if (totalScoreEl) {
        totalScoreEl.innerText = totalScore;
    }
}




function showSuccessPopup(callback) {
    nextQuizAction = callback;

    document.getElementById('success-popup')
        .classList.add('show');
}

function closeSuccessPopup() {
    document.getElementById('success-popup')
        .classList.remove('show');

    if (nextQuizAction) {
        const action = nextQuizAction;
        nextQuizAction = null;
        action();
    }
}

function showWrongPopup() {
    document.getElementById('wrong-popup')
        .classList.add('show');
}

function closeWrongPopup() {
    const popup = document.getElementById("wrong-popup");

    if (popup) {
        popup.classList.remove("show");
    }

    const questionsList =
        quizData[currentCategory]?.subCategories[currentSubCategory];

    if (!questionsList) return;

    const questionIndex =
        currentLevel * QUESTIONS_PER_LEVEL + currentQuestionIndex;

    // Soal terakhir dalam seluruh kategori
    if (questionIndex >= questionsList.length - 1) {
        unlockNextLevel();
        showFinalResult();
        return;
    }

    // Level sudah menyelesaikan tiga soal
    if (currentQuestionIndex >= QUESTIONS_PER_LEVEL - 1) {
        unlockNextLevel();
        selectSubCategory(currentSubCategory);
        return;
    }

    // Lanjut ke soal berikutnya
    currentQuestionIndex++;
    renderQuestion();
}

function answerQuiz(selectedIndex) {

    const questionsList =
        quizData[currentCategory].subCategories[currentSubCategory];

    const questionIndex =
        (currentLevel * QUESTIONS_PER_LEVEL) + currentQuestionIndex;

    const data = questionsList[questionIndex];

    if (!data) return;

    const buttons =
        document.querySelectorAll('#options-container button');

    // Cegah jawaban diklik berkali-kali
    buttons.forEach(btn => btn.disabled = true);

    if (selectedIndex === data.a) {

        correctAnswers++;

        playSound("correct");

        totalScore += 10;
        subjectScores[currentCategory] += 10;

        updateQuizScore();
        updatePlayerScore();

        if (
            currentQuestionIndex === 2 ||
            questionIndex === questionsList.length - 1
        ) {

            unlockNextLevel();

            showSuccessPopup(() => {

                const nextLevel = currentLevel + 1;

                if (nextLevel * QUESTIONS_PER_LEVEL < questionsList.length) {
                    selectSubCategory(currentSubCategory);
                } else {
                    showFinalResult();
                }

            });

        } else {

            showSuccessPopup(() => {
                currentQuestionIndex++;
                renderQuestion();
            });

        }

    } else {

        wrongAnswers++;

        playSound("wrong");

        totalScore -= 5;
        subjectScores[currentCategory] -= 5;

        updateQuizScore();
        updatePlayerScore();

        showWrongPopup(data);

    }
}



function showWrongPopup(data) {

    document.getElementById("correction-question").textContent = data.q;

    document.getElementById("correction-answer").textContent =
        String.fromCharCode(65 + data.a) + ". " + data.options[data.a];

    document.getElementById("correction-material").textContent =
        data.materi ||
        "Pelajari kembali materi terkait soal ini agar lebih memahami jawaban yang benar.";

    document.getElementById("wrong-popup").classList.add("show");
}



function closeWrongPopup() {

    const popup = document.getElementById("wrong-popup");

    if (popup) {
        popup.classList.remove("show");
    }

    const questionsList =
        quizData[currentCategory].subCategories[currentSubCategory];

    const questionIndex =
        (currentLevel * QUESTIONS_PER_LEVEL) + currentQuestionIndex;

    // Jika soal terakhir
    if (questionIndex === questionsList.length - 1) {

        showFinalResult();
        return;

    }

    // Jika tiga soal dalam level sudah selesai
    if (currentQuestionIndex === 2) {

        selectSubCategory(currentSubCategory);
        return;

    }

    // Lanjut ke soal berikutnya
    currentQuestionIndex++;

    renderQuestion();
}


function showFinalResult() {

    const questionsList =
        quizData[currentCategory].subCategories[currentSubCategory];

    const totalQuestions = questionsList.length;

    const percentage = Math.round(
        (correctAnswers / totalQuestions) * 100
    );

    const scoreObtained = totalScore - initialScore;

    alert(
        "🏆 HASIL AKHIR KUIS 🏆\n\n" +
        "Mata Pelajaran: " + quizData[currentCategory].name + "\n" +
        "Kategori: " + currentSubCategory + "\n\n" +
        "Jumlah Soal: " + totalQuestions + "\n" +
        "Jawaban Benar: " + correctAnswers + "\n" +
        "Jawaban Salah: " + wrongAnswers + "\n\n" +
        "Nilai Akhir: " + percentage + "\n" +
        "Total Poin: " + scoreObtained + "\n\n" +
        "Terima kasih sudah bermain!"
    );

    showScreen("main-menu");
}

function showCorrectionPopup(data) {

    document.getElementById(
        "correction-question"
    ).textContent = data.q;

    document.getElementById(
        "correction-answer"
    ).textContent =
        String.fromCharCode(65 + data.a) +
        ". " + data.options[data.a];

    document.getElementById(
        "correction-material"
    ).textContent =
        data.materi ||
        "Pelajari kembali materi tentang soal ini agar lebih memahami jawaban yang benar.";

    document.getElementById(
        "correction-popup"
    ).classList.add("show");
}


function closeCorrectionPopup() {

    document.getElementById("correction-popup")
        .classList.remove("show");

    const questionsList =
        quizData[currentCategory].subCategories[currentSubCategory];

    const questionIndex =
        (currentLevel * 3) + currentQuestionIndex;

    if (questionIndex === questionsList.length - 1) {

        showFinalResult();

    } else if (currentQuestionIndex === 2) {

        selectSubCategory(currentSubCategory);
        showScreen("level-menu");

    } else {

        currentQuestionIndex++;

        renderQuestion();

        // Aktifkan kembali tombol jawaban
        document.querySelectorAll("#options-container button")
            .forEach(btn => btn.disabled = false);
    }
}

// ==================================
// INISIALISASI GAME
// ==================================

document.addEventListener("DOMContentLoaded", async function () {

    loadProgress();

    showScreen("player-screen");

    await initializeOnlineGame();

});


// Memuat progres lokal
loadProgress();

// Jangan langsung membuka kategori.
// Tampilkan halaman identitas terlebih dahulu.
showScreen("player-screen");

// Persiapkan Firebase di belakang layar.
initializeOnlineGame();
