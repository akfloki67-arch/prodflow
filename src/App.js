import { useState, useRef, useEffect } from "react";

// ─── CONSTANTES ────────────────────────────────────────────────────────────────

const COLUMNS = [
  { id: "nouvelle",   label: "Nouvelle",      icon: "✦", color: "#4F9CF9" },
  { id: "production", label: "En production",  icon: "⚙", color: "#F4A942" },
  { id: "attente",    label: "En attente",     icon: "◷", color: "#9B7FE8" },
  { id: "sav",        label: "SAV",            icon: "⚠", color: "#FF5B5B" },
  { id: "termine",    label: "Terminé",        icon: "✔", color: "#4ECBA1" },
];

const TYPE_GROUPS = [
  {
    group: "Textile",
    color: "#4F9CF9",
    emoji: "👕",
    items: ["Flocage", "DTF", "Broderie"],
  },
  { group: "Véhicule",           color: "#F4A942", emoji: "🚗", items: [] },
  { group: "Vitrine",            color: "#9B7FE8", emoji: "🪟", items: [] },
  { group: "Enseigne",           color: "#E05C7A", emoji: "📛", items: [] },
  { group: "Conception graphique", color: "#4ECBA1", emoji: "🎨", items: [] },
  { group: "Impression atelier", color: "#F9A84F", emoji: "🖨️", items: [] },
  { group: "Impression fournisseur", color: "#A78BFA", emoji: "📦", items: [] },
];

// Flatten all type options to display tags
function allTypeLabels(types = []) {
  return types.map((t) => {
    const group = TYPE_GROUPS.find((g) => g.group === t.group || g.items.includes(t.label));
    return { ...t, color: group?.color || "#666" };
  });
}

const MOCK_AXONAUT = [
  { axonaut_id: "AX-2024-089", client: "Mairie de Toulouse", montant: "3 450 €", date: "2026-04-11", pdf: null, telephone: "05 61 22 33 44", email: "commandes@mairie-toulouse.fr" },
  { axonaut_id: "AX-2024-090", client: "BTP Constructions Sud", montant: "980 €", date: "2026-04-12", pdf: null, telephone: "06 12 34 56 78", email: "contact@btpsud.fr" },
  { axonaut_id: "AX-2024-091", client: "Pharmacie Centrale", montant: "560 €", date: "2026-04-13", pdf: null, telephone: "05 34 45 67 89", email: "pharmacentrale@gmail.com" },
];

let nextId = 10;

const SUPABASE_URL = "https://khymdrnjxdfpbygvnslg.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtoeW1kcm5qeGRmcGJ5Z3Zuc2xnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyODQ4OTksImV4cCI6MjA5MTg2MDg5OX0.xYtN_u89icWVepN2x8WmnZ_YPsEUmtjkIH3BZCdwxso";

