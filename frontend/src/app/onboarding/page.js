"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '../../lib/firebase';
import { ChevronRight, User, Activity, Scale, Target } from 'lucide-react';
import Swal from 'sweetalert2';

const OBJECTIFS = [
  {
    id: 'perte',
    label: 'Perte de poids',
    emoji: '🔥',
    description: 'Brûler les graisses, manger moins',
    color: '#f97316',
    bg: 'rgba(249, 115, 22, 0.1)',
    border: 'rgba(249, 115, 22, 0.4)',
  },
  {
    id: 'maintien',
    label: 'Maintien du poids',
    emoji: '⚖️',
    description: 'Stabiliser mon poids actuel',
    color: '#10b981',
    bg: 'rgba(16, 185, 129, 0.1)',
    border: 'rgba(16, 185, 129, 0.4)',
  },
  {
    id: 'prise',
    label: 'Prise de masse',
    emoji: '💪',
    description: 'Développer les muscles',
    color: '#6366f1',
    bg: 'rgba(99, 102, 241, 0.1)',
    border: 'rgba(99, 102, 241, 0.4)',
  },
];

function getImcCategory(imc) {
  if (imc < 18.5) return { label: 'Insuffisance pondérale', color: '#60a5fa', emoji: '📉' };
  if (imc < 25) return { label: 'Poids normal', color: '#10b981', emoji: '✅' };
  if (imc < 30) return { label: 'Surpoids', color: '#f97316', emoji: '⚠️' };
  return { label: 'Obésité', color: '#ef4444', emoji: '🚨' };
}

