"use client";

import { useState, useEffect } from 'react';
import { Utensils, Plus, Check, Loader2 } from 'lucide-react';
import { auth } from '../../lib/firebase';

const ALIMENTS = [
  // Protéines
  { id: 'poulet', nom: 'Poulet', emoji: '🍗' },
  { id: 'steak', nom: 'Steak', emoji: '🥩' },
  { id: 'saumon', nom: 'Saumon', emoji: '🍣' },
  { id: 'thon', nom: 'Thon', emoji: '🐟' },
  { id: 'oeuf', nom: 'Oeuf', emoji: '🥚' },
  
  // Féculents & Céréales
  { id: 'riz', nom: 'Riz', emoji: '🍚' },
  { id: 'pates', nom: 'Pâtes', emoji: '🍝' },
  { id: 'pain', nom: 'Pain', emoji: '🥖' },
  { id: 'lentilles', nom: 'Lentilles', emoji: '🫘' },
  
  // Légumes
  { id: 'salade', nom: 'Salade', emoji: '🥗' },
  { id: 'tomate', nom: 'Tomate', emoji: '🍅' },
  { id: 'carotte', nom: 'Carotte', emoji: '🥕' },
  { id: 'brocoli', nom: 'Brocoli', emoji: '🥦' },
  { id: 'olive', nom: 'Olive', emoji: '🫒' },
  
  // Fruits
  { id: 'pomme', nom: 'Pomme', emoji: '🍎' },
  { id: 'banane', nom: 'Banane', emoji: '🍌' },
  { id: 'avocat', nom: 'Avocat', emoji: '🥑' },
  
  // Produits laitiers
  { id: 'fromage', nom: 'Fromage', emoji: '🧀' },
  { id: 'lait', nom: 'Lait', emoji: '🥛' },
  { id: 'yaourt', nom: 'Yaourt', emoji: '🥣' },
];

export default function RepasPage() {
  const [selectedItems, setSelectedItems] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [resultat, setResultat] = useState("");
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((u) => setUser(u));
    return () => unsubscribe();
  }, []);

  const toggleAliment = (aliment) => {
    setSelectedItems(prev => {
      const copy = { ...prev };
      if (copy[aliment.id]) {
        delete copy[aliment.id];
      } else {
        copy[aliment.id] = { ...aliment, grammes: 100 };
      }
      return copy;
    });
  };

  const updateGrammes = (id, grammes) => {
    setSelectedItems(prev => ({
      ...prev,
      [id]: { ...prev[id], grammes: parseInt(grammes) || 0 }
    }));
  };

  const soumettreRepas = async () => {
    const itemsArray = Object.values(selectedItems);
    if (itemsArray.length === 0 || !user) return;

    setIsLoading(true);
    setSuccess(false);

    try {
      const response = await fetch('http://localhost:8000/api/log_meal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: itemsArray, session_id: user.uid })
      });

      if (response.ok) {
        const data = await response.json();
        setSuccess(true);
        setSelectedItems({});
        setResultat(data.response);
      }
    } catch (error) {
      console.error(error);
      alert("Erreur lors de l'enregistrement.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
      
      {/* Colonne Sélection */}
      <div style={{ flex: '1', minWidth: '300px' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Utensils size={32} color="var(--accent-color)" />
          Que mangez-vous ?
        </h1>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '1rem' }}>
          {ALIMENTS.map(alim => {
            const isSelected = !!selectedItems[alim.id];
            return (
              <button
                key={alim.id}
                onClick={() => toggleAliment(alim)}
                style={{
                  background: isSelected ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                  border: `1px solid ${isSelected ? 'var(--accent-color)' : 'var(--glass-border)'}`,
                  padding: '1.5rem 1rem',
                  borderRadius: '1rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  color: 'white',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                <span style={{ fontSize: '2rem' }}>{alim.emoji}</span>
                <span style={{ fontWeight: '500' }}>{alim.nom}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Colonne Validation & Grammage */}
      <div style={{ width: '350px' }}>
        <div className="glass-panel" style={{ padding: '2rem', position: 'sticky', top: '2rem' }}>
          <h3 style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem' }}>
            Votre Assiette
          </h3>

          {Object.keys(selectedItems).length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>Sélectionnez des aliments à gauche.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
              {Object.values(selectedItems).map(item => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '0.5rem' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>{item.emoji}</span> {item.nom}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input 
                      type="number" 
                      value={item.grammes} 
                      onChange={(e) => updateGrammes(item.id, e.target.value)}
                      style={{ width: '60px', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', border: '1px solid var(--glass-border)', background: 'transparent', color: 'white', textAlign: 'center' }}
                    />
                    <span style={{ color: 'var(--text-secondary)' }}>g</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <button 
            className="send-button" 
            style={{ width: '100%', padding: '1rem', borderRadius: '0.75rem', gap: '0.5rem' }} 
            disabled={Object.keys(selectedItems).length === 0 || isLoading}
            onClick={soumettreRepas}
          >
            {isLoading ? <Loader2 className="animate-spin" /> : <Plus />}
            {isLoading ? 'Calcul par NutriBot...' : 'Valider ce repas'}
          </button>

          {success && (
            <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid var(--accent-color)', borderRadius: '0.75rem', color: 'var(--text-primary)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-color)', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                <Check size={20} /> Enregistré !
              </div>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{resultat}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
