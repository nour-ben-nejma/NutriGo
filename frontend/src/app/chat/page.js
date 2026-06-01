"use client";

import { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import { auth } from '../../lib/firebase';

export default function ChatPage() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Bonjour ! Je suis NutriBot, votre coach. Posez-moi vos questions sur la nutrition ou dites-moi ce que vous avez mangé.' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState(null);
  
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((u) => setUser(u));
    return () => unsubscribe();
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !user) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:8000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage, session_id: user.uid })
      });

      if (!response.ok) throw new Error('Erreur réseau');

      const data = await response.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'assistant', content: 'Erreur lors de la communication avec le serveur FastAPI.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const formatMessage = (text) => {
    return text.split('\n').map((line, i) => <p key={i}>{line}</p>);
  };

  if (!user) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 4rem)', maxWidth: '900px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>Chat Coach</h1>
      
      <main className="chat-area glass-panel" style={{ flex: 1, overflow: 'hidden' }}>
        <div className="messages-container" style={{ height: 'calc(100% - 80px)' }}>
          {messages.map((msg, index) => (
            <div key={index} className={`message ${msg.role === 'user' ? 'user' : 'bot'}`}>
              {formatMessage(msg.content)}
            </div>
          ))}
          
          {isLoading && (
            <div className="message bot">
              <div className="typing-indicator">
                <div className="typing-dot"></div>
                <div className="typing-dot"></div>
                <div className="typing-dot"></div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <form className="input-area" onSubmit={sendMessage} style={{ height: '80px', background: 'rgba(0,0,0,0.1)' }}>
          <input
            type="text"
            className="input-field"
            placeholder="Posez votre question..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
          />
          <button type="submit" className="send-button" disabled={isLoading || !input.trim()}>
            <Send size={20} />
          </button>
        </form>
      </main>
    </div>
  );
}
