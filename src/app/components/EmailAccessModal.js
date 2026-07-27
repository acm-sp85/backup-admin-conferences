"use client";
import styles from './EmailAccessModal.module.css';

export default function EmailAccessModal({ conference = null }) {
  return (
    <div className={styles.backdrop}>
      <div className={styles.modal}>
        <h2 className={styles.title}>Grabaciones no disponibles</h2>
        <p className={styles.message}>
          Las grabaciones y vídeos de la conferencia ya no se encuentran disponibles.
        </p>
        <p className={styles.submessage}>
          Muchas gracias por su interés y por haber participado.
        </p>
      </div>
    </div>
  );
}
