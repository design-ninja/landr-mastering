import { ComparePlayer } from '../components/ComparePlayer/ComparePlayer'
import styles from './App.module.scss'

export function App() {
  return (
    <main className={styles.page}>
      <div className={styles.radialGlow} aria-hidden="true" />
      <section className={styles.layout}>
        <ComparePlayer />
      </section>
    </main>
  )
}
