import { useEffect, useMemo, useRef, useState } from 'react'
import { AvatarAssistantShell } from './assistant-shells/avatar-ui/AvatarAssistantShell'
import { ChatgptAssistantShell } from './assistant-shells/chatgpt-ui/ChatgptAssistantShell'
import { GuideOverlay } from './components/GuideOverlay'
import { IntroScreen } from './components/IntroScreen'
import { MaterialContent } from './components/materials/MaterialContent'
import { requestAssistantReply } from './lib/assistant'
import { uid } from './lib/id'
import { buildEmailClipboardText, buildUrgentCardContent, getRequiredEmails, getTaskSet } from './lib/materials'
import { createNewSession } from './lib/randomization'
import { loadSession, resetSessionStorage, saveSession } from './lib/storage'
import type {
  AnalysisBrief,
  AppFlow,
  FileDocId,
  MaterialBlock,
  PhaseId,
  RoundState,
  SessionState,
  StageValidationResult,
} from './lib/types'
import { validateAnalysis, validateReplies, validateTaskBreakdown, validateUrgent } from './lib/validation'

const ROUND_DURATION_MS = 15 * 60 * 1000
const URGENT_TRIGGER_MS = 5 * 60 * 1000
const RESEARCHER_KEY_CODE = 'KeyM'
const RESET_KEY_CODE = 'KeyR'

const TIMELINE: Array<{ id: PhaseId; label: string }> = [
  { id: 'ema1', label: 'EMA 1' },
  { id: 'stage1_replies', label: 'Replies' },
  { id: 'stage1_task_breakdown', label: 'Task breakdown' },
  { id: 'ema2', label: 'EMA 2' },
  { id: 'analysis', label: 'Analysis' },
  { id: 'urgent', label: 'Urgent' },
  { id: 'ema3', label: 'EMA 3' },
  { id: 'cutoff', label: 'Cutoff' },
  { id: 'ema4', label: 'EMA 4' }
]

const SURVEY_URLS = {
  1: {
    1: 'https://gatech.co1.qualtrics.com/jfe/form/SV_a9I8QWdCu8nvWjs',
    2: 'https://gatech.co1.qualtrics.com/jfe/form/SV_6JqGbsDmrQ7GW5o',
    3: 'https://gatech.co1.qualtrics.com/jfe/form/SV_1A1ScZCjg1SnKAu',
    4: 'https://gatech.co1.qualtrics.com/jfe/form/SV_6FDWo9PBtbNNLZI'
  },
  2: {
    1: 'https://gatech.co1.qualtrics.com/jfe/form/SV_4YpuK5cybC16SEK',
    2: 'https://gatech.co1.qualtrics.com/jfe/form/SV_6fEXeD3oBv0XMdE',
    3: 'https://gatech.co1.qualtrics.com/jfe/form/SV_9LFY9RV6CnLQI3Y',
    4: 'https://gatech.co1.qualtrics.com/jfe/form/SV_87x4PTPFdihypb8'
  }
} as const

function cloneValue<T>(value: T): T {
  return typeof structuredClone === 'function'
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value))
}

function mutateSession(session: SessionState, updater: (draft: SessionState) => void) {
  const next = cloneValue(session)
  updater(next)
  next.lastUpdatedAt = Date.now()
  return next
}

function withCurrentRound(session: SessionState, updater: (round: RoundState) => void) {
  return mutateSession(session, (draft) => {
    updater(draft.rounds[draft.currentRoundIndex])
  })
}

