import { useEffect, useMemo, useRef, useState } from 'react'
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
  fileLines: string[]
  originalText: string
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
  column: number
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
const preferredJQueryAlias = '$jq'

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
    const pattern = new RegExp(rule.pattern.source, rule.pattern.flags)
    const matches = text.matchAll(pattern)
    for (const match of matches) {
      if (match.index == null) continue
      if (findings.length >= maxFindingsPerFile) break
      const info = findLineInfo(text, lineStarts, match.index)
      if (!isJQueryInstruction(info.lineText)) continue
      if (rule.ambiguous && match[0].startsWith('.') && !hasLikelyJQueryReceiver(info.lineText, info.column)) {
        continue
      }
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

function toFileLines(text: string) {
  return text.replace(/\r/g, '').split('\n')
}

function isJQueryInstruction(lineText: string) {
  const hasCoreCall =
    /(?:^|[^\w$])(?:\$jq|jQuery|JQuery|\$)\s*(?:\(|\.)/.test(lineText)

  const hasDollarObjectMethod =
    /(?:^|[^\w$])\$[A-Za-z_][\w$]*\s*\./.test(lineText)

  return hasCoreCall || hasDollarObjectMethod
}

function hasLikelyJQueryReceiver(lineText: string, column: number) {
  const matchStart = Math.max(0, column - 1)
  const beforeMatch = lineText.slice(0, matchStart).trimEnd()
  if (!beforeMatch) return false

  const aliasCallChainReceiver =
    /(?:\$jq|\$|jQuery|JQuery)\s*\([^)]*\)\s*(?:\.\s*[A-Za-z_$][\w$]*\s*\([^)]*\))*\s*$/.test(
      beforeMatch
    )
  if (aliasCallChainReceiver) return true

  const dollarVariableChainReceiver =
    /\$[A-Za-z_][\w$]*\s*(?:\.\s*[A-Za-z_$][\w$]*\s*\([^)]*\))*\s*$/.test(beforeMatch)

  return dollarVariableChainReceiver
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

function buildSimpleSelectorMethodSuggestion(
  lineText: string,
  pseudo: 'first' | 'last' | 'even' | 'odd',
  method: 'first' | 'last' | 'even' | 'odd'
) {
  const pseudoSelectorInJqueryCall = new RegExp(
    `(\\$jq|\\$|jQuery|JQuery)\\s*\\(\\s*(['"])([^"'\\\\]*?):${pseudo}([^"'\\\\]*?)\\2\\s*\\)`,
    'g'
  )

  const replaced = lineText.replace(
    pseudoSelectorInJqueryCall,
    (_fullMatch, jqCall: string, quote: string, before: string, after: string) =>
      `${jqCall}(${quote}${before}${after}${quote}).${method}()`
  )

  return replaced === lineText ? null : replaced
}