export default function OnboardingPage() {
  const [user, setUser] = useState(null);
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    age: '',
    sexe: 'homme',
    poids: '',
    taille: '',
    objectif_poids: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((u) => {
      if (!u) router.push('/login');
      else setUser(u);
    });
    return () => unsubscribe();
  }, [router]);

  const handleObjectifSelect = (id) => {
    setFormData({ ...formData, objectif_poids: id });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user || !formData.objectif_poids) {
      Swal.fire({ icon: 'warning', title: 'Objectif manquant', text: 'Veuillez choisir un objectif.', background: '#1e293b', color: '#fff', confirmButtonColor: '#10b981' });
      return;
    }
    setIsLoading(true);

    try {
      const payload = {
        session_id: user.uid,
        age: parseInt(formData.age),
        sexe: formData.sexe,
        poids: parseFloat(formData.poids),
        taille: parseFloat(formData.taille),
        objectif_poids: formData.objectif_poids,
      };

      const res = await fetch('http://localhost:8000/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Erreur serveur');

      const data = await res.json();

      // Calcul IMC côté client pour affichage immédiat
      const tailleM = payload.taille / 100;
      const imc = (payload.poids / (tailleM * tailleM)).toFixed(1);
      const imcCat = getImcCategory(parseFloat(imc));
      const objectifLabel = OBJECTIFS.find(o => o.id === payload.objectif_poids)?.label || '';

      // SweetAlert2 avec carte visuelle riche
      await Swal.fire({
        html: `
          <div style="text-align:center; padding: 0.5rem 0;">
            <div style="font-size:3.5rem; margin-bottom:0.5rem;">${imcCat.emoji}</div>
            <h2 style="color:#fff; font-size:1.6rem; font-weight:700; margin:0 0 0.25rem;">Profil créé avec succès !</h2>
            <p style="color:#94a3b8; font-size:0.95rem; margin:0 0 1.5rem;">Voici votre bilan personnalisé</p>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem; margin-bottom:1.25rem;">
              <div style="background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:0.75rem; padding:1rem;">
                <div style="color:#94a3b8; font-size:0.8rem; margin-bottom:0.25rem;">Votre IMC</div>
                <div style="color:${imcCat.color}; font-size:2rem; font-weight:800;">${imc}</div>
                <div style="color:${imcCat.color}; font-size:0.8rem;">${imcCat.label}</div>
              </div>
              <div style="background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:0.75rem; padding:1rem;">
                <div style="color:#94a3b8; font-size:0.8rem; margin-bottom:0.25rem;">Objectif Calorique</div>
                <div style="color:#10b981; font-size:2rem; font-weight:800;">${data.calories_objectif}</div>
                <div style="color:#94a3b8; font-size:0.8rem;">kcal / jour</div>
              </div>
            </div>

            <div style="background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:0.75rem; padding:0.9rem; margin-bottom:1rem; display:flex; align-items:center; gap:0.75rem;">
              <span style="font-size:1.5rem;">🎯</span>
              <div style="text-align:left;">
                <div style="color:#94a3b8; font-size:0.8rem;">Votre objectif</div>
                <div style="color:#c084fc; font-weight:600;">${objectifLabel}</div>
              </div>
            </div>

            ${parseFloat(imc) >= 25 && payload.objectif_poids === 'maintien' ? `
            <div style="background:rgba(249,115,22,0.1); border:1px solid rgba(249,115,22,0.3); border-radius:0.75rem; padding:1rem; text-align:left; margin-bottom:0.5rem;">
              <div style="display:flex; gap:0.5rem; align-items:flex-start;">
                <span style="font-size:1.2rem;">💡</span>
                <div>
                  <div style="color:#fb923c; font-weight:600; font-size:0.9rem; margin-bottom:0.25rem;">Conseil nutritionnel</div>
                  <div style="color:#fed7aa; font-size:0.85rem; line-height:1.5;">Votre IMC indique un surpoids. Bien que vous ayez choisi le maintien, une légère réduction progressive serait bénéfique pour votre santé à long terme.</div>
                </div>
              </div>
            </div>
            ` : ''}
          </div>
        `,
        background: '#0f172a',
        showConfirmButton: true,
        confirmButtonText: '🚀 Démarrer NutriGo',
        confirmButtonColor: '#10b981',
        allowOutsideClick: false,
        customClass: {
          popup: 'swal-nutrigo-popup',
          confirmButton: 'swal-nutrigo-btn',
        },
      });

      router.push('/');
    } catch (err) {
      console.error(err);
      Swal.fire({
        icon: 'error',
        title: 'Erreur',
        text: "Une erreur est survenue. Vérifiez que le backend est bien lancé.",
        background: '#1e293b',
        color: '#fff',
        confirmButtonColor: '#ef4444',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>Chargement...</div>;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', padding: '2rem', background: 'var(--bg-gradient)' }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '640px', padding: '3rem' }}>

        {/* En-tête */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{ display: 'inline-flex', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16,185,129,0.3)', padding: '1rem', borderRadius: '50%', marginBottom: '1.25rem' }}>
            <User size={32} color="var(--accent-color)" />
          </div>
          <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Créer votre Profil</h1>
          <p style={{ color: 'var(--text-secondary)' }}>NutriBot va calculer votre objectif calorique idéal grâce à l'IA</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>

          {/* Âge & Sexe */}
          <div style={{ display: 'flex', gap: '1.25rem' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                <User size={14} style={{ display: 'inline', marginRight: '0.4rem' }} />Âge
              </label>
              <input
                type="number" required min="10" max="120"
                className="input-field" style={{ width: '100%' }}
                value={formData.age}
                onChange={e => setFormData({ ...formData, age: e.target.value })}
                placeholder="Ex : 25"
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Sexe</label>
              <select
                className="input-field" style={{ width: '100%', cursor: 'pointer' }}
                value={formData.sexe}
                onChange={e => setFormData({ ...formData, sexe: e.target.value })}
              >
                <option value="homme">👨 Homme</option>
                <option value="femme">👩 Femme</option>
              </select>
            </div>
          </div>

          {/* Poids & Taille */}
          <div style={{ display: 'flex', gap: '1.25rem' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                <Scale size={14} style={{ display: 'inline', marginRight: '0.4rem' }} />Poids (kg)
              </label>
              <input
                type="number" step="0.1" required min="20" max="400"
                className="input-field" style={{ width: '100%' }}
                value={formData.poids}
                onChange={e => setFormData({ ...formData, poids: e.target.value })}
                placeholder="Ex : 70"
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                <Activity size={14} style={{ display: 'inline', marginRight: '0.4rem' }} />Taille (cm)
              </label>
              <input
                type="number" required min="100" max="250"
                className="input-field" style={{ width: '100%' }}
                value={formData.taille}
                onChange={e => setFormData({ ...formData, taille: e.target.value })}
                placeholder="Ex : 175"
              />
            </div>
          </div>

          {/* IMC Preview live */}
          {formData.poids && formData.taille && (
            <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '0.75rem', padding: '0.9rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '1.5rem' }}>
                {getImcCategory(parseFloat(formData.poids) / ((parseFloat(formData.taille) / 100) ** 2)).emoji}
              </span>
              <div>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>IMC estimé : </span>
                <span style={{ fontWeight: '700', color: getImcCategory(parseFloat(formData.poids) / ((parseFloat(formData.taille) / 100) ** 2)).color }}>
                  {(parseFloat(formData.poids) / ((parseFloat(formData.taille) / 100) ** 2)).toFixed(1)}
                </span>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginLeft: '0.5rem' }}>
                  — {getImcCategory(parseFloat(formData.poids) / ((parseFloat(formData.taille) / 100) ** 2)).label}
                </span>
              </div>
            </div>
          )}

          {/* Sélection objectif en cartes */}
          <div>
            <label style={{ display: 'block', marginBottom: '0.75rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              <Target size={14} style={{ display: 'inline', marginRight: '0.4rem' }} />Votre objectif principal
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {OBJECTIFS.map((obj) => (
                <button
                  key={obj.id}
                  type="button"
                  onClick={() => handleObjectifSelect(obj.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '1rem',
                    padding: '1rem 1.25rem', borderRadius: '0.875rem',
                    border: `2px solid ${formData.objectif_poids === obj.id ? obj.border : 'rgba(255,255,255,0.08)'}`,
                    background: formData.objectif_poids === obj.id ? obj.bg : 'rgba(255,255,255,0.03)',
                    cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s ease',
                    transform: formData.objectif_poids === obj.id ? 'scale(1.01)' : 'scale(1)',
                  }}
                >
                  <span style={{ fontSize: '1.75rem' }}>{obj.emoji}</span>
                  <div>
                    <div style={{ color: formData.objectif_poids === obj.id ? obj.color : '#fff', fontWeight: '600', fontSize: '1rem' }}>{obj.label}</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{obj.description}</div>
                  </div>
                  {formData.objectif_poids === obj.id && (
                    <div style={{ marginLeft: 'auto', background: obj.color, borderRadius: '50%', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem' }}>✓</div>
                  )}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="send-button"
            style={{ width: '100%', padding: '1.1rem', borderRadius: '0.875rem', marginTop: '0.5rem', fontSize: '1.05rem', gap: '0.5rem', opacity: isLoading ? 0.7 : 1 }}
            disabled={isLoading || !formData.objectif_poids}
          >
            {isLoading ? (
              <span>🤖 L'IA calcule votre objectif...</span>
            ) : (
              <><span>Calculer mon objectif personnalisé</span> <ChevronRight size={20} /></>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
