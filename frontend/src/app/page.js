"use client";

import { useState, useEffect, useCallback } from 'react';
import { Activity, Flame, Utensils, Target, RefreshCw } from 'lucide-react';
import { auth } from '../lib/firebase';
import Swal from 'sweetalert2';

const OBJECTIFS_MAP = {
  perte: { label: 'Perte de poids', emoji: '🔥', color: '#f97316' },
  maintien: { label: 'Maintien du poids', emoji: '⚖️', color: '#10b981' },
  prise: { label: 'Prise de masse', emoji: '💪', color: '#6366f1' },
};

function getImcCategory(imc) {
  if (imc < 18.5) return { label: 'Insuffisance', color: '#60a5fa', emoji: '📉' };
  if (imc < 25) return { label: 'Poids Normal', color: '#10b981', emoji: '✅' };
  if (imc < 30) return { label: 'Surpoids', color: '#f97316', emoji: '⚠️' };
  return { label: 'Obésité', color: '#ef4444', emoji: '🚨' };
}

export default function Dashboard() {
  const [suivi, setSuivi] = useState({ total_calories: 0, repas: [], objectif: 2000, restant: 2000 });
  const [profile, setProfile] = useState(null);
  const [user, setUser] = useState(null);

  const fetchData = useCallback(async (uid) => {
    try {
      const [suiviRes, profileRes] = await Promise.all([
        fetch(`http://localhost:8000/api/suivi/${uid}`),
        fetch(`http://localhost:8000/api/profile/${uid}`),
      ]);
      if (suiviRes.ok) {
        const data = await suiviRes.json();
        setSuivi({ ...data, restant: Math.max(0, data.objectif - data.total_calories) });
      }
      if (profileRes.ok) {
        const pData = await profileRes.json();
        if (pData.exists) setProfile(pData.profile);
      }
    } catch (e) {
      console.error('Erreur backend', e);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((u) => {
      setUser(u);
      if (u) fetchData(u.uid);
    });
    return () => unsubscribe();
  }, [fetchData]);

  const handleChangeObjectif = async () => {
    const { value: newObjectif } = await Swal.fire({
      title: '🎯 Changer votre objectif',
      html: `
        <p style="color:#94a3b8; margin-bottom:1.5rem; font-size:0.95rem;">Choisissez votre nouvel objectif nutritionnel</p>
        <div style="display:flex; flex-direction:column; gap:0.75rem;">
          ${Object.entries(OBJECTIFS_MAP).map(([id, obj]) => `
            <button
              type="button"
              onclick="document.querySelectorAll('.swal-obj-btn').forEach(b=>b.style.border='1px solid rgba(255,255,255,0.1)'); this.style.border='2px solid ${obj.color}'; document.getElementById('selected-objectif').value='${id}';"
              class="swal-obj-btn"
              style="display:flex;align-items:center;gap:0.9rem;padding:0.9rem 1.1rem;border-radius:0.75rem;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);cursor:pointer;width:100%;text-align:left;transition:all 0.2s;"
            >
              <span style="font-size:1.5rem;">${obj.emoji}</span>
              <span style="color:#fff;font-weight:600;">${obj.label}</span>
            </button>
          `).join('')}
          <input type="hidden" id="selected-objectif" value="${profile?.objectif_poids || 'maintien'}" />
        </div>
      `,
      background: '#0f172a',
      color: '#fff',
      showCancelButton: true,
      confirmButtonText: 'Confirmer',
      cancelButtonText: 'Annuler',
      confirmButtonColor: '#10b981',
      cancelButtonColor: '#475569',
      preConfirm: () => {
        return document.getElementById('selected-objectif').value;
      },
    });

    if (!newObjectif || !user) return;

    // Recalcul complet via l'API onboarding avec le nouvel objectif
    try {
      Swal.fire({
        title: '🤖 Recalcul en cours...',
        text: "L'IA recalcule votre objectif calorique optimal",
        background: '#0f172a',
        color: '#fff',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      const payload = {
        session_id: user.uid,
        age: profile.age,
        sexe: profile.sexe,
        poids: profile.poids,
        taille: profile.taille,
        objectif_poids: newObjectif,
      };

      const res = await fetch('http://localhost:8000/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Erreur serveur');
      const data = await res.json();

      const objInfo = OBJECTIFS_MAP[newObjectif];

      await Swal.fire({
        html: `
          <div style="text-align:center; padding:0.5rem 0;">
            <div style="font-size:3rem; margin-bottom:0.5rem;">${objInfo.emoji}</div>
            <h2 style="color:#fff; font-size:1.5rem; font-weight:700; margin:0 0 0.5rem;">Objectif mis à jour !</h2>
            <p style="color:#94a3b8; margin-bottom:1.5rem;">Votre plan nutritionnel a été recalculé par l'IA</p>
            <div style="background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);border-radius:0.875rem;padding:1.25rem;">
              <div style="color:#94a3b8;font-size:0.85rem;">Nouvel objectif calorique quotidien</div>
              <div style="color:#10b981;font-size:2.5rem;font-weight:800;margin:0.25rem 0;">${data.calories_objectif} kcal</div>
              <div style="color:${objInfo.color};font-weight:600;">${objInfo.label}</div>
            </div>
          </div>
        `,
        background: '#0f172a',
        confirmButtonText: '✨ Super !',
        confirmButtonColor: '#10b981',
      });

      // Rafraîchir les données
      await fetchData(user.uid);

    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Erreur', text: err.message, background: '#1e293b', color: '#fff', confirmButtonColor: '#ef4444' });
    }
  };

  if (!user) return <div style={{ padding: '2rem', color: '#94a3b8' }}>Chargement...</div>;

  const progressPct = Math.min(100, Math.round((suivi.total_calories / (suivi.objectif || 2000)) * 100));
  const progressColor = progressPct >= 100 ? '#ef4444' : progressPct >= 80 ? '#f97316' : '#10b981';
  const imcCat = profile?.imc ? getImcCategory(profile.imc) : null;

  return (
    <div style={{ maxWidth: '840px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h1 style={{ fontSize: '2.5rem', margin: 0 }}>Tableau de bord</h1>
        {profile && (
          <button
            onClick={handleChangeObjectif}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.6rem 1.2rem', borderRadius: '0.75rem',
              border: '1px solid rgba(192, 132, 252, 0.4)',
              background: 'rgba(192, 132, 252, 0.1)',
              color: '#c084fc', cursor: 'pointer',
              fontSize: '0.9rem', fontWeight: '600',
              transition: 'all 0.2s ease',
            }}
            onMouseOver={e => { e.currentTarget.style.background = 'rgba(192,132,252,0.2)'; }}
            onMouseOut={e => { e.currentTarget.style.background = 'rgba(192,132,252,0.1)'; }}
          >
            <RefreshCw size={16} /> Changer mon objectif
          </button>
        )}
      </div>

      {/* Cartes profil */}
      {profile && (
        <div style={{ display: 'flex', gap: '1.25rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
          {/* IMC */}
          <div className="glass-panel" style={{ flex: 1, minWidth: '140px', padding: '1.5rem', textAlign: 'center' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Votre IMC</span>
            <div style={{ fontSize: '2rem', fontWeight: '800', color: imcCat?.color || '#10b981', marginTop: '0.35rem' }}>
              {profile.imc ?? '--'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', marginTop: '0.25rem' }}>
              <span style={{ fontSize: '0.9rem' }}>{imcCat?.emoji}</span>
              <span style={{ fontSize: '0.78rem', color: imcCat?.color }}>{imcCat?.label}</span>
            </div>
          </div>

          {/* Poids */}
          <div className="glass-panel" style={{ flex: 1, minWidth: '140px', padding: '1.5rem', textAlign: 'center' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Poids Actuel</span>
            <div style={{ fontSize: '2rem', fontWeight: '800', color: '#60a5fa', marginTop: '0.35rem' }}>{profile.poids} kg</div>
            <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)' }}>Taille : {profile.taille} cm</span>
          </div>

          {/* Objectif */}
          <div
            className="glass-panel"
            onClick={handleChangeObjectif}
            style={{ flex: 1, minWidth: '140px', padding: '1.5rem', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s' }}
            title="Cliquez pour changer votre objectif"
          >
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Objectif</span>
            <div style={{ fontSize: '1.5rem', marginTop: '0.35rem' }}>
              {OBJECTIFS_MAP[profile.objectif_poids]?.emoji || '🎯'}
            </div>
            <div style={{ fontSize: '0.82rem', fontWeight: '600', color: OBJECTIFS_MAP[profile.objectif_poids]?.color || '#c084fc', marginTop: '0.2rem' }}>
              {OBJECTIFS_MAP[profile.objectif_poids]?.label || 'Non défini'}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)', marginTop: '0.2rem' }}>✏️ Cliquer pour modifier</div>
          </div>
        </div>
      )}

      {/* Calories du jour */}
      <div className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: 'var(--accent-color)', marginBottom: '1.25rem' }}>
          <Flame size={24} />
          <span style={{ fontSize: '1.2rem', fontWeight: '600' }}>Calories du jour</span>
        </div>

        <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
          <span className="calorie-number">{suivi.total_calories}</span>
          <span style={{ color: 'var(--text-secondary)', fontSize: '1rem', marginLeft: '0.5rem' }}>kcal</span>
        </div>

        {/* Barre de progression */}
        <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '9999px', height: '10px', overflow: 'hidden', marginBottom: '0.75rem' }}>
          <div style={{
            height: '100%',
            width: `${progressPct}%`,
            background: `linear-gradient(90deg, ${progressColor}, ${progressColor}cc)`,
            borderRadius: '9999px',
            transition: 'width 0.6s ease',
            boxShadow: `0 0 10px ${progressColor}88`,
          }} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          <span>0 kcal</span>
          <span style={{ color: progressColor, fontWeight: '600' }}>{progressPct}%</span>
          <span>Objectif : {suivi.objectif} kcal</span>
        </div>

        {suivi.restant > 0 ? (
          <div style={{ textAlign: 'center', marginTop: '1rem', color: '#10b981', fontSize: '0.9rem' }}>
            ✅ Il vous reste <strong>{suivi.restant} kcal</strong> pour la journée
          </div>
        ) : (
          <div style={{ textAlign: 'center', marginTop: '1rem', color: '#ef4444', fontSize: '0.9rem' }}>
            ⚠️ Objectif journalier atteint !
          </div>
        )}
      </div>

      {/* Historique des repas */}
      <div className="glass-panel" style={{ padding: '2rem' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>
          <Activity size={20} /> Historique des repas du jour
        </h3>

        {suivi.repas.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-secondary)' }}>
            <Utensils size={48} style={{ opacity: 0.2, margin: '0 auto 1rem' }} />
            <p>Aucun repas enregistré aujourd'hui.</p>
            <p style={{ fontSize: '0.85rem', opacity: 0.6 }}>Utilisez la page <strong>Repas</strong> pour enregistrer vos aliments.</p>
          </div>
        ) : (
          <ul className="meals-list">
            {suivi.repas.map((repas, index) => (
              <li key={index} className="meal-item" style={{ fontSize: '1.05rem' }}>
                <span style={{ fontWeight: '500' }}>{repas.repas}</span>
                <span style={{ color: 'var(--accent-color)', fontWeight: '700' }}>+{repas.calories} kcal</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