function buildGtSelectorSuggestion(lineText: string) {
  const gtSelectorInJqueryCall =
    /(\$jq|\$|jQuery|JQuery)\s*\(\s*(['"])([^"'\\]*?):gt\s*\(\s*(-?\d+)\s*\)([^"'\\]*?)\2\s*\)/g

  const replaced = lineText.replace(
    gtSelectorInJqueryCall,
    (_fullMatch, jqCall: string, quote: string, before: string, index: string, after: string) => {
      const nextIndex = Number(index) + 1
      return `${jqCall}(${quote}${before}${after}${quote}).slice(${nextIndex})`
    }
  )

  return replaced === lineText ? null : replaced
}

function buildLtSelectorSuggestion(lineText: string) {
  const ltSelectorInJqueryCall =
    /(\$jq|\$|jQuery|JQuery)\s*\(\s*(['"])([^"'\\]*?):lt\s*\(\s*(-?\d+)\s*\)([^"'\\]*?)\2\s*\)/g

  const replaced = lineText.replace(
    ltSelectorInJqueryCall,
    (_fullMatch, jqCall: string, quote: string, before: string, index: string, after: string) =>
      `${jqCall}(${quote}${before}${after}${quote}).slice(0, ${index})`
  )

  return replaced === lineText ? null : replaced
}

function buildReadyOnSuggestion(lineText: string) {
  const readyEventPattern = /\.on\s*\(\s*(['"])ready\1\s*,\s*([^)]+)\)/i
  if (!readyEventPattern.test(lineText)) return null

  const handlerMatch = lineText.match(readyEventPattern)
  const handler = handlerMatch?.[2]?.trim()
  if (handler) {
    return `${preferredJQueryAlias}(${handler});`
  }

  return `${preferredJQueryAlias}(function() {`
}

function buildReadyMethodSuggestion(lineText: string) {
  const readyMethodPattern =
    /(?:\$jq|\$|jQuery|JQuery)\s*\(\s*document\s*\)\s*\.ready\s*\(/

  if (!readyMethodPattern.test(lineText)) return null

  const replaced = lineText.replace(readyMethodPattern, `${preferredJQueryAlias}(`)
  return replaced === lineText ? null : replaced
}

function buildAttrPropSuggestion(lineText: string) {
  const attrPropertyPattern = /\.attr\s*\(\s*(['"])(disabled|checked|selected|readonly)\1/i
  if (!attrPropertyPattern.test(lineText)) return null

  const attrBooleanSetterPattern =
    /\.attr\s*\(\s*(['"])(disabled|checked|selected|readonly)\1\s*,\s*(['"])\2\3\s*\)/i
  if (attrBooleanSetterPattern.test(lineText)) {
    const replaced = lineText.replace(
      attrBooleanSetterPattern,
      (_fullMatch, quote: string, propName: string) => `.prop(${quote}${propName}${quote}, true)`
    )
    return replaced === lineText ? null : replaced
  }

  const replaced = lineText.replace(
    attrPropertyPattern,
    (_fullMatch, quote: string, propName: string) => `.prop(${quote}${propName}${quote}`
  )
  return replaced === lineText ? null : replaced
}

function buildRemoveAttrPropSuggestion(lineText: string) {
  const removeAttrPropertyPattern =
    /\.removeAttr\s*\(\s*(['"])(disabled|checked|selected|readonly)\1\s*\)/i
  if (!removeAttrPropertyPattern.test(lineText)) return null

  const replaced = lineText.replace(
    removeAttrPropertyPattern,
    (_fullMatch, quote: string, propName: string) => `.prop(${quote}${propName}${quote}, false)`
  )
  return replaced === lineText ? null : replaced
}

function buildInlineOnclickClearSuggestion(lineText: string) {
  const inlineOnclickAttrPattern =
    /\.attr\s*\(\s*(['"])onclick\1\s*,\s*(?:(['"])\s*\2|null)\s*\)/i
  if (!inlineOnclickAttrPattern.test(lineText)) return null

  const replaced = lineText.replace(
    inlineOnclickAttrPattern,
    (_fullMatch, quote: string) => `.prop(${quote}onclick${quote}, null)`
  )
  return replaced === lineText ? null : replaced
}

function buildIsFunctionSuggestion(lineText: string) {
  const isFunctionPattern = /(?:\$[A-Za-z_][\w$]*|\$|jQuery|JQuery|jq)\s*\.\s*isFunction\s*\(\s*([^)]+?)\s*\)/g

  const replaced = lineText.replace(
    isFunctionPattern,
    (_fullMatch, expression: string) => `typeof ${expression.trim()} === 'function'`
  )
  return replaced === lineText ? null : replaced
}

function buildEventShorthandSuggestion(
  lineText: string,
  matchText: string,
  rule: DeprecationRule,
  column: number
) {
  if (rule.type !== 'event' || !rule.replacement) return null
  if (!rule.replacement.includes('.on(') || !rule.replacement.includes('.trigger(')) return null
  if (!hasLikelyJQueryReceiver(lineText, column)) return null

  const methodMatch = matchText.match(/\.([A-Za-z_$][\w$]*)\s*\(/)
  if (!methodMatch) return null
  const method = methodMatch[1]

  const emptyCallPattern = new RegExp(`\\.${method}\\s*\\(\\s*\\)`)
  if (emptyCallPattern.test(lineText)) {
    return lineText.replace(emptyCallPattern, `.trigger('${method}')`)
  }

  const callPattern = new RegExp(`\\.${method}\\s*\\(`)
  if (!callPattern.test(lineText)) return null
  return lineText.replace(callPattern, `.on('${method}', `)
}

function getSuggestedLine({ lineText, matchText, rule, column }: SuggestionInput) {
  if (rule.id === 'selector-eq') {
    return buildEqSelectorSuggestion(lineText)
  }
  if (rule.id === 'selector-first') {
    return buildSimpleSelectorMethodSuggestion(lineText, 'first', 'first')
  }
  if (rule.id === 'selector-last') {
    return buildSimpleSelectorMethodSuggestion(lineText, 'last', 'last')
  }
  if (rule.id === 'selector-even') {
    return buildSimpleSelectorMethodSuggestion(lineText, 'even', 'even')
  }
  if (rule.id === 'selector-odd') {
    return buildSimpleSelectorMethodSuggestion(lineText, 'odd', 'odd')
  }
  if (rule.id === 'selector-gt') {
    return buildGtSelectorSuggestion(lineText)
  }
  if (rule.id === 'selector-lt') {
    return buildLtSelectorSuggestion(lineText)
  }
  if (rule.id === 'off-handler-removal') {
    return lineText
  }
  if (rule.id === 'attr-boolean-property') {
    return buildAttrPropSuggestion(lineText)
  }
  if (rule.id === 'removeattr-boolean-property') {
    return buildRemoveAttrPropSuggestion(lineText)
  }
  if (rule.id === 'attr-inline-onclick-clear') {
    return buildInlineOnclickClearSuggestion(lineText)
  }
  if (rule.id === 'ready-event-on') {
    return buildReadyOnSuggestion(lineText)
  }
  if (rule.id === 'ready-method-equivalent') {
    return buildReadyMethodSuggestion(lineText)
  }
  if (rule.id === 'isFunction') {
    return buildIsFunctionSuggestion(lineText)
  }

  const eventShorthandSuggestion = buildEventShorthandSuggestion(lineText, matchText, rule, column)
  if (eventShorthandSuggestion) {
    return eventShorthandSuggestion
  }

  if (!rule.replacement || rule.type === 'selector') return null

  const token = extractReplacementToken(rule.replacement)
  if (!token) return null

  const normalized = normalizeReplacementToken(token, matchText)
  const replaced = applyReplacement(lineText, matchText, normalized)
  return replaced === lineText ? null : replaced
}

function sortFindingsByPosition(findings: Finding[]) {
  return [...findings].sort((a, b) => {
    if (a.line !== b.line) return a.line - b.line
    if (a.column !== b.column) return a.column - b.column
    return a.rule.label.localeCompare(b.rule.label)
  })
}

function buildFindingsWithSuggestions(findings: Finding[]): FindingWithSuggestion[] {
  const sortedFindings = sortFindingsByPosition(findings)
  const suggestionsByIndex = new Map<number, string | null>()

  let start = 0
  while (start < sortedFindings.length) {
    const targetLine = sortedFindings[start].line
    let end = start
    while (end < sortedFindings.length && sortedFindings[end].line === targetLine) {
      end += 1
    }

    let evolvingLine = sortedFindings[start].lineText
    for (let index = start; index < end; index += 1) {
      const finding = sortedFindings[index]
      const suggestion = getSuggestedLine({
        lineText: evolvingLine,
        matchText: finding.matchText,
        rule: finding.rule,
        column: finding.column
      })
      suggestionsByIndex.set(index, suggestion)
      if (suggestion) {
        evolvingLine = suggestion
      }
    }

    start = end
  }

  return sortedFindings.map((finding, index) => ({
    ...finding,
    suggestedLine: suggestionsByIndex.get(index) ?? null
  }))
}

function buildCorrectedFileContent(result: ScanResult) {
  const findingsWithSuggestions = buildFindingsWithSuggestions(result.findings)
  const latestSuggestionByLine = new Map<number, string>()

  for (const finding of findingsWithSuggestions) {
    if (finding.suggestedLine) {
      latestSuggestionByLine.set(finding.line, finding.suggestedLine)
    }
  }

  const lines: Array<{ content: string; ending: string }> = []
  let start = 0
  while (start < result.originalText.length) {
    const lineFeedIndex = result.originalText.indexOf('\n', start)
    if (lineFeedIndex === -1) {
      lines.push({ content: result.originalText.slice(start), ending: '' })
      start = result.originalText.length
      continue
    }

    const hasCarriageReturn =
      lineFeedIndex > start && result.originalText[lineFeedIndex - 1] === '\r'
    const contentEnd = hasCarriageReturn ? lineFeedIndex - 1 : lineFeedIndex
    const ending = hasCarriageReturn ? '\r\n' : '\n'
    lines.push({ content: result.originalText.slice(start, contentEnd), ending })
    start = lineFeedIndex + 1
  }

  for (const [lineNumber, suggestedLine] of latestSuggestionByLine) {
    const lineIndex = lineNumber - 1
    if (lineIndex >= 0 && lineIndex < lines.length) {
      lines[lineIndex].content = suggestedLine
    }
  }

  return lines.map((line) => `${line.content}${line.ending}`).join('')
}

function getCorrectedFileName(fileName: string) {
  const dotIndex = fileName.lastIndexOf('.')
  if (dotIndex <= 0) {
    return `${fileName}.corregido`
  }
  const base = fileName.slice(0, dotIndex)
  const extension = fileName.slice(dotIndex)
  return `${base}.corregido${extension}`
}

function downloadTextFile(fileName: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
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
  const [activeLineByFile, setActiveLineByFile] = useState<Record<string, number>>({})
  const codeViewerRefs = useRef(new Map<string, HTMLDivElement | null>())
  const resultGroupRefs = useRef(new Map<string, HTMLDivElement | null>())
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
    setActiveLineByFile({})
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
    setActiveLineByFile({})
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
        const fileLines = toFileLines(text)
        const includes = extractIncludedFiles(text)
        totalFindings += findings.length
        scanResults.push({
          filePath,
          fileName: file.name,
          findings,
          fileLines,
          originalText: text,
          includes
        })
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
    setActiveLineByFile({})
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
        const findings = buildFindingsWithSuggestions(result.findings)

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

  const downloadCorrectedResult = (filePath: string) => {
    const sourceResult = results.find((result) => result.filePath === filePath)
    if (!sourceResult) return
    const correctedContent = buildCorrectedFileContent(sourceResult)
    const correctedFileName = getCorrectedFileName(sourceResult.fileName)
    downloadTextFile(correctedFileName, correctedContent)
  }

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
    setExpandedFiles(new Set())
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

  const setCodeViewerRef = (filePath: string, element: HTMLDivElement | null) => {
    codeViewerRefs.current.set(filePath, element)
  }

  const setResultGroupRef = (filePath: string, element: HTMLDivElement | null) => {
    resultGroupRefs.current.set(filePath, element)
  }

  const jumpToFileResult = (filePath: string) => {
    setFilterMode('all')
    setExpandedFiles((prev) => {
      const next = new Set(prev)
      next.add(filePath)
      return next
    })
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const resultGroup = resultGroupRefs.current.get(filePath)
        if (!resultGroup) return
        resultGroup.scrollIntoView({ block: 'center', behavior: 'smooth' })
      })
    })
  }

  const jumpToLine = (filePath: string, line: number) => {
    const viewer = codeViewerRefs.current.get(filePath)
    if (!viewer) return

    const lineElement = viewer.querySelector<HTMLElement>(`[data-code-line="${line}"]`)
    if (!lineElement) return

    lineElement.scrollIntoView({ block: 'center', behavior: 'smooth' })
    setActiveLineByFile((prev) => ({ ...prev, [filePath]: line }))
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
              ref={(element) => setResultGroupRef(result.filePath, element)}
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
                <div className="result-header-actions">
                  <span className="result-count">
                    {result.findings.length} incidencia
                    {result.findings.length === 1 ? '' : 's'}
                  </span>
                  <button
                    type="button"
                    className="ghost small"
                    onClick={(event) => {
                      event.stopPropagation()
                      downloadCorrectedResult(result.filePath)
                    }}
                    onKeyDown={(event) => {
                      event.stopPropagation()
                    }}
                    aria-label={`Descargar archivo corregido de ${result.fileName}`}
                  >
                    Descargar corregido
                  </button>
                </div>
              </div>
              {expandedFiles.has(result.filePath) && (
                <>
                <div className="result-body">
                  <div className="result-findings">
                    {result.findings.length === 0 ? (
                      <div className="finding finding-empty">
                        <p className="muted">Sin incidencias detectadas.</p>
                      </div>
                    ) : (
                      result.findings.map((finding: FindingWithSuggestion, index) => {
                        const statusParts = [
                          finding.rule.kind === 'recommended'
                            ? 'Recomendacion oficial'
                            : `Deprecado en ${finding.rule.deprecated}`
                        ]
                        if (finding.rule.kind !== 'recommended' && finding.rule.removed) {
                          statusParts.push(`Obsoleto en ${finding.rule.removed}`)
                        }
                        statusParts.push(`Modulo: ${finding.rule.type}`)

                        return (
                          <div
                            key={`${result.filePath}-${finding.line}-${index}`}
                            className="finding finding-jump"
                            role="button"
                            tabIndex={0}
                            onClick={() => jumpToLine(result.filePath, finding.line)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault()
                                jumpToLine(result.filePath, finding.line)
                              }
                            }}
                          >
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
                    <div className="code-viewer-section">
                      <p className="included-title">ARCHIVO COMPLETO (SOLO LECTURA)</p>
                      <div
                        className="code-viewer"
                        ref={(element) => setCodeViewerRef(result.filePath, element)}
                      >
                        {result.fileLines.length === 0 ? (
                          <p className="muted">Archivo vacio.</p>
                        ) : (
                          result.fileLines.map((lineText, lineIndex) => {
                            const lineNumber = lineIndex + 1
                            const isActive = activeLineByFile[result.filePath] === lineNumber
                            return (
                              <div
                                key={`${result.filePath}-code-${lineNumber}`}
                                className={`code-line ${isActive ? 'is-active' : ''}`}
                                data-code-line={lineNumber}
                              >
                                <span className="code-line-number">{lineNumber}</span>
                                <span className="code-line-text">{lineText || ' '}</span>
                              </div>
                            )
                          })
                        )}
                      </div>
                    </div>
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
                              <div className="included-header">
                                {includeResult == null ? (
                                  <span className="included-header-text">{header}</span>
                                ) : (
                                  <button
                                    type="button"
                                    className="included-header-link included-header-text"
                                    onClick={() => jumpToFileResult(includeResult.filePath)}
                                    aria-label={`Ir al archivo ${includeResult.filePath}`}
                                    title={`Ir al archivo ${includeResult.filePath}`}
                                  >
                                    {header}
                                  </button>
                                )}
                                {includeResult == null ? null : (
                                  includeFindings.length > 0 ? (
                                    <span
                                      className="included-count-badge"
                                      aria-label={`Incidencias localizadas: ${includeFindings.length}`}
                                      title={`Incidencias localizadas: ${includeFindings.length}`}
                                    >
                                      {includeFindings.length}
                                    </span>
                                  ) : null
                                )}
                              </div>
                              {includeResult == null ? (
                                <p className="muted">Archivo no escaneado.</p>
                              ) : (
                                <>
                                  {includeFindings.length === 0 ? null : (
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
                                </>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </aside>
                </div>
                </>
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
