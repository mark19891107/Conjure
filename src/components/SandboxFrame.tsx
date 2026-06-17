import { useEffect, useMemo, useState } from 'react'
import { buildSrcDoc } from '../lib/sandbox'

interface Props {
  fragment: string
  data: unknown
}

/** Runs an AI-generated tool inside a locked-down, no-network iframe. */
export function SandboxFrame({ fragment, data }: Props) {
  const [runtimeError, setRuntimeError] = useState<string | null>(null)

  // New tool → clear any stale error banner.
  useEffect(() => setRuntimeError(null), [fragment])

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      const d = e.data
      if (d && typeof d === 'object' && d.__conjure && d.type === 'error') {
        setRuntimeError(String(d.message))
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  const srcDoc = useMemo(() => buildSrcDoc(fragment, data), [fragment, data])

  return (
    <div className="sandbox">
      {runtimeError && (
        <pre className="sandbox-error" role="alert">
          {runtimeError}
        </pre>
      )}
      <iframe
        title="Generated tool"
        className="sandbox-frame"
        sandbox="allow-scripts"
        srcDoc={srcDoc}
      />
    </div>
  )
}
