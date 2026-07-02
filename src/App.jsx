import { useState, useEffect, useMemo } from "react";
import { supabase } from "./supabaseClient";

// ---------- Configuration ----------
const CRITERES = [
{ id: "etat", col: "note_etat", label: "État réel du logement" },
{ id: "bruit", col: "note_bruit", label: "Calme / isolation phonique" },
{ id: "gestion", col: "note_gestion", label: "Gestion & réactivité" },
{ id: "depot", col: "note_depot", label: "Restitution du dépôt de garantie" },
{ id: "prix", col: "note_prix", label: "Rapport qualité / prix" },
];

const TYPES = ["Tous", "Résidence privée", "CROUS", "Particulier"];

// ---------- Helpers de notation ----------
const noteAvis = (a) =>
CRITERES.reduce((s, c) => s + a[c.col], 0) / CRITERES.length;

const moyenneCritere = (avis, col) =>
avis.length ? avis.reduce((s, a) => s + a[col], 0) / avis.length : null;

const noteGlobale = (avis) =>
avis.length ? avis.reduce((s, a) => s + noteAvis(a), 0) / avis.length : null;

const lettre = (n) => (n >= 4.5 ? "A" : n >= 3.5 ? "B" : n >= 2.5 ? "C" : n >= 1.5 ? "D" : "E");
const LETTRE_STYLE = {
A: "bg-green-600", B: "bg-lime-500", C: "bg-yellow-500", D: "bg-orange-500", E: "bg-red-600",
};
const barCouleur = (n) =>
n >= 4 ? "bg-green-500" : n >= 3 ? "bg-lime-500" : n >= 2 ? "bg-orange-400" : "bg-red-500";

// ---------- Petits composants ----------
function Etiquette({ note, taille = "grande" }) {
if (note === null || note === undefined)
return (
<div className={`${taille === "grande" ? "w-14 h-14 text-xs" : "w-9 h-9 text-[10px]"} rounded-lg bg-slate-200 text-slate-500 flex items-center justify-center font-bold text-center leading-tight shrink-0`}>
Pas<br />d'avis
</div>
);
const l = lettre(note);
return (
<div className={`${taille === "grande" ? "w-14 h-14" : "w-9 h-9"} rounded-lg ${LETTRE_STYLE[l]} text-white flex flex-col items-center justify-center font-extrabold shadow-sm shrink-0`}>
<span className={taille === "grande" ? "text-2xl leading-none" : "text-base leading-none"}>{l}</span>
{taille === "grande" && <span className="text-[10px] font-semibold opacity-90">{note.toFixed(1)}/5</span>}
</div>
);
}

function BarreCritere({ label, valeur }) {
return (
<div className="flex items-center gap-2">
<span className="text-xs text-slate-600 w-44 shrink-0">{label}</span>
<div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
{valeur !== null && (
<div className={`h-full rounded-full ${barCouleur(valeur)}`} style={{ width: `${(valeur / 5) * 100}%` }} />
)}
</div>
<span className="text-xs font-semibold text-slate-700 w-8 text-right">
{valeur === null ? "—" : valeur.toFixed(1)}
</span>
</div>
);
}

function Etoiles({ valeur, onChange }) {
return (
<div className="flex gap-1">
{[1, 2, 3, 4, 5].map((n) => (
<button
key={n}
type="button"
onClick={() => onChange(n)}
className={`text-xl leading-none ${n <= valeur ? "text-yellow-500" : "text-slate-300"} hover:scale-110 transition-transform`}
aria-label={`${n} sur 5`}
>
★
</button>
))}
</div>
);
}

