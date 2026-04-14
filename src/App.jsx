import React, { useState, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import { jsPDF } from "jspdf";
import emailjs from "@emailjs/browser";

const EMAILJS_SERVICE_ID = "service_pecb087";
const EMAILJS_TEMPLATE_ID = "1lu8wur";
const EMAILJS_PUBLIC_KEY = "AfQcNqQc7-e5llQPw";


const AGENCE = {
  nom: "BAMEVENT",
  adresse: "42 rue Vivienne",
  ville: "75002 PARIS",
  tel: "06 17 08 18 14",
  siret: "102 429 198",
  rcs: "RCS PARIS",
};

function generateContractPDFBlob({ contract, client, vehicle, signatureClient = null }) {
  return buildContractDoc({ contract, client, vehicle, signatureClient });
}

function generateContractPDF({ contract, client, vehicle, signatureClient = null }) {
  const doc = buildContractDoc({ contract, client, vehicle, signatureClient });
  return doc;
}

function buildContractDoc({ contract, client, vehicle, signatureClient = null }) {
  const doc = new jsPDF();
  const blue = [37, 99, 235];
  const dark = [17, 17, 17];
  const gray = [107, 114, 128];
  const lightgray = [243, 244, 246];

  const fmtD = (d) => d ? new Date(d).toLocaleDateString("fr-FR") : "—";
  const fmtN = (n) => n != null ? Number(n).toLocaleString("fr-FR") : "—";

  // En-tête
  doc.setFillColor(...blue);
  doc.rect(0, 0, 210, 38, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("CONTRAT DE LOCATION", 14, 16);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text("FleetManager — Gestion de flotte", 14, 24);
  doc.setFontSize(10);
  doc.text(`Réf. #${contract.id} — Édité le ${fmtD(new Date())}`, 14, 31);

  // Statut badge
  const statusColors = { actif: [59,130,246], terminé: [16,185,129], annulé: [239,68,68] };
  const sc = statusColors[contract.status] || [107,114,128];
  doc.setFillColor(...sc);
  doc.roundedRect(150, 10, 46, 12, 3, 3, "F");
  doc.setTextColor(255,255,255);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(contract.status.toUpperCase(), 173, 18, { align: "center" });

  let y = 48;

  // Fonction bloc section
  const section = (title, yPos) => {
    doc.setFillColor(...lightgray);
    doc.rect(14, yPos, 182, 7, "F");
    doc.setTextColor(...blue);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(title, 17, yPos + 5);
    return yPos + 11;
  };

  const row = (label, value, yPos, col = 0) => {
    const x = col === 0 ? 14 : 107;
    doc.setTextColor(...gray);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(label.toUpperCase(), x, yPos);
    doc.setTextColor(...dark);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(String(value || "—"), x, yPos + 5);
    return yPos + 12;
  };

  // CLIENT
  y = section("INFORMATIONS CLIENT", y);
  const clientName = client?.name || "—";

  // Nom + Téléphone sur une ligne
  const col1End = row("Nom complet", clientName, y, 0);
  row("Téléphone", client?.phone || "—", y, 1);
  y = col1End;

  // Email sur toute la largeur (pas de colonne)
  doc.setTextColor(...gray);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("EMAIL", 14, y);
  doc.setTextColor(...dark);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  const emailText = client?.email || "—";
  doc.text(emailText, 14, y + 5);
  y += 12;

  // Permis + Expiration sur une ligne
  doc.setTextColor(...gray);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("N° PERMIS DE CONDUIRE", 14, y);
  doc.text("EXPIRATION PERMIS", 107, y);
  doc.setTextColor(...dark);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(client?.license || "—", 14, y + 5);
  doc.text(fmtD(client?.licenseExpiry) || "—", 107, y + 5);
  y += 14;

  // VÉHICULE
  y = section("VÉHICULE", y);
  row("Véhicule", `${vehicle?.brand || ""} ${vehicle?.model || ""}`, y, 0);
  row("Immatriculation", vehicle?.plate || "—", y, 1);
  y += 12;
  row("Catégorie", vehicle?.category || "—", y, 0);
  row("Carburant", vehicle?.fuel || "—", y, 1);
  y += 16;

  // LOCATION
  y = section("DÉTAILS DE LA LOCATION", y);
  row("Date de début", fmtD(contract.startDate), y, 0);
  row("Date de fin", fmtD(contract.endDate), y, 1);
  y += 12;
  const days = contract.startDate && contract.endDate
    ? Math.ceil((new Date(contract.endDate) - new Date(contract.startDate)) / 86400000)
    : 0;
  row("Durée", `${days} jour(s)`, y, 0);
  row("Assurance", contract.insurance || "—", y, 1);
  y += 12;
  row("KM départ", fmtN(contract.km_start), y, 0);
  row("KM retour", contract.km_end ? fmtN(contract.km_end) : "—", y, 1);
  y += 12;
  if (contract.km_end && contract.km_start) {
    row("Distance parcourue", `${fmtN(contract.km_end - contract.km_start)} km`, y, 0);
    y += 12;
  }

  // FINANCIER
  y = section("RÉCAPITULATIF FINANCIER", y);
  row("Tarif journalier", `${fmtN(contract.dailyRate)} €/jour`, y, 0);
  row("Dépôt de garantie", `${fmtN(contract.deposit)} €`, y, 1);
  y += 12;

  // Total en évidence
  doc.setFillColor(...blue);
  doc.roundedRect(14, y, 182, 18, 3, 3, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text("TOTAL DE LA LOCATION", 20, y + 7);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(`${fmtN(contract.total)} €`, 192, y + 12, { align: "right" });
  y += 26;

  // Notes
  if (contract.notes) {
    y = section("NOTES", y);
    doc.setTextColor(...dark);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(contract.notes, 178);
    doc.text(lines, 14, y);
    y += lines.length * 5 + 6;
  }

  // Pièces jointes
  const allPJ = [
    { label: "📸 Photo départ 1", val: contract.photoDepart1 },
    { label: "📸 Photo départ 2", val: contract.photoDepart2 },
    { label: "📸 Photo départ 3", val: contract.photoDepart3 },
    { label: "📸 Photo départ 4", val: contract.photoDepart4 },
    { label: "🎥 Vidéo départ",   val: contract.videoDepart },
    { label: "📸 Photo retour 1", val: contract.photoRetour1 },
    { label: "📸 Photo retour 2", val: contract.photoRetour2 },
    { label: "📸 Photo retour 3", val: contract.photoRetour3 },
    { label: "📸 Photo retour 4", val: contract.photoRetour4 },
    { label: "🎥 Vidéo retour",   val: contract.videoRetour },
    { label: "🔢 Compteur départ",val: contract.photoCompteurDepart },
    { label: "⛽ Essence départ",  val: contract.photoEssenceDepart },
    { label: "🔢 Compteur retour",val: contract.photoCompteurRetour },
    { label: "⛽ Essence retour",  val: contract.photoEssenceRetour },
  ].filter(p => p.val);

  if (allPJ.length > 0) {
    if (y > 240) { doc.addPage(); y = 20; }
    y = section("PIÈCES JOINTES (" + allPJ.length + " fichier(s))", y);
    const cols = 2;
    allPJ.forEach((pj, i) => {
      const col = i % cols;
      const x = col === 0 ? 14 : 107;
      if (col === 0 && i > 0) y += 10;
      if (y > 270) { doc.addPage(); y = 20; }
      doc.setFillColor(239, 246, 255);
      doc.roundedRect(x, y - 2, 88, 9, 2, 2, "F");
      doc.setTextColor(37, 99, 235);
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "bold");
      doc.text(pj.label, x + 2, y + 4);
      doc.setTextColor(107, 114, 128);
      doc.setFont("helvetica", "normal");
      const valText = pj.val.length > 30 ? pj.val.substring(0, 30) + "…" : pj.val;
      doc.text(valText, x + 2, y + 8.5);
    });
    if (allPJ.length % 2 !== 0) y += 10;
    y += 14;
  }

  // Signature client dans le PDF (page 1)
  if (signatureClient) {
    if (y > 230) { doc.addPage(); y = 20; }
    y = section("SIGNATURE DU CLIENT", y);
    doc.setFillColor(239, 246, 255);
    doc.roundedRect(14, y, 182, 35, 3, 3, "F");
    doc.setTextColor(107, 114, 128);
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.text("Signature électronique du locataire — Lu et approuvé", 105, y + 5, { align: "center" });
    try {
      doc.addImage(signatureClient, "JPEG", 57, y + 7, 96, 24);
    } catch(e) {}
    y += 42;
  }

  // ── PAGE 2 : CONDITIONS GÉNÉRALES ──────────────────────────────────────
  doc.addPage();
  doc.setFillColor(...blue);
  doc.rect(0, 0, 210, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("CONDITIONS GÉNÉRALES DE LOCATION", 105, 14, { align: "center" });

  const conditions = [
    {
      title: "Article 1 — Objet du contrat",
      text: "Le présent contrat a pour objet la mise à disposition d'un véhicule automobile par le loueur au profit du locataire, pour la durée et aux conditions définies ci-dessus. Le véhicule est loué à titre exclusivement personnel et non commercial, sauf accord écrit préalable du loueur."
    },
    {
      title: "Article 2 — Permis de conduire et âge",
      text: "Le locataire doit être titulaire d'un permis de conduire valide depuis au moins 2 ans, correspondant à la catégorie du véhicule loué. Toute location par un conducteur dont le permis est suspendu, invalidé ou non valable est strictement interdite et engage la pleine responsabilité du locataire."
    },
    {
      title: "Article 3 — Utilisation du véhicule",
      text: "Le véhicule doit être utilisé conformément au Code de la Route en vigueur. Il est interdit : de sous-louer ou prêter le véhicule à un tiers non mentionné au contrat ; d'utiliser le véhicule pour le transport rémunéré de personnes ou de marchandises ; de participer à des compétitions ou d'utiliser le véhicule hors route ; de conduire sous l'emprise de l'alcool ou de stupéfiants."
    },
    {
      title: "Article 4 — Carburant",
      text: "Le véhicule est remis avec un niveau de carburant défini à la prise en charge. Le locataire s'engage à restituer le véhicule avec le même niveau de carburant. À défaut, les frais de carburant manquant seront facturés au tarif en vigueur majoré de 20 € de frais de service."
    },
    {
      title: "Article 5 — Kilométrage",
      text: "Le kilométrage parcouru est enregistré au départ et au retour du véhicule. En cas de kilométrage supplémentaire non prévu au contrat, un supplément pourra être facturé selon le tarif convenu entre les parties. Toute falsification du compteur kilométrique constitue une infraction pénale."
    },
    {
      title: "Article 6 — Dépôt de garantie",
      text: "Un dépôt de garantie est perçu à la signature du contrat. Il est restitué au locataire à la fin de la location, déduction faite de toute somme due au titre de dommages, amendes, carburant manquant ou kilométrage supplémentaire. Le dépôt ne constitue pas une limite de responsabilité."
    },
    {
      title: "Article 7 — Assurance et responsabilité",
      text: "Le véhicule bénéficie d'une couverture d'assurance selon la formule choisie au contrat. En cas de sinistre, le locataire doit en informer le loueur dans les 24 heures et remplir un constat amiable. Le locataire reste responsable de la franchise contractuelle et de tout dommage non couvert par l'assurance souscrite."
    },
    {
      title: "Article 8 — Restitution du véhicule",
      text: "Le véhicule doit être restitué à la date et au lieu convenus, propre et en bon état de fonctionnement. Tout retard de restitution non signalé au préalable sera facturé au tarif journalier en vigueur. En cas de non-restitution, le loueur se réserve le droit de déclarer le véhicule volé auprès des autorités compétentes."
    },
    {
      title: "Article 9 — Infractions et contraventions",
      text: "Toute infraction au Code de la Route commise pendant la période de location est de la seule responsabilité du locataire. Les amendes et frais administratifs liés à ces infractions seront répercutés intégralement au locataire, majorés de 30 € de frais de traitement par dossier."
    },
    {
      title: "Article 10 — Litiges",
      text: "En cas de litige, les parties s'engagent à rechercher une solution amiable avant tout recours judiciaire. À défaut d'accord amiable, le litige sera soumis aux juridictions compétentes du ressort du siège du loueur. Le présent contrat est soumis au droit français."
    },
  ];

  let cy = 30;
  conditions.forEach(({ title, text }) => {
    if (cy > 255) {
      doc.addPage();
      doc.setFillColor(...blue);
      doc.rect(0, 0, 210, 10, "F");
      cy = 18;
    }
    doc.setTextColor(...blue);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(title, 14, cy);
    cy += 5;
    doc.setTextColor(...dark);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(text, 182);
    doc.text(lines, 14, cy);
    cy += lines.length * 4.5 + 5;
  });

  // Signatures sur la dernière page des conditions
  if (cy > 220) { doc.addPage(); cy = 20; }
  cy += 10;

  // Bloc agence (gauche)
  doc.setFillColor(...lightgray);
  doc.roundedRect(14, cy, 85, 42, 3, 3, "F");
  doc.setTextColor(...blue);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(AGENCE.nom, 17, cy + 7);
  doc.setTextColor(...dark);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.text(AGENCE.adresse, 17, cy + 13);
  doc.text(AGENCE.ville, 17, cy + 18);
  doc.text(`Tél : ${AGENCE.tel}`, 17, cy + 23);
  doc.text(`SIRET : ${AGENCE.siret}`, 17, cy + 28);
  doc.text(AGENCE.rcs, 17, cy + 33);
  doc.setTextColor(...gray);
  doc.setFontSize(7);
  doc.setFont("helvetica", "italic");
  doc.text("Signature du loueur", 57, cy + 40, { align: "center" });

  // Bloc signature client (droite)
  doc.setFillColor(...lightgray);
  doc.roundedRect(111, cy, 85, 42, 3, 3, "F");
  doc.setTextColor(...blue);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(client?.name || "Locataire", 114, cy + 7);
  doc.setTextColor(...gray);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.text("Lu et approuvé — Signature :", 114, cy + 13);
  if (signatureClient) {
    try {
      doc.addImage(signatureClient, "JPEG", 114, cy + 15, 80, 22);
    } catch(e) {}
  } else {
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(114, cy + 36, 193, cy + 36);
  }
  doc.setTextColor(...gray);
  doc.setFontSize(7);
  doc.setFont("helvetica", "italic");
  doc.text("Signature du locataire", 153, cy + 40, { align: "center" });

  // Pied de page sur toutes les pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFillColor(...lightgray);
    doc.rect(0, 282, 210, 15, "F");
    doc.setTextColor(...gray);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text(`Contrat #${contract.id} — FleetManager — ${fmtD(new Date())} — Page ${i}/${totalPages}`, 105, 289, { align: "center" });
  }

  const dateDebut = contract.startDate ? new Date(contract.startDate).toLocaleDateString("fr-FR").replace(/\//g, "-") : "date-inconnue";
  const nomClient = (client?.name || "client").replace(/\s+/g, "-");
  const nomVehicule = `${vehicle?.brand || ""}-${vehicle?.model || ""}`.replace(/\s+/g, "-");
  doc.save(`${dateDebut}_${nomClient}_${nomVehicule}.pdf`);
}


class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", fontFamily: "sans-serif", background: "#f8f9fc", gap: 16 }}>
          <span style={{ fontSize: 48 }}>🚘</span>
          <h2 style={{ margin: 0, color: "#111" }}>FleetManager</h2>
          <p style={{ color: "#6b7280", margin: 0 }}>Une erreur est survenue. Rechargez la page.</p>
          <button onClick={() => window.location.reload()} style={{ padding: "10px 24px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 600 }}>
            🔄 Recharger
          </button>
          <pre style={{ fontSize: 11, color: "#9ca3af", maxWidth: 500, overflow: "auto" }}>{String(this.state.error)}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

const SUPABASE_URL = "https://tjjcpvglflruqsvhelzt.supabase.co";
const SUPABASE_KEY = "sb_publishable_Bzp-1tLhtuqak4C_Svvplg_iqf78EBZ";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const STATUS_COLORS = {
  disponible: { bg: "#d1fae5", text: "#065f46", dot: "#10b981" },
  loué: { bg: "#dbeafe", text: "#1e40af", dot: "#3b82f6" },
  entretien: { bg: "#fef3c7", text: "#92400e", dot: "#f59e0b" },
  actif: { bg: "#dbeafe", text: "#1e40af", dot: "#3b82f6" },
  terminé: { bg: "#f3f4f6", text: "#374151", dot: "#9ca3af" },
  "en cours": { bg: "#fef3c7", text: "#92400e", dot: "#f59e0b" },
  planifié: { bg: "#ede9fe", text: "#5b21b6", dot: "#8b5cf6" },
  annulé: { bg: "#fee2e2", text: "#991b1b", dot: "#ef4444" },
  valide: { bg: "#d1fae5", text: "#065f46", dot: "#10b981" },
  expiré: { bg: "#fee2e2", text: "#991b1b", dot: "#ef4444" },
  "en attente": { bg: "#fef3c7", text: "#92400e", dot: "#f59e0b" },
  "à renouveler": { bg: "#ede9fe", text: "#5b21b6", dot: "#8b5cf6" },
};

const DOC_CATEGORIES = [
  { id: "société", label: "Société", icon: "🏢", color: "#2563eb" },
  { id: "gérant", label: "Gérant", icon: "👤", color: "#7c3aed" },
  { id: "assurance", label: "Assurance", icon: "🛡️", color: "#059669" },
  { id: "fiscal", label: "Fiscal", icon: "📑", color: "#d97706" },
  { id: "autre", label: "Autre", icon: "📎", color: "#6b7280" },
];

const fmt = (n) => n?.toLocaleString("fr-FR") ?? "—";
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("fr-FR") : "—";
const diffDays = (a, b) => Math.ceil((new Date(b) - new Date(a)) / 86400000);

const toVehicle = (r) => ({ id: r.id, brand: r.brand, model: r.model, plate: r.plate, year: r.year, status: r.status, fuel: r.fuel, category: r.category, km: r.km, dailyRate: r.daily_rate, image: r.image || "🚗", nextService: r.next_service, docCarteGrise: r.doc_carte_grise || null, docAssurance: r.doc_assurance || null, docControleTech: r.doc_controle_tech || null, phoneGps: r.phone_gps || "", insuranceMonthly: r.insurance_monthly || null });
const toClient = (r) => ({ id: r.id, name: r.name, email: r.email, phone: r.phone, license: r.license, licenseExpiry: r.license_expiry, address: r.address, permisRecto: r.permis_recto || null, permisVerso: r.permis_verso || null, carteIdRecto: r.carte_id_recto || null, carteIdVerso: r.carte_id_verso || null });
const toContract = (r) => ({ id: r.id, clientId: r.client_id, vehicleId: r.vehicle_id, startDate: r.start_date, endDate: r.end_date, status: r.status, insurance: r.insurance, deposit: r.deposit, km_start: r.km_start, km_end: r.km_end, dailyRate: r.daily_rate, total: r.total, notes: r.notes, photoDepart1: r.photo_depart_1 || null, photoDepart2: r.photo_depart_2 || null, photoDepart3: r.photo_depart_3 || null, photoDepart4: r.photo_depart_4 || null, videoDepart: r.video_depart || null, photoRetour1: r.photo_retour_1 || null, photoRetour2: r.photo_retour_2 || null, photoRetour3: r.photo_retour_3 || null, photoRetour4: r.photo_retour_4 || null, videoRetour: r.video_retour || null, photoCompteurDepart: r.photo_compteur_depart || null, photoEssenceDepart: r.photo_essence_depart || null, photoCompteurRetour: r.photo_compteur_retour || null, photoEssenceRetour: r.photo_essence_retour || null });
const toMaintenance = (r) => ({ id: r.id, vehicleId: r.vehicle_id, type: r.type, date: r.date, status: r.status, cost: r.cost, garage: r.garage, notes: r.notes, pj1: r.pj_1 || null, pj2: r.pj_2 || null, pj3: r.pj_3 || null });
const toDocument = (r) => ({ id: r.id, category: r.category, name: r.name, description: r.description, expiryDate: r.expiry_date, status: r.status, fileName: r.file_name, uploadDate: r.upload_date });
const toFacture = (r) => ({ id: r.id, contractId: r.contract_id, clientId: r.client_id, label: r.label, amount: r.amount, date: r.date, status: r.status, notes: r.notes, numero: r.numero || "", lignes: r.lignes ? JSON.parse(r.lignes) : [] });
const toAmende = (r) => ({ id: r.id, contractId: r.contract_id, clientId: r.client_id, vehicleId: r.vehicle_id, date: r.date, amount: r.amount, description: r.description, status: r.status, reference: r.reference, notes: r.notes, pieceJointe1: r.piece_jointe_1 || null, pieceJointe2: r.piece_jointe_2 || null, pieceJointe3: r.piece_jointe_3 || null, lienAntai: r.lien_antai || "", lienFps: r.lien_fps || "" });

const inp = { width: "100%", padding: "10px 12px", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "inherit" };
const sel = { ...inp, appearance: "none", cursor: "pointer" };
const btn = { padding: "10px 24px", border: "none", borderRadius: 8, background: "#2563eb", color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 600 };
const btnCancel = { padding: "10px 20px", border: "1.5px solid #e5e7eb", borderRadius: 8, background: "#fff", cursor: "pointer", fontSize: 14 };

function Badge({ status }) {
  const c = STATUS_COLORS[status] || STATUS_COLORS["terminé"];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 20, background: c.bg, fontSize: 12, fontWeight: 600, color: c.text }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: c.dot }} />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 580, maxHeight: "90vh", overflow: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 24px", borderBottom: "1px solid #f0f0f0" }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#111" }}>{title}</h3>
          <button onClick={onClose} style={{ background: "#f5f5f5", border: "none", borderRadius: 8, width: 32, height: 32, cursor: "pointer", fontSize: 18 }}>×</button>
        </div>
        <div style={{ padding: 24 }}>{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 6, textTransform: "uppercase", letterSpacing: .4 }}>{label}</label>
      {children}
    </div>
  );
}

