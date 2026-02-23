import { useEffect, useMemo, useState } from 'react'
import type { InputHTMLAttributes } from 'react'
import { deprecationRules, DeprecationRule } from './data/deprecations'

type Finding = {
  filePath: string
  fileName: string
  line: number
  column: number
  lineText: string
  matchText: string
  rule: DeprecationRule
}

type ScanResult = {
  filePath: string
  fileName: string
  findings: Finding[]
  includes: IncludeEntry[]
}

type ScanStats = {
  scannedFiles: number
  skippedFiles: number
  totalFindings: number
  uniqueRules: number
}

type SuggestionInput = {
  lineText: string
  matchText: string
  rule: DeprecationRule
}

type IncludeEntry = {
  kind: string
  attr: string
  value: string
}

type FindingWithSuggestion = Finding & {
  suggestedLine: string | null
}

type GroupedResult = Omit<ScanResult, 'findings'> & {
  findings: FindingWithSuggestion[]
}

type ProgressState = {
  phase: 'idle' | 'selecting' | 'scanning' | 'done'
  value: number
  label: string
}

const allowedExtensions = [
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.jsp',
  '.html',
  '.htm'
]

const maxFindingsPerFile = Number.POSITIVE_INFINITY

const folderInputProps =
  { webkitdirectory: '' } as InputHTMLAttributes<HTMLInputElement> & {
    webkitdirectory?: string
  }

function waitForNextPaint() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve())
  })
}

function getExtension(name: string) {
  const lower = name.toLowerCase()
  const idx = lower.lastIndexOf('.')
  return idx >= 0 ? lower.slice(idx) : ''
}

function buildLineIndex(text: string) {
  const starts = [0]
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === '\n') {
      starts.push(i + 1)
    }
  }
  return starts
}

function findLineInfo(text: string, lineStarts: number[], index: number) {
  let low = 0
  let high = lineStarts.length - 1
  while (low <= high) {
    const mid = Math.floor((low + high) / 2)
    const start = lineStarts[mid]
    const nextStart = mid + 1 < lineStarts.length ? lineStarts[mid + 1] : text.length + 1
    if (index >= start && index < nextStart) {
      const lineNumber = mid + 1
      const column = index - start + 1
      const lineEnd = text.indexOf('\n', start)
      const end = lineEnd === -1 ? text.length : lineEnd
      const lineText = text.slice(start, end).replace(/\r$/, '')
      return { lineNumber, column, lineText }
    }
    if (index < start) {
      high = mid - 1
    } else {
      low = mid + 1
    }
  }
  return { lineNumber: 1, column: 1, lineText: '' }
}

function scanText(text: string, filePath: string, fileName: string) {
  const lineStarts = buildLineIndex(text)
  const findings: Finding[] = []

  for (const rule of deprecationRules) {
    const matches = text.matchAll(rule.pattern)
    for (const match of matches) {
      if (match.index == null) continue
      if (findings.length >= maxFindingsPerFile) break
      const info = findLineInfo(text, lineStarts, match.index)
      if (!isJQueryInstruction(info.lineText)) continue
      findings.push({
        filePath,
        fileName,
        line: info.lineNumber,
        column: info.column,
        lineText: info.lineText,
        matchText: match[0],
        rule
      })
    }
  }

  return findings
}

function extractIncludedFiles(text: string) {
  const includes: IncludeEntry[] = []
  const seen = new Set<string>()

  const push = (kind: string, attr: string, value: string) => {
    const entry = `${kind}|${attr}|${value}`
    if (seen.has(entry)) return
    seen.add(entry)
    includes.push({ kind, attr, value })
  }

  const includeDirective = /<%@\s*include\b[^>]*(file|page)\s*=\s*["']([^"']+)["'][^>]*%>/gi
  for (const match of text.matchAll(includeDirective)) {
    push('<%@include', match[1], match[2])
  }

  const jspInclude = /<jsp:include\b[^>]*(file|page)\s*=\s*["']([^"']+)["'][^>]*>/gi
  for (const match of text.matchAll(jspInclude)) {
    push('<jsp:include', match[1], match[2])
  }

  const jspIncludeAlt = /<jsp\s+include\b[^>]*(file|page)\s*=\s*["']([^"']+)["'][^>]*>/gi
  for (const match of text.matchAll(jspIncludeAlt)) {
    push('<jsp include', match[1], match[2])
  }

  const scriptTag = /<script\b[^>]*>/gi
  for (const match of text.matchAll(scriptTag)) {
    const tag = match[0]
    const srcMatch = tag.match(/\bsrc\s*=\s*["']([^"']+)["']/i)
    if (!srcMatch) continue
    push('<script', 'src', srcMatch[1])
  }

  return includes
}

