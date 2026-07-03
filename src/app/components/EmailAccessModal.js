"use client";
import { useState } from 'react';
import styles from './EmailAccessModal.module.css';

export default function EmailAccessModal({ conference = null }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/participants/check-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, conference }),
        credentials: 'same-origin',
      });
      const data = await res.json();
      if (data.granted) {
        // Reload to apply the set cookie and show protected content
        window.location.reload();
      } else {
        setError(data.message || 'Access denied');
      }
    } catch (err) {
      setError('Network error');
    }
    setLoading(false);
  };

  return (
    <div className={styles.backdrop}>
      <div className={styles.modal}>
        <h2 className={styles.title}>Enter your email to view the stream</h2>
        <form onSubmit={submit} className={styles.form}>
          <input
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={styles.input}
          />
          <button type="submit" disabled={loading} className={styles.button}>
            {loading ? 'Checking…' : 'Enter'}
          </button>
        </form>
        {error && <p className={styles.error} dangerouslySetInnerHTML={{ __html: error }} />}
      </div>
    </div>
  );
}
