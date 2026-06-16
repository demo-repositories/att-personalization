// studio/src/actions/generateVariations.tsx
//
// "Generate variations" — a custom DocumentActionComponent attached to
// campaignBrief. Clicking it runs generateMatrix(client, {briefId}) against
// the live Agent Actions API and reports per-cell progress via toasts.
//
// Design notes:
//   - Idempotent: orchestrate uses deterministic ids, so re-clicks overwrite
//     the same docs cleanly.
//   - Re-entrancy: `running` ref + `disabled` flag prevent concurrent runs
//     while one is in flight.
//   - Confirmation dialog before kicking off (Agent Actions cost credits).

import {useCallback, useRef, useState} from 'react'
import {SparklesIcon} from '@sanity/icons'
import {useClient} from 'sanity'
import {useToast} from '@sanity/ui'
import type {DocumentActionComponent, DocumentActionProps} from 'sanity'
import {generateMatrix, type ProgressEvent} from '../personalization/generate/orchestrate'

const API_VERSION = '2024-10-01'

export const generateVariationsAction: DocumentActionComponent = (props: DocumentActionProps) => {
  const {published, draft, id, type, onComplete} = props
  const client = useClient({apiVersion: API_VERSION})
  const toast = useToast()
  const runningRef = useRef(false)
  const [running, setRunning] = useState(false)
  const [showDialog, setShowDialog] = useState(false)

  const briefDoc = (published ?? draft) as {_id?: string} | null
  const rawId = briefDoc?._id ?? id
  const briefId = rawId.startsWith("drafts.") ? rawId.slice(7) : rawId

  const run = useCallback(async () => {
    if (runningRef.current) return
    runningRef.current = true
    setRunning(true)
    setShowDialog(false)

    const startToast = toast.push({
      status: 'info',
      title: 'Generating variations…',
      description: 'Starting',
      duration: 15000,
    })
    void startToast

    let lastDone = 0
    let lastTotal = 0
    try {
      const cells = await generateMatrix(client, {
        briefId,
        onProgress: (p: ProgressEvent) => {
          lastDone = p.done
          lastTotal = p.total
          const step = p.current.step ? ` · step:${p.current.step}` : ''
          toast.push({
            status: 'info',
            title: `Generating ${p.done}/${p.total}`,
            description: `${p.current.channel} → ${p.current.segment}${step}`,
            duration: 4000,
          })
        },
      })
      const errors = cells.filter((c) => c.status === 'error').length
      if (errors > 0) {
        toast.push({
          status: 'warning',
          title: `Generated ${cells.length - errors}/${cells.length} cells (${errors} error${errors === 1 ? '' : 's'})`,
          description: 'Open the Variations tab to inspect failed cells.',
          duration: 8000,
        })
      } else {
        toast.push({
          status: 'success',
          title: `Generated ${cells.length} variation${cells.length === 1 ? '' : 's'}`,
          description: 'Open the Variations tab to preview.',
          duration: 6000,
        })
      }
    } catch (err) {
      toast.push({
        status: 'error',
        title: 'Generation failed',
        description: err instanceof Error ? err.message : String(err),
        duration: 10000,
      })
      // Re-surface in console so devs can dig in.
      // eslint-disable-next-line no-console
      console.error('[generateVariations] failed', err, {lastDone, lastTotal})
    } finally {
      runningRef.current = false
      setRunning(false)
      onComplete()
    }
  }, [briefId, client, toast, onComplete])

  // Only attach to campaignBrief documents.
  if (type !== 'campaignBrief') return null

  return {
    label: running ? 'Generating…' : 'Generate variations',
    icon: SparklesIcon,
    tone: 'primary',
    disabled: running || !briefId,
    onHandle: () => setShowDialog(true),
    dialog: showDialog && {
      type: 'confirm',
      tone: 'primary',
      message:
        'Run the AI generation against the live Agent Actions API for every targeted channel × segment cell. Re-running will overwrite existing variations in place.',
      onConfirm: () => {
        void run()
      },
      onCancel: () => {
        setShowDialog(false)
        onComplete()
      },
    },
  }
}