function formatRemaining(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function phaseLabel(phase: PhaseId) {
  switch (phase) {
    case 'round_intro': return 'Round intro'
    case 'ema1': return 'EMA 1'
    case 'stage1_replies': return 'Stage 1A · Required email replies'
    case 'stage1_task_breakdown': return 'Stage 1B · Pre-meeting task breakdown'
    case 'ema2': return 'EMA 2'
    case 'analysis': return 'Stage 2 · Analysis brief'
    case 'urgent': return 'Urgent task'
    case 'ema3': return 'EMA 3'
    case 'cutoff': return 'Meeting started · editing locked'
    case 'ema4': return 'EMA 4'
    case 'round_complete': return 'Round complete'
    case 'finished': return 'Study complete'
    default: return phase
  }
}

function currentSectionLabel(round: RoundState) {
  switch (round.phase) {
    case 'stage1_replies': return 'Required email replies'
    case 'stage1_task_breakdown': return 'Pre-meeting task breakdown'
    case 'analysis': return 'Analysis brief'
    case 'urgent': return round.emergencyType === 'A' ? 'Urgent Type A' : 'Urgent Type B'
    default: return 'Workspace'
  }
}

function surveyUrl(participantId: string, roundNumber: number, emaIndex: 1 | 2 | 3 | 4) {
  const baseUrl = SURVEY_URLS[roundNumber as 1 | 2]?.[emaIndex]
  if (!baseUrl) {
    return '#'
  }

  const url = new URL(baseUrl)
  url.searchParams.set('participant', participantId)
  url.searchParams.set('round', String(roundNumber))
  url.searchParams.set('ema', String(emaIndex))
  return url.toString()
}

function getCurrentEmaIndex(phase: PhaseId): 1 | 2 | 3 | 4 | null {
  if (phase === 'ema1') return 1
  if (phase === 'ema2') return 2
  if (phase === 'ema3') return 3
  if (phase === 'ema4') return 4
  return null
}

function timelineStatus(round: RoundState, id: PhaseId) {
  const order = TIMELINE.map((item) => item.id)
  const currentIndex = order.indexOf(round.phase === 'round_intro' ? 'ema1' : round.phase)
  const targetIndex = order.indexOf(id)
  if (round.phase === 'round_complete' || round.phase === 'finished') return 'done'
  if (id === round.phase) return 'active'
  return targetIndex < currentIndex ? 'done' : 'todo'
}

function getResearcherUrgentCountdown(round: RoundState, now: number) {
  if (round.urgentStartedAt || round.phase === 'urgent' || round.phase === 'ema3') {
    return {
      label: 'Urgent task',
      tone: 'done' as const,
      value: 'Shown'
    }
  }

  if (round.phase === 'analysis' && round.analysisStartedAt) {
    const remainingMs = URGENT_TRIGGER_MS - (now - round.analysisStartedAt)
    if (remainingMs > 0) {
      return {
        label: 'Urgent task in',
        tone: 'active' as const,
        value: formatRemaining(remainingMs)
      }
    }

    return {
      label: 'Urgent task',
      tone: 'active' as const,
      value: 'Triggering…'
    }
  }

  return {
    label: 'Urgent trigger',
    tone: 'inactive' as const,
    value: 'Not armed'
  }
}

function applyResearcherPhaseTiming(round: RoundState, target: PhaseId) {
  const currentTime = Date.now()
  round.phase = target

  if (target === 'ema1') {
    round.startedAt = null
    round.analysisStartedAt = null
    round.urgentStartedAt = null
    round.cutoffReachedAt = null
    return
  }

  if (target === 'stage1_replies' || target === 'stage1_task_breakdown' || target === 'ema2') {
    round.startedAt = currentTime
    round.analysisStartedAt = null
    round.urgentStartedAt = null
    round.cutoffReachedAt = null
    return
  }

  if (target === 'analysis') {
    round.startedAt = currentTime
    round.analysisStartedAt = currentTime
    round.urgentStartedAt = null
    round.cutoffReachedAt = null
    return
  }

  if (target === 'urgent' || target === 'ema3') {
    round.startedAt = currentTime
    round.analysisStartedAt = currentTime - URGENT_TRIGGER_MS
    round.urgentStartedAt = currentTime
    round.cutoffReachedAt = null
    round.activeMaterialView = 'files'
    round.selectedFileId = 'urgent-card'
    return
  }

  if (target === 'cutoff' || target === 'ema4') {
    round.startedAt = currentTime - ROUND_DURATION_MS
    round.cutoffReachedAt = currentTime
  }
}

function isMacPlatform() {
  if (typeof navigator === 'undefined') return false
  return /(Mac|iPhone|iPad|iPod)/i.test(navigator.platform || navigator.userAgent)
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  const tagName = target.tagName.toLowerCase()
  return tagName === 'input' || tagName === 'textarea' || tagName === 'select' || target.isContentEditable
}

function matchesShortcut(event: KeyboardEvent, code: string) {
  const mac = isMacPlatform()
  const modifiersMatch = mac
    ? event.metaKey && event.altKey && event.shiftKey && !event.ctrlKey
    : event.ctrlKey && event.altKey && event.shiftKey && !event.metaKey

  return modifiersMatch && event.code === code
}

function getGuidePreviewRound(round: RoundState): RoundState {
  const preview = cloneValue(round)
  preview.phase = 'stage1_replies'
  preview.startedAt = null
  preview.analysisStartedAt = null
  preview.urgentStartedAt = null
  preview.cutoffReachedAt = null
  preview.activeMaterialView = 'files'
  preview.selectedFileId = 'meeting-time'
  preview.selectedEmailId = 6
  return preview
}

function nextAppFlowAfterFinish(flow: AppFlow) {
  return flow === 'guide' ? 'study' : flow
}

function App() {
  const [session, setSession] = useState<SessionState>(() => loadSession())
  const [now, setNow] = useState(Date.now())
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle')
  const [copiedEmailId, setCopiedEmailId] = useState<number | null>(null)
  const [validationBusy, setValidationBusy] = useState(false)
  const [assistantBusy, setAssistantBusy] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const emailCopyResetRef = useRef<number | null>(null)

  const liveRound = session.rounds[session.currentRoundIndex]
  const displayRound = session.appFlow === 'guide' ? getGuidePreviewRound(liveRound) : liveRound
  const taskSet = useMemo(() => getTaskSet(displayRound.taskSetId), [displayRound.taskSetId])
  const liveTaskSet = useMemo(() => getTaskSet(liveRound.taskSetId), [liveRound.taskSetId])
  const requiredEmails = useMemo(() => getRequiredEmails(displayRound.taskSetId), [displayRound.taskSetId])
  const emaIndex = session.appFlow === 'study' ? getCurrentEmaIndex(liveRound.phase) : null
  const countdownMs = session.appFlow === 'study' && liveRound.startedAt
    ? ROUND_DURATION_MS - (now - liveRound.startedAt)
    : ROUND_DURATION_MS
  const researcherEnabled = session.researcherMode && session.appFlow === 'study'
  const researcherUrgentCountdown = researcherEnabled ? getResearcherUrgentCountdown(displayRound, now) : null

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    return () => {
      if (emailCopyResetRef.current !== null) {
        window.clearTimeout(emailCopyResetRef.current)
      }
    }
  }, [])

  useEffect(() => {
    saveSession(session)
  }, [session])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.repeat || event.isComposing) return
      if (isEditableTarget(event.target)) return

      if (matchesShortcut(event, RESEARCHER_KEY_CODE)) {
        event.preventDefault()
        setSession((prev) => mutateSession(prev, (draft) => {
          draft.researcherMode = !draft.researcherMode
        }))
        return
      }

      if (matchesShortcut(event, RESET_KEY_CODE)) {
        event.preventDefault()
        setShowResetConfirm(true)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    if (session.appFlow !== 'study') return
    if (!liveRound.startedAt || liveRound.phase === 'cutoff' || liveRound.phase === 'ema4' || liveRound.phase === 'round_complete' || liveRound.phase === 'finished') {
      return
    }

    if (now - liveRound.startedAt >= ROUND_DURATION_MS) {
      setSession((prev) => withCurrentRound(prev, (round) => {
        if (round.phase !== 'cutoff' && round.phase !== 'ema4' && round.phase !== 'round_complete') {
          round.phase = 'cutoff'
          round.cutoffReachedAt = Date.now()
        }
      }))
      return
    }

    if (liveRound.phase === 'analysis' && liveRound.analysisStartedAt && !liveRound.urgentStartedAt) {
      if (now - liveRound.analysisStartedAt >= URGENT_TRIGGER_MS) {
        setSession((prev) => withCurrentRound(prev, (round) => {
          if (round.phase === 'analysis' && !round.urgentStartedAt) {
            round.phase = 'urgent'
            round.urgentStartedAt = Date.now()
            round.activeMaterialView = 'files'
            round.selectedFileId = 'urgent-card'
          }
        }))
      }
    }
  }, [liveRound.analysisStartedAt, liveRound.phase, liveRound.startedAt, liveRound.urgentStartedAt, now, session.appFlow])

  async function copyParticipantId() {
    await navigator.clipboard.writeText(session.participantId)
    setCopyState('copied')
    window.setTimeout(() => setCopyState('idle'), 1200)
  }

  async function copyInboxEmail(email = selectedEmail) {
    await navigator.clipboard.writeText(buildEmailClipboardText(email))
    setCopiedEmailId(email.id)

    if (emailCopyResetRef.current !== null) {
      window.clearTimeout(emailCopyResetRef.current)
    }

    emailCopyResetRef.current = window.setTimeout(() => {
      setCopiedEmailId((current) => (current === email.id ? null : current))
      emailCopyResetRef.current = null
    }, 1200)
  }

  function updateSession(updater: (draft: SessionState) => void) {
    setSession((prev) => mutateSession(prev, updater))
  }

  function updateCurrentRound(mutator: (round: RoundState) => void) {
    setSession((prev) => withCurrentRound(prev, mutator))
  }

  function startGuide() {
    updateSession((draft) => {
      draft.appFlow = 'guide'
      draft.guideStep = 0
    })
  }

  function advanceGuide() {
    updateSession((draft) => {
      draft.guideStep += 1
    })
  }

  function retreatGuide() {
    updateSession((draft) => {
      draft.guideStep = Math.max(0, draft.guideStep - 1)
    })
  }

  function finishGuide() {
    updateSession((draft) => {
      draft.appFlow = nextAppFlowAfterFinish(draft.appFlow)
      draft.guideStep = 0
    })
  }

  function markEmaComplete(index: 1 | 2 | 3 | 4) {
    setSession((prev) => withCurrentRound(prev, (round) => {
      round.emaCompleted[`ema${index}` as const] = true
      if (index === 1) {
        round.phase = 'stage1_replies'
        round.startedAt ??= Date.now()
      } else if (index === 2) {
        round.phase = 'analysis'
        round.analysisStartedAt ??= Date.now()
      } else if (index === 3) {
        round.phase = 'analysis'
      } else if (index === 4) {
        round.roundComplete = true
        round.phase = 'round_complete'
      }
    }))
  }

  async function runValidation(kind: 'stage1_replies' | 'stage1_task_breakdown' | 'analysis' | 'urgent') {
    setValidationBusy(true)
    let result: StageValidationResult
    try {
      if (kind === 'stage1_replies') {
        result = await validateReplies(liveRound)
      } else if (kind === 'stage1_task_breakdown') {
        result = await validateTaskBreakdown(liveRound)
      } else if (kind === 'analysis') {
        result = await validateAnalysis(liveRound)
      } else {
        result = await validateUrgent(liveRound)
      }
    } finally {
      setValidationBusy(false)
    }

    setSession((prev) => withCurrentRound(prev, (round) => {
      round.validation[kind] = result
      if (!result.passed) return
      if (kind === 'stage1_replies') {
        round.phase = 'stage1_task_breakdown'
      } else if (kind === 'stage1_task_breakdown') {
        round.phase = 'ema2'
      } else if (kind === 'urgent') {
        round.phase = 'ema3'
      }
    }))
  }

  function goToNextRound() {
    setSession((prev) => mutateSession(prev, (draft) => {
      if (draft.currentRoundIndex === 0) {
        draft.currentRoundIndex = 1
      }
    }))
  }

  function restartStudy() {
    resetSessionStorage()
    setSession(createNewSession())
    setShowResetConfirm(false)
  }

  function finishStudy() {
    updateSession((draft) => {
      draft.rounds[draft.currentRoundIndex].phase = 'finished'
      draft.appFlow = 'finished'
      draft.guideStep = 0
    })
  }

  async function handleAssistantSend(text: string) {
    const userMessage = { id: uid('user'), role: 'user' as const, text, createdAt: Date.now() }
    setSession((prev) => withCurrentRound(prev, (activeRound) => {
      activeRound.chatMessages.push(userMessage)
    }))
    setAssistantBusy(true)
    try {
      const assistantMessage = await requestAssistantReply({
        tool: liveRound.tool,
        taskSet: liveTaskSet,
        phase: liveRound.phase,
        currentSectionLabel: currentSectionLabel(liveRound),
        userMessage: text,
        conversation: [...liveRound.chatMessages, userMessage]
      })
      setSession((prev) => withCurrentRound(prev, (activeRound) => {
        activeRound.chatMessages.push(assistantMessage)
      }))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown assistant error.'
      setSession((prev) => withCurrentRound(prev, (activeRound) => {
        activeRound.chatMessages.push({ id: uid('system'), role: 'system', text: `Assistant error: ${message}`, createdAt: Date.now() })
      }))
    } finally {
      setAssistantBusy(false)
    }
  }

  function navigateResearcher(target: PhaseId) {
    if (!researcherEnabled) return

    setSession((prev) => withCurrentRound(prev, (round) => {
      applyResearcherPhaseTiming(round, target)
    }))
  }

  const selectedEmail = taskSet.emails.find((item) => item.id === displayRound.selectedEmailId) ?? taskSet.emails[0]
  const inactiveUrgentCardContent: MaterialBlock[] = [
    { type: 'note', content: [{ type: 'text', text: 'The urgent task card will appear here if it is triggered during analysis.' }] }
  ]
  const selectedFileContent: MaterialBlock[] = displayRound.selectedFileId === 'urgent-card'
    ? (displayRound.phase === 'urgent' || displayRound.urgentStartedAt
        ? buildUrgentCardContent(displayRound.taskSetId, displayRound.emergencyType)
        : inactiveUrgentCardContent)
    : taskSet.files.find((file) => file.id === displayRound.selectedFileId)?.body ?? []

  function renderHeader() {
    return (
      <header className="studyHeader">
        <div className="headerMain">
          <div className="headerIdentity">
            <div className="participantBlock" data-guide="participant-id">
              <div>
                <span className="label">Participant ID</span>
                <strong>{session.participantId}</strong>
              </div>
              <button type="button" onClick={copyParticipantId}>
                {copyState === 'copied' ? 'Copied' : 'Copy ID'}
              </button>
            </div>

            <div className="headerPills">
              <div className="pill">Round {displayRound.roundNumber} / 2</div>
              <div className="pill">Tool: {displayRound.tool === 'avatar' ? 'Avatar' : 'ChatGPT'}</div>
              <div className="pill">Set {displayRound.taskSetId}</div>
              <div className="pill">Phase: {session.appFlow === 'finished' ? 'Complete' : phaseLabel(displayRound.phase)}</div>
              {session.appFlow === 'guide' && <div className="pill pillGuide">Guide preview</div>}
            </div>
          </div>

          <div className="headerControls">
            <details className="backgroundDropdown" data-guide="background-dropdown">
              <summary>Background</summary>
              <div className="backgroundPanel">
                <p><strong>Company:</strong> {taskSet.background.company}</p>
                <p><strong>Scenario:</strong> {taskSet.background.scenario}</p>
                <p><strong>Role:</strong> {taskSet.background.role}</p>
                <p><strong>Objective:</strong> {taskSet.background.objective}</p>
              </div>
            </details>

            <div className={`countdown ${countdownMs <= 3 * 60 * 1000 && session.appFlow === 'study' ? 'danger' : ''}`} data-guide="meeting-countdown">
              <span className="label">Meeting starts in</span>
              <strong>{formatRemaining(countdownMs)}</strong>
            </div>

            {researcherUrgentCountdown && (
              <div className={`countdown researcherInfo ${researcherUrgentCountdown.tone}`}>
                <span className="label">{researcherUrgentCountdown.label}</span>
                <strong>{researcherUrgentCountdown.value}</strong>
              </div>
            )}
          </div>
        </div>

        <div className="headerTimelineRow" data-guide="timeline">
          <div className="timelineLead">Progress</div>
          <div className="timelineBar">
            {TIMELINE.map((node) => (
              <button
                key={node.id}
                type="button"
                className={`timelineNode ${timelineStatus(displayRound, node.id)}`}
                onClick={() => navigateResearcher(node.id)}
                disabled={!researcherEnabled}
                title={researcherEnabled ? `Jump to ${node.label}` : node.label}
              >
                <span className="timelineDot" />
                <span>{node.label}</span>
              </button>
            ))}
          </div>
        </div>
      </header>
    )
  }

  function renderInboxMaterial() {
    return (
      <div className="materialPaneGrid">
        <aside className="materialList">
          {taskSet.emails.map((email) => (
            <button
              key={email.id}
              type="button"
              className={`materialListItem ${displayRound.selectedEmailId === email.id ? 'active' : ''}`}
              onClick={() => updateCurrentRound((round) => {
                round.selectedEmailId = email.id
                round.activeMaterialView = 'inbox'
              })}
            >
              <div className="materialListMeta">Email {email.id} · {email.timestamp}</div>
              <div className="materialListSubject">{email.subject}</div>
              <div className="materialListFrom">{email.from}</div>
              {email.requiredReply && <span className="requiredBadge">Required reply</span>}
            </button>
          ))}
        </aside>

        <article className="materialReader" data-guide="materials-reader">
          <div className="materialReaderHeader">
            <div className="materialReaderHeading">
              <h3>{selectedEmail.subject}</h3>
              <div className="readerMeta">From: {selectedEmail.from} · {selectedEmail.timestamp}</div>
            </div>
            <button type="button" className="materialReaderCopy" onClick={() => copyInboxEmail(selectedEmail)}>
              {copiedEmailId === selectedEmail.id ? 'Copied' : 'Copy email'}
            </button>
          </div>
          <MaterialContent content={selectedEmail.body} />
        </article>
      </div>
    )
  }

  function renderFilesMaterial() {
    return (
      <div className="materialPaneGrid">
        <aside className="materialList short">
          {taskSet.files.map((file) => (
            <button
              key={file.id}
              type="button"
              className={`materialListItem ${displayRound.selectedFileId === file.id ? 'active' : ''}`}
              onClick={() => updateCurrentRound((round) => {
                round.selectedFileId = file.id as FileDocId
                round.activeMaterialView = 'files'
              })}
            >
              <div className="materialListSubject">{file.label}</div>
            </button>
          ))}
        </aside>

        <article className="materialReader" data-guide="materials-reader">
          <h3>{taskSet.files.find((file) => file.id === displayRound.selectedFileId)?.label ?? 'File'}</h3>
          <MaterialContent content={selectedFileContent} />
        </article>
      </div>
    )
  }

  function renderValidation(result: StageValidationResult | undefined) {
    if (!result) return null
    return (
      <div className={`validationPanel ${result.passed ? 'success' : 'error'}`}>
        <div className="validationSummary">{result.summary}</div>
        {result.issues.length > 0 && (
          <ul>
            {result.issues.map((issue) => <li key={issue}>{issue}</li>)}
          </ul>
        )}
      </div>
    )
  }

  function updateReply(emailId: number, field: 'to' | 'subject' | 'body', value: string) {
    updateCurrentRound((round) => {
      const target = round.replies.find((item) => item.emailId === emailId)
      if (!target) return
      target[field] = value
    })
  }

  function renderRepliesEditor() {
    return (
      <section className="deliverableSection" data-guide="workspace-panel">
        <div className="deliverableHeader">
          <div>
            <h2>Stage 1A · Required email replies</h2>
            <p>Write one or two complete sentences minimum for each required reply.</p>
          </div>
          <button
            type="button"
            data-guide="continue-button"
            onClick={() => runValidation('stage1_replies')}
            disabled={validationBusy}
          >
            Continue to task breakdown
          </button>
        </div>
        {renderValidation(displayRound.validation.stage1_replies)}
        <div className="replyCards">
          {requiredEmails.map((email) => {
            const draft = displayRound.replies.find((item) => item.emailId === email.id)!
            return (
              <div className="card" key={email.id}>
                <div className="cardTitle">Reply to Email {email.id}</div>
                <label>
                  <span>To</span>
                  <input value={draft.to} onChange={(event) => updateReply(email.id, 'to', event.target.value)} />
                </label>
                <label>
                  <span>Subject</span>
                  <input value={draft.subject} onChange={(event) => updateReply(email.id, 'subject', event.target.value)} />
                </label>
                <label>
                  <span>Body</span>
                  <textarea value={draft.body} onChange={(event) => updateReply(email.id, 'body', event.target.value)} rows={6} />
                </label>
              </div>
            )
          })}
        </div>
      </section>
    )
  }

  function renderTaskBreakdownEditor() {
    return (
      <section className="deliverableSection" data-guide="workspace-panel">
        <div className="deliverableHeader">
          <div>
            <h2>Stage 1B · Pre-meeting task breakdown</h2>
            <p>Identify the work that must be completed before the 11:00 meeting. This stage is checked strictly.</p>
          </div>
          <button
            type="button"
            data-guide="continue-button"
            onClick={() => runValidation('stage1_task_breakdown')}
            disabled={validationBusy}
          >
            Continue to EMA 2
          </button>
        </div>
        {renderValidation(displayRound.validation.stage1_task_breakdown)}
        <div className="card single">
          {[0, 1, 2, 3].map((index) => (
            <label key={index}>
              <span>Task {index + 1}</span>
              <textarea
                value={displayRound.taskBreakdown[index]}
                onChange={(event) => updateCurrentRound((round) => { round.taskBreakdown[index] = event.target.value })}
                rows={2}
                placeholder={index < 3 ? 'Required' : 'Optional'}
              />
            </label>
          ))}
        </div>
      </section>
    )
  }

  function updateAnalysisField(field: keyof AnalysisBrief, value: string) {
    updateCurrentRound((round) => {
      round.analysis[field] = value
    })
  }

  function renderAnalysisEditor() {
    return (
      <section className="deliverableSection" data-guide="workspace-panel">
        <div className="deliverableHeader">
          <div>
            <h2>Stage 2 · Analysis brief</h2>
            <p>Use the packet only. You can validate the brief before the meeting starts.</p>
          </div>
          <button
            type="button"
            data-guide="continue-button"
            onClick={() => runValidation('analysis')}
            disabled={validationBusy}
          >
            Check analysis brief
          </button>
        </div>
        {renderValidation(displayRound.validation.analysis)}
        <div className="card single analysisGrid">
          <label><span>Key findings</span><textarea rows={4} value={displayRound.analysis.keyFindings} onChange={(event) => updateAnalysisField('keyFindings', event.target.value)} /></label>
          <label><span>Evidence</span><textarea rows={4} value={displayRound.analysis.evidence} onChange={(event) => updateAnalysisField('evidence', event.target.value)} /></label>
          <label><span>Recommendation</span><textarea rows={4} value={displayRound.analysis.recommendation} onChange={(event) => updateAnalysisField('recommendation', event.target.value)} /></label>
          <label><span>Risk / uncertainty</span><textarea rows={3} value={displayRound.analysis.risk} onChange={(event) => updateAnalysisField('risk', event.target.value)} /></label>
          <label><span>Meeting discussion questions</span><textarea rows={3} value={displayRound.analysis.questions} onChange={(event) => updateAnalysisField('questions', event.target.value)} /></label>
        </div>
      </section>
    )
  }

  function renderUrgentEditor() {
    return (
      <section className="deliverableSection urgentSection" data-guide="workspace-panel">
        <div className="deliverableHeader">
          <div>
            <h2>Urgent task · Type {displayRound.emergencyType}</h2>
            <p>{taskSet.urgentTasks[displayRound.emergencyType].deliverableHint}</p>
          </div>
          <button
            type="button"
            data-guide="continue-button"
            onClick={() => runValidation('urgent')}
            disabled={validationBusy}
          >
            Submit urgent task
          </button>
        </div>
        {renderValidation(displayRound.validation.urgent)}
        {displayRound.emergencyType === 'A' ? (
          <div className="card single">
            <label><span>Short customer reply</span><textarea rows={4} value={displayRound.urgentA.customerReply} onChange={(event) => updateCurrentRound((round) => { round.urgentA.customerReply = event.target.value })} /></label>
            {[0, 1, 2].map((index) => (
              <label key={index}><span>Internal action step {index + 1}</span><textarea rows={2} value={displayRound.urgentA.actionSteps[index]} onChange={(event) => updateCurrentRound((round) => { round.urgentA.actionSteps[index] = event.target.value as typeof round.urgentA.actionSteps[number] })} /></label>
            ))}
          </div>
        ) : (
          <div className="card single">
            <label><span>Add-on note</span><textarea rows={4} value={displayRound.urgentB.addOnNote} onChange={(event) => updateCurrentRound((round) => { round.urgentB.addOnNote = event.target.value })} /></label>
            {[0, 1, 2].map((index) => (
              <label key={index}><span>Bullet {index + 1}</span><textarea rows={2} value={displayRound.urgentB.bullets[index]} onChange={(event) => updateCurrentRound((round) => { round.urgentB.bullets[index] = event.target.value as typeof round.urgentB.bullets[number] })} /></label>
            ))}
          </div>
        )}
      </section>
    )
  }

  function renderRoundIntro() {
    return (
      <section className="deliverableSection introPanel" data-guide="workspace-panel">
        <h2>Round {displayRound.roundNumber}</h2>
        <p>
          This round uses <strong>{displayRound.tool === 'avatar' ? 'Avatar Assistant' : 'ChatGPT UI'}</strong> with Task Set {displayRound.taskSetId}.
        </p>
        <ul>
          <li>Reply to the designated emails.</li>
          <li>Submit a pre-meeting task breakdown.</li>
          <li>Complete the analysis brief.</li>
          <li>Handle the urgent task if it appears.</li>
          <li>Total drafting time before the meeting starts: 15 minutes.</li>
        </ul>
        <button type="button" data-guide="continue-button" onClick={() => updateCurrentRound((round) => { round.phase = 'ema1' })}>
          Go to EMA 1
        </button>
      </section>
    )
  }

  function renderRoundComplete() {
    return (
      <section className="deliverableSection introPanel" data-guide="workspace-panel">
        <h2>Round {displayRound.roundNumber} complete</h2>
        {session.currentRoundIndex === 0 ? (
          <button type="button" data-guide="continue-button" onClick={goToNextRound}>
            Start round 2
          </button>
        ) : (
          <button type="button" data-guide="continue-button" onClick={finishStudy}>
            Finish study
          </button>
        )}
      </section>
    )
  }

  function renderFinished() {
    return (
      <section className="deliverableSection introPanel" data-guide="workspace-panel">
        <h2>All rounds completed</h2>
        <p>Participant ID: <strong>{session.participantId}</strong></p>
        <p>Notify the researcher that both rounds and all EMA checkpoints are complete.</p>
      </section>
    )
  }

  function renderWorkspace() {
    if (session.appFlow === 'finished' || displayRound.phase === 'finished') return renderFinished()
    if (displayRound.phase === 'round_intro') return renderRoundIntro()
    if (displayRound.phase === 'stage1_replies') return renderRepliesEditor()
    if (displayRound.phase === 'stage1_task_breakdown') return renderTaskBreakdownEditor()
    if (displayRound.phase === 'analysis') return renderAnalysisEditor()
    if (displayRound.phase === 'urgent') return renderUrgentEditor()
    if (displayRound.phase === 'cutoff') {
      return (
        <section className="deliverableSection cutoffNotice" data-guide="workspace-panel">
          <h2>Meeting started. Editing is locked.</h2>
          <p>The hard cutoff has been reached. Proceed to EMA 4.</p>
          <button type="button" data-guide="continue-button" onClick={() => updateCurrentRound((round) => { round.phase = 'ema4' })}>
            Proceed to EMA 4
          </button>
        </section>
      )
    }
    if (displayRound.phase === 'round_complete') return renderRoundComplete()

    return (
      <section className="deliverableSection introPanel" data-guide="workspace-panel">
        <h2>Waiting for next step</h2>
        <p>Complete the active checkpoint to continue.</p>
      </section>
    )
  }

  function renderAssistant() {
    const props = {
      messages: displayRound.chatMessages,
      isLoading: assistantBusy,
      onSend: handleAssistantSend,
      disabled:
        session.appFlow !== 'study' ||
        displayRound.phase === 'cutoff' ||
        displayRound.phase === 'ema1' ||
        displayRound.phase === 'ema2' ||
        displayRound.phase === 'ema3' ||
        displayRound.phase === 'ema4' ||
        displayRound.phase === 'round_complete'
    }

    return displayRound.tool === 'avatar'
      ? <AvatarAssistantShell {...props} />
      : <ChatgptAssistantShell {...props} />
  }

  function renderWorkspaceShell() {
    return (
      <div className="appShell">
        {renderHeader()}

        <main className="workspace">
          <section className="leftZone">
            <div className="zoneHeader" data-guide="materials-nav">
              <div>
                <h2>Materials</h2>
                <p>{taskSet.meetingTimeLabel}</p>
              </div>
              <div className="materialTabs">
                <button
                  type="button"
                  className={displayRound.activeMaterialView === 'inbox' ? 'active' : ''}
                  onClick={() => updateCurrentRound((round) => { round.activeMaterialView = 'inbox' })}
                >
                  Inbox
                </button>
                <button
                  type="button"
                  className={displayRound.activeMaterialView === 'files' ? 'active' : ''}
                  onClick={() => updateCurrentRound((round) => { round.activeMaterialView = 'files' })}
                >
                  Files
                </button>
              </div>
            </div>
            {displayRound.activeMaterialView === 'inbox' ? renderInboxMaterial() : renderFilesMaterial()}
          </section>

          <section className="rightZone">
            <div className="workArea">{renderWorkspace()}</div>
            <div className={`assistantArea ${displayRound.tool === 'avatar' ? 'avatarAssistantArea' : 'chatAssistantArea'}`} data-guide="assistant-panel">
              {renderAssistant()}
            </div>
          </section>
        </main>

        {session.appFlow === 'guide' && (
          <GuideOverlay
            stepIndex={session.guideStep}
            onBack={retreatGuide}
            onNext={advanceGuide}
            onSkip={finishGuide}
            onFinish={finishGuide}
          />
        )}
      </div>
    )
  }

  return (
    <>
      {session.appFlow === 'intro' ? (
        <IntroScreen
          participantId={session.participantId}
          copyState={copyState}
          onCopy={copyParticipantId}
          onContinue={startGuide}
        />
      ) : renderWorkspaceShell()}

      {emaIndex && (
        <div className="overlayBackdrop">
          <div className="overlayCard">
            <div className="overlayEyebrow">EMA {emaIndex} checkpoint</div>
            <h2>Complete the external survey, then return here.</h2>
            <p>Use the same participant ID every time.</p>
            <div className="overlayIdBox">{session.participantId}</div>
            <div className="overlayActions">
              <button type="button" onClick={copyParticipantId}>
                {copyState === 'copied' ? 'Copied' : 'Copy participant ID'}
              </button>
              <a href={surveyUrl(session.participantId, liveRound.roundNumber, emaIndex)} target="_blank" rel="noreferrer">
                Open survey
              </a>
              <button type="button" className="primary" onClick={() => markEmaComplete(emaIndex)}>
                I completed the survey
              </button>
            </div>
          </div>
        </div>
      )}

      {showResetConfirm && (
        <div className="overlayBackdrop">
          <div className="overlayCard narrow">
            <div className="overlayEyebrow">Reset local record</div>
            <h2>Clear the saved progress and start over?</h2>
            <p>This deletes the locally saved participant session, current drafts, guide progress, and round progress for this browser.</p>
            <div className="overlayActions">
              <button type="button" onClick={() => setShowResetConfirm(false)}>Cancel</button>
              <button type="button" className="danger" onClick={restartStudy}>Clear and restart</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default App
