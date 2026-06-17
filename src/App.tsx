import { useState } from 'react'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <main className="app">
      <h1 className="title">Conjure</h1>
      <p className="subtitle">
        A pure front-end app built with React + Vite, deployed to GitHub Pages.
      </p>

      <div className="card">
        <button onClick={() => setCount((c) => c + 1)}>
          count is {count}
        </button>
        <p>
          Edit <code>src/App.tsx</code> and save to test hot module replacement.
        </p>
      </div>

      <footer className="footer">
        Edit this starter and push to <code>main</code> — GitHub Actions builds
        and publishes automatically.
      </footer>
    </main>
  )
}

export default App