// ---------- Application ----------
export default function App() {
const [logements, setLogements] = useState([]);
const [chargement, setChargement] = useState(true);
const [erreur, setErreur] = useState(null);

const [recherche, setRecherche] = useState("");
const [type, setType] = useState("Tous");
const [tri, setTri] = useState("note");
const [detail, setDetail] = useState(null);
const [formOuvert, setFormOuvert] = useState(false);
const [confirmation, setConfirmation] = useState(false);
const [envoiEnCours, setEnvoiEnCours] = useState(false);

const [fLogement, setFLogement] = useState("");
const [fAuteur, setFAuteur] = useState("");
const [fNotes, setFNotes] = useState({ etat: 0, bruit: 0, gestion: 0, depot: 0, prix: 0 });
const [fTexte, setFTexte] = useState("");
const [fCertif, setFCertif] = useState(false);

async function charger() {
setChargement(true);
setErreur(null);
const { data: logs, error: e1 } = await supabase
.from("logements")
.select("*")
.order("nom");
const { data: avisData, error: e2 } = await supabase
.from("avis")
.select("*");

if (e1 || e2) {
setErreur("Impossible de charger les données. Réessaie dans un instant.");
setChargement(false);
return;
}
const parLogement = {};
(avisData || []).forEach((a) => {
(parLogement[a.logement_id] = parLogement[a.logement_id] || []).push(a);
});
setLogements((logs || []).map((l) => ({ ...l, avis: parLogement[l.id] || [] })));
setChargement(false);
}

useEffect(() => {
charger();
}, []);

const resultats = useMemo(() => {
let liste = logements.filter((r) => {
const mNom = r.nom.toLowerCase().includes(recherche.toLowerCase());
const mType = type === "Tous" || r.type === type;
return mNom && mType;
});
return [...liste].sort((a, b) => {
if (tri === "note") return (noteGlobale(b.avis) ?? -1) - (noteGlobale(a.avis) ?? -1);
if (tri === "avis") return b.avis.length - a.avis.length;
return a.nom.localeCompare(b.nom, "fr");
});
}, [logements, recherche, type, tri]);

const formValide =
fLogement && fAuteur.trim() && fTexte.trim().length >= 30 && fCertif &&
CRITERES.every((c) => fNotes[c.id] > 0);

async function envoyerAvis() {
if (!formValide || envoiEnCours) return;
setEnvoiEnCours(true);
const { error } = await supabase.from("avis").insert({
logement_id: Number(fLogement),
auteur: fAuteur.trim(),
note_etat: fNotes.etat,
note_bruit: fNotes.bruit,
note_gestion: fNotes.gestion,
note_depot: fNotes.depot,
note_prix: fNotes.prix,
texte: fTexte.trim(),
statut: "en_attente",
});
setEnvoiEnCours(false);
if (error) {
setErreur("L'envoi a échoué. Réessaie dans un instant.");
return;
}
setFormOuvert(false);
setConfirmation(true);
setFLogement(""); setFAuteur("");
setFNotes({ etat: 0, bruit: 0, gestion: 0, depot: 0, prix: 0 });
setFTexte(""); setFCertif(false);
setTimeout(() => setConfirmation(false), 6000);
}

const resDetail = logements.find((r) => r.id === detail);

return (
<div className="min-h-screen bg-stone-50" style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
<header className="text-white" style={{ backgroundColor: "#1F3D33" }}>
<div className="max-w-4xl mx-auto px-4 py-8">
<div className="flex items-center justify-between gap-4 flex-wrap">
<div>
<h1 className="text-3xl font-extrabold tracking-tight">
Piaule<span className="text-yellow-400">.</span>
</h1>
<p className="mt-1 text-stone-200">
Les avis honnêtes sur les logements étudiants — Paris
</p>
</div>
<button
onClick={() => { setFormOuvert(true); setDetail(null); }}
className="px-4 py-2.5 rounded-lg bg-yellow-400 text-stone-900 font-bold hover:bg-yellow-300 transition-colors"
>
✍️ Déposer un avis
</button>
</div>
<div className="mt-5">
<input
type="text"
value={recherche}
onChange={(e) => setRecherche(e.target.value)}
placeholder="Rechercher une résidence, un logement…"
className="w-full px-4 py-3 rounded-lg text-stone-900 bg-white placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-yellow-400"
/>
</div>
</div>
</header>

<div className="bg-white border-b border-stone-200 sticky top-0 z-10 shadow-sm">
<div className="max-w-4xl mx-auto px-4 py-3 flex flex-wrap items-center gap-3">
<select value={type} onChange={(e) => setType(e.target.value)}
className="px-3 py-1.5 text-sm rounded-lg border border-stone-300 bg-white text-stone-700">
{TYPES.map((t) => <option key={t} value={t}>{t === "Tous" ? "Type : tous" : t}</option>)}
</select>
<select value={tri} onChange={(e) => setTri(e.target.value)}
className="px-3 py-1.5 text-sm rounded-lg border border-stone-300 bg-white text-stone-700">
<option value="note">Meilleures notes d'abord</option>
<option value="avis">Plus d'avis d'abord</option>
<option value="nom">Ordre alphabétique</option>
</select>
<span className="text-sm text-stone-500 ml-auto">
{chargement ? "Chargement…" : `${resultats.length} logement${resultats.length > 1 ? "s" : ""}`}
</span>
</div>
</div>

{confirmation && (
<div className="max-w-4xl mx-auto px-4 pt-4">
<div className="bg-green-50 border border-green-200 text-green-800 rounded-lg px-4 py-3 text-sm">
✅ Merci ! Ton avis a bien été envoyé. Il apparaîtra sur le site une fois validé par la modération.
</div>
</div>
)}

{erreur && (
<div className="max-w-4xl mx-auto px-4 pt-4">
<div className="bg-red-50 border border-red-200 text-red-800 rounded-lg px-4 py-3 text-sm">
{erreur}
</div>
</div>
)}

<main className="max-w-4xl mx-auto px-4 py-6 space-y-3">
{chargement && (
<div className="bg-white rounded-xl border border-stone-200 p-10 text-center text-stone-500">
Chargement des logements…
</div>
)}

{!chargement && resultats.length === 0 && (
<div className="bg-white rounded-xl border border-stone-200 p-10 text-center">
<p className="text-stone-700 font-semibold">Aucun logement ne correspond.</p>
<p className="text-stone-500 text-sm mt-1">Modifie les filtres ou la recherche.</p>
</div>
)}

{!chargement && resultats.map((r) => {
const globale = noteGlobale(r.avis);
return (
<button
key={r.id}
onClick={() => { setDetail(detail === r.id ? null : r.id); setFormOuvert(false); }}
className="w-full text-left bg-white rounded-xl border border-stone-200 px-5 py-4 hover:border-stone-300 hover:shadow-sm transition-all flex items-center gap-4"
>
<Etiquette note={globale} />
<div className="flex-1 min-w-0">
<h2 className="font-bold text-stone-900">{r.nom}</h2>
<p className="text-sm text-stone-500">
{r.type}{r.quartier ? ` · ${r.quartier}` : ""}{r.loyer ? ` · à partir de ${r.loyer}/mois` : ""}
</p>
<p className="text-xs text-stone-400 mt-0.5">
{r.avis.length === 0 ? "Aucun avis — sois le premier !" : `${r.avis.length} avis vérifié${r.avis.length > 1 ? "s" : ""}`}
</p>
</div>
<span className="text-stone-400">{detail === r.id ? "▲" : "▼"}</span>
</button>
);
})}
</main>

{resDetail && (
<div className="max-w-4xl mx-auto px-4 pb-6 -mt-3">
<div className="bg-white rounded-xl border-2 p-5" style={{ borderColor: "#1F3D33" }}>
<div className="flex items-start justify-between gap-3 flex-wrap">
<div>
<h3 className="text-lg font-extrabold text-stone-900">{resDetail.nom}</h3>
<p className="text-sm text-stone-500">
{resDetail.type}{resDetail.quartier ? ` · ${resDetail.quartier}` : ""}{resDetail.loyer ? ` · ${resDetail.loyer}/mois` : ""}
</p>
</div>
<Etiquette note={noteGlobale(resDetail.avis)} />
</div>

<div className="mt-4 space-y-2">
{CRITERES.map((c) => (
<BarreCritere key={c.id} label={c.label} valeur={moyenneCritere(resDetail.avis, c.col)} />
))}
</div>

<h4 className="mt-5 mb-2 font-bold text-stone-800 text-sm uppercase tracking-wide">
Avis ({resDetail.avis.length})
</h4>
{resDetail.avis.length === 0 ? (
<p className="text-sm text-stone-500">Personne n'a encore témoigné sur ce logement.</p>
) : (
<div className="space-y-3">
{resDetail.avis.map((a) => (
<div key={a.id} className="border border-stone-100 rounded-lg p-3 bg-stone-50">
<div className="flex items-center gap-2">
<Etiquette note={noteAvis(a)} taille="petite" />
<div>
<p className="text-sm font-semibold text-stone-800">{a.auteur}</p>
<p className="text-xs text-stone-400">
{new Date(a.cree_le).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
</p>
</div>
</div>
<p className="text-sm text-stone-700 mt-2">{a.texte}</p>
</div>
))}
</div>
)}
</div>
</div>
)}

{formOuvert && (
<div className="max-w-4xl mx-auto px-4 pb-6">
<div className="bg-white rounded-xl border-2 border-yellow-400 p-5">
<h3 className="text-lg font-extrabold text-stone-900">Déposer un avis</h3>
<p className="text-sm text-stone-500 mt-1">
Reste factuel : décris ce que tu as vécu, sans insulte ni accusation invérifiable. Chaque avis est relu avant publication et le bailleur dispose d'un droit de réponse.
</p>

<label className="block mt-4 text-sm font-semibold text-stone-700">Logement concerné</label>
<select value={fLogement} onChange={(e) => setFLogement(e.target.value)}
className="mt-1 w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-stone-700">
<option value="">— Choisir —</option>
{logements.map((r) => <option key={r.id} value={r.id}>{r.nom}{r.quartier ? ` (${r.quartier})` : ""}</option>)}
</select>

<label className="block mt-4 text-sm font-semibold text-stone-700">Ton prénom ou pseudo</label>
<input type="text" value={fAuteur} onChange={(e) => setFAuteur(e.target.value)}
placeholder="Ex : Léa M."
className="mt-1 w-full px-3 py-2 rounded-lg border border-stone-300 text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-yellow-400" />

<div className="mt-4 space-y-3">
{CRITERES.map((c) => (
<div key={c.id} className="flex items-center justify-between gap-3 flex-wrap">
<span className="text-sm text-stone-700">{c.label}</span>
<Etoiles valeur={fNotes[c.id]} onChange={(n) => setFNotes((p) => ({ ...p, [c.id]: n }))} />
</div>
))}
</div>

<label className="block mt-4 text-sm font-semibold text-stone-700">Ton expérience (30 caractères min.)</label>
<textarea value={fTexte} onChange={(e) => setFTexte(e.target.value)} rows={4}
placeholder="État à l'arrivée, réactivité du gestionnaire, restitution du dépôt de garantie…"
className="mt-1 w-full px-3 py-2 rounded-lg border border-stone-300 text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-yellow-400" />
<p className="text-xs text-stone-400 text-right">{fTexte.trim().length}/30</p>

<label className="mt-3 flex items-start gap-2 text-sm text-stone-700 cursor-pointer">
<input type="checkbox" checked={fCertif} onChange={(e) => setFCertif(e.target.checked)}
className="mt-0.5 w-4 h-4 accent-yellow-500" />
Je certifie avoir réellement occupé ce logement et que mon avis est factuel.
</label>

<div className="mt-4 flex gap-3">
<button onClick={envoyerAvis} disabled={!formValide || envoiEnCours}
className={`px-4 py-2.5 rounded-lg font-bold transition-colors ${
formValide && !envoiEnCours
? "bg-yellow-400 text-stone-900 hover:bg-yellow-300"
: "bg-stone-200 text-stone-400 cursor-not-allowed"
}`}>
{envoiEnCours ? "Envoi…" : "Publier mon avis"}
</button>
<button onClick={() => setFormOuvert(false)}
className="px-4 py-2.5 rounded-lg font-semibold text-stone-600 hover:bg-stone-100 transition-colors">
Annuler
</button>
</div>
</div>
</div>
)}

<footer className="max-w-4xl mx-auto px-4 py-6 text-center text-xs text-stone-400">
Piaule — avis d'étudiants, pour des étudiants.
</footer>
</div>
);
}
