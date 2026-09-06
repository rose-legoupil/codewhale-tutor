import { useEffect, useMemo, useRef, useState } from 'react'
import {
  API, getJSON, postJSON, putJSON, delJSON, pct, int, fmtDate, fmtTime, masteryStatus, masteryStateInfo,
  ERROR_TYPE_LABELS, MASTERY_STATES, levelFromMastery, starsFromMastery, stars, progressForSyllabus,
  nextQuestFor, weakestConcepts, totalXp, globalLevel, speak, generateQuests,
  coachReply, syllabusEmoji, MOODS, moodToSliders,
} from './lib'
import { useI18n } from './i18n'

function shortId(id) {
  const parts = String(id || '').split('.')
  return parts[parts.length - 1] || id
}

// ---------------------------------------------------------------- shared UI

export function StatCard({ label, value, hint, emoji }) {
  return (
    <div className="stat-card">
      {emoji && <div className="stat-emoji">{emoji}</div>}
      <div className="stat-number">{value}</div>
      <h3>{label}</h3>
      {hint && <p className="stat-hint">{hint}</p>}
    </div>
  )
}

export function ProgressBar({ value, status, width }) {
  const cls = status ? status.cls : ''
  return (
    <div className="progress-track" style={width ? { width } : undefined}>
      <div
        className={`progress-fill ${cls}`}
        style={{ width: `${Math.max(0, Math.min(100, Math.round((Number(value) || 0) * 100)))}%` }}
      />
    </div>
  )
}

export function EmptyState({ emoji = '🐋', title, children }) {
  return (
    <div className="empty-state">
      <div className="empty-emoji">{emoji}</div>
      <h3>{title}</h3>
      {children}
    </div>
  )
}

export function Section({ emoji, title, action, children, className = '' }) {
  return (
    <section className={`card ${className}`}>
      <div className="card-head">
        <h3>{emoji ? `${emoji} ` : ''}{title}</h3>
        {action}
      </div>
      {children}
    </section>
  )
}

function StarRating({ n }) {
  return <span className="stars" aria-label={`${n} out of 5 stars`}>{stars(n)}</span>
}

// ---------------------------------------------------------------- Kingdom (home)