function isJQueryInstruction(lineText: string) {
  const trimmed = lineText.trimStart()
  return (
    trimmed.startsWith('$jq') ||
    trimmed.startsWith('$') ||
    trimmed.startsWith('JQuery') ||
    trimmed.startsWith('jQuery')
  )
}

function extractReplacementToken(replacement: string) {
  const onHandlerMatch = replacement.match(
    /\.on\(\s*(['"])([^'"]+)\1\s*,\s*handler\s*\)/
  )
  if (onHandlerMatch) {
    return `.on("${onHandlerMatch[2]}", `
  }

  const tokenMatch = replacement.match(
    /(?:[A-Za-z_$][\w$]*\.)+[A-Za-z_$][\w$]*\([^)]*\)|(?:[A-Za-z_$][\w$]*\.)+[A-Za-z_$][\w$]*|\.[A-Za-z_$][\w$]*\([^)]*\)|\.[A-Za-z_$][\w$]*/
  )

  return tokenMatch ? tokenMatch[0] : null
}

function normalizeReplacementToken(token: string, matchText: string) {
  const trimmedMatch = matchText.trim()
  let normalized = token

  if (trimmedMatch.startsWith('.')) {
    if (!normalized.startsWith('.')) {
      const lastDot = normalized.lastIndexOf('.')
      if (lastDot >= 0) {
        normalized = normalized.slice(lastDot)
      }
    }
  }

  if (trimmedMatch.includes('(') && normalized.endsWith('()')) {
    normalized = `${normalized.slice(0, -1)}`
  }

  return normalized
}

function applyReplacement(lineText: string, matchText: string, replacement: string) {
  if (!matchText) return lineText
  const replaced = lineText.replace(matchText, replacement)

  if (matchText.includes('(') && !replacement.includes('(')) {
    const idx = replaced.indexOf(replacement)
    if (idx >= 0) {
      const after = idx + replacement.length
      const trailing = replaced.slice(after)
      const closingMatch = trailing.match(/^\s*\)/)
      if (closingMatch) {
        return `${replaced.slice(0, after)}${replaced.slice(after + closingMatch[0].length)}`
      }
    }
  }

  return replaced
}