function Stat({ label, value, sub, color = "#2563eb", icon }) {
  return (
    <div style={{ background: "#fff", borderRadius: 14, padding: "20px 22px", border: "1px solid #f0f0f0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <p style={{ margin: "0 0 6px", fontSize: 13, color: "#9ca3af", fontWeight: 500 }}>{label}</p>
          <p style={{ margin: 0, fontSize: 28, fontWeight: 800, color: "#111" }}>{value}</p>
          {sub && <p style={{ margin: "4px 0 0", fontSize: 12, color: "#6b7280" }}>{sub}</p>}
        </div>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: color + "18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>{icon}</div>
      </div>
    </div>
  );
}

// ─── FORMULAIRES (définis hors de App pour éviter les re-montages) ────────────

function VehicleForm({ init = {}, onClose, onSave, notify }) {
  const [f, setF] = useState({
    brand: init.brand || "", model: init.model || "", plate: init.plate || "",
    year: init.year || 2024, status: init.status || "disponible",
    fuel: init.fuel || "Essence", category: init.category || "Berline",
    km: init.km || 0, dailyRate: init.dailyRate || 80, nextService: init.nextService || "",
    docCarteGrise: init.docCarteGrise || null, docAssurance: init.docAssurance || null, docControleTech: init.docControleTech || null,
    phoneGps: init.phoneGps || "",
    insuranceMonthly: init.insuranceMonthly || ""
  });
  const [saving, setSaving] = useState(false);
  const s = (k) => (e) => setF(p => ({ ...p, [k]: e.target.value }));
  const save = async () => {
    setSaving(true);
    const row = { brand: f.brand, model: f.model, plate: f.plate, year: Number(f.year), status: f.status, fuel: f.fuel, category: f.category, km: Number(f.km), daily_rate: Number(f.dailyRate), image: init.image || "🚗", next_service: f.nextService || null, doc_carte_grise: f.docCarteGrise, doc_assurance: f.docAssurance, doc_controle_tech: f.docControleTech, phone_gps: f.phoneGps || null, insurance_monthly: f.insuranceMonthly !== "" ? Number(f.insuranceMonthly) : null };
    const { error } = init.id
      ? await supabase.from("vehicles").update(row).eq("id", init.id)
      : await supabase.from("vehicles").insert(row);
    if (error) { notify("❌ Erreur : " + error.message); setSaving(false); return; }
    onClose();
    await onSave();
    notify("✅ Véhicule enregistré !");
  };
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Marque"><input style={inp} value={f.brand} onChange={s("brand")} placeholder="BMW" /></Field>
        <Field label="Modèle"><input style={inp} value={f.model} onChange={s("model")} placeholder="Série 3" /></Field>
        <Field label="Immatriculation"><input style={inp} value={f.plate} onChange={s("plate")} placeholder="AB-123-CD" /></Field>
        <Field label="Année"><input style={inp} type="number" value={f.year} onChange={s("year")} /></Field>
        <Field label="Carburant"><select style={sel} value={f.fuel} onChange={s("fuel")}>{["Essence","Diesel","Hybride","Électrique"].map(o=><option key={o}>{o}</option>)}</select></Field>
        <Field label="Catégorie"><select style={sel} value={f.category} onChange={s("category")}>{["Berline","SUV","Utilitaire","Coupé","Cabriolet"].map(o=><option key={o}>{o}</option>)}</select></Field>
        <Field label="Kilométrage"><input style={inp} type="number" value={f.km} onChange={s("km")} /></Field>
        <Field label="Tarif jour (€)"><input style={inp} type="number" value={f.dailyRate} onChange={s("dailyRate")} /></Field>
        <Field label="Statut"><select style={sel} value={f.status} onChange={s("status")}>{["disponible","loué","entretien"].map(o=><option key={o}>{o}</option>)}</select></Field>
        <Field label="Prochain entretien"><input style={inp} type="date" value={f.nextService} onChange={s("nextService")} /></Field>
        <Field label="📱 N° téléphone GPS"><input style={inp} value={f.phoneGps} onChange={s("phoneGps")} placeholder="Ex: +33 6 12 34 56 78" /></Field>
        <Field label="🛡️ Assurance / mois (€)"><input style={inp} type="number" value={f.insuranceMonthly} onChange={s("insuranceMonthly")} placeholder="Ex: 85" /></Field>
      </div>

      <div style={{ marginTop: 4, marginBottom: 8 }}>
        <p style={{ margin: "0 0 10px", fontSize: 12, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: .4 }}>📎 Pièces jointes</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            { key: "docCarteGrise", label: "Carte grise", icon: "📋" },
            { key: "docAssurance", label: "Assurance", icon: "🛡️" },
            { key: "docControleTech", label: "Contrôle technique", icon: "🔍" },
          ].map(({ key, label, icon }) => (
            <div key={key} style={{ display: "flex", alignItems: "center", gap: 10, background: "#f9fafb", border: "1.5px dashed " + (f[key] ? "#93c5fd" : "#e5e7eb"), borderRadius: 8, padding: "10px 14px" }}>
              <span style={{ fontSize: 18 }}>{icon}</span>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#374151" }}>{label}</p>
                {f[key] && <p style={{ margin: "2px 0 0", fontSize: 11, color: "#6b7280" }}>📄 {f[key]}</p>}
              </div>
              <label style={{ cursor: "pointer" }}>
                <input type="file" style={{ display: "none" }} accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) setF(p => ({ ...p, [key]: file.name }));
                  }} />
                <span style={{ background: f[key] ? "#eff6ff" : "#f3f4f6", color: f[key] ? "#2563eb" : "#6b7280", border: "none", borderRadius: 6, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  {f[key] ? "Changer" : "Ajouter"}
                </span>
              </label>
              {f[key] && (
                <button onClick={() => setF(p => ({ ...p, [key]: null }))}
                  style={{ background: "#fee2e2", color: "#dc2626", border: "none", borderRadius: 6, padding: "5px 8px", cursor: "pointer", fontSize: 12 }}>✕</button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
        <button onClick={onClose} style={btnCancel}>Annuler</button>
        <button onClick={save} disabled={saving} style={{ ...btn, background: saving ? "#93c5fd" : "#2563eb" }}>{saving ? "Enregistrement..." : "Enregistrer"}</button>
      </div>
    </div>
  );
}

function ClientForm({ init = {}, onClose, onSave, notify }) {
  const [f, setF] = useState({
    name: init.name || "", email: init.email || "", phone: init.phone || "",
    license: init.license || "", licenseExpiry: init.licenseExpiry || "", address: init.address || "",
    permisRecto: init.permisRecto || null, permisVerso: init.permisVerso || null,
    carteIdRecto: init.carteIdRecto || null, carteIdVerso: init.carteIdVerso || null
  });
  const [saving, setSaving] = useState(false);
  const s = (k) => (e) => setF(p => ({ ...p, [k]: e.target.value }));
  const save = async () => {
    setSaving(true);
    const row = { name: f.name, email: f.email, phone: f.phone, license: f.license, license_expiry: f.licenseExpiry || null, address: f.address, permis_recto: f.permisRecto, permis_verso: f.permisVerso, carte_id_recto: f.carteIdRecto, carte_id_verso: f.carteIdVerso };
    const { error } = init.id
      ? await supabase.from("clients").update(row).eq("id", init.id)
      : await supabase.from("clients").insert(row);
    if (error) { notify("❌ Erreur : " + error.message); setSaving(false); return; }
    onClose();
    await onSave();
    notify("✅ Client enregistré !");
  };
  return (
    <div>
      <Field label="Nom complet"><input style={inp} value={f.name} onChange={s("name")} placeholder="Prénom Nom" /></Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Email"><input style={inp} value={f.email} onChange={s("email")} /></Field>
        <Field label="Téléphone"><input style={inp} value={f.phone} onChange={s("phone")} /></Field>
        <Field label="N° Permis"><input style={inp} value={f.license} onChange={s("license")} /></Field>
        <Field label="Expiration permis"><input style={inp} type="date" value={f.licenseExpiry} onChange={s("licenseExpiry")} /></Field>
      </div>
      <Field label="Adresse"><input style={inp} value={f.address} onChange={s("address")} /></Field>

      <div style={{ marginTop: 4, marginBottom: 8 }}>
        <p style={{ margin: "0 0 10px", fontSize: 12, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: .4 }}>📎 Pièces jointes</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {[
            { key: "permisRecto", label: "Permis — Recto", icon: "🪪" },
            { key: "permisVerso", label: "Permis — Verso", icon: "🪪" },
            { key: "carteIdRecto", label: "Carte d'identité — Recto", icon: "🪪" },
            { key: "carteIdVerso", label: "Carte d'identité — Verso", icon: "🪪" },
          ].map(({ key, label, icon }) => (
            <div key={key} style={{ background: "#f9fafb", border: "1.5px dashed " + (f[key] ? "#93c5fd" : "#e5e7eb"), borderRadius: 8, padding: "10px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: f[key] ? 4 : 0 }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "#374151" }}>{icon} {label}</p>
                <div style={{ display: "flex", gap: 6 }}>
                  <label style={{ cursor: "pointer" }}>
                    <input type="file" style={{ display: "none" }} accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => { const file = e.target.files[0]; if (file) setF(p => ({ ...p, [key]: file.name })); }} />
                    <span style={{ background: f[key] ? "#eff6ff" : "#f3f4f6", color: f[key] ? "#2563eb" : "#6b7280", borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                      {f[key] ? "Changer" : "Ajouter"}
                    </span>
                  </label>
                  {f[key] && <button onClick={() => setF(p => ({ ...p, [key]: null }))} style={{ background: "#fee2e2", color: "#dc2626", border: "none", borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontSize: 11 }}>✕</button>}
                </div>
              </div>
              {f[key] && <p style={{ margin: 0, fontSize: 11, color: "#6b7280" }}>📄 {f[key]}</p>}
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
        <button onClick={onClose} style={btnCancel}>Annuler</button>
        <button onClick={save} disabled={saving} style={{ ...btn, background: saving ? "#93c5fd" : "#2563eb" }}>{saving ? "Enregistrement..." : "Enregistrer"}</button>
      </div>
    </div>
  );
}

function ContractForm({ init = {}, onClose, onSave, notify, vehicles, clients }) {
  const [f, setF] = useState({
    clientId: init.clientId || clients[0]?.id || "",
    vehicleId: init.vehicleId || vehicles[0]?.id || "",
    startDate: init.startDate || "", endDate: init.endDate || "",
    insurance: init.insurance || "tiers", deposit: init.deposit || 300,
    km_start: init.km_start || 0, km_end: init.km_end || "", status: init.status || "actif", notes: init.notes || "",
    photoDepart1: init.photoDepart1 || null, photoDepart2: init.photoDepart2 || null, photoDepart3: init.photoDepart3 || null, photoDepart4: init.photoDepart4 || null, videoDepart: init.videoDepart || null,
    photoRetour1: init.photoRetour1 || null, photoRetour2: init.photoRetour2 || null, photoRetour3: init.photoRetour3 || null, photoRetour4: init.photoRetour4 || null, videoRetour: init.videoRetour || null,
    photoCompteurDepart: init.photoCompteurDepart || null, photoEssenceDepart: init.photoEssenceDepart || null,
    photoCompteurRetour: init.photoCompteurRetour || null, photoEssenceRetour: init.photoEssenceRetour || null,
    totalManuel: init.total !== undefined && init.total !== null ? String(init.total) : "",
    emailDest: ""
  });
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [signatureRef] = useState(() => ({ canvas: null, ctx: null, drawing: false }));
  const [signatureData, setSignatureData] = useState(null);
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [saving, setSaving] = useState(false);
  const v = vehicles.find(x => x.id === Number(f.vehicleId));
  const days = f.startDate && f.endDate ? diffDays(f.startDate, f.endDate) : 0;
  const totalAuto = days > 0 ? days * (v?.dailyRate || 0) : 0;
  const total = f.totalManuel !== "" ? Number(f.totalManuel) : totalAuto;
  const s = (k) => (e) => setF(p => ({ ...p, [k]: e.target.value }));
  const save = async () => {
    setSaving(true);
    const row = { client_id: Number(f.clientId), vehicle_id: Number(f.vehicleId), start_date: f.startDate, end_date: f.endDate, status: f.status, insurance: f.insurance, deposit: Number(f.deposit), km_start: Number(f.km_start), km_end: f.km_end !== "" ? Number(f.km_end) : null, daily_rate: v?.dailyRate || 0, total: Number(f.totalManuel !== "" ? f.totalManuel : total), notes: f.notes, photo_depart_1: f.photoDepart1, photo_depart_2: f.photoDepart2, photo_depart_3: f.photoDepart3, photo_depart_4: f.photoDepart4, video_depart: f.videoDepart, photo_retour_1: f.photoRetour1, photo_retour_2: f.photoRetour2, photo_retour_3: f.photoRetour3, photo_retour_4: f.photoRetour4, video_retour: f.videoRetour, photo_compteur_depart: f.photoCompteurDepart, photo_essence_depart: f.photoEssenceDepart, photo_compteur_retour: f.photoCompteurRetour, photo_essence_retour: f.photoEssenceRetour };
    const { error } = init.id
      ? await supabase.from("contracts").update(row).eq("id", init.id)
      : await supabase.from("contracts").insert(row);
    if (error) { notify("❌ Erreur : " + error.message); setSaving(false); return; }
    if (!init.id) await supabase.from("vehicles").update({ status: "loué" }).eq("id", Number(f.vehicleId));
    // Générer le PDF
    const savedContract = { ...init, client_id: Number(f.clientId), vehicle_id: Number(f.vehicleId), start_date: f.startDate, end_date: f.endDate, status: f.status, insurance: f.insurance, deposit: Number(f.deposit), km_start: Number(f.km_start), km_end: f.km_end !== "" ? Number(f.km_end) : null, daily_rate: v?.dailyRate || 0, total: Number(f.totalManuel !== "" ? f.totalManuel : total), notes: f.notes };
    const contractForPdf = { id: init.id || "nouveau", clientId: Number(f.clientId), vehicleId: Number(f.vehicleId), startDate: f.startDate, endDate: f.endDate, status: f.status, insurance: f.insurance, deposit: Number(f.deposit), km_start: Number(f.km_start), km_end: f.km_end !== "" ? Number(f.km_end) : null, dailyRate: v?.dailyRate || 0, total: Number(f.totalManuel !== "" ? f.totalManuel : total), notes: f.notes, photoDepart1: f.photoDepart1, photoDepart2: f.photoDepart2, photoDepart3: f.photoDepart3, photoDepart4: f.photoDepart4, videoDepart: f.videoDepart, photoRetour1: f.photoRetour1, photoRetour2: f.photoRetour2, photoRetour3: f.photoRetour3, photoRetour4: f.photoRetour4, videoRetour: f.videoRetour, photoCompteurDepart: f.photoCompteurDepart, photoEssenceDepart: f.photoEssenceDepart, photoCompteurRetour: f.photoCompteurRetour, photoEssenceRetour: f.photoEssenceRetour };
    const clientForPdf = clients.find(x => x.id === Number(f.clientId));
    const vehicleForPdf = vehicles.find(x => x.id === Number(f.vehicleId));
    generateContractPDF({ contract: contractForPdf, client: clientForPdf, vehicle: vehicleForPdf, signatureClient: signatureData });

    // Créer facture automatiquement si nouveau contrat
    if (!init.id) {
      const montantTotal = Number(f.totalManuel !== "" ? f.totalManuel : total);
      const vehicule = `${vehicleForPdf?.brand || ""} ${vehicleForPdf?.model || ""} (${vehicleForPdf?.plate || ""})`;
      const factureRow = {
        client_id: Number(f.clientId),
        label: `Location ${vehicule} du ${new Date(f.startDate).toLocaleDateString("fr-FR")} au ${new Date(f.endDate).toLocaleDateString("fr-FR")}`,
        amount: montantTotal,
        date: new Date().toISOString().slice(0, 10),
        status: "en attente",
        notes: `Généré automatiquement depuis le contrat`,
      };
      const { data: factureData } = await supabase.from("factures").insert(factureRow).select().single();
      // Générer PDF facture
      if (factureData) {
        generateFacturePDFAuto({ facture: { ...factureData, clientId: factureData.client_id, contractId: factureData.contract_id }, client: clientForPdf });
      }
    }

    onClose();
    await onSave();
    notify("✅ Contrat enregistré ! PDF contrat + facture téléchargés.");
    // Envoi automatique par EmailJS si le client a un email
    if (clientForPdf?.email) {
      const montant = Number(f.totalManuel !== "" ? f.totalManuel : total).toLocaleString("fr-FR");
      const vehicule = `${vehicleForPdf?.brand || ""} ${vehicleForPdf?.model || ""} (${vehicleForPdf?.plate || ""})`;
      emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        {
          client_name: clientForPdf.name || "",
          email: clientForPdf.email,
          vehicule,
          date_debut: new Date(f.startDate).toLocaleDateString("fr-FR"),
          date_fin: new Date(f.endDate).toLocaleDateString("fr-FR"),
          montant,
          name: "BAMEVENT",
          message: `Contrat de location — ${vehicule}`,
          title: `Contrat ${vehicule}`,
        },
        EMAILJS_PUBLIC_KEY
      ).then(() => notify("✅ Contrat enregistré ! PDF + mail envoyé à " + clientForPdf.email))
       .catch(() => notify("✅ Contrat enregistré ! (échec envoi mail)"));
    }
  };

  const sendEmailJs = async (to) => {
    const clientForPdf = clients.find(x => x.id === Number(f.clientId));
    const vehicleForPdf = vehicles.find(x => x.id === Number(f.vehicleId));
    const montant = Number(f.totalManuel !== "" ? f.totalManuel : total).toLocaleString("fr-FR");
    const dateDebut = new Date(f.startDate).toLocaleDateString("fr-FR");
    const dateFin = new Date(f.endDate).toLocaleDateString("fr-FR");
    const vehicule = `${vehicleForPdf?.brand || ""} ${vehicleForPdf?.model || ""} (${vehicleForPdf?.plate || ""})`;

    try {
      notify("📤 Envoi en cours...");
      await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        {
          client_name: clientForPdf?.name || "",
          email: to,
          vehicule,
          date_debut: dateDebut,
          date_fin: dateFin,
          montant,
          name: "BAMEVENT",
          message: `Contrat de location — ${vehicule}
Du ${dateDebut} au ${dateFin}
Montant : ${montant} €`,
          title: `Contrat ${vehicule}`,
        },
        EMAILJS_PUBLIC_KEY
      );
      notify("✅ Mail envoyé à " + to + " !");
    } catch (err) {
      console.error("EmailJS error:", err);
      notify("❌ Erreur envoi mail — " + (err?.text || err?.message || "vérifiez EmailJS"));
    }
  };
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Client"><select style={sel} value={f.clientId} onChange={s("clientId")}>{clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <Field label="Véhicule"><select style={sel} value={f.vehicleId} onChange={s("vehicleId")}>{vehicles.map(v=><option key={v.id} value={v.id}>{v.brand} {v.model} — {v.plate}</option>)}</select></Field>
        <Field label="Date début"><input style={inp} type="date" value={f.startDate} onChange={s("startDate")} /></Field>
        <Field label="Date fin"><input style={inp} type="date" value={f.endDate} onChange={s("endDate")} /></Field>
        <Field label="Assurance"><select style={sel} value={f.insurance} onChange={s("insurance")}>{["tiers","tous risques","vol + incendie"].map(o=><option key={o}>{o}</option>)}</select></Field>
        <Field label="Dépôt (€)"><input style={inp} type="number" value={f.deposit} onChange={s("deposit")} /></Field>
        <Field label="KM départ"><input style={inp} type="number" value={f.km_start} onChange={s("km_start")} /></Field>
        <Field label="KM arrivée"><input style={inp} type="number" value={f.km_end} onChange={s("km_end")} placeholder="À la restitution" /></Field>
        <Field label="Statut"><select style={sel} value={f.status} onChange={s("status")}>{["actif","terminé","annulé"].map(o=><option key={o}>{o}</option>)}</select></Field>
      </div>
      <div style={{ background: "#eff6ff", borderRadius: 10, padding: "14px 16px", marginBottom: 16 }}>
        {days > 0 && <p style={{ margin: "0 0 10px", fontSize: 13, color: "#1d4ed8" }}><strong>{days} jours</strong> × {v?.dailyRate}€/j = <strong>{fmt(totalAuto)}€</strong> (calculé auto)</p>}
        {f.km_end !== "" && Number(f.km_end) > Number(f.km_start) && <p style={{ margin: "0 0 10px", fontSize: 13, color: "#1d4ed8" }}>📍 Distance : <strong>{fmt(Number(f.km_end) - Number(f.km_start))} km</strong></p>}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <label style={{ fontSize: 13, fontWeight: 700, color: "#1d4ed8", whiteSpace: "nowrap" }}>💶 Prix final (€)</label>
          <input
            type="number"
            value={f.totalManuel}
            onChange={e => setF(p => ({ ...p, totalManuel: e.target.value }))}
            placeholder={String(totalAuto)}
            style={{ ...inp, fontWeight: 700, fontSize: 16, color: "#1d4ed8", border: "2px solid #93c5fd", background: "#fff", flex: 1 }}
          />
          {f.totalManuel !== "" && f.totalManuel !== String(totalAuto) && (
            <button onClick={() => setF(p => ({ ...p, totalManuel: "" }))}
              style={{ background: "#dbeafe", color: "#1d4ed8", border: "none", borderRadius: 7, padding: "8px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>
              ↩ Auto ({fmt(totalAuto)}€)
            </button>
          )}
        </div>
      </div>
      <Field label="Notes"><textarea style={{ ...inp, minHeight: 60, resize: "vertical" }} value={f.notes} onChange={s("notes")} /></Field>

      <div style={{ marginTop: 8, marginBottom: 8 }}>
        {[
          { title: "📸 État du véhicule — Départ", keys: [
            { key: "photoDepart1", label: "Photo 1", icon: "📷", accept: "image/*" },
            { key: "photoDepart2", label: "Photo 2", icon: "📷", accept: "image/*" },
            { key: "photoDepart3", label: "Photo 3", icon: "📷", accept: "image/*" },
            { key: "photoDepart4", label: "Photo 4", icon: "📷", accept: "image/*" },
            { key: "videoDepart",  label: "Vidéo",   icon: "🎥", accept: "video/*" },
          ]},
          { title: "📸 État du véhicule — Retour", keys: [
            { key: "photoRetour1", label: "Photo 1", icon: "📷", accept: "image/*" },
            { key: "photoRetour2", label: "Photo 2", icon: "📷", accept: "image/*" },
            { key: "photoRetour3", label: "Photo 3", icon: "📷", accept: "image/*" },
            { key: "photoRetour4", label: "Photo 4", icon: "📷", accept: "image/*" },
            { key: "videoRetour",  label: "Vidéo",   icon: "🎥", accept: "video/*" },
          ]},
        ].map(({ title, keys }) => (
          <div key={title} style={{ marginBottom: 14 }}>
            <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: .4 }}>{title}</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
              {keys.map(({ key, label, icon, accept }) => (
                <div key={key} style={{ background: "#f9fafb", border: "1.5px dashed " + (f[key] ? "#93c5fd" : "#e5e7eb"), borderRadius: 8, padding: "10px 6px", textAlign: "center" }}>
                  <div style={{ fontSize: 20, marginBottom: 4 }}>{f[key] ? (accept === "video/*" ? "🎥" : "🖼️") : icon}</div>
                  <p style={{ margin: "0 0 6px", fontSize: 10, fontWeight: 600, color: f[key] ? "#2563eb" : "#9ca3af", wordBreak: "break-all" }}>{f[key] ? f[key].substring(0, 10) + "…" : label}</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
                    <label style={{ cursor: "pointer", width: "100%" }}>
                      <input type="file" style={{ display: "none" }} accept={accept}
                        onChange={(e) => { const file = e.target.files[0]; if (file) setF(p => ({ ...p, [key]: file.name })); }} />
                      <span style={{ display: "block", background: f[key] ? "#eff6ff" : "#f3f4f6", color: f[key] ? "#2563eb" : "#6b7280", borderRadius: 6, padding: "3px 0", fontSize: 10, fontWeight: 600, cursor: "pointer", textAlign: "center" }}>
                        {f[key] ? "Changer" : "Ajouter"}
                      </span>
                    </label>
                    {f[key] && <button onClick={() => setF(p => ({ ...p, [key]: null }))} style={{ background: "#fee2e2", color: "#dc2626", border: "none", borderRadius: 6, padding: "2px 6px", cursor: "pointer", fontSize: 10, width: "100%" }}>✕ Retirer</button>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 14 }}>
        <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: .4 }}>🔢 Compteur & Carburant</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
          {[
            { key: "photoCompteurDepart", label: "Compteur départ", icon: "🔢" },
            { key: "photoEssenceDepart",  label: "Essence départ",  icon: "⛽" },
            { key: "photoCompteurRetour", label: "Compteur retour", icon: "🔢" },
            { key: "photoEssenceRetour",  label: "Essence retour",  icon: "⛽" },
          ].map(({ key, label, icon }) => (
            <div key={key} style={{ background: "#f9fafb", border: "1.5px dashed " + (f[key] ? "#93c5fd" : "#e5e7eb"), borderRadius: 8, padding: "10px 6px", textAlign: "center" }}>
              <div style={{ fontSize: 20, marginBottom: 4 }}>{f[key] ? "🖼️" : icon}</div>
              <p style={{ margin: "0 0 6px", fontSize: 10, fontWeight: 600, color: f[key] ? "#2563eb" : "#9ca3af" }}>{f[key] ? f[key].substring(0, 10) + "…" : label}</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
                <label style={{ cursor: "pointer", width: "100%" }}>
                  <input type="file" style={{ display: "none" }} accept="image/*"
                    onChange={(e) => { const file = e.target.files[0]; if (file) setF(p => ({ ...p, [key]: file.name })); }} />
                  <span style={{ display: "block", background: f[key] ? "#eff6ff" : "#f3f4f6", color: f[key] ? "#2563eb" : "#6b7280", borderRadius: 6, padding: "3px 0", fontSize: 10, fontWeight: 600, cursor: "pointer" }}>
                    {f[key] ? "Changer" : "Ajouter"}
                  </span>
                </label>
                {f[key] && <button onClick={() => setF(p => ({ ...p, [key]: null }))} style={{ background: "#fee2e2", color: "#dc2626", border: "none", borderRadius: 6, padding: "2px 6px", cursor: "pointer", fontSize: 10, width: "100%" }}>✕ Retirer</button>}
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* PAD SIGNATURE CLIENT */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: .4 }}>✍️ Signature du client</p>
          <div style={{ display: "flex", gap: 6 }}>
            {signatureData && <button onClick={() => setSignatureData(null)} style={{ fontSize: 11, color: "#dc2626", background: "#fee2e2", border: "none", borderRadius: 6, padding: "3px 10px", cursor: "pointer" }}>✕ Effacer</button>}
            <button onClick={() => setShowSignaturePad(!showSignaturePad)} style={{ fontSize: 11, color: "#2563eb", background: "#eff6ff", border: "none", borderRadius: 6, padding: "3px 10px", cursor: "pointer" }}>
              {showSignaturePad ? "Fermer" : signatureData ? "Modifier" : "Signer"}
            </button>
          </div>
        </div>
        {signatureData && !showSignaturePad && (
          <div style={{ border: "1.5px solid #93c5fd", borderRadius: 8, overflow: "hidden", background: "#fff" }}>
            <img src={signatureData} alt="Signature" style={{ width: "100%", height: 80, objectFit: "contain" }} />
          </div>
        )}
        {showSignaturePad && (
          <div style={{ border: "1.5px solid #93c5fd", borderRadius: 8, overflow: "hidden", background: "#fff", position: "relative" }}>
            <canvas
              width={534} height={120}
              style={{ width: "100%", height: 120, cursor: "crosshair", display: "block", touchAction: "none" }}
              ref={el => {
                if (el && !signatureRef.canvas) {
                  signatureRef.canvas = el;
                  signatureRef.ctx = el.getContext("2d");
                  signatureRef.ctx.strokeStyle = "#1d4ed8";
                  signatureRef.ctx.lineWidth = 2.5;
                  signatureRef.ctx.lineCap = "round";
                  signatureRef.ctx.lineJoin = "round";
                  const getPos = (e) => {
                    const rect = el.getBoundingClientRect();
                    const scaleX = el.width / rect.width;
                    const scaleY = el.height / rect.height;
                    const src = e.touches ? e.touches[0] : e;
                    return { x: (src.clientX - rect.left) * scaleX, y: (src.clientY - rect.top) * scaleY };
                  };
                  el.onmousedown = el.ontouchstart = (e) => { e.preventDefault(); signatureRef.drawing = true; const p = getPos(e); signatureRef.ctx.beginPath(); signatureRef.ctx.moveTo(p.x, p.y); };
                  el.onmousemove = el.ontouchmove = (e) => { e.preventDefault(); if (!signatureRef.drawing) return; const p = getPos(e); signatureRef.ctx.lineTo(p.x, p.y); signatureRef.ctx.stroke(); };
                  el.onmouseup = el.onmouseleave = el.ontouchend = () => { signatureRef.drawing = false; };
                } else if (!el) { signatureRef.canvas = null; }
              }}
            />
            <div style={{ display: "flex", gap: 8, padding: "8px 10px", borderTop: "1px solid #e5e7eb", background: "#f9fafb" }}>
              <button onClick={() => { if (signatureRef.ctx && signatureRef.canvas) signatureRef.ctx.clearRect(0, 0, signatureRef.canvas.width, signatureRef.canvas.height); }} style={{ fontSize: 11, color: "#6b7280", background: "#f3f4f6", border: "none", borderRadius: 6, padding: "4px 12px", cursor: "pointer" }}>🗑 Effacer</button>
              <button onClick={() => {
                if (signatureRef.canvas) {
                  // Créer une copie du canvas avec fond blanc pour jsPDF
                  const tmpCanvas = document.createElement("canvas");
                  tmpCanvas.width = signatureRef.canvas.width;
                  tmpCanvas.height = signatureRef.canvas.height;
                  const tmpCtx = tmpCanvas.getContext("2d");
                  tmpCtx.fillStyle = "#ffffff";
                  tmpCtx.fillRect(0, 0, tmpCanvas.width, tmpCanvas.height);
                  tmpCtx.drawImage(signatureRef.canvas, 0, 0);
                  const dataUrl = tmpCanvas.toDataURL("image/jpeg", 0.95);
                  setSignatureData(dataUrl);
                  setShowSignaturePad(false);
                  signatureRef.canvas = null;
                }
              }} style={{ fontSize: 11, color: "#fff", background: "#2563eb", border: "none", borderRadius: 6, padding: "4px 16px", cursor: "pointer", fontWeight: 600 }}>✅ Valider</button>
            </div>
          </div>
        )}
        {!signatureData && !showSignaturePad && <p style={{ margin: 0, fontSize: 11, color: "#9ca3af", fontStyle: "italic" }}>Aucune signature — cliquez sur "Signer"</p>}
      </div>

      {showEmailModal && (
        <div style={{ marginTop: 12, background: "#eff6ff", border: "1.5px solid #93c5fd", borderRadius: 10, padding: "14px 16px" }}>
          <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: "#1d4ed8" }}>📧 Envoyer le contrat par mail</p>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <input
              style={{ ...inp, flex: 1 }}
              value={f.emailDest}
              onChange={e => setF(p => ({ ...p, emailDest: e.target.value }))}
              placeholder={clients.find(x => x.id === Number(f.clientId))?.email || "adresse@email.com"}
            />
            <button onClick={() => {
              const to = f.emailDest || clients.find(x => x.id === Number(f.clientId))?.email || "";
              if (!to) { notify("❌ Aucune adresse email"); return; }
              sendEmailJs(to);
            }} style={{ ...btn, whiteSpace: "nowrap" }}>📤 Envoyer</button>
          </div>
          <p style={{ margin: 0, fontSize: 11, color: "#6b7280" }}>L'email s'ouvre dans votre application mail avec le contenu pré-rempli. Joignez le PDF téléchargé manuellement.</p>
          <button onClick={() => setShowEmailModal(false)} style={{ marginTop: 8, fontSize: 12, color: "#6b7280", background: "none", border: "none", cursor: "pointer" }}>✕ Fermer</button>
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginTop: 12 }}>
        <button onClick={() => setShowEmailModal(!showEmailModal)} style={{ ...btnCancel, display: "flex", alignItems: "center", gap: 6 }}>📧 Envoyer par mail</button>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={btnCancel}>Annuler</button>
          <button onClick={save} disabled={saving} style={{ ...btn, background: saving ? "#93c5fd" : "#2563eb" }}>{saving ? "Enregistrement..." : "Enregistrer"}</button>
        </div>
      </div>
    </div>
  );
}

function MaintenanceForm({ init = {}, onClose, onSave, notify, vehicles }) {
  const [f, setF] = useState({
    vehicleId: init.vehicleId || vehicles[0]?.id || "",
    type: init.type || "Révision complète", date: init.date || "",
    status: init.status || "planifié", cost: init.cost || 0,
    garage: init.garage || "", notes: init.notes || "",
    pj1: init.pj1 || null, pj2: init.pj2 || null, pj3: init.pj3 || null
  });
  const [saving, setSaving] = useState(false);
  const s = (k) => (e) => setF(p => ({ ...p, [k]: e.target.value }));
  const save = async () => {
    setSaving(true);
    const row = { vehicle_id: Number(f.vehicleId), type: f.type, date: f.date, status: f.status, cost: Number(f.cost), garage: f.garage, notes: f.notes, pj_1: f.pj1, pj_2: f.pj2, pj_3: f.pj3 };
    const { error } = init.id
      ? await supabase.from("maintenance").update(row).eq("id", init.id)
      : await supabase.from("maintenance").insert(row);
    if (error) { notify("❌ Erreur : " + error.message); setSaving(false); return; }
    if (!init.id && f.status === "en cours") await supabase.from("vehicles").update({ status: "entretien" }).eq("id", Number(f.vehicleId));
    onClose();
    await onSave();
    notify("✅ Entretien enregistré !");
  };
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Véhicule"><select style={sel} value={f.vehicleId} onChange={s("vehicleId")}>{vehicles.map(v=><option key={v.id} value={v.id}>{v.brand} {v.model}</option>)}</select></Field>
        <Field label="Type"><select style={sel} value={f.type} onChange={s("type")}>{["Révision complète","Vidange","Pneus","Freins","Contrôle technique","Carrosserie","Autre"].map(o=><option key={o}>{o}</option>)}</select></Field>
        <Field label="Date"><input style={inp} type="date" value={f.date} onChange={s("date")} /></Field>
        <Field label="Coût (€)"><input style={inp} type="number" value={f.cost} onChange={s("cost")} /></Field>
        <Field label="Statut"><select style={sel} value={f.status} onChange={s("status")}>{["planifié","en cours","terminé"].map(o=><option key={o}>{o}</option>)}</select></Field>
        <Field label="Garage"><input style={inp} value={f.garage} onChange={s("garage")} placeholder="Nom du garage" /></Field>
      </div>
      <Field label="Notes"><textarea style={{ ...inp, minHeight: 60, resize: "vertical" }} value={f.notes} onChange={s("notes")} /></Field>

      <div style={{ marginTop: 4, marginBottom: 8 }}>
        <p style={{ margin: "0 0 10px", fontSize: 12, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: .4 }}>📎 Pièces jointes</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          {[{key:"pj1",label:"Document 1"},{key:"pj2",label:"Document 2"},{key:"pj3",label:"Document 3"}].map(({ key, label }) => (
            <div key={key} style={{ background: "#f9fafb", border: "1.5px dashed " + (f[key] ? "#93c5fd" : "#e5e7eb"), borderRadius: 8, padding: "10px", textAlign: "center" }}>
              <div style={{ fontSize: 20, marginBottom: 4 }}>{f[key] ? "📎" : "📄"}</div>
              <p style={{ margin: "0 0 6px", fontSize: 10, fontWeight: 600, color: f[key] ? "#2563eb" : "#9ca3af" }}>{f[key] ? f[key].substring(0, 14) + "…" : label}</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ cursor: "pointer" }}>
                  <input type="file" style={{ display: "none" }} accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => { const file = e.target.files[0]; if (file) setF(p => ({ ...p, [key]: file.name })); }} />
                  <span style={{ display: "block", background: f[key] ? "#eff6ff" : "#f3f4f6", color: f[key] ? "#2563eb" : "#6b7280", borderRadius: 6, padding: "3px 0", fontSize: 10, fontWeight: 600, cursor: "pointer" }}>
                    {f[key] ? "Changer" : "Ajouter"}
                  </span>
                </label>
                {f[key] && <button onClick={() => setF(p => ({ ...p, [key]: null }))} style={{ background: "#fee2e2", color: "#dc2626", border: "none", borderRadius: 6, padding: "2px 6px", cursor: "pointer", fontSize: 10 }}>✕ Retirer</button>}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <button onClick={onClose} style={btnCancel}>Annuler</button>
        <button onClick={save} disabled={saving} style={{ ...btn, background: saving ? "#93c5fd" : "#2563eb" }}>{saving ? "Enregistrement..." : "Enregistrer"}</button>
      </div>
    </div>
  );
}

function DocumentForm({ init = {}, onClose, onSave, notify }) {
  const [f, setF] = useState({
    name: init.name || "", description: init.description || "",
    category: init.category || "société", expiryDate: init.expiryDate || "",
    status: init.status || "valide", fileName: init.fileName || null,
    uploadDate: init.uploadDate || new Date().toISOString().slice(0, 10)
  });
  const [saving, setSaving] = useState(false);
  const s = (k) => (e) => setF(p => ({ ...p, [k]: e.target.value }));
  const save = async () => {
    setSaving(true);
    const row = { name: f.name, description: f.description, category: f.category, expiry_date: f.expiryDate || null, status: f.status, file_name: f.fileName, upload_date: f.uploadDate };
    const { error } = init.id
      ? await supabase.from("documents").update(row).eq("id", init.id)
      : await supabase.from("documents").insert(row);
    if (error) { notify("❌ Erreur : " + error.message); setSaving(false); return; }
    onClose();
    await onSave();
    notify("✅ Document enregistré !");
  };
  return (
    <div>
      <Field label="Nom"><input style={inp} value={f.name} onChange={s("name")} placeholder="Ex: Kbis, Carte d'identité..." /></Field>
      <Field label="Description"><input style={inp} value={f.description} onChange={s("description")} placeholder="Courte description" /></Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Catégorie"><select style={sel} value={f.category} onChange={s("category")}>{DOC_CATEGORIES.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></Field>
        <Field label="Statut"><select style={sel} value={f.status} onChange={s("status")}>{["valide","expiré","en attente","à renouveler"].map(o=><option key={o}>{o}</option>)}</select></Field>
        <Field label="Date d'expiration"><input style={inp} type="date" value={f.expiryDate || ""} onChange={s("expiryDate")} /></Field>
        <Field label="Date d'ajout"><input style={inp} type="date" value={f.uploadDate} onChange={s("uploadDate")} /></Field>
      </div>
      <Field label="Fichier">
        <div style={{ border: "2px dashed #e5e7eb", borderRadius: 10, padding: 18, textAlign: "center", cursor: "pointer", background: "#fafafa" }}
          onClick={() => setF(p => ({ ...p, fileName: "doc_" + Date.now() + ".pdf" }))}>
          <p style={{ margin: 0, fontSize: 22 }}>📎</p>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "#6b7280" }}>{f.fileName ? `✅ ${f.fileName}` : "Cliquer pour attacher"}</p>
        </div>
      </Field>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
        <button onClick={onClose} style={btnCancel}>Annuler</button>
        <button onClick={save} disabled={saving} style={{ ...btn, background: saving ? "#93c5fd" : "#2563eb" }}>{saving ? "Enregistrement..." : "Enregistrer"}</button>
      </div>
    </div>
  );
}

// ─── VUES ─────────────────────────────────────────────────────────────────────

const TABS = [
  { id: "dashboard", label: "Tableau de bord", icon: "📊" },
  { id: "vehicles", label: "Véhicules", icon: "🚗" },
  { id: "clients", label: "Clients", icon: "👤" },
  { id: "contracts", label: "Contrats", icon: "📋" },
  { id: "maintenance", label: "Entretien", icon: "🔧" },
  { id: "insurance", label: "Assurance", icon: "🛡️" },
  { id: "documents", label: "Documents", icon: "🗂️" },
  { id: "factures", label: "Factures", icon: "🧾" },
  { id: "comptabilite", label: "Comptabilité", icon: "📈" },
  { id: "amendes", label: "Amendes", icon: "🚨" },
];

function Dashboard({ vehicles, clients, contracts }) {
  const dispo = vehicles.filter(v => v.status === "disponible").length;
  const loue = vehicles.filter(v => v.status === "loué").length;
  const entretien = vehicles.filter(v => v.status === "entretien").length;
  const revCA = contracts.filter(c => c.status === "terminé").reduce((s, c) => s + (c.total || 0), 0);
  const activeContracts = contracts.filter(c => c.status === "actif");
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
        <Stat label="Disponibles" value={dispo} sub={`sur ${vehicles.length}`} color="#10b981" icon="✅" />
        <Stat label="En location" value={loue} sub={`${activeContracts.length} actifs`} color="#3b82f6" icon="🔑" />
        <Stat label="En entretien" value={entretien} sub="Hors service" color="#f59e0b" icon="🔧" />
        <Stat label="CA encaissé" value={fmt(revCA) + "€"} sub="Terminés" color="#8b5cf6" icon="💶" />
        <Stat label="Clients" value={clients.length} sub="Dans la base" color="#ec4899" icon="👥" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #f0f0f0", overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #f5f5f5", display: "flex", justifyContent: "space-between" }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Locations actives</h3>
            <span style={{ fontSize: 12, color: "#6b7280" }}>{activeContracts.length}</span>
          </div>
          {activeContracts.map(c => {
            const client = clients.find(x => x.id === c.clientId);
            const vehicle = vehicles.find(x => x.id === c.vehicleId);
            const remaining = diffDays(new Date().toISOString().slice(0, 10), c.endDate);
            return (
              <div key={c.id} style={{ padding: "14px 20px", borderBottom: "1px solid #fafafa", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <p style={{ margin: "0 0 3px", fontWeight: 600, fontSize: 14 }}>{client?.name}</p>
                  <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>{vehicle?.brand} {vehicle?.model} · {vehicle?.plate}</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ margin: "0 0 3px", fontSize: 12, color: remaining <= 2 ? "#dc2626" : "#6b7280", fontWeight: 600 }}>{remaining > 0 ? `J-${remaining}` : "Dépassé"}</p>
                  <p style={{ margin: 0, fontSize: 12, color: "#9ca3af" }}>jusqu'au {fmtDate(c.endDate)}</p>
                </div>
              </div>
            );
          })}
          {activeContracts.length === 0 && <p style={{ padding: 20, color: "#9ca3af", textAlign: "center" }}>Aucune location active</p>}
        </div>
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #f0f0f0", overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #f5f5f5" }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Entretiens planifiés</h3>
          </div>
          {vehicles.filter(v => v.nextService).sort((a, b) => new Date(a.nextService) - new Date(b.nextService)).map(v => {
            const days = diffDays(new Date().toISOString().slice(0, 10), v.nextService);
            const urgent = days <= 30;
            return (
              <div key={v.id} style={{ padding: "14px 20px", borderBottom: "1px solid #fafafa", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 22 }}>{v.image}</span>
                  <div>
                    <p style={{ margin: "0 0 2px", fontWeight: 600, fontSize: 14 }}>{v.brand} {v.model}</p>
                    <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>{v.plate}</p>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ margin: "0 0 2px", fontSize: 13, fontWeight: 600, color: urgent ? "#dc2626" : "#374151" }}>{days > 0 ? `Dans ${days}j` : "Dépassé"}</p>
                  <p style={{ margin: 0, fontSize: 11, color: urgent ? "#f87171" : "#9ca3af" }}>{fmtDate(v.nextService)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Vehicles({ vehicles, search, setModal }) {
  const filtered = vehicles.filter(v => [v.brand, v.model, v.plate, v.category].some(f => f?.toLowerCase().includes(search.toLowerCase())));
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
      {filtered.map(v => (
        <div key={v.id} style={{ background: "#fff", borderRadius: 14, border: "1px solid #f0f0f0", overflow: "hidden", transition: "transform .15s" }}
          onMouseEnter={e => e.currentTarget.style.transform = "translateY(-2px)"}
          onMouseLeave={e => e.currentTarget.style.transform = ""}>
          <div style={{ background: "linear-gradient(135deg, #1e3a5f, #2563eb)", padding: "18px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p style={{ margin: "0 0 4px", color: "rgba(255,255,255,.7)", fontSize: 12 }}>{v.year} · {v.fuel}</p>
              <h3 style={{ margin: 0, color: "#fff", fontSize: 20, fontWeight: 800 }}>{v.brand}</h3>
              <p style={{ margin: "2px 0 0", color: "rgba(255,255,255,.85)", fontSize: 15 }}>{v.model}</p>
            </div>
            <span style={{ fontSize: 42 }}>{v.image}</span>
          </div>
          <div style={{ padding: "16px 20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 14, background: "#f3f4f6", padding: "4px 10px", borderRadius: 6 }}>{v.plate}</span>
              <Badge status={v.status} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
              <div style={{ background: "#fafafa", borderRadius: 8, padding: "8px 12px" }}>
                <p style={{ margin: "0 0 2px", fontSize: 11, color: "#9ca3af", fontWeight: 600 }}>KM</p>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{fmt(v.km)}</p>
              </div>
              <div style={{ background: "#fafafa", borderRadius: 8, padding: "8px 12px" }}>
                <p style={{ margin: "0 0 2px", fontSize: 11, color: "#9ca3af", fontWeight: 600 }}>TARIF/JOUR</p>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{v.dailyRate}€</p>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <p style={{ margin: 0, fontSize: 12, color: "#9ca3af" }}>Entretien : {fmtDate(v.nextService)}</p>
              {v.phoneGps && <p style={{ margin: "4px 0 0", fontSize: 12, color: "#6b7280" }}>📱 GPS : <a href={`tel:${v.phoneGps}`} style={{ color: "#2563eb", textDecoration: "none", fontWeight: 600 }}>{v.phoneGps}</a></p>}
              <button onClick={() => setModal({ type: "editVehicle", data: v })} style={{ background: "#eff6ff", border: "none", borderRadius: 7, padding: "6px 12px", cursor: "pointer", color: "#2563eb", fontSize: 13, fontWeight: 600 }}>Modifier</button>
            </div>
          </div>
        </div>
      ))}
      {filtered.length === 0 && <p style={{ textAlign: "center", color: "#9ca3af", marginTop: 40, gridColumn: "1/-1" }}>Aucun véhicule</p>}
    </div>
  );
}

function Clients({ clients, contracts, search, setModal }) {
  const filtered = clients.filter(c => [c.name, c.email, c.phone].some(f => f?.toLowerCase().includes(search.toLowerCase())));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {filtered.map(c => {
        const cContracts = contracts.filter(x => x.clientId === c.id);
        const active = cContracts.filter(x => x.status === "actif").length;
        const expired = c.licenseExpiry && new Date(c.licenseExpiry) < new Date();
        return (
          <div key={c.id} style={{ background: "#fff", borderRadius: 12, border: "1px solid #f0f0f0", padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 46, height: 46, borderRadius: "50%", background: "linear-gradient(135deg, #2563eb, #7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 18 }}>{c.name?.charAt(0)}</div>
              <div>
                <p style={{ margin: "0 0 3px", fontWeight: 700, fontSize: 15 }}>{c.name}</p>
                <p style={{ margin: "0 0 2px", fontSize: 13, color: "#6b7280" }}>✉ {c.email} · 📱 {c.phone}</p>
                <p style={{ margin: 0, fontSize: 12, color: expired ? "#dc2626" : "#9ca3af" }}>Permis {c.license} — exp. {fmtDate(c.licenseExpiry)} {expired ? "⚠️ EXPIRÉ" : ""}</p>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ textAlign: "right" }}>
                <p style={{ margin: "0 0 2px", fontSize: 13, fontWeight: 600, color: active > 0 ? "#2563eb" : "#374151" }}>{active > 0 ? `${active} location active` : "Aucune location"}</p>
                <p style={{ margin: 0, fontSize: 12, color: "#9ca3af" }}>{cContracts.length} contrat(s)</p>
                <div style={{ display: "flex", gap: 5, marginTop: 5 }}>
                  {[{doc: c.permisRecto, label:"P.R"},{doc: c.permisVerso, label:"P.V"},{doc: c.carteIdRecto, label:"CI.R"},{doc: c.carteIdVerso, label:"CI.V"}].map(({doc, label}) => (
                    <span key={label} style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 5, background: doc ? "#d1fae5" : "#f3f4f6", color: doc ? "#065f46" : "#9ca3af" }}>{doc ? "✅" : "❌"} {label}</span>
                  ))}
                </div>
              </div>
              <button onClick={() => setModal({ type: "editClient", data: c })} style={{ background: "#eff6ff", border: "none", borderRadius: 7, padding: "6px 12px", cursor: "pointer", color: "#2563eb", fontSize: 13, fontWeight: 600 }}>Modifier</button>
            </div>
          </div>
        );
      })}
      {filtered.length === 0 && <p style={{ textAlign: "center", color: "#9ca3af", marginTop: 40 }}>Aucun client</p>}
    </div>
  );
}

function ContractsView({ contracts, clients, vehicles, search, setModal }) {
  const filtered = contracts.filter(c => {
    const client = clients.find(x => x.id === c.clientId);
    const vehicle = vehicles.find(x => x.id === c.vehicleId);
    return [client?.name, vehicle?.brand, vehicle?.model, vehicle?.plate].some(f => f?.toLowerCase().includes(search.toLowerCase()));
  });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {filtered.sort((a, b) => new Date(b.startDate) - new Date(a.startDate)).map(c => {
        const client = clients.find(x => x.id === c.clientId);
        const vehicle = vehicles.find(x => x.id === c.vehicleId);
        const days = diffDays(c.startDate, c.endDate);
        return (
          <div key={c.id} style={{ background: "#fff", borderRadius: 12, border: "1px solid #f0f0f0", padding: "16px 20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                  <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>#{c.id} — {client?.name}</h4>
                  <Badge status={c.status} />
                </div>
                <p style={{ margin: 0, fontSize: 13, color: "#6b7280" }}>{vehicle?.brand} {vehicle?.model} · {vehicle?.plate}</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ margin: "0 0 3px", fontSize: 18, fontWeight: 800, color: c.status === "terminé" ? "#10b981" : "#2563eb" }}>{fmt(c.total)}€</p>
                <p style={{ margin: 0, fontSize: 12, color: "#9ca3af" }}>{days} jours</p>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <div>
                <span style={{ fontSize: 13, color: "#6b7280" }}>📅 {fmtDate(c.startDate)} → {fmtDate(c.endDate)}</span>
                {c.km_end && <span style={{ fontSize: 12, color: "#6b7280", marginLeft: 10 }}>📍 {fmt(c.km_start)} → {fmt(c.km_end)} km ({fmt(c.km_end - c.km_start)} km parcourus)</span>}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => {
                  const contractForPdf = { id: c.id, clientId: c.clientId, vehicleId: c.vehicleId, startDate: c.startDate, endDate: c.endDate, status: c.status, insurance: c.insurance, deposit: c.deposit, km_start: c.km_start, km_end: c.km_end, dailyRate: c.dailyRate, total: c.total, notes: c.notes };
                  const clientForPdf = clients.find(x => x.id === c.clientId);
                  const vehicleForPdf = vehicles.find(x => x.id === c.vehicleId);
                  const doc = generateContractPDFBlob({ contract: contractForPdf, client: clientForPdf, vehicle: vehicleForPdf });
                  const blob = doc.output("blob");
                  const url = URL.createObjectURL(blob);
                  window.open(url, "_blank");
                }} style={{ background: "#f0fdf4", border: "none", borderRadius: 7, padding: "6px 12px", cursor: "pointer", color: "#16a34a", fontSize: 13, fontWeight: 600 }}>👁 Contrat PDF</button>
                <button onClick={() => {
                  const client = clients.find(x => x.id === c.clientId);
                  const vehicle = vehicles.find(x => x.id === c.vehicleId);
                  const vehicule = `${vehicle?.brand || ""} ${vehicle?.model || ""} (${vehicle?.plate || ""})`;
                  const factureTemp = { id: `C${c.id}`, clientId: c.clientId, contractId: c.id, label: `Location ${vehicule}`, amount: c.total, date: c.startDate, status: c.status === "terminé" ? "payée" : "en attente", notes: "" };
                  generateFacturePDFAuto({ facture: factureTemp, client });
                }} style={{ background: "#fdf4ff", border: "none", borderRadius: 7, padding: "6px 12px", cursor: "pointer", color: "#7c3aed", fontSize: 13, fontWeight: 600 }}>🧾 Facture PDF</button>
                <button onClick={() => setModal({ type: "editContract", data: c })} style={{ background: "#eff6ff", border: "none", borderRadius: 7, padding: "6px 12px", cursor: "pointer", color: "#2563eb", fontSize: 13, fontWeight: 600 }}>Modifier</button>
              </div>
            </div>
          </div>
        );
      })}
      {filtered.length === 0 && <p style={{ textAlign: "center", color: "#9ca3af", marginTop: 40 }}>Aucun contrat</p>}
    </div>
  );
}

function MaintenanceView({ maintenance, vehicles, search, setModal }) {
  const filtered = maintenance.filter(m => {
    const v = vehicles.find(x => x.id === m.vehicleId);
    return [v?.brand, v?.model, m.type, m.garage].some(f => f?.toLowerCase().includes(search.toLowerCase()));
  });
  const total = maintenance.filter(m => m.status === "terminé").reduce((s, m) => s + Number(m.cost || 0), 0);
  return (
    <div>
      <div style={{ background: "linear-gradient(135deg, #1e3a5f, #2563eb)", borderRadius: 12, padding: "20px 24px", color: "#fff", marginBottom: 20 }}>
        <p style={{ margin: "0 0 4px", opacity: .75, fontSize: 13 }}>Coût total entretiens terminés</p>
        <p style={{ margin: 0, fontSize: 30, fontWeight: 800 }}>{fmt(total)}€</p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.sort((a, b) => new Date(b.date) - new Date(a.date)).map(m => {
          const v = vehicles.find(x => x.id === m.vehicleId);
          return (
            <div key={m.id} style={{ background: "#fff", borderRadius: 12, border: "1px solid #f0f0f0", padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 42, height: 42, borderRadius: 10, background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>🔧</div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{m.type}</span>
                    <Badge status={m.status} />
                  </div>
                  <p style={{ margin: 0, fontSize: 13, color: "#6b7280" }}>{v?.brand} {v?.model} · {v?.plate}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: "#9ca3af" }}>{m.garage} · {fmtDate(m.date)}</p>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <p style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{m.cost ? fmt(m.cost) + "€" : "—"}</p>
                <button onClick={() => setModal({ type: "editMaintenance", data: m })} style={{ background: "#eff6ff", border: "none", borderRadius: 7, padding: "6px 12px", cursor: "pointer", color: "#2563eb", fontSize: 13, fontWeight: 600 }}>Modifier</button>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && <p style={{ textAlign: "center", color: "#9ca3af", marginTop: 40 }}>Aucune opération</p>}
      </div>
    </div>
  );
}

function Insurance({ vehicles }) {
  const totalMensuel = vehicles.filter(v => v.insuranceMonthly).reduce((s, v) => s + Number(v.insuranceMonthly), 0);
  const totalAnnuel = totalMensuel * 12;
  const assures = vehicles.filter(v => v.insuranceMonthly).length;

  return (
    <div>
      {/* Stats globales */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 28 }}>
        <Stat label="Total mensuel" value={fmt(totalMensuel) + "€"} sub={`${assures} véhicule(s) assuré(s)`} color="#2563eb" icon="🛡️" />
        <Stat label="Total annuel" value={fmt(totalAnnuel) + "€"} sub="Projection 12 mois" color="#7c3aed" icon="📅" />
        <Stat label="Non renseigné" value={vehicles.length - assures} sub="véhicule(s)" color="#f59e0b" icon="⚠️" />
      </div>

      {/* Liste des véhicules avec leur coût */}
      {vehicles.length > 0 && (
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #f0f0f0", overflow: "hidden", marginBottom: 28 }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #f5f5f5", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>💰 Coût d'assurance par véhicule</h3>
            <span style={{ fontSize: 12, color: "#6b7280" }}>{vehicles.length} véhicule(s)</span>
          </div>
          {vehicles.map(v => (
            <div key={v.id} style={{ padding: "14px 20px", borderBottom: "1px solid #fafafa", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 28 }}>{v.image}</span>
                <div>
                  <p style={{ margin: "0 0 2px", fontWeight: 700, fontSize: 14 }}>{v.brand} {v.model}</p>
                  <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>{v.plate} · {v.year}</p>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                {v.insuranceMonthly ? (
                  <>
                    <p style={{ margin: "0 0 2px", fontSize: 18, fontWeight: 800, color: "#2563eb" }}>{fmt(v.insuranceMonthly)}€<span style={{ fontSize: 12, fontWeight: 400, color: "#9ca3af" }}>/mois</span></p>
                    <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>{fmt(v.insuranceMonthly * 12)}€/an</p>
                  </>
                ) : (
                  <span style={{ fontSize: 12, color: "#f59e0b", fontWeight: 600 }}>⚠️ Non renseigné</span>
                )}
              </div>
            </div>
          ))}
          {/* Ligne total */}
          <div style={{ padding: "14px 20px", background: "#f8f9fc", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: "#374151" }}>TOTAL</p>
            <div style={{ textAlign: "right" }}>
              <p style={{ margin: "0 0 2px", fontSize: 18, fontWeight: 800, color: "#111" }}>{fmt(totalMensuel)}€<span style={{ fontSize: 12, fontWeight: 400, color: "#9ca3af" }}>/mois</span></p>
              <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>{fmt(totalAnnuel)}€/an</p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function DocumentsView({ documents, setModal }) {
  const today = new Date();
  const enriched = documents.map(d => {
    let computedStatus = d.status;
    if (d.expiryDate) {
      const daysLeft = Math.ceil((new Date(d.expiryDate) - today) / 86400000);
      if (daysLeft < 0) computedStatus = "expiré";
      else if (daysLeft <= 60) computedStatus = "à renouveler";
    }
    return { ...d, computedStatus };
  });
  const expiringSoon = enriched.filter(d => d.computedStatus === "à renouveler").length;
  const expired = enriched.filter(d => d.computedStatus === "expiré").length;
  const valid = enriched.filter(d => d.computedStatus === "valide").length;
  return (
    <div>
      {(expiringSoon > 0 || expired > 0) && (
        <div style={{ marginBottom: 20, display: "flex", flexDirection: "column", gap: 10 }}>
          {expired > 0 && <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 10, padding: "12px 18px", display: "flex", gap: 10 }}><span>🚨</span><p style={{ margin: 0, fontSize: 14, color: "#991b1b", fontWeight: 600 }}>{expired} document(s) expiré(s)</p></div>}
          {expiringSoon > 0 && <div style={{ background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: 10, padding: "12px 18px", display: "flex", gap: 10 }}><span>⚠️</span><p style={{ margin: 0, fontSize: 14, color: "#92400e", fontWeight: 600 }}>{expiringSoon} document(s) à renouveler bientôt</p></div>}
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
        {[{n:valid,l:"Valides",bg:"#d1fae5",i:"✅"},{n:expiringSoon,l:"À renouveler",bg:"#fef3c7",i:"⏳"},{n:expired,l:"Expirés",bg:"#fee2e2",i:"❌"}].map(s=>(
          <div key={s.l} style={{ background: "#fff", borderRadius: 12, border: "1px solid #f0f0f0", padding: "16px 20px", display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: s.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{s.i}</div>
            <div><p style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>{s.n}</p><p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>{s.l}</p></div>
          </div>
        ))}
      </div>
      {DOC_CATEGORIES.map(cat => {
        const catDocs = enriched.filter(d => d.category === cat.id);
        if (catDocs.length === 0) return null;
        return (
          <div key={cat.id} style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: cat.color + "18", display: "flex", alignItems: "center", justifyContent: "center" }}>{cat.icon}</div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{cat.label}</h3>
              <span style={{ fontSize: 12, color: "#9ca3af", background: "#f3f4f6", padding: "2px 8px", borderRadius: 10 }}>{catDocs.length}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {catDocs.map(d => {
                const sc = STATUS_COLORS[d.computedStatus] || STATUS_COLORS["valide"];
                const daysLeft = d.expiryDate ? Math.ceil((new Date(d.expiryDate) - today) / 86400000) : null;
                return (
                  <div key={d.id} style={{ background: "#fff", borderRadius: 12, border: "1px solid #f0f0f0", padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 10, background: d.fileName ? "#eff6ff" : "#f9fafb", border: "1.5px dashed " + (d.fileName ? "#93c5fd" : "#e5e7eb"), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{d.fileName ? "📄" : "📭"}</div>
                      <div>
                        <p style={{ margin: "0 0 3px", fontWeight: 700, fontSize: 14 }}>{d.name}</p>
                        <p style={{ margin: "0 0 2px", fontSize: 12, color: "#6b7280" }}>{d.description}</p>
                        <p style={{ margin: 0, fontSize: 11, color: "#9ca3af" }}>Ajouté le {fmtDate(d.uploadDate)}</p>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                      <div style={{ textAlign: "right" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 20, background: sc.bg, fontSize: 12, fontWeight: 600, color: sc.text }}>
                          <span style={{ width: 7, height: 7, borderRadius: "50%", background: sc.dot }} />
                          {d.computedStatus.charAt(0).toUpperCase() + d.computedStatus.slice(1)}
                        </span>
                        {d.expiryDate && <p style={{ margin: "4px 0 0", fontSize: 11, color: daysLeft < 0 ? "#dc2626" : daysLeft <= 60 ? "#d97706" : "#9ca3af", textAlign: "right" }}>{daysLeft < 0 ? `Expiré depuis ${Math.abs(daysLeft)}j` : `Expire le ${fmtDate(d.expiryDate)}`}</p>}
                      </div>
                      <button onClick={() => setModal({ type: "editDocument", data: d })} style={{ background: "#eff6ff", border: "none", borderRadius: 7, padding: "6px 12px", cursor: "pointer", color: "#2563eb", fontSize: 13, fontWeight: 600 }}>Modifier</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      {documents.length === 0 && <p style={{ textAlign: "center", color: "#9ca3af", marginTop: 40 }}>Aucun document. Cliquez sur "+ Ajouter un document"</p>}
    </div>
  );
}

// ─── APP PRINCIPAL ─────────────────────────────────────────────────────────────


const CORRECT_PIN = "1234"; // ← Change ce code ici

function PinLock({ onUnlock }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);

  const handleKey = (digit) => {
    if (pin.length >= 4) return;
    const newPin = pin + digit;
    setPin(newPin);
    setError(false);
    if (newPin.length === 4) {
      setTimeout(() => {
        if (newPin === CORRECT_PIN) {
          onUnlock();
        } else {
          setShake(true);
          setError(true);
          setTimeout(() => { setPin(""); setShake(false); }, 600);
        }
      }, 150);
    }
  };

  const handleDelete = () => {
    setPin(p => p.slice(0, -1));
    setError(false);
  };

  const dots = Array.from({ length: 4 }, (_, i) => i < pin.length);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "linear-gradient(135deg, #0f2447, #1e3a5f, #2563eb)", fontFamily: "\'DM Sans\', \'Segoe UI\', sans-serif" }}>
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
        .pin-key:hover { background: rgba(255,255,255,0.2) !important; transform: scale(1.05); }
        .pin-key:active { transform: scale(0.95) !important; }
      `}</style>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 32 }}>
        {/* Logo */}
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 52, marginBottom: 8 }}>🚘</div>
          <h1 style={{ margin: 0, color: "#fff", fontSize: 26, fontWeight: 900, letterSpacing: -0.5 }}>FleetManager</h1>
          <p style={{ margin: "6px 0 0", color: "rgba(255,255,255,0.5)", fontSize: 14 }}>Entrez votre code PIN</p>
        </div>

        {/* Points */}
        <div style={{ display: "flex", gap: 16, animation: shake ? "shake 0.5s ease" : "none" }}>
          {dots.map((filled, i) => (
            <div key={i} style={{
              width: 16, height: 16, borderRadius: "50%",
              background: filled ? (error ? "#ef4444" : "#fff") : "rgba(255,255,255,0.25)",
              border: "2px solid " + (filled ? (error ? "#ef4444" : "#fff") : "rgba(255,255,255,0.4)"),
              transition: "all 0.15s ease",
              transform: filled ? "scale(1.15)" : "scale(1)"
            }} />
          ))}
        </div>

        {error && <p style={{ margin: "-16px 0 0", color: "#fca5a5", fontSize: 13, fontWeight: 600 }}>Code incorrect</p>}

        {/* Clavier */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {["1","2","3","4","5","6","7","8","9","","0","⌫"].map((key, i) => (
            key === "" ? <div key={i} /> :
            <button key={i} className="pin-key" onClick={() => key === "⌫" ? handleDelete() : handleKey(key)}
              style={{
                width: 72, height: 72, borderRadius: "50%", border: "none",
                background: key === "⌫" ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.12)",
                color: "#fff", fontSize: key === "⌫" ? 22 : 24, fontWeight: 600,
                cursor: "pointer", transition: "all 0.15s ease",
                display: "flex", alignItems: "center", justifyContent: "center"
              }}>
              {key}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}


// ─── FORMULAIRE FACTURE ───────────────────────────────────────────────────────
function FactureForm({ init = {}, onClose, onSave, notify, contracts, clients }) {
  const annee = new Date().getFullYear();
  const [f, setF] = useState({
    contractId: init.contractId || "",
    clientId: init.clientId || clients[0]?.id || "",
    numero: init.numero || `FAC-${annee}-${String(Math.floor(Math.random()*900)+100)}`,
    date: init.date || new Date().toISOString().slice(0, 10),
    status: init.status || "en attente",
    notes: init.notes || "",
    lignes: init.lignes?.length ? init.lignes : [{ description: "", quantite: 1, prixUnitaire: "" }],
  });
  const [saving, setSaving] = useState(false);
  const s = (k) => (e) => setF(p => ({ ...p, [k]: e.target.value }));

  const totalHT = f.lignes.reduce((s, l) => s + (Number(l.quantite) * Number(l.prixUnitaire) || 0), 0);
  const totalTVA = Math.round(totalHT * 0.20 * 100) / 100;
  const totalTTC = Math.round((totalHT + totalTVA) * 100) / 100;

  const updateLigne = (i, key, val) => setF(p => {
    const lignes = [...p.lignes];
    lignes[i] = { ...lignes[i], [key]: val };
    return { ...p, lignes };
  });
  const addLigne = () => setF(p => ({ ...p, lignes: [...p.lignes, { description: "", quantite: 1, prixUnitaire: "" }] }));
  const removeLigne = (i) => setF(p => ({ ...p, lignes: p.lignes.filter((_, idx) => idx !== i) }));

  const save = async () => {
    setSaving(true);
    const row = {
      contract_id: f.contractId ? Number(f.contractId) : null,
      client_id: Number(f.clientId),
      numero: f.numero,
      label: f.lignes.map(l => l.description).filter(Boolean).join(", ") || "Facture",
      amount: totalTTC,
      date: f.date,
      status: f.status,
      notes: f.notes,
      lignes: JSON.stringify(f.lignes),
    };
    const { error } = init.id
      ? await supabase.from("factures").update(row).eq("id", init.id)
      : await supabase.from("factures").insert(row);
    if (error) { notify("❌ Erreur : " + error.message); setSaving(false); return; }
    onClose(); await onSave(); notify("✅ Facture enregistrée !");
  };

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Client"><select style={sel} value={f.clientId} onChange={s("clientId")}>{clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <Field label="N° Facture"><input style={inp} value={f.numero} onChange={s("numero")} placeholder="FAC-2026-001" /></Field>
        <Field label="Date"><input style={inp} type="date" value={f.date} onChange={s("date")} /></Field>
        <Field label="Statut"><select style={sel} value={f.status} onChange={s("status")}>{["en attente","payée","annulée"].map(o=><option key={o}>{o}</option>)}</select></Field>
        <Field label="Contrat lié (optionnel)" style={{ gridColumn: "1/-1" }}>
          <select style={sel} value={f.contractId} onChange={s("contractId")}>
            <option value="">— Aucun —</option>
            {contracts.map(c=><option key={c.id} value={c.id}>Contrat #{c.id}</option>)}
          </select>
        </Field>
      </div>

      {/* Lignes de prestation */}
      <div style={{ marginTop: 8, marginBottom: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: .4 }}>📋 Lignes de prestation</p>
          <button onClick={addLigne} style={{ fontSize: 12, color: "#2563eb", background: "#eff6ff", border: "none", borderRadius: 6, padding: "4px 12px", cursor: "pointer", fontWeight: 600 }}>+ Ajouter une ligne</button>
        </div>

        {/* En-tête tableau */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 100px 32px", gap: 6, marginBottom: 4 }}>
          <p style={{ margin: 0, fontSize: 11, color: "#9ca3af", fontWeight: 600 }}>DESCRIPTION</p>
          <p style={{ margin: 0, fontSize: 11, color: "#9ca3af", fontWeight: 600 }}>QTÉ</p>
          <p style={{ margin: 0, fontSize: 11, color: "#9ca3af", fontWeight: 600 }}>PRIX U. HT (€)</p>
          <p style={{ margin: 0 }}></p>
        </div>

        {f.lignes.map((l, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 80px 100px 32px", gap: 6, marginBottom: 6 }}>
            <input style={inp} value={l.description} onChange={e => updateLigne(i, "description", e.target.value)} placeholder="Ex: Location véhicule, Assurance..." />
            <input style={{ ...inp, textAlign: "center" }} type="number" min="1" value={l.quantite} onChange={e => updateLigne(i, "quantite", e.target.value)} />
            <input style={inp} type="number" value={l.prixUnitaire} onChange={e => updateLigne(i, "prixUnitaire", e.target.value)} placeholder="0.00" />
            <button onClick={() => removeLigne(i)} style={{ background: "#fee2e2", color: "#dc2626", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 14, fontWeight: 700 }}>✕</button>
          </div>
        ))}

        {/* Totaux */}
        <div style={{ background: "#f8f9fc", borderRadius: 10, padding: "12px 16px", marginTop: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 13, color: "#6b7280" }}>Total HT</span>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{totalHT.toLocaleString("fr-FR")} €</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 13, color: "#6b7280" }}>TVA 20%</span>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{totalTVA.toLocaleString("fr-FR")} €</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #e5e7eb", paddingTop: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: "#111" }}>Total TTC</span>
            <span style={{ fontSize: 15, fontWeight: 800, color: "#2563eb" }}>{totalTTC.toLocaleString("fr-FR")} €</span>
          </div>
        </div>
      </div>

      <Field label="Notes"><textarea style={{ ...inp, minHeight: 50, resize: "vertical" }} value={f.notes} onChange={s("notes")} /></Field>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
        <button onClick={onClose} style={btnCancel}>Annuler</button>
        <button onClick={save} disabled={saving} style={{ ...btn, background: saving ? "#93c5fd" : "#2563eb" }}>{saving ? "Enregistrement..." : "Enregistrer"}</button>
      </div>
    </div>
  );
}

// ─── VUE FACTURES ─────────────────────────────────────────────────────────────
function FacturesView({ factures, contracts, clients, setModal, notify, refresh }) {
  const total = factures.reduce((s, f) => s + Number(f.amount || 0), 0);
  const payees = factures.filter(f => f.status === "payée");
  const attente = factures.filter(f => f.status === "en attente");
  const totalPayé = payees.reduce((s, f) => s + Number(f.amount || 0), 0);
  const totalAttente = attente.reduce((s, f) => s + Number(f.amount || 0), 0);

  const generateFacturePDF = (facture) => {
    const { jsPDF: J } = window.jspdf || {};
    const doc = new jsPDF();
    const blue = [37, 99, 235]; const gray = [107, 114, 128]; const dark = [17,17,17]; const light = [243,244,246];
    const client = clients.find(x => x.id === facture.clientId);
    const contract = contracts.find(x => x.id === facture.contractId);
    const fmtD = (d) => d ? new Date(d).toLocaleDateString("fr-FR") : "—";
    const fmtN = (n) => n != null ? Number(n).toLocaleString("fr-FR") : "—";

    doc.setFillColor(...blue); doc.rect(0, 0, 210, 38, "F");
    doc.setTextColor(255,255,255); doc.setFontSize(22); doc.setFont("helvetica","bold");
    doc.text("FACTURE", 14, 16);
    doc.setFontSize(11); doc.setFont("helvetica","normal");
    doc.text("FleetManager — Gestion de flotte", 14, 24);
    doc.setFontSize(10); doc.text(`N° FAC-${String(facture.id).padStart(4,"0")} — ${fmtD(new Date())}`, 14, 31);

    const sc = facture.status === "payée" ? [16,185,129] : facture.status === "annulée" ? [239,68,68] : [245,158,11];
    doc.setFillColor(...sc); doc.roundedRect(150,10,46,12,3,3,"F");
    doc.setTextColor(255,255,255); doc.setFontSize(9); doc.setFont("helvetica","bold");
    doc.text(facture.status.toUpperCase(), 173, 18, { align: "center" });

    let y = 50;
    doc.setFillColor(...light); doc.rect(14,y,182,7,"F");
    doc.setTextColor(...blue); doc.setFontSize(9); doc.setFont("helvetica","bold");
    doc.text("CLIENT", 17, y+5); y += 11;
    doc.setTextColor(...dark); doc.setFontSize(11); doc.setFont("helvetica","bold");
    doc.text(client?.name || "—", 14, y); y += 7;
    doc.setFontSize(9); doc.setFont("helvetica","normal"); doc.setTextColor(...gray);
    doc.text(client?.email || "", 14, y); doc.text(client?.phone || "", 120, y); y += 14;

    doc.setFillColor(...light); doc.rect(14,y,182,7,"F");
    doc.setTextColor(...blue); doc.setFontSize(9); doc.setFont("helvetica","bold");
    doc.text("DÉTAIL DE LA FACTURE", 17, y+5); y += 14;
    doc.setTextColor(...dark); doc.setFontSize(10); doc.setFont("helvetica","bold");
    doc.text(facture.label || "—", 14, y); y += 7;
    doc.setFontSize(9); doc.setFont("helvetica","normal"); doc.setTextColor(...gray);
    doc.text(`Date : ${fmtD(facture.date)}`, 14, y);
    if (contract) doc.text(`Contrat référencé : #${contract.id}`, 100, y);
    y += 20;

    const mTTC = Number(facture.amount) || 0;
    const mHT = Math.round((mTTC / 1.2) * 100) / 100;
    const mTVA = Math.round((mTTC - mHT) * 100) / 100;

    doc.setFillColor(...light); doc.rect(100,y,96,8,"F");
    doc.setTextColor(...gray); doc.setFontSize(8); doc.setFont("helvetica","normal");
    doc.text("Montant HT", 104, y+5.5);
    doc.setTextColor(...dark); doc.setFont("helvetica","bold");
    doc.text(`${fmtN(mHT)} €`, 192, y+5.5, { align: "right" });
    y += 9;

    doc.setFillColor(255,255,255); doc.rect(100,y,96,8,"F");
    doc.setDrawColor(230,230,230); doc.setLineWidth(0.3); doc.rect(100,y,96,8);
    doc.setTextColor(...gray); doc.setFontSize(8); doc.setFont("helvetica","normal");
    doc.text("TVA 20%", 104, y+5.5);
    doc.setTextColor(...dark); doc.setFont("helvetica","bold");
    doc.text(`${fmtN(mTVA)} €`, 192, y+5.5, { align: "right" });
    y += 10;

    doc.setFillColor(...blue); doc.roundedRect(100,y,96,16,3,3,"F");
    doc.setTextColor(255,255,255); doc.setFontSize(10); doc.setFont("helvetica","normal");
    doc.text("TOTAL TTC", 104, y+7);
    doc.setFontSize(16); doc.setFont("helvetica","bold");
    doc.text(`${fmtN(mTTC)} €`, 192, y+12, { align: "right" });
    y += 26;

    if (facture.notes) {
      doc.setFillColor(...light); doc.rect(14,y,182,7,"F");
      doc.setTextColor(...blue); doc.setFontSize(9); doc.setFont("helvetica","bold");
      doc.text("NOTES", 17, y+5); y += 12;
      doc.setTextColor(...dark); doc.setFontSize(9); doc.setFont("helvetica","normal");
      const lines = doc.splitTextToSize(facture.notes, 178);
      doc.text(lines, 14, y); y += lines.length * 5 + 10;
    }

    y = Math.max(y + 20, 230);
    doc.setDrawColor(200,200,200); doc.line(14,y,90,y); doc.line(120,y,196,y);
    doc.setTextColor(...gray); doc.setFontSize(8); doc.setFont("helvetica","normal");
    doc.text("Signature du client", 52, y+5, { align:"center" });
    doc.text("Signature & cachet", 158, y+5, { align:"center" });

    doc.setFillColor(...light); doc.rect(0,282,210,15,"F");
    doc.setTextColor(...gray); doc.setFontSize(7);
    doc.text(`FAC-${String(facture.id).padStart(4,"0")} — FleetManager — ${fmtD(new Date())}`, 105, 289, { align:"center" });

    const nomClient = (client?.name || "client").replace(/\s+/g,"-");
    doc.save(`facture-${fmtD(facture.date).replace(/\//g,"-")}_${nomClient}.pdf`);
  };

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
        <Stat label="Total facturé" value={fmt(total) + "€"} color="#2563eb" icon="🧾" />
        <Stat label="Encaissé" value={fmt(totalPayé) + "€"} sub={`${payees.length} facture(s)`} color="#10b981" icon="✅" />
        <Stat label="En attente" value={fmt(totalAttente) + "€"} sub={`${attente.length} facture(s)`} color="#f59e0b" icon="⏳" />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {factures.sort((a,b) => new Date(b.date) - new Date(a.date)).map(f => {
          const client = clients.find(x => x.id === f.clientId);
          const sc = STATUS_COLORS[f.status] || STATUS_COLORS["en attente"];
          return (
            <div key={f.id} style={{ background: "#fff", borderRadius: 12, border: "1px solid #f0f0f0", padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>🧾</div>
                <div>
                  <p style={{ margin: "0 0 3px", fontWeight: 700, fontSize: 14 }}>{f.label || "Sans libellé"}</p>
                  <p style={{ margin: "0 0 2px", fontSize: 13, color: "#6b7280" }}>{client?.name} · {fmtDate(f.date)}</p>
                  {f.contractId && <p style={{ margin: 0, fontSize: 12, color: "#9ca3af" }}>Contrat #{f.contractId}</p>}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Badge status={f.status} />
                <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#111" }}>{fmt(f.amount)}€</p>
                <button onClick={() => generateFacturePDF(f)} style={{ background: "#f0fdf4", border: "none", borderRadius: 7, padding: "6px 12px", cursor: "pointer", color: "#16a34a", fontSize: 13, fontWeight: 600 }}>📄 PDF</button>
                <button onClick={() => setModal({ type: "editFacture", data: f })} style={{ background: "#eff6ff", border: "none", borderRadius: 7, padding: "6px 12px", cursor: "pointer", color: "#2563eb", fontSize: 13, fontWeight: 600 }}>Modifier</button>
              </div>
            </div>
          );
        })}
        {factures.length === 0 && <p style={{ textAlign: "center", color: "#9ca3af", marginTop: 40 }}>Aucune facture. Cliquez sur "+ Nouvelle facture"</p>}
      </div>
    </div>
  );
}

// ─── VUE COMPTABILITÉ ─────────────────────────────────────────────────────────
function ComptabiliteView({ contracts, maintenance, factures, amendes }) {
  const now = new Date();
  const mois = now.getMonth();
  const annee = now.getFullYear();
  const isMois = (d) => { const dt = new Date(d); return dt.getMonth() === mois && dt.getFullYear() === annee; };

  const caTotal = contracts.filter(c => c.status === "terminé").reduce((s, c) => s + Number(c.total || 0), 0);
  const caMois = contracts.filter(c => c.status === "terminé" && isMois(c.endDate)).reduce((s, c) => s + Number(c.total || 0), 0);
  const chargesTotal = maintenance.filter(m => m.status === "terminé").reduce((s, m) => s + Number(m.cost || 0), 0);
  const chargesMois = maintenance.filter(m => m.status === "terminé" && isMois(m.date)).reduce((s, m) => s + Number(m.cost || 0), 0);
  const facturesPayees = factures.filter(f => f.status === "payée").reduce((s, f) => s + Number(f.amount || 0), 0);
  const facturesAttente = factures.filter(f => f.status === "en attente").reduce((s, f) => s + Number(f.amount || 0), 0);
  const amendesTotal = amendes.reduce((s, a) => s + Number(a.amount || 0), 0);
  const amendesPayees = amendes.filter(a => a.status === "payée").reduce((s, a) => s + Number(a.amount || 0), 0);
  const benefice = caTotal - chargesTotal - amendesPayees;

  const moisLabels = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];
  const moisData = moisLabels.map((label, i) => {
    const rev = contracts.filter(c => c.status === "terminé" && new Date(c.endDate).getMonth() === i && new Date(c.endDate).getFullYear() === annee).reduce((s, c) => s + Number(c.total || 0), 0);
    const dep = maintenance.filter(m => m.status === "terminé" && new Date(m.date).getMonth() === i && new Date(m.date).getFullYear() === annee).reduce((s, m) => s + Number(m.cost || 0), 0);
    return { label, rev, dep };
  });
  const maxVal = Math.max(...moisData.map(m => Math.max(m.rev, m.dep)), 1);

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 28 }}>
        <Stat label="CA total" value={fmt(caTotal) + "€"} sub="Contrats terminés" color="#2563eb" icon="💶" />
        <Stat label="CA ce mois" value={fmt(caMois) + "€"} color="#3b82f6" icon="📅" />
        <Stat label="Charges total" value={fmt(chargesTotal) + "€"} sub="Entretiens terminés" color="#f59e0b" icon="🔧" />
        <Stat label="Charges ce mois" value={fmt(chargesMois) + "€"} color="#f97316" icon="📉" />
        <Stat label="Bénéfice net" value={fmt(benefice) + "€"} sub="CA − charges − amendes" color={benefice >= 0 ? "#10b981" : "#ef4444"} icon={benefice >= 0 ? "📈" : "📉"} />
        <Stat label="Amendes" value={fmt(amendesTotal) + "€"} sub={`${fmt(amendesPayees)}€ payés`} color="#ef4444" icon="🚨" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #f0f0f0", padding: "20px" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700 }}>Factures</h3>
          {[
            { label: "Payées", value: facturesPayees, color: "#10b981", pct: facturesPayees + facturesAttente > 0 ? facturesPayees / (facturesPayees + facturesAttente) * 100 : 0 },
            { label: "En attente", value: facturesAttente, color: "#f59e0b", pct: facturesPayees + facturesAttente > 0 ? facturesAttente / (facturesPayees + facturesAttente) * 100 : 0 },
          ].map(r => (
            <div key={r.label} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 13, color: "#6b7280" }}>{r.label}</span>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{fmt(r.value)}€</span>
              </div>
              <div style={{ background: "#f3f4f6", borderRadius: 4, height: 8 }}>
                <div style={{ background: r.color, borderRadius: 4, height: 8, width: `${r.pct}%`, transition: "width .5s" }} />
              </div>
            </div>
          ))}
        </div>

        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #f0f0f0", padding: "20px" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700 }}>Répartition charges vs revenus</h3>
          {[
            { label: "Revenus locations", value: caTotal, color: "#2563eb" },
            { label: "Charges entretien", value: chargesTotal, color: "#f59e0b" },
            { label: "Amendes", value: amendesPayees, color: "#ef4444" },
          ].map(r => (
            <div key={r.label} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 13, color: "#6b7280" }}>{r.label}</span>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{fmt(r.value)}€</span>
              </div>
              <div style={{ background: "#f3f4f6", borderRadius: 4, height: 8 }}>
                <div style={{ background: r.color, borderRadius: 4, height: 8, width: caTotal > 0 ? `${Math.min(r.value / caTotal * 100, 100)}%` : "0%", transition: "width .5s" }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #f0f0f0", padding: "20px" }}>
        <h3 style={{ margin: "0 0 20px", fontSize: 15, fontWeight: 700 }}>Revenus & Charges par mois — {annee}</h3>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 140 }}>
          {moisData.map(({ label, rev, dep }) => (
            <div key={label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
              <div style={{ width: "100%", display: "flex", gap: 2, alignItems: "flex-end", height: 110 }}>
                <div style={{ flex: 1, background: "#2563eb", borderRadius: "3px 3px 0 0", height: `${(rev / maxVal) * 100}%`, minHeight: rev > 0 ? 4 : 0 }} title={`Revenus: ${fmt(rev)}€`} />
                <div style={{ flex: 1, background: "#f59e0b", borderRadius: "3px 3px 0 0", height: `${(dep / maxVal) * 100}%`, minHeight: dep > 0 ? 4 : 0 }} title={`Charges: ${fmt(dep)}€`} />
              </div>
              <span style={{ fontSize: 9, color: "#9ca3af" }}>{label}</span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 16, marginTop: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}><div style={{ width: 12, height: 12, borderRadius: 3, background: "#2563eb" }} /><span style={{ fontSize: 12, color: "#6b7280" }}>Revenus</span></div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}><div style={{ width: 12, height: 12, borderRadius: 3, background: "#f59e0b" }} /><span style={{ fontSize: 12, color: "#6b7280" }}>Charges</span></div>
        </div>
      </div>
    </div>
  );
}

// ─── FORMULAIRE AMENDE ────────────────────────────────────────────────────────
function AmendeForm({ init = {}, onClose, onSave, notify, contracts, clients, vehicles }) {
  const [f, setF] = useState({
    contractId: init.contractId || "",
    clientId: init.clientId || clients[0]?.id || "",
    vehicleId: init.vehicleId || vehicles[0]?.id || "",
    date: init.date || new Date().toISOString().slice(0, 10),
    amount: init.amount || "",
    description: init.description || "",
    reference: init.reference || "",
    status: init.status || "en attente",
    notes: init.notes || "",
    pieceJointe1: init.pieceJointe1 || null,
    pieceJointe2: init.pieceJointe2 || null,
    pieceJointe3: init.pieceJointe3 || null,
    lienAntai: init.lienAntai || "",
    lienFps: init.lienFps || "",
  });
  const [saving, setSaving] = useState(false);
  const s = (k) => (e) => setF(p => ({ ...p, [k]: e.target.value }));
  const save = async () => {
    setSaving(true);
    const row = { contract_id: f.contractId ? Number(f.contractId) : null, client_id: Number(f.clientId), vehicle_id: Number(f.vehicleId), date: f.date, amount: Number(f.amount), description: f.description, reference: f.reference, status: f.status, notes: f.notes, piece_jointe_1: f.pieceJointe1, piece_jointe_2: f.pieceJointe2, piece_jointe_3: f.pieceJointe3, lien_antai: f.lienAntai || null, lien_fps: f.lienFps || null };
    const { error } = init.id
      ? await supabase.from("amendes").update(row).eq("id", init.id)
      : await supabase.from("amendes").insert(row);
    if (error) { notify("❌ Erreur : " + error.message); setSaving(false); return; }
    onClose(); await onSave(); notify("✅ Amende enregistrée !");
  };
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Client"><select style={sel} value={f.clientId} onChange={s("clientId")}>{clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <Field label="Véhicule"><select style={sel} value={f.vehicleId} onChange={s("vehicleId")}>{vehicles.map(v=><option key={v.id} value={v.id}>{v.brand} {v.model} — {v.plate}</option>)}</select></Field>
        <Field label="Contrat lié (optionnel)">
          <select style={sel} value={f.contractId} onChange={s("contractId")}>
            <option value="">— Aucun —</option>
            {contracts.map(c=><option key={c.id} value={c.id}>Contrat #{c.id}</option>)}
          </select>
        </Field>
        <Field label="Date"><input style={inp} type="date" value={f.date} onChange={s("date")} /></Field>
        <Field label="Montant (€)"><input style={inp} type="number" value={f.amount} onChange={s("amount")} placeholder="0" /></Field>
        <Field label="Référence"><input style={inp} value={f.reference} onChange={s("reference")} placeholder="N° avis de contravention" /></Field>
        <Field label="Statut"><select style={sel} value={f.status} onChange={s("status")}>{["en attente","payée","contestée","annulée"].map(o=><option key={o}>{o}</option>)}</select></Field>
      </div>
      <Field label="Description"><input style={inp} value={f.description} onChange={s("description")} placeholder="Ex: Excès de vitesse, stationnement interdit..." /></Field>
      <Field label="Notes"><textarea style={{ ...inp, minHeight: 60, resize: "vertical" }} value={f.notes} onChange={s("notes")} /></Field>

      <div style={{ marginTop: 4, marginBottom: 8 }}>
        <p style={{ margin: "0 0 10px", fontSize: 12, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: .4 }}>📎 Pièces jointes</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          {[
            { key: "pieceJointe1", label: "Document 1", icon: "📄" },
            { key: "pieceJointe2", label: "Document 2", icon: "📄" },
            { key: "pieceJointe3", label: "Document 3", icon: "📄" },
          ].map(({ key, label, icon }) => (
            <div key={key} style={{ background: "#f9fafb", border: "1.5px dashed " + (f[key] ? "#93c5fd" : "#e5e7eb"), borderRadius: 8, padding: "10px 10px", textAlign: "center" }}>
              <div style={{ fontSize: 20, marginBottom: 4 }}>{f[key] ? "📎" : icon}</div>
              <p style={{ margin: "0 0 6px", fontSize: 10, fontWeight: 600, color: f[key] ? "#2563eb" : "#9ca3af" }}>{f[key] ? f[key].substring(0, 14) + "…" : label}</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
                <label style={{ cursor: "pointer", width: "100%" }}>
                  <input type="file" style={{ display: "none" }} accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => { const file = e.target.files[0]; if (file) setF(p => ({ ...p, [key]: file.name })); }} />
                  <span style={{ display: "block", background: f[key] ? "#eff6ff" : "#f3f4f6", color: f[key] ? "#2563eb" : "#6b7280", borderRadius: 6, padding: "3px 0", fontSize: 10, fontWeight: 600, cursor: "pointer" }}>
                    {f[key] ? "Changer" : "Ajouter"}
                  </span>
                </label>
                {f[key] && <button onClick={() => setF(p => ({ ...p, [key]: null }))} style={{ background: "#fee2e2", color: "#dc2626", border: "none", borderRadius: 6, padding: "2px 6px", cursor: "pointer", fontSize: 10, width: "100%" }}>✕ Retirer</button>}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 8, marginBottom: 8 }}>
        <p style={{ margin: "0 0 10px", fontSize: 12, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: .4 }}>🔗 Liens officiels</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[
            { key: "lienAntai", label: "Lien ANTAI", icon: "🏛️", placeholder: "https://www.antai.gouv.fr/...", color: "#2563eb" },
            { key: "lienFps", label: "Lien FPS (Forfait Post-Stationnement)", icon: "🅿️", placeholder: "https://fps.antai.gouv.fr/...", color: "#7c3aed" },
          ].map(({ key, label, icon, placeholder, color }) => (
            <div key={key} style={{ background: "#f9fafb", border: "1.5px solid #e5e7eb", borderRadius: 8, padding: "12px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span>{icon}</span>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#374151" }}>{label}</p>
                {f[key] && (
                  <a href={f[key]} target="_blank" rel="noopener noreferrer"
                    style={{ marginLeft: "auto", fontSize: 11, color: color, fontWeight: 600, textDecoration: "none", background: color + "15", padding: "2px 8px", borderRadius: 5 }}>
                    🔗 Ouvrir
                  </a>
                )}
              </div>
              <input style={{ ...inp, fontSize: 12 }} value={f[key]} onChange={e => setF(p => ({ ...p, [key]: e.target.value }))} placeholder={placeholder} />
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
        <button onClick={onClose} style={btnCancel}>Annuler</button>
        <button onClick={save} disabled={saving} style={{ ...btn, background: saving ? "#93c5fd" : "#2563eb" }}>{saving ? "Enregistrement..." : "Enregistrer"}</button>
      </div>
    </div>
  );
}

// ─── VUE AMENDES ─────────────────────────────────────────────────────────────
function AmendesView({ amendes, contracts, clients, vehicles, search, setModal }) {
  const filtered = amendes.filter(a => {
    const client = clients.find(x => x.id === a.clientId);
    const vehicle = vehicles.find(x => x.id === a.vehicleId);
    return [client?.name, vehicle?.brand, vehicle?.plate, a.description, a.reference].some(f => f?.toLowerCase().includes(search.toLowerCase()));
  });
  const total = amendes.reduce((s, a) => s + Number(a.amount || 0), 0);
  const payees = amendes.filter(a => a.status === "payée").reduce((s, a) => s + Number(a.amount || 0), 0);
  const attente = amendes.filter(a => a.status === "en attente").reduce((s, a) => s + Number(a.amount || 0), 0);

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
        <Stat label="Total amendes" value={fmt(total) + "€"} color="#ef4444" icon="🚨" />
        <Stat label="Payées" value={fmt(payees) + "€"} color="#10b981" icon="✅" />
        <Stat label="En attente" value={fmt(attente) + "€"} color="#f59e0b" icon="⏳" />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.sort((a,b) => new Date(b.date) - new Date(a.date)).map(a => {
          const client = clients.find(x => x.id === a.clientId);
          const vehicle = vehicles.find(x => x.id === a.vehicleId);
          return (
            <div key={a.id} style={{ background: "#fff", borderRadius: 12, border: "1px solid #f0f0f0", padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: "#fee2e2", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>🚨</div>
                <div>
                  <p style={{ margin: "0 0 3px", fontWeight: 700, fontSize: 14 }}>{a.description || "Amende"}</p>
                  <p style={{ margin: "0 0 2px", fontSize: 13, color: "#6b7280" }}>{client?.name} · {vehicle?.brand} {vehicle?.model} ({vehicle?.plate})</p>
                  <p style={{ margin: 0, fontSize: 12, color: "#9ca3af" }}>{fmtDate(a.date)}{a.reference ? ` · Réf: ${a.reference}` : ""}{a.contractId ? ` · Contrat #${a.contractId}` : ""}</p>
                  {(a.pieceJointe1 || a.pieceJointe2 || a.pieceJointe3) && (
                    <div style={{ display: "flex", gap: 5, marginTop: 4 }}>
                      {[a.pieceJointe1, a.pieceJointe2, a.pieceJointe3].filter(Boolean).map((doc, i) => (
                        <span key={i} style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 5, background: "#eff6ff", color: "#2563eb" }}>📎 {doc.substring(0, 12)}…</span>
                      ))}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                    {a.lienAntai && <a href={a.lienAntai} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 5, background: "#dbeafe", color: "#1d4ed8", textDecoration: "none" }}>🏛️ ANTAI</a>}
                    {a.lienFps && <a href={a.lienFps} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 5, background: "#ede9fe", color: "#5b21b6", textDecoration: "none" }}>🅿️ FPS</a>}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Badge status={a.status} />
                <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#ef4444" }}>{fmt(a.amount)}€</p>
                <button onClick={() => setModal({ type: "editAmende", data: a })} style={{ background: "#eff6ff", border: "none", borderRadius: 7, padding: "6px 12px", cursor: "pointer", color: "#2563eb", fontSize: 13, fontWeight: 600 }}>Modifier</button>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && <p style={{ textAlign: "center", color: "#9ca3af", marginTop: 40 }}>Aucune amende enregistrée</p>}
      </div>
    </div>
  );
}


function generateFacturePDFAuto({ facture, client }) {
  const doc = new jsPDF();
  const blue = [37, 99, 235]; const gray = [107, 114, 128]; const dark = [17,17,17]; const light = [243,244,246];
  const fmtD = (d) => d ? new Date(d).toLocaleDateString("fr-FR") : "—";
  const fmtN = (n) => n != null ? Number(n).toLocaleString("fr-FR") : "—";

  // En-tête
  doc.setFillColor(...blue); doc.rect(0, 0, 210, 38, "F");
  doc.setTextColor(255,255,255); doc.setFontSize(22); doc.setFont("helvetica","bold");
  doc.text("FACTURE", 14, 16);
  doc.setFontSize(11); doc.setFont("helvetica","normal");
  doc.text("BAMEVENT — Location de véhicules", 14, 24);
  doc.setFontSize(10); doc.text(`N° FAC-${String(facture.id).padStart(4,"0")} — Émise le ${fmtD(new Date())}`, 14, 31);

  let y = 48;

  // Infos agence
  doc.setFillColor(...light); doc.rect(14,y,85,30,"F");
  doc.setTextColor(...blue); doc.setFontSize(9); doc.setFont("helvetica","bold");
  doc.text("ÉMETTEUR", 17, y+6);
  doc.setTextColor(...dark); doc.setFontSize(8); doc.setFont("helvetica","normal");
  doc.text(AGENCE.nom, 17, y+12);
  doc.text(AGENCE.adresse + ", " + AGENCE.ville, 17, y+17);
  doc.text("Tél : " + AGENCE.tel, 17, y+22);
  doc.text("SIRET : " + AGENCE.siret + " — " + AGENCE.rcs, 17, y+27);

  // Infos client
  doc.setFillColor(...light); doc.rect(111,y,85,30,"F");
  doc.setTextColor(...blue); doc.setFontSize(9); doc.setFont("helvetica","bold");
  doc.text("CLIENT", 114, y+6);
  doc.setTextColor(...dark); doc.setFontSize(8); doc.setFont("helvetica","normal");
  doc.text(client?.name || "—", 114, y+12);
  doc.text(client?.email || "—", 114, y+17);
  doc.text(client?.phone || "—", 114, y+22);
  doc.text("Permis : " + (client?.license || "—"), 114, y+27);
  y += 38;

  // Détail
  doc.setFillColor(...light); doc.rect(14,y,182,7,"F");
  doc.setTextColor(...blue); doc.setFontSize(9); doc.setFont("helvetica","bold");
  doc.text("DÉTAIL DE LA PRESTATION", 17, y+5); y += 12;
  doc.setTextColor(...dark); doc.setFontSize(10); doc.setFont("helvetica","bold");
  const lines = doc.splitTextToSize(facture.label || "Location véhicule", 178);
  doc.text(lines, 14, y); y += lines.length * 6 + 4;
  doc.setFontSize(9); doc.setFont("helvetica","normal"); doc.setTextColor(...gray);
  doc.text(`Date d'émission : ${fmtD(facture.date)}`, 14, y);
  if (facture.contractId) doc.text(`Réf. contrat : #${facture.contractId}`, 100, y);
  y += 20;

  // Tableau HT / TVA / TTC
  const montantTTC = Number(facture.amount) || 0;
  const montantHT = Math.round((montantTTC / 1.2) * 100) / 100;
  const montantTVA = Math.round((montantTTC - montantHT) * 100) / 100;

  doc.setFillColor(...light); doc.rect(100,y,96,8,"F");
  doc.setTextColor(...gray); doc.setFontSize(8); doc.setFont("helvetica","normal");
  doc.text("Montant HT", 104, y+5.5);
  doc.setTextColor(...dark); doc.setFont("helvetica","bold");
  doc.text(`${fmtN(montantHT)} €`, 192, y+5.5, { align: "right" });
  y += 9;

  doc.setFillColor(255,255,255); doc.rect(100,y,96,8,"F");
  doc.setDrawColor(230,230,230); doc.setLineWidth(0.3);
  doc.rect(100,y,96,8);
  doc.setTextColor(...gray); doc.setFontSize(8); doc.setFont("helvetica","normal");
  doc.text("TVA 20%", 104, y+5.5);
  doc.setTextColor(...dark); doc.setFont("helvetica","bold");
  doc.text(`${fmtN(montantTVA)} €`, 192, y+5.5, { align: "right" });
  y += 10;

  doc.setFillColor(...blue); doc.roundedRect(100,y,96,16,3,3,"F");
  doc.setTextColor(255,255,255); doc.setFontSize(10); doc.setFont("helvetica","normal");
  doc.text("TOTAL TTC", 104, y+7);
  doc.setFontSize(16); doc.setFont("helvetica","bold");
  doc.text(`${fmtN(montantTTC)} €`, 192, y+12, { align: "right" });
  y += 26;

  // Conditions paiement
  doc.setFillColor(...light); doc.rect(14,y,182,20,"F");
  doc.setTextColor(...gray); doc.setFontSize(8); doc.setFont("helvetica","normal");
  doc.text("Conditions de règlement : Paiement à réception de facture.", 17, y+7);
  doc.text("En cas de retard, des pénalités de 3x le taux légal seront appliquées.", 17, y+13);
  y += 28;

  // Pied de page
  doc.setFillColor(...light); doc.rect(0,282,210,15,"F");
  doc.setTextColor(...gray); doc.setFontSize(7); doc.setFont("helvetica","normal");
  doc.text(`${AGENCE.nom} — SIRET ${AGENCE.siret} — ${AGENCE.adresse}, ${AGENCE.ville} — Tél : ${AGENCE.tel}`, 105, 289, { align:"center" });

  const nomClient = (client?.name || "client").replace(/\s+/g,"-");
  const dateStr = fmtD(facture.date).replace(/\//g,"-");
  doc.save(`facture-${dateStr}_${nomClient}.pdf`);
}

export default function App() {
  const [unlocked, setUnlocked] = useState(false);
  const [tab, setTab] = useState("dashboard");
  const [vehicles, setVehicles] = useState([]);
  const [clients, setClients] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [maintenance, setMaintenance] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [factures, setFactures] = useState([]);
  const [amendes, setAmendes] = useState([]);
  const [modal, setModal] = useState(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saveMsg, setSaveMsg] = useState("");

  const loadAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const [v, c, co, m, d, fa, am] = await Promise.all([
      supabase.from("vehicles").select("*").order("id"),
      supabase.from("clients").select("*").order("id"),
      supabase.from("contracts").select("*").order("id"),
      supabase.from("maintenance").select("*").order("id"),
      supabase.from("documents").select("*").order("id"),
      supabase.from("factures").select("*").order("id"),
      supabase.from("amendes").select("*").order("id"),
    ]);
    if (v.data) setVehicles(v.data.map(toVehicle));
    if (c.data) setClients(c.data.map(toClient));
    if (co.data) setContracts(co.data.map(toContract));
    if (m.data) setMaintenance(m.data.map(toMaintenance));
    if (d.data) setDocuments(d.data.map(toDocument));
    if (fa.data) setFactures(fa.data.map(toFacture));
    if (am.data) setAmendes(am.data.map(toAmende));
    if (!silent) setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const notify = useCallback((msg) => { setSaveMsg(msg); setTimeout(() => setSaveMsg(""), 3000); }, []);
  const closeModal = useCallback(() => setModal(null), []);
  const refresh = useCallback(() => loadAll(true), [loadAll]);

  const ADD_CONFIG = {
    vehicles: { label: "Ajouter un véhicule", modal: "addVehicle" },
    clients: { label: "Nouveau client", modal: "addClient" },
    contracts: { label: "Nouveau contrat", modal: "addContract" },
    maintenance: { label: "Ajouter entretien", modal: "addMaintenance" },
    documents: { label: "Ajouter un document", modal: "addDocument" },
    factures: { label: "Nouvelle facture", modal: "addFacture" },
    amendes: { label: "Nouvelle amende", modal: "addAmende" },
  };
  const currentAdd = ADD_CONFIG[tab];

  if (!unlocked) return <PinLock onUnlock={() => setUnlocked(true)} />;

  return (
    <ErrorBoundary>
    <style>{`
      @media (max-width: 768px) {
        .fm-header { padding: 0 12px !important; }
        .fm-logo-text { display: none; }
        .fm-status { display: none !important; }
        .fm-content { padding: 12px !important; }
        .fm-title-bar { flex-direction: column !important; align-items: flex-start !important; gap: 10px !important; }
        .fm-search-bar { width: 100% !important; }
        .fm-search-bar input { width: 100% !important; flex: 1 !important; }
        .fm-bottom-nav { display: flex !important; }
        .fm-top-nav { display: none !important; }
        .fm-add-btn span { display: none; }
      }
      @media (min-width: 769px) {
        .fm-bottom-nav { display: none !important; }
        .fm-top-nav { display: flex !important; }
        .fm-add-btn span { display: inline; }
      }
      .fm-bottom-nav {
        position: fixed; bottom: 0; left: 0; right: 0; z-index: 100;
        background: #fff; border-top: 1px solid #e5e7eb;
        padding: 6px 0 env(safe-area-inset-bottom, 6px);
        justify-content: space-around; align-items: center;
      }
      .fm-bottom-nav button {
        display: flex; flex-direction: column; align-items: center; gap: 2px;
        border: none; background: transparent; cursor: pointer;
        padding: 4px 6px; border-radius: 8px; flex: 1; max-width: 70px;
      }
      .fm-bottom-nav button span.icon { font-size: 20px; line-height: 1; }
      .fm-bottom-nav button span.label { font-size: 9px; font-weight: 600; color: #9ca3af; }
      .fm-bottom-nav button.active span.label { color: #2563eb; }
      .fm-bottom-nav button.active { background: #eff6ff; }
      .fm-mobile-pb { padding-bottom: 80px; }
      @media (min-width: 769px) { .fm-mobile-pb { padding-bottom: 0; } }
    `}</style>
    <div style={{ fontFamily: "'DM Sans', 'Segoe UI', sans-serif", background: "#f8f9fc", minHeight: "100vh" }}>
      {saveMsg && <div style={{ position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 9999, background: "#111", color: "#fff", padding: "12px 20px", borderRadius: 10, fontSize: 14, fontWeight: 600, whiteSpace: "nowrap" }}>{saveMsg}</div>}

      {/* HEADER */}
      <div className="fm-header" style={{ background: "linear-gradient(135deg, #0f2447, #1e3a5f, #2563eb)", padding: "0 28px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", maxWidth: 1400, margin: "0 auto", height: 56 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 26 }}>🚘</span>
            <span className="fm-logo-text" style={{ color: "#fff", fontWeight: 900, fontSize: 18 }}>FleetManager</span>
          </div>
          <nav className="fm-top-nav" style={{ gap: 2, flexWrap: "wrap", justifyContent: "center" }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => { setTab(t.id); setSearch(""); }}
                style={{ padding: "6px 10px", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 500, background: tab === t.id ? "rgba(255,255,255,.15)" : "transparent", color: tab === t.id ? "#fff" : "rgba(255,255,255,.6)" }}>
                {t.icon} {t.label}
              </button>
            ))}
          </nav>
          <div className="fm-status" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: loading ? "#f59e0b" : "#10b981" }} />
            <span style={{ color: "rgba(255,255,255,.6)", fontSize: 12 }}>{loading ? "Chargement..." : "Connecté"}</span>
          </div>
        </div>
      </div>

      {/* CONTENU */}
      <div className="fm-content fm-mobile-pb" style={{ maxWidth: 1400, margin: "0 auto", padding: "20px 28px" }}>
        <div className="fm-title-bar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <h2 style={{ margin: "0 0 2px", fontSize: 20, fontWeight: 900 }}>{TABS.find(t => t.id === tab)?.icon} {TABS.find(t => t.id === tab)?.label}</h2>
            <p style={{ margin: 0, color: "#6b7280", fontSize: 13 }}>
              {tab === "dashboard" && `Vue d'ensemble · ${new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}`}
              {tab === "vehicles" && `${vehicles.length} véhicules`}
              {tab === "clients" && `${clients.length} clients`}
              {tab === "contracts" && `${contracts.length} contrats`}
              {tab === "maintenance" && `${maintenance.length} opérations`}
              {tab === "insurance" && "Coûts d'assurance"}
              {tab === "documents" && `${documents.length} documents`}
              {tab === "factures" && `${factures.length} factures`}
              {tab === "comptabilite" && "Vue financière globale"}
              {tab === "amendes" && `${amendes.length} amendes`}
            </p>
          </div>
          <div className="fm-search-bar" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {tab !== "dashboard" && tab !== "insurance" && tab !== "documents" && tab !== "comptabilite" && (
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..."
                style={{ padding: "9px 14px", border: "1.5px solid #e5e7eb", borderRadius: 9, fontSize: 14, outline: "none", width: 180 }} />
            )}
            {currentAdd && <button className="fm-add-btn" onClick={() => setModal({ type: currentAdd.modal, data: {} })} style={{ ...btn, display: "flex", alignItems: "center", gap: 6 }}>+ <span>{currentAdd.label}</span></button>}
          </div>
        </div>
        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 80, flexDirection: "column", gap: 16 }}>
            <div style={{ width: 40, height: 40, border: "3px solid #e5e7eb", borderTop: "3px solid #2563eb", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            <p style={{ margin: 0, color: "#9ca3af" }}>Chargement depuis Supabase...</p>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        ) : (
          <>
            {tab === "dashboard" && <Dashboard vehicles={vehicles} clients={clients} contracts={contracts} />}
            {tab === "vehicles" && <Vehicles vehicles={vehicles} search={search} setModal={setModal} />}
            {tab === "clients" && <Clients clients={clients} contracts={contracts} search={search} setModal={setModal} />}
            {tab === "contracts" && <ContractsView contracts={contracts} clients={clients} vehicles={vehicles} search={search} setModal={setModal} />}
            {tab === "maintenance" && <MaintenanceView maintenance={maintenance} vehicles={vehicles} search={search} setModal={setModal} />}
            {tab === "insurance" && <Insurance vehicles={vehicles} />}
            {tab === "documents" && <DocumentsView documents={documents} setModal={setModal} />}
            {tab === "factures" && <FacturesView factures={factures} contracts={contracts} clients={clients} setModal={setModal} notify={notify} refresh={refresh} />}
            {tab === "comptabilite" && <ComptabiliteView contracts={contracts} maintenance={maintenance} factures={factures} amendes={amendes} />}
            {tab === "amendes" && <AmendesView amendes={amendes} contracts={contracts} clients={clients} vehicles={vehicles} search={search} setModal={setModal} />}
          </>
        )}
      </div>

      {modal?.type === "addVehicle" && <Modal title="Nouveau véhicule" onClose={closeModal}><VehicleForm init={{}} onClose={closeModal} onSave={refresh} notify={notify} /></Modal>}
      {modal?.type === "editVehicle" && <Modal title="Modifier le véhicule" onClose={closeModal}><VehicleForm init={modal.data} onClose={closeModal} onSave={refresh} notify={notify} /></Modal>}
      {modal?.type === "addClient" && <Modal title="Nouveau client" onClose={closeModal}><ClientForm init={{}} onClose={closeModal} onSave={refresh} notify={notify} /></Modal>}
      {modal?.type === "editClient" && <Modal title="Modifier le client" onClose={closeModal}><ClientForm init={modal.data} onClose={closeModal} onSave={refresh} notify={notify} /></Modal>}
      {modal?.type === "addContract" && <Modal title="Nouveau contrat" onClose={closeModal}><ContractForm init={{}} onClose={closeModal} onSave={refresh} notify={notify} vehicles={vehicles} clients={clients} /></Modal>}
      {modal?.type === "editContract" && <Modal title="Modifier le contrat" onClose={closeModal}><ContractForm init={modal.data} onClose={closeModal} onSave={refresh} notify={notify} vehicles={vehicles} clients={clients} /></Modal>}
      {modal?.type === "addMaintenance" && <Modal title="Nouvel entretien" onClose={closeModal}><MaintenanceForm init={{}} onClose={closeModal} onSave={refresh} notify={notify} vehicles={vehicles} /></Modal>}
      {modal?.type === "editMaintenance" && <Modal title="Modifier l'entretien" onClose={closeModal}><MaintenanceForm init={modal.data} onClose={closeModal} onSave={refresh} notify={notify} vehicles={vehicles} /></Modal>}
      {modal?.type === "addDocument" && <Modal title="Ajouter un document" onClose={closeModal}><DocumentForm init={{}} onClose={closeModal} onSave={refresh} notify={notify} /></Modal>}
      {modal?.type === "editDocument" && <Modal title="Modifier le document" onClose={closeModal}><DocumentForm init={modal.data} onClose={closeModal} onSave={refresh} notify={notify} /></Modal>}
      {modal?.type === "addFacture" && <Modal title="Nouvelle facture" onClose={closeModal}><FactureForm init={{}} onClose={closeModal} onSave={refresh} notify={notify} contracts={contracts} clients={clients} /></Modal>}
      {modal?.type === "editFacture" && <Modal title="Modifier la facture" onClose={closeModal}><FactureForm init={modal.data} onClose={closeModal} onSave={refresh} notify={notify} contracts={contracts} clients={clients} /></Modal>}
      {modal?.type === "addAmende" && <Modal title="Nouvelle amende" onClose={closeModal}><AmendeForm init={{}} onClose={closeModal} onSave={refresh} notify={notify} contracts={contracts} clients={clients} vehicles={vehicles} /></Modal>}
      {modal?.type === "editAmende" && <Modal title="Modifier l'amende" onClose={closeModal}><AmendeForm init={modal.data} onClose={closeModal} onSave={refresh} notify={notify} contracts={contracts} clients={clients} vehicles={vehicles} /></Modal>}
      {/* NAV MOBILE BAS */}
      <nav className="fm-bottom-nav">
        {TABS.map(t => (
          <button key={t.id} className={tab === t.id ? "active" : ""} onClick={() => { setTab(t.id); setSearch(""); }}>
            <span className="icon">{t.icon}</span>
            <span className="label">{t.label.split(" ")[0]}</span>
          </button>
        ))}
      </nav>
    </div>
    </ErrorBoundary>
  );
}