const sbFetch = (path, options = {}) => fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...options, headers: { "Content-Type": "application/json", "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}`, "Prefer": "return=representation", ...options.headers } }).then((r) => r.json());
const loadOrders = () => sbFetch("orders?select=*&order=created_at.desc");
const loadClients = () => sbFetch("clients?select=*&order=created_at.desc");
const saveOrder = (order) => { const { id, ...data } = order; return id ? sbFetch(`orders?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(data) }) : sbFetch("orders", { method: "POST", body: JSON.stringify(data) }); };
const saveClient = (client) => { const { id, ...data } = client; return sbFetch("clients", { method: "POST", headers: { "Prefer": "resolution=merge-duplicates,return=representation" }, body: JSON.stringify(data) }); };
const deleteOrderDb = (id) => sbFetch(`orders?id=eq.${id}`, { method: "DELETE" });

const emptyOrder = () => ({
  id: null,
  client: "",
  reference: "",
  axonaut_id: "",
  montant: "",
  date: new Date().toISOString().slice(0, 10),
  status: "nouvelle",
  // Types de commande
  types: [],
  // Fournisseur
  fournisseur_passe false,
  // BAT
  bat_statut: "a_faire", // "a_faire" | "valide"
  bat_files:: [],
  // Devis PDF
  devis_pdf: null,
  // Maquettes libres
  maquettes: [],
  // Notes
  notes: "",
  // SAV
  sav_commentaires: [],
  // Contact client
  telephone: "",
  email: "",
});

// ─── APP ───────────────────────────────────────────────────────────────────────

export default function App() {
  useEffect(() => {
    loadOrders().then((data) => { if (Array.isArray(data)) setOrders(data); });
    loadClients().then((data) => { if (Array.isArray(data)) setClients(data); });
  }, []);
const [orders, setOrders] = useState([]);


  const [showForm, setShowForm]       = useState(false);
  const [editOrder, setEditOrder]     = useState(null);
  const [viewOrder, setViewOrder]     = useState(null);
  const [showAxonaut, setShowAxonaut] = useState(false);
  const [showClients, setShowClients] = useState(false);
  const [dragging, setDragging]       = useState(null);
  const [dragOver, setDragOver]       = useState(null);
  const [importedIds, setImportedIds] = useState([]);
const [clients, setClients] = useState([]);


  // Enregistre ou met à jour le client dans l'annuaire à chaque sauvegarde commande
  const upsertClient = (order) => {
    if (!order.client) return;
    setClients((prev) => {
      const existing = prev.find((c) => c.nom.toLowerCase() === order.client.toLowerCase());
      if (existing) {
        // Mise à jour si nouvelles infos
        return prev.map((c) => c.nom.toLowerCase() === order.client.toLowerCase()
          ? { ...c, telephone: order.telephone || c.telephone, email: order.email || c.email, axonaut_id: order.axonautId || c.axonautId }
          : c
        );
      } else {
        return [...prev, { id: Date.now(), nom: order.client, telephone: order.telephone || "", email: order.email || "", axonaut_id: order.axonautId || "" }];
      }
    });
  };

 const upsert = (order) => {
    saveOrder(order).then((data) => {
      if (Array.isArray(data) && data[0]) {
        const saved = data[0];
        setOrders((prev) =>
          order.id
            ? prev.map((o) => (o.id === order.id ? saved : o))
            : [...prev, saved]
        );
        upsertClient(saved);
      }
    });
  };

  const remove = (id) => { setOrders((p) => p.filter((o) => o.id !== id)); setViewOrder(null); };

  const move = (id, col) => {
    setOrders((p) => p.map((o) => o.id === id ? { ...o, status: col } : o));
    const order = orders.find((o) => o.id === id);
    if (order) saveOrder({ ...order, status: col });
  };

  const importFromAxonaut = (ax) => {
    const order = {
      ...emptyOrder(),
      id: nextId++,
      client: ax.client,
      reference: `CMD-00${nextId}`,
      axonaut_id: ax.axonautId,
      montant: ax.montant,
      date: ax.date,
      status: "nouvelle",
      telephone: ax.telephone || "",
      email: ax.email || "",
    };
    setOrders((p) => [...p, order]);
    setImportedIds((p) => [...p, ax.axonautId]);
    upsertClient(order);
  };

  const updateOrder = (updated) => {
    setOrders((p) => p.map((o) => o.id === updated.id ? updated : o));
    setViewOrder(updated);
  };

  return (
    <div style={s.root}>
      <Header onNew={() => { setEditOrder(emptyOrder()); setShowForm(true); }} onAxonaut={() => setShowAxonaut(true)} onClients={() => setShowClients(true)} orders={orders} clients={clients} />

      {/* Board */}
      <div style={s.board}>
        {COLUMNS.map((col) => (
          <Column
            key={col.id}
            col={col}
            orders={orders.filter((o) => o.status === col.id)}
            dragging={dragging}
            dragOver={dragOver}
            onDragStart={(id) => setDragging(id)}
            onDragEnd={() => { setDragging(null); setDragOver(null); }}
            onDragOver={(id) => setDragOver(id)}
            onDrop={(id) => { if (dragging) move(dragging, id); }}
            onView={(o) => setViewOrder(o)}
          />
        ))}
      </div>

      {/* Modals */}
      {showForm && (
        <OrderForm
          order={editOrder}
          clients={clients}
          onSave={(o) => { upsert(o); setShowForm(false); setEditOrder(null); }}
          onClose={() => { setShowForm(false); setEditOrder(null); }}
        />
      )}
      {viewOrder && (
        <OrderDetail
          order={orders.find((o) => o.id === viewOrder.id) || viewOrder}
          onClose={() => setViewOrder(null)}
          onEdit={(o) => { setEditOrder(o); setViewOrder(null); setShowForm(true); }}
          onDelete={remove}
          onMove={(id, col) => { move(id, col); setViewOrder(null); }}
          onUpdate={updateOrder}
        />
      )}
      {showAxonaut && (
        <AxonautImport
          mock={MOCK_AXONAUT}
          imported={importedIds}
          onImport={importFromAxonaut}
          onClose={() => setShowAxonaut(false)}
        />
      )}
      {showClients && (
        <ClientsBook
          clients={clients}
          orders={orders}
          onClose={() => setShowClients(false)}
          onNewOrder={(client) => { setEditOrder({ ...emptyOrder(), client: client.nom, telephone: client.telephone, email: client.email }); setShowClients(false); setShowForm(true); }}
          onDeleteClient={(id) => setClients((p) => p.filter((c) => c.id !== id))}
        />
      )}
    </div>
  );
}

// ─── HEADER ────────────────────────────────────────────────────────────────────

function Header({ onNew, onAxonaut, onClients, orders, clients }) {
  return (
    <header style={s.header}>
      <div style={s.headerLeft}>
        <div style={s.logo}>⬡</div>
        <div>
          <div style={s.appName}>PROD<span style={{ color: "#4F9CF9" }}>FLOW</span></div>
          <div style={s.appSub}>Suivi de commandes · production</div>
        </div>
      </div>
      <div style={s.headerStats}>
        {COLUMNS.map((c) => (
          <div key={c.id} style={s.hStat}>
            <span style={{ ...s.hDot, background: c.color }} />
            <span style={{ color: c.color, fontWeight: 800 }}>{orders.filter((o) => o.status === c.id).length}</span>
            <span style={s.hLabel}>{c.label}</span>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button style={s.btnClients} onClick={onClients}>👥 Clients <span style={s.clientsBadge}>{clients.length}</span></button>
        <button style={s.btnAxonaut} onClick={onAxonaut}>⬇ Axonaut</button>
        <button style={s.btnNew} onClick={onNew}>+ Nouvelle commande</button>
      </div>
    </header>
  );
}

// ─── COLUMN ────────────────────────────────────────────────────────────────────

function Column({ col, orders, dragging, dragOver, onDragStart, onDragEnd, onDragOver, onDrop, onView }) {
  const isOver = dragOver === col.id;
  return (
    <div
      style={{ ...s.col, ...(isOver ? { borderColor: col.color, background: "rgba(255,255,255,0.04)" } : {}) }}
      onDragOver={(e) => { e.preventDefault(); onDragOver(col.id); }}
      onDrop={() => onDrop(col.id)}
    >
      <div style={s.colHead}>
        <span style={{ color: col.color, fontSize: 16 }}>{col.icon}</span>
        <span style={s.colTitle}>{col.label}</span>
        <span style={{ ...s.colBadge, background: col.color + "25", color: col.color }}>{orders.length}</span>
      </div>
      <div style={{ ...s.colBar, background: col.color }} />
      <div style={s.cardList}>
        {orders.map((o) => (
          <Card key={o.id} order={o} col={col} onDragStart={() => onDragStart(o.id)} onDragEnd={onDragEnd} onClick={() => onView(o)} />
        ))}
        {orders.length === 0 && <div style={s.empty}>Glissez ici</div>}
      </div>
    </div>
  );
}

// ─── CARD ──────────────────────────────────────────────────────────────────────

function Card({ order, col, onDragStart, onDragEnd, onClick }) {
  const types = allTypeLabels(order.types || []);
  return (
    <div draggable onDragStart={onDragStart} onDragEnd={onDragEnd} onClick={onClick} style={s.card}>
      {/* Header */}
      <div style={s.cardHead}>
        {order.axonautId && <span style={s.axoTag}>AX</span>}
        <span style={s.cardRef}>{order.reference || order.axonautId}</span>
        <span style={{ ...s.cardMontant, color: col.color }}>{order.montant}</span>
      </div>
      <div style={s.cardClient}>{order.client}</div>

      {/* Types */}
      {types.length > 0 && (
        <div style={s.tagRow}>
          {types.map((t, i) => (
            <span key={i} style={{ ...s.tag, background: t.color + "22", color: t.color }}>
              {TYPE_GROUPS.find(g => g.group === t.group)?.emoji} {t.label}
            </span>
          ))}
        </div>
      )}

      {/* Indicateurs */}
      <div style={s.indicators}>
        <Pill ok={order.fournisseurPasse} labelOk="Fourn. ✓" labelNo="Fourn. ?" color="#4ECBA1" />
        <Pill ok={order.bat_statut === "valide"} labelOk="BAT ✓" labelNo="BAT à faire" color="#F4A942" />
        {(order.bat_files:?.length > 0 || order.maquettes?.length > 0 || order.devis_pdf) && (
          <span style={s.fileChip}>📎 {(order.bat_files:?.length || 0) + (order.maquettes?.length || 0) + (order.devis_pdf ? 1 : 0)}</span>
        )}
      </div>

      {order.notes && <div style={s.cardNote}>💬 {order.notes}</div>}
      {order.status === "sav" && order.sav_commentaires?.length > 0 && (
        <div style={s.savBadgeCard}>⚠ {order.sav_commentaires.length} commentaire{order.sav_commentaires.length > 1 ? "s" : ""} SAV</div>
      )}
      {order.status === "termine" && order.telephone && (
        <a href={`tel:${order.telephone.replace(/\s/g, "")}`} style={s.cardCallBtn} onClick={(e) => e.stopPropagation()}>
          📞 Appeler — {order.telephone}
        </a>
      )}
      <div style={s.cardDate}>📅 {order.date}</div>
    </div>
  );
}

function Pill({ ok, labelOk, labelNo, color }) {
  return (
    <span style={{ ...s.pill, background: ok ? color + "22" : "#2A2D3A", color: ok ? color : "#556", border: `1px solid ${ok ? color + "44" : "#333"}` }}>
      {ok ? labelOk : labelNo}
    </span>
  );
}

// ─── ORDER DETAIL ──────────────────────────────────────────────────────────────

async function analyseDevisAvecClaude(base64Data) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: `Tu es un assistant pour une entreprise de signalétique et textile.
Analyse ce devis et réponds UNIQUEMENT en JSON valide, sans markdown, sans texte autour.

Les catégories disponibles sont exactement (respecte la casse) :
- Textile avec sous-types : "Flocage", "DTF", "Broderie"
- Groupes sans sous-types : "Véhicule", "Vitrine", "Enseigne", "Conception graphique", "Impression atelier", "Impression fournisseur"

Format exact à retourner :
{
  "prestation": "description courte du type de produit/prestation",
  "quantites": "résumé des quantités principales",
  "delai": "date ou délai de livraison si mentionné, sinon null",
  "categories": [
    { "group": "Textile", "label": "Flocage" },
    { "group": "Véhicule", "label": "Véhicule" }
  ]
}

Pour categories : détecte toutes celles qui correspondent au contenu du devis.
Pour les sous-types Textile, utilise group="Textile" et label=le sous-type détecté.
Pour les autres, group et label sont identiques (ex: group="Véhicule", label="Véhicule").
Si aucune catégorie détectée, retourne un tableau vide.
Sois concis : 1 ligne max par champ texte.`,
      messages: [{
        role: "user",
        content: [{
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: base64Data }
        }, {
          type: "text",
          text: "Analyse ce devis et extrais les informations demandées."
        }]
      }]
    })
  });
  const data = await response.json();
  const text = data.content?.map(b => b.text || "").join("") || "";
  try {
    return JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch {
    return null;
  }
}

function OrderDetail({ order, onClose, onEdit, onDelete, onMove, onUpdate }) {
  const batRef = useRef();
  const maqRef = useRef();
  const devisRef = useRef();
  const col = COLUMNS.find((c) => c.id === order.status);
  const types = allTypeLabels(order.types || []);
  const [analyseLoading, setAnalyseLoading] = useState(false);

  const toggle = (key) => onUpdate({ ...order, [key]: !order[key] });
  const setBat = (val) => onUpdate({ ...order, bat_statut: val });
  const addBatFile = (f) => onUpdate({ ...order, bat_files:: [...(order.bat_files: || []), { name: f.name, url: URL.createObjectURL(f) }] });
  const addMaq = (f) => onUpdate({ ...order, maquettes: [...(order.maquettes || []), { name: f.name, url: URL.createObjectURL(f) }] });

  const handleDevisUpload = async (file) => {
    const url = URL.createObjectURL(file);
    onUpdate({ ...order, devis_pdf: { name: file.name, url } });
    setAnalyseLoading(true);
    try {
      const base64 = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result.split(",")[1]);
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      const result = await analyseDevisAvecClaude(base64);
      if (result) {
        const parts = [];
        if (result.prestation) parts.push(`📋 ${result.prestation}`);
        if (result.quantites) parts.push(`📦 ${result.quantites}`);
        if (result.delai) parts.push(`📅 Délai : ${result.delai}`);
        const noteAuto = parts.join("\n");
        // Catégories détectées — on fusionne avec celles déjà présentes
        const nouvCats = Array.isArray(result.categories) ? result.categories : [];
        const existantes = order.types || [];
        const merged = [...existantes];
        nouvCats.forEach((c) => {
          const dejala = merged.find((t) => t.label === c.label);
          if (!dejala) merged.push(c);
        });
        onUpdate({
          ...order,
          devis_pdf: { name: file.name, url },
          notes: noteAuto,
          note_auto_generee: true,
          types: merged,
          types_auto_detectes: nouvCats.map((c) => c.label),
        });
      }
    } catch (e) {
      console.error("Analyse IA échouée", e);
    }
    setAnalyseLoading(false);
  };

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={{ ...s.modal, maxWidth: 600 }} onClick={(e) => e.stopPropagation()}>
        {/* Top */}
        <div style={{ ...s.modalTop, borderColor: col.color }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {order.axonautId && <span style={{ ...s.axoTag, fontSize: 11, padding: "3px 8px" }}>Axonaut · {order.axonautId}</span>}
            <span style={s.modalRef}>{order.reference}</span>
          </div>
          <div style={s.modalClient}>{order.client}</div>
          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
            {types.map((t, i) => {
              const isAuto = (order.types_auto_detectes || []).includes(t.label);
              return (
                <span key={i} style={{ ...s.tag, background: t.color + "22", color: t.color, position: "relative" }}>
                  {TYPE_GROUPS.find(g => g.group === t.group)?.emoji} {t.label}
                  {isAuto && <span style={s.tagAiBadge}>✦IA</span>}
                </span>
              );
            })}
            {(order.types_auto_detectes || []).length > 0 && (
              <span style={s.aiBadge}>✦ Catégories détectées automatiquement</span>
            )}
          </div>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={s.modalBody}>
          {/* Infos de base */}
          <div style={s.infoGrid}>
            <InfoCell label="Date" value={order.date} />
            <InfoCell label="Montant" value={order.montant} color={col.color} />
            <InfoCell label="Statut" value={col.label} color={col.color} />
          </div>

          {/* ── Contact client ── */}
          {(order.telephone || order.email) && (
            <Section title="Contact client" icon="📞">
              <div style={s.contactRow}>
                {order.telephone && (
                  <a href={`tel:${order.telephone.replace(/\s/g, "")}`} style={s.contactBtn}>
                    📞 {order.telephone}
                  </a>
                )}
                {order.email && (
                  <a href={`mailto:${order.email}`} style={{ ...s.contactBtn, background: "#4F9CF918", color: "#4F9CF9", borderColor: "#4F9CF933" }}>
                    ✉ {order.email}
                  </a>
                )}
              </div>
              {order.status === "termine" && order.telephone && (
                <div style={s.contactAlert}>
                  ✅ Commande terminée — pensez à appeler le client !
                </div>
              )}
            </Section>
          )}

          {/* ── Commande fournisseur ── */}
          <Section title="Commande fournisseur" icon="📦">
            <div style={s.toggleRow}>
              <span style={s.toggleLabel}>Commande passée</span>
              <button
                style={{ ...s.toggle, background: order.fournisseurPasse ? "#4ECBA1" : "#2A2D3A", color: order.fournisseurPasse ? "#fff" : "#556" }}
                onClick={() => toggle("fournisseurPasse")}
              >
                {order.fournisseurPasse ? "✓ Oui" : "Non"}
              </button>
            </div>
          </Section>

          {/* ── BAT ── */}
          <Section title="BAT / Maquette" icon="🎨">
            <div style={s.toggleRow}>
              <span style={s.toggleLabel}>Statut BAT</span>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  style={{ ...s.toggle, background: order.bat_statut === "a_faire" ? "#F4A942" : "#2A2D3A", color: order.bat_statut === "a_faire" ? "#fff" : "#556" }}
                  onClick={() => setBat("a_faire")}
                >À faire</button>
                <button
                  style={{ ...s.toggle, background: order.bat_statut === "valide" ? "#4ECBA1" : "#2A2D3A", color: order.bat_statut === "valide" ? "#fff" : "#556" }}
                  onClick={() => setBat("valide")}
                >✓ Validé</button>
              </div>
            </div>
            {order.bat_statut === "valide" && (
              <div style={{ marginTop: 10 }}>
                <div style={s.filesLabel}>Fichiers BAT validés</div>
                {order.bat_files:?.map((f, i) => <FileChip key={i} f={f} />)}
                <UploadBtn label="+ Ajouter fichier BAT" onClick={() => batRef.current.click()} />
                <input ref={batRef} type="file" multiple style={{ display: "none" }} onChange={(e) => Array.from(e.target.files).forEach(addBatFile)} />
              </div>
            )}
          </Section>

          {/* ── Devis PDF + Analyse IA ── */}
          <Section title="Devis" icon="📄">
            {order.devis_pdf ? (
              <div>
                <FileChip f={order.devis_pdf} />
                <button
                  style={{ ...s.uploadBtn, marginTop: 6 }}
                  onClick={() => devisRef.current.click()}
                >
                  🔄 Remplacer le devis
                </button>
              </div>
            ) : (
              <UploadBtn label="+ Joindre le devis PDF (analyse auto)" onClick={() => devisRef.current.click()} />
            )}
            <input
              ref={devisRef}
              type="file"
              accept="application/pdf"
              style={{ display: "none" }}
              onChange={(e) => { if (e.target.files[0]) handleDevisUpload(e.target.files[0]); }}
            />
            {analyseLoading && (
              <div style={s.aiLoading}>
                <span style={s.aiSpinner}>⟳</span> Analyse du devis en cours…
              </div>
            )}
          </Section>

          {/* ── Maquettes ── */}
          <Section title="Maquettes & fichiers" icon="📎">
            {order.maquettes?.map((f, i) => <FileChip key={i} f={f} />)}
            <UploadBtn label="+ Ajouter une maquette" onClick={() => maqRef.current.click()} />
            <input ref={maqRef} type="file" multiple style={{ display: "none" }} onChange={(e) => Array.from(e.target.files).forEach(addMaq)} />
          </Section>

          {/* ── SAV ── */}
          {order.status === "sav" && (
            <SavSection order={order} onUpdate={onUpdate} />
          )}

          {/* ── Notes ── */}
          <Section title="Notes" icon="💬">
            {order.note_auto_generee && (
              <div style={s.aiBadge}>✦ Résumé généré automatiquement par IA</div>
            )}
            <textarea
              style={{ ...s.fieldInput, minHeight: 80, resize: "vertical", marginTop: 4 }}
              value={order.notes || ""}
              onChange={(e) => onUpdate({ ...order, notes: e.target.value, note_auto_generee: false })}
              placeholder="Les notes apparaîtront ici après l'upload du devis PDF…"
            />
          </Section>

          {/* ── Déplacer ── */}
          <Section title="Déplacer la commande" icon="↔">
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {COLUMNS.filter((c) => c.id !== order.status).map((c) => (
                <button key={c.id} style={{ ...s.moveBtn, borderColor: c.color, color: c.color }} onClick={() => onMove(order.id, c.id)}>
                  {c.icon} {c.label}
                </button>
              ))}
            </div>
          </Section>
        </div>

        <div style={s.modalFoot}>
          <button style={s.btnEdit} onClick={() => onEdit(order)}>✏️ Modifier</button>
          <button style={s.btnDel} onClick={() => { if (window.confirm("Supprimer ?")) onDelete(order.id); }}>🗑 Supprimer</button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, icon, children }) {
  return (
    <div style={s.section}>
      <div style={s.sectionTitle}>{icon} {title}</div>
      {children}
    </div>
  );
}

function InfoCell({ label, value, color }) {
  return (
    <div style={s.infoCell}>
      <div style={s.infoCellLabel}>{label}</div>
      <div style={{ ...s.infoCellValue, ...(color ? { color, fontWeight: 800 } : {}) }}>{value}</div>
    </div>
  );
}

function FileChip({ f }) {
  return (
    <a href={f.url || "#"} download={f.name} style={s.fileChipFull}>
      📎 {f.name}
    </a>
  );
}

function UploadBtn({ label, onClick }) {
  return <button style={s.uploadBtn} onClick={onClick}>{label}</button>;
}

// ─── SAV SECTION ──────────────────────────────────────────────────────────────

function SavSection({ order, onUpdate }) {
  const [newComment, setNewComment] = useState("");

  const addComment = () => {
    const text = newComment.trim();
    if (!text) return;
    const comment = {
      id: Date.now(),
      text,
      date: new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }),
    };
    onUpdate({ ...order, sav_commentaires: [...(order.sav_commentaires || []), comment] });
    setNewComment("");
  };

  const removeComment = (id) => {
    onUpdate({ ...order, sav_commentaires: order.sav_commentaires.filter((c) => c.id !== id) });
  };

  return (
    <div style={{ ...s.section, border: "1.5px solid #FF5B5B33", background: "#1E1218" }}>
      <div style={{ ...s.sectionTitle, color: "#FF5B5B" }}>⚠ SAV — Détail du problème</div>

      {/* Liste des commentaires */}
      {(order.sav_commentaires || []).length === 0 && (
        <div style={{ color: "#554", fontSize: 12, fontStyle: "italic", marginBottom: 10 }}>
          Aucun commentaire pour l'instant. Décrivez le problème ci-dessous.
        </div>
      )}
      {(order.sav_commentaires || []).map((c) => (
        <div key={c.id} style={s.savComment}>
          <div style={s.savCommentText}>{c.text}</div>
          <div style={s.savCommentMeta}>
            <span style={s.savCommentDate}>🕐 {c.date}</span>
            <button style={s.savCommentDel} onClick={() => removeComment(c.id)}>✕</button>
          </div>
        </div>
      ))}

      {/* Nouveau commentaire */}
      <div style={{ marginTop: 10 }}>
        <textarea
          style={{ ...s.fieldInput, minHeight: 72, resize: "vertical", borderColor: "#FF5B5B44" }}
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Décrivez le problème SAV : défaut constaté, demande client, action à mener…"
          onKeyDown={(e) => { if (e.key === "Enter" && e.ctrlKey) addComment(); }}
        />
        <button
          style={{ ...s.btnSavAdd, marginTop: 8 }}
          onClick={addComment}
          disabled={!newComment.trim()}
        >
          + Ajouter un commentaire
        </button>
        <div style={{ fontSize: 10, color: "#443", marginTop: 4 }}>Ctrl+Entrée pour ajouter rapidement</div>
      </div>
    </div>
  );
}

// ─── ORDER FORM ────────────────────────────────────────────────────────────────

function OrderForm({ order, clients = [], onSave, onClose }) {
  const [form, setForm] = useState({ ...order });
  const [clientSearch, setClientSearch] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const suggestions = clientSearch.length >= 1
    ? clients.filter((c) => c.nom.toLowerCase().includes(clientSearch.toLowerCase()))
    : [];

  const selectClient = (c) => {
    setForm((f) => ({ ...f, client: c.nom, telephone: c.telephone || f.telephone, email: c.email || f.email }));
    setClientSearch(c.nom);
    setShowSuggestions(false);
  };

  const toggleType = (group, label) => {
    const key = label || group;
    const existing = form.types || [];
    const found = existing.find((t) => t.label === key);
    if (found) {
      set("types", existing.filter((t) => t.label !== key));
    } else {
      set("types", [...existing, { group, label: key }]);
    }
  };

  const isTypeSelected = (label) => (form.types || []).some((t) => t.label === label);

  const handleSave = () => {
    if (!form.client) return alert("Nom du client obligatoire.");
    if (!form.reference && !form.axonautId) form.reference = `CMD-00${nextId}`;
    onSave(form);
  };

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={{ ...s.modal, maxWidth: 540 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ ...s.modalTop, borderColor: "#4F9CF9" }}>
          <div style={s.modalClient}>{form.id ? "Modifier la commande" : "Nouvelle commande"}</div>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div style={s.modalBody}>

          {/* Champ client avec recherche */}
          <div style={{ ...s.field, position: "relative" }}>
            <label style={s.fieldLabel}>Client *</label>
            <input
              style={s.fieldInput}
              value={clientSearch || form.client}
              onChange={(e) => { setClientSearch(e.target.value); set("client", e.target.value); setShowSuggestions(true); }}
              onFocus={() => setShowSuggestions(true)}
              placeholder="Tapez pour rechercher ou créer un client…"
            />
            {showSuggestions && suggestions.length > 0 && (
              <div style={s.suggestions}>
                {suggestions.map((c) => (
                  <div key={c.id} style={s.suggestionItem} onClick={() => selectClient(c)}>
                    <div style={s.suggestionNom}>{c.nom}</div>
                    <div style={s.suggestionInfos}>
                      {c.telephone && <span>📞 {c.telephone}</span>}
                      {c.email && <span style={{ marginLeft: 8 }}>✉ {c.email}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Infos contact — pré-remplies si client connu */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Téléphone" value={form.telephone} onChange={(v) => set("telephone", v)} placeholder="06 XX XX XX XX" />
            <Field label="Email" value={form.email} onChange={(v) => set("email", v)} placeholder="client@email.fr" />
          </div>
          <Field label="Référence" value={form.reference} onChange={(v) => set("reference", v)} placeholder="CMD-XXX" />
          <Field label="Réf. Axonaut" value={form.axonautId} onChange={(v) => set("axonaut_id", v)} placeholder="AX-XXXX-XXX" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Montant" value={form.montant} onChange={(v) => set("montant", v)} placeholder="ex: 850 €" />
            <Field label="Date" value={form.date} onChange={(v) => set("date", v)} type="date" />
          </div>

          {/* Types de commande */}
          <div style={s.field}>
            <label style={s.fieldLabel}>Types de commande</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {TYPE_GROUPS.map((g) => (
                <div key={g.group}>
                  {g.items.length === 0 ? (
                    <button type="button"
                      style={{ ...s.typeBtn, ...(isTypeSelected(g.group) ? { background: g.color + "33", borderColor: g.color, color: g.color } : {}) }}
                      onClick={() => toggleType(g.group, g.group)}>
                      {g.emoji} {g.group}
                    </button>
                  ) : (
                    <div>
                      <div style={s.typeGroupLabel}>{g.emoji} {g.group}</div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                        {g.items.map((item) => (
                          <button key={item} type="button"
                            style={{ ...s.typeBtn, ...(isTypeSelected(item) ? { background: g.color + "33", borderColor: g.color, color: g.color } : {}) }}
                            onClick={() => toggleType(g.group, item)}>
                            {item}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div style={s.field}>
            <label style={s.fieldLabel}>Notes internes</label>
            <textarea style={{ ...s.fieldInput, minHeight: 64, resize: "vertical" }}
              value={form.notes} onChange={(e) => set("notes", e.target.value)}
              placeholder="Instructions, priorité…" />
          </div>
        </div>
        <div style={s.modalFoot}>
          <button style={s.btnNew} onClick={handleSave}>{form.id ? "💾 Enregistrer" : "✦ Créer"}</button>
          <button style={{ ...s.btnEdit, marginLeft: 10 }} onClick={onClose}>Annuler</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text" }) {
  return (
    <div style={s.field}>
      <label style={s.fieldLabel}>{label}</label>
      <input style={s.fieldInput} type={type} value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

// ─── CLIENTS BOOK ─────────────────────────────────────────────────────────────

function ClientsBook({ clients, orders, onClose, onNewOrder, onDeleteClient }) {
  const [search, setSearch] = useState("");
  const filtered = clients.filter((c) => c.nom.toLowerCase().includes(search.toLowerCase()));

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={{ ...s.modal, maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ ...s.modalTop, borderColor: "#4ECBA1" }}>
          <div style={s.modalClient}>👥 Annuaire clients</div>
          <div style={{ color: "#556", fontSize: 12, marginTop: 2 }}>{clients.length} client{clients.length > 1 ? "s" : ""} enregistré{clients.length > 1 ? "s" : ""}</div>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div style={s.modalBody}>
          <div style={s.field}>
            <input style={s.fieldInput} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="🔍 Rechercher un client…" />
          </div>
          {filtered.length === 0 && (
            <div style={{ color: "#445", fontSize: 13, textAlign: "center", padding: "20px 0" }}>Aucun client trouvé</div>
          )}
          {filtered.map((c) => {
            const cmdCount = orders.filter((o) => o.client?.toLowerCase() === c.nom.toLowerCase()).length;
            return (
              <div key={c.id} style={s.clientRow}>
                <div style={{ flex: 1 }}>
                  <div style={s.clientNom}>{c.nom}</div>
                  <div style={s.clientInfos}>
                    {c.telephone && <a href={`tel:${c.telephone.replace(/\s/g,"")}`} style={s.clientLink}>📞 {c.telephone}</a>}
                    {c.email && <a href={`mailto:${c.email}`} style={{ ...s.clientLink, marginLeft: 10 }}>✉ {c.email}</a>}
                  </div>
                  {c.axonautId && <div style={s.clientAxo}>AX · {c.axonautId}</div>}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
                  <span style={s.clientCmdBadge}>{cmdCount} commande{cmdCount > 1 ? "s" : ""}</span>
                  <button style={s.clientNewCmd} onClick={() => onNewOrder(c)}>+ Commande</button>
                  <button style={s.clientDel} onClick={() => { if (window.confirm(`Supprimer ${c.nom} ?`)) onDeleteClient(c.id); }}>🗑</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── AXONAUT IMPORT ────────────────────────────────────────────────────────────

function AxonautImport({ mock, imported, onImport, onClose }) {
  const [apiKey, setApiKey] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | done

  const simulateImport = () => {
    setStatus("loading");
    setTimeout(() => setStatus("done"), 1200);
  };

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={{ ...s.modal, maxWidth: 500 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ ...s.modalTop, borderColor: "#4F9CF9" }}>
          <div style={s.modalClient}>Import Axonaut</div>
          <div style={{ color: "#556", fontSize: 12, marginTop: 4 }}>Devis signés → nouvelles commandes</div>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div style={s.modalBody}>
          <div style={s.field}>
            <label style={s.fieldLabel}>Clé API Axonaut</label>
            <input
              style={s.fieldInput}
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Paramètres → API → Votre clé"
            />
            <div style={{ fontSize: 11, color: "#446", marginTop: 4 }}>
              Axonaut → Paramètres → Intégrations → API
            </div>
          </div>

          <button style={{ ...s.btnNew, width: "100%", marginBottom: 16, opacity: status === "loading" ? 0.6 : 1 }} onClick={simulateImport}>
            {status === "loading" ? "Connexion…" : "🔄 Récupérer les devis signés"}
          </button>

          {status === "done" && (
            <div>
              <div style={s.sectionTitle}>📋 Devis disponibles ({mock.length})</div>
              {mock.map((ax) => {
                const done = imported.includes(ax.axonautId);
                return (
                  <div key={ax.axonautId} style={s.axoRow}>
                    <div>
                      <div style={{ fontWeight: 700, color: "#ECF0FF", fontSize: 14 }}>{ax.client}</div>
                      <div style={{ color: "#556", fontSize: 12 }}>{ax.axonautId} · {ax.date} · <span style={{ color: "#4F9CF9" }}>{ax.montant}</span></div>
                    </div>
                    <button
                      style={{ ...s.btnNew, fontSize: 12, padding: "6px 14px", opacity: done ? 0.4 : 1, cursor: done ? "default" : "pointer" }}
                      onClick={() => !done && onImport(ax)}
                      disabled={done}
                    >
                      {done ? "✓ Importé" : "Importer"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── STYLES ────────────────────────────────────────────────────────────────────

const s = {
  root: { minHeight: "100vh", background: "#0D0F18", color: "#E0E4F0", fontFamily: "'DM Sans', 'Segoe UI', sans-serif", paddingBottom: 48 },

  // Header
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 28px", borderBottom: "1px solid #1A1D2C", flexWrap: "wrap", gap: 12 },
  headerLeft: { display: "flex", alignItems: "center", gap: 14 },
  logo: { fontSize: 30, color: "#4F9CF9" },
  appName: { fontSize: 21, fontWeight: 900, letterSpacing: 3, color: "#fff" },
  appSub: { fontSize: 10, color: "#445", letterSpacing: 1.5, textTransform: "uppercase", marginTop: 2 },
  headerStats: { display: "flex", gap: 20, flexWrap: "wrap" },
  hStat: { display: "flex", alignItems: "center", gap: 6 },
  hDot: { width: 7, height: 7, borderRadius: "50%", display: "inline-block" },
  hLabel: { fontSize: 11, color: "#445", letterSpacing: 0.5 },
  btnNew: { background: "linear-gradient(135deg,#4F9CF9,#7B6EF6)", color: "#fff", border: "none", borderRadius: 10, padding: "9px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer" },
  btnAxonaut: { background: "#1A1D2C", color: "#4F9CF9", border: "1px solid #4F9CF922", borderRadius: 10, padding: "9px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer" },
  btnClients: { background: "#1A1D2C", color: "#4ECBA1", border: "1px solid #4ECBA122", borderRadius: 10, padding: "9px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 },
  clientsBadge: { background: "#4ECBA133", color: "#4ECBA1", borderRadius: 10, padding: "1px 7px", fontSize: 11, fontWeight: 800 },

  // Board
  board: { display: "flex", gap: 16, padding: "22px 28px", overflowX: "auto", minHeight: "calc(100vh - 100px)" },

  // Column
  col: { flex: "0 0 270px", background: "#12141E", borderRadius: 14, border: "1.5px solid #1A1D2C", display: "flex", flexDirection: "column", transition: "border-color .2s, background .2s" },
  colHead: { display: "flex", alignItems: "center", gap: 8, padding: "14px 14px 4px" },
  colTitle: { flex: 1, fontWeight: 700, fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: "#8899AA" },
  colBadge: { borderRadius: 20, padding: "2px 9px", fontSize: 12, fontWeight: 800 },
  colBar: { height: 3, margin: "0 14px 12px", borderRadius: 2 },
  cardList: { display: "flex", flexDirection: "column", gap: 9, padding: "0 10px", flex: 1 },
  empty: { textAlign: "center", color: "#2A2D3A", fontSize: 12, padding: "20px 0", border: "1.5px dashed #1E2130", borderRadius: 10 },

  // Card
  card: { background: "#181B27", border: "1px solid #222638", borderRadius: 11, padding: "11px 13px", cursor: "grab", userSelect: "none" },
  cardHead: { display: "flex", alignItems: "center", gap: 6, marginBottom: 5 },
  axoTag: { background: "#4F9CF922", color: "#4F9CF9", fontSize: 9, fontWeight: 800, borderRadius: 4, padding: "2px 6px", letterSpacing: 1 },
  cardRef: { flex: 1, fontSize: 10, color: "#334", fontWeight: 700, letterSpacing: 1 },
  cardMontant: { fontSize: 14, fontWeight: 800 },
  cardClient: { fontWeight: 800, fontSize: 15, color: "#ECF0FF", marginBottom: 6 },
  tagRow: { display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 7 },
  tag: { fontSize: 10, fontWeight: 700, borderRadius: 5, padding: "2px 7px", letterSpacing: 0.3 },
  indicators: { display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 5 },
  pill: { fontSize: 10, fontWeight: 700, borderRadius: 5, padding: "3px 7px" },
  fileChip: { fontSize: 10, color: "#4F9CF9", padding: "3px 7px", background: "#4F9CF922", borderRadius: 5, fontWeight: 700 },
  cardNote: { fontSize: 11, color: "#556", borderTop: "1px solid #1E2130", paddingTop: 6, marginTop: 6, fontStyle: "italic" },
  cardDate: { fontSize: 10, color: "#334", marginTop: 5 },

  // Modal
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,.72)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(4px)" },
  modal: { background: "#12141E", borderRadius: 18, border: "1px solid #1E2130", width: "92%", maxHeight: "90vh", overflowY: "auto", position: "relative" },
  modalTop: { padding: "20px 22px 14px", borderBottom: "2px solid", position: "relative" },
  modalRef: { fontSize: 10, color: "#336", fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" },
  modalClient: { fontSize: 22, fontWeight: 900, color: "#fff", marginTop: 4 },
  closeBtn: { position: "absolute", top: 16, right: 16, background: "none", border: "none", color: "#445", fontSize: 18, cursor: "pointer" },
  modalBody: { padding: "16px 22px" },
  modalFoot: { padding: "12px 22px 20px", display: "flex", alignItems: "center", borderTop: "1px solid #1A1D2C" },

  // Info grid
  infoGrid: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 },
  infoCell: { background: "#181B27", borderRadius: 10, padding: "10px 12px" },
  infoCellLabel: { fontSize: 10, color: "#445", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 },
  infoCellValue: { fontSize: 14, fontWeight: 700, color: "#CCC" },

  // Sections
  section: { marginBottom: 16, background: "#181B27", borderRadius: 10, padding: "12px 14px" },
  sectionTitle: { fontSize: 11, color: "#556", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10, fontWeight: 700 },
  toggleRow: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  toggleLabel: { fontSize: 13, color: "#AAB" },
  toggle: { border: "none", borderRadius: 8, padding: "6px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer" },

  filesLabel: { fontSize: 11, color: "#445", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 },
  fileChipFull: { display: "block", color: "#4F9CF9", fontSize: 12, textDecoration: "none", padding: "6px 10px", background: "#1E2130", borderRadius: 7, marginBottom: 5 },
  uploadBtn: { background: "none", border: "1.5px dashed #2A2D3A", color: "#445", borderRadius: 8, padding: "7px 14px", fontSize: 12, cursor: "pointer", marginTop: 4, width: "100%" },

  moveBtn: { background: "none", border: "1.5px solid", borderRadius: 8, padding: "6px 13px", fontSize: 12, cursor: "pointer", fontWeight: 700 },

  // Buttons
  btnEdit: { background: "#181B27", color: "#AAB", border: "1px solid #222638", borderRadius: 8, padding: "8px 16px", fontSize: 13, cursor: "pointer", fontWeight: 700 },
  btnDel: { background: "none", color: "#E05", border: "1px solid #E05", borderRadius: 8, padding: "8px 16px", fontSize: 13, cursor: "pointer", fontWeight: 700, marginLeft: "auto" },

  // Form
  field: { marginBottom: 14 },
  fieldLabel: { display: "block", fontSize: 10, color: "#445", textTransform: "uppercase", letterSpacing: 1, marginBottom: 5 },
  fieldInput: { width: "100%", background: "#181B27", border: "1px solid #222638", borderRadius: 8, padding: "9px 12px", color: "#ECF0FF", fontSize: 14, outline: "none", boxSizing: "border-box" },
  typeBtn: { background: "#181B27", border: "1.5px solid #222638", borderRadius: 8, padding: "6px 13px", fontSize: 12, color: "#556", cursor: "pointer", fontWeight: 600, transition: "all .15s" },
  typeGroupLabel: { fontSize: 11, color: "#445", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },

  // Axonaut import
  axoRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: "#181B27", borderRadius: 10, marginBottom: 8 },

  // Suggestions client
  suggestions: { position: "absolute", top: "100%", left: 0, right: 0, background: "#1A1D2C", border: "1px solid #252836", borderRadius: 10, zIndex: 100, maxHeight: 200, overflowY: "auto", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" },
  suggestionItem: { padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid #1E2130" },
  suggestionNom: { fontWeight: 700, color: "#ECF0FF", fontSize: 14 },
  suggestionInfos: { color: "#4F9CF9", fontSize: 11, marginTop: 2 },

  // Clients book
  clientRow: { display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 14px", background: "#181B27", borderRadius: 10, marginBottom: 8, border: "1px solid #222638" },
  clientNom: { fontWeight: 800, color: "#ECF0FF", fontSize: 15, marginBottom: 4 },
  clientInfos: { display: "flex", flexWrap: "wrap" },
  clientLink: { color: "#4F9CF9", fontSize: 12, textDecoration: "none", fontWeight: 600 },
  clientAxo: { fontSize: 10, color: "#446", marginTop: 4, letterSpacing: 1 },
  clientCmdBadge: { background: "#4F9CF922", color: "#4F9CF9", borderRadius: 6, padding: "2px 8px", fontSize: 10, fontWeight: 700 },
  clientNewCmd: { background: "linear-gradient(135deg,#4F9CF9,#7B6EF6)", color: "#fff", border: "none", borderRadius: 7, padding: "5px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" },
  clientDel: { background: "none", border: "none", color: "#443", fontSize: 13, cursor: "pointer" },

  // SAV
  savBadgeCard: { fontSize: 10, color: "#FF5B5B", background: "#FF5B5B18", border: "1px solid #FF5B5B33", borderRadius: 5, padding: "3px 7px", marginTop: 6, fontWeight: 700, display: "inline-block" },
  savComment: { background: "#261520", border: "1px solid #FF5B5B22", borderRadius: 8, padding: "10px 12px", marginBottom: 8 },
  savCommentText: { color: "#E0C0C8", fontSize: 13, lineHeight: 1.5, marginBottom: 6 },
  savCommentMeta: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  savCommentDate: { fontSize: 10, color: "#664", letterSpacing: 0.3 },
  savCommentDel: { background: "none", border: "none", color: "#664", fontSize: 13, cursor: "pointer", padding: "0 4px" },
  btnSavAdd: { background: "#FF5B5B18", color: "#FF5B5B", border: "1.5px solid #FF5B5B44", borderRadius: 8, padding: "7px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer", width: "100%" },

  // Contact
  contactRow: { display: "flex", gap: 10, flexWrap: "wrap" },
  contactBtn: { display: "inline-flex", alignItems: "center", gap: 6, background: "#4ECBA118", color: "#4ECBA1", border: "1px solid #4ECBA133", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 700, textDecoration: "none", cursor: "pointer" },
  contactAlert: { marginTop: 10, background: "#4ECBA118", border: "1px solid #4ECBA133", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#4ECBA1", fontWeight: 600 },
  cardCallBtn: { display: "block", marginTop: 7, background: "#4ECBA118", color: "#4ECBA1", border: "1px solid #4ECBA133", borderRadius: 7, padding: "5px 10px", fontSize: 11, fontWeight: 700, textDecoration: "none", textAlign: "center" },
  aiLoading: { display: "flex", alignItems: "center", gap: 8, marginTop: 10, color: "#7B6EF6", fontSize: 12, fontWeight: 600 },
  aiSpinner: { display: "inline-block", animation: "spin 1s linear infinite", fontSize: 16 },
  aiBadge: { background: "#7B6EF618", color: "#A78BFA", border: "1px solid #7B6EF633", borderRadius: 6, padding: "4px 10px", fontSize: 10, fontWeight: 700, letterSpacing: 0.5, marginBottom: 6, display: "inline-block" },
  tagAiBadge: { marginLeft: 4, fontSize: 8, background: "#7B6EF6", color: "#fff", borderRadius: 4, padding: "1px 4px", fontWeight: 800, verticalAlign: "middle" },
};