function buildEqSelectorSuggestion(lineText: string) {
  const eqSelectorInJqueryCall =
    /(\$jq|\$|jQuery|JQuery)\s*\(\s*(['"])([^"'\\]*?):eq\s*\(\s*(-?\d+)\s*\)([^"'\\]*?)\2\s*\)/g

  const replaced = lineText.replace(
    eqSelectorInJqueryCall,
    (_fullMatch, jqCall: string, quote: string, before: string, index: string, after: string) =>
      `${jqCall}(${quote}${before}${after}${quote}).eq(${index})`
  )

  return replaced === lineText ? null : replaced
}

function getSuggestedLine({ lineText, matchText, rule }: SuggestionInput) {
  if (rule.id === 'selector-eq') {
    return buildEqSelectorSuggestion(lineText)
  }

  if (!rule.replacement || rule.type === 'selector') return null

  const token = extractReplacementToken(rule.replacement)
  if (!token) return null

  const normalized = normalizeReplacementToken(token, matchText)
  const replaced = applyReplacement(lineText, matchText, normalized)
  return replaced === lineText ? null : replaced
}

export default function App() {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [results, setResults] = useState<ScanResult[]>([])
  const [stats, setStats] = useState<ScanStats | null>(null)
  const [scanning, setScanning] = useState(false)
  const [lastScanAt, setLastScanAt] = useState<string | null>(null)
  const [filterMode, setFilterMode] = useState<'with-findings' | 'all' | 'no-replacement'>(
    'with-findings'
  )
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(() => new Set())
  const [progress, setProgress] = useState<ProgressState>({
    phase: 'idle',
    value: 0,
    label: 'Esperando seleccion de archivos.'
  })

  const handleSelection = async (fileList: FileList | null) => {
    if (!fileList) return
    setProgress({
      phase: 'selecting',
      value: 10,
      label: 'Cargando archivos seleccionados...'
    })
    await waitForNextPaint()
    setSelectedFiles(Array.from(fileList))
    setResults([])
    setStats(null)
    setLastScanAt(null)
    setProgress({
      phase: 'done',
      value: 100,
      label: `${fileList.length} archivo(s) listo(s) para analizar.`
    })
  }

  const clearSelection = () => {
    setSelectedFiles([])
    setResults([])
    setStats(null)
    setLastScanAt(null)
    setProgress({
      phase: 'idle',
      value: 0,
      label: 'Esperando seleccion de archivos.'
    })
  }

  const runScan = async () => {
    if (selectedFiles.length === 0) return
    setScanning(true)
    setProgress({
      phase: 'scanning',
      value: 0,
      label: 'Iniciando analisis...'
    })

    let skipped = 0
    let totalFindings = 0
    const scanResults: ScanResult[] = []
    const totalFiles = selectedFiles.length

    for (const [index, file] of selectedFiles.entries()) {
      const ext = getExtension(file.name)
      if (!allowedExtensions.includes(ext)) {
        skipped += 1
        const progressValue = Math.round(((index + 1) / totalFiles) * 100)
        setProgress({
          phase: 'scanning',
          value: progressValue,
          label: `Analizando archivos... ${index + 1}/${totalFiles}`
        })
        continue
      }

      try {
        const text = await file.text()
        const filePath = file.webkitRelativePath || file.name
        const findings = scanText(text, filePath, file.name)
        const includes = extractIncludedFiles(text)
        totalFindings += findings.length
        scanResults.push({ filePath, fileName: file.name, findings, includes })
      } catch {
        skipped += 1
      }

      const progressValue = Math.round(((index + 1) / totalFiles) * 100)
      setProgress({
        phase: 'scanning',
        value: progressValue,
        label: `Analizando archivos... ${index + 1}/${totalFiles}`
      })
    }

    const uniqueRules = new Set(
      scanResults.flatMap((result) => result.findings.map((finding) => finding.rule.id))
    ).size

    setResults(scanResults)
    setStats({
      scannedFiles: scanResults.length,
      skippedFiles: skipped,
      totalFindings,
      uniqueRules
    })
    setLastScanAt(new Date().toLocaleString())
    setScanning(false)
    setProgress({
      phase: 'done',
      value: 100,
      label: `Analisis completado: ${scanResults.length} archivo(s) escaneado(s), ${skipped} omitido(s).`
    })
  }

  const rulesByVersion = useMemo(() => {
    const map = new Map<string, DeprecationRule[]>()
    for (const rule of deprecationRules) {
      const list = map.get(rule.deprecated) ?? []
      list.push(rule)
      map.set(rule.deprecated, list)
    }
    return Array.from(map.entries()).sort((a, b) => Number(a[0]) - Number(b[0]))
  }, [])

  const groupedResults = useMemo<GroupedResult[]>(() => {
    return results
      .map((result) => {
        const findings: FindingWithSuggestion[] = result.findings.map((finding) => ({
          ...finding,
          suggestedLine: getSuggestedLine(finding)
        }))

        let filtered = findings
        if (filterMode === 'with-findings') {
          filtered = findings.filter((finding) => finding.suggestedLine)
        } else if (filterMode === 'no-replacement') {
          filtered = findings.filter((finding) => !finding.suggestedLine)
        }

        if (filterMode !== 'all' && filtered.length === 0) {
          return null
        }

        return { ...result, findings: filtered }
      })
      .filter((result): result is GroupedResult => result != null)
  }, [filterMode, results])

  const hasScan = results.length > 0
  const emptyMessage = hasScan
    ? 'No hay incidencias para el filtro seleccionado.'
    : 'No hay resultados aun. Selecciona archivos y ejecuta el escaneo.'

  const includeLabel = (include: IncludeEntry) =>
    `${include.kind} ${include.attr}: ${include.value}`

  const findIncludeResult = (value: string) => {
    const normalized = value.replace(/^[.\\/]+/, '')
    const basename = normalized.split(/[\\/]/).pop() ?? normalized
    return results.find(
      (result) =>
        result.filePath.endsWith(value) ||
        result.filePath.endsWith(normalized) ||
        result.fileName === basename
    )
  }

  const visibleFilePaths = useMemo(
    () => groupedResults.map((result) => result.filePath),
    [groupedResults]
  )

  useEffect(() => {
    if (results.length === 0) {
      setExpandedFiles(new Set())
      return
    }
    setExpandedFiles(new Set(results.map((result) => result.filePath)))
  }, [results])

  const toggleFile = (filePath: string) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev)
      if (next.has(filePath)) {
        next.delete(filePath)
      } else {
        next.add(filePath)
      }
      return next
    })
  }

  const expandAll = () => {
    setExpandedFiles(new Set(visibleFilePaths))
  }

  const collapseAll = () => {
    setExpandedFiles(new Set())
  }

  return (
    <div className="app">
      <header className="hero">
        <div>
          <p className="eyebrow">Migracion jQuery 3.7.1</p>
          <h3>Migrador de codigo legacy</h3>
          <p className="subtitle">
            Escanea archivos JSP, JS y HTML en tu maquina y detecta APIs
            obsoletas de jQuery. Las recomendaciones salen unicamente de la
            documentacion oficial de jQuery.
          </p>
        </div>
        <div className="hero-card">
          <div>
            <p className="label">Objetivo</p>
            <p>Preparar el codigo para jQuery 3.7.1 sin inventar cambios.</p>
          </div>
          <div>
            <p className="label">Fuente</p>
            <p>api.jquery.com + categorias deprecadas oficiales.</p>
          </div>
        </div>
      </header>

      <section className="panel panel-wide">
        <div className="panel-header">
          <h4>Seleccion de archivos</h4>
          <div className="panel-actions">
            <button className="ghost" onClick={clearSelection} disabled={scanning}>
              Limpiar
            </button>
            <button className="primary" onClick={runScan} disabled={scanning}>
              {scanning ? 'Escaneando...' : 'Escanear'}
            </button>
          </div>
        </div>
        <div className="inputs">
          <label className="input-card">
            <span className="input-card-label">Carpeta completa</span>
            <span className="input-card-action">Seleccionar carpeta</span>
            <input
              type="file"
              {...folderInputProps}
              onChange={(event) => handleSelection(event.currentTarget.files)}
            />
          </label>
          <label className="input-card">
            <span className="input-card-label">Archivos individuales</span>
            <span className="input-card-action">Elegir archivos</span>
            <input
              type="file"
              multiple
              onChange={(event) => handleSelection(event.currentTarget.files)}
            />
          </label>
        </div>
        <div className="selection-info">
          <div>
            <p className="label">Archivos seleccionados</p>
            <p>{selectedFiles.length}</p>
          </div>
          <div>
            <p className="label">Extensiones soportadas</p>
            <p>{allowedExtensions.join(', ')}</p>
          </div>
        </div>
        <div className="progress-card" role="status" aria-live="polite">
          <div className="progress-head">
            <p className="label">Progreso</p>
            <span className="progress-value">{progress.value}%</span>
          </div>
          <p className="progress-label">{progress.label}</p>
          <progress className="progress-track" max={100} value={progress.value} />
        </div>
      </section>

      <section className="panel panel-wide">
        <div className="panel-header">
          <h4>Resumen del escaneo</h4>
          <p className="muted">{lastScanAt ? `Ultimo escaneo: ${lastScanAt}` : 'Sin escanear'}</p>
        </div>
        <div className="summary-grid">
          <div>
            <p className="label">Archivos escaneados</p>
            <p>{stats?.scannedFiles ?? 0}</p>
          </div>
          <div>
            <p className="label">Archivos omitidos</p>
            <p>{stats?.skippedFiles ?? 0}</p>
          </div>
          <div>
            <p className="label">Hallazgos</p>
            <p>{stats?.totalFindings ?? 0}</p>
          </div>
          <div>
            <p className="label">Reglas unicas</p>
            <p>{stats?.uniqueRules ?? 0}</p>
          </div>
        </div>
      </section>

      <section className="panel panel-wide">
        <div className="panel-header">
          <h4>Hallazgos</h4>
          <div className="panel-controls">
            <div className="panel-filter">
              <span className="muted panel-filter-title">Mostrar</span>
              <div className="filter-options" role="radiogroup" aria-label="Mostrar resultados">
                <label className={`filter-option ${filterMode === 'with-findings' ? 'is-active' : ''}`}>
                  <input
                    type="radio"
                    name="file-filter"
                    checked={filterMode === 'with-findings'}
                    onChange={() => setFilterMode('with-findings')}
                  />
                  <span>Solo con incidencia</span>
                </label>
                <label className={`filter-option ${filterMode === 'all' ? 'is-active' : ''}`}>
                  <input
                    type="radio"
                    name="file-filter"
                    checked={filterMode === 'all'}
                    onChange={() => setFilterMode('all')}
                  />
                  <span>Todos los archivos</span>
                </label>
                <label className={`filter-option ${filterMode === 'no-replacement' ? 'is-active' : ''}`}>
                  <input
                    type="radio"
                    name="file-filter"
                    checked={filterMode === 'no-replacement'}
                    onChange={() => setFilterMode('no-replacement')}
                  />
                  <span>Sin reemplazo oficial</span>
                </label>
              </div>
            </div>
            <div className="panel-toggle">
              <button
                className="ghost small"
                type="button"
                onClick={expandAll}
                disabled={groupedResults.length === 0}
              >
                Desplegar todo
              </button>
              <button
                className="ghost small"
                type="button"
                onClick={collapseAll}
                disabled={groupedResults.length === 0}
              >
                Recoger todo
              </button>
            </div>
          </div>
        </div>
        <div className="results">
          {groupedResults.length === 0 && (
            <div className="empty">
              <p>{emptyMessage}</p>
            </div>
          )}
          {groupedResults.map((result: GroupedResult) => (
            <div
              key={result.filePath}
              className={`result-group ${expandedFiles.has(result.filePath) ? 'is-open' : 'is-collapsed'}`}
            >
              <div
                className="result-header"
                role="button"
                tabIndex={0}
                onClick={() => toggleFile(result.filePath)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    toggleFile(result.filePath)
                  }
                }}
              >
                <span className="result-path">Ruta: {result.filePath}</span>
                <span className="result-count">
                  {result.findings.length} incidencia
                  {result.findings.length === 1 ? '' : 's'}
                </span>
              </div>
              {expandedFiles.has(result.filePath) && (
                <div className="result-body">
                  <div className="result-findings">
                    {result.findings.length === 0 ? (
                      <div className="finding finding-empty">
                        <p className="muted">Sin incidencias detectadas.</p>
                      </div>
                    ) : (
                      result.findings.map((finding: FindingWithSuggestion, index) => {
                        const statusParts = [`Deprecado en ${finding.rule.deprecated}`]
                        if (finding.rule.removed) {
                          statusParts.push(`Obsoleto en ${finding.rule.removed}`)
                        }
                        statusParts.push(`Modulo: ${finding.rule.type}`)

                        return (
                          <div key={`${result.filePath}-${finding.line}-${index}`} className="finding">
                            <p>{statusParts.join(' | ')}</p>
                            <div className="finding-row">
                              <span className="finding-label finding-label-locate">
                                Elemento localizado (linea {finding.line})
                              </span>
                              <span className="finding-label finding-label-suggest">
                                Sugerencia oficial (linea {finding.line})
                              </span>
                            </div>
                            <div className="finding-row">
                              <span className="mono">{finding.lineText || finding.matchText}</span>
                              <span className="mono">
                                {finding.suggestedLine ?? 'No hay reemplazo oficial indicado.'}
                              </span>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                  <aside className="included-section">
                    <p className="included-title">ARCHIVOS INCLUIDOS</p>
                    {result.includes.length === 0 ? (
                      <p className="muted">No se detectaron includes en este archivo.</p>
                    ) : (
                      <div className="included-list">
                        {result.includes.map((include, includeIndex) => {
                          const includeResult = findIncludeResult(include.value)
                          const includeFindings = includeResult?.findings ?? []
                          const header = includeLabel(include)

                          return (
                            <div key={`${header}-${includeIndex}`} className="included-item">
                              <div className="included-header">{header}</div>
                              {includeResult == null ? (
                                <p className="muted">Archivo no escaneado.</p>
                              ) : includeFindings.length === 0 ? null : (
                                <div className="included-findings">
                                  {includeFindings.map((finding) => (
                                    <div
                                      key={`${includeResult.filePath}-${finding.line}-${finding.rule.id}`}
                                      className="included-issue"
                                    >
                                      <div className="included-issue-line included-issue-path">
                                        Archivo: {includeResult.filePath} · Linea {finding.line}
                                      </div>
                                      <div className="included-issue-line included-issue-rule">
                                        Incidencia: {finding.rule.label}
                                      </div>
                                      <div className="included-issue-line included-issue-solution">
                                        Solucion:{' '}
                                        {finding.rule.replacement ?? 'No hay reemplazo oficial indicado.'}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </aside>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="panel panel-wide">
        <div className="panel-header">
          <h4>Catalogo de reglas</h4>
          <p className="muted">Revisa que versiones cubre la app actualmente.</p>
        </div>
        <div className="rules">
          {rulesByVersion.map(([version, rules]) => (
            <div key={version} className="rule-group">
              <h5>Deprecado en {version}</h5>
              <div className="rule-grid">
                {rules.map((rule) => (
                  <div key={rule.id} className="rule-card">
                    <p className="rule-title">{rule.label}</p>
                    <p className="rule-meta">{rule.type}</p>
                    <div className="links">
                      <a href={rule.docsUrl} target="_blank" rel="noreferrer">
                        API
                      </a>
                      <a href={rule.categoryUrl} target="_blank" rel="noreferrer">
                        Deprecados {version}
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <footer className="footer">
        <p>
          Fuentes: api.jquery.com y sus categorias oficiales de deprecacion.
          La app no realiza cambios automaticos en tus archivos; muestra recomendaciones
          para migrar a jQuery 3.7.1 segun la documentacion oficial.
        </p>
      </footer>
    </div>
  )
}