export function Kingdom({ syllabi, details, progress, exams, summary, streak, xp, level, loading, onEnterWorld, onNavigate }) {
  const { t } = useI18n()
  const weak = useMemo(() => weakestConcepts(progress, 5), [progress])
  const masteredCount = (progress || []).reduce(
    (n, p) => n + (p.concept_mastery || []).filter((c) => (c.mastery ?? 0) >= 0.7).length,
    0,
  )

  return (
    <div className="view kingdom">
      <section className="hero card">
        <div className="hero-copy">
          <h1>{t('kingdom.hero.title')}</h1>
          <p className="hero-sub">
            {syllabi.length
              ? t('kingdom.hero.sub', { n: syllabi.length, s: syllabi.length > 1 ? 's' : '' })
              : t('kingdom.hero.subEmpty')}
          </p>
        </div>
        <div className="hero-stats">
          <StatCard emoji="🔥" label={t('kingdom.streak')} value={streak} />
          <StatCard emoji="✨" label={t('kingdom.xp')} value={xp} />
          <StatCard emoji="🏅" label={t('kingdom.level')} value={level} />
          <StatCard emoji="⭐" label={t('kingdom.mastered')} value={masteredCount} />
        </div>
      </section>

      <div className="two-col">
        <div className="col-main">
          <Section emoji="📜" title={t('kingdom.quests')}>
            <QuestList syllabi={syllabi} progress={progress} exams={exams} onNavigate={onNavigate} />
            <button className="btn ghost" onClick={() => onNavigate('quest')}>{t('kingdom.askWhaley')}</button>
          </Section>

          <Section emoji="🏰" title={t('kingdom.worlds')} action={syllabi.length ? <span className="muted">{t('maps.worlds')}: {syllabi.length}</span> : null}>
            {!syllabi.length ? (
              <EmptyState emoji="🏝️" title={t('kingdom.noWorlds.title')}>
                <p className="muted">{t('kingdom.noWorlds.body')}</p>
                <button className="btn" onClick={() => onNavigate('settings')}>{t('kingdom.createFirst')}</button>
              </EmptyState>
            ) : (
              <div className="world-grid">
                {syllabi.map((s) => {
                  const p = progressForSyllabus(progress, s.id)
                  const mastery = p ? p.overall_mastery : 0
                  const lvl = levelFromMastery(mastery)
                  const next = nextQuestFor(s, details[s.id], p)
                  return (
                    <div className="world-card" key={s.id} onClick={() => onEnterWorld(s)}>
                      <div className="world-top">
                        <span className="world-emoji">{syllabusEmoji(s)}</span>
                        <span className="world-level">Level {lvl}/10</span>
                      </div>
                      <h4>{s.name}</h4>
                      <div className="world-meta">
                        <StarRating n={starsFromMastery(mastery)} />
                        <span className="muted">{pct(mastery)} mastery</span>
                      </div>
                      <ProgressBar value={mastery} status={masteryStatus(mastery)} />
                      <div className="world-next">
                        {mastery > 0 ? '🔓 Next: ' : '⛵ Start: '}<b>{next}</b>
                      </div>
                      <div className="world-foot">
                        <span className="muted">{t('common.concepts', { n: s.concepts })}</span>
                        <button className="btn small">{t('kingdom.enter')}</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Section>
        </div>

        <div className="col-side">
          <Section emoji="🧭" title={t('kingdom.radar')}>
            {!weak.length ? (
              <p className="muted">No weak concepts detected. Either you're cruising, or it's time for your first tutoring session! 🎉</p>
            ) : (
              <ul className="radar-list">
                {weak.map((w, i) => (
                  <li key={i} className="radar-item">
                    <span className="radar-dot">{masteryStatus(w.mastery).emoji}</span>
                    <div className="radar-body">
                      <div className="radar-name">{w.concept}</div>
                      <ProgressBar value={w.mastery} status={masteryStatus(w.mastery)} />
                    </div>
                    <span className="muted">{pct(w.mastery)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section emoji="⚔️" title={t('kingdom.examReady')}>
            {(exams || []).length === 0 ? (
              <p className="muted">No exams yet. Add one to ~/.codewhale/exams and I'll forge a Gauntlet.</p>
            ) : (
              <>
                <p className="muted">{(exams || []).filter((e) => e.kind === 'mock').length} mock exam(s) and {(exams || []).filter((e) => e.kind !== 'mock').length} real exam(s) ready.</p>
                <button className="btn ghost" onClick={() => onNavigate('gauntlet')}>{t('kingdom.enterGauntlet')}</button>
              </>
            )}
          </Section>

          {summary && summary.recent_activity && summary.recent_activity.length > 0 && (
            <Section emoji="🕘" title={t('kingdom.recent')}>
              <ul className="activity-list">
                {summary.recent_activity.map((a, i) => (
                  <li key={i} className="activity-item">
                    <span className="activity-concept">{a.concept}</span>
                    <span className="muted">{a.confidence}% confidence</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- World (syllabus detail)

export function World({ syllabus, detail, progress, exams, onBack, onNavigate }) {
  const { t } = useI18n()
  const mastery = progress ? progress.overall_mastery : 0
  const lvl = levelFromMastery(mastery)
  const concepts = (detail && detail.concepts) || []

  return (
    <div className="view world">
      <button className="btn back" onClick={onBack}>{t('common.back')}</button>
      <section className="hero card world-hero">
        <div className="world-hero-emoji">{syllabusEmoji(syllabus)}</div>
        <div className="hero-copy">
          <h1>{syllabus.name}</h1>
          <p className="hero-sub">
            {syllabus.language} · {syllabus.concepts} concepts · ~{syllabus.estimated_hours}h est. · Level {lvl}/10
          </p>
          <div className="world-meta">
            <StarRating n={starsFromMastery(mastery)} />
            <span className="muted">{pct(mastery)} mastery</span>
          </div>
        </div>
      </section>

      <div className="two-col">
        <div className="col-main">
          {detail && detail.learning_objectives && detail.learning_objectives.length > 0 && (
            <Section emoji="🎯" title={t('world.objectives')}>
              <ol className="objectives-list">
                {detail.learning_objectives.map((o, i) => (
                  <li key={i}>{o}</li>
                ))}
              </ol>
            </Section>
          )}

          <Section emoji="🗺️" title={t('world.concepts')}>
            {!concepts.length ? (
              <p className="muted">No concepts parsed yet.</p>
            ) : (
              <div className="concept-list">
                {concepts.map((c, i) => {
                  const cp = (progress && progress.concept_mastery || []).find((x) => x.concept === c.name)
                  const m = cp ? cp.mastery : null
                  const st = masteryStatus(m)
                  return (
                    <div className="concept-row" key={c.name}>
                      <span className="concept-status">{st.emoji}</span>
                      <div className="concept-main">
                        <div className="concept-name">
                          {c.name}
                          {c.module ? <span className="muted"> · {c.module}</span> : null}
                        </div>
                        <ProgressBar value={m == null ? 0 : m} status={st} />
                      </div>
                      <span className="concept-value">{m == null ? '⚪' : pct(m)}</span>
                      {i === 0 && <span className="quest-badge">{t('world.next')}</span>}
                    </div>
                  )
                })}
              </div>
            )}
          </Section>

          <Section emoji="📝" title={t('world.exams')}>
            {!exams.length ? (
              <p className="muted">No exams linked yet. A mock exam is forged automatically when you add a syllabus.</p>
            ) : (
              <div className="chip-row">
                {exams.map((e) => (
                  <button key={e.id} className="chip" onClick={() => onNavigate('gauntlet')}>
                    {e.kind === 'mock' ? '🧪' : '📄'} {e.id} · {e.questions} Q
                  </button>
                ))}
              </div>
            )}
          </Section>
        </div>

        <div className="col-side">
          {progress && progress.weaknesses && progress.weaknesses.length > 0 && (
            <Section emoji="⚠️" title={t('world.weak')}>
              <div className="chip-row">
                {progress.weaknesses.map((w) => (
                  <span key={w} className="chip muted-chip">{w}</span>
                ))}
              </div>
            </Section>
          )}
          <CheatsheetCard syllabusId={syllabus.id} name={syllabus.name} />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- Cheatsheet (shared)

export function CheatsheetCard({ syllabusId, name }) {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    getJSON(`${API}/cheatsheets/${syllabusId}`)
      .then((d) => { if (!cancelled) setContent(d.content || '') })
      .catch((e) => { if (!cancelled) setError(e.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [syllabusId])

  const { t } = useI18n()

  return (
    <Section
      emoji="✨"
      title={t('map.title')}
      action={content ? <button className="btn small ghost" onClick={() => speak(content)}>🔊 {t('common.listen')}</button> : null}
    >
      {loading && <p className="muted">{t('map.loading')}</p>}
      {error && <p className="muted">⚠️ {error}</p>}
      {!loading && !error && content && <pre className="cheatsheet-pre">{content}</pre>}
      {!loading && !error && !content && <p className="muted">{t('map.empty', { name: name || syllabusId })}</p>}
    </Section>
  )
}

// ---------------------------------------------------------------- Quest (the chat / agent home)

export function Quest({ syllabi, progress, exams, prefs, setPrefs, persona, loading, onNavigate, chatPrefill, onConsumePrefill, activeSyllabusId, onChooseSyllabus }) {
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const endRef = useRef(null)
  const seededRef = useRef(false)

  const { t, locale } = useI18n()
  const messages = prefs.chat || []

  // The world this tutoring chat is anchored to. An explicit choice wins, then
  // the first syllabus that has progress, then the first syllabus (so the chat
  // works the same as before when there is only one world).
  const active = useMemo(() => {
    if (activeSyllabusId) {
      const s = syllabi.find((x) => x.id === activeSyllabusId)
      if (s) return s
    }
    const p = (progress || [])[0]
    if (p && p.syllabus_id) {
      const s = syllabi.find((x) => x.id === p.syllabus_id)
      if (s) return s
    }
    return syllabi.find((s) => (s.concepts || 0) > 0) || syllabi[0] || null
  }, [activeSyllabusId, syllabi, progress])
  const targetId = active ? active.id : null

  function chooseWorld(s) {
    if (!s || s.id === targetId) return
    if (onChooseSyllabus) onChooseSyllabus(s.id)
    pushAssistant(t('quest.worldChanged', { name: s.name }))
  }

  useEffect(() => {
    if (seededRef.current) return
    if (loading) return
    if (messages.length) { seededRef.current = true; return }
    seededRef.current = true
    postJSON(`${API}/chat`, { message: '', locale, persona, syllabus_id: targetId })
      .then((res) => {
        const text = (res && res.reply) || coachReply('', { persona, syllabi, progress, exams, active })
        setPrefs((prev) => ({ ...prev, chat: [...(prev.chat || []), { role: 'whaley', text, ts: Date.now() }] }))
      })
      .catch(() => {
        const text = coachReply('', { persona, syllabi, progress, exams, active })
        setPrefs((prev) => ({ ...prev, chat: [...(prev.chat || []), { role: 'whaley', text, ts: Date.now() }] }))
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, messages.length, persona, syllabi, progress, exams, locale, targetId])

  useEffect(() => {
    endRef.current && endRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length, typing])

  useEffect(() => {
    if (chatPrefill) {
      setInput(chatPrefill)
      if (onConsumePrefill) onConsumePrefill()
    }
  }, [chatPrefill, onConsumePrefill])

  function pushAssistant(text) {
    setPrefs((prev) => ({ ...prev, chat: [...(prev.chat || []), { role: 'whaley', text, ts: Date.now() }] }))
  }

  async function send(text) {
    const raw = (text || input || '').trim()
    if (!raw || typing) return
    setInput('')
    setPrefs((prev) => ({ ...prev, chat: [...(prev.chat || []), { role: 'user', text: raw, ts: Date.now() }] }))
    setTyping(true)
    let reply = null
    try {
      const res = await postJSON(`${API}/chat`, { message: raw, locale, persona, syllabus_id: targetId })
      if (res && res.reply) reply = res.reply
    } catch { /* fall back to local coach */ }
    setTimeout(() => {
      pushAssistant(reply || coachReply(raw, { persona, syllabi, progress, exams, active }))
      setTyping(false)
    }, 450)
  }

  async function quizMe() {
    if (typing) return
    // Prefer exams from the world being tutored; fall back to all exams only
    // when the learner has not anchored the chat to a world.
    let candidates = active
      ? (exams || []).filter((e) => e.syllabus_id === active.id && (e.questions || 0) > 0)
      : (exams || []).filter((e) => (e.questions || 0) > 0)
    if (!candidates.length) {
      pushAssistant(active
        ? `No exam or mock battle is ready in "${active.name}" yet — add an exam or press Sync, then I will quiz you. 🎲`
        : 'I need at least one exam or mock exam before I can quiz you. Press Sync after adding a syllabus. 🎲')
      return
    }
    const exam = candidates[Math.floor(Math.random() * candidates.length)]
    setTyping(true)
    let text = `Open the Gauntlet tab and pick "${exam.id}" — your training starts there. 🎲`
    try {
      const a = await getJSON(`${API}/exams/${exam.id}/analysis`)
      const q = a && a.sample_questions && a.sample_questions[0]
      if (q && q.text) {
        text = `Pop quiz, captain! 🎯\n\n"${q.text}"\n\nTake your time, show your working, then tell me what you think. I won't hand you the answer — that would be cheating the quest.`
      }
    } catch { /* fall back to text above */ }
    setTimeout(() => {
      pushAssistant(text)
      setTyping(false)
    }, 500)
  }

  async function nextStep() {
    if (typing) return
    if (!targetId) {
      pushAssistant('Add a syllabus and press Sync first — then I can recommend a next step. 🐋')
      return
    }
    setTyping(true)
    let text = 'I need a syllabus model to recommend a next step. Press Sync if you just added one.'
    try {
      const na = await getJSON(`${API}/policy/next/${targetId}`)
      text = `🎯 Recommended next step${active ? ` in "${active.name}"` : ''}:\n\n${na.label}\nTarget: ${na.title}\n${na.reason}\n\nSuggested task types: ${(na.suggested_task_types || []).join(', ') || '—'} · support: ${na.support_level}`
    } catch { /* fall back to text above */ }
    setTimeout(() => {
      pushAssistant(text)
      setTyping(false)
    }, 450)
  }

  function moodCheck(mood) {
    const sliders = moodToSliders(mood.id)
    const next = sliders
      ? { ...prefs, persona: { ...prefs.persona, strict: sliders.strict, humor: sliders.humor, mood: mood.id } }
      : prefs
    setPrefs(next)
    pushAssistant(`Got it — I'm in ${mood.emoji} ${mood.label} mode today. How can I help?`)
  }

  const quickActions = [
    { key: 'qa.quests', send: 'quests' },
    { key: 'qa.weak', send: 'what are my weaknesses' },
    { key: 'qa.next', fn: nextStep },
    { key: 'qa.quiz', fn: quizMe },
    { key: 'qa.review', send: 'what should I review' },
    { key: 'qa.map', send: 'show me a cheatsheet' },
    { key: 'qa.progress', send: 'how am I doing' },
  ]

  return (
    <div className="view quest">
      <div className="quest-layout">
        <section className="chat-panel card">
          <div className="chat-head">
            <div className="mascot">🐋</div>
            <div>
              <h2>{t('quest.title')}</h2>
              <p className="muted">{t('quest.sub')}</p>
            </div>
          </div>

          {syllabi.length > 1 && (
            <div className="quest-worlds">
              <span className="quest-worlds-label">{t('quest.world')}</span>
              {syllabi.map((s) => (
                <button
                  key={s.id}
                  className={`chip ${active && active.id === s.id ? 'chip-active' : ''}`}
                  onClick={() => chooseWorld(s)}
                  title={s.name}
                >
                  {syllabusEmoji(s)} {s.name}
                </button>
              ))}
            </div>
          )}

          <div className="mood-strip">
            <span className="muted">{t('quest.mood')}</span>
            <div className="mood-buttons">
              {MOODS.map((m) => (
                <button key={m.id} className="mood-btn" onClick={() => moodCheck(m)} title={m.label}>
                  {m.emoji}
                </button>
              ))}
            </div>
          </div>

          <div className="messages" role="log">
            {messages.map((m, i) => (
              <div key={i} className={`msg ${m.role === 'user' ? 'msg-user' : 'msg-whaley'}`}>
                {m.role === 'whaley' && <span className="msg-avatar">🐋</span>}
                <div className="msg-body">
                  <div className="msg-text">{m.text}</div>
                  <div className="msg-meta">
                    {fmtTime(m.ts)}
                    {m.role === 'whaley' && (
                      <button className="link" onClick={() => speak(m.text)} title={t('common.listen')}>🔊</button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {typing && (
              <div className="msg msg-whaley">
                <span className="msg-avatar">🐋</span>
                <div className="msg-body typing">
                  <span className="dot" /><span className="dot" /><span className="dot" />
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <div className="quick-actions">
            {quickActions.map((a) => (
              <button key={a.key} className="chip" onClick={() => (a.fn ? a.fn() : send(a.send))}>{t(a.key)}</button>
            ))}
          </div>

          <form
            className="chat-input"
            onSubmit={(e) => { e.preventDefault(); send() }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t('quest.placeholder')}
              disabled={typing}
            />
            <button type="submit" className="btn primary" disabled={typing || !input.trim()}>{t('quest.send')}</button>
          </form>
        </section>

        <aside className="quest-side">
          <Section emoji="📜" title={t('quest.quests')}>
            <QuestList syllabi={syllabi} progress={progress} exams={exams} onNavigate={onNavigate} active={active} />
          </Section>
          <Section emoji="🧠" title={t('quest.about')}>
            <p className="muted">{t('quest.aboutBody')}</p>
          </Section>
        </aside>
      </div>
    </div>
  )
}

function QuestList({ syllabi, progress, exams, onNavigate, active }) {
  const { t } = useI18n()
  const quests = useMemo(() => generateQuests({ syllabi, progress, exams, active }), [syllabi, progress, exams, active])
  if (!quests.length) {
    return <p className="muted">{t('settings.empty')}</p>
  }
  return (
    <ul className="quest-list">
      {quests.map((q, i) => (
        <li key={i}>
          <button className="quest-item clickable" onClick={() => onNavigate(q.action.view, q.action)}>
            <span className="quest-check">▶</span>
            <span className="quest-body">
              <span className="quest-title">{t(q.titleKey, q.vars)}</span>
              {q.subKey && <span className="quest-sub">{t(q.subKey, q.vars)}</span>}
            </span>
            <span className="quest-arrow">→</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

// ---------------------------------------------------------------- Gauntlet (exams)

export function Gauntlet({ exams, syllabi }) {
  const { t } = useI18n()
  const [selectedId, setSelectedId] = useState(null)
  const [analysis, setAnalysis] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!selectedId) { setAnalysis(null); return }
    let cancelled = false
    setLoading(true)
    setError(null)
    getJSON(`${API}/exams/${selectedId}/analysis`)
      .then((d) => { if (!cancelled) setAnalysis(d) })
      .catch((e) => { if (!cancelled) setError(e.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [selectedId])

  const selected = exams.find((e) => e.id === selectedId) || null

  return (
    <div className="view gauntlet">
      <section className="hero card">
        <div className="hero-copy">
          <h1>{t('gauntlet.title')}</h1>
          <p className="hero-sub">{t('gauntlet.sub')}</p>
        </div>
      </section>

      {!exams.length ? (
        <EmptyState emoji="🛡️" title={t('gauntlet.empty.title')}>
          <p className="muted">Drop a real exam into <code>~/.codewhale/exams</code> or add a syllabus — a mock exam is forged automatically.</p>
        </EmptyState>
      ) : (
        <div className="two-col">
          <div className="col-side">
            <Section emoji="🗡️" title={t('gauntlet.choose')}>
              <div className="exam-list">
                {exams.map((e) => (
                  <button
                    key={e.id}
                    className={`exam-item ${selectedId === e.id ? 'active' : ''}`}
                    onClick={() => setSelectedId(e.id)}
                  >
                    <span className="exam-emoji">{e.kind === 'mock' ? '🧪' : '📄'}</span>
                    <div className="exam-body">
                      <div className="exam-name">{e.id}</div>
                      <div className="muted">{e.kind === 'mock' ? t('gauntlet.mock') : t('gauntlet.real')} · {e.questions} {t('gauntlet.questions').toLowerCase()}</div>
                    </div>
                  </button>
                ))}
              </div>
            </Section>
          </div>

          <div className="col-main">
            {!selected && <EmptyState emoji="🎯" title={t('gauntlet.pick')} />}
            {selected && loading && <p className="muted">{t('gauntlet.scouting')}</p>}
            {selected && error && <p className="muted">⚠️ {error}</p>}
            {selected && analysis && (
              <>
                <Section emoji="📈" title={`${t('gauntlet.portrait')} — ${selected.id}`}>
                  <div className="portrait-grid">
                    <StatCard emoji="🧾" label={t('gauntlet.questions')} value={analysis.total_questions} />
                    <StatCard emoji="🟢" label={t('gauntlet.easy')} value={analysis.difficulty_distribution?.easy ?? 0} />
                    <StatCard emoji="🟡" label={t('gauntlet.medium')} value={analysis.difficulty_distribution?.medium ?? 0} />
                    <StatCard emoji="🔴" label={t('gauntlet.hard')} value={analysis.difficulty_distribution?.hard ?? 0} />
                  </div>
                  {analysis.question_types && (
                    <div className="chip-row">
                      {Object.entries(analysis.question_types)
                        .filter(([, n]) => n > 0)
                        .map(([k, n]) => (
                          <span key={k} className="chip muted-chip">{k}: {n}</span>
                        ))}
                    </div>
                  )}
                </Section>

                {analysis.concepts && analysis.concepts.length > 0 && (
                  <Section emoji="🧭" title={t('gauntlet.concepts')}>
                    <div className="chip-row">
                      {analysis.concepts.map((c) => (
                        <span key={c} className="chip muted-chip">{c}</span>
                      ))}
                    </div>
                  </Section>
                )}

                {analysis.sample_questions && analysis.sample_questions.length > 0 && (
                  <Section emoji="🎯" title={t('gauntlet.samples')}>
                    <div className="sample-list">
                      {analysis.sample_questions.map((q, i) => (
                        <div className="sample-q" key={i}>
                          <div className="sample-q-text">
                            <b>{q.concept}</b> — {q.text}
                            <span className="muted"> ({q.type}{q.bloom_level ? ` · Bloom: ${q.bloom_level}` : ''})</span>
                          </div>
                          {(q.evaluates && q.evaluates.length > 0) && (
                            <div className="chip-row">
                              {q.evaluates.map((ev, j) => (
                                <span key={j} className="chip">🎯 {shortId(ev.competence)} · weight {ev.weight}</span>
                              ))}
                            </div>
                          )}
                          {q.complexity && (
                            <div className="chip-row">
                              {Object.entries(q.complexity).map(([dim, v]) => (
                                <span key={dim} className="chip muted-chip">{dim}: {v}</span>
                              ))}
                            </div>
                          )}
                          {(q.hints && q.hints.length > 0) && (
                            <ul className="simple-list">
                              {q.hints.map((h) => <li key={h.level}>💡 {h.content}</li>)}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  </Section>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- Maps (cheatsheets)

export function Maps({ syllabi, details }) {
  const { t } = useI18n()
  const [selectedId, setSelectedId] = useState((syllabi[0] && syllabi[0].id) || null)

  const selected = syllabi.find((s) => s.id === selectedId) || syllabi[0] || null
  const detail = selected ? details[selected.id] : null

  return (
    <div className="view maps">
      <section className="hero card">
        <div className="hero-copy">
          <h1>{t('maps.title')}</h1>
          <p className="hero-sub">{t('maps.sub')}</p>
        </div>
      </section>

      {!syllabi.length ? (
        <EmptyState emoji="🗺️" title={t('maps.empty.title')}>
          <p className="muted">Add a syllabus and press Sync — I'll draw a Treasure Map for each one.</p>
        </EmptyState>
      ) : (
        <div className="two-col">
          <div className="col-side">
            <Section emoji="🧭" title={t('maps.worlds')}>
              <div className="exam-list">
                {syllabi.map((s) => (
                  <button
                    key={s.id}
                    className={`exam-item ${selectedId === s.id ? 'active' : ''}`}
                    onClick={() => setSelectedId(s.id)}
                  >
                    <span className="exam-emoji">{syllabusEmoji(s)}</span>
                    <div className="exam-body">
                      <div className="exam-name">{s.name}</div>
                      <div className="muted">{t('common.concepts', { n: s.concepts })}</div>
                    </div>
                  </button>
                ))}
              </div>
            </Section>
          </div>
          <div className="col-main">
            {selected && (
              <>
                {detail && detail.concepts && detail.concepts.length > 0 && (
                  <Section emoji="🧩" title={t('maps.overview', { name: selected.name })}>
                    <div className="chip-row">
                      {detail.concepts.map((c) => (
                        <span key={c.name} className="chip muted-chip">{c.name}</span>
                      ))}
                    </div>
                  </Section>
                )}
                <CheatsheetCard syllabusId={selected.id} name={selected.name} />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- Model (curriculum → competence → learner)

export function ModelView({ syllabi, progress }) {
  const { t } = useI18n()
  const [selectedId, setSelectedId] = useState((syllabi[0] && syllabi[0].id) || null)
  const [model, setModel] = useState(null)
  const [nextAction, setNextAction] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!selectedId) { setModel(null); setNextAction(null); return }
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([
      getJSON(`${API}/model/${selectedId}`).catch(() => null),
      getJSON(`${API}/policy/next/${selectedId}`).catch(() => null),
    ]).then(([m, na]) => {
      if (cancelled) return
      setModel(m)
      setNextAction(na)
    }).catch((e) => { if (!cancelled) setError(e.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [selectedId])

  const learner = progress.find((p) => p.syllabus_id === selectedId) || null
  const byConcept = {}
  for (const c of (learner && learner.concept_mastery) || []) byConcept[c.concept] = c
  const edges = (model && model.graph && model.graph.edges) || []

  return (
    <div className="view model-view">
      <section className="hero card">
        <div className="hero-copy">
          <h1>{t('model.title')}</h1>
          <p className="hero-sub">{t('model.sub')}</p>
        </div>
      </section>

      {!syllabi.length ? (
        <EmptyState emoji="🧩" title={t('model.empty.title')}>
          <p className="muted">Add a syllabus and press Sync — I'll extract competencies and their prerequisite graph.</p>
        </EmptyState>
      ) : (
        <>
          <div className="syllabus-selector">
            {syllabi.map((s) => (
              <button key={s.id} className={s.id === selectedId ? 'active' : ''} onClick={() => setSelectedId(s.id)}>
                {syllabusEmoji(s)} {s.name}
              </button>
            ))}
          </div>

          {loading && <p className="muted">Building the model…</p>}
          {error && <p className="muted">⚠️ {error}</p>}

          {!loading && nextAction && (
            <Section emoji="🎯" title={t('model.next')}>
              <div className="next-action">
                <div className="na-label">{nextAction.label}</div>
                <div className="na-target">Target: <b>{nextAction.title}</b></div>
                <div className="muted">{nextAction.reason}</div>
                <div className="chip-row">
                  <span className="chip">support: {nextAction.support_level}</span>
                  {(nextAction.suggested_task_types || []).map((t) => (
                    <span key={t} className="chip muted-chip">{t}</span>
                  ))}
                </div>
              </div>
            </Section>
          )}

          {!loading && model && (
            <div className="two-col">
              <div className="col-main">
                <Section emoji="📚" title={`${t('model.domains')} — ${model.name}`}>
                  <div className="chip-row">
                    <span className="chip">{model.discipline}</span>
                    <span className="chip muted-chip">source: {model.source_status}</span>
                    {(model.domaines || []).map((d) => (
                      <span key={d.name} className="chip muted-chip">{d.name}</span>
                    ))}
                  </div>
                </Section>

                <Section emoji="🎯" title={t('model.competences')} action={<span className="muted">{(model.competences || []).length}</span>}>
                  <div className="competence-list">
                    {(model.competences || []).map((c) => {
                      const st = c.name && byConcept[c.name]
                        ? masteryStateInfo(byConcept[c.name].mastery_state)
                        : masteryStateInfo('non_aborde')
                      return (
                        <div className="competence-card" key={c.id}>
                          <div className="comp-head">
                            <span className="comp-state">{st.emoji}</span>
                            <div className="comp-title">
                              <b>{c.intitule}</b>
                              <div className="muted mono">{c.id}</div>
                            </div>
                          </div>
                          <div className="chip-row">
                            {(c.type_labels || c.type || []).map((t) => (
                              <span key={t} className="chip muted-chip">{t}</span>
                            ))}
                            {c.inferred && c.inferred.length > 0 && (
                              <span className="chip muted-chip" title={`Inferred: ${c.inferred.join(', ')}`}>⚙️ inferred</span>
                            )}
                          </div>
                          {c.criteres_reussite && c.criteres_reussite.length > 0 && (
                            <ul className="simple-list">
                              {c.criteres_reussite.map((cr, i) => <li key={i}>✓ {cr}</li>)}
                            </ul>
                          )}
                          {c.erreurs_frequentes && c.erreurs_frequentes.length > 0 && (
                            <div className="muted">⚠️ Frequent errors: {c.erreurs_frequentes.join(' · ')}</div>
                          )}
                          {c.prerequis && c.prerequis.length > 0 && (
                            <div className="muted">← Prerequisites: {c.prerequis.join(', ')}</div>
                          )}
                          {byConcept[c.name] && (
                            <div className="chip-row">
                              <span className="chip">attempts: {byConcept[c.name].evidence?.attempts ?? 0}</span>
                              <span className="chip">independent: {byConcept[c.name].evidence?.independent_successes ?? 0}</span>
                              {(byConcept[c.name].observed_errors || []).map(([et, n]) => (
                                <span key={et} className="chip muted-chip">{ERROR_TYPE_LABELS[et] || et}: {n}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </Section>
              </div>

              <div className="col-side">
                <Section emoji="🕸️" title={t('model.graph')}>
                  <p className="muted">{(model.graph?.nodes || []).length} nodes · {edges.length} prerequisite edges.</p>
                  {edges.length ? (
                    <ul className="simple-list graph-edges">
                      {edges.map((e, i) => (
                        <li key={i}>{shortId(e.source)} → {shortId(e.target)}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted">No explicit prerequisites inferred.</p>
                  )}
                </Section>

                <Section emoji="🧠" title={t('model.mastery')}>
                  <div className="chip-row">
                    {MASTERY_STATES.map((s) => (
                      <span key={s.key} className="chip muted-chip">{s.emoji} {s.label}</span>
                    ))}
                  </div>
                  <p className="muted">{t('model.masteryBody')}</p>
                </Section>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- Reflection (weekly report)

export function Reflection({ progress, analytics, summary }) {
  const { t } = useI18n()
  const mastered = (progress || []).reduce(
    (n, p) => n + (p.concept_mastery || []).filter((c) => (c.mastery ?? 0) >= 0.7).length,
    0,
  )
  const totalConcepts = (progress || []).reduce((n, p) => n + (p.concept_mastery || []).length, 0)
  const xp = totalXp(progress)

  return (
    <div className="view reflection">
      <section className="hero card">
        <div className="hero-copy">
          <h1>{t('refl.title')}</h1>
          <p className="hero-sub">{t('refl.sub')}</p>
        </div>
      </section>

      {!progress.length && !analytics ? (
        <EmptyState emoji="📜" title={t('refl.empty.title')}>
          <p className="muted">Once you start tutoring, your weekly scroll and analytics will appear here.</p>
        </EmptyState>
      ) : (
        <div className="two-col">
          <div className="col-main">
            <Section emoji="📜" title={t('refl.scroll')}>
              <ul className="scroll-list">
                <li>🏆 You've mastered <b>{mastered}</b> concept{mastered === 1 ? '' : 's'} — {mastered >= 10 ? 'more than a dragon slayer on a busy Tuesday!' : 'the quest is on!'}</li>
                <li>🧠 Total concepts tracked: <b>{totalConcepts}</b></li>
                <li>✨ Experience gained: <b>{xp} XP</b> — your brain is getting swole! 💪</li>
                {analytics && analytics.learning_rate != null && (
                  <li>📈 Learning rate: <b>{pct(analytics.learning_rate)}</b></li>
                )}
              </ul>
            </Section>

            {analytics && analytics.error_patterns && analytics.error_patterns.length > 0 && (
              <Section emoji="🔍" title={t('refl.patterns')}>
                <p className="muted">The mistakes that keep trying to board your ship:</p>
                <div className="chip-row">
                  {analytics.error_patterns.map(([t, n]) => (
                    <span key={t} className="chip muted-chip">{t}: {n}</span>
                  ))}
                </div>
              </Section>
            )}

            {analytics && analytics.overconfidence > 0 && (
              <Section emoji="🎯" title={t('refl.calibration')}>
                <p className="muted">
                  Overconfidence: {pct(analytics.overconfidence)} — you rate yourself a touch higher than your accuracy. Knowing that is half the battle.
                </p>
              </Section>
            )}
          </div>

          <div className="col-side">
            {summary && summary.most_learned_concepts && summary.most_learned_concepts.length > 0 && (
              <Section emoji="🌟" title={t('refl.allies')}>
                <ul className="simple-list">
                  {summary.most_learned_concepts.map((c) => <li key={c}>{c}</li>)}
                </ul>
              </Section>
            )}
            {summary && summary.most_challenging_concepts && summary.most_challenging_concepts.length > 0 && (
              <Section emoji="🐉" title={t('refl.nemeses')}>
                <ul className="simple-list">
                  {summary.most_challenging_concepts.map((c) => <li key={c}>{c}</li>)}
                </ul>
              </Section>
            )}
            {weakestConcepts(progress, 3).length > 0 && (
              <Section emoji="🗡️" title={t('refl.focus')}>
                <ul className="simple-list">
                  {weakestConcepts(progress, 3).map((w) => (
                    <li key={w.concept}>{w.concept} — {pct(w.mastery)}</li>
                  ))}
                </ul>
              </Section>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- Settings (setup)

export function Settings({ syllabi, onChanged }) {
  const { t } = useI18n()
  const [tab, setTab] = useState('syllabi')
  const [sources, setSources] = useState([])
  const [uploading, setUploading] = useState(false)
  const [status, setStatus] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [newLanguage, setNewLanguage] = useState('auto')
  const [targetId, setTargetId] = useState(null)

  const [selectedId, setSelectedId] = useState((syllabi[0] && syllabi[0].id) || null)
  const [modelJson, setModelJson] = useState('')
  const [modelSaved, setModelSaved] = useState(false)

  const [llm, setLlm] = useState(null)

  // The syllabus documents are uploaded into. Prefer the explicit choice, then
  // a syllabus that already has content, then the first one.
  const target = syllabi.find((s) => s.id === targetId)
    || syllabi.find((s) => (s.concepts || 0) > 0)
    || syllabi[0]
    || null

  async function loadSources() {
    try { setSources(await getJSON(`${API}/sources`)) } catch { setSources([]) }
  }
  async function loadLlm() {
    try { setLlm(await getJSON(`${API}/settings/llm`)) } catch { setLlm(null) }
  }

  useEffect(() => { loadSources() }, [])
  useEffect(() => { loadLlm() }, [])

  async function readAsBase64(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => resolve(String(r.result).split(',')[1] || '')
      r.onerror = reject
      r.readAsDataURL(file)
    })
  }

  async function uploadInto(fileList, kind) {
    const files = Array.from(fileList || []).filter(Boolean)
    if (!files.length) return
    if (!target) {
      setStatus(`⚠️ ${t('settings.target.none')}`)
      return
    }
    setUploading(true)
    setStatus('')
    try {
      for (const file of files) {
        const base64 = await readAsBase64(file)
        await postJSON(`${API}/upload`, { filename: file.name, kind, syllabus_id: target.id, data: base64, encoding: 'base64' })
      }
      setStatus(`✓ ${files.length} ${files.length === 1 ? 'file' : 'files'} → ${target.name}`)
      await Promise.all([loadSources(), onChanged && onChanged()])
    } catch (e) {
      setStatus(`⚠️ ${e.message}`)
    } finally {
      setUploading(false)
    }
  }

  async function createSyllabus(e) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) {
      setStatus(`⚠️ ${t('settings.create.name')}`)
      return
    }
    setStatus('')
    try {
      const res = await postJSON(`${API}/syllabi`, { name, language: newLanguage })
      setNewName('')
      setShowNew(false)
      setTargetId(res.id)
      setStatus(`✓ ${t('settings.created', { name: res.name })}`)
      await Promise.all([loadSources(), onChanged && onChanged()])
    } catch (err) {
      setStatus(`⚠️ ${err.message}`)
    }
  }

  async function onDelete(id) {
    if (!window.confirm(t('settings.delete.confirm'))) return
    setStatus('')
    try {
      await delJSON(`${API}/syllabi/${id}`)
      if (targetId === id) setTargetId(null)
      setStatus('✓')
      await Promise.all([loadSources(), onChanged && onChanged()])
    } catch (e) {
      setStatus(`⚠️ ${e.message}`)
    }
  }

  async function loadModel(id) {
    setSelectedId(id)
    setModelSaved(false)
    try {
      const m = await getJSON(`${API}/model/${id}`)
      setModelJson(JSON.stringify(m.competences || [], null, 2))
    } catch (e) {
      setModelJson('')
      setStatus(`⚠️ ${e.message}`)
    }
  }

  async function saveModel() {
    if (!selectedId) return
    setStatus('')
    try {
      const competences = JSON.parse(modelJson || '[]')
      await putJSON(`${API}/model/${selectedId}`, { competences })
      setModelSaved(true)
      setStatus(`✓ ${t('settings.model.saved')}`)
      if (onChanged) await onChanged()
    } catch (e) {
      setStatus(`⚠️ ${e.message}`)
    }
  }

  async function saveLlm() {
    if (!llm) return
    setStatus('')
    try {
      await putJSON(`${API}/settings/llm`, { base_url: llm.base_url, model: llm.model, api_key: llm.api_key, enabled: !!llm.enabled })
      setStatus('✓')
      await loadLlm()
    } catch (e) {
      setStatus(`⚠️ ${e.message}`)
    }
  }

  async function useOllama(model) {
    if (!llm || !llm.ollama) return
    const base = llm.ollama.openai_base_url
    setLlm((p) => ({ ...(p || {}), base_url: base, model, api_key: '', enabled: true }))
    try {
      await putJSON(`${API}/settings/llm`, { base_url: base, model, api_key: '', enabled: true })
      setStatus('✓')
      await loadLlm()
    } catch (e) {
      setStatus(`⚠️ ${e.message}`)
    }
  }

  function setLlmField(k, v) {
    setLlm((p) => ({ ...(p || {}), [k]: v }))
  }

  return (
    <div className="view settings-view">
      <section className="hero card">
        <div className="hero-copy">
          <h1>{t('settings.title')}</h1>
          <p className="hero-sub">{t('settings.upload.hint')}</p>
        </div>
      </section>

      {status && <div className="settings-status">{status}</div>}

      <div className="settings-tabs">
        <button className={tab === 'syllabi' ? 'active' : ''} onClick={() => setTab('syllabi')}>{t('settings.syllabi')}</button>
        <button className={tab === 'model' ? 'active' : ''} onClick={() => setTab('model')}>{t('settings.model')}</button>
        <button className={tab === 'llm' ? 'active' : ''} onClick={() => setTab('llm')}>{t('settings.llm')}</button>
      </div>

      {tab === 'syllabi' && (
        <div className="two-col settings-flow">
          <div className="col-side">
            <Section emoji="🏰" title={t('settings.flow.choose')}>
              <p className="muted">{t('settings.flow.chooseHint')}</p>
              {!syllabi.length && (
                <p className="muted">{t('settings.noSyllabusYet')}</p>
              )}
              <div className="exam-list">
                {syllabi.map((s) => {
                  const isTarget = target && target.id === s.id
                  return (
                    <div key={s.id} className={`exam-item ${isTarget ? 'active' : ''}`}>
                      <span className="exam-emoji">{syllabusEmoji(s)}</span>
                      <div className="exam-body">
                        <div className="exam-name">{s.name}</div>
                        <div className="muted">
                          {s.concepts ? t('common.concepts', { n: s.concepts }) : t('settings.emptyWorld')}
                          {(s.language && s.language !== 'auto') ? ` · ${s.language}` : ''}
                        </div>
                      </div>
                      <button className="btn small" onClick={() => setTargetId(s.id)} disabled={isTarget}>
                        {isTarget ? '✓' : t('settings.use')}
                      </button>
                      <button className="btn small ghost danger" onClick={() => onDelete(s.id)} title={t('settings.delete')}>✕</button>
                    </div>
                  )
                })}
              </div>

              {!showNew ? (
                <button className="btn" onClick={() => setShowNew(true)}>{t('settings.create')}</button>
              ) : (
                <form className="new-syllabus" onSubmit={createSyllabus}>
                  <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t('settings.create.name')} />
                  <select value={newLanguage} onChange={(e) => setNewLanguage(e.target.value)}>
                    <option value="auto">{t('settings.create.languageAuto')}</option>
                    <option value="English">English</option>
                    <option value="French">Français</option>
                    <option value="Spanish">Español</option>
                    <option value="German">Deutsch</option>
                  </select>
                  <div className="row-actions">
                    <button type="submit" className="btn primary" disabled={!newName.trim()}>{t('settings.create.btn')}</button>
                    <button type="button" className="btn ghost" onClick={() => { setShowNew(false); setNewName('') }}>{t('settings.create.cancel')}</button>
                  </div>
                </form>
              )}
            </Section>
          </div>

          <div className="col-main">
            {!target ? (
              <Section emoji="📥" title={t('settings.flow.upload')}>
                <p className="muted">{t('settings.target.none')}</p>
              </Section>
            ) : (
              <>
                <Section emoji="📥" title={t('settings.flow.uploadFor', { name: target.name })}>
                  <p className="muted">{t('settings.flow.uploadHint')}</p>
                  <div className="upload-row">
                    <label className="btn file-btn">
                      {t('settings.drop.syllabus')}
                      <input type="file" accept=".md,.txt,.markdown,.text,.rst,.pdf" multiple hidden
                        onChange={(e) => uploadInto(e.target.files, 'syllabus')} />
                    </label>
                    <span className="muted">{t('settings.drop.syllabusDesc')}</span>
                  </div>
                  <div className="upload-row">
                    <label className="btn file-btn">
                      {t('settings.drop.exam')}
                      <input type="file" accept=".md,.txt,.markdown,.text,.rst,.pdf" multiple hidden
                        onChange={(e) => uploadInto(e.target.files, 'exam')} />
                    </label>
                    <span className="muted">{t('settings.drop.examDesc')}</span>
                  </div>
                  {uploading && <p className="muted">…</p>}
                </Section>

                <Section emoji="📁" title={t('settings.sourcesFor', { name: target.name })}>
                  {(() => {
                    const docs = sources.filter((src) => src.syllabus_id === target.id)
                    if (!docs.length) return <p className="muted">{t('settings.sourcesEmpty')}</p>
                    return (
                      <ul className="simple-list">
                        {docs.map((src, i) => (
                          <li key={i}>{src.kind === 'exam' ? '📄' : '📚'}{' '}
                            {src.rel} <span className="muted">({Math.round(src.size / 1024)} KB)</span>
                          </li>
                        ))}
                      </ul>
                    )
                  })()}
                </Section>
              </>
            )}
          </div>
        </div>
      )}

      {tab === 'model' && (
        <div className="two-col">
          <div className="col-side">
            <Section emoji="🧩" title={t('settings.syllabi')}>
              <div className="exam-list">
                {syllabi.map((s) => (
                  <button key={s.id} className={`exam-item ${selectedId === s.id ? 'active' : ''}`} onClick={() => loadModel(s.id)}>
                    <span className="exam-emoji">{syllabusEmoji(s)}</span>
                    <div className="exam-body"><div className="exam-name">{s.name}</div></div>
                  </button>
                ))}
              </div>
            </Section>
          </div>
          <div className="col-main">
            <Section emoji="✏️" title={t('settings.model')} action={<button className="btn small" onClick={saveModel}>{modelSaved ? t('settings.model.saved') : t('settings.model.save')}</button>}>
              <p className="muted">{t('settings.model.hint')}</p>
              <textarea className="model-editor" value={modelJson} onChange={(e) => setModelJson(e.target.value)} spellCheck={false} />
            </Section>
          </div>
        </div>
      )}

      {tab === 'llm' && llm && (
        <div className="two-col">
          <div className="col-main">
            <Section emoji="🤖" title={t('settings.llm')}>
              <label className="field">
                <span>{t('settings.llm.base')}</span>
                <input value={llm.base_url || ''} onChange={(e) => setLlmField('base_url', e.target.value)} />
              </label>
              <label className="field">
                <span>{t('settings.llm.model')}</span>
                <input value={llm.model || ''} onChange={(e) => setLlmField('model', e.target.value)} />
              </label>
              <label className="field">
                <span>{t('settings.llm.key')}</span>
                <input type="password" value={llm.api_key || ''} onChange={(e) => setLlmField('api_key', e.target.value)} />
              </label>
              <label className="auto-row">
                <input type="checkbox" checked={!!llm.enabled} onChange={(e) => setLlmField('enabled', e.target.checked)} />
                <span>{t('settings.llm.enabled')}</span>
              </label>
              <button className="btn" onClick={saveLlm}>{t('settings.llm.save')}</button>
            </Section>
          </div>
          <div className="col-side">
            <Section emoji="🦙" title={t('settings.llm.ollama')}>
              {llm.ollama && llm.ollama.available ? (
                <>
                  <p className="muted">{t('settings.llm.ollama.available')} — {llm.ollama.openai_base_url}</p>
                  <div className="chip-row">
                    {llm.ollama.models.map((m) => (
                      <button key={m} className="chip" onClick={() => useOllama(m)}>{m} · {t('settings.llm.use')}</button>
                    ))}
                  </div>
                </>
              ) : (
                <p className="muted">{t('settings.llm.ollama.unavailable')}</p>
              )}
            </Section>
          </div>
        </div>
      )}
    </div>
  )
}
