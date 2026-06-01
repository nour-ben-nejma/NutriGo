"use client";

import { useState, useEffect } from 'react';
import { Scale } from 'lucide-react';
import { auth } from '../../lib/firebase';

export default function ImcPage() {
  const [poids, setPoids] = useState('');
  const [taille, setTaille] = useState('');
  const [imc, setImc] = useState(null);
  const [objectifPoids, setObjectifPoids] = useState(null);
  const [conseil, setConseil] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState(null);

  // Charger automatiquement les données de l'utilisateur au chargement
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (u) => {
      setUser(u);
      if (u) {
        setIsLoading(true);
        try {
          const res = await fetch(`http://localhost:8000/api/profile/${u.uid}`);
          if (res.ok) {
            const data = await res.json();
            if (data.exists && data.profile) {
              setPoids(data.profile.poids.toString());
              setTaille(data.profile.taille.toString());
              setImc(data.profile.imc);
              setObjectifPoids(data.profile.objectif_poids);
              
              // Lancer automatiquement l'analyse de l'IMC existant par l'Agent IA
              const analysisRes = await fetch('http://localhost:8000/api/analyze_imc', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  imc: data.profile.imc, 
                  poids: data.profile.poids, 
                  taille: data.profile.taille / 100,
                  objectif_poids: data.profile.objectif_poids
                })
              });

              if (analysisRes.ok) {
                const analysisData = await analysisRes.json();
                setConseil(analysisData.conseil);
              }
            }
          }
        } catch (error) {
          console.error("Erreur de chargement automatique du profil", error);
        } finally {
          setIsLoading(false);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  const calculerImc = async (e) => {
    e.preventDefault();
    if (!poids || !taille) return;

    const p = parseFloat(poids);
    const t = parseFloat(taille) / 100; // Conversion en mètres si entré en cm
    const tFinal = t < 3 ? t : t / 100; // Sécurité si l'utilisateur entre 175 au lieu de 1.75
    
    const calcul = p / (tFinal * tFinal);
    setImc(calcul);
    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:8000/api/analyze_imc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          imc: calcul, 
          poids: p, 
          taille: tFinal,
          objectif_poids: objectifPoids
        })
      });

      if (response.ok) {
        const data = await response.json();
        setConseil(data.conseil);
      }
    } catch (error) {
      console.error(error);
      setConseil("Erreur lors de la récupération du conseil de l'agent.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '2.5rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <Scale size={32} color="var(--accent-color)" />
        Calcul de l'IMC
      </h1>

      <form className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }} onSubmit={calculerImc}>
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Poids (en kg)</label>
          <input 
            type="number" 
            className="input-field" 
            style={{ width: '100%' }}
            placeholder="Ex: 70"
            value={poids}
            onChange={(e) => setPoids(e.target.value)}
            required
          />
        </div>
        
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Taille (en cm ou m)</label>
          <input 
            type="number" 
            step="0.1"
            className="input-field" 
            style={{ width: '100%' }}
            placeholder="Ex: 175 ou 1.75"
            value={taille}
            onChange={(e) => setTaille(e.target.value)}
            required
          />
        </div>

        <button type="submit" className="send-button" style={{ width: '100%', padding: '1rem', marginTop: '1rem', borderRadius: '0.75rem' }} disabled={isLoading}>
          {isLoading ? 'Analyse par l\'Agent...' : 'Calculer et Ré-Analyser'}
        </button>
      </form>

      {imc && (
        <div className="glass-panel" style={{ padding: '2rem', marginTop: '2rem', animation: 'slideInRight 0.5s ease-out forwards' }}>
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '1.2rem' }}>Votre IMC actuel est de</span>
            <div style={{ fontSize: '3.5rem', fontWeight: 'bold', color: 'var(--accent-color)' }}>
              {imc.toFixed(1)}
            </div>
          </div>
          
          {conseil && (
            <div style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.05)', borderRadius: '1rem', borderLeft: '4px solid var(--accent-color)' }}>
              <h4 style={{ marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Conseil de NutriBot :</h4>
              <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>{conseil}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